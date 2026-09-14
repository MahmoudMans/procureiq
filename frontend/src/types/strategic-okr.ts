export type StrategicObjectivePeriodType =
  | "ANNUAL"
  | "QUARTERLY";

export type StrategicObjectiveStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ON_HOLD"
  | "ACHIEVED"
  | "CLOSED"
  | "CANCELLED";

export type KeyResultMetricType =
  | "PERCENTAGE"
  | "COUNT"
  | "CURRENCY"
  | "HOURS"
  | "NUMBER";

export type KeyResultDirection =
  | "INCREASE"
  | "DECREASE";

export type OkrSourceScopeType =
  | "OVERALL"
  | "DOMAIN"
  | "OWNER"
  | "SEVERITY"
  | "EXCEPTION_TYPE";

export type KeyResultSourceType =
  | "MANUAL"
  | "OPERATING_RHYTHM_SLA_ATTAINMENT"
  | "OPERATING_RHYTHM_ACTIVE_BACKLOG"
  | "OPERATING_RHYTHM_SLA_OVERDUE"
  | "OPERATING_RHYTHM_PERSISTENT_BACKLOG"
  | "OPERATING_RHYTHM_AVG_RESOLUTION_HOURS"
  | "OPERATING_RHYTHM_ACTIVE_EXPOSURE"
  | "CONTINUOUS_IMPROVEMENT_ACTIVE_INITIATIVES"
  | "CONTINUOUS_IMPROVEMENT_COMPLETED_INITIATIVES"
  | "CONTINUOUS_IMPROVEMENT_IMPROVED_INITIATIVES"
  | "CONTINUOUS_IMPROVEMENT_COMPLETION_RATE";

export type StrategicHealth =
  | "ACHIEVED"
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK";

export interface OkrUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface OkrOperatingScopeOption {
  scopeType: OkrSourceScopeType;
  scopeKey: string;
  scopeLabel: string;
}

export interface OkrImprovementOption {
  id: string;
  initiativeNumber: string;
  title: string;
  status: string;
}

export interface OkrContext {
  users: OkrUserOption[];
  operatingScopes: OkrOperatingScopeOption[];
  improvementInitiatives: OkrImprovementOption[];
}

export interface OkrContribution {
  id: string;
  improvementInitiativeId: string;
  initiativeNumber: string;
  initiativeTitle: string;
  initiativeStatus: string;
  contributionWeightPct: number;
  rationale: string;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description: string | null;
  metricType: KeyResultMetricType;
  direction: KeyResultDirection;
  sourceType: KeyResultSourceType;
  sourceScopeType: OkrSourceScopeType | null;
  sourceScopeKey: string | null;
  baselineValue: number;
  targetValue: number;
  actualValue: number;
  weightPct: number;
  progressPct: number;
  health: StrategicHealth;
  confidencePct: number;
  sourceObservedAt: string | null;
  actualUpdatedAt: string | null;
  manualNote: string | null;
  status: string;
  contributions: OkrContribution[];
}

export interface StrategicObjectiveSummary {
  id: string;
  objectiveNumber: string;
  title: string;
  currency: string;
  periodType: StrategicObjectivePeriodType;
  fiscalYear: number;
  quarter: number | null;
  startDate: string;
  endDate: string;
  status: StrategicObjectiveStatus;
  ownerUserId: string;
  ownerName: string;
  keyResultCount: number;
  achievedKeyResultCount: number;
  weightCoveragePct: number;
  progressPct: number;
  health: StrategicHealth;
  confidencePct: number;
  snapshotCount: number;
  periodOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface OkrSnapshotSummary {
  id: string;
  snapshotNumber: string;
  objectiveId: string;
  overallProgressPct: number;
  overallHealth: StrategicHealth;
  overallConfidencePct: number;
  keyResultCount: number;
  achievedKeyResultCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface OkrSnapshotKeyResult {
  id: string;
  keyResultId: string;
  title: string;
  metricType: KeyResultMetricType;
  direction: KeyResultDirection;
  sourceType: KeyResultSourceType;
  sourceScopeType: OkrSourceScopeType | null;
  sourceScopeKey: string | null;
  baselineValue: number;
  targetValue: number;
  actualValue: number;
  weightPct: number;
  progressPct: number;
  health: StrategicHealth;
  confidencePct: number;
  sourceObservedAt: string | null;
  contributionCount: number;
}

export interface OkrSnapshotDetail {
  snapshot: OkrSnapshotSummary;
  objectiveNumber: string;
  objectiveTitle: string;
  currency: string;
  periodType: StrategicObjectivePeriodType;
  fiscalYear: number;
  quarter: number | null;
  objectiveStatus: string;
  keyResults: OkrSnapshotKeyResult[];
}

export interface StrategicObjectiveDetail {
  objective: StrategicObjectiveSummary;
  description: string;
  keyResults: KeyResult[];
  snapshots: OkrSnapshotSummary[];
}

export interface StrategicOkrDashboard {
  currency: string;
  fiscalYear: number;
  objectiveCount: number;
  activeObjectiveCount: number;
  achievedObjectiveCount: number;
  atRiskObjectiveCount: number;
  averageProgressPct: number;
  averageConfidencePct: number;
  objectives: StrategicObjectiveSummary[];
}
