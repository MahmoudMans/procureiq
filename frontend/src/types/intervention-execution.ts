import type {
  InvestmentInterventionAction,
  InvestmentInterventionStatus,
} from "@/types/investment-intervention";

import type {
  InvestmentPerformanceHealth,
} from "@/types/investment-performance";

export type InterventionExecutionStatus =
  | "PLANNED"
  | "ACTIVE"
  | "READY_FOR_VERIFICATION"
  | "VERIFIED"
  | "REMEDIATION_REQUIRED"
  | "CLOSED";

export type InterventionExecutionVerificationDecision =
  | "VERIFIED"
  | "REMEDIATION_REQUIRED";

export type InterventionExecutionHealth =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "VARIANCE"
  | "REMEDIATION_REQUIRED";

export interface InterventionExecutionUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface InterventionExecutionCandidate {
  interventionCaseId: string;
  interventionNumber: string;
  interventionStatus: InvestmentInterventionStatus;

  performanceCaseId: string;
  performanceCaseNumber: string;
  currentPerformanceHealth: InvestmentPerformanceHealth;

  fundingCommitmentId: string;
  fundingCommitmentNumber: string;

  sourceValueCaseId: string;
  sourceValueCaseNumber: string;

  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;

  approvedAction: InvestmentInterventionAction;
  approvedAffectedCapitalAmount: number;

  approvedTargetValueCaseId: string | null;
  approvedTargetValueCaseNumber: string | null;
  approvedTargetInitiativeTitle: string | null;

  currentReleasedCapitalAmount: number;
  currentRemainingCommitmentAmount: number;
}

export interface InterventionExecutionAcknowledgement {
  id: string;
  executionCaseId: string;
  acknowledgementNote: string;
  acknowledgedByName: string;
  acknowledgedAt: string;
}

export interface InterventionExecutionEvidence {
  id: string;
  executionCaseId: string;
  implementedOn: string;
  implementedCapitalAmount: number;
  evidenceNote: string;
  referenceText: string;
  recordedByName: string;
  recordedAt: string;
}

export interface InterventionExecutionVerification {
  id: string;
  executionCaseId: string;
  decision: InterventionExecutionVerificationDecision;
  approvedAction: InvestmentInterventionAction;
  approvedAffectedCapitalAmount: number;
  implementedCapitalAmount: number;
  remainingImplementationAmount: number;
  implementationPct: number;
  implementationVarianceAmount: number;
  verificationNote: string;
  verifiedByName: string;
  verifiedAt: string;
}

export interface InterventionExecutionCase {
  id: string;
  executionNumber: string;

  interventionCaseId: string;
  interventionNumber: string;

  performanceCaseId: string;
  performanceCaseNumber: string;

  fundingCommitmentId: string;
  fundingCommitmentNumber: string;

  sourceValueCaseId: string;
  sourceValueCaseNumber: string;

  initiativeNumber: string;
  initiativeTitle: string;
  currency: string;
  fiscalYear: number;

  approvedAction: InvestmentInterventionAction;
  approvedAffectedCapitalAmount: number;

  approvedTargetValueCaseId: string | null;
  approvedTargetValueCaseNumber: string | null;
  approvedTargetInitiativeTitle: string | null;

  sourceReleasedCapitalSnapshot: number;
  sourceRemainingCommitmentSnapshot: number;

  currentReleasedCapitalAmount: number;
  currentRemainingCommitmentAmount: number;

  executionOwnerUserId: string;
  executionOwnerName: string;
  executionObjective: string;

  implementedCapitalAmount: number;
  remainingImplementationAmount: number;
  implementationPct: number;
  implementationVarianceAmount: number;
  executionHealth: InterventionExecutionHealth;

  status: InterventionExecutionStatus;

  acknowledged: boolean;
  evidenceCount: number;
  verificationCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface InterventionExecutionCaseDetail {
  executionCase: InterventionExecutionCase;
  users: InterventionExecutionUserOption[];
  acknowledgement: InterventionExecutionAcknowledgement | null;
  evidence: InterventionExecutionEvidence[];
  verifications: InterventionExecutionVerification[];
}

export interface InterventionExecutionSummary {
  candidateCount: number;
  caseCount: number;
  plannedCaseCount: number;
  activeCaseCount: number;
  readyCaseCount: number;
  verifiedCaseCount: number;
  remediationCaseCount: number;
  totalApprovedAffectedCapitalAmount: number;
  totalImplementedCapitalAmount: number;
  totalRemainingImplementationAmount: number;
  averageImplementationPct: number;
}

export interface InterventionExecutionSnapshotSummary {
  id: string;
  snapshotNumber: string;
  caseCount: number;
  plannedCaseCount: number;
  activeCaseCount: number;
  readyCaseCount: number;
  verifiedCaseCount: number;
  remediationCaseCount: number;
  totalApprovedAffectedCapitalAmount: number;
  totalImplementedCapitalAmount: number;
  totalRemainingImplementationAmount: number;
  averageImplementationPct: number;
  capturedByName: string;
  capturedAt: string;
}

export interface InterventionExecutionSnapshotItem {
  executionCaseId: string;
  executionNumber: string;
  interventionNumber: string;
  initiativeTitle: string;
  currency: string;
  caseStatus: InterventionExecutionStatus;
  approvedAction: InvestmentInterventionAction;
  approvedAffectedCapitalAmount: number;
  implementedCapitalAmount: number;
  remainingImplementationAmount: number;
  implementationPct: number;
  implementationVarianceAmount: number;
  executionHealth: InterventionExecutionHealth;
  currentReleasedCapitalAmount: number;
  currentRemainingCommitmentAmount: number;
  approvedTargetValueCaseNumber: string | null;
}

export interface InterventionExecutionSnapshotDetail {
  snapshot: InterventionExecutionSnapshotSummary;
  items: InterventionExecutionSnapshotItem[];
}

export interface InterventionExecutionDashboard {
  summary: InterventionExecutionSummary;
  users: InterventionExecutionUserOption[];
  candidates: InterventionExecutionCandidate[];
  cases: InterventionExecutionCase[];
  snapshots: InterventionExecutionSnapshotSummary[];
}
