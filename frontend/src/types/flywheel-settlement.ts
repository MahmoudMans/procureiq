import type {
  FlywheelReleaseBatchStatus,
} from "@/types/flywheel-release";

export type FlywheelSettlementCaseStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "RECONCILED"
  | "CLOSED";

export type FlywheelSettlementItemStatus =
  | "SETTLED"
  | "PARTIAL"
  | "UNRESOLVED";

export interface FlywheelSettlementUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface FlywheelSettlementReleaseAuthority {
  releaseBatchId: string;
  releaseNumber: string;

  allocationMandateId: string;
  allocationMandateNumber: string;

  strategyPortfolioId: string;
  strategyPortfolioNumber: string;

  title: string;

  currency: string;
  fiscalYear: number;

  releasedAmount: number;
  releasedItemCount: number;

  releaseOwnerName: string;
  releaseRationale: string;

  status: FlywheelReleaseBatchStatus;
}

export interface FlywheelSettlementCandidateItem {
  releaseItemId: string;
  allocationItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceReleasedAmount: number;

  executionReference: string | null;
}

export interface FlywheelSettlementItem {
  id: string;
  settlementCaseId: string;

  releaseItemId: string;
  allocationItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceReleasedAmount: number;
  settledAmount: number;
  varianceAmount: number;

  reconciliationStatus:
    FlywheelSettlementItemStatus;

  evidenceReference: string | null;
  evidenceDate: string;
  evidenceNote: string;

  addedByName: string;
  addedAt: string;
}

export interface FlywheelSettlementCase {
  id: string;
  reconciliationNumber: string;

  releaseBatchId: string;
  releaseNumber: string;

  allocationMandateId: string;
  allocationMandateNumber: string;

  strategyPortfolioId: string;
  strategyPortfolioNumber: string;

  title: string;

  currency: string;
  fiscalYear: number;

  sourceReleasedAmount: number;
  settledAmount: number;
  varianceAmount: number;
  settlementPct: number;

  itemCount: number;
  settledCount: number;
  partialCount: number;
  unresolvedCount: number;

  reconciliationOwnerUserId: string;
  reconciliationOwnerName: string;

  reconciliationRationale: string;

  status: FlywheelSettlementCaseStatus;

  submittedByName: string | null;
  submittedAt: string | null;

  reconciliationNote: string | null;
  reconciledByName: string | null;
  reconciledAt: string | null;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;

  version: number;
}

export interface FlywheelSettlementSnapshotSummary {
  id: string;
  snapshotNumber: string;

  settlementCaseId: string;
  reconciliationNumber: string;

  releaseBatchId: string;
  releaseNumber: string;

  caseStatus: FlywheelSettlementCaseStatus;

  currency: string;
  fiscalYear: number;

  sourceReleasedAmount: number;
  settledAmount: number;
  varianceAmount: number;
  settlementPct: number;

  itemCount: number;
  settledCount: number;
  partialCount: number;
  unresolvedCount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface FlywheelSettlementSnapshotItem {
  releaseItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceReleasedAmount: number;
  settledAmount: number;
  varianceAmount: number;

  reconciliationStatus:
    FlywheelSettlementItemStatus;

  evidenceReference: string | null;
  evidenceDate: string;
  evidenceNote: string;
}

export interface FlywheelSettlementSnapshotDetail {
  snapshot:
    FlywheelSettlementSnapshotSummary;

  items:
    FlywheelSettlementSnapshotItem[];
}

export interface FlywheelSettlementCaseDetail {
  settlementCase:
    FlywheelSettlementCase;

  releaseAuthority:
    FlywheelSettlementReleaseAuthority;

  users:
    FlywheelSettlementUserOption[];

  candidates:
    FlywheelSettlementCandidateItem[];

  items:
    FlywheelSettlementItem[];

  snapshots:
    FlywheelSettlementSnapshotSummary[];
}

export interface FlywheelSettlementSummary {
  eligibleReleaseCount: number;

  caseCount: number;
  draftCaseCount: number;
  reviewCaseCount: number;
  reconciledCaseCount: number;
  closedCaseCount: number;

  reconciledSettledByCurrency: {
    currency: string;
    amount: number;
  }[];

  reconciledVarianceByCurrency: {
    currency: string;
    amount: number;
  }[];
}

export interface FlywheelSettlementDashboard {
  summary:
    FlywheelSettlementSummary;

  users:
    FlywheelSettlementUserOption[];

  releases:
    FlywheelSettlementReleaseAuthority[];

  cases:
    FlywheelSettlementCase[];

  snapshots:
    FlywheelSettlementSnapshotSummary[];
}
