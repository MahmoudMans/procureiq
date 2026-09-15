import type {
  CapitalRedeploymentStatus,
} from "@/types/capital-redeployment";

import type {
  StrategicValueHealth,
} from "@/types/strategic-value";

export type ReinvestmentPerformanceStatus =
  | "ACTIVE"
  | "READY_FOR_REVIEW"
  | "REMEDIATION_REQUIRED"
  | "VERIFIED"
  | "CLOSED";

export type ReinvestmentPerformanceHealth =
  | "UNASSESSED"
  | "OUTPERFORMING"
  | "ON_TRACK"
  | "WATCH"
  | "UNDERPERFORMING";

export type ReinvestmentPerformanceValidationDecision =
  | "VALIDATED"
  | "REJECTED";

export type ReinvestmentPerformanceReviewDecision =
  | "CONFIRMED"
  | "REMEDIATION_REQUIRED";

export interface ReinvestmentPerformanceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface ReinvestmentPerformanceCandidate {
  redeploymentCaseId: string;
  redeploymentNumber: string;
  redeploymentStatus: CapitalRedeploymentStatus;

  recyclingSourceId: string;
  recyclingSourceNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeNumber: string;
  targetInitiativeTitle: string;

  currency: string;
  fiscalYear: number;

  redeployedCapitalAmount: number;
  baselineTargetRoiPct: number;
  baselineTargetPersistencePct: number;
  baselineTargetNetValueAmount: number;
  targetValueHealth: StrategicValueHealth;
}

export interface ReinvestmentPerformanceObservation {
  id: string;
  performanceCaseId: string;
  observedOn: string;
  reportedRealizedAnnualizedValueAmount: number;
  evidenceNote: string;
  reportedByName: string;
  reportedAt: string;

  validationDecision: ReinvestmentPerformanceValidationDecision | null;
  validatedRealizedAnnualizedValueAmount: number | null;
  validationNote: string | null;
  validatedByName: string | null;
  validatedAt: string | null;
}

export interface ReinvestmentPerformanceReview {
  id: string;
  performanceCaseId: string;
  observationId: string;

  decision: ReinvestmentPerformanceReviewDecision;
  health: ReinvestmentPerformanceHealth;

  redeployedCapitalAmount: number;
  operatingCostHorizonAmount: number;
  totalCostAmount: number;
  expectedHorizonValueAmount: number;

  validatedRealizedAnnualizedValueAmount: number;
  realizedHorizonValueAmount: number;
  realizedNetValueAmount: number;

  baselineTargetRoiPct: number;
  realizedRoiPct: number;
  roiVariancePct: number;

  valueVarianceAmount: number;
  realizationPct: number;

  reviewNote: string;
  reviewedByName: string;
  reviewedAt: string;
}

export interface ReinvestmentPerformanceCase {
  id: string;
  performanceCaseNumber: string;

  redeploymentCaseId: string;
  redeploymentNumber: string;
  currentRedeploymentStatus: CapitalRedeploymentStatus;

  recyclingSourceId: string;
  recyclingSourceNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeNumber: string;
  targetInitiativeTitle: string;

  currency: string;
  fiscalYear: number;

  redeployedCapitalAmount: number;
  baselineTargetRoiPct: number;
  baselineTargetPersistencePct: number;
  baselineTargetNetValueAmount: number;
  currentTargetValueHealth: StrategicValueHealth;

  measurementHorizonMonths: number;
  annualOperatingCostAmount: number;

  performanceOwnerUserId: string;
  performanceOwnerName: string;
  performanceObjective: string;

  assessed: boolean;
  validatedRealizedAnnualizedValueAmount: number;

  operatingCostHorizonAmount: number;
  totalCostAmount: number;
  expectedHorizonValueAmount: number;
  realizedHorizonValueAmount: number;
  realizedNetValueAmount: number;

  realizedRoiPct: number;
  roiVariancePct: number;
  valueVarianceAmount: number;
  realizationPct: number;

  health: ReinvestmentPerformanceHealth;
  status: ReinvestmentPerformanceStatus;

  observationCount: number;
  reviewCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ReinvestmentPerformanceCaseDetail {
  performanceCase: ReinvestmentPerformanceCase;
  users: ReinvestmentPerformanceUserOption[];
  observations: ReinvestmentPerformanceObservation[];
  reviews: ReinvestmentPerformanceReview[];
}

export interface ReinvestmentPerformanceSummary {
  candidateCount: number;
  caseCount: number;
  assessedCaseCount: number;
  outperformingCaseCount: number;
  onTrackCaseCount: number;
  watchCaseCount: number;
  underperformingCaseCount: number;
  remediationCaseCount: number;
  verifiedCaseCount: number;

  averageRealizedRoiPct: number;
  averageRoiVariancePct: number;
  averageRealizationPct: number;

  totalRedeployedCapitalAmount: number;
  totalRealizedNetValueAmount: number;
}

export interface ReinvestmentPerformanceSnapshotSummary {
  id: string;
  snapshotNumber: string;

  caseCount: number;
  assessedCaseCount: number;
  outperformingCaseCount: number;
  onTrackCaseCount: number;
  watchCaseCount: number;
  underperformingCaseCount: number;
  remediationCaseCount: number;

  averageRealizedRoiPct: number;
  averageRoiVariancePct: number;
  averageRealizationPct: number;

  totalRedeployedCapitalAmount: number;
  totalRealizedNetValueAmount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface ReinvestmentPerformanceSnapshotItem {
  performanceCaseId: string;
  performanceCaseNumber: string;
  redeploymentNumber: string;
  targetValueCaseNumber: string;
  targetInitiativeTitle: string;
  currency: string;

  caseStatus: ReinvestmentPerformanceStatus;
  assessed: boolean;

  redeployedCapitalAmount: number;
  expectedHorizonValueAmount: number;
  validatedRealizedAnnualizedValueAmount: number;
  realizedHorizonValueAmount: number;
  realizedNetValueAmount: number;

  baselineTargetRoiPct: number;
  realizedRoiPct: number;
  roiVariancePct: number;
  valueVarianceAmount: number;
  realizationPct: number;

  health: ReinvestmentPerformanceHealth;
}

export interface ReinvestmentPerformanceSnapshotDetail {
  snapshot: ReinvestmentPerformanceSnapshotSummary;
  items: ReinvestmentPerformanceSnapshotItem[];
}

export interface ReinvestmentPerformanceDashboard {
  summary: ReinvestmentPerformanceSummary;
  users: ReinvestmentPerformanceUserOption[];
  candidates: ReinvestmentPerformanceCandidate[];
  cases: ReinvestmentPerformanceCase[];
  snapshots: ReinvestmentPerformanceSnapshotSummary[];
}
