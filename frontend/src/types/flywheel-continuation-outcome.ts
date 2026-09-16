export type FlywheelContinuationOutcomeStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "VERIFIED"
  | "CLOSED";

export type FlywheelContinuationOutcomeResidualDisposition =
  | "FULLY_RESOLVED"
  | "FURTHER_GOVERNANCE_REQUIRED";

export type FlywheelContinuationOutcomeResolutionType =
  | "RECOVERY_CONFIRMED"
  | "WRITE_OFF_CONFIRMED"
  | "INVESTIGATION_CONCLUDED"
  | "RISK_ACCEPTANCE_CONFIRMED"
  | "PARTIAL"
  | "UNRESOLVED";

export type FlywheelContinuationAction =
  | "RECOVERY_RETRY"
  | "WRITE_OFF_ESCALATION"
  | "INVESTIGATION_ESCALATION"
  | "RISK_ACCEPTANCE_ESCALATION";

export interface FlywheelContinuationOutcomeSource {
  continuationCaseId: string;
  continuationNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceResidualAmount: number;
  sourceItemCount: number;
}

export interface FlywheelContinuationOutcomeCandidate {
  continuationItemId: string;
  continuationAction: FlywheelContinuationAction;
  sourceResidualAmount: number;
}

export interface FlywheelContinuationOutcomeItem {
  id: string;
  outcomeCaseId: string;
  sourceContinuationItemId: string;
  sourceContinuationAction: FlywheelContinuationAction;
  sourceResidualAmount: number;
  resolutionType: FlywheelContinuationOutcomeResolutionType;
  observedReductionAmount: number;
  remainingResidualAmount: number;
  observedOn: string;
  evidenceReference: string;
  evidenceNote: string;
  createdByUserId: string;
  createdAt: string;
}

export interface FlywheelContinuationOutcomeCase {
  id: string;
  outcomeNumber: string;
  sourceContinuationCaseId: string;
  sourceContinuationNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceResidualAmount: number;
  sourceItemCount: number;
  itemCount: number;
  currentRemainingResidualAmount: number;
  ownerUserId: string;
  ownerName: string;
  status: FlywheelContinuationOutcomeStatus;
  residualDisposition:
    | FlywheelContinuationOutcomeResidualDisposition
    | null;
  verifiedRemainingResidualAmount: number | null;
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

export interface FlywheelContinuationOutcomeSnapshotSummary {
  id: string;
  snapshotNumber: string;
  outcomeCaseId: string;
  outcomeNumber: string;
  sourceContinuationCaseId: string;
  sourceContinuationNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceResidualAmount: number;
  remainingResidualAmount: number;
  itemCount: number;
  outcomeStatus: FlywheelContinuationOutcomeStatus;
  residualDisposition:
    | FlywheelContinuationOutcomeResidualDisposition
    | null;
  capturedByUserId: string;
  capturedAt: string;
  sealed: boolean;
}

export interface FlywheelContinuationOutcomeSnapshotItem {
  id: string;
  snapshotId: string;
  outcomeItemId: string;
  sourceContinuationItemId: string;
  sourceContinuationAction: FlywheelContinuationAction;
  sourceResidualAmount: number;
  resolutionType: FlywheelContinuationOutcomeResolutionType;
  observedReductionAmount: number;
  remainingResidualAmount: number;
  observedOn: string;
  evidenceReference: string;
  evidenceNote: string;
}

export interface FlywheelContinuationOutcomeSnapshotDetail {
  snapshot: FlywheelContinuationOutcomeSnapshotSummary;
  items: FlywheelContinuationOutcomeSnapshotItem[];
}

export interface FlywheelContinuationOutcomeCaseDetail {
  outcomeCase: FlywheelContinuationOutcomeCase;
  items: FlywheelContinuationOutcomeItem[];
  candidates: FlywheelContinuationOutcomeCandidate[];
  snapshots: FlywheelContinuationOutcomeSnapshotSummary[];
}

export interface FlywheelContinuationOutcomeCurrencyTotal {
  currency: string;
  amount: number;
}

export interface FlywheelContinuationOutcomeSummary {
  totalCases: number;
  draftCases: number;
  inReviewCases: number;
  verifiedCases: number;
  closedCases: number;
  furtherGovernanceRequiredCases: number;
  remainingResidualByCurrency: FlywheelContinuationOutcomeCurrencyTotal[];
}

export interface FlywheelContinuationOutcomeDashboard {
  summary: FlywheelContinuationOutcomeSummary;
  cases: FlywheelContinuationOutcomeCase[];
  eligibleSources: FlywheelContinuationOutcomeSource[];
}

export interface FlywheelContinuationOutcomeCaseInput {
  sourceContinuationCaseId: string;
}

export interface FlywheelContinuationOutcomeItemInput {
  sourceContinuationItemId: string;
  resolutionType: FlywheelContinuationOutcomeResolutionType;
  observedReductionAmount: number;
  observedOn: string;
  evidenceReference: string;
  evidenceNote: string;
}

export interface FlywheelContinuationOutcomeNoteInput {
  note: string;
}
