import type {
  ProcurementRole,
} from "@/types/auth";

export type ApprovalTaskStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface ApprovalTask {
  id: string;
  purchaseRequestId: string;
  requestNumber: string;
  requestTitle: string;
  requesterName: string;
  requesterEmail: string;
  departmentName: string;
  costCenter: string;
  currency: string;
  estimatedTotalAmount: number;
  desiredDeliveryDate: string;
  policyId: string;
  policyCode: string;
  policyName: string;
  requiredRole: ProcurementRole;
  status: ApprovalTaskStatus;
  decidedByUserId: string | null;
  decidedByName: string | null;
  decisionComment: string | null;
  requestedAt: string;
  decidedAt: string | null;
  version: number;
}

export interface ApprovalSummary {
  visibleTasks: number;
  pendingTasks: number;
  approvedTasks: number;
  rejectedTasks: number;
  cancelledTasks: number;
  pendingValue: number;
}
