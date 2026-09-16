import type {
  FlywheelResidualRemediationAction,
} from "@/types/flywheel-remediation";

export type FlywheelRemediationOutcomeStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "VERIFIED"
  | "CLOSED";

export type FlywheelRemediationResolutionType =
  | "RECOVERY_EVIDENCED"
  | "WRITE_OFF_EVIDENCED"
  | "INVESTIGATION_RESOLVED"
  | "RISK_ACCEPTANCE_EVIDENCED"
  | "UNRESOLVED";

export interface FlywheelRemediationOutcomeCurrencyTotal {
  currency: string;
  amount: number;
}

export interface FlywheelRemediationOutcomeSource {
  remediationPlanId: string;
  title: string;
  currency: string;
  fiscalYear: number;
  residualAmount: number;
  itemCount: number;
}

export interface FlywheelRemediationOutcomeCandidate {
  remediationItemId: string;
  sourceAction: FlywheelResidualRemediationAction;
  sourceResidualAmount: number;
}

export interface FlywheelRemediationOutcomeItem {
  id: string;
  outcomeCaseId: string;
  sourceRemediationItemId: string;
  sourceAction: FlywheelResidualRemediationAction;
  sourceResidualAmount: number;
  resolutionType: FlywheelRemediationResolutionType;
  resolvedAmount: number;
  remainingResidualAmount: number;
  observedOn: string;
  evidenceReference: string;
  evidenceNote: string;
  createdByUserId: string;
  createdAt: string;
}

export interface FlywheelRemediationOutcomeCase {
  id: string;
  outcomeNumber: string;
  sourceRemediationPlanId: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceResidualAmount: number;
  sourceItemCount: number;
  resolvedAmount: number;
  remainingResidualAmount: number;
  itemCount: number;
  unresolvedItemCount: number;
  ownerUserId: string;
  ownerName: string;
  status: FlywheelRemediationOutcomeStatus;
  reviewSubmittedByUserId: string | null;
  reviewSubmittedAt: string | null;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  closedByUserId: string | null;
  closedAt: string | null;
  closeNote: string | null;
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlywheelRemediationOutcomeSnapshotSummary {
  id: string;
  snapshotNumber: string;
  outcomeCaseId: string;
  outcomeNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceResidualAmount: number;
  resolvedAmount: number;
  remainingResidualAmount: number;
  itemCount: number;
  unresolvedItemCount: number;
  outcomeStatus: FlywheelRemediationOutcomeStatus;
  capturedByUserId: string;
  capturedAt: string;
  sealed: boolean;
}

export interface FlywheelRemediationOutcomeSnapshotItem {
  id: string;
  snapshotId: string;
  outcomeItemId: string;
  sourceRemediationItemId: string;
  sourceAction: FlywheelResidualRemediationAction;
  sourceResidualAmount: number;
  resolutionType: FlywheelRemediationResolutionType;
  resolvedAmount: number;
  remainingResidualAmount: number;
  observedOn: string;
  evidenceReference: string;
  evidenceNote: string;
}

export interface FlywheelRemediationOutcomeSnapshotDetail {
  snapshot: FlywheelRemediationOutcomeSnapshotSummary;
  items: FlywheelRemediationOutcomeSnapshotItem[];
}

export interface FlywheelRemediationOutcomeCaseDetail {
  outcomeCase: FlywheelRemediationOutcomeCase;
  items: FlywheelRemediationOutcomeItem[];
  candidates: FlywheelRemediationOutcomeCandidate[];
  snapshots: FlywheelRemediationOutcomeSnapshotSummary[];
}

export interface FlywheelRemediationOutcomeSummary {
  totalCases: number;
  draftCases: number;
  inReviewCases: number;
  verifiedCases: number;
  closedCases: number;
  remainingByCurrency: FlywheelRemediationOutcomeCurrencyTotal[];
}

export interface FlywheelRemediationOutcomeDashboard {
  summary: FlywheelRemediationOutcomeSummary;
  cases: FlywheelRemediationOutcomeCase[];
  eligibleSources: FlywheelRemediationOutcomeSource[];
}

export interface FlywheelRemediationOutcomeCaseInput {
  sourceRemediationPlanId: string;
  title: string;
}

export interface FlywheelRemediationOutcomeItemInput {
  sourceRemediationItemId: string;
  resolutionType: FlywheelRemediationResolutionType;
  resolvedAmount: number;
  observedOn: string;
  evidenceReference: string;
  evidenceNote: string;
}

export interface FlywheelRemediationOutcomeNoteInput {
  note: string;
}
