export type RfqStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "CLOSED"
  | "CANCELLED";

export type RfqInvitationStatus =
  | "INVITED"
  | "RESPONDED"
  | "DECLINED";

export interface RfqLineItem {
  id: string | null;
  lineNumber: number;
  itemName: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
}

export interface RfqSupplierInvitation {
  id: string | null;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  category: string;
  country: string;
  status: RfqInvitationStatus;
  invitedAt: string | null;
  respondedAt: string | null;
}

export interface Rfq {
  id: string;
  rfqNumber: string;
  purchaseRequestId: string;
  purchaseRequestNumber: string;
  purchaseRequestTitle: string;
  requesterName: string;
  departmentName: string;
  purchaseRequestValue: number;
  title: string;
  description: string | null;
  currency: string;
  responseDeadline: string;
  status: RfqStatus;
  createdByUserId: string;
  createdByName: string;
  lineItems: RfqLineItem[];
  invitations: RfqSupplierInvitation[];
  publishedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface RfqSummary {
  totalRfqs: number;
  draftRfqs: number;
  publishedRfqs: number;
  closedRfqs: number;
  cancelledRfqs: number;
  invitedSuppliers: number;
  activeSourcingValue: number;
}

export interface RfqCreateInput {
  purchaseRequestId: string;
  title: string;
  description?: string;
  responseDeadline: string;
  supplierIds: string[];
}

export interface RfqUpdateInput {
  title: string;
  description?: string;
  responseDeadline: string;
  supplierIds: string[];
}

export interface RfqFilters {
  query?: string;
  status?: RfqStatus;
}
