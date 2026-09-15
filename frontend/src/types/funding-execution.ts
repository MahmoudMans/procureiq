import type {
  CapitalAllocationCycleStatus,
  CapitalAllocationDecision,
} from "@/types/capital-allocation";

export type FundingCommitmentStatus =
  | "PLANNED"
  | "ACTIVE"
  | "FULLY_RELEASED"
  | "CLOSED";

export type FundingTrancheStatus =
  | "PLANNED"
  | "READY_FOR_AUTHORIZATION"
  | "AUTHORIZED"
  | "RELEASED";

export type FundingGateStatus =
  | "PENDING"
  | "SATISFIED"
  | "WAIVED";

export type FundingAuthorizationDecision =
  | "APPROVED"
  | "REJECTED";

export interface FundingUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface FundingCandidate {
  allocationCycleId: string;
  allocationCycleNumber: string;
  allocationCycleTitle: string;
  allocationCycleStatus: CapitalAllocationCycleStatus;
  allocationItemId: string;
  valueCaseId: string;
  caseNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  valueOwnerName: string;
  currency: string;
  fiscalYear: number;
  authorizedCapitalAmount: number;
  priorityScore: number;
  recommendation: CapitalAllocationDecision;
  allocationDecision: CapitalAllocationDecision;
  roiPct: number;
  persistencePct: number;
  netValueAmount: number;
}

export interface FundingGate {
  id: string;
  trancheId: string;
  title: string;
  requirement: string;
  status: FundingGateStatus;
  evidenceNote: string | null;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface FundingAuthorization {
  id: string;
  trancheId: string;
  decision: FundingAuthorizationDecision;
  authorizedAmount: number;
  authorizationNote: string;
  authorizedByName: string;
  authorizedAt: string;
}

export interface FundingRelease {
  id: string;
  trancheId: string;
  authorizationId: string;
  releasedAmount: number;
  releaseNote: string;
  releasedByName: string;
  releasedAt: string;
}

export interface FundingTranche {
  id: string;
  commitmentId: string;
  trancheNumber: string;
  sequenceNo: number;
  title: string;
  plannedReleaseAmount: number;
  targetDate: string;
  status: FundingTrancheStatus;
  requestNote: string | null;
  requestedByName: string | null;
  requestedAt: string | null;
  gateCount: number;
  resolvedGateCount: number;
  pendingGateCount: number;
  gates: FundingGate[];
  authorizations: FundingAuthorization[];
  release: FundingRelease | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FundingCommitment {
  id: string;
  commitmentNumber: string;
  allocationCycleId: string;
  allocationCycleNumber: string;
  allocationCycleTitle: string;
  allocationItemId: string;
  valueCaseId: string;
  caseNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;
  authorizedCapitalAmount: number;
  committedCapitalAmount: number;
  fundingOwnerUserId: string;
  fundingOwnerName: string;
  objective: string;
  status: FundingCommitmentStatus;

  plannedReleaseAmount: number;
  releasedAmount: number;
  remainingAuthorizationAmount: number;
  remainingCommitmentAmount: number;
  plannedCoveragePct: number;
  releasePct: number;

  trancheCount: number;
  releasedTrancheCount: number;
  pendingGateCount: number;

  activatedByName: string | null;
  activatedAt: string | null;
  activationNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  closeNote: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FundingCommitmentDetail {
  commitment: FundingCommitment;
  users: FundingUserOption[];
  tranches: FundingTranche[];
}

export interface FundingDashboardSummary {
  candidateCount: number;
  commitmentCount: number;
  plannedCommitmentCount: number;
  activeCommitmentCount: number;
  fullyReleasedCommitmentCount: number;
  closedCommitmentCount: number;
  totalAuthorizedCapitalAmount: number;
  totalCommittedCapitalAmount: number;
  totalReleasedAmount: number;
  totalRemainingCommitmentAmount: number;
}

export interface FundingSnapshotSummary {
  id: string;
  snapshotNumber: string;
  commitmentId: string;
  commitmentNumber: string;
  allocationCycleNumber: string;
  caseNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;
  commitmentStatus: FundingCommitmentStatus;
  authorizedCapitalAmount: number;
  committedCapitalAmount: number;
  plannedReleaseAmount: number;
  releasedAmount: number;
  remainingCommitmentAmount: number;
  remainingAuthorizationAmount: number;
  releasePct: number;
  trancheCount: number;
  releasedTrancheCount: number;
  pendingGateCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface FundingSnapshotItem {
  trancheId: string;
  trancheNumber: string;
  sequenceNo: number;
  title: string;
  plannedReleaseAmount: number;
  releasedAmount: number;
  status: FundingTrancheStatus;
  gateCount: number;
  resolvedGateCount: number;
  authorizationCount: number;
}

export interface FundingSnapshotDetail {
  snapshot: FundingSnapshotSummary;
  items: FundingSnapshotItem[];
}

export interface FundingExecutionDashboard {
  summary: FundingDashboardSummary;
  users: FundingUserOption[];
  candidates: FundingCandidate[];
  commitments: FundingCommitment[];
  snapshots: FundingSnapshotSummary[];
}
