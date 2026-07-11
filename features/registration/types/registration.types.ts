// =====================================================
// IRM Enterprise — Registration Feature Types
// IRM-043: Canonical Registration Foundation
// =====================================================

// ---------------------
// Enums
// ---------------------

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

// ---------------------
// Core Entity
// ---------------------

export interface RegistrationRequest {
  id: string;
  registration_type: RegistrationType;
  invitation_source: InvitationSource;
  status: RegistrationStatus;

  // Applicant identity
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  id_card: string | null;

  // Unit claim
  unit_id: string | null;
  relationship: RegistrationRelationship | null;

  // Admin
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  remarks: string | null;

  // Audit
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------
// DTOs (future API use)
// ---------------------

export interface CreateRegistrationRequestDto {
  registration_type: RegistrationType;
  invitation_source: InvitationSource;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  id_card?: string | null;
  unit_id?: string | null;
  relationship?: RegistrationRelationship | null;
  remarks?: string | null;
}

export interface UpdateRegistrationRequestDto {
  status?: RegistrationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  remarks?: string | null;
}
