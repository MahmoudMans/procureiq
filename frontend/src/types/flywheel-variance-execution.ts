import type {
  FlywheelVarianceDecision,
  FlywheelVariancePlanStatus,
} from "@/types/flywheel-variance";

export type FlywheelVarianceExecutionCaseStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "VERIFIED"
  | "CLOSED";

export type FlywheelVarianceExecutionOutcome =
  | "COMPLETED"
  | "PARTIAL"
  | "UNRESOLVED";

export interface FlywheelVarianceExecutionUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface FlywheelVarianceExecutionSource {
  variancePlanId: string;
  variancePlanNumber: string;

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

  recoverAmount: number;
  writeOffAmount: number;
  investigationAmount: number;

  itemCount: number;

  planOwnerName: string;
  resolutionObjective: string;

  status: FlywheelVariancePlanStatus;
}

export interface FlywheelVarianceExecutionCandidate {
  varianceItemId: string;

  settlementItemId: string;

  releaseItemId: string;
  allocationItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceVarianceAmount: number;

  sourceDecision: FlywheelVarianceDecision;

  decisionRationale: string;

  targetDate: string;
}

export interface FlywheelVarianceExecutionItem {
  id: string;
  executionCaseId: string;

  varianceItemId: string;

  settlementItemId: string;

  releaseItemId: string;
  allocationItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceVarianceAmount: number;

  sourceDecision: FlywheelVarianceDecision;

  executedAmount: number;
  openExposureAmount: number;

  outcome: FlywheelVarianceExecutionOutcome;

  evidenceReference: string | null;
  evidenceDate: string;
  evidenceNote: string;

  addedByName: string;
  addedAt: string;
}

export interface FlywheelVarianceExecutionCase {
  id: string;
  executionNumber: string;

  variancePlanId: string;
  variancePlanNumber: string;

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

  sourceRecoverAmount: number;
  sourceWriteOffAmount: number;
  sourceInvestigationAmount: number;

  capturedVarianceAmount: number;
  executedFinancialAmount: number;

  recoveredAmount: number;
  writtenOffAmount: number;
  completedInvestigationAmount: number;

  openExposureAmount: number;
  completionPct: number;

  itemCount: number;
  completedCount: number;
  partialCount: number;
  unresolvedCount: number;

  executionOwnerUserId: string;
  executionOwnerName: string;

  executionObjective: string;

  status: FlywheelVarianceExecutionCaseStatus;

  submittedByName: string | null;
  submittedAt: string | null;

  verificationNote: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;

  version: number;
}

export interface FlywheelVarianceExecutionSnapshotSummary {
  id: string;
  snapshotNumber: string;

  executionCaseId: string;
  executionNumber: string;

  variancePlanId: string;
  variancePlanNumber: string;

  caseStatus: FlywheelVarianceExecutionCaseStatus;

  currency: string;
  fiscalYear: number;

  sourceVarianceAmount: number;

  capturedVarianceAmount: number;

  executedFinancialAmount: number;

  recoveredAmount: number;
  writtenOffAmount: number;
  completedInvestigationAmount: number;

  openExposureAmount: number;
  completionPct: number;

  itemCount: number;
  completedCount: number;
  partialCount: number;
  unresolvedCount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface FlywheelVarianceExecutionSnapshotItem {
  varianceItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  sourceVarianceAmount: number;

  sourceDecision: FlywheelVarianceDecision;

  executedAmount: number;

  outcome: FlywheelVarianceExecutionOutcome;

  evidenceReference: string | null;
  evidenceDate: string;
  evidenceNote: string;
}

export interface FlywheelVarianceExecutionSnapshotDetail {
  snapshot:
    FlywheelVarianceExecutionSnapshotSummary;

  items:
    FlywheelVarianceExecutionSnapshotItem[];
}

export interface FlywheelVarianceExecutionCaseDetail {
  executionCase:
    FlywheelVarianceExecutionCase;

  sourceAuthority:
    FlywheelVarianceExecutionSource;

  users:
    FlywheelVarianceExecutionUserOption[];

  candidates:
    FlywheelVarianceExecutionCandidate[];

  items:
    FlywheelVarianceExecutionItem[];

  snapshots:
    FlywheelVarianceExecutionSnapshotSummary[];
}

export interface FlywheelVarianceExecutionSummary {
  eligiblePlanCount: number;

  caseCount: number;
  draftCaseCount: number;
  reviewCaseCount: number;
  verifiedCaseCount: number;
  closedCaseCount: number;

  recoveredByCurrency: {
    currency: string;
    amount: number;
  }[];

  writtenOffByCurrency: {
    currency: string;
    amount: number;
  }[];

  completedInvestigationByCurrency: {
    currency: string;
    amount: number;
  }[];

  openExposureByCurrency: {
    currency: string;
    amount: number;
  }[];
}

export interface FlywheelVarianceExecutionDashboard {
  summary:
    FlywheelVarianceExecutionSummary;

  users:
    FlywheelVarianceExecutionUserOption[];

  plans:
    FlywheelVarianceExecutionSource[];

  cases:
    FlywheelVarianceExecutionCase[];

  snapshots:
    FlywheelVarianceExecutionSnapshotSummary[];
}
