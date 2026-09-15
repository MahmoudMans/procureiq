import type {
  CapitalRecyclingSourceStatus,
} from "@/types/capital-recycling";

import type {
  StrategicValueHealth,
} from "@/types/strategic-value";

export type CapitalRedeploymentStatus =
  | "PLANNED"
  | "READY_FOR_AUTHORIZATION"
  | "AUTHORIZED"
  | "ACTIVE"
  | "READY_FOR_VERIFICATION"
  | "VERIFIED"
  | "REMEDIATION_REQUIRED"
  | "CLOSED";

export type CapitalRedeploymentGateStatus =
  | "PENDING"
  | "SATISFIED"
  | "WAIVED";

export type CapitalRedeploymentAuthorizationDecision =
  | "APPROVED"
  | "REJECTED";

export type CapitalRedeploymentVerificationDecision =
  | "VERIFIED"
  | "REMEDIATION_REQUIRED";

export type CapitalRedeploymentHealth =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "VARIANCE"
  | "REMEDIATION_REQUIRED";

export interface CapitalRedeploymentUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CapitalRedeploymentCandidate {
  recyclingSourceId: string;
  recyclingSourceNumber: string;
  recyclingSourceStatus: CapitalRecyclingSourceStatus;

  reinvestmentProposalId: string;

  sourceFundingCommitmentId: string;
  sourceFundingCommitmentNumber: string;

  sourceValueCaseId: string;
  sourceValueCaseNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeNumber: string;
  targetInitiativeTitle: string;

  currency: string;
  fiscalYear: number;

  approvedRedeploymentAmount: number;
  sourceRecyclableCapitalAmount: number;
  currentSourceFundingRemainingAmount: number;

  targetRoiPctSnapshot: number;
  targetPersistencePctSnapshot: number;
  targetNetValueSnapshot: number;
  targetValueHealthSnapshot: StrategicValueHealth;
}

export interface CapitalRedeploymentGate {
  id: string;
  redeploymentCaseId: string;
  gateNumber: string;
  title: string;
  requirement: string;
  status: CapitalRedeploymentGateStatus;
  evidenceNote: string | null;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface CapitalRedeploymentAuthorization {
  id: string;
  redeploymentCaseId: string;
  decision: CapitalRedeploymentAuthorizationDecision;
  authorizedAmount: number;
  authorizationNote: string;
  authorizedByName: string;
  authorizedAt: string;
}

export interface CapitalRedeploymentRelease {
  id: string;
  redeploymentCaseId: string;
  authorizationId: string;
  releasedOn: string;
  releasedAmount: number;
  evidenceNote: string;
  referenceText: string;
  releasedByName: string;
  releasedAt: string;
}

export interface CapitalRedeploymentVerification {
  id: string;
  redeploymentCaseId: string;
  decision: CapitalRedeploymentVerificationDecision;
  approvedRedeploymentAmount: number;
  releasedRedeploymentAmount: number;
  remainingRedeploymentAmount: number;
  redeploymentPct: number;
  redeploymentVarianceAmount: number;
  verificationNote: string;
  verifiedByName: string;
  verifiedAt: string;
}

export interface CapitalRedeploymentCase {
  id: string;
  redeploymentNumber: string;

  recyclingSourceId: string;
  recyclingSourceNumber: string;
  currentRecyclingSourceStatus: CapitalRecyclingSourceStatus;

  reinvestmentProposalId: string;

  sourceFundingCommitmentId: string;
  sourceFundingCommitmentNumber: string;

  sourceValueCaseId: string;
  sourceValueCaseNumber: string;

  targetValueCaseId: string;
  targetValueCaseNumber: string;
  targetInitiativeNumber: string;
  targetInitiativeTitle: string;

  currency: string;
  fiscalYear: number;

  approvedRedeploymentAmount: number;
  sourceRecyclableCapitalSnapshot: number;
  sourceFundingRemainingSnapshot: number;
  currentSourceFundingRemainingAmount: number;

  targetRoiPctSnapshot: number;
  targetPersistencePctSnapshot: number;
  targetNetValueSnapshot: number;
  targetValueHealthSnapshot: StrategicValueHealth;

  redeploymentOwnerUserId: string;
  redeploymentOwnerName: string;
  redeploymentObjective: string;

  releasedRedeploymentAmount: number;
  remainingRedeploymentAmount: number;
  redeploymentPct: number;
  redeploymentVarianceAmount: number;
  redeploymentHealth: CapitalRedeploymentHealth;

  status: CapitalRedeploymentStatus;

  gateCount: number;
  resolvedGateCount: number;
  pendingGateCount: number;
  authorizationCount: number;
  releaseCount: number;
  verificationCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CapitalRedeploymentCaseDetail {
  redeploymentCase: CapitalRedeploymentCase;
  users: CapitalRedeploymentUserOption[];
  gates: CapitalRedeploymentGate[];
  authorizations: CapitalRedeploymentAuthorization[];
  releases: CapitalRedeploymentRelease[];
  verifications: CapitalRedeploymentVerification[];
}

export interface CapitalRedeploymentSummary {
  candidateCount: number;
  caseCount: number;
  plannedCaseCount: number;
  authorizationPendingCaseCount: number;
  activeCaseCount: number;
  readyCaseCount: number;
  verifiedCaseCount: number;
  remediationCaseCount: number;
  totalApprovedRedeploymentAmount: number;
  totalReleasedRedeploymentAmount: number;
  totalRemainingRedeploymentAmount: number;
  averageRedeploymentPct: number;
}

export interface CapitalRedeploymentSnapshotSummary {
  id: string;
  snapshotNumber: string;
  caseCount: number;
  plannedCaseCount: number;
  authorizationPendingCaseCount: number;
  activeCaseCount: number;
  readyCaseCount: number;
  verifiedCaseCount: number;
  remediationCaseCount: number;
  totalApprovedRedeploymentAmount: number;
  totalReleasedRedeploymentAmount: number;
  totalRemainingRedeploymentAmount: number;
  averageRedeploymentPct: number;
  capturedByName: string;
  capturedAt: string;
}

export interface CapitalRedeploymentSnapshotItem {
  redeploymentCaseId: string;
  redeploymentNumber: string;
  recyclingSourceNumber: string;
  targetValueCaseNumber: string;
  targetInitiativeTitle: string;
  currency: string;
  caseStatus: CapitalRedeploymentStatus;
  approvedRedeploymentAmount: number;
  releasedRedeploymentAmount: number;
  remainingRedeploymentAmount: number;
  redeploymentPct: number;
  redeploymentVarianceAmount: number;
  redeploymentHealth: CapitalRedeploymentHealth;
  currentSourceFundingRemainingAmount: number;
  gateCount: number;
  resolvedGateCount: number;
  authorizationCount: number;
  releaseCount: number;
}

export interface CapitalRedeploymentSnapshotDetail {
  snapshot: CapitalRedeploymentSnapshotSummary;
  items: CapitalRedeploymentSnapshotItem[];
}

export interface CapitalRedeploymentDashboard {
  summary: CapitalRedeploymentSummary;
  users: CapitalRedeploymentUserOption[];
  candidates: CapitalRedeploymentCandidate[];
  cases: CapitalRedeploymentCase[];
  snapshots: CapitalRedeploymentSnapshotSummary[];
}
