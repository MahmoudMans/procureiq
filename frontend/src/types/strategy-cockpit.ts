export type BoardDimensionKey =
  | "OBJECTIVE_EXECUTION"
  | "STRATEGIC_ALIGNMENT"
  | "CAPACITY_READINESS"
  | "CAPABILITY_READINESS"
  | "SUCCESSION_RESILIENCE";

export type BoardHealth =
  | "EXCELLENT"
  | "STRONG"
  | "WATCH"
  | "CRITICAL";

export type BoardMovement =
  | "BASELINE"
  | "IMPROVING"
  | "STABLE"
  | "DETERIORATING";

export type BoardExceptionSeverity =
  | "INFO"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type BoardExceptionType =
  | "OBJECTIVE_OFF_TRACK"
  | "UNALIGNED_STRATEGIC_WORK"
  | "STRATEGIC_DEADLINE_CONFLICT"
  | "CAPACITY_GAP"
  | "CAPACITY_OVERLOAD"
  | "CAPACITY_DEADLINE_PRESSURE"
  | "CAPABILITY_CRITICAL_GAP"
  | "CAPABILITY_REQUIREMENT_GAP"
  | "SUCCESSION_SINGLE_POINT_FAILURE"
  | "SUCCESSION_CRITICAL_EXPOSURE"
  | "MISSING_OBJECTIVES"
  | "MISSING_CAPACITY_PROFILE"
  | "MISSING_SUCCESSION_POLICY";

export interface BoardDimension {
  key: BoardDimensionKey;
  label: string;
  weightPct: number;
  score: number;
  weightedContribution: number;
  health: BoardHealth;
  previousScore: number | null;
  scoreDelta: number;
  sourceDetail: string;
}

export interface BoardException {
  stableKey: string;
  type: BoardExceptionType;
  severity: BoardExceptionSeverity;
  title: string;
  detail: string;
  occurrenceCount: number;
  metricValue: number;
  sourceRoute: string;
}

export interface BoardScorecardSummary {
  currency: string;
  fiscalYear: number;
  objectiveExecutionScore: number;
  strategicAlignmentScore: number;
  capacityScore: number;
  capabilityScore: number;
  successionScore: number;
  overallScore: number;
  overallHealth: BoardHealth;
  previousOverallScore: number | null;
  scoreDelta: number;
  movement: BoardMovement;
  strategicObjectiveCount: number;
  offTrackObjectiveCount: number;
  unalignedWorkCount: number;
  overloadedMemberCount: number;
  criticalCapabilityGapCount: number;
  successionSpofCount: number;
  exceptionCount: number;
  criticalExceptionCount: number;
  generatedSummary: string;
}

export interface BoardSnapshotSummary {
  id: string;
  snapshotNumber: string;
  currency: string;
  fiscalYear: number;
  overallScore: number;
  overallHealth: BoardHealth;
  scoreDelta: number;
  movement: BoardMovement;
  exceptionCount: number;
  criticalExceptionCount: number;
  boardCommentary: string | null;
  capturedByName: string;
  capturedAt: string;
}

export interface BoardSnapshotDetail {
  snapshot: BoardSnapshotSummary;
  summary: BoardScorecardSummary;
  dimensions: BoardDimension[];
  exceptions: BoardException[];
}

export interface StrategyCockpitDashboard {
  current: BoardScorecardSummary;
  dimensions: BoardDimension[];
  exceptions: BoardException[];
  snapshots: BoardSnapshotSummary[];
}
