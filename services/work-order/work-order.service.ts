import * as workOrderRepository from "@/repositories/work-order/work-order.repository";
import { WorkOrder, WorkOrderStatus, CreateWorkOrderDto, UpdateWorkOrderDto, WorkOrderCategory } from "@/features/work-order/types/work-order.types";
import { workflowService, WorkflowEvent } from "@/services/workflow/workflow.service";

const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  NEW: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "NEW", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

export const workOrderService = {
  async getAllWorkOrders(): Promise<WorkOrder[]> {
    return workOrderRepository.findAll();
  },

  async getOpenWorkOrders(): Promise<WorkOrder[]> {
    return workOrderRepository.findOpen();
  },

  async getAssignedWorkOrders(technicianId: string): Promise<WorkOrder[]> {
    return workOrderRepository.findAssigned(technicianId);
  },

  async getHistoryWorkOrders(): Promise<WorkOrder[]> {
    return workOrderRepository.findHistory();
  },

  async getWorkOrderById(id: string): Promise<WorkOrder | null> {
    return workOrderRepository.findById(id);
  },

  async createWorkOrder(dto: CreateWorkOrderDto): Promise<WorkOrder> {
    if (!dto.property_id) {
      throw new Error("Property ID is required");
    }
    if (!dto.unit_id) {
      throw new Error("Unit ID is required");
    }
    if (!dto.category || dto.category.trim() === "") {
      throw new Error("Category is required");
    }
    if (!dto.title || dto.title.trim() === "") {
      throw new Error("Title is required");
    }

    // Set initial status to ASSIGNED if assigned_to is provided during creation
    const initialStatus = dto.assigned_to ? "ASSIGNED" : "NEW";

    return workOrderRepository.create({
      ...dto,
      status: initialStatus,
    });
  },

  async updateWorkOrder(id: string, dto: UpdateWorkOrderDto): Promise<WorkOrder | null> {
    const existing = await workOrderRepository.findById(id);
    if (!existing) {
      throw new Error("Work order not found");
    }

    const updatePayload: UpdateWorkOrderDto = { ...dto };

    // Validate state transitions
    if (dto.status && dto.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new Error(`Invalid status transition from ${existing.status} to ${dto.status}`);
      }

      // Automatically stamp corresponding times
      if (dto.status === "IN_PROGRESS") {
        updatePayload.started_at = new Date().toISOString();
      } else if (dto.status === "COMPLETED") {
        updatePayload.completed_at = new Date().toISOString();
      } else if (dto.status === "CLOSED") {
        updatePayload.closed_at = new Date().toISOString();
      }
    }

    // If assigning technician, auto-update status to ASSIGNED if current status is NEW
    if (dto.assigned_to && dto.assigned_to !== existing.assigned_to && existing.status === "NEW") {
      updatePayload.status = "ASSIGNED";
    }

    const updated = await workOrderRepository.update(id, updatePayload);
    if (updated && dto.status === "COMPLETED") {
      if (updated.category === WorkOrderCategory.CLEANING) {
        await workflowService.handleEvent(WorkflowEvent.CLEANING_COMPLETE, {
          unitId: updated.unit_id,
          propertyId: updated.property_id,
          actorId: dto.updated_by || "system",
          stayId: updated.stay_id,
          occupancyId: updated.occupancy_id,
        });
      } else if (updated.category === WorkOrderCategory.INSPECTION) {
        await workflowService.handleEvent(WorkflowEvent.INSPECTION_PASS, {
          unitId: updated.unit_id,
          propertyId: updated.property_id,
          actorId: dto.updated_by || "system",
          stayId: updated.stay_id,
          occupancyId: updated.occupancy_id,
        });
      }
    }
    return updated;
  },

  async closeWorkOrder(id: string, updatedBy?: string | null): Promise<boolean> {
    const existing = await workOrderRepository.findById(id);
    if (!existing) {
      throw new Error("Work order not found");
    }

    if (existing.status !== "COMPLETED") {
      throw new Error("Only completed work orders can be closed");
    }

    return workOrderRepository.close(id, updatedBy);
  },
};
