import * as personRepository from "@/repositories/person/person.repository";
import { staffRepository } from "../repositories/staff.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { CreateStaffDto, UpdateStaffDto, Staff, StaffStats } from "../types/staff.types";
import { PinActivationService } from "@/services/auth/pin-activation.service";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned || null;
}

export async function generateHardenedEmployeeCode(role: string, adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  let prefix = "EMP";
  const r = role.toLowerCase().trim();
  if (r === "super_admin") prefix = "SA";
  else if (r === "admin") prefix = "ADM";
  else if (r === "property_admin") prefix = "PAD";
  else if (r === "office") prefix = "OFF";
  else if (r === "security") prefix = "SEC";
  else if (r === "technician") prefix = "TEC";
  else if (r === "housekeeping") prefix = "HK";
  else if (r === "committee") prefix = "COM";

  const { data } = await adminClient
    .from("persons")
    .select("person_code")
    .like("person_code", `${prefix}%`);

  let maxNum = 0;
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  data?.forEach((p: { person_code: string | null }) => {
    if (p.person_code) {
      const match = p.person_code.trim().match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNum = maxNum + 1;
  const formattedNum = String(nextNum).padStart(3, "0"); // pad to 3 digits e.g. 001
  return `${prefix}${formattedNum}`;
}

export const staffService = {
  async getStaffList(filters: {
    search?: string;
    role?: string;
    propertyId?: string;
    department?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Staff[]; total: number }> {
    return staffRepository.findPaginated(filters);
  },

  async getStaffById(id: string): Promise<Staff | null> {
    return staffRepository.findById(id);
  },

  async createStaff(dto: CreateStaffDto, createdBy: string): Promise<Staff & { pin?: string }> {
    const adminClient = createAdminClient();
    const normalizedPhone = normalizePhone(dto.phone);

    // 1. Generate sequential employee code if empty
    let code = dto.employee_code || "";
    if (!code) {
      code = await generateHardenedEmployeeCode(dto.role, adminClient);
    }

    // 2. Resolve/Create Person
    let person = await personRepository.findByEmailOrPhone(dto.email, normalizedPhone || "");
    if (!person) {
      person = await personRepository.create({
        person_code: code,
        first_name: dto.first_name,
        last_name: dto.last_name,
        display_name: dto.display_name || `${dto.first_name} ${dto.last_name}`,
        email: dto.email,
        phone: normalizedPhone,
        status: Status.ACTIVE,
      });
    } else {
      if (!person.person_code) {
        await personRepository.update(person.id, { person_code: code });
      }
    }

    // 3. Create Auth account
    let userId = "";
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: dto.email,
      email_confirm: true,
      password: Math.random().toString(36).slice(-10),
      user_metadata: { role: dto.role, force_password_change: true }
    });
    if (authError || !authUser.user) {
      throw new Error(authError?.message || "Failed to create user account.");
    }
    userId = authUser.user.id;

    // 4. Create Profile
    const profilePayload = {
      id: userId,
      email: dto.email,
      display_name: dto.display_name || `${dto.first_name} ${dto.last_name}`,
      full_name: `${dto.first_name} ${dto.last_name}`,
      phone: normalizedPhone,
      role: dto.role,
      property_id: dto.property_id || null,
      person_id: person.id,
      department: dto.department || null,
      team: dto.team || null,
      prefix: dto.prefix || null,
      nickname: dto.nickname || null,
      language: dto.language || "th",
      photo_url: dto.photo_url || null,
      invitation_status: "NOT_SENT",
      theme: "system",
      status: "active",
      account_status: "ACTIVE",
      force_password_change: true,
      auth_status: "PENDING",
      activation_method: "PIN",
      created_by: createdBy,
      updated_by: createdBy
    };

    try {
      await staffRepository.createProfile(profilePayload);
    } catch (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      throw profileError;
    }

    // 5. Generate PIN via PinActivationService
    const pin = await PinActivationService.resetTemporaryPin(userId, createdBy);

    const createdStaff = await staffRepository.findById(userId);
    if (!createdStaff) {
      throw new Error("Failed to retrieve created staff record.");
    }
    
    return {
      ...createdStaff,
      pin
    };
  },

  async updateStaff(id: string, dto: UpdateStaffDto, updatedBy: string): Promise<Staff> {
    const staff = await staffRepository.findById(id);
    if (!staff) throw new Error("Staff member not found.");

    const normalizedPhone = normalizePhone(dto.phone);

    // Lock Employee Code: block modification if person_code already exists
    if (staff.employee_code && dto.employee_code && dto.employee_code !== staff.employee_code) {
      throw new Error("Employee Code is immutable after creation and cannot be changed.");
    }

    // 1. Update Person record (if linked)
    if (staff.person_id) {
      const personPayload: Record<string, unknown> = {};
      if (dto.first_name !== undefined) personPayload.first_name = dto.first_name;
      if (dto.last_name !== undefined) personPayload.last_name = dto.last_name;
      if (dto.display_name !== undefined) personPayload.display_name = dto.display_name;
      if (normalizedPhone !== undefined) personPayload.phone = normalizedPhone;

      if (Object.keys(personPayload).length > 0) {
        await personRepository.update(staff.person_id, personPayload);
      }
    }

    // 2. Update Profile record
    const profilePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    };

    if (dto.role !== undefined) profilePayload.role = dto.role;
    if (dto.property_id !== undefined) profilePayload.property_id = dto.property_id;
    if (dto.department !== undefined) profilePayload.department = dto.department;
    if (dto.team !== undefined) profilePayload.team = dto.team;
    if (dto.prefix !== undefined) profilePayload.prefix = dto.prefix;
    if (dto.nickname !== undefined) profilePayload.nickname = dto.nickname;
    if (dto.language !== undefined) profilePayload.language = dto.language;
    if (dto.photo_url !== undefined) profilePayload.photo_url = dto.photo_url;
    if (dto.status !== undefined) profilePayload.status = dto.status;
    if (dto.account_status !== undefined) profilePayload.account_status = dto.account_status;
    if (dto.invitation_status !== undefined) profilePayload.invitation_status = dto.invitation_status;

    if (dto.display_name !== undefined) {
      profilePayload.display_name = dto.display_name;
      if (dto.first_name && dto.last_name) {
        profilePayload.full_name = `${dto.first_name} ${dto.last_name}`;
      }
    } else if (dto.first_name && dto.last_name) {
      profilePayload.full_name = `${dto.first_name} ${dto.last_name}`;
    }
    if (normalizedPhone !== undefined) profilePayload.phone = normalizedPhone;

    await staffRepository.updateProfile(id, profilePayload);

    // Update role metadata in auth.users if role is changed
    if (dto.role) {
      const adminClient = createAdminClient();
      await adminClient.auth.admin.updateUserById(id, {
        user_metadata: { role: dto.role }
      });
    }

    const updatedStaff = await staffRepository.findById(id);
    if (!updatedStaff) {
      throw new Error("Failed to retrieve updated staff record.");
    }
    return updatedStaff;
  },

  async toggleStaffStatus(id: string, enable: boolean, updatedBy: string): Promise<Staff> {
    const staff = await staffRepository.findById(id);
    if (!staff) throw new Error("Staff member not found.");

    const payload = {
      status: enable ? "active" : "inactive",
      account_status: enable ? "ACTIVE" : "DISABLED",
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    };

    await staffRepository.updateProfile(id, payload);

    const updatedStaff = await staffRepository.findById(id);
    if (!updatedStaff) {
      throw new Error("Failed to retrieve staff record.");
    }
    return updatedStaff;
  },

  async sendInvitation(id: string): Promise<void> {
    const staff = await staffRepository.findById(id);
    if (!staff) throw new Error("Staff member not found.");

    const adminClient = createAdminClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`;

    const { error } = await adminClient.auth.admin.inviteUserByEmail(staff.email, {
      redirectTo
    });

    if (error) {
      throw new Error(`Failed to resend invitation: ${error.message}`);
    }

    await staffRepository.updateProfile(id, {
      invitation_status: "INVITED",
      updated_at: new Date().toISOString()
    });
  },

  async resetPassword(id: string, updatedBy: string): Promise<void> {
    const staff = await staffRepository.findById(id);
    if (!staff) throw new Error("Staff member not found.");

    const clientSupabase = await getSupabase();
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`;
    
    const { error } = await clientSupabase.auth.resetPasswordForEmail(staff.email, {
      redirectTo
    });

    if (error) {
      throw new Error(`Failed to trigger password reset: ${error.message}`);
    }

    await staffRepository.updateProfile(id, {
      force_password_change: true,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    });
  },

  async deleteStaff(id: string, deletedBy: string): Promise<void> {
    await staffRepository.softDelete(id, deletedBy);
  },

  async getStaffStats(propertyId?: string): Promise<StaffStats> {
    return staffRepository.getStats(propertyId);
  },

  // Bulk Actions
  async bulkActivate(ids: string[], updatedBy: string): Promise<void> {
    for (const id of ids) {
      await this.toggleStaffStatus(id, true, updatedBy);
    }
  },

  async bulkDisable(ids: string[], updatedBy: string): Promise<void> {
    for (const id of ids) {
      await this.toggleStaffStatus(id, false, updatedBy);
    }
  },

  async bulkSendInvitation(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.sendInvitation(id);
    }
  },

  async bulkResetPassword(ids: string[], updatedBy: string): Promise<void> {
    for (const id of ids) {
      await this.resetPassword(id, updatedBy);
    }
  },

  async bulkChangeDepartment(ids: string[], department: string, updatedBy: string): Promise<void> {
    for (const id of ids) {
      await staffRepository.updateProfile(id, {
        department,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      });
    }
  },

  async bulkChangeTeam(ids: string[], team: string, updatedBy: string): Promise<void> {
    for (const id of ids) {
      await staffRepository.updateProfile(id, {
        team,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      });
    }
  }
};
