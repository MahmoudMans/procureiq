export type PortalPurchaseOrderStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type PortalPurchaseOrderResponse = "PENDING" | "ACKNOWLEDGED" | "REJECTED";

export interface PortalPurchaseOrderSummary {
  id: string;
  poNumber: string;
  rfqId: string;
  rfqNumber: string;
  currency: string;
  totalAmount: number;
  expectedDeliveryDate: string;
  status: PortalPurchaseOrderStatus;
  supplierResponse: PortalPurchaseOrderResponse;
  supplierRespondedAt: string | null;
  issuedAt: string | null;
}

export interface PortalPurchaseOrderLine {
  lineNumber: number;
  itemName: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface PortalPurchaseOrderDetail {
  id: string;
  poNumber: string;
  rfqId: string;
  rfqNumber: string;
  quotationNumber: string;
  currency: string;
  paymentTerms: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: PortalPurchaseOrderStatus;
  supplierResponse: PortalPurchaseOrderResponse;
  supplierRespondedAt: string | null;
  supplierResponseNote: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  lines: PortalPurchaseOrderLine[];
}
