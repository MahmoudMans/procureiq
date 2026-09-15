import type {
  ReinvestmentPersistenceHealth,
  ReinvestmentPersistenceStatus,
} from "@/types/reinvestment-persistence";

export type CapitalFlywheelStatus =
  | "READY_FOR_REVIEW"
  | "APPROVED_FOR_NEXT_CYCLE"
  | "STOPPED"
  | "CLOSED";

export type CapitalFlywheelRecommendation =
  | "CONTINUE"
  | "HOLD"
  | "STOP";

export type CapitalFlywheelReviewDecision =
  | "CONTINUE_APPROVED"
  | "STOPPED";

export type CapitalFlywheelHealth =
  | "SINGLE_CYCLE"
  | "COMPOUNDING"
  | "HEALTHY"
  | "DIMINISHING"
  | "EXHAUSTED";

export interface CapitalFlywheelUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CapitalFlywheelCandidate {
  persistenceCaseId: string;
  persistenceCaseNumber: string;
  persistenceStatus: ReinvestmentPersistenceStatus;

  sourcePerformanceCaseId: string;
  sourcePerformanceCaseNumber: string;

  redeploymentCaseId: string;
  redeploymentNumber: string;

  recyclingSourceId: string;
  recyclingSourceNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeTitle: string;

  currency: string;
  fiscalYear: number;

  redeployedCapitalAmount: number;

  baselineNetValueAmount: number;
  projectedNetValueAmount: number;
  projectedHorizonValueAmount: number;
  projectedRoiPct: number;

  valuePersistencePct: number;
  efficiencyRetentionPct: number;
  capitalEfficiencyMultiple: number;

  compoundingValueAmount: number;
  decayedValueAmount: number;

  persistenceHealth: ReinvestmentPersistenceHealth;
}

export interface CapitalFlywheelCycle {
  id: string;
  lineageId: string;
  cycleIndex: number;

  persistenceCaseId: string;
  persistenceCaseNumber: string;

  sourcePerformanceCaseNumber: string;
  redeploymentNumber: string;
  recyclingSourceNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeTitle: string;

  fiscalYear: number;

  redeployedCapitalAmount: number;

  baselineNetValueAmount: number;
  projectedNetValueAmount: number;
  projectedHorizonValueAmount: number;
  projectedRoiPct: number;

  valuePersistencePct: number;
  efficiencyRetentionPct: number;
  capitalEfficiencyMultiple: number;

  compoundingValueAmount: number;
  decayedValueAmount: number;

  persistenceHealth: ReinvestmentPersistenceHealth;

  relationshipRationale: string;
  addedByName: string;
  addedAt: string;
}

export interface CapitalFlywheelReview {
  id: string;
  lineageId: string;
  latestCycleId: string;

  cycleCount: number;

  recommendation: CapitalFlywheelRecommendation;
  decision: CapitalFlywheelReviewDecision;

  overrideFlag: boolean;
  diminishingReturns: boolean;

  cumulativeProjectedNetValueAmount: number;
  cumulativeCompoundingValueAmount: number;
  cumulativeDecayedValueAmount: number;

  cumulativeValueMultiple: number;
  latestMarginalValueMultiple: number;
  latestMarginalNetValueRetentionPct: number;

  latestCycleEfficiencyRetentionPct: number;
  latestCycleValuePersistencePct: number;
  latestCycleProjectedRoiPct: number;

  flywheelHealth: CapitalFlywheelHealth;

  decisionNote: string;
  reviewedByName: string;
  reviewedAt: string;
}

export interface CapitalFlywheelLineage {
  id: string;
  lineageNumber: string;

  rootPersistenceCaseId: string;
  rootPersistenceCaseNumber: string;

  rootTargetValueCaseId: string;
  rootTargetValueCaseNumber: string;
  rootTargetInitiativeTitle: string;

  originalCapitalAmount: number;

  currency: string;
  rootFiscalYear: number;

  maximumCycleCount: number;

  minimumMarginalValueMultiple: number;
  minimumCycleEfficiencyRetentionPct: number;
  diminishingReturnTolerancePct: number;

  lineageOwnerUserId: string;
  lineageOwnerName: string;
  lineageObjective: string;

  status: CapitalFlywheelStatus;

  cycleCount: number;

  cumulativeProjectedNetValueAmount: number;
  cumulativeCompoundingValueAmount: number;
  cumulativeDecayedValueAmount: number;

  cumulativeValueMultiple: number;
  latestMarginalValueMultiple: number;
  latestMarginalNetValueRetentionPct: number;

  diminishingReturns: boolean;

  flywheelHealth: CapitalFlywheelHealth;
  recommendation: CapitalFlywheelRecommendation;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CapitalFlywheelLineageDetail {
  lineage: CapitalFlywheelLineage;
  users: CapitalFlywheelUserOption[];
  availableCandidates: CapitalFlywheelCandidate[];
  cycles: CapitalFlywheelCycle[];
  reviews: CapitalFlywheelReview[];
}

export interface CapitalFlywheelSummary {
  candidateCount: number;
  lineageCount: number;

  reviewPendingLineageCount: number;
  approvedNextCycleLineageCount: number;
  stoppedLineageCount: number;

  totalCycleCount: number;

  totalOriginalCapitalAmount: number;
  totalCumulativeProjectedNetValueAmount: number;
  totalCompoundingValueAmount: number;
  totalDecayedValueAmount: number;

  averageCumulativeValueMultiple: number;
  averageLatestMarginalValueMultiple: number;

  diminishingReturnLineageCount: number;
}

export interface CapitalFlywheelSnapshotSummary {
  id: string;
  snapshotNumber: string;

  lineageCount: number;

  reviewPendingLineageCount: number;
  approvedNextCycleLineageCount: number;
  stoppedLineageCount: number;

  totalCycleCount: number;

  totalOriginalCapitalAmount: number;
  totalCumulativeProjectedNetValueAmount: number;
  totalCompoundingValueAmount: number;
  totalDecayedValueAmount: number;

  averageCumulativeValueMultiple: number;
  averageLatestMarginalValueMultiple: number;

  diminishingReturnLineageCount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface CapitalFlywheelSnapshotItem {
  lineageId: string;
  lineageNumber: string;
  rootTargetInitiativeTitle: string;
  currency: string;

  lineageStatus: CapitalFlywheelStatus;

  cycleCount: number;

  originalCapitalAmount: number;

  cumulativeProjectedNetValueAmount: number;
  cumulativeCompoundingValueAmount: number;
  cumulativeDecayedValueAmount: number;

  cumulativeValueMultiple: number;
  latestMarginalValueMultiple: number;
  latestMarginalNetValueRetentionPct: number;

  diminishingReturns: boolean;

  flywheelHealth: CapitalFlywheelHealth;
  recommendation: CapitalFlywheelRecommendation;
}

export interface CapitalFlywheelSnapshotDetail {
  snapshot: CapitalFlywheelSnapshotSummary;
  items: CapitalFlywheelSnapshotItem[];
}

export interface CapitalFlywheelDashboard {
  summary: CapitalFlywheelSummary;
  users: CapitalFlywheelUserOption[];
  candidates: CapitalFlywheelCandidate[];
  lineages: CapitalFlywheelLineage[];
  snapshots: CapitalFlywheelSnapshotSummary[];
}
