export type PurchaseOrderStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export interface PurchaseOrderLine {
  id: string | null;
  lineNumber: number;
  itemName: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  rfqId: string;
  rfqNumber: string;
  purchaseRequestId: string;
  purchaseRequestNumber: string;
  awardDecisionId: string;
  quotationId: string;
  quotationNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  currency: string;
  paymentTerms: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  buyerNotes: string | null;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  createdByUserId: string;
  createdByName: string;
  issuedByUserId: string | null;
  issuedByName: string | null;
  lines: PurchaseOrderLine[];
  issuedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PurchaseOrderSummary {
  totalOrders: number;
  draftOrders: number;
  issuedOrders: number;
  cancelledOrders: number;
  issuedValue: number;
  draftValue: number;
}

export interface PurchaseOrderCreateInput {
  rfqId: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  buyerNotes?: string;
}

export interface PurchaseOrderUpdateInput {
  expectedDeliveryDate: string;
  deliveryAddress: string;
  buyerNotes?: string;
}
