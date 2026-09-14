export type PurchaseRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface PurchaseRequestItem {
  id: string | null;
  lineNumber: number;
  itemName: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedLineTotal: number;
}

export interface PurchaseRequest {
  id: string;
  requestNumber: string;
  title: string;
  description: string | null;
  businessJustification: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  costCenter: string;
  currency: string;
  desiredDeliveryDate: string;
  status: PurchaseRequestStatus;
  estimatedTotalAmount: number;
  items: PurchaseRequestItem[];
  submittedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PurchaseRequestSummary {
  totalRequests: number;
  draftRequests: number;
  submittedRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  totalSubmittedValue: number;
}

export interface PurchaseRequestItemInput {
  itemName: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
}

export interface PurchaseRequestInput {
  title: string;
  description?: string;
  businessJustification: string;
  costCenter: string;
  currency: string;
  desiredDeliveryDate: string;
  items: PurchaseRequestItemInput[];
}

export interface PurchaseRequestFilters {
  query?: string;
  status?: PurchaseRequestStatus;
}
