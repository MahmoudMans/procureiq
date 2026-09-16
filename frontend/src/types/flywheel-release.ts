import type {
  FlywheelAllocationMandateStatus,
} from "@/types/flywheel-allocation";

export type FlywheelReleaseBatchStatus =
  | "DRAFT"
  | "IN_EXECUTION"
  | "EXECUTED"
  | "CLOSED";

export type FlywheelReleaseItemStatus =
  | "PENDING"
  | "RELEASED"
  | "CANCELLED";

export interface FlywheelReleaseUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface FlywheelReleaseMandateAuthority {
  allocationMandateId: string;
  allocationMandateNumber: string;

  strategyPortfolioId: string;
  strategyPortfolioNumber: string;

  title: string;

  currency: string;
  fiscalYear: number;

  authorizedAllocationAmount: number;
  cumulativeReleasedAmount: number;
  remainingReleaseAuthorityAmount: number;

  authorizedItemCount: number;

  mandateOwnerName: string;
  mandateRationale: string;

  status: FlywheelAllocationMandateStatus;
}

export interface FlywheelReleaseCandidateItem {
  allocationItemId: string;
  strategyItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  authorizedAllocationAmount: number;
  previouslyReleasedAmount: number;
  remainingReleaseAuthorityAmount: number;

  strategyPriorityScore: number;
}

export interface FlywheelReleaseItem {
  id: string;
  releaseBatchId: string;

  allocationItemId: string;
  strategyItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  mandateAuthorizedItemAmount: number;
  strategyPriorityScore: number;

  plannedReleaseAmount: number;

  status: FlywheelReleaseItemStatus;

  executionReference: string | null;
  executionNote: string | null;

  releasedByName: string | null;
  releasedAt: string | null;

  cancellationNote: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;

  addedByName: string;
  addedAt: string;
}

export interface FlywheelReleaseBatch {
  id: string;
  releaseNumber: string;

  allocationMandateId: string;
  allocationMandateNumber: string;

  strategyPortfolioId: string;
  strategyPortfolioNumber: string;

  title: string;

  currency: string;
  fiscalYear: number;

  mandateAuthorizedAmount: number;

  batchPlannedReleaseAmount: number;
  batchReleasedAmount: number;

  cumulativeMandateReleasedAmount: number;
  remainingMandateAmount: number;
  cumulativeReleaseUtilizationPct: number;

  itemCount: number;
  pendingCount: number;
  releasedCount: number;
  cancelledCount: number;

  releaseOwnerUserId: string;
  releaseOwnerName: string;

  releaseRationale: string;

  status: FlywheelReleaseBatchStatus;

  submittedByName: string | null;
  submittedAt: string | null;

  executionNote: string | null;
  executedByName: string | null;
  executedAt: string | null;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;

  version: number;
}

export interface FlywheelReleaseSnapshotSummary {
  id: string;
  snapshotNumber: string;

  releaseBatchId: string;
  releaseNumber: string;

  allocationMandateId: string;
  allocationMandateNumber: string;

  releaseStatus: FlywheelReleaseBatchStatus;

  currency: string;
  fiscalYear: number;

  mandateAuthorizedAmount: number;

  batchPlannedReleaseAmount: number;
  batchReleasedAmount: number;

  cumulativeMandateReleasedAmount: number;
  remainingMandateAmount: number;
  cumulativeReleaseUtilizationPct: number;

  itemCount: number;
  pendingCount: number;
  releasedCount: number;
  cancelledCount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface FlywheelReleaseSnapshotItem {
  allocationItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  mandateAuthorizedItemAmount: number;
  plannedReleaseAmount: number;

  releaseItemStatus:
    FlywheelReleaseItemStatus;

  executionReference: string | null;
  executionNote: string | null;
  cancellationNote: string | null;
}

export interface FlywheelReleaseSnapshotDetail {
  snapshot:
    FlywheelReleaseSnapshotSummary;

  items:
    FlywheelReleaseSnapshotItem[];
}

export interface FlywheelReleaseBatchDetail {
  batch: FlywheelReleaseBatch;

  mandateAuthority:
    FlywheelReleaseMandateAuthority;

  users:
    FlywheelReleaseUserOption[];

  candidates:
    FlywheelReleaseCandidateItem[];

  items:
    FlywheelReleaseItem[];

  snapshots:
    FlywheelReleaseSnapshotSummary[];
}

export interface FlywheelReleaseSummary {
  eligibleMandateCount: number;

  batchCount: number;
  draftBatchCount: number;
  executionBatchCount: number;
  executedBatchCount: number;
  closedBatchCount: number;

  cumulativeReleasedAmount: number;
}

export interface FlywheelReleaseDashboard {
  summary: FlywheelReleaseSummary;

  users:
    FlywheelReleaseUserOption[];

  mandates:
    FlywheelReleaseMandateAuthority[];

  batches:
    FlywheelReleaseBatch[];

  snapshots:
    FlywheelReleaseSnapshotSummary[];
}
