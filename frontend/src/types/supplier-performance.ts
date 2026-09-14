export type SupplierPerformanceReviewStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

export type SupplierPerformanceBand =
  | "EXCELLENT"
  | "GOOD"
  | "NEEDS_IMPROVEMENT"
  | "CRITICAL";

export type CorrectiveActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface SupplierPerformanceReview {
  id: string;
  reviewNumber: string;

  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory: string | null;

  periodStart: string;
  periodEnd: string;

  status: SupplierPerformanceReviewStatus;

  qualityScore: number;
  deliveryScore: number;
  commercialScore: number;
  serviceScore: number;
  complianceScore: number;

  weightedScore: number;
  performanceBand: SupplierPerformanceBand;

  supplierRatingSnapshot: number | null;
  supplierRiskSnapshot: string | null;

  purchaseOrderCountSnapshot: number;
  purchaseOrderValueSnapshot: number;
  overduePurchaseOrderCountSnapshot: number;

  ownerUserId: string;
  ownerName: string;

  decisionNote: string | null;
  decidedAt: string | null;
  decidedByName: string | null;

  notes: string | null;

  openCorrectiveActions: number;
  overdueCorrectiveActions: number;

  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CorrectiveAction {
  id: string;
  reviewId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  dueDate: string;
  status: CorrectiveActionStatus;
  overdue: boolean;
  completedAt: string | null;
  completionNote: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierPerformanceTrend {
  reviewId: string;
  reviewNumber: string;
  periodEnd: string;
  weightedScore: number;
  performanceBand: SupplierPerformanceBand;
  status: SupplierPerformanceReviewStatus;
}

export interface SupplierPerformanceReviewDetail {
  review: SupplierPerformanceReview;
  correctiveActions: CorrectiveAction[];
  supplierHistory: SupplierPerformanceTrend[];
}

export interface SupplierPerformanceSummary {
  totalReviews: number;
  reviewedSuppliers: number;
  pendingApproval: number;
  needsImprovement: number;
  criticalReviews: number;
  openCorrectiveActions: number;
  overdueCorrectiveActions: number;
  averageApprovedScore: number;
}

export interface PerformanceSupplierOption {
  id: string;
  supplierCode: string;
  legalName: string;
  category: string | null;
  country: string | null;
  rating: number | null;
  riskLevel: string | null;
}

export interface PerformanceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface SupplierPerformanceContext {
  suppliers: PerformanceSupplierOption[];
  users: PerformanceUserOption[];
}
