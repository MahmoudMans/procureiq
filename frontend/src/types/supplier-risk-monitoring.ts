export type SupplierContinuousRiskBand =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL";

export type SupplierRiskRecommendation =
  | "MONITOR"
  | "WATCHLIST"
  | "REQUALIFY"
  | "ESCALATE"
  | "CRITICAL_REVIEW";

export type SupplierRiskFactorCode =
  | "ONBOARDING"
  | "DOCUMENT_COMPLIANCE"
  | "ESG"
  | "CONTROL_ANOMALY"
  | "COLLABORATION"
  | "COMMERCIAL"
  | "SPEND_DEPENDENCY";

export type SupplierRiskAlertType =
  | "HIGH_RISK"
  | "DETERIORATION"
  | "REQUALIFICATION_REQUIRED"
  | "COMPLIANCE_GAP";

export type SupplierRiskAlertSeverity =
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type SupplierRiskAlertStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "RESOLVED";

export type SupplierRiskEscalationPriority =
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type SupplierRiskEscalationStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "CLOSED"
  | "CANCELLED";

export interface SupplierRiskFactor {
  factorCode: SupplierRiskFactorCode;
  factorScore: number;
  weightPct: number;
  contribution: number;
  details: string;
}

export interface SupplierRiskEvaluation {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory: string | null;
  supplierCountry: string | null;
  currency: string;
  overallScore: number;
  riskBand: SupplierContinuousRiskBand;
  recommendation: SupplierRiskRecommendation;
  previousScore: number | null;
  deltaScore: number | null;
  deterioration: boolean;
  spendExposure: number;
  categorySpendShare: number;
  factors: SupplierRiskFactor[];
  evaluatedAt: string;
}

export interface SupplierRiskAlert {
  id: string;
  supplierId: string;
  evaluationId: string;
  alertType: SupplierRiskAlertType;
  severity: SupplierRiskAlertSeverity;
  status: SupplierRiskAlertStatus;
  title: string;
  details: string;
  acknowledgedByName: string | null;
  acknowledgementNote: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface SupplierRiskWatchlist {
  id: string;
  supplierId: string;
  status: "ACTIVE" | "RELEASED";
  reason: string;
  addedByName: string;
  addedAt: string;
  releasedByName: string | null;
  releaseNote: string | null;
  releasedAt: string | null;
}

export interface SupplierRiskEscalation {
  id: string;
  caseNumber: string;
  supplierId: string;
  alertId: string | null;
  ownerUserId: string;
  ownerName: string;
  priority: SupplierRiskEscalationPriority;
  status: SupplierRiskEscalationStatus;
  dueDate: string;
  overdue: boolean;
  rationale: string;
  resolutionNote: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierRiskPortfolioItem {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory: string | null;
  supplierCountry: string | null;
  currency: string;
  evaluationId: string;
  overallScore: number;
  riskBand: SupplierContinuousRiskBand;
  recommendation: SupplierRiskRecommendation;
  deltaScore: number | null;
  deterioration: boolean;
  spendExposure: number;
  categorySpendShare: number;
  watchlisted: boolean;
  activeAlerts: number;
  openEscalations: number;
  evaluatedAt: string;
}

export interface SupplierRiskSummary {
  currency: string;
  evaluatedSuppliers: number;
  highRiskSuppliers: number;
  criticalRiskSuppliers: number;
  deterioratingSuppliers: number;
  requalificationRecommended: number;
  watchlistedSuppliers: number;
  activeAlerts: number;
  openEscalationCases: number;
  spendAtHighRisk: number;
  latestEvaluationAt: string | null;
}

export interface SupplierRiskDashboard {
  summary: SupplierRiskSummary;
  suppliers: SupplierRiskPortfolioItem[];
  alerts: SupplierRiskAlert[];
}

export interface SupplierRiskEvaluationRun {
  evaluatedSuppliers: number;
  alertsCreated: number;
  alertsRefreshed: number;
  alertsResolved: number;
  deterioratingSuppliers: number;
}

export interface SupplierRiskDetail {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory: string | null;
  supplierCountry: string | null;
  latestEvaluation: SupplierRiskEvaluation | null;
  history: SupplierRiskEvaluation[];
  watchlist: SupplierRiskWatchlist | null;
  alerts: SupplierRiskAlert[];
  escalationCases: SupplierRiskEscalation[];
}

export interface SupplierRiskUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface SupplierRiskContext {
  users: SupplierRiskUserOption[];
}
