import { workOrderService } from "@/services/work-order/work-order.service";
import { WorkOrderCategory, WorkOrderServiceTeam } from "@/features/work-order/types/work-order.types";
import { createClient } from "@/lib/supabase/server";

export enum WorkflowEvent {
  CHECK_OUT = "CHECK_OUT",
  CLEANING_COMPLETE = "CLEANING_COMPLETE",
  INSPECTION_PASS = "INSPECTION_PASS",
}

export interface WorkflowPayload {
  unitId: string;
  propertyId: string;
  actorId: string;
  stayId?: string | null;
  occupancyId?: string | null;
}

export const workflowService = {
  async handleEvent(event: WorkflowEvent, payload: WorkflowPayload) {
    console.log(`[WorkflowService] Handling event: ${event} for unit: ${payload.unitId}`);
    const supabase = await createClient();

    // Fetch unit details to get unit_number for WO titles
    const { data: unit } = await supabase
      .from("units")
      .select("unit_number")
      .eq("id", payload.unitId)
      .single();

    const unitNumber = unit?.unit_number || payload.unitId;

    if (event === WorkflowEvent.CHECK_OUT) {
      console.log(`[WorkflowService] Dispatching Cleaning Work Order for unit: ${unitNumber}`);
      
      // Automatically create Housekeeping Cleaning Work Order
      await workOrderService.createWorkOrder({
        property_id: payload.propertyId,
        unit_id: payload.unitId,
        stay_id: payload.stayId || null,
        occupancy_id: payload.occupancyId || null,
        category: WorkOrderCategory.CLEANING,
        title: `Housekeeping - Unit ${unitNumber}`,
        description: `Automated cleaning dispatch after checkout event.`,
        priority: "NORMAL",
        status: "NEW",
        service_team: WorkOrderServiceTeam.HOUSEKEEPING,
        affects_operational_status: true,
        created_by: payload.actorId,
      });

    } else if (event === WorkflowEvent.CLEANING_COMPLETE) {
      console.log(`[WorkflowService] Cleaning Completed. Dispatching Inspection Work Order for unit: ${unitNumber}`);
      
      // Automatically create Inspection Work Order
      await workOrderService.createWorkOrder({
        property_id: payload.propertyId,
        unit_id: payload.unitId,
        stay_id: payload.stayId || null,
        occupancy_id: payload.occupancyId || null,
        category: WorkOrderCategory.INSPECTION,
        title: `Inspection - Unit ${unitNumber}`,
        description: `Automated inspection check after cleaning completion.`,
        priority: "NORMAL",
        status: "NEW",
        service_team: WorkOrderServiceTeam.INSPECTION_TEAM,
        affects_operational_status: true,
        created_by: payload.actorId,
      });

    } else if (event === WorkflowEvent.INSPECTION_PASS) {
      console.log(`[WorkflowService] Inspection Passed for unit: ${unitNumber}. Unit is now Available.`);
      // Unit operational status automatically derives to VACANT because both Cleaning and Inspection work orders are now completed/closed.
    }
  }
};
