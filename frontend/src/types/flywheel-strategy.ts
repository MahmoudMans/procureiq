import type {
  CapitalFlywheelHealth,
  CapitalFlywheelRecommendation,
  CapitalFlywheelStatus,
} from "@/types/capital-flywheel";

export type FlywheelStrategyPortfolioStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "CLOSED";

export type FlywheelStrategyDecision =
  | "PENDING"
  | "PRIORITIZE"
  | "HOLD"
  | "EXIT";

export type FlywheelStrategyAdvisory =
  | "PRIORITIZE"
  | "HOLD"
  | "EXIT";

export interface FlywheelStrategyUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface FlywheelStrategyCandidate {
  flywheelLineageId: string;
  lineageNumber: string;

  lineageStatus: CapitalFlywheelStatus;

  rootTargetValueCaseId: string;
  rootTargetValueCaseNumber: string;
  rootTargetInitiativeTitle: string;

  currency: string;
  rootFiscalYear: number;

  cycleCount: number;

  lineageOriginalCapitalAmount: number;
  referenceNextCycleCapitalAmount: number;

  cumulativeProjectedNetValueAmount: number;
  cumulativeCompoundingValueAmount: number;
  cumulativeDecayedValueAmount: number;

  cumulativeValueMultiple: number;
  latestMarginalValueMultiple: number;
  latestMarginalNetValueRetentionPct: number;

  diminishingReturns: boolean;

  flywheelHealth: CapitalFlywheelHealth;
  step66Recommendation: CapitalFlywheelRecommendation;

  priorityScore: number;
  advisoryRecommendation: FlywheelStrategyAdvisory;
}

export interface FlywheelStrategyItem {
  id: string;
  portfolioId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetValueCaseId: string;
  rootTargetValueCaseNumber: string;
  rootTargetInitiativeTitle: string;

  lineageRootFiscalYear: number;
  lineageCycleCount: number;

  lineageOriginalCapitalAmount: number;
  referenceNextCycleCapitalAmount: number;
  proposedCapacityAmount: number;

  cumulativeProjectedNetValueAmount: number;
  cumulativeCompoundingValueAmount: number;
  cumulativeDecayedValueAmount: number;

  cumulativeValueMultiple: number;
  latestMarginalValueMultiple: number;
  latestMarginalNetValueRetentionPct: number;

  diminishingReturns: boolean;

  flywheelHealth: CapitalFlywheelHealth;
  step66Recommendation: CapitalFlywheelRecommendation;

  priorityScore: number;
  advisoryRecommendation: FlywheelStrategyAdvisory;

  decision: FlywheelStrategyDecision;

  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;

  addedByName: string;
  addedAt: string;
}

export interface FlywheelStrategyPortfolio {
  id: string;
  portfolioNumber: string;
  title: string;

  currency: string;
  fiscalYear: number;

  capitalCapacityAmount: number;
  prioritizedCapacityAmount: number;
  remainingCapacityAmount: number;
  capacityUtilizationPct: number;
  averagePriorityScore: number;

  portfolioOwnerUserId: string;
  portfolioOwnerName: string;
  strategicObjective: string;

  status: FlywheelStrategyPortfolioStatus;

  itemCount: number;
  prioritizeCount: number;
  holdCount: number;
  exitCount: number;
  pendingCount: number;

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

export interface FlywheelStrategySnapshotSummary {
  id: string;
  snapshotNumber: string;

  portfolioId: string;
  portfolioNumber: string;

  currency: string;
  fiscalYear: number;

  portfolioStatus: FlywheelStrategyPortfolioStatus;

  capitalCapacityAmount: number;

  itemCount: number;
  prioritizeCount: number;
  holdCount: number;
  exitCount: number;
  pendingCount: number;

  prioritizedCapacityAmount: number;
  remainingCapacityAmount: number;
  capacityUtilizationPct: number;
  averagePriorityScore: number;

  capturedByName: string;
  capturedAt: string;
}

export interface FlywheelStrategySnapshotItem {
  flywheelLineageId: string;
  lineageNumber: string;
  rootTargetInitiativeTitle: string;

  proposedCapacityAmount: number;
  cumulativeProjectedNetValueAmount: number;

  cumulativeValueMultiple: number;
  latestMarginalValueMultiple: number;
  latestMarginalNetValueRetentionPct: number;

  diminishingReturns: boolean;

  flywheelHealth: CapitalFlywheelHealth;
  step66Recommendation: CapitalFlywheelRecommendation;

  priorityScore: number;
  advisoryRecommendation: FlywheelStrategyAdvisory;

  decision: FlywheelStrategyDecision;
  decisionNote: string | null;
}

export interface FlywheelStrategySnapshotDetail {
  snapshot: FlywheelStrategySnapshotSummary;
  items: FlywheelStrategySnapshotItem[];
}

export interface FlywheelStrategyPortfolioDetail {
  portfolio: FlywheelStrategyPortfolio;
  users: FlywheelStrategyUserOption[];
  candidates: FlywheelStrategyCandidate[];
  items: FlywheelStrategyItem[];
  snapshots: FlywheelStrategySnapshotSummary[];
}

export interface FlywheelStrategySummary {
  candidateCount: number;
  portfolioCount: number;
  draftPortfolioCount: number;
  reviewPortfolioCount: number;
  approvedPortfolioCount: number;
  closedPortfolioCount: number;
  prioritizedLineageCount: number;
  holdLineageCount: number;
  exitLineageCount: number;
}

export interface FlywheelStrategyDashboard {
  summary: FlywheelStrategySummary;
  users: FlywheelStrategyUserOption[];
  candidates: FlywheelStrategyCandidate[];
  portfolios: FlywheelStrategyPortfolio[];
  snapshots: FlywheelStrategySnapshotSummary[];
}
