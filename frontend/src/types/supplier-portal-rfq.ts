export type PortalQuotationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "WITHDRAWN";

export interface PortalQuotationSummary {
  id: string;
  quotationNumber: string;
  status: PortalQuotationStatus;
  totalAmount: number;
  submittedAt: string | null;
}

export interface PortalRfqSummary {
  id: string;
  rfqNumber: string;
  title: string;
  currency: string;
  responseDeadline: string;
  rfqStatus: string;
  invitationStatus: string;
  open: boolean;
  lineCount: number;
  quotation: PortalQuotationSummary | null;
}

export interface PortalRfqLineItem {
  id: string;
  lineNumber: number;
  itemName: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
}

export interface PortalQuotationLine {
  id: string | null;
  rfqLineItemId: string;
  lineNumber: number;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineSubtotal: number;
}

export interface PortalQuotation {
  id: string;
  quotationNumber: string;
  status: PortalQuotationStatus;
  currency: string;
  leadTimeDays: number;
  paymentTerms: string;
  validityDate: string;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  lines: PortalQuotationLine[];
  submittedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string;
}

export interface PortalRfqDetail {
  id: string;
  rfqNumber: string;
  title: string;
  description: string | null;
  currency: string;
  responseDeadline: string;
  rfqStatus: string;
  invitationStatus: string;
  open: boolean;
  biddingBlockedReason: string | null;
  lineItems: PortalRfqLineItem[];
  quotation: PortalQuotation | null;
}

export interface PortalQuotationLineInput {
  rfqLineItemId: string;
  unitPrice: number;
}

export interface PortalQuotationInput {
  leadTimeDays: number;
  paymentTerms: string;
  validityDate: string;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  lines: PortalQuotationLineInput[];
}
