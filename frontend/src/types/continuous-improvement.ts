export type ImprovementInitiativeStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type ImprovementActionStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type ImprovementOutcome =
  | "IMPROVED"
  | "MIXED"
  | "NO_CHANGE"
  | "REGRESSED";

export type ImprovementScopeType =
  | "OVERALL"
  | "DOMAIN"
  | "OWNER"
  | "SEVERITY"
  | "EXCEPTION_TYPE";

export type ImprovementPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface ImprovementMetricVector {
  activeCount: number;
  slaOverdueCount: number;
  persistentCount: number;
  resolvedCount: number;
  slaAttainmentPct: number;
  avgResolutionHours: number;
  avgActiveAgeDays: number;
  activeExposure: number;
  workloadSharePct: number;
}

export interface ImprovementSnapshotOption {
  id: string;
  snapshotNumber: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  capturedAt: string;
}

export interface ImprovementUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface ImprovementDimensionOption {
  scopeType: ImprovementScopeType;
  scopeKey: string;
  scopeLabel: string;
  activeCount: number;
  slaOverdueCount: number;
  persistentCount: number;
  resolvedCount: number;
  slaAttainmentPct: number;
  avgResolutionHours: number;
  avgActiveAgeDays: number;
  activeExposure: number;
  workloadSharePct: number;
}

export interface ImprovementContext {
  snapshots: ImprovementSnapshotOption[];
  selectedSnapshot: ImprovementSnapshotOption | null;
  dimensions: ImprovementDimensionOption[];
  users: ImprovementUserOption[];
}

export interface ImprovementOpportunity {
  snapshotId: string;
  snapshotNumber: string;
  scopeType: ImprovementScopeType;
  scopeKey: string;
  scopeLabel: string;
  opportunityScore: number;
  priority: ImprovementPriority;
  activeCount: number;
  slaOverdueCount: number;
  persistentCount: number;
  resolvedCount: number;
  slaAttainmentPct: number;
  avgResolutionHours: number;
  avgActiveAgeDays: number;
  activeExposure: number;
  workloadSharePct: number;
  rationale: string;
}

export interface ImprovementCheckpoint {
  id: string;
  snapshotId: string;
  snapshotNumber: string;
  currentActiveCount: number;
  currentSlaOverdueCount: number;
  currentPersistentCount: number;
  currentResolvedCount: number;
  currentSlaAttainmentPct: number;
  currentAvgResolutionHours: number;
  currentAvgActiveAgeDays: number;
  currentActiveExposure: number;
  slaAttainmentDelta: number;
  slaOverdueReductionPct: number;
  persistentReductionPct: number;
  resolutionHoursReductionPct: number;
  exposureReductionPct: number;
  targetsMetCount: number;
  achievementScore: number;
  outcome: ImprovementOutcome;
  capturedByName: string;
  capturedAt: string;
}

export interface ImprovementAction {
  id: string;
  initiativeId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  status: ImprovementActionStatus;
  dueDate: string;
  overdue: boolean;
  completionNote: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ImprovementInitiativeSummary {
  id: string;
  initiativeNumber: string;
  title: string;
  currency: string;
  priority: ImprovementPriority;
  status: ImprovementInitiativeStatus;
  ownerUserId: string;
  ownerName: string;
  sourceSnapshotId: string;
  sourceSnapshotNumber: string;
  scopeType: ImprovementScopeType;
  scopeKey: string;
  scopeLabel: string;
  targetDate: string;
  targetOverdue: boolean;
  openActions: number;
  overdueActions: number;
  checkpointCount: number;
  latestOutcome: ImprovementOutcome | null;
  latestAchievementScore: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ImprovementInitiativeDetail {
  initiative: ImprovementInitiativeSummary;
  description: string;
  notes: string | null;
  baseline: ImprovementMetricVector;
  targetSlaAttainmentPct: number;
  targetSlaOverdueReductionPct: number;
  targetPersistentReductionPct: number;
  targetResolutionHoursReductionPct: number;
  targetExposureReductionPct: number;
  actions: ImprovementAction[];
  checkpoints: ImprovementCheckpoint[];
}

export interface ContinuousImprovementDashboard {
  currency: string;
  latestSnapshot: ImprovementSnapshotOption | null;
  opportunities: ImprovementOpportunity[];
  initiatives: ImprovementInitiativeSummary[];
}
