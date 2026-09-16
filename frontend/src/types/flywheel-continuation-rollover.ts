export type FlywheelContinuationRolloverStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type FlywheelContinuationAction =
  | "RECOVERY_RETRY"
  | "WRITE_OFF_ESCALATION"
  | "INVESTIGATION_ESCALATION"
  | "RISK_ACCEPTANCE_ESCALATION";

export type FlywheelContinuationOutcomeResolutionType =
  | "RECOVERY_CONFIRMED"
  | "WRITE_OFF_CONFIRMED"
  | "INVESTIGATION_CONCLUDED"
  | "RISK_ACCEPTANCE_CONFIRMED"
  | "PARTIAL"
  | "UNRESOLVED";

export interface FlywheelContinuationRolloverSource {
  continuationOutcomeCaseId: string;
  continuationOutcomeNumber: string;
  parentContinuationCaseId: string;
  parentContinuationNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  remainingResidualAmount: number;
  positiveResidualItemCount: number;
}

export interface FlywheelContinuationRolloverCandidate {
  continuationOutcomeItemId: string;
  sourceContinuationItemId: string;
  sourceContinuationAction: FlywheelContinuationAction;
  sourceResolutionType: FlywheelContinuationOutcomeResolutionType;
  remainingResidualAmount: number;
}

export interface FlywheelContinuationRolloverItem {
  id: string;
  rolloverCaseId: string;
  sourceContinuationOutcomeItemId: string;
  sourceContinuationItemId: string;
  sourceContinuationAction: FlywheelContinuationAction;
  sourceResolutionType: FlywheelContinuationOutcomeResolutionType;
  sourceRemainingResidualAmount: number;
  continuationAction: FlywheelContinuationAction;
  targetDate: string;
  rationale: string;
  createdByUserId: string;
  createdAt: string;
}

export interface FlywheelContinuationRolloverCase {
  id: string;
  rolloverNumber: string;
  sourceContinuationOutcomeCaseId: string;
  sourceContinuationOutcomeNumber: string;
  parentContinuationCaseId: string;
  parentContinuationNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceRemainingResidualAmount: number;
  sourceResidualItemCount: number;
  itemCount: number;
  ownerUserId: string;
  ownerName: string;
  status: FlywheelContinuationRolloverStatus;
  reviewSubmittedByUserId: string | null;
  reviewSubmittedAt: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  closedByUserId: string | null;
  closedAt: string | null;
  closeNote: string | null;
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlywheelContinuationRolloverSnapshotSummary {
  id: string;
  snapshotNumber: string;
  rolloverCaseId: string;
  rolloverNumber: string;
  sourceContinuationOutcomeCaseId: string;
  sourceContinuationOutcomeNumber: string;
  parentContinuationCaseId: string;
  parentContinuationNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceRemainingResidualAmount: number;
  itemCount: number;
  rolloverStatus: FlywheelContinuationRolloverStatus;
  capturedByUserId: string;
  capturedAt: string;
  sealed: boolean;
}

export interface FlywheelContinuationRolloverSnapshotItem {
  id: string;
  snapshotId: string;
  rolloverItemId: string;
  sourceContinuationOutcomeItemId: string;
  sourceContinuationItemId: string;
  sourceContinuationAction: FlywheelContinuationAction;
  sourceResolutionType: FlywheelContinuationOutcomeResolutionType;
  sourceRemainingResidualAmount: number;
  continuationAction: FlywheelContinuationAction;
  targetDate: string;
  rationale: string;
}

export interface FlywheelContinuationRolloverSnapshotDetail {
  snapshot: FlywheelContinuationRolloverSnapshotSummary;
  items: FlywheelContinuationRolloverSnapshotItem[];
}

export interface FlywheelContinuationRolloverCaseDetail {
  rolloverCase: FlywheelContinuationRolloverCase;
  items: FlywheelContinuationRolloverItem[];
  candidates: FlywheelContinuationRolloverCandidate[];
  snapshots: FlywheelContinuationRolloverSnapshotSummary[];
}

export interface FlywheelContinuationRolloverCurrencyTotal {
  currency: string;
  amount: number;
}

export interface FlywheelContinuationRolloverSummary {
  totalCases: number;
  draftCases: number;
  inReviewCases: number;
  approvedCases: number;
  closedCases: number;
  governedResidualByCurrency: FlywheelContinuationRolloverCurrencyTotal[];
}

export interface FlywheelContinuationRolloverDashboard {
  summary: FlywheelContinuationRolloverSummary;
  cases: FlywheelContinuationRolloverCase[];
  eligibleSources: FlywheelContinuationRolloverSource[];
}

export interface FlywheelContinuationRolloverCaseInput {
  sourceContinuationOutcomeCaseId: string;
}

export interface FlywheelContinuationRolloverItemInput {
  sourceContinuationOutcomeItemId: string;
  targetDate: string;
  rationale: string;
}

export interface FlywheelContinuationRolloverNoteInput {
  note: string;
}
