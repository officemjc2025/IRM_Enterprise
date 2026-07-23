import * as personRepository from "@/repositories/person/person.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseClient } from "@supabase/supabase-js";
import { Status } from "@/shared/enums/status";
import { Role } from "@/shared/auth";
import { PinActivationService } from "@/services/auth/pin-activation.service";
import { ResidentAssignment } from "@/features/resident-assignment/types/resident-assignment.types";

import * as registrationRepository from "../repositories/registration.repository";
import { createRegistrationRequestSchema, updateRegistrationRequestSchema, updateRegistrationSettingsSchema } from "../schemas/registration.schema";
import {
  RegistrationRequest,
  RegistrationStatus,
  CreateRegistrationRequestDto,
  RegistrationSettings,
  UpdateRegistrationSettingsDto,
  RegistrationType,
  RegistrationRelationship,
  RegistrationStats
} from "../types/registration.types";

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("66") && digits.length === 11) {
    return "0" + digits.substring(2);
  }
  if (digits.startsWith("66") && digits.length === 10) {
    return "0" + digits.substring(2);
  }
  if (digits.length === 9 && (digits.startsWith("8") || digits.startsWith("9") || digits.startsWith("6"))) {
    return "0" + digits;
  }
  return digits;
}
function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  const err = error as Record<string, unknown>;
  return (
    err.status === 429 ||
    err.code === "over_email_send_rate_limit" ||
    (typeof err.message === "string" && err.message.toLowerCase().includes("rate limit"))
  );
}
async function findAuthUserByEmail(adminClient: SupabaseClient, email: string): Promise<Record<string, unknown> | null> {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage
    });
    if (error || !data || !data.users || data.users.length === 0) {
      break;
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found as unknown as Record<string, unknown>;
    if (data.users.length < perPage) break;
    page++;
  }
  return null;
}





function logWriteOperation(
  operation: string,
  table: string,
  payload: unknown,
  error: { code?: string; message?: string; details?: string; hint?: string } | null,
  durationMs: number
) {
  if (process.env.NODE_ENV !== "production") {
    console.log("-----------------------------------------");
    console.log(`[DB WRITE] OPERATION: ${operation}`);
    console.log(`[DB WRITE] TABLE: ${table}`);
    console.log(`[DB WRITE] PAYLOAD:`, JSON.stringify(payload, null, 2));
    console.log(`[DB WRITE] DURATION: ${durationMs}ms`);
    if (error) {
      console.error(`[DB WRITE] ERROR CODE: ${error.code}`);
      console.error(`[DB WRITE] ERROR MESSAGE: ${error.message}`);
      console.error(`[DB WRITE] ERROR DETAILS: ${error.details}`);
      console.error(`[DB WRITE] ERROR HINT: ${error.hint}`);
    } else {
      console.log(`[DB WRITE] SUCCESS`);
    }
    console.log("-----------------------------------------");
  }
}

function mapRegistrationToRole(regType: string, relationship: string): string {
  if (regType === "RESIDENT") {
    switch (relationship) {
      case "OWNER": return "owner";
      case "CO_OWNER": return "co_owner";
      case "TENANT": return "tenant";
      default: return "resident";
    }
  }
  switch (regType) {
    case "TECHNICIAN": return "technician";
    case "HOUSEKEEPING": return "housekeeping";
    case "SECURITY": return "security";
    case "COMMITTEE": return "committee";
    case "STAFF": return "property_admin";
    default: return "resident";
  }
}

export const registrationService = {
  async createRegistrationRequest(dto: CreateRegistrationRequestDto): Promise<RegistrationRequest> {
    if (dto.invitation_source === "WEBSITE") {
      dto.registration_type = RegistrationType.RESIDENT;
    }
    // Validate request using Zod schema
    const validatedDto = createRegistrationRequestSchema.parse(dto);

    // 1. Fetch settings for property to check if registration is open and type allowed
    const settings = await registrationRepository.getSettings(validatedDto.property_id);
    if (!settings.enabled) {
      throw new Error(settings.maintenance_message || "Registration is closed for this property.");
    }

    // Check if the specific registration type / relationship is allowed
    if (validatedDto.registration_type === RegistrationType.RESIDENT) {
      if (validatedDto.relationship === RegistrationRelationship.OWNER && !settings.allow_owner) {
        throw new Error("Registration for owners is disabled for this property.");
      }
      if (validatedDto.relationship === RegistrationRelationship.CO_OWNER && !settings.allow_co_owner) {
        throw new Error("Registration for co-owners is disabled for this property.");
      }
      if (validatedDto.relationship === RegistrationRelationship.RESIDENT && !settings.allow_resident) {
        throw new Error("Registration for residents is disabled for this property.");
      }
      if (validatedDto.relationship === RegistrationRelationship.TENANT && !settings.allow_tenant) {
        throw new Error("Registration for tenants is disabled for this property.");
      }
      if (validatedDto.relationship === RegistrationRelationship.FAMILY_MEMBER && !settings.allow_family_member) {
        throw new Error("Registration for family members is disabled for this property.");
      }
    } else {
      if (validatedDto.registration_type === RegistrationType.TECHNICIAN && !settings.allow_technician) {
        throw new Error("Registration for technicians is disabled for this property.");
      }
      if (validatedDto.registration_type === RegistrationType.HOUSEKEEPING && !settings.allow_housekeeping) {
        throw new Error("Registration for housekeeping is disabled for this property.");
      }
      if (validatedDto.registration_type === RegistrationType.SECURITY && !settings.allow_security) {
        throw new Error("Registration for security is disabled for this property.");
      }
      if (validatedDto.registration_type === RegistrationType.COMMITTEE && !settings.allow_committee) {
        throw new Error("Registration for committee members is disabled for this property.");
      }
      if (validatedDto.registration_type === RegistrationType.STAFF && !settings.allow_staff) {
        throw new Error("Registration for staff members is disabled for this property.");
      }
    }

    // 2. Prevent duplicate registration requests
    const duplicateExists = await registrationRepository.hasPendingRequest(
      validatedDto.property_id,
      validatedDto.unit_id,
      validatedDto.email || null,
      validatedDto.phone || null
    );

    if (duplicateExists) {
      throw new Error("A registration request is already in progress.");
    }

    // Call repository to insert
    return registrationRepository.create({
      ...validatedDto,
      display_name: validatedDto.display_name || `${validatedDto.first_name} ${validatedDto.last_name}`,
    });
  },

  async getRegistrationRequests(): Promise<RegistrationRequest[]> {
    return registrationRepository.findAll();
  },

  async getPaginatedRegistrationRequests(filters: {
    search?: string;
    status?: string;
    propertyId?: string;
    dateFrom?: string;
    dateTo?: string;
    relationship?: string;
    registrationType?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: RegistrationRequest[]; total: number }> {
    return registrationRepository.findPaginated(filters);
  },

  async getRegistrationRequest(id: string): Promise<RegistrationRequest | null> {
    if (!id) throw new Error("Registration request ID is required");
    return registrationRepository.findById(id);
  },

  async updateRegistrationRequestStatus(
    id: string,
    status: RegistrationStatus,
    reviewedBy: string | null,
    rejectionReason?: string | null,
    remarks?: string | null,
    origin?: string
  ): Promise<{ request: RegistrationRequest; tempPassword?: string } | RegistrationRequest | null> {
    if (!id) throw new Error("Registration request ID is required");

    if (status === RegistrationStatus.APPROVED) {
      if (!reviewedBy) throw new Error("Admin ID is required to approve a request.");
      return this.activateApprovedRegistration(id, reviewedBy, remarks, origin);
    }

    // Validate the status updates if any
    updateRegistrationRequestSchema.parse({ status, remarks });

    return registrationRepository.updateStatus(id, status, reviewedBy, rejectionReason, remarks);
  },

  async activateApprovedRegistration(
    id: string,
    approvedBy: string,
    remarks?: string | null,
    _origin?: string
  ): Promise<{ request: RegistrationRequest; tempPassword?: string; warningMessage?: string; activationResult?: string; pin?: string }> {
    // 1. Fetch request
    const r = await registrationRepository.findById(id);
    if (!r) throw new Error("Registration request not found.");

    // Validate status
    if (r.status === RegistrationStatus.APPROVED) {
      throw new Error("This request has already been approved.");
    }
    if (r.status === RegistrationStatus.REJECTED) {
      throw new Error("This request has already been rejected.");
    }

    if (!r.email) {
      throw new Error("Email is required for account activation.");
    }

    // Load property settings to check activation method
    const settings = await this.getSettings(r.property_id);
    const _method = settings.activation_method || "SUPABASE_EMAIL";

    // 2. Resolve Person
    const normalizedPhone = normalizePhone(r.phone);
    let person: { id: string } | null = null;
    if (r.person_id) {
      person = await personRepository.findById(r.person_id);
    }
    if (!person) {
      person = await personRepository.findByEmailOrPhone(r.email, normalizedPhone);
    }
    if (!person) {
      person = await personRepository.create({
        first_name: r.first_name,
        last_name: r.last_name,
        display_name: r.display_name || `${r.first_name} ${r.last_name}`,
        email: r.email,
        phone: normalizedPhone,
        nationality: r.nationality || null,
        id_card: r.id_card || null,
        passport: r.passport || null,
        status: Status.ACTIVE,
      });
    }

    if (!person) {
      throw new Error("Failed to resolve or create person record.");
    }

    // 3. Resolve existing auth user and profiles
    const adminClient = createAdminClient();
    let userId: string | null = null;
    let pin: string | undefined = undefined;
    let profileCreated = false;
    let assignmentCreated = false;
    let createdAssignment: ResidentAssignment | null = null;
    const warningMessage: string | undefined = undefined;
    let activationResult = "NEW_AUTH_USER";

    // Search auth.users by email
    const authUser = await findAuthUserByEmail(adminClient, r.email);
    const authUserExists = !!authUser;

    let existingProfile: Record<string, unknown> | null = null;
    if (authUserExists && authUser) {
      const { data: pData } = await adminClient
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      existingProfile = pData as Record<string, unknown> | null;
    }

    if (!existingProfile && person) {
      const { data: pData } = await adminClient
        .from("profiles")
        .select("*")
        .eq("person_id", person.id)
        .maybeSingle();
      existingProfile = pData as Record<string, unknown> | null;
    }

    if (authUserExists && authUser) {
      userId = authUser.id as string;
      
      const isCompleted = existingProfile && existingProfile.accepted_terms_at && !existingProfile.force_password_change;
      
      if (isCompleted) {
        // Auth User already completed activation. Skip PIN generation completely.
        console.log(`[activateApprovedRegistration] Auth User ${userId} already completed activation. Skipping PIN generation.`);
        activationResult = "ALREADY_ACTIVATED";
        
        // Update profile auth_status to 'ACTIVE'
        const { error: pUpdErr } = await adminClient
          .from("profiles")
          .update({
            auth_status: "ACTIVE",
            activation_method: "PIN"
          })
          .eq("id", userId);
        if (pUpdErr) {
          console.error("Failed to update auth_status to ACTIVE:", pUpdErr);
        }
      } else {
        // Auth User exists but hasn't completed activation. Generate Temporary PIN.
        console.log(`[activateApprovedRegistration] Auth User ${userId} exists but has not completed activation. Generating PIN.`);
        activationResult = "PASSWORD_RESET_REQUIRED";
        
        if (!existingProfile) {
          // Create profile if missing
          const mappedRole = mapRegistrationToRole(r.registration_type, r.relationship) as Role;
          const profilePayload = {
            id: userId,
            email: r.email,
            display_name: r.display_name || `${r.first_name} ${r.last_name}`,
            full_name: `${r.first_name} ${r.last_name}`,
            phone: normalizedPhone,
            avatar_url: null,
            role: mappedRole,
            property_id: r.property_id,
            person_id: person.id,
            language: "th" as const,
            theme: "system" as const,
            status: "active" as const,
            account_status: "ACTIVE" as const,
            force_password_change: true,
            accepted_terms_at: null,
            accepted_privacy_at: null,
            auth_status: "PENDING",
            activation_method: "PIN"
          };
          const { error: pInsErr } = await adminClient
            .from("profiles")
            .insert([profilePayload]);
          if (pInsErr) throw pInsErr;
        }

        pin = await PinActivationService.resetTemporaryPin(userId, approvedBy);
      }
      profileCreated = true;
    } else {
      // Auth User does NOT exist -> Create Auth User with random password, then generate Temporary PIN
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: r.email,
        email_confirm: true,
        password: Math.random().toString(36).slice(-10),
        user_metadata: { role: mapRegistrationToRole(r.registration_type, r.relationship) }
      });

      if (authError || !authUser.user) {
        console.error("[activateApprovedRegistration] Supabase auth user creation failed:", authError);
        const errorMsg = authError?.message || "Failed to create Supabase Auth user.";
        if (errorMsg.toLowerCase().includes("already exists") || errorMsg.toLowerCase().includes("already registered")) {
          throw new Error("An account with this email address already exists.");
        }
        throw new Error(errorMsg);
      }

      userId = authUser.user.id;
      activationResult = "NEW_AUTH_USER";

      // Create profile
      const mappedRole = mapRegistrationToRole(r.registration_type, r.relationship) as Role;
      const profilePayload = {
        id: userId,
        email: r.email,
        display_name: r.display_name || `${r.first_name} ${r.last_name}`,
        full_name: `${r.first_name} ${r.last_name}`,
        phone: normalizedPhone,
        avatar_url: null,
        role: mappedRole,
        property_id: r.property_id,
        person_id: person.id,
        language: "th" as const,
        theme: "system" as const,
        status: "active" as const,
        account_status: "ACTIVE" as const,
        force_password_change: true,
        accepted_terms_at: null,
        accepted_privacy_at: null,
        auth_status: "PENDING",
        activation_method: "PIN"
      };

      const startTimeProfile = Date.now();
      const { error: pErr } = await adminClient
        .from("profiles")
        .insert([profilePayload]);

      logWriteOperation("INSERT", "profiles", profilePayload, pErr, Date.now() - startTimeProfile);

      if (pErr) {
        throw pErr;
      }
      profileCreated = true;

      // Generate the initial PIN
      pin = await PinActivationService.resetTemporaryPin(userId, approvedBy);
    }

    try {
      // 5. Create resident_assignment directly using admin client (Service Role)
      const startTimeAssignment = Date.now();
      const residentAssignmentPayload = {
        person_id: person!.id,
        unit_id: r.unit_id,
        resident_type: r.relationship,
        is_primary: true,
        move_in_date: new Date().toISOString().split("T")[0],
        status: Status.ACTIVE,
        remarks: null,
      };

      const { data: assignmentData, error: aErr } = await adminClient
        .from("resident_assignments")
        .insert([residentAssignmentPayload])
        .select()
        .single();

      logWriteOperation("INSERT", "resident_assignments", residentAssignmentPayload, aErr, Date.now() - startTimeAssignment);

      if (aErr || !assignmentData) {
        throw aErr || new Error("Failed to create resident assignment in database.");
      }

      createdAssignment = {
        id: assignmentData.id,
        person_id: assignmentData.person_id,
        unit_id: assignmentData.unit_id,
        occupancy_type: assignmentData.resident_type,
        primary_resident: assignmentData.is_primary,
        move_in_date: assignmentData.move_in_date,
        status: assignmentData.status,
        remark: assignmentData.remarks,
        created_at: assignmentData.created_at,
        updated_at: assignmentData.updated_at,
      } as unknown as ResidentAssignment;

      assignmentCreated = true;

      // 6. Update registration request status & details (which now uses adminClient internally)
      const approvedReq = await registrationRepository.approveRequest(id, {
        approvedBy,
        profileId: userId,
        personId: person!.id,
        residentAssignmentId: createdAssignment!.id,
        remarks: remarks || `Registration request approved under PIN activation.`
      });

      if (!approvedReq) {
        throw new Error("Failed to update registration request in database.");
      }

      return {
        request: approvedReq,
        warningMessage,
        activationResult,
        pin
      };

    } catch (dbErr) {
      console.error("Database transaction error during activation, rolling back database inserts...", dbErr);

      // Rollback database inserts using adminClient (Service Role)
      const rollbackSupabase = createAdminClient();
      if (assignmentCreated && createdAssignment?.id) {
        const startTimeRollRA = Date.now();
        const { error: rErr } = await rollbackSupabase.from("resident_assignments").delete().eq("id", createdAssignment.id);
        logWriteOperation("DELETE_ROLLBACK", "resident_assignments", { id: createdAssignment.id }, rErr, Date.now() - startTimeRollRA);
      }
      if (profileCreated && userId) {
        const startTimeRollP = Date.now();
        const { error: rErr } = await rollbackSupabase.from("profiles").delete().eq("id", userId);
        logWriteOperation("DELETE_ROLLBACK", "profiles", { id: userId }, rErr, Date.now() - startTimeRollP);
        await rollbackSupabase.auth.admin.deleteUser(userId);
      }

      throw dbErr;
    }
  },

  async manuallyActivateRequest(id: string, adminUserId: string, _origin?: string): Promise<{ request: RegistrationRequest; tempPassword?: string; warningMessage?: string; activationResult?: string; pin?: string }> {
    const r = await registrationRepository.findById(id);
    if (!r) throw new Error("Registration request not found.");
    if (r.status !== RegistrationStatus.APPROVED) throw new Error("Only approved requests can be manually activated.");
    if (r.profile_id) throw new Error("This request is already activated (profile already linked).");

    // Normalize phone
    const normalizedPhone = normalizePhone(r.phone);

    // Resolve person
    const person = await personRepository.findByEmailOrPhone(r.email || "", normalizedPhone || "");
    if (!person) {
      throw new Error("Person not found for the registration request. Please verify the request state.");
    }

    const adminClient = createAdminClient();
    
    // Check if profile exists by person_id using admin client (Service Role)
    // 3. Resolve existing auth user and profiles
    let userId: string | null = null;
    let pin: string | undefined = undefined;
    const warningMessage: string | undefined = undefined;
    let activationResult = "NEW_AUTH_USER";

    // Search auth.users by email
    const authUser = await findAuthUserByEmail(adminClient, r.email || "");
    const authUserExists = !!authUser;

    let existingProfile: Record<string, unknown> | null = null;
    if (authUserExists && authUser) {
      const { data: pData } = await adminClient
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      existingProfile = pData as Record<string, unknown> | null;
    }

    if (!existingProfile && person) {
      const { data: pData } = await adminClient
        .from("profiles")
        .select("*")
        .eq("person_id", person.id)
        .maybeSingle();
      existingProfile = pData as Record<string, unknown> | null;
    }

    if (authUserExists && authUser) {
      userId = authUser.id as string;
      
      const isCompleted = existingProfile && existingProfile.accepted_terms_at && !existingProfile.force_password_change;
      
      if (isCompleted) {
        // Auth User already completed activation. Skip PIN generation completely.
        console.log(`[manuallyActivateRequest] Auth User ${userId} already completed activation. Skipping PIN generation.`);
        activationResult = "ALREADY_ACTIVATED";
        
        // Update profile auth_status to 'ACTIVE'
        const { error: pUpdErr } = await adminClient
          .from("profiles")
          .update({
            auth_status: "ACTIVE",
            activation_method: "PIN"
          })
          .eq("id", userId);
        if (pUpdErr) {
          console.error("Failed to update auth_status to ACTIVE:", pUpdErr);
        }
      } else {
        // Auth User exists but hasn't completed activation. Generate Temporary PIN.
        console.log(`[manuallyActivateRequest] Auth User ${userId} exists but has not completed activation. Generating PIN.`);
        activationResult = "PASSWORD_RESET_REQUIRED";
        
        if (!existingProfile) {
          // Create profile if missing
          const mappedRole = mapRegistrationToRole(r.registration_type, r.relationship) as Role;
          const profilePayload = {
            id: userId,
            email: r.email,
            display_name: r.display_name || `${r.first_name} ${r.last_name}`,
            full_name: `${r.first_name} ${r.last_name}`,
            phone: normalizedPhone,
            avatar_url: null,
            role: mappedRole,
            property_id: r.property_id,
            person_id: person.id,
            language: "th" as const,
            theme: "system" as const,
            status: "active" as const,
            account_status: "ACTIVE" as const,
            force_password_change: true,
            accepted_terms_at: null,
            accepted_privacy_at: null,
            auth_status: "PENDING",
            activation_method: "PIN"
          };
          const { error: pInsErr } = await adminClient
            .from("profiles")
            .insert([profilePayload]);
          if (pInsErr) throw pInsErr;
        }

        pin = await PinActivationService.resetTemporaryPin(userId, adminUserId);
      }
    } else {
      // Auth User does NOT exist -> Create Auth User with random password, then generate Temporary PIN
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: r.email || "",
        email_confirm: true,
        password: Math.random().toString(36).slice(-10),
        user_metadata: { role: mapRegistrationToRole(r.registration_type, r.relationship) }
      });
      if (authError || !authUser.user) {
        throw new Error(authError?.message || "Failed to create Supabase Auth user.");
      }
      userId = authUser.user.id;
      activationResult = "NEW_AUTH_USER";

      // Create profile using admin client (Service Role)
      const mappedRole = mapRegistrationToRole(r.registration_type, r.relationship) as Role;
      const profilePayload = {
        id: userId,
        email: r.email,
        display_name: r.display_name || `${r.first_name} ${r.last_name}`,
        full_name: `${r.first_name} ${r.last_name}`,
        phone: normalizedPhone,
        avatar_url: null,
        role: mappedRole,
        property_id: r.property_id,
        person_id: person.id,
        language: "th" as const,
        theme: "system" as const,
        status: "active" as const,
        account_status: "ACTIVE" as const,
        force_password_change: true,
        accepted_terms_at: null,
        accepted_privacy_at: null,
        auth_status: "PENDING",
        activation_method: "PIN"
      };

      const startTimeProfile = Date.now();
      const { error: pErr } = await adminClient
        .from("profiles")
        .insert([profilePayload]);

      logWriteOperation("INSERT", "profiles", profilePayload, pErr, Date.now() - startTimeProfile);

      if (pErr) {
        throw pErr;
      }

      // Generate initial PIN
      pin = await PinActivationService.resetTemporaryPin(userId, adminUserId);
    }

    // Update the registration request with the profile id using admin client (Service Role)
    const updatePayload = {
      profile_id: userId,
      account_created_at: new Date().toISOString(),
      portal_enabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: adminUserId
    };

    const startTimeUpdate = Date.now();
    const { data: updatedReqData, error: updateErr } = await adminClient
      .from("registration_requests")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    logWriteOperation("UPDATE", "registration_requests", updatePayload, updateErr, Date.now() - startTimeUpdate);

    if (updateErr) {
      throw new Error(`Failed to update registration request: ${updateErr.message}`);
    }

    const updatedReq = registrationRepository.mapToRegistrationRequest(updatedReqData);

    return {
      request: updatedReq,
      warningMessage,
      activationResult,
      pin
    };
  },

  async retryInvitation(id: string, origin?: string): Promise<{ success: boolean; message: string; code?: string }> {
    const r = await registrationRepository.findById(id);
    if (!r) {
      return { success: false, message: "Registration request not found." };
    }
    
    // It must be approved/active
    if (r.status !== RegistrationStatus.APPROVED && (r.status as unknown as string) !== "active") {
      return { success: false, message: "Request must be approved to retry invitation." };
    }
    
    const email = r.email;
    if (!email) {
      return { success: false, message: "Registration request has no email address." };
    }
    
    const adminClient = createAdminClient();
    const siteUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = `${siteUrl}/reset-password`;
    
    console.log(`[retryInvitation] Triggering inviteUserByEmail for request ID: ${id}, Email: ${email}`);
    const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo
    });
    
    if (authError) {
      if (isRateLimitError(authError)) {
        console.warn("[RATE_LIMIT_EXCEEDED]", {
          code: authError.code || "over_email_send_rate_limit",
          message: authError.message || "email rate limit exceeded",
          timestamp: new Date().toISOString(),
          registration_request_id: id
        });
        return {
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Invitation email was not sent because the Supabase email rate limit has been exceeded."
        };
      }
      
      return {
        success: false,
        message: authError.message
      };
    }
    
    // Update profile's invitation_status to 'INVITED' and force_password_change to true
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
      
    if (profile) {
      const { error: pUpdateErr } = await adminClient
        .from("profiles")
        .update({
          invitation_status: "INVITED",
          force_password_change: true
        })
        .eq("id", profile.id);
        
      if (pUpdateErr) {
        console.error("[retryInvitation] Failed to update profile invitation_status:", pUpdateErr);
      }
    }
    
    return {
      success: true,
      message: "Invitation email sent successfully."
    };
  },

  async sendActivationEmail(email: string, tempPass: string): Promise<void> {
    // TODO: Integrate email provider to send activation details and temporary password
    console.log(`[TODO: sendActivationEmail] Send activation email to ${email} with temp password ${tempPass}`);
  },

  async sendWelcomeNotification(profileId: string): Promise<void> {
    // TODO: Integrate push / LINE notification to welcome the user
    console.log(`[TODO: sendWelcomeNotification] Send welcome notification to profile ${profileId}`);
  },

  // IRM Standard:
  // Transaction soft delete is Super Admin only.
  async deleteRegistrationRequest(id: string, deletedBy: string): Promise<boolean> {
    if (!id) throw new Error("Registration request ID is required");
    return registrationRepository.softDelete(id, deletedBy);
  },

  async getSettings(propertyId: string): Promise<RegistrationSettings> {
    if (!propertyId) throw new Error("Property ID is required");
    return registrationRepository.getSettings(propertyId);
  },

  async updateSettings(
    propertyId: string,
    dto: UpdateRegistrationSettingsDto,
    userId: string | null
  ): Promise<RegistrationSettings> {
    if (!propertyId) throw new Error("Property ID is required");
    const validatedDto = updateRegistrationSettingsSchema.parse(dto);
    return registrationRepository.upsertSettings(propertyId, validatedDto, userId);
  },

  async getStats(propertyId?: string): Promise<RegistrationStats> {
    return registrationRepository.getStats(propertyId);
  }
};
