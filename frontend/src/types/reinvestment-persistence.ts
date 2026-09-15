import type {
  ReinvestmentPerformanceHealth,
  ReinvestmentPerformanceStatus,
} from "@/types/reinvestment-performance";

export type ReinvestmentPersistenceStatus =
  | "ACTIVE"
  | "READY_FOR_REVIEW"
  | "REMEDIATION_REQUIRED"
  | "SUSTAINED"
  | "CLOSED";

export type ReinvestmentPersistenceHealth =
  | "UNASSESSED"
  | "COMPOUNDING"
  | "SUSTAINED"
  | "WATCH"
  | "DECAYING"
  | "REGRESSED";

export type ReinvestmentPersistenceValidationDecision =
  | "VALIDATED"
  | "REJECTED";

export type ReinvestmentPersistenceReviewDecision =
  | "SUSTAINED"
  | "REMEDIATION_REQUIRED";

export interface ReinvestmentPersistenceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface ReinvestmentPersistenceCandidate {
  sourcePerformanceCaseId: string;
  sourcePerformanceCaseNumber: string;
  sourcePerformanceStatus: ReinvestmentPerformanceStatus;

  redeploymentCaseId: string;
  redeploymentNumber: string;

  recyclingSourceId: string;
  recyclingSourceNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeNumber: string;
  targetInitiativeTitle: string;

  currency: string;
  fiscalYear: number;

  redeployedCapitalAmount: number;

  baselineValidatedAnnualizedValueAmount: number;
  baselineRealizedHorizonValueAmount: number;
  baselineRealizedNetValueAmount: number;
  baselineTotalCostAmount: number;

  baselineRealizedRoiPct: number;
  baselineRealizationPct: number;

  baselinePerformanceHealth: ReinvestmentPerformanceHealth;

  measurementHorizonMonths: number;
}

export interface ReinvestmentPersistenceObservation {
  id: string;
  persistenceCaseId: string;
  observedOn: string;

  reportedCurrentAnnualizedValueAmount: number;

  evidenceNote: string;
  reportedByName: string;
  reportedAt: string;

  validationDecision: ReinvestmentPersistenceValidationDecision | null;
  validatedCurrentAnnualizedValueAmount: number | null;
  validationNote: string | null;
  validatedByName: string | null;
  validatedAt: string | null;
}

export interface ReinvestmentPersistenceReview {
  id: string;
  persistenceCaseId: string;
  observationId: string;

  decision: ReinvestmentPersistenceReviewDecision;
  health: ReinvestmentPersistenceHealth;

  baselineAnnualizedValueAmount: number;
  currentAnnualizedValueAmount: number;

  baselineHorizonValueAmount: number;
  currentProjectedHorizonValueAmount: number;

  baselineNetValueAmount: number;
  currentProjectedNetValueAmount: number;

  baselineRoiPct: number;
  currentProjectedRoiPct: number;
  roiVariancePct: number;

  valuePersistencePct: number;

  compoundingValueAmount: number;
  decayedValueAmount: number;

  baselineCapitalEfficiencyMultiple: number;
  currentCapitalEfficiencyMultiple: number;
  capitalEfficiencyDelta: number;
  efficiencyRetentionPct: number;

  reviewNote: string;
  reviewedByName: string;
  reviewedAt: string;
}

export interface ReinvestmentPersistenceCase {
  id: string;
  persistenceCaseNumber: string;

  sourcePerformanceCaseId: string;
  sourcePerformanceCaseNumber: string;
  currentSourcePerformanceStatus: ReinvestmentPerformanceStatus;

  redeploymentCaseId: string;
  redeploymentNumber: string;

  recyclingSourceId: string;
  recyclingSourceNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeNumber: string;
  targetInitiativeTitle: string;

  currency: string;
  fiscalYear: number;

  redeployedCapitalAmount: number;

  baselineValidatedAnnualizedValueAmount: number;
  baselineRealizedHorizonValueAmount: number;
  baselineRealizedNetValueAmount: number;
  baselineTotalCostAmount: number;

  baselineRealizedRoiPct: number;
  baselineRealizationPct: number;

  baselinePerformanceHealth: ReinvestmentPerformanceHealth;
  currentSourcePerformanceHealth: ReinvestmentPerformanceHealth;

  measurementHorizonMonths: number;
  persistenceObservationWindowMonths: number;

  minimumValuePersistencePct: number;
  minimumEfficiencyRetentionPct: number;

  persistenceOwnerUserId: string;
  persistenceOwnerName: string;
  persistenceObjective: string;

  assessed: boolean;

  currentValidatedAnnualizedValueAmount: number;

  currentProjectedHorizonValueAmount: number;
  currentProjectedNetValueAmount: number;
  currentProjectedRoiPct: number;
  roiVariancePct: number;

  valuePersistencePct: number;
  compoundingValueAmount: number;
  decayedValueAmount: number;

  baselineCapitalEfficiencyMultiple: number;
  currentCapitalEfficiencyMultiple: number;
  capitalEfficiencyDelta: number;
  efficiencyRetentionPct: number;

  health: ReinvestmentPersistenceHealth;
  status: ReinvestmentPersistenceStatus;

  observationCount: number;
  reviewCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ReinvestmentPersistenceCaseDetail {
  persistenceCase: ReinvestmentPersistenceCase;
  users: ReinvestmentPersistenceUserOption[];
  observations: ReinvestmentPersistenceObservation[];
  reviews: ReinvestmentPersistenceReview[];
}

export interface ReinvestmentPersistenceSummary {
  candidateCount: number;
  caseCount: number;
  assessedCaseCount: number;

  compoundingCaseCount: number;
  sustainedCaseCount: number;
  watchCaseCount: number;
  decayingCaseCount: number;
  regressedCaseCount: number;
  remediationCaseCount: number;

  averageValuePersistencePct: number;
  averageEfficiencyRetentionPct: number;
  averageProjectedRoiPct: number;

  totalBaselineRealizedNetValueAmount: number;
  totalCurrentProjectedNetValueAmount: number;
  totalCompoundingValueAmount: number;
  totalDecayedValueAmount: number;
}

export interface ReinvestmentPersistenceSnapshotSummary {
  id: string;
  snapshotNumber: string;

  caseCount: number;
  assessedCaseCount: number;

  compoundingCaseCount: number;
  sustainedCaseCount: number;
  watchCaseCount: number;
  decayingCaseCount: number;
  regressedCaseCount: number;
  remediationCaseCount: number;

  averageValuePersistencePct: number;
  averageEfficiencyRetentionPct: number;
  averageProjectedRoiPct: number;

  totalBaselineRealizedNetValueAmount: number;
  totalCurrentProjectedNetValueAmount: number;
  totalCompoundingValueAmount: number;
  totalDecayedValueAmount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface ReinvestmentPersistenceSnapshotItem {
  persistenceCaseId: string;
  persistenceCaseNumber: string;
  sourcePerformanceCaseNumber: string;
  redeploymentNumber: string;
  targetValueCaseNumber: string;
  targetInitiativeTitle: string;
  currency: string;

  caseStatus: ReinvestmentPersistenceStatus;
  assessed: boolean;

  baselineAnnualizedValueAmount: number;
  currentAnnualizedValueAmount: number;

  baselineHorizonValueAmount: number;
  currentProjectedHorizonValueAmount: number;

  baselineNetValueAmount: number;
  currentProjectedNetValueAmount: number;

  baselineRoiPct: number;
  currentProjectedRoiPct: number;
  roiVariancePct: number;

  valuePersistencePct: number;
  efficiencyRetentionPct: number;

  compoundingValueAmount: number;
  decayedValueAmount: number;

  health: ReinvestmentPersistenceHealth;
}

export interface ReinvestmentPersistenceSnapshotDetail {
  snapshot: ReinvestmentPersistenceSnapshotSummary;
  items: ReinvestmentPersistenceSnapshotItem[];
}

export interface ReinvestmentPersistenceDashboard {
  summary: ReinvestmentPersistenceSummary;
  users: ReinvestmentPersistenceUserOption[];
  candidates: ReinvestmentPersistenceCandidate[];
  cases: ReinvestmentPersistenceCase[];
  snapshots: ReinvestmentPersistenceSnapshotSummary[];
}
