import type {
  BoardDimensionKey,
} from "@/types/strategy-cockpit";

export type StrategyRoadmapStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "ARCHIVED";

export type RoadmapInitiativeStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type RoadmapPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type RoadmapDependencyType =
  | "FINISH_TO_START"
  | "START_TO_START"
  | "FINISH_TO_FINISH";

export type RoadmapMilestoneStatus =
  | "PLANNED"
  | "COMPLETED"
  | "CANCELLED";

export type RoadmapGateStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WAIVED";

export type RoadmapReadinessHealth =
  | "UNDEFINED"
  | "READY"
  | "WATCH"
  | "AT_RISK"
  | "BLOCKED";

export interface RoadmapDependency {
  id: string;
  predecessorInitiativeId: string;
  predecessorNumber: string;
  predecessorTitle: string;
  predecessorStatus: RoadmapInitiativeStatus;
  successorInitiativeId: string;
  successorNumber: string;
  successorTitle: string;
  successorStatus: RoadmapInitiativeStatus;
  dependencyType: RoadmapDependencyType;
  rationale: string | null;
  satisfied: boolean;
}

export interface RoadmapMilestone {
  id: string;
  initiativeId: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: RoadmapMilestoneStatus;
  overdue: boolean;
}

export interface RoadmapGate {
  id: string;
  initiativeId: string;
  gateName: string;
  dueDate: string;
  status: RoadmapGateStatus;
  overdue: boolean;
  decisionNote: string | null;
  decidedByName: string | null;
}

export interface RoadmapInitiative {
  id: string;
  initiativeNumber: string;
  title: string;
  description: string | null;
  dimensionKey: BoardDimensionKey;
  priority: RoadmapPriority;
  ownerUserId: string | null;
  ownerName: string;
  ownerRole: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedContributionPoints: number;
  status: RoadmapInitiativeStatus;
  blockedDependencyCount: number;
  overdueMilestoneCount: number;
  pendingGateCount: number;
  rejectedGateCount: number;
  blocked: boolean;
}

export interface StrategyRoadmapSummary {
  id: string;
  roadmapNumber: string;
  sourceScenarioId: string;
  sourceScenarioNumber: string;
  sourceScenarioName: string;
  currency: string;
  fiscalYear: number;
  title: string;
  objective: string;
  startDate: string;
  targetEndDate: string;
  status: StrategyRoadmapStatus;
  scenarioBaselineScore: number;
  scenarioSimulatedScore: number;
  scenarioDelta: number;
  initiativeCount: number;
  completedInitiativeCount: number;
  blockedInitiativeCount: number;
  overdueMilestoneCount: number;
  rejectedGateCount: number;
  ownerCoveragePct: number;
  dependencyHealthPct: number;
  milestoneHealthPct: number;
  gateHealthPct: number;
  readinessScore: number;
  readinessHealth: RoadmapReadinessHealth;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StrategyRoadmapSnapshotSummary {
  id: string;
  snapshotNumber: string;
  roadmapId: string;
  roadmapNumber: string;
  roadmapTitle: string;
  roadmapStatus: StrategyRoadmapStatus;
  readinessScore: number;
  readinessHealth: RoadmapReadinessHealth;
  initiativeCount: number;
  blockedInitiativeCount: number;
  overdueMilestoneCount: number;
  rejectedGateCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface StrategyRoadmapSnapshotDetail {
  snapshot: StrategyRoadmapSnapshotSummary;
  roadmap: StrategyRoadmapSummary;
  initiatives: RoadmapInitiative[];
}

export interface StrategyRoadmapDetail {
  roadmap: StrategyRoadmapSummary;
  users: Array<{
    id: string;
    fullName: string;
    role: string;
  }>;
  initiatives: RoadmapInitiative[];
  dependencies: RoadmapDependency[];
  milestones: RoadmapMilestone[];
  gates: RoadmapGate[];
  snapshots: StrategyRoadmapSnapshotSummary[];
}

export interface StrategyRoadmapDashboard {
  roadmaps: StrategyRoadmapSummary[];
}
