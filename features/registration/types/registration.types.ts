// =====================================================
// IRM Enterprise — Registration Feature Types
// IRM-043: Canonical Registration Foundation
// =====================================================

export enum RegistrationStatus {
  PENDING = "PENDING",
  UNDER_REVIEW = "UNDER_REVIEW",
  MORE_INFO = "MORE_INFO",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum RegistrationRelationship {
  OWNER = "OWNER",
  CO_OWNER = "CO_OWNER",
  RESIDENT = "RESIDENT",
  TENANT = "TENANT",
  FAMILY_MEMBER = "FAMILY_MEMBER",
}

export enum RegistrationType {
  RESIDENT = "RESIDENT",
  TECHNICIAN = "TECHNICIAN",
  HOUSEKEEPING = "HOUSEKEEPING",
  SECURITY = "SECURITY",
  COMMITTEE = "COMMITTEE",
  STAFF = "STAFF",
}

export enum InvitationSource {
  QR = "QR",
  WEBSITE = "WEBSITE",
  OFFICE = "OFFICE",
  SECURITY = "SECURITY",
  ADMIN = "ADMIN",
}

export interface RegistrationRequest {
  id: string;
  property_id: string;
  unit_id: string;
  person_id: string | null;
  registration_type: RegistrationType;
  relationship: RegistrationRelationship;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  id_card: string | null;
  passport: string | null;
  invitation_source: InvitationSource;
  status: RegistrationStatus;
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

export interface CreateRegistrationRequestDto {
  property_id: string;
  unit_id: string;
  person_id?: string | null;
  registration_type: RegistrationType;
  relationship: RegistrationRelationship;
  first_name: string;
  last_name: string;
  display_name?: string;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  id_card?: string | null;
  passport?: string | null;
  invitation_source: InvitationSource;
  remarks?: string | null;

  // Populated by system
  requested_unit_number?: string;
  requested_property_name?: string | null;
  source_ip?: string | null;
  user_agent?: string | null;
  created_by?: string | null;
}

export interface UpdateRegistrationRequestDto {
  status?: RegistrationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  remarks?: string | null;
  updated_by?: string | null;
}
