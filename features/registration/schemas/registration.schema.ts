import { z } from "zod";
import {
  RegistrationType,
  RegistrationRelationship,
  InvitationSource,
  RegistrationStatus
} from "../types/registration.types";

export const createRegistrationRequestSchema = z.object({
  property_id: z.string().uuid("Property ID must be a valid UUID"),
  unit_id: z.string().uuid("Unit ID must be a valid UUID"),
  person_id: z.string().uuid("Person ID must be a valid UUID").nullable().optional(),
  registration_type: z.nativeEnum(RegistrationType, {
    message: "Invalid registration type"
  }),
  relationship: z.nativeEnum(RegistrationRelationship, {
    message: "Invalid relationship type"
  }),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  display_name: z.string().optional(),
  email: z.string().email("Invalid email format").nullable().optional().or(z.literal("")),
  phone: z.string().min(8, "Phone number must be at least 8 digits").nullable().optional().or(z.literal("")),
  nationality: z.string().nullable().optional(),
  id_card: z.string().nullable().optional(),
  passport: z.string().nullable().optional(),
  invitation_source: z.nativeEnum(InvitationSource, {
    message: "Invalid invitation source"
  }),
  remarks: z.string().nullable().optional(),
  
  // System-populated fields
  requested_unit_number: z.string().optional(),
  requested_property_name: z.string().nullable().optional(),
  source_ip: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
});

export const updateRegistrationRequestSchema = z.object({
  status: z.nativeEnum(RegistrationStatus, {
    message: "Invalid registration status"
  }).optional(),
  remarks: z.string().nullable().optional(),
});
