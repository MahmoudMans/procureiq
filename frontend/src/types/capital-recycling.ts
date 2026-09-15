import type {
  InvestmentInterventionAction,
} from "@/types/investment-intervention";

import type {
  InterventionExecutionStatus,
} from "@/types/intervention-execution";

import type {
  StrategicValueHealth,
} from "@/types/strategic-value";

export type CapitalRecyclingSourceStatus =
  | "OPEN"
  | "FULLY_ALLOCATED"
  | "CLOSED";

export type CapitalReinvestmentDecision =
  | "APPROVED"
  | "REJECTED";

export interface CapitalRecyclingUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CapitalRecyclingCandidate {
  executionCaseId: string;
  executionNumber: string;
  executionStatus: InterventionExecutionStatus;

  interventionCaseId: string;
  interventionNumber: string;

  fundingCommitmentId: string;
  fundingCommitmentNumber: string;

  sourceValueCaseId: string;
  sourceValueCaseNumber: string;

  sourceInitiativeNumber: string;
  sourceInitiativeTitle: string;

  sourceAction: InvestmentInterventionAction;

  currency: string;
  fiscalYear: number;

  verifiedImplementedCapitalAmount: number;
  currentFundingRemainingAmount: number;
  recyclableCapitalAmount: number;

  preferredTargetValueCaseId: string | null;
  preferredTargetValueCaseNumber: string | null;
  preferredTargetInitiativeTitle: string | null;
}

export interface CapitalReinvestmentTarget {
  valueCaseId: string;
  valueCaseNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;
  roiPct: number;
  persistencePct: number;
  netValueAmount: number;
  valueHealth: StrategicValueHealth;
  preferredTarget: boolean;
}

export interface CapitalReinvestmentDecisionRecord {
  id: string;
  proposalId: string;
  decision: CapitalReinvestmentDecision;
  decisionNote: string;
  decidedByName: string;
  decidedAt: string;
}

export interface CapitalReinvestmentProposal {
  id: string;
  recyclingSourceId: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeNumber: string;
  targetInitiativeTitle: string;

  sourceAvailableCapitalSnapshot: number;
  requestedReinvestmentAmount: number;

  targetRoiPctSnapshot: number;
  targetPersistencePctSnapshot: number;
  targetNetValueSnapshot: number;
  targetValueHealthSnapshot: StrategicValueHealth;

  proposalRationale: string;
  proposedByName: string;
  proposedAt: string;

  decision: CapitalReinvestmentDecisionRecord | null;
}

export interface CapitalRecyclingSource {
  id: string;
  sourceNumber: string;

  executionCaseId: string;
  executionNumber: string;
  currentExecutionStatus: InterventionExecutionStatus;

  interventionCaseId: string;
  interventionNumber: string;

  fundingCommitmentId: string;
  fundingCommitmentNumber: string;

  sourceValueCaseId: string;
  sourceValueCaseNumber: string;

  sourceInitiativeNumber: string;
  sourceInitiativeTitle: string;

  sourceAction: InvestmentInterventionAction;

  currency: string;
  fiscalYear: number;

  verifiedImplementedCapitalAmount: number;
  recyclableCapitalAmount: number;
  fundingRemainingSnapshot: number;
  currentFundingRemainingAmount: number;

  approvedReinvestmentAmount: number;
  pendingReinvestmentAmount: number;
  availableCapitalAmount: number;
  utilizationPct: number;

  preferredTargetValueCaseId: string | null;
  preferredTargetValueCaseNumber: string | null;
  preferredTargetInitiativeTitle: string | null;

  sourceOwnerUserId: string;
  sourceOwnerName: string;
  recyclingObjective: string;

  status: CapitalRecyclingSourceStatus;

  proposalCount: number;
  approvedProposalCount: number;
  pendingProposalCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CapitalRecyclingSourceDetail {
  source: CapitalRecyclingSource;
  users: CapitalRecyclingUserOption[];
  targets: CapitalReinvestmentTarget[];
  proposals: CapitalReinvestmentProposal[];
}

export interface CapitalRecyclingSummary {
  candidateCount: number;
  sourceCount: number;
  openSourceCount: number;
  fullyAllocatedSourceCount: number;
  totalRecyclableCapitalAmount: number;
  totalApprovedReinvestmentAmount: number;
  totalAvailableCapitalAmount: number;
  averageUtilizationPct: number;
}

export interface CapitalRecyclingSnapshotSummary {
  id: string;
  snapshotNumber: string;
  sourceCount: number;
  openSourceCount: number;
  fullyAllocatedSourceCount: number;
  totalRecyclableCapitalAmount: number;
  totalApprovedReinvestmentAmount: number;
  totalAvailableCapitalAmount: number;
  averageUtilizationPct: number;
  capturedByName: string;
  capturedAt: string;
}

export interface CapitalRecyclingSnapshotItem {
  recyclingSourceId: string;
  sourceNumber: string;
  executionNumber: string;
  sourceInitiativeTitle: string;
  sourceAction: InvestmentInterventionAction;
  currency: string;
  sourceStatus: CapitalRecyclingSourceStatus;
  recyclableCapitalAmount: number;
  approvedReinvestmentAmount: number;
  pendingReinvestmentAmount: number;
  availableCapitalAmount: number;
  utilizationPct: number;
  currentFundingRemainingAmount: number;
  preferredTargetValueCaseNumber: string | null;
}

export interface CapitalRecyclingSnapshotDetail {
  snapshot: CapitalRecyclingSnapshotSummary;
  items: CapitalRecyclingSnapshotItem[];
}

export interface CapitalRecyclingDashboard {
  summary: CapitalRecyclingSummary;
  users: CapitalRecyclingUserOption[];
  candidates: CapitalRecyclingCandidate[];
  sources: CapitalRecyclingSource[];
  snapshots: CapitalRecyclingSnapshotSummary[];
}
