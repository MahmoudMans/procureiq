export interface AnalyticsSummary {
  committedSpend: number;
  committedOrderCount: number;
  activeSuppliers: number;
  sourcingSavings: number;
  averageProcurementCycleDays: number;
  averageOrderValue: number;
  openDeliveryOrders: number;
  overdueDeliveryOrders: number;
}

export interface AnalyticsBreakdown {
  label: string;
  value: number;
  count: number;
  sharePercent: number;
}

export interface MonthlySpend {
  month: string;
  amount: number;
  orderCount: number;
}

export interface ProcurementAnalytics {
  summary: AnalyticsSummary;
  monthlySpend: MonthlySpend[];
  spendBySupplier: AnalyticsBreakdown[];
  spendByCategory: AnalyticsBreakdown[];
  spendByDepartment: AnalyticsBreakdown[];
  riskExposure: AnalyticsBreakdown[];
  purchaseOrderPipeline: AnalyticsBreakdown[];
}
