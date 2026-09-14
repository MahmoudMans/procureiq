export type ProcurementInvoiceStatus =
  | "MATCH_PENDING"
  | "MATCHED"
  | "EXCEPTION"
  | "APPROVED"
  | "PAYMENT_HOLD"
  | "READY_FOR_PAYMENT"
  | "PAID"
  | "CANCELLED";

export type InvoiceMatchStatus =
  | "NOT_RUN"
  | "MATCHED"
  | "EXCEPTION";

export type InvoiceExceptionType =
  | "DUPLICATE_INVOICE"
  | "CURRENCY_MISMATCH"
  | "PO_CANCELLED"
  | "RECEIPT_INCOMPLETE"
  | "OVER_INVOICE";

export type InvoiceExceptionSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type InvoiceExceptionStatus =
  | "OPEN"
  | "RESOLVED"
  | "DISMISSED";

export interface ProcurementInvoiceLine {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceMatchException {
  id: string;
  invoiceId: string;
  exceptionType: InvoiceExceptionType;
  severity: InvoiceExceptionSeverity;
  status: InvoiceExceptionStatus;
  expectedValue: number | null;
  actualValue: number | null;
  varianceAmount: number | null;
  details: string;
  detectedAt: string;
  lastCheckedAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProcurementInvoice {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;

  supplierId: string;
  supplierCode: string;
  supplierName: string;

  purchaseOrderId: string;
  purchaseOrderNumber: string;
  purchaseOrderStatus: string;
  purchaseOrderCurrency: string;
  purchaseOrderTotal: number;

  invoiceDate: string;
  dueDate: string;

  currency: string;

  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;

  poVarianceTolerancePct: number;

  status: ProcurementInvoiceStatus;
  matchStatus: InvoiceMatchStatus;

  paymentHold: boolean;
  holdReason: string | null;

  approvedByName: string | null;
  approvedAt: string | null;
  readyForPaymentAt: string | null;
  paidAt: string | null;

  createdByUserId: string;
  createdByName: string;

  notes: string | null;

  openExceptions: number;
  overdue: boolean;
  agingDays: number;

  cumulativeInvoicedValue: number;
  remainingPoValue: number;

  lines: ProcurementInvoiceLine[];
  exceptions: InvoiceMatchException[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface InvoiceMatchResult {
  invoiceStatus: ProcurementInvoiceStatus;
  matchStatus: InvoiceMatchStatus;
  openExceptions: number;
  paymentHold: boolean;
}

export interface InvoiceSummary {
  currency: string;
  totalInvoices: number;
  matchedInvoices: number;
  exceptionInvoices: number;
  approvedInvoices: number;
  heldInvoices: number;
  readyForPaymentInvoices: number;
  overdueInvoices: number;
  openExceptions: number;
  duplicateExceptions: number;
  accountsPayableExposure: number;
  paymentHoldExposure: number;
  overdueExposure: number;
}

export interface InvoicePurchaseOrderOption {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  currency: string;
  totalAmount: number;
  status: string;
}

export interface InvoiceContext {
  purchaseOrders: InvoicePurchaseOrderOption[];
}
