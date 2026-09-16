export type FlywheelResidualRemediationPlanStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type FlywheelResidualRemediationAction =
  | "RECOVERY_FOLLOW_UP"
  | "WRITE_OFF_REVIEW"
  | "INVESTIGATION_ESCALATION"
  | "RESIDUAL_ACCEPTANCE_REVIEW";

export type FlywheelVarianceDecision =
  | "RECOVER"
  | "WRITE_OFF"
  | "INVESTIGATE";

export interface FlywheelResidualRemediationCurrencyTotal {
  currency: string;
  amount: number;
}

export interface FlywheelResidualRemediationSource {
  executionCaseId: string;
  title: string;
  currency: string;
  fiscalYear: number;
  financialResidualAmount: number;
  residualItemCount: number;
}

export interface FlywheelResidualRemediationCandidate {
  executionItemId: string;
  sourceDecision: FlywheelVarianceDecision;
  sourceVarianceAmount: number;
  sourceExecutedAmount: number;
  residualAmount: number;
}

export interface FlywheelResidualRemediationItem {
  id: string;
  remediationPlanId: string;
  sourceExecutionItemId: string;
  sourceDecision: FlywheelVarianceDecision;
  sourceVarianceAmount: number;
  sourceExecutedAmount: number;
  residualAmount: number;
  action: FlywheelResidualRemediationAction;
  targetDate: string;
  rationale: string;
  createdByUserId: string;
  createdAt: string;
}

export interface FlywheelResidualRemediationPlan {
  id: string;
  planNumber: string;
  sourceExecutionCaseId: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceResidualAmount: number;
  sourcePositiveItemCount: number;
  coveredResidualAmount: number;
  recoveryFollowUpAmount: number;
  writeOffReviewAmount: number;
  investigationEscalationAmount: number;
  residualAcceptanceReviewAmount: number;
  itemCount: number;
  ownerUserId: string;
  ownerName: string;
  remediationObjective: string;
  status: FlywheelResidualRemediationPlanStatus;
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

export interface FlywheelResidualRemediationSnapshotSummary {
  id: string;
  snapshotNumber: string;
  remediationPlanId: string;
  planNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  sourceResidualAmount: number;
  recoveryFollowUpAmount: number;
  writeOffReviewAmount: number;
  investigationEscalationAmount: number;
  residualAcceptanceReviewAmount: number;
  itemCount: number;
  planStatus: FlywheelResidualRemediationPlanStatus;
  capturedByUserId: string;
  capturedAt: string;
  sealed: boolean;
}

export interface FlywheelResidualRemediationSnapshotItem {
  id: string;
  snapshotId: string;
  remediationItemId: string;
  sourceExecutionItemId: string;
  sourceDecision: FlywheelVarianceDecision;
  sourceVarianceAmount: number;
  sourceExecutedAmount: number;
  residualAmount: number;
  action: FlywheelResidualRemediationAction;
  targetDate: string;
  rationale: string;
}

export interface FlywheelResidualRemediationSnapshotDetail {
  snapshot: FlywheelResidualRemediationSnapshotSummary;
  items: FlywheelResidualRemediationSnapshotItem[];
}

export interface FlywheelResidualRemediationPlanDetail {
  plan: FlywheelResidualRemediationPlan;
  items: FlywheelResidualRemediationItem[];
  candidates: FlywheelResidualRemediationCandidate[];
  snapshots: FlywheelResidualRemediationSnapshotSummary[];
}

export interface FlywheelResidualRemediationSummary {
  totalPlans: number;
  draftPlans: number;
  inReviewPlans: number;
  approvedPlans: number;
  closedPlans: number;
  residualByCurrency: FlywheelResidualRemediationCurrencyTotal[];
}

export interface FlywheelResidualRemediationDashboard {
  summary: FlywheelResidualRemediationSummary;
  plans: FlywheelResidualRemediationPlan[];
  eligibleSources: FlywheelResidualRemediationSource[];
}

export interface FlywheelResidualRemediationPlanInput {
  sourceExecutionCaseId: string;
  title: string;
  remediationObjective: string;
}

export interface FlywheelResidualRemediationItemInput {
  sourceExecutionItemId: string;
  action: FlywheelResidualRemediationAction;
  targetDate: string;
  rationale: string;
}

export interface FlywheelResidualRemediationNoteInput {
  note: string;
}
