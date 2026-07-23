import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RegistrationRequest,
  RegistrationStatus,
  RegistrationRelationship,
  RegistrationType,
  InvitationSource,
  CreateRegistrationRequestDto,
  StatusHistoryItem,
  RegistrationSettings,
  UpdateRegistrationSettingsDto,
  RegistrationStats
} from "../types/registration.types";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
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

interface RegistrationRequestDbRow {
  id: string;
  property_id: string;
  unit_id: string;
  person_id: string | null;
  registration_type: string;
  relationship: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  id_card: string | null;
  passport: string | null;
  invitation_source: string;
  status: string;
  remarks: string | null;
  
  // Transaction Table Standard Audit
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;

  // Review
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;

  // Approval Activation Audit
  approved_by: string | null;
  approved_at: string | null;
  account_created_at: string | null;
  portal_enabled_at: string | null;
  profile_id: string | null;
  resident_assignment_id: string | null;

  // Snapshot Fields
  requested_unit_number: string;
  requested_property_name: string | null;

  // Client Audit
  source_ip: string | null;
  user_agent: string | null;

  // Status History
  status_history: StatusHistoryItem[] | null;
}

export function mapToRegistrationRequest(row: RegistrationRequestDbRow): RegistrationRequest {
  return {
    id: row.id,
    property_id: row.property_id,
    unit_id: row.unit_id,
    person_id: row.person_id,
    registration_type: row.registration_type as RegistrationType,
    relationship: row.relationship as RegistrationRelationship,
    first_name: row.first_name,
    last_name: row.last_name,
    display_name: row.display_name,
    email: row.email,
    phone: row.phone,
    nationality: row.nationality,
    id_card: row.id_card,
    passport: row.passport,
    invitation_source: row.invitation_source as InvitationSource,
    status: row.status as RegistrationStatus,
    remarks: row.remarks,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    deleted_at: row.deleted_at,
    deleted_by: row.deleted_by,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    rejection_reason: row.rejection_reason,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    account_created_at: row.account_created_at,
    portal_enabled_at: row.portal_enabled_at,
    profile_id: row.profile_id,
    resident_assignment_id: row.resident_assignment_id,
    requested_unit_number: row.requested_unit_number,
    requested_property_name: row.requested_property_name,
    source_ip: row.source_ip,
    user_agent: row.user_agent,
    status_history: row.status_history,
  };
}

export async function create(dto: CreateRegistrationRequestDto): Promise<RegistrationRequest> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  // Resolve snapshot fields for unit number and property name
  const { data: unitData } = await supabase
    .from("units")
    .select("unit_number")
    .eq("id", dto.unit_id)
    .single();

  const { data: propData } = await supabase
    .from("properties")
    .select("property_name_th, property_name_en")
    .eq("id", dto.property_id)
    .single();

  const requestedUnitNumber = unitData?.unit_number || "UNKNOWN";
  const requestedPropertyName = propData
    ? (propData.property_name_th || propData.property_name_en || null)
    : null;

  const initialHistory: StatusHistoryItem[] = [
    {
      status: RegistrationStatus.PENDING,
      changed_at: new Date().toISOString(),
      changed_by: dto.created_by || null,
      remarks: dto.remarks || "Request submitted",
    }
  ];

  const payload = {
    property_id: dto.property_id,
    unit_id: dto.unit_id,
    person_id: dto.person_id || null,
    registration_type: dto.registration_type,
    relationship: dto.relationship || RegistrationRelationship.RESIDENT,
    first_name: dto.first_name,
    last_name: dto.last_name,
    display_name: dto.display_name || `${dto.first_name} ${dto.last_name}`,
    email: dto.email || null,
    phone: dto.phone || null,
    nationality: dto.nationality || null,
    id_card: dto.id_card || null,
    passport: dto.passport || null,
    invitation_source: dto.invitation_source,
    status: RegistrationStatus.PENDING,
    remarks: dto.remarks || null,
    created_by: dto.created_by || null,

    // Snapshot fields
    requested_unit_number: requestedUnitNumber,
    requested_property_name: requestedPropertyName,

    // Client Audit fields
    source_ip: dto.source_ip || null,
    user_agent: dto.user_agent || null,

    // Status History
    status_history: initialHistory,
  };

  const { data, error } = await supabase
    .from("registration_requests")
    .insert([payload])
    .select()
    .single();

  logWriteOperation("INSERT", "registration_requests", payload, error, Date.now() - startTime);

  if (error) {
    throw new Error(`Failed to create registration request: ${error.message}`);
  }

  return mapToRegistrationRequest(data as RegistrationRequestDbRow);
}

export async function findById(id: string): Promise<RegistrationRequest | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("registration_requests")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(`Error finding registration request by id ${id}:`, error);
    return null;
  }

  return data ? mapToRegistrationRequest(data as RegistrationRequestDbRow) : null;
}

export async function findAll(): Promise<RegistrationRequest[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("registration_requests")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error finding all registration requests:", error);
    return [];
  }

  return (data as RegistrationRequestDbRow[] || []).map(mapToRegistrationRequest);
}

export async function findPaginated(filters: {
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
  const supabase = await getSupabase();
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("registration_requests")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.propertyId) {
    query = query.eq("property_id", filters.propertyId);
  }
  if (filters.relationship) {
    query = query.eq("relationship", filters.relationship);
  }
  if (filters.registrationType) {
    query = query.eq("registration_type", filters.registrationType);
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }
  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},requested_unit_number.ilike.${s}`);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error finding paginated registration requests:", error);
    return { data: [], total: 0 };
  }

  return {
    data: (data as RegistrationRequestDbRow[] || []).map(mapToRegistrationRequest),
    total: count || 0,
  };
}

export async function updateStatus(
  id: string,
  status: RegistrationStatus,
  reviewedBy: string | null,
  rejectionReason?: string | null,
  remarks?: string | null
): Promise<RegistrationRequest | null> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  // Fetch current status_history to append the new transition
  const { data: current } = await supabase
    .from("registration_requests")
    .select("status_history")
    .eq("id", id)
    .single();

  const history = Array.isArray(current?.status_history) ? current.status_history : [];
  const updatedHistory = [
    ...history,
    {
      status,
      changed_at: new Date().toISOString(),
      changed_by: reviewedBy,
      remarks: remarks || null,
      rejection_reason: rejectionReason || null
    }
  ];

  const payload: Record<string, unknown> = {
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: reviewedBy,
    status_history: updatedHistory
  };

  if (rejectionReason !== undefined) payload.rejection_reason = rejectionReason;
  if (remarks !== undefined) payload.remarks = remarks;

  const { data, error } = await supabase
    .from("registration_requests")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  logWriteOperation("UPDATE_STATUS", "registration_requests", payload, error, Date.now() - startTime);

  if (error) {
    console.error(`Error updating registration request status for ${id}:`, error);
    return null;
  }

  return mapToRegistrationRequest(data as RegistrationRequestDbRow);
}

// IRM Standard:
// Transaction soft delete is Super Admin only.
export async function softDelete(id: string, deletedBy: string): Promise<boolean> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("registration_requests")
    .select("status_history")
    .eq("id", id)
    .single();

  const history = Array.isArray(current?.status_history) ? current.status_history : [];
  const updatedHistory = [
    ...history,
    {
      status: RegistrationStatus.REJECTED,
      changed_at: new Date().toISOString(),
      changed_by: deletedBy,
      remarks: "Soft deleted by Admin/Super Admin",
    }
  ];

  const payload = {
    deleted_at: new Date().toISOString(),
    deleted_by: deletedBy,
    status: RegistrationStatus.REJECTED,
    status_history: updatedHistory
  };

  const { error } = await supabase
    .from("registration_requests")
    .update(payload)
    .eq("id", id);

  logWriteOperation("SOFT_DELETE", "registration_requests", payload, error, Date.now() - startTime);

  if (error) {
    console.error(`Error soft deleting registration request ${id}:`, error);
    return false;
  }

  return true;
}

export async function hasPendingRequest(
  propertyId: string,
  unitId: string,
  email: string | null,
  phone: string | null
): Promise<boolean> {
  const supabase = await getSupabase();

  let query = supabase
    .from("registration_requests")
    .select("id")
    .is("deleted_at", null)
    .eq("property_id", propertyId)
    .eq("unit_id", unitId)
    .in("status", [RegistrationStatus.PENDING, RegistrationStatus.UNDER_REVIEW, RegistrationStatus.MORE_INFO]);

  // Check if either email OR phone matches if provided
  const conditions: string[] = [];
  if (email) conditions.push(`email.eq.${email}`);
  if (phone) conditions.push(`phone.eq.${phone}`);

  if (conditions.length > 0) {
    query = query.or(conditions.join(","));
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error checking duplicate requests:", error);
    return false;
  }

  return (data || []).length > 0;
}

const defaultSettings = (propertyId: string): RegistrationSettings => ({
  property_id: propertyId,
  enabled: true,
  maintenance_message: "Registration is temporarily closed for maintenance. Please check back later.",
  allow_owner: true,
  allow_co_owner: true,
  allow_resident: true,
  allow_tenant: true,
  allow_family_member: true,
  allow_technician: true,
  allow_housekeeping: true,
  allow_security: true,
  allow_committee: true,
  allow_staff: true,
  activation_method: "SUPABASE_EMAIL",
  email_notifications_enabled: true,
  created_at: new Date().toISOString(),
  created_by: null,
  updated_at: new Date().toISOString(),
  updated_by: null,
  deleted_at: null,
  deleted_by: null
});

export async function getSettings(propertyId: string): Promise<RegistrationSettings> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("registration_settings")
    .select("*")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching settings for property ${propertyId}:`, error);
  }

  if (data) {
    return data as RegistrationSettings;
  }

  // Fallback / Auto-provision
  const startTime = Date.now();
  const fallback = defaultSettings(propertyId);
  const { error: insErr } = await supabase.from("registration_settings").insert([fallback]);
  logWriteOperation("INSERT_DEFAULT_SETTINGS", "registration_settings", fallback, insErr, Date.now() - startTime);

  return fallback;
}

export async function upsertSettings(
  propertyId: string,
  dto: UpdateRegistrationSettingsDto,
  userId: string | null
): Promise<RegistrationSettings> {
  const startTime = Date.now();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Try fetching first to see if it exists
  const { data: existing } = await supabase
    .from("registration_settings")
    .select("property_id")
    .eq("property_id", propertyId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    ...dto,
    updated_at: now,
    updated_by: userId,
  };

  if (!existing) {
    payload.property_id = propertyId;
    payload.created_at = now;
    payload.created_by = userId;

    const { data, error } = await supabase
      .from("registration_settings")
      .insert([payload])
      .select()
      .single();

    logWriteOperation("INSERT_SETTINGS", "registration_settings", payload, error, Date.now() - startTime);

    if (error) {
      throw new Error(`Failed to insert registration settings: ${error.message}`);
    }
    return data as RegistrationSettings;
  } else {
    const { data, error } = await supabase
      .from("registration_settings")
      .update(payload)
      .eq("property_id", propertyId)
      .select()
      .single();

    logWriteOperation("UPDATE_SETTINGS", "registration_settings", payload, error, Date.now() - startTime);

    if (error) {
      throw new Error(`Failed to update registration settings: ${error.message}`);
    }
    return data as RegistrationSettings;
  }
}

export async function getStats(propertyId?: string): Promise<RegistrationStats> {
  const supabase = await getSupabase();

  let query = supabase
    .from("registration_requests")
    .select("status, created_at, reviewed_at")
    .is("deleted_at", null);

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching stats:", error);
    return {
      pending: 0,
      underReview: 0,
      approved: 0,
      rejected: 0,
      moreInfo: 0,
      today: 0,
      thisMonth: 0,
      websiteVisits: 0,
      totalRequests: 0,
      approvalRate: 0,
      averageApprovalTimeHours: 0,
    };
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const thisMonthStr = now.toISOString().slice(0, 7);

  let pending = 0;
  let underReview = 0;
  let approved = 0;
  let rejected = 0;
  let moreInfo = 0;
  let today = 0;
  let thisMonth = 0;

  let totalReviewedCount = 0;
  let totalApprovalTimeMs = 0;

  const rows = (data || []) as { status: string; created_at: string; reviewed_at: string | null }[];

  rows.forEach((r) => {
    if (r.status === RegistrationStatus.PENDING) pending++;
    else if (r.status === RegistrationStatus.UNDER_REVIEW) underReview++;
    else if (r.status === RegistrationStatus.APPROVED) approved++;
    else if (r.status === RegistrationStatus.REJECTED) rejected++;
    else if (r.status === RegistrationStatus.MORE_INFO) moreInfo++;

    if (r.created_at && r.created_at.slice(0, 10) === todayStr) {
      today++;
    }
    if (r.created_at && r.created_at.slice(0, 7) === thisMonthStr) {
      thisMonth++;
    }

    if (r.reviewed_at && r.created_at) {
      const created = new Date(r.created_at).getTime();
      const reviewed = new Date(r.reviewed_at).getTime();
      const diff = reviewed - created;
      if (diff >= 0) {
        totalApprovalTimeMs += diff;
        totalReviewedCount++;
      }
    }
  });

  const totalRequests = (data || []).length;
  const totalDecided = approved + rejected;
  const approvalRate = totalDecided > 0 ? Math.round((approved / totalDecided) * 100) : 0;
  const averageApprovalTimeHours =
    totalReviewedCount > 0 ? Math.round(totalApprovalTimeMs / (1000 * 60 * 60 * totalReviewedCount) * 10) / 10 : 0;

  return {
    pending,
    underReview,
    approved,
    rejected,
    moreInfo,
    today,
    thisMonth,
    websiteVisits: 0,
    totalRequests,
    approvalRate,
    averageApprovalTimeHours,
  };
}

export async function approveRequest(
  id: string,
  fields: {
    approvedBy: string;
    profileId: string | null;
    personId: string;
    residentAssignmentId: string;
    remarks?: string | null;
  }
): Promise<RegistrationRequest | null> {
  const startTime = Date.now();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Fetch current history
  const { data: current } = await supabase
    .from("registration_requests")
    .select("status_history")
    .eq("id", id)
    .single();

  const history = Array.isArray(current?.status_history) ? current.status_history : [];
  const updatedHistory = [
    ...history,
    {
      status: RegistrationStatus.APPROVED,
      changed_at: now,
      changed_by: fields.approvedBy,
      remarks: fields.remarks || "Registration request approved and account activated",
    }
  ];

  const payload = {
    status: RegistrationStatus.APPROVED,
    approved_by: fields.approvedBy,
    approved_at: now,
    account_created_at: now,
    portal_enabled_at: now,
    profile_id: fields.profileId,
    person_id: fields.personId,
    resident_assignment_id: fields.residentAssignmentId,
    status_history: updatedHistory,
    updated_at: now,
    updated_by: fields.approvedBy,
  };

  const { data, error } = await supabase
    .from("registration_requests")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  logWriteOperation("APPROVE_REQUEST", "registration_requests", payload, error, Date.now() - startTime);

  if (error) {
    console.error(`Error approving registration request ${id}:`, error);
    return null;
  }

  return mapToRegistrationRequest(data as RegistrationRequestDbRow);
}
