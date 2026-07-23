import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Staff, StaffStats } from "../types/staff.types";
import { Role } from "@/shared/auth";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

function logWriteOperation(operation: string, table: string, payload: Record<string, unknown> | null, error: unknown, duration: number) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DB WRITE] ${operation} ${table} | Duration: ${duration}ms | Success: ${!error}`, {
      payload,
      error
    });
  }
}

interface StaffDbRow {
  id: string;
  person_id: string | null;
  property_id: string | null;
  email: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  department: string | null;
  status: string | null;
  account_status: string | null;
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
  person?: {
    person_code?: string | null;
    first_name?: string;
    last_name?: string;
  } | null;
  property?: {
    property_name_th?: string | null;
    property_name_en?: string | null;
  } | null;
  prefix?: string | null;
  nickname?: string | null;
  team?: string | null;
  invitation_status?: string | null;
  language?: string | null;
  photo_url?: string | null;
  last_sign_in_at?: string | null;
}

function mapToStaff(row: StaffDbRow): Staff {
  const person = row.person || {};
  const property = row.property || {};

  return {
    id: row.id,
    person_id: row.person_id,
    property_id: row.property_id,
    email: row.email,
    display_name: row.display_name,
    full_name: row.full_name,
    phone: row.phone,
    role: row.role as Role,
    department: row.department,
    status: (row.status || "active") as "active" | "inactive" | "suspended",
    account_status: (row.account_status || "PENDING") as "PENDING" | "ACTIVE" | "LOCKED" | "DISABLED",
    force_password_change: row.force_password_change || false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    
    employee_code: person.person_code || null,
    first_name: person.first_name || "",
    last_name: person.last_name || "",
    
    property_name_th: property.property_name_th || null,
    property_name_en: property.property_name_en || null,

    prefix: row.prefix || null,
    nickname: row.nickname || null,
    team: row.team || null,
    invitation_status: (row.invitation_status || "NOT_SENT") as "NOT_SENT" | "INVITED" | "ACCEPTED" | "EXPIRED",
    language: row.language || "th",
    photo_url: row.photo_url || null,
    last_login: row.last_sign_in_at || null
  };
}

export const staffRepository = {
  async findPaginated(filters: {
    search?: string;
    role?: string;
    propertyId?: string;
    department?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Staff[]; total: number }> {
    const supabase = await getSupabase();
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const staffRoles = [
      "super_admin", "admin", "property_admin", "office", 
      "security", "technician", "housekeeping", "committee"
    ];

    let query = supabase
      .from("profiles")
      .select(`
        *,
        person:person(person_code, first_name, last_name),
        property:properties(property_name_th, property_name_en)
      `, { count: "exact" })
      .is("deleted_at", null)
      .in("role", staffRoles);

    if (filters.role) {
      query = query.eq("role", filters.role);
    }
    if (filters.propertyId) {
      query = query.eq("property_id", filters.propertyId);
    }
    if (filters.department) {
      query = query.eq("department", filters.department);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.search) {
      const s = `%${filters.search}%`;
      query = query.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error finding paginated staff:", error);
      return { data: [], total: 0 };
    }

    const admin = createAdminClient();
    const userIds = data?.map(r => r.id) || [];
    const lastSignInMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      try {
        const { data: authUsers } = await admin
          .schema("auth")
          .from("users")
          .select("id, last_sign_in_at")
          .in("id", userIds);
        authUsers?.forEach(u => {
          lastSignInMap.set(u.id, u.last_sign_in_at);
        });
      } catch (authError) {
        console.error("Error listing auth sign in details:", authError);
      }
    }

    const mappedData = ((data as unknown as StaffDbRow[]) || []).map(row => {
      return mapToStaff({
        ...row,
        last_sign_in_at: lastSignInMap.get(row.id) || null
      });
    });

    return {
      data: mappedData,
      total: count || 0
    };
  },

  async findById(id: string): Promise<Staff | null> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        *,
        person:person(person_code, first_name, last_name),
        property:properties(property_name_th, property_name_en)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      console.error(`Error finding staff by id ${id}:`, error);
      return null;
    }

    const admin = createAdminClient();
    let lastSignIn: string | null = null;
    try {
      const { data: authUser } = await admin
        .schema("auth")
        .from("users")
        .select("last_sign_in_at")
        .eq("id", id)
        .maybeSingle();
      if (authUser) {
        lastSignIn = authUser.last_sign_in_at;
      }
    } catch (authError) {
      console.error("Error reading single auth sign in detail:", authError);
    }

    return mapToStaff({
      ...(data as unknown as StaffDbRow),
      last_sign_in_at: lastSignIn
    });
  },

  async createProfile(payload: Record<string, unknown>): Promise<void> {
    const startTime = Date.now();
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("profiles")
      .insert([payload]);

    logWriteOperation("INSERT", "profiles", payload, error, Date.now() - startTime);

    if (error) {
      throw new Error(`Failed to create staff profile: ${error.message}`);
    }
  },

  async updateProfile(id: string, payload: Record<string, unknown>): Promise<void> {
    const startTime = Date.now();
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("profiles")
      .update(payload)
      .eq("id", id);

    logWriteOperation("UPDATE", "profiles", payload, error, Date.now() - startTime);

    if (error) {
      throw new Error(`Failed to update staff profile: ${error.message}`);
    }
  },

  async softDelete(id: string, deletedBy: string): Promise<void> {
    const startTime = Date.now();
    const adminClient = createAdminClient();
    
    const payload = {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: deletedBy,
      status: "inactive",
      account_status: "DISABLED"
    };

    const { error } = await adminClient
      .from("profiles")
      .update(payload)
      .eq("id", id);

    logWriteOperation("SOFT_DELETE", "profiles", { id, ...payload }, error, Date.now() - startTime);

    if (error) {
      throw new Error(`Failed to archive staff profile: ${error.message}`);
    }
  },

  async getStats(propertyId?: string): Promise<StaffStats> {
    const supabase = await getSupabase();
    const staffRoles = [
      "super_admin", "admin", "property_admin", "office", 
      "security", "technician", "housekeeping", "committee"
    ];

    let query = supabase
      .from("profiles")
      .select("role, status, account_status")
      .is("deleted_at", null)
      .in("role", staffRoles);

    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching staff stats:", error);
      return { total: 0, active: 0, disabled: 0, byRole: {} };
    }

    let active = 0;
    let disabled = 0;
    const byRole: Record<string, number> = {};

    ((data as unknown as Array<{ role: string; status: string; account_status: string }>) || []).forEach((row) => {
      const r = row.role || "unknown";
      byRole[r] = (byRole[r] || 0) + 1;
      
      if (row.status === "active" && row.account_status === "ACTIVE") {
        active++;
      } else if (row.account_status === "DISABLED") {
        disabled++;
      }
    });

    return {
      total: data?.length || 0,
      active,
      disabled,
      byRole
    };
  }
};
