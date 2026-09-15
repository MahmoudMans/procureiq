import type {
  StrategicValueHealth,
} from "@/types/strategic-value";

export type CapitalAllocationCycleStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type CapitalAllocationDecision =
  | "PENDING"
  | "FUND"
  | "DEFER"
  | "REJECT";

export interface CapitalAllocationCandidate {
  valueCaseId: string;
  caseNumber: string;
  persistencePlanNumber: string;
  commitmentNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  valueOwnerName: string;
  currency: string;
  fiscalYear: number;
  investmentCostAmount: number;
  durableHorizonValueAmount: number;
  netValueAmount: number;
  roiPct: number;
  paybackMonths: number | null;
  persistencePct: number;
  valueHealth: StrategicValueHealth;
  priorityScore: number;
  recommendation: CapitalAllocationDecision;
}

export interface CapitalAllocationItem {
  id: string;
  cycleId: string;
  valueCaseId: string;
  caseNumber: string;
  persistencePlanNumber: string;
  commitmentNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  valueOwnerName: string;
  currency: string;
  fiscalYear: number;
  requestedCapitalAmount: number;
  investmentCostSnapshot: number;
  durableHorizonValueSnapshot: number;
  netValueSnapshot: number;
  roiPctSnapshot: number;
  paybackMonthsSnapshot: number | null;
  persistencePctSnapshot: number;
  valueHealthSnapshot: StrategicValueHealth;
  priorityScore: number;
  recommendation: CapitalAllocationDecision;
  decision: CapitalAllocationDecision;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface CapitalAllocationCycle {
  id: string;
  cycleNumber: string;
  title: string;
  currency: string;
  fiscalYear: number;
  budgetAmount: number;
  objective: string;
  status: CapitalAllocationCycleStatus;

  fundedAmount: number;
  remainingBudgetAmount: number;
  budgetUtilizationPct: number;
  fundedNetValueAmount: number;
  opportunityCostAmount: number;
  averagePriorityScore: number;

  itemCount: number;
  fundedItemCount: number;
  deferredItemCount: number;
  rejectedItemCount: number;
  pendingItemCount: number;

  approvedByName: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  closeNote: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CapitalAllocationCycleDetail {
  cycle: CapitalAllocationCycle;
  candidates: CapitalAllocationCandidate[];
  items: CapitalAllocationItem[];
}

export interface CapitalAllocationDashboardSummary {
  candidateCount: number;
  cycleCount: number;
  draftCycleCount: number;
  inReviewCycleCount: number;
  approvedCycleCount: number;
  closedCycleCount: number;
}

export interface CapitalAllocationSnapshotSummary {
  id: string;
  snapshotNumber: string;
  cycleId: string;
  cycleNumber: string;
  cycleTitle: string;
  currency: string;
  fiscalYear: number;
  cycleStatus: CapitalAllocationCycleStatus;
  budgetAmount: number;
  fundedAmount: number;
  remainingBudgetAmount: number;
  budgetUtilizationPct: number;
  fundedNetValueAmount: number;
  opportunityCostAmount: number;
  averagePriorityScore: number;
  itemCount: number;
  fundedItemCount: number;
  deferredItemCount: number;
  rejectedItemCount: number;
  pendingItemCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface CapitalAllocationSnapshotItem {
  allocationItemId: string;
  caseNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  requestedCapitalAmount: number;
  durableHorizonValueAmount: number;
  netValueAmount: number;
  roiPct: number;
  paybackMonths: number | null;
  persistencePct: number;
  valueHealth: StrategicValueHealth;
  priorityScore: number;
  recommendation: CapitalAllocationDecision;
  decision: CapitalAllocationDecision;
  decisionNote: string | null;
}

export interface CapitalAllocationSnapshotDetail {
  snapshot: CapitalAllocationSnapshotSummary;
  items: CapitalAllocationSnapshotItem[];
}

export interface CapitalAllocationDashboard {
  summary: CapitalAllocationDashboardSummary;
  candidates: CapitalAllocationCandidate[];
  cycles: CapitalAllocationCycle[];
  snapshots: CapitalAllocationSnapshotSummary[];
}
