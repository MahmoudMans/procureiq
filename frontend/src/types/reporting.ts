export type ReportType =
  | "EXECUTIVE"
  | "SUPPLIER_SPEND"
  | "CATEGORY_SPEND"
  | "SOURCING_SAVINGS"
  | "PURCHASE_ORDERS"
  | "DELIVERIES";

export interface ReportSummary {
  committedSpend: number;
  sourcingSavings: number;
  purchaseOrderCount: number;
  supplierCount: number;
  overdueOrderCount: number;
  averageCycleDays: number;
  averageOrderValue: number;
}

export interface ReportBreakdown {
  label: string;
  amount: number;
  count: number;
  sharePercent: number;
}

export interface SourcingSavingsReportRow {
  rfqNumber: string;
  supplierName: string;
  selectedTotal: number;
  highestSubmittedTotal: number;
  savings: number;
  awardDate: string;
}

export interface PurchaseOrderReportRow {
  poNumber: string;
  supplierName: string;
  status: string;
  totalAmount: number;
  expectedDeliveryDate: string;
  issuedAt: string | null;
}

export interface DeliveryReportRow {
  poNumber: string;
  supplierName: string;
  status: string;
  expectedDeliveryDate: string;
  lastReceiptDate: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  fulfillmentRate: number;
  late: boolean;
}

export interface ExecutiveReport {
  periodStart: string;
  periodEnd: string;
  summary: ReportSummary;
  spendBySupplier: ReportBreakdown[];
  spendByCategory: ReportBreakdown[];
  sourcingSavings: SourcingSavingsReportRow[];
  purchaseOrders: PurchaseOrderReportRow[];
  deliveries: DeliveryReportRow[];
}

export interface ReportSnapshot {
  id: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  label: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
}
