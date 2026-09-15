import type {
  PersistenceHealth,
  PersistencePlanStatus,
} from "@/types/outcome-persistence";

export type StrategicValueCaseStatus =
  | "ACTIVE"
  | "READY_FOR_REVIEW"
  | "VERIFIED"
  | "CLOSED";

export type StrategicValueHealth =
  | "UNASSESSED"
  | "STRONG"
  | "HEALTHY"
  | "WATCH"
  | "AT_RISK";

export interface StrategicValueUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface StrategicValueCandidate {
  persistencePlanId: string;
  persistencePlanNumber: string;
  commitmentId: string;
  commitmentNumber: string;
  roadmapId: string;
  roadmapNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  executionOwnerName: string;
  persistenceOwnerName: string;
  currency: string;
  fiscalYear: number;
  step53ValidatedContributionPoints: number;
  persistenceBaselinePoints: number;
  currentPersistenceValidatedPoints: number;
  persistencePct: number;
  decayPoints: number;
  persistenceHealth: PersistenceHealth;
  persistenceStatus: PersistencePlanStatus;
}

export interface StrategicValueCase {
  id: string;
  caseNumber: string;
  persistencePlanId: string;
  persistencePlanNumber: string;
  commitmentId: string;
  commitmentNumber: string;
  roadmapId: string;
  roadmapNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  valueOwnerUserId: string;
  valueOwnerName: string;
  currency: string;
  fiscalYear: number;

  step53ValidatedContributionPoints: number;
  persistenceBaselinePoints: number;
  currentPersistenceValidatedPoints: number;
  persistencePct: number;
  persistenceDecayPoints: number;
  persistenceHealth: PersistenceHealth;
  persistenceStatus: PersistencePlanStatus;

  investmentCostAmount: number;
  annualOperatingCostAmount: number;
  annualizedValueAmount: number;
  valueHorizonMonths: number;
  targetRoiPct: number;
  targetPaybackMonths: number;
  valuationNote: string;

  baselineHorizonValueAmount: number;
  durableAnnualValueAmount: number;
  durableHorizonValueAmount: number;
  decayedValueAmount: number;
  operatingCostHorizonAmount: number;
  totalCostAmount: number;
  netValueAmount: number;
  roiPct: number;
  paybackMonths: number | null;
  valueAtRiskAmount: number;
  valueHealth: StrategicValueHealth;

  status: StrategicValueCaseStatus;
  verificationNote: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StrategicValueCaseDetail {
  valueCase: StrategicValueCase;
}

export interface StrategicValueSummary {
  candidateCount: number;
  caseCount: number;
  verifiedCaseCount: number;
  strongCaseCount: number;
  healthyCaseCount: number;
  watchCaseCount: number;
  atRiskCaseCount: number;
  totalInvestmentAmount: number;
  totalAnnualOperatingCostAmount: number;
  totalBaselineHorizonValueAmount: number;
  totalDurableAnnualValueAmount: number;
  totalDurableHorizonValueAmount: number;
  totalDecayedValueAmount: number;
  totalCostAmount: number;
  totalNetValueAmount: number;
  totalValueAtRiskAmount: number;
  portfolioRoiPct: number;
  portfolioPaybackMonths: number | null;
  portfolioHealth: StrategicValueHealth;
}

export interface StrategicValueReviewSummary {
  id: string;
  reviewNumber: string;
  caseCount: number;
  verifiedCaseCount: number;
  atRiskCaseCount: number;
  watchCaseCount: number;
  strongCaseCount: number;
  totalInvestmentAmount: number;
  totalOperatingCostAmount: number;
  totalBaselineHorizonValueAmount: number;
  totalDurableHorizonValueAmount: number;
  totalDecayedValueAmount: number;
  totalCostAmount: number;
  totalNetValueAmount: number;
  portfolioRoiPct: number;
  portfolioPaybackMonths: number | null;
  portfolioHealth: StrategicValueHealth;
  capturedByName: string;
  capturedAt: string;
}

export interface StrategicValueReviewItem {
  valueCaseId: string;
  caseNumber: string;
  persistencePlanNumber: string;
  commitmentNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  valueOwnerName: string;
  caseStatus: StrategicValueCaseStatus;
  currency: string;
  investmentCostAmount: number;
  annualOperatingCostAmount: number;
  annualizedValueAmount: number;
  persistencePct: number;
  baselineHorizonValueAmount: number;
  durableHorizonValueAmount: number;
  decayedValueAmount: number;
  totalCostAmount: number;
  netValueAmount: number;
  roiPct: number;
  paybackMonths: number | null;
  valueAtRiskAmount: number;
  valueHealth: StrategicValueHealth;
}

export interface StrategicValueReviewDetail {
  review: StrategicValueReviewSummary;
  items: StrategicValueReviewItem[];
}

export interface StrategicValueDashboard {
  summary: StrategicValueSummary;
  users: StrategicValueUserOption[];
  candidates: StrategicValueCandidate[];
  cases: StrategicValueCase[];
  reviews: StrategicValueReviewSummary[];
}
