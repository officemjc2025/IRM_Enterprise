import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_status, is_active")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Profile not found." },
        { status: 401 }
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { success: false, message: "Access Denied: Your account is inactive." },
        { status: 403 }
      );
    }

    if (!profile.account_status) {
      return NextResponse.json(
        { success: false, message: "Access Denied: Configuration Error." },
        { status: 403 }
      );
    }

    if (profile.account_status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: `Access Denied: Your account status is ${profile.account_status}.` },
        { status: 403 }
      );
    }

    const isAllowed = ["admin", "super_admin", "property_admin", "manager"].includes(profile.role);
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, message: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel Database Queries for maximum performance (no N+1 queries)
    const [
      unitsResult,
      assignmentsResult,
      visitorsResult,
      workOrdersResult,
      announcementsResult,
      documentsResult,
      ownersResult,
      personsResult,
    ] = await Promise.all([
      // 1. Total Units count
      supabase.from("units").select("id, status, operational_status"),
      // 2. Active assignments (for occupied units & recent assignments log)
      supabase.from("resident_assignments")
        .select(`
          id,
          unit_id,
          occupancy_type,
          created_at,
          persons:person_id (first_name, last_name, display_name),
          units:unit_id (unit_number)
        `)
        .eq("status", "ACTIVE"),
      // 3. Today's and active visitors
      supabase.from("visitors")
        .select(`
          *,
          resident_assignments:resident_assignment_id (
            units:unit_id (unit_number)
          )
        `)
        .is("deleted_at", null),
      // 4. Active work orders
      supabase.from("work_orders")
        .select(`
          *,
          units:unit_id (unit_number),
          assignees:assigned_to (full_name, display_name)
        `)
        .is("deleted_at", null),
      // 5. Active announcements
      supabase.from("announcements")
        .select("*")
        .is("deleted_at", null),
      // 6. Documents published
      supabase.from("documents")
        .select("*")
        .is("deleted_at", null),
      // 7. Total Owners
      supabase.from("owners").select("id", { count: "exact" }),
      // 8. Total Persons (Residents)
      supabase.from("persons").select("id", { count: "exact" }).is("deleted_at", null),
    ]);

    interface ResidentAssignmentRow {
      id: string;
      unit_id: string;
      occupancy_type: string;
      created_at: string;
      persons: {
        first_name: string;
        last_name: string | null;
        display_name: string | null;
      } | {
        first_name: string;
        last_name: string | null;
        display_name: string | null;
      }[] | null;
      units: {
        unit_number: string;
      } | null;
    }

    const units = unitsResult.data || [];
    const activeAssignments = (assignmentsResult.data || []) as unknown as ResidentAssignmentRow[];
    const visitors = visitorsResult.data || [];
    const workOrders = workOrdersResult.data || [];
    const announcements = announcementsResult.data || [];
    const documents = documentsResult.data || [];
    const totalOwners = ownersResult.count || 0;
    const totalResidents = personsResult.count || 0;

    // --- SECTION 1: Today's Operations ---
    const visitorsWaitingApproval = visitors.filter((v) => v.status === "CREATED").length;
    const visitorsInside = visitors.filter((v) => ["INSIDE", "CHECKED_IN"].includes(v.status)).length;
    const workOrdersWaitingAssignment = workOrders.filter((o) => o.status === "NEW").length;
    const workOrdersInProgress = workOrders.filter((o) => o.status === "IN_PROGRESS").length;
    
    const announcementsExpiringSoon = announcements.filter((a) => {
      if (!a.expire_at) return false;
      const expDate = new Date(a.expire_at);
      return expDate > now && expDate <= sevenDaysLater;
    }).length;

    const documentsPublishedThisWeek = documents.filter((d) => {
      if (!d.published_at) return false;
      const pubDate = new Date(d.published_at);
      return pubDate >= sevenDaysAgo && pubDate <= now;
    }).length;

    // --- SECTION 2: Property Overview ---
    const totalUnits = units.length;

    // Derive occupied/vacant from operational_status (canonical source)
    const occupiedStatuses = new Set([
      "OWNER_OCCUPIED", "TENANT_OCCUPIED", "STAFF", "MJC",
      "CHECKED_IN", "CHECKING_IN", "CHECKING_OUT", "RESERVED",
    ]);
    const occupiedUnits = units.filter((u) => occupiedStatuses.has(u.operational_status || "")).length;
    const vacantUnits = units.filter((u) => (u.operational_status || "VACANT") === "VACANT").length;
    const occupancyRate = totalUnits > 0 ? parseFloat(((occupiedUnits / totalUnits) * 100).toFixed(1)) : 0;

    // --- SECTION 2b: Unit Status Breakdown ---
    const statusCounts = (s: string) => units.filter((u) => u.operational_status === s).length;
    const unitStatusBreakdown = {
      owner_occupied:  statusCounts("OWNER_OCCUPIED"),
      tenant_occupied: statusCounts("TENANT_OCCUPIED"),
      vacant:          statusCounts("VACANT"),
      reserved:        statusCounts("RESERVED"),
      checking_in:     statusCounts("CHECKING_IN"),
      checked_in:      statusCounts("CHECKED_IN"),
      checking_out:    statusCounts("CHECKING_OUT"),
      maintenance:     statusCounts("MAINTENANCE"),
      out_of_service:  statusCounts("OUT_OF_SERVICE"),
      locked:          statusCounts("LOCKED"),
      staff:           statusCounts("STAFF"),
      mjc:             statusCounts("MJC"),
      total:           totalUnits,
    };

    // --- SECTION 3: Visitors ---
    const visitorsToday = visitors.filter((v) => v.visit_date === todayStr).length;
    const visitorsCheckedIn = visitors.filter((v) => v.status === "CHECKED_IN").length;
    const visitorsCheckedOut = visitors.filter((v) => v.status === "CHECKED_OUT").length;
    const visitorsCurrentlyInside = visitorsInside;
    const visitorsCancelled = visitors.filter((v) => v.status === "CANCELLED").length;

    // --- SECTION 4: Work Orders ---
    const workOrdersNew = workOrdersWaitingAssignment;
    const workOrdersAssigned = workOrders.filter((o) => o.status === "ASSIGNED").length;
    const workOrdersInProgressCount = workOrdersInProgress;
    
    const workOrdersCompletedToday = workOrders.filter((o) => {
      if (o.status !== "COMPLETED" && o.status !== "CLOSED") return false;
      const completedDate = o.completed_at || o.updated_at;
      return completedDate ? completedDate.startsWith(todayStr) : false;
    }).length;

    const workOrdersOverdue = workOrders.filter((o) => {
      const isOpen = ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"].includes(o.status);
      if (!isOpen) return false;
      const targetTime = o.scheduled_at || o.requested_at;
      return targetTime ? new Date(targetTime) < now : false;
    }).length;

    // --- SECTION 5: Recent Activities ---
    // Latest 5 Resident Assignments
    const recentAssignments = [...activeAssignments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((a) => {
        const personObj = a.persons
          ? Array.isArray(a.persons)
            ? a.persons[0]
            : a.persons
          : null;
        const pName = personObj
          ? (personObj.display_name || `${personObj.first_name} ${personObj.last_name || ""}`)
          : "Unknown";
        const uNum = a.units ? a.units.unit_number : "Unknown";
        return {
          id: a.id,
          timestamp: a.created_at,
          title: `Resident Assigned`,
          description: `${pName} assigned to Unit ${uNum} (${a.occupancy_type})`,
        };
      });

    // Latest 5 Visitor Check-ins
    const recentCheckIns = visitors
      .filter((v) => v.check_in_time)
      .sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime())
      .slice(0, 5)
      .map((v) => ({
        id: v.id,
        timestamp: v.check_in_time,
        title: `Visitor Checked In`,
        description: `${v.visitor_name} (${v.visitor_code}) checked into Unit ${v.resident_assignments?.units?.unit_number || "-"}`,
      }));

    // Latest 5 Visitor Check-outs
    const recentCheckOuts = visitors
      .filter((v) => v.actual_checkout_time)
      .sort((a, b) => new Date(b.actual_checkout_time).getTime() - new Date(a.actual_checkout_time).getTime())
      .slice(0, 5)
      .map((v) => ({
        id: v.id,
        timestamp: v.actual_checkout_time,
        title: `Visitor Checked Out`,
        description: `${v.visitor_name} (${v.visitor_code}) checked out`,
      }));

    // Latest 5 Work Order Updates
    const recentWorkOrders = [...workOrders]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        timestamp: o.updated_at,
        title: `Work Order Update`,
        description: `WO [${o.work_order_code}] status updated to ${o.status}`,
      }));

    // Latest 5 Announcement Publications
    const recentAnnouncements = announcements
      .filter((a) => a.status === "PUBLISHED" && a.publish_at)
      .sort((a, b) => new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime())
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        timestamp: a.publish_at,
        title: `Announcement Published`,
        description: `"${a.title}" published to property residents`,
      }));

    const recentActivities = [
      ...recentAssignments,
      ...recentCheckIns,
      ...recentCheckOuts,
      ...recentWorkOrders,
      ...recentAnnouncements,
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        todaysOperations: {
          visitorsWaitingApproval,
          visitorsInside,
          workOrdersWaitingAssignment,
          workOrdersInProgress,
          announcementsExpiringSoon,
          documentsPublishedThisWeek,
        },
        propertyOverview: {
          totalUnits,
          occupiedUnits,
          vacantUnits,
          occupancyRate,
          totalOwners,
          totalResidents,
        },
        unitStatusBreakdown,
        visitors: {
          today: visitorsToday,
          checkedIn: visitorsCheckedIn,
          checkedOut: visitorsCheckedOut,
          currentlyInside: visitorsCurrentlyInside,
          cancelled: visitorsCancelled,
        },
        workOrders: {
          new: workOrdersNew,
          assigned: workOrdersAssigned,
          inProgress: workOrdersInProgressCount,
          completedToday: workOrdersCompletedToday,
          overdue: workOrdersOverdue,
        },
        recentActivities,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve executive dashboard stats";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
