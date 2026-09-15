import type {
  FundingCommitmentStatus,
} from "@/types/funding-execution";

export type InvestmentPerformanceCaseStatus =
  | "ACTIVE"
  | "READY_FOR_REVIEW"
  | "IN_REMEDIATION"
  | "VERIFIED"
  | "CLOSED";

export type InvestmentPerformanceHealth =
  | "UNASSESSED"
  | "OUTPERFORMING"
  | "ON_TRACK"
  | "WATCH"
  | "UNDERPERFORMING";

export type InvestmentPerformanceValidationDecision =
  | "VALIDATED"
  | "REJECTED";

export type InvestmentPerformanceReviewDecision =
  | "CONFIRMED"
  | "REMEDIATION_REQUIRED";

export interface InvestmentPerformanceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface InvestmentPerformanceCandidate {
  fundingCommitmentId: string;
  fundingCommitmentNumber: string;
  fundingStatus: FundingCommitmentStatus;
  allocationCycleId: string;
  allocationCycleNumber: string;
  valueCaseId: string;
  valueCaseNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;
  currentReleasedCapitalAmount: number;
  committedCapitalAmount: number;
  releasePct: number;
  baselineInvestmentCostAmount: number;
  baselineDurableHorizonValueAmount: number;
  baselineRoiPct: number;
  baselineTargetRoiPct: number;
}

export interface InvestmentPerformanceObservation {
  id: string;
  performanceCaseId: string;
  observedOn: string;
  releasedCapitalSnapshot: number;
  releasePctSnapshot: number;
  reportedRealizedAnnualizedValueAmount: number;
  evidenceNote: string;
  reportedByName: string;
  reportedAt: string;
  validationDecision: InvestmentPerformanceValidationDecision | null;
  validatedRealizedAnnualizedValueAmount: number | null;
  validationNote: string | null;
  validatedByName: string | null;
  validatedAt: string | null;
}

export interface InvestmentPerformanceDecision {
  id: string;
  performanceCaseId: string;
  observationId: string;
  decision: InvestmentPerformanceReviewDecision;
  health: InvestmentPerformanceHealth;
  releasedCapitalAmount: number;
  validatedRealizedAnnualizedValueAmount: number;
  realizedHorizonValueAmount: number;
  realizedTotalCostAmount: number;
  realizedNetValueAmount: number;
  realizedRoiPct: number;
  baselineRoiPct: number;
  roiVariancePct: number;
  fundingVarianceAmount: number;
  fundingVariancePct: number;
  capitalEfficiencyMultiple: number;
  valueVarianceAmount: number;
  decisionNote: string;
  decidedByName: string;
  decidedAt: string;
}

export interface InvestmentPerformanceCase {
  id: string;
  performanceCaseNumber: string;

  fundingCommitmentId: string;
  fundingCommitmentNumber: string;
  currentFundingStatus: FundingCommitmentStatus;
  allocationCycleId: string;
  allocationCycleNumber: string;

  valueCaseId: string;
  valueCaseNumber: string;

  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;

  performanceOwnerUserId: string;
  performanceOwnerName: string;
  performanceObjective: string;

  baselineInvestmentCostAmount: number;
  baselineAnnualOperatingCostAmount: number;
  baselineAnnualizedValueAmount: number;
  baselineDurableAnnualValueAmount: number;
  baselineDurableHorizonValueAmount: number;
  baselineRoiPct: number;
  baselineTargetRoiPct: number;
  baselineTargetPaybackMonths: number;
  valueHorizonMonths: number;

  currentReleasedCapitalAmount: number;
  currentReleasePct: number;

  assessed: boolean;
  assessedReleasedCapitalAmount: number;
  validatedRealizedAnnualizedValueAmount: number;
  realizedHorizonValueAmount: number;
  realizedOperatingCostHorizonAmount: number;
  realizedTotalCostAmount: number;
  realizedNetValueAmount: number;
  realizedRoiPct: number;
  roiVariancePct: number;
  fundingVarianceAmount: number;
  fundingVariancePct: number;
  capitalEfficiencyMultiple: number;
  valueVarianceAmount: number;
  health: InvestmentPerformanceHealth;

  status: InvestmentPerformanceCaseStatus;
  observationCount: number;
  decisionCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface InvestmentPerformanceCaseDetail {
  performanceCase: InvestmentPerformanceCase;
  users: InvestmentPerformanceUserOption[];
  observations: InvestmentPerformanceObservation[];
  decisions: InvestmentPerformanceDecision[];
}

export interface InvestmentPerformanceSummary {
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
  averageFundingVariancePct: number;
  averageCapitalEfficiencyMultiple: number;
}

export interface InvestmentPerformanceSnapshotSummary {
  id: string;
  snapshotNumber: string;
  caseCount: number;
  assessedCaseCount: number;
  outperformingCaseCount: number;
  onTrackCaseCount: number;
  watchCaseCount: number;
  underperformingCaseCount: number;
  averageRealizedRoiPct: number;
  averageRoiVariancePct: number;
  averageFundingVariancePct: number;
  averageCapitalEfficiencyMultiple: number;
  capturedByName: string;
  capturedAt: string;
}

export interface InvestmentPerformanceSnapshotItem {
  performanceCaseId: string;
  performanceCaseNumber: string;
  fundingCommitmentNumber: string;
  valueCaseNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  caseStatus: InvestmentPerformanceCaseStatus;
  assessed: boolean;
  releasedCapitalAmount: number;
  baselineInvestmentCostAmount: number;
  baselineDurableHorizonValueAmount: number;
  validatedRealizedAnnualizedValueAmount: number;
  realizedHorizonValueAmount: number;
  realizedNetValueAmount: number;
  baselineRoiPct: number;
  realizedRoiPct: number;
  roiVariancePct: number;
  fundingVarianceAmount: number;
  fundingVariancePct: number;
  capitalEfficiencyMultiple: number;
  valueVarianceAmount: number;
  health: InvestmentPerformanceHealth;
}

export interface InvestmentPerformanceSnapshotDetail {
  snapshot: InvestmentPerformanceSnapshotSummary;
  items: InvestmentPerformanceSnapshotItem[];
}

export interface InvestmentPerformanceDashboard {
  summary: InvestmentPerformanceSummary;
  users: InvestmentPerformanceUserOption[];
  candidates: InvestmentPerformanceCandidate[];
  cases: InvestmentPerformanceCase[];
  snapshots: InvestmentPerformanceSnapshotSummary[];
}
