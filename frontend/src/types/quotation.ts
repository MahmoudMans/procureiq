export type QuotationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "WITHDRAWN";

export interface QuotationLine {
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

export interface Quotation {
  id: string;
  quotationNumber: string;
  rfqId: string;
  rfqNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  currency: string;
  leadTimeDays: number;
  paymentTerms: string;
  validityDate: string;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: QuotationStatus;
  recordedByUserId: string;
  recordedByName: string;
  lines: QuotationLine[];
  submittedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface QuotationLineInput {
  rfqLineItemId: string;
  unitPrice: number;
}

export interface QuotationCreateInput {
  supplierId: string;
  leadTimeDays: number;
  paymentTerms: string;
  validityDate: string;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  lines: QuotationLineInput[];
}

export interface QuotationUpdateInput {
  leadTimeDays: number;
  paymentTerms: string;
  validityDate: string;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  lines: QuotationLineInput[];
}

export interface QuotationComparisonItem {
  quotationId: string;
  quotationNumber: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  rank: number;
  lowestCost: boolean;
  varianceFromLowest: number;
  savingsVsHighest: number;
  leadTimeDays: number;
  paymentTerms: string;
  validityDate: string;
}

export interface QuotationComparison {
  rfqId: string;
  rfqNumber: string;
  currency: string;
  submittedQuotationCount: number;
  lowestQuotationId: string | null;
  lowestTotalAmount: number;
  highestTotalAmount: number;
  potentialSavings: number;
  quotations: QuotationComparisonItem[];
}
