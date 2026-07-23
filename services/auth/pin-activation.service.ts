import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export function generateTemporaryPin(): string {
  // Generate secure 6-digit numeric PIN
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

export const PinActivationService = {
  async resetTemporaryPin(profileId: string, adminId?: string | null): Promise<string> {
    const adminClient = createAdminClient();
    const pin = generateTemporaryPin();
    const hashedPin = hashPin(pin);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Invalidate any existing unused PINs
    await adminClient
      .from("pin_activations")
      .update({ invalidated_at: now })
      .eq("profile_id", profileId)
      .is("temporary_pin_used_at", null)
      .is("invalidated_at", null);

    // 2. Insert new temporary PIN
    const { error: insErr } = await adminClient
      .from("pin_activations")
      .insert([
        {
          profile_id: profileId,
          temporary_pin_hash: hashedPin,
          temporary_pin_expires_at: expiresAt,
          failed_pin_attempts: 0,
          created_by: adminId || null,
          created_at: now,
          updated_at: now,
        },
      ]);

    if (insErr) {
      console.error("Failed to insert pin activation record:", insErr);
      throw new Error(`Failed to save temporary PIN: ${insErr.message}`);
    }

    // 3. Update profile status to PIN_ISSUED
    const { error: profErr } = await adminClient
      .from("profiles")
      .update({
        auth_status: "PIN_ISSUED",
        activation_method: "PIN",
        force_password_change: true,
      })
      .eq("id", profileId);

    if (profErr) {
      console.error("Failed to update profile auth_status to PIN_ISSUED:", profErr);
      throw new Error(`Failed to update profile activation status: ${profErr.message}`);
    }

    return pin;
  },

  async validateTemporaryPin(profileId: string, pin: string): Promise<boolean> {
    const adminClient = createAdminClient();

    // Get the latest unused, non-invalidated PIN for this profile
    const { data: pins, error: pinErr } = await adminClient
      .from("pin_activations")
      .select("*")
      .eq("profile_id", profileId)
      .is("temporary_pin_used_at", null)
      .is("invalidated_at", null)
      .order("created_at", { ascending: false });

    if (pinErr) {
      console.error("Failed to select pin activations:", pinErr);
      throw new Error("Failed to verify PIN activation details.");
    }

    const activePin = pins?.[0];
    if (!activePin) {
      throw new Error("No active temporary PIN found for this account. Please contact your property administrator.");
    }

    // Check failed attempts
    if (activePin.failed_pin_attempts >= 5) {
      throw new Error("This Temporary PIN is locked due to too many failed attempts. Please contact your property office to reset your PIN.");
    }

    // Check expiration
    if (new Date(activePin.temporary_pin_expires_at).getTime() < Date.now()) {
      // Mark as expired in auth_status
      await adminClient
        .from("profiles")
        .update({ auth_status: "PIN_EXPIRED" })
        .eq("id", profileId);
      throw new Error("This Temporary PIN has expired. Please contact your property office to reset your PIN.");
    }

    const hashedInput = hashPin(pin);
    if (hashedInput === activePin.temporary_pin_hash) {
      // Success: Reset failed attempts to 0
      await adminClient
        .from("pin_activations")
        .update({ failed_pin_attempts: 0 })
        .eq("id", activePin.id);

      return true;
    } else {
      // Failure: Increment failed attempts
      const newAttempts = activePin.failed_pin_attempts + 1;
      await adminClient
        .from("pin_activations")
        .update({ failed_pin_attempts: newAttempts })
        .eq("id", activePin.id);

      if (newAttempts >= 5) {
        // Lock profile status
        await adminClient
          .from("profiles")
          .update({ auth_status: "LOCKED" })
          .eq("id", profileId);
        throw new Error("Too many failed attempts. This Temporary PIN is now locked. Please contact your property office.");
      }

      throw new Error(`Invalid Temporary PIN. Attempts remaining: ${5 - newAttempts}`);
    }
  },

  async forcePasswordChange(profileId: string, newPassword: string): Promise<void> {
    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    // 1. Update Auth password using Admin API
    const { error: authErr } = await adminClient.auth.admin.updateUserById(profileId, {
      password: newPassword,
    });

    if (authErr) {
      console.error("Failed to update password in auth schema:", authErr);
      throw new Error(`Failed to update password: ${authErr.message}`);
    }

    // 2. Mark latest active PIN as used
    const { data: pins } = await adminClient
      .from("pin_activations")
      .select("id")
      .eq("profile_id", profileId)
      .is("temporary_pin_used_at", null)
      .is("invalidated_at", null)
      .order("created_at", { ascending: false });

    if (pins?.[0]?.id) {
      await adminClient
        .from("pin_activations")
        .update({ temporary_pin_used_at: now })
        .eq("id", pins[0].id);
    }

    // 3. Update profile to ACTIVE, clear force change flags, accept terms
    const { error: profErr } = await adminClient
      .from("profiles")
      .update({
        auth_status: "ACTIVE",
        force_password_change: false,
        accepted_terms_at: now,
        accepted_privacy_at: now,
        first_login_at: now,
        password_changed_at: now,
        status: "active",
        account_status: "ACTIVE",
      })
      .eq("id", profileId);

    if (profErr) {
      console.error("Failed to update profile to active status:", profErr);
      throw new Error(`Failed to update profile status: ${profErr.message}`);
    }
  },
};
