import type {
  CollaborationActionStatus,
  CollaborationActionType,
  CollaborationMessageDirection,
  CollaborationMessageType,
  CollaborationPriority,
  CollaborationWorkspaceStatus,
  CollaborationWorkspaceType,
} from "@/types/supplier-collaboration";

export type SupplierPortalAccountStatus =
  | "INVITED"
  | "ACTIVE"
  | "SUSPENDED"
  | "REVOKED";

export interface SupplierPortalAccount {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  email: string;
  displayName: string;
  status: SupplierPortalAccountStatus;
  invitationExpiresAt: string | null;
  activatedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierPortalInvitation {
  account: SupplierPortalAccount;
  invitationToken: string;
  invitationExpiresAt: string;
}

export interface SupplierPortalProfile {
  accountId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  email: string;
  displayName: string;
}

export interface SupplierPortalAuth {
  sessionToken: string;
  expiresAt: string;
  profile: SupplierPortalProfile;
}

export interface SupplierPortalMessage {
  id: string;
  messageType: CollaborationMessageType;
  direction: CollaborationMessageDirection;
  body: string;
  referenceText: string | null;
  senderName: string;
  respondsToMessageId: string | null;
  createdAt: string;
}

export interface SupplierPortalAction {
  id: string;
  actionType: CollaborationActionType;
  title: string;
  description: string | null;
  assigneeLabel: string | null;
  dueAt: string;
  status: CollaborationActionStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
}

export interface SupplierPortalWorkspace {
  id: string;
  workspaceNumber: string;
  workspaceType: CollaborationWorkspaceType;
  status: CollaborationWorkspaceStatus;
  priority: CollaborationPriority;
  title: string;
  purchaseOrderNumber: string | null;
  rfqNumber: string | null;
  externalReference: string | null;
  supplierResponseSlaHours: number;
  responseDueAt: string | null;
  responseSlaBreached: boolean;
  openSupplierActions: number;
  overdueSupplierActions: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPortalWorkspaceDetail {
  workspace: SupplierPortalWorkspace;
  messages: SupplierPortalMessage[];
  actions: SupplierPortalAction[];
}

export interface SupplierPortalSummary {
  activeWorkspaces: number;
  waitingSupplier: number;
  overdueResponses: number;
  openActions: number;
  overdueActions: number;
}

export interface SupplierPortalDashboard {
  profile: SupplierPortalProfile;
  summary: SupplierPortalSummary;
  workspaces: SupplierPortalWorkspace[];
}
