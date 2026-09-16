export type FlywheelResidualContinuationStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type FlywheelResidualContinuationAction =
  | "RECOVERY_RETRY"
  | "WRITE_OFF_ESCALATION"
  | "INVESTIGATION_ESCALATION"
  | "RISK_ACCEPTANCE_ESCALATION";

export type FlywheelContinuationSourceAction =
  | "RECOVERY_FOLLOW_UP"
  | "WRITE_OFF_REVIEW"
  | "INVESTIGATION_ESCALATION"
  | "RESIDUAL_ACCEPTANCE_REVIEW";

export type FlywheelContinuationSourceResolution =
  | "RECOVERY_EVIDENCED"
  | "WRITE_OFF_EVIDENCED"
  | "INVESTIGATION_RESOLVED"
  | "RISK_ACCEPTANCE_EVIDENCED"
  | "UNRESOLVED";

export interface FlywheelResidualContinuationSource {
  outcomeCaseId: string;
  outcomeNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  remainingResidualAmount: number;
  residualItemCount: number;
}

export interface FlywheelResidualContinuationCandidate {
  outcomeItemId: string;
  sourceAction: FlywheelContinuationSourceAction;
  sourceResolutionType: FlywheelContinuationSourceResolution;
  remainingResidualAmount: number;
}

export interface FlywheelResidualContinuationItem {
  id: string;
  continuationCaseId: string;
  sourceOutcomeItemId: string;
  sourceAction: FlywheelContinuationSourceAction;
  sourceResolutionType: FlywheelContinuationSourceResolution;
  sourceRemainingResidualAmount: number;
  continuationAction: FlywheelResidualContinuationAction;
  targetDate: string;
  rationale: string;
  createdByUserId: string;
  createdAt: string;
}

export interface FlywheelResidualContinuationCase {
  id: string;
  continuationNumber: string;
  sourceOutcomeCaseId: string;
  sourceOutcomeNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceRemainingResidualAmount: number;
  sourceResidualItemCount: number;
  itemCount: number;
  ownerUserId: string;
  ownerName: string;
  status: FlywheelResidualContinuationStatus;
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

export interface FlywheelResidualContinuationSnapshotSummary {
  id: string;
  snapshotNumber: string;
  continuationCaseId: string;
  continuationNumber: string;
  sourceOutcomeCaseId: string;
  sourceOutcomeNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceRemainingResidualAmount: number;
  itemCount: number;
  continuationStatus: FlywheelResidualContinuationStatus;
  capturedByUserId: string;
  capturedAt: string;
  sealed: boolean;
}

export interface FlywheelResidualContinuationSnapshotItem {
  id: string;
  snapshotId: string;
  continuationItemId: string;
  sourceOutcomeItemId: string;
  sourceAction: FlywheelContinuationSourceAction;
  sourceResolutionType: FlywheelContinuationSourceResolution;
  sourceRemainingResidualAmount: number;
  continuationAction: FlywheelResidualContinuationAction;
  targetDate: string;
  rationale: string;
}

export interface FlywheelResidualContinuationSnapshotDetail {
  snapshot: FlywheelResidualContinuationSnapshotSummary;
  items: FlywheelResidualContinuationSnapshotItem[];
}

export interface FlywheelResidualContinuationCaseDetail {
  continuationCase: FlywheelResidualContinuationCase;
  items: FlywheelResidualContinuationItem[];
  candidates: FlywheelResidualContinuationCandidate[];
  snapshots: FlywheelResidualContinuationSnapshotSummary[];
}

export interface FlywheelResidualContinuationCurrencyTotal {
  currency: string;
  amount: number;
}

export interface FlywheelResidualContinuationSummary {
  totalCases: number;
  draftCases: number;
  inReviewCases: number;
  approvedCases: number;
  closedCases: number;
  governedResidualByCurrency: FlywheelResidualContinuationCurrencyTotal[];
}

export interface FlywheelResidualContinuationDashboard {
  summary: FlywheelResidualContinuationSummary;
  cases: FlywheelResidualContinuationCase[];
  eligibleSources: FlywheelResidualContinuationSource[];
}

export interface FlywheelResidualContinuationCaseInput {
  sourceOutcomeCaseId: string;
  title: string;
}

export interface FlywheelResidualContinuationItemInput {
  sourceOutcomeItemId: string;
  continuationAction: FlywheelResidualContinuationAction;
  targetDate: string;
  rationale: string;
}

export interface FlywheelResidualContinuationNoteInput {
  note: string;
}
