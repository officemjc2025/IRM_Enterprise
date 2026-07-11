import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  RegistrationRequest,
  RegistrationStatus,
  RegistrationRelationship,
  RegistrationType,
  InvitationSource,
  CreateRegistrationRequestDto
} from "../types/registration.types";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
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

  // Snapshot Fields
  requested_unit_number: string;
  requested_property_name: string | null;

  // Client Audit
  source_ip: string | null;
  user_agent: string | null;
}

function mapToRegistrationRequest(row: RegistrationRequestDbRow): RegistrationRequest {
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
    requested_unit_number: row.requested_unit_number,
    requested_property_name: row.requested_property_name,
    source_ip: row.source_ip,
    user_agent: row.user_agent,
  };
}

export async function create(dto: CreateRegistrationRequestDto): Promise<RegistrationRequest> {
  const supabase = await getSupabase();

  // Resolve snapshot fields for unit number and property name
  const { data: unitData } = await supabase
    .from("units")
    .select("unit_number")
    .eq("id", dto.unit_id)
    .single();

  const { data: propData } = await supabase
    .from("properties")
    .select("name")
    .eq("id", dto.property_id)
    .single();

  const requestedUnitNumber = unitData?.unit_number || "UNKNOWN";
  const requestedPropertyName = propData?.name || null;

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
  };

  const { data, error } = await supabase
    .from("registration_requests")
    .insert([payload])
    .select()
    .single();

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

export async function updateStatus(
  id: string,
  status: RegistrationStatus,
  reviewedBy: string | null,
  rejectionReason?: string | null,
  remarks?: string | null
): Promise<RegistrationRequest | null> {
  const supabase = await getSupabase();
  const payload: {
    status: RegistrationStatus;
    reviewed_by: string | null;
    reviewed_at: string;
    rejection_reason?: string | null;
    remarks?: string | null;
    updated_at: string;
    updated_by: string | null;
  } = {
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: reviewedBy,
  };

  if (rejectionReason !== undefined) payload.rejection_reason = rejectionReason;
  if (remarks !== undefined) payload.remarks = remarks;

  const { data, error } = await supabase
    .from("registration_requests")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating registration request status for ${id}:`, error);
    return null;
  }

  return mapToRegistrationRequest(data as RegistrationRequestDbRow);
}

// IRM Standard:
// Transaction soft delete is Super Admin only.
export async function softDelete(id: string, deletedBy: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("registration_requests")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
      status: RegistrationStatus.REJECTED // Optional convention alignment
    })
    .eq("id", id);

  if (error) {
    console.error(`Error soft deleting registration request ${id}:`, error);
    return false;
  }

  return true;
}
