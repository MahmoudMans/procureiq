export type GovernanceReviewStatus =
  | "DRAFT"
  | "FROZEN"
  | "IN_REVIEW"
  | "CLOSED"
  | "ARCHIVED";

export type GovernanceSnapshotItemType =
  | "SUPPLIER_RISK"
  | "CATEGORY_STRATEGY"
  | "BENEFIT_PORTFOLIO";

export type GovernanceSeverity =
  | "INFO"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type GovernanceDecisionType =
  | "APPROVAL"
  | "ESCALATION"
  | "PRIORITY"
  | "RISK_ACCEPTANCE"
  | "INVESTMENT"
  | "OTHER";

export type GovernanceDecisionStatus =
  | "OPEN"
  | "APPROVED"
  | "REJECTED"
  | "DEFERRED";

export type GovernanceActionPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type GovernanceActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface GovernanceSnapshotMetrics {
  evaluatedSuppliers: number;
  highRiskSuppliers: number;
  criticalRiskSuppliers: number;
  spendAtHighRisk: number;

  activeRiskAlerts: number;
  openRiskEscalations: number;

  activeCategoryStrategies: number;
  activeCategoryInitiatives: number;
  overdueCategoryInitiatives: number;

  approvedScenarios: number;

  activeExecutionPortfolios: number;
  baselineTargetSavings: number;
  forecastSavings: number;
  operationalReportedSavings: number;
  validatedSavings: number;
  validationPendingItems: number;

  activeLeakageCases: number;
  activeLeakageAmount: number;
  atRiskAmount: number;

  activeAssumptions: number;
  invalidatedAssumptions: number;

  capturedAt: string;
}

export interface GovernanceSnapshotItem {
  id: string;
  itemType: GovernanceSnapshotItemType;
  itemKey: string;
  rankPosition: number;
  severity: GovernanceSeverity;
  title: string;
  subtitle: string | null;
  metricLabel: string;
  metricValue: number;
  currency: string | null;
  details: string;
}

export interface GovernanceDecision {
  id: string;
  decisionNumber: string;
  reviewId: string;
  decisionType: GovernanceDecisionType;
  title: string;
  description: string;
  status: GovernanceDecisionStatus;
  requestedByName: string;
  decisionOwnerUserId: string;
  decisionOwnerName: string;
  dueDate: string | null;
  overdue: boolean;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GovernanceAction {
  id: string;
  actionNumber: string;
  reviewId: string;
  decisionId: string | null;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  priority: GovernanceActionPriority;
  dueDate: string;
  status: GovernanceActionStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GovernanceReviewSummary {
  id: string;
  reviewNumber: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: GovernanceReviewStatus;

  ownerUserId: string;
  ownerName: string;

  chairUserId: string;
  chairName: string;

  snapshotTargetSavings: number;
  snapshotValidatedSavings: number;
  snapshotAtRiskAmount: number;
  snapshotCriticalSuppliers: number;

  openDecisions: number;
  openActions: number;
  overdueActions: number;

  frozenAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GovernanceReviewDetail {
  review: GovernanceReviewSummary;
  executiveSummary: string;
  snapshot: GovernanceSnapshotMetrics | null;
  snapshotItems: GovernanceSnapshotItem[];
  decisions: GovernanceDecision[];
  actions: GovernanceAction[];
}

export interface GovernanceReviewDashboardSummary {
  currency: string;
  reviews: number;
  activeReviews: number;
  openDecisions: number;
  openActions: number;
  overdueActions: number;
  latestTargetSavings: number;
  latestValidatedSavings: number;
  latestAtRiskAmount: number;
  latestCriticalSuppliers: number;
}

export interface GovernanceReviewDashboard {
  summary: GovernanceReviewDashboardSummary;
  reviews: GovernanceReviewSummary[];
}

export interface GovernanceReviewUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface GovernanceReviewContext {
  users: GovernanceReviewUserOption[];
}
