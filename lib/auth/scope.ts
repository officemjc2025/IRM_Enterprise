import { SupabaseClient } from "@supabase/supabase-js";

export interface AuthorizationScope {
  profileId: string;
  personId: string | null;
  role: string;
  isFullScope: boolean;
  authorizedUnitIds: string[];
  assignmentIds: string[];
  assignments: Array<{
    id: string;
    unit_id: string;
    resident_type: string;
    is_primary: boolean;
  }>;
  isUnitAuthorized(unitId: string | null | undefined): boolean;
  isAssignmentAuthorized(assignmentId: string | null | undefined): boolean;
}

const scopeCache = new WeakMap<object, Map<string, AuthorizationScope>>();

export async function getAuthorizedUnitScope(
  supabase: SupabaseClient,
  userId?: string,
  requestContext?: object
): Promise<AuthorizationScope> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("UNAUTHENTICATED");
    }
    resolvedUserId = user.id;
  }

  if (requestContext) {
    let reqMap = scopeCache.get(requestContext);
    if (!reqMap) {
      reqMap = new Map();
      scopeCache.set(requestContext, reqMap);
    }
    if (reqMap.has(resolvedUserId)) {
      return reqMap.get(resolvedUserId)!;
    }
  }

  // 1. Fetch Profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, role, status, property_id, person_id, account_status, is_active")
    .eq("id", resolvedUserId)
    .single();

  if (profileErr || !profile) {
    throw new Error("UNAUTHORIZED_PROFILE_NOT_FOUND");
  }

  const role = profile.role || "resident";
  const isFullScope = ["super_admin", "admin", "property_admin", "office"].includes(role);

  if (isFullScope) {
    const fullScope: AuthorizationScope = {
      profileId: profile.id,
      personId: profile.person_id || null,
      role,
      isFullScope: true,
      authorizedUnitIds: [],
      assignmentIds: [],
      assignments: [],
      isUnitAuthorized: () => true,
      isAssignmentAuthorized: () => true,
    };

    if (requestContext) {
      const reqMap = scopeCache.get(requestContext);
      if (reqMap) reqMap.set(resolvedUserId, fullScope);
    }

    return fullScope;
  }

  // 2. Non-admin / Resident Scope Resolution
  if (!profile.person_id) {
    const emptyScope: AuthorizationScope = {
      profileId: profile.id,
      personId: null,
      role,
      isFullScope: false,
      authorizedUnitIds: [],
      assignmentIds: [],
      assignments: [],
      isUnitAuthorized: () => false,
      isAssignmentAuthorized: () => false,
    };

    if (requestContext) {
      const reqMap = scopeCache.get(requestContext);
      if (reqMap) reqMap.set(resolvedUserId, emptyScope);
    }

    return emptyScope;
  }

  // 3. Query Active Resident Assignments
  const today = new Date().toISOString().split("T")[0];
  const { data: assignments, error: assignErr } = await supabase
    .from("resident_assignments")
    .select("id, unit_id, resident_type, is_primary, status, move_in_date, move_out_date")
    .eq("person_id", profile.person_id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .lte("move_in_date", today)
    .or(`move_out_date.is.null,move_out_date.gte.${today}`);

  if (assignErr) {
    console.error("Error resolving active resident assignments:", assignErr);
    throw new Error(`Failed to resolve resident scope: ${assignErr.message}`);
  }

  interface RawAssignmentRow {
    id: string;
    unit_id: string;
    resident_type: string;
    is_primary: boolean;
  }

  const rawList = (assignments as unknown as RawAssignmentRow[]) || [];
  
  // Unique unit IDs (deduplicated)
  const unitIdSet = new Set<string>();
  const assignmentIdSet = new Set<string>();
  const mappedAssignments: Array<{ id: string; unit_id: string; resident_type: string; is_primary: boolean }> = [];

  for (const a of rawList) {
    if (a.unit_id) {
      unitIdSet.add(a.unit_id);
    }
    if (a.id) {
      assignmentIdSet.add(a.id);
      mappedAssignments.push({
        id: a.id,
        unit_id: a.unit_id,
        resident_type: a.resident_type,
        is_primary: !!a.is_primary,
      });
    }
  }

  const authorizedUnitIds = Array.from(unitIdSet);
  const assignmentIds = Array.from(assignmentIdSet);

  const scope: AuthorizationScope = {
    profileId: profile.id,
    personId: profile.person_id,
    role,
    isFullScope: false,
    authorizedUnitIds,
    assignmentIds,
    assignments: mappedAssignments,
    isUnitAuthorized: (unitId?: string | null) => {
      if (!unitId) return false;
      return authorizedUnitIds.includes(unitId);
    },
    isAssignmentAuthorized: (assignmentId?: string | null) => {
      if (!assignmentId) return false;
      return assignmentIds.includes(assignmentId);
    },
  };

  if (requestContext) {
    const reqMap = scopeCache.get(requestContext);
    if (reqMap) reqMap.set(resolvedUserId, scope);
  }

  return scope;
}
