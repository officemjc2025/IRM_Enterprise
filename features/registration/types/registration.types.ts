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

export interface StatusHistoryItem {
  status: RegistrationStatus;
  changed_at: string;
  changed_by: string | null;
  remarks: string | null;
  rejection_reason?: string | null;
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
  status_history?: StatusHistoryItem[] | null;
}

export interface UpdateRegistrationRequestDto {
  status?: RegistrationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  remarks?: string | null;
  updated_by?: string | null;
  status_history?: StatusHistoryItem[] | null;
}

export interface RegistrationSettings {
  property_id: string;
  enabled: boolean;
  maintenance_message: string | null;
  allow_owner: boolean;
  allow_co_owner: boolean;
  allow_resident: boolean;
  allow_tenant: boolean;
  allow_family_member: boolean;
  allow_technician: boolean;
  allow_housekeeping: boolean;
  allow_security: boolean;
  allow_committee: boolean;
  allow_staff: boolean;
  activation_method: "SUPABASE_EMAIL" | "TEMP_PASSWORD" | "MANUAL";
  email_notifications_enabled: boolean;

  // Transaction Standard
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface UpdateRegistrationSettingsDto {
  enabled?: boolean;
  maintenance_message?: string | null;
  allow_owner?: boolean;
  allow_co_owner?: boolean;
  allow_resident?: boolean;
  allow_tenant?: boolean;
  allow_family_member?: boolean;
  allow_technician?: boolean;
  allow_housekeeping?: boolean;
  allow_security?: boolean;
  allow_committee?: boolean;
  allow_staff?: boolean;
  activation_method?: "SUPABASE_EMAIL" | "TEMP_PASSWORD" | "MANUAL";
  email_notifications_enabled?: boolean;
  updated_by?: string | null;
}

export interface RegistrationStats {
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  moreInfo: number;
  today: number;
  thisMonth: number;
  websiteVisits: number;
  totalRequests: number;
  approvalRate: number;
  averageApprovalTimeHours: number;
}
