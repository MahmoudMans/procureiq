import type {
  FlywheelSettlementCaseStatus,
  FlywheelSettlementItemStatus,
} from "@/types/flywheel-settlement";

export type FlywheelVariancePlanStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type FlywheelVarianceDecision =
  | "RECOVER"
  | "WRITE_OFF"
  | "INVESTIGATE";

export interface FlywheelVarianceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface FlywheelVarianceSource {
  settlementCaseId: string;
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

  partialCount: number;
  unresolvedCount: number;

  reconciliationOwnerName: string;
  reconciliationRationale: string;

  status: FlywheelSettlementCaseStatus;
}

export interface FlywheelVarianceCandidate {
  settlementItemId: string;

  releaseItemId: string;
  allocationItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceReleasedAmount: number;
  sourceSettledAmount: number;
  sourceVarianceAmount: number;

  sourceReconciliationStatus:
    FlywheelSettlementItemStatus;
}

export interface FlywheelVarianceItem {
  id: string;
  variancePlanId: string;

  settlementItemId: string;

  releaseItemId: string;
  allocationItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceReleasedAmount: number;
  sourceSettledAmount: number;
  sourceVarianceAmount: number;

  sourceReconciliationStatus:
    FlywheelSettlementItemStatus;

  decision:
    FlywheelVarianceDecision;

  decisionRationale: string;

  targetDate: string;

  addedByName: string;
  addedAt: string;
}

export interface FlywheelVariancePlan {
  id: string;
  planNumber: string;

  settlementCaseId: string;
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

  sourceVarianceAmount: number;

  governedAmount: number;
  recoverAmount: number;
  writeOffAmount: number;
  investigationAmount: number;
  coveragePct: number;

  itemCount: number;
  recoverCount: number;
  writeOffCount: number;
  investigationCount: number;

  planOwnerUserId: string;
  planOwnerName: string;

  resolutionObjective: string;

  status: FlywheelVariancePlanStatus;

  submittedByName: string | null;
  submittedAt: string | null;

  approvalNote: string | null;
  approvedByName: string | null;
  approvedAt: string | null;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;

  version: number;
}

export interface FlywheelVarianceSnapshotSummary {
  id: string;
  snapshotNumber: string;

  variancePlanId: string;
  planNumber: string;

  settlementCaseId: string;
  reconciliationNumber: string;

  planStatus: FlywheelVariancePlanStatus;

  currency: string;
  fiscalYear: number;

  sourceVarianceAmount: number;

  governedAmount: number;
  recoverAmount: number;
  writeOffAmount: number;
  investigationAmount: number;
  coveragePct: number;

  itemCount: number;
  recoverCount: number;
  writeOffCount: number;
  investigationCount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface FlywheelVarianceSnapshotItem {
  settlementItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceVarianceAmount: number;

  decision:
    FlywheelVarianceDecision;

  decisionRationale: string;

  targetDate: string;
}

export interface FlywheelVarianceSnapshotDetail {
  snapshot:
    FlywheelVarianceSnapshotSummary;

  items:
    FlywheelVarianceSnapshotItem[];
}

export interface FlywheelVariancePlanDetail {
  plan: FlywheelVariancePlan;

  sourceAuthority:
    FlywheelVarianceSource;

  users:
    FlywheelVarianceUserOption[];

  candidates:
    FlywheelVarianceCandidate[];

  items:
    FlywheelVarianceItem[];

  snapshots:
    FlywheelVarianceSnapshotSummary[];
}

export interface FlywheelVarianceSummary {
  eligibleSettlementCount: number;

  planCount: number;
  draftPlanCount: number;
  reviewPlanCount: number;
  approvedPlanCount: number;
  closedPlanCount: number;

  recoverByCurrency: {
    currency: string;
    amount: number;
  }[];

  writeOffByCurrency: {
    currency: string;
    amount: number;
  }[];

  investigationByCurrency: {
    currency: string;
    amount: number;
  }[];
}

export interface FlywheelVarianceDashboard {
  summary:
    FlywheelVarianceSummary;

  users:
    FlywheelVarianceUserOption[];

  settlements:
    FlywheelVarianceSource[];

  plans:
    FlywheelVariancePlan[];

  snapshots:
    FlywheelVarianceSnapshotSummary[];
}
