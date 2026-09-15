import type {
  InvestmentPerformanceCaseStatus,
  InvestmentPerformanceHealth,
} from "@/types/investment-performance";

import type {
  StrategicValueCase,
} from "@/types/strategic-value";

export type InvestmentInterventionStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type InvestmentInterventionAction =
  | "CONTINUE"
  | "HOLD_FUTURE_RELEASES"
  | "REDUCE_UNRELEASED"
  | "REALLOCATE_UNRELEASED";

export type InvestmentInterventionDecision =
  | "APPROVED"
  | "REJECTED";

export interface InvestmentInterventionUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface InvestmentInterventionCandidate {
  performanceCaseId: string;
  performanceCaseNumber: string;
  performanceStatus: InvestmentPerformanceCaseStatus;
  performanceHealth: InvestmentPerformanceHealth;

  fundingCommitmentId: string;
  fundingCommitmentNumber: string;

  valueCaseId: string;
  valueCaseNumber: string;

  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;

  releasedCapitalAmount: number;
  remainingCommitmentAmount: number;

  baselineRoiPct: number;
  realizedRoiPct: number;
  roiVariancePct: number;
  capitalEfficiencyMultiple: number;
  valueVarianceAmount: number;

  recommendation: InvestmentInterventionAction;
  recommendedAffectedCapitalAmount: number;
}

export interface InvestmentInterventionDecisionRecord {
  id: string;
  proposalId: string;
  decision: InvestmentInterventionDecision;
  decisionNote: string;
  decidedByName: string;
  decidedAt: string;
}

export interface InvestmentInterventionProposal {
  id: string;
  interventionCaseId: string;
  actionType: InvestmentInterventionAction;
  sourceRemainingCapitalSnapshot: number;
  affectedCapitalAmount: number;
  targetValueCaseId: string | null;
  targetValueCaseNumber: string | null;
  targetInitiativeTitle: string | null;
  proposalRationale: string;
  proposedByName: string;
  proposedAt: string;
  decision: InvestmentInterventionDecisionRecord | null;
}

export interface InvestmentInterventionCase {
  id: string;
  interventionNumber: string;

  performanceCaseId: string;
  performanceCaseNumber: string;

  fundingCommitmentId: string;
  fundingCommitmentNumber: string;

  valueCaseId: string;
  valueCaseNumber: string;

  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;

  interventionOwnerUserId: string;
  interventionOwnerName: string;
  interventionRationale: string;

  sourcePerformanceStatus: InvestmentPerformanceCaseStatus;
  sourcePerformanceHealth: InvestmentPerformanceHealth;
  sourceReleasedCapitalAmount: number;
  sourceRemainingCommitmentAmount: number;
  sourceBaselineRoiPct: number;
  sourceRealizedRoiPct: number;
  sourceRoiVariancePct: number;
  sourceCapitalEfficiencyMultiple: number;
  sourceValueVarianceAmount: number;

  currentPerformanceStatus: InvestmentPerformanceCaseStatus;
  currentPerformanceHealth: InvestmentPerformanceHealth;
  currentReleasedCapitalAmount: number;
  currentRemainingCommitmentAmount: number;
  currentRealizedRoiPct: number;
  currentRoiVariancePct: number;
  currentCapitalEfficiencyMultiple: number;
  currentValueVarianceAmount: number;

  currentRecommendation: InvestmentInterventionAction;
  currentRecommendedAffectedCapitalAmount: number;

  approvedAction: InvestmentInterventionAction | null;
  approvedAffectedCapitalAmount: number;
  approvedTargetValueCaseNumber: string | null;

  status: InvestmentInterventionStatus;
  proposalCount: number;
  decisionCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface InvestmentInterventionCaseDetail {
  interventionCase: InvestmentInterventionCase;
  users: InvestmentInterventionUserOption[];
  reallocationTargets: StrategicValueCase[];
  proposals: InvestmentInterventionProposal[];
}

export interface InvestmentInterventionSummary {
  candidateCount: number;
  caseCount: number;
  openCaseCount: number;
  inReviewCaseCount: number;
  approvedCaseCount: number;
  underperformingCaseCount: number;
  totalRemainingCapitalAmount: number;
  totalApprovedAffectedCapitalAmount: number;
  totalApprovedReallocationAmount: number;
}

export interface InvestmentInterventionSnapshotSummary {
  id: string;
  snapshotNumber: string;
  caseCount: number;
  openCaseCount: number;
  inReviewCaseCount: number;
  approvedCaseCount: number;
  underperformingCaseCount: number;
  totalRemainingCapitalAmount: number;
  totalApprovedAffectedCapitalAmount: number;
  totalApprovedReallocationAmount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface InvestmentInterventionSnapshotItem {
  interventionCaseId: string;
  interventionNumber: string;
  performanceCaseNumber: string;
  fundingCommitmentNumber: string;
  valueCaseNumber: string;
  initiativeTitle: string;
  currency: string;
  caseStatus: InvestmentInterventionStatus;
  currentPerformanceHealth: InvestmentPerformanceHealth;
  currentReleasedCapitalAmount: number;
  currentRemainingCommitmentAmount: number;
  currentRealizedRoiPct: number;
  currentRoiVariancePct: number;
  currentCapitalEfficiencyMultiple: number;
  currentValueVarianceAmount: number;
  recommendedAction: InvestmentInterventionAction;
  approvedAction: InvestmentInterventionAction | null;
  approvedAffectedCapitalAmount: number;
  approvedTargetValueCaseNumber: string | null;
}

export interface InvestmentInterventionSnapshotDetail {
  snapshot: InvestmentInterventionSnapshotSummary;
  items: InvestmentInterventionSnapshotItem[];
}

export interface InvestmentInterventionDashboard {
  summary: InvestmentInterventionSummary;
  users: InvestmentInterventionUserOption[];
  candidates: InvestmentInterventionCandidate[];
  cases: InvestmentInterventionCase[];
  snapshots: InvestmentInterventionSnapshotSummary[];
}
