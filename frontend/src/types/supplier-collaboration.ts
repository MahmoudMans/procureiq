export type CollaborationWorkspaceType =
  | "SOURCING_CLARIFICATION"
  | "PURCHASE_ORDER"
  | "DELIVERY"
  | "DOCUMENT_REQUEST"
  | "QUALITY_ISSUE"
  | "GENERAL";

export type CollaborationWorkspaceStatus =
  | "OPEN"
  | "WAITING_SUPPLIER"
  | "WAITING_INTERNAL"
  | "RESOLVED"
  | "CLOSED";

export type CollaborationPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type CollaborationMessageType =
  | "COMMENT"
  | "CLARIFICATION"
  | "STATUS_UPDATE"
  | "DOCUMENT_REQUEST"
  | "DELIVERY_UPDATE"
  | "ISSUE";

export type CollaborationMessageVisibility =
  | "INTERNAL_ONLY"
  | "SUPPLIER_SHARED";

export type CollaborationMessageDirection =
  | "INTERNAL"
  | "TO_SUPPLIER"
  | "FROM_SUPPLIER";

export type CollaborationActionType =
  | "ACKNOWLEDGE_PO"
  | "CONFIRM_DELIVERY"
  | "PROVIDE_DOCUMENT"
  | "ANSWER_CLARIFICATION"
  | "RESOLVE_ISSUE"
  | "OTHER";

export type CollaborationActionAudience =
  | "SUPPLIER"
  | "INTERNAL";

export type CollaborationActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface CollaborationMessage {
  id: string;
  workspaceId: string;
  messageType: CollaborationMessageType;
  visibility: CollaborationMessageVisibility;
  direction: CollaborationMessageDirection;
  body: string;
  referenceText: string | null;
  authorUserId: string | null;
  authorName: string | null;
  supplierContactName: string | null;
  respondsToMessageId: string | null;
  createdAt: string;
}

export interface CollaborationAction {
  id: string;
  workspaceId: string;
  actionType: CollaborationActionType;
  audience: CollaborationActionAudience;
  title: string;
  description: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  externalAssigneeLabel: string | null;
  dueAt: string;
  status: CollaborationActionStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CollaborationWorkspace {
  id: string;
  workspaceNumber: string;

  supplierId: string;
  supplierCode: string;
  supplierName: string;

  workspaceType: CollaborationWorkspaceType;
  status: CollaborationWorkspaceStatus;
  priority: CollaborationPriority;

  title: string;

  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;

  rfqId: string | null;
  rfqNumber: string | null;

  externalReference: string | null;

  ownerUserId: string;
  ownerName: string;

  supplierResponseSlaHours: number;
  responseDueAt: string | null;
  responseSlaBreached: boolean;

  lastMessageAt: string | null;

  openActions: number;
  overdueActions: number;
  supplierSharedMessages: number;
  supplierResponseCount: number;
  averageSupplierResponseHours: number | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CollaborationWorkspaceDetail {
  workspace: CollaborationWorkspace;
  resolutionNote: string | null;
  notes: string | null;
  messages: CollaborationMessage[];
  actions: CollaborationAction[];
}

export interface CollaborationSummary {
  activeWorkspaces: number;
  waitingSupplier: number;
  waitingInternal: number;
  responseSlaBreaches: number;
  openActions: number;
  overdueActions: number;
  supplierSharedMessages: number;
  recordedSupplierResponses: number;
  averageSupplierResponseHours: number;
}

export interface SupplierCollaborationMetric {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  activeWorkspaces: number;
  waitingSupplier: number;
  responseSlaBreaches: number;
  openActions: number;
  overdueActions: number;
  supplierResponseCount: number;
  averageSupplierResponseHours: number;
}

export interface SupplierCollaborationDashboard {
  summary: CollaborationSummary;
  workspaces: CollaborationWorkspace[];
  supplierMetrics: SupplierCollaborationMetric[];
}

export interface CollaborationSupplierOption {
  id: string;
  supplierCode: string;
  supplierName: string;
  status: string | null;
}

export interface CollaborationUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CollaborationPurchaseOrderOption {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
}

export interface CollaborationRfqOption {
  id: string;
  rfqNumber: string;
}

export interface CollaborationContext {
  suppliers: CollaborationSupplierOption[];
  users: CollaborationUserOption[];
  purchaseOrders: CollaborationPurchaseOrderOption[];
  rfqs: CollaborationRfqOption[];
}
