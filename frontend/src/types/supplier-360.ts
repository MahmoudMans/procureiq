import type {
  SupplierRiskLevel,
  SupplierStatus,
} from "@/types/supplier";

export interface Supplier360MonthlySpend {
  month: string;
  amount: number;
  orderCount: number;
}

export interface Supplier360CategorySpend {
  category: string;
  amount: number;
  lineCount: number;
  sharePercent: number;
}

export interface Supplier360PurchaseOrder {
  id: string;
  poNumber: string;
  rfqNumber: string;
  status: string;
  totalAmount: number;
  expectedDeliveryDate: string;
  issuedAt: string | null;
  createdAt: string;
}

export interface Supplier360Sourcing {
  rfqId: string;
  rfqNumber: string;
  title: string;
  rfqStatus: string;
  invitationStatus: string;
  responseDeadline: string;
  quotationNumber: string | null;
  quotationStatus: string | null;
  quotationTotal: number | null;
  quotationSubmittedAt: string | null;
}

export interface Supplier360Award {
  rfqId: string;
  rfqNumber: string;
  quotationId: string;
  quotationNumber: string;
  awardValue: number;
  manualOverride: boolean;
  decidedAt: string;
}

export interface Supplier360Activity {
  eventType: string;
  title: string;
  detail: string;
  href: string;
  occurredAt: string;
}

export interface Supplier360 {
  supplierId: string;
  supplierCode: string;
  legalName: string;
  category: string;
  country: string;
  status: SupplierStatus;
  riskLevel: SupplierRiskLevel;
  rating: number | null;

  committedSpend: number;
  purchaseOrderCount: number;
  openPurchaseOrderCount: number;
  overduePurchaseOrderCount: number;

  invitedRfqCount: number;
  submittedQuotationCount: number;
  awardCount: number;
  sourcingWinRate: number;
  averageAwardValue: number;

  trackedDeliveryOrders: number;
  completedDeliveryOrders: number;
  onTimeOrders: number;
  lateOrders: number;
  onTimeDeliveryRate: number;
  fulfillmentRate: number;
  lastReceiptDate: string | null;

  monthlySpend: Supplier360MonthlySpend[];
  categorySpend: Supplier360CategorySpend[];
  recentPurchaseOrders: Supplier360PurchaseOrder[];
  recentSourcing: Supplier360Sourcing[];
  recentAwards: Supplier360Award[];
  recentActivity: Supplier360Activity[];
}
