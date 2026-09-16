import type {
  FlywheelStrategyAdvisory,
  FlywheelStrategyPortfolioStatus,
} from "@/types/flywheel-strategy";

export type FlywheelAllocationMandateStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "AUTHORIZED"
  | "CLOSED";

export interface FlywheelAllocationUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface FlywheelAllocationStrategy {
  strategyPortfolioId: string;
  strategyPortfolioNumber: string;
  title: string;

  currency: string;
  fiscalYear: number;

  capitalCapacityAmount: number;
  prioritizedCapacityAmount: number;
  remainingCapacityAmount: number;
  capacityUtilizationPct: number;
  averagePriorityScore: number;

  prioritizedItemCount: number;

  strategyOwnerName: string;
  strategicObjective: string;

  status: FlywheelStrategyPortfolioStatus;
}

export interface FlywheelAllocationCandidateItem {
  strategyItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  strategyProposedCapacityAmount: number;
  strategyPriorityScore: number;

  strategyAdvisoryRecommendation:
    FlywheelStrategyAdvisory;
}

export interface FlywheelAllocationItem {
  id: string;
  mandateId: string;

  strategyItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  strategyProposedCapacityAmount: number;
  strategyPriorityScore: number;

  strategyAdvisoryRecommendation:
    FlywheelStrategyAdvisory;

  requestedAllocationAmount: number;

  addedByName: string;
  addedAt: string;
}

export interface FlywheelAllocationMandate {
  id: string;
  mandateNumber: string;

  strategyPortfolioId: string;
  strategyPortfolioNumber: string;

  title: string;

  currency: string;
  fiscalYear: number;

  strategyCapitalCapacityAmount: number;
  strategyPrioritizedCapacityAmount: number;

  requestedAllocationAmount: number;
  remainingStrategyCapacityAmount: number;
  allocationUtilizationPct: number;

  itemCount: number;

  mandateOwnerUserId: string;
  mandateOwnerName: string;

  mandateRationale: string;

  status: FlywheelAllocationMandateStatus;

  submittedByName: string | null;
  submittedAt: string | null;

  authorizationNote: string | null;
  authorizedByName: string | null;
  authorizedAt: string | null;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;

  createdAt: string;
  updatedAt: string;

  version: number;
}

export interface FlywheelAllocationSnapshotSummary {
  id: string;
  snapshotNumber: string;

  mandateId: string;
  mandateNumber: string;

  strategyPortfolioId: string;
  strategyPortfolioNumber: string;

  mandateStatus:
    FlywheelAllocationMandateStatus;

  currency: string;
  fiscalYear: number;

  strategyPrioritizedCapacityAmount: number;
  requestedAllocationAmount: number;
  remainingStrategyCapacityAmount: number;
  allocationUtilizationPct: number;

  itemCount: number;

  capturedByName: string;
  capturedAt: string;
}

export interface FlywheelAllocationSnapshotItem {
  strategyItemId: string;

  flywheelLineageId: string;
  lineageNumber: string;

  rootTargetInitiativeTitle: string;

  strategyProposedCapacityAmount: number;
  strategyPriorityScore: number;

  requestedAllocationAmount: number;
}

export interface FlywheelAllocationSnapshotDetail {
  snapshot:
    FlywheelAllocationSnapshotSummary;

  items:
    FlywheelAllocationSnapshotItem[];
}

export interface FlywheelAllocationMandateDetail {
  mandate: FlywheelAllocationMandate;

  strategyAuthority:
    FlywheelAllocationStrategy;

  users:
    FlywheelAllocationUserOption[];

  candidates:
    FlywheelAllocationCandidateItem[];

  items:
    FlywheelAllocationItem[];

  snapshots:
    FlywheelAllocationSnapshotSummary[];
}

export interface FlywheelAllocationSummary {
  eligibleStrategyCount: number;
  mandateCount: number;
  draftMandateCount: number;
  reviewMandateCount: number;
  authorizedMandateCount: number;
  closedMandateCount: number;

  authorizedAllocationByCurrency: { currency: string; amount: number }[];
}

export interface FlywheelAllocationDashboard {
  summary:
    FlywheelAllocationSummary;

  users:
    FlywheelAllocationUserOption[];

  strategies:
    FlywheelAllocationStrategy[];

  mandates:
    FlywheelAllocationMandate[];

  snapshots:
    FlywheelAllocationSnapshotSummary[];
}
