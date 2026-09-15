export type CapacityHealth =
  | "HEALTHY"
  | "TIGHT"
  | "OVERLOADED"
  | "CRITICAL";

export type CapacityWorkStatus =
  | "UNESTIMATED"
  | "UNASSIGNED"
  | "PARTIAL"
  | "FULL";

export type CapacitySourceType =
  | "CATEGORY_INITIATIVE"
  | "IMPROVEMENT_INITIATIVE"
  | "EXECUTION_PORTFOLIO"
  | "RISK_ESCALATION";

export interface CapacityUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CapacityProfile {
  id: string;
  userId: string;
  userName: string;
  role: string;
  fiscalYear: number;
  annualCapacityHours: number;
  reservedOperationalPct: number;
  effectiveCapacityHours: number;
  notes: string | null;
  version: number;
}

export interface CapacityAssignment {
  id: string;
  workEstimateId: string;
  userId: string;
  userName: string;
  role: string;
  allocationPct: number;
  assignedEffortHours: number;
  createdByName: string;
  createdAt: string;
}

export interface CapacityMember {
  userId: string;
  userName: string;
  role: string;
  annualCapacityHours: number;
  reservedOperationalPct: number;
  effectiveCapacityHours: number;
  assignedEffortHours: number;
  remainingCapacityHours: number;
  overloadHours: number;
  utilizationPct: number;
  health: CapacityHealth;
}

export interface CapacityWorkItem {
  estimateId: string | null;
  sourceType: CapacitySourceType;
  sourceEntityId: string;
  sourceReference: string;
  sourceTitle: string;
  sourceStatus: string;
  dueDate: string | null;
  strategicValue: number;
  riskExposure: number;
  riskScore: number;
  estimatedEffortHours: number;
  allocationPct: number;
  assignedEffortHours: number;
  unassignedEffortHours: number;
  assignmentCount: number;
  planningStatus: CapacityWorkStatus;
  deadlinePressure: boolean;
  assignments: CapacityAssignment[];
}

export interface CapacityRebalanceSuggestion {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  suggestedHours: number;
  rationale: string;
}

export interface CapacitySummary {
  strategicSourceCount: number;
  estimatedSourceCount: number;
  fullyAssignedSourceCount: number;
  unassignedSourceCount: number;
  profileCount: number;
  effectiveCapacityHours: number;
  estimatedDemandHours: number;
  assignedDemandHours: number;
  unassignedDemandHours: number;
  capacityGapHours: number;
  estimationCoveragePct: number;
  assignmentCoveragePct: number;
  capacityCoveragePct: number;
  deadlineHealthPct: number;
  capacityScore: number;
  portfolioHealth: CapacityHealth;
  overloadedMemberCount: number;
  criticalMemberCount: number;
  deadlinePressureCount: number;
}

export interface CapacitySnapshotSummary {
  id: string;
  snapshotNumber: string;
  currency: string;
  fiscalYear: number;
  capacityScore: number;
  portfolioHealth: CapacityHealth;
  effectiveCapacityHours: number;
  estimatedDemandHours: number;
  capacityGapHours: number;
  overloadedMemberCount: number;
  deadlinePressureCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface CapacitySnapshotDetail {
  snapshot: CapacitySnapshotSummary;
  summary: CapacitySummary;
  members: CapacityMember[];
  workItems: CapacityWorkItem[];
}

export interface CapacityPlanningDashboard {
  currency: string;
  fiscalYear: number;
  summary: CapacitySummary;
  users: CapacityUserOption[];
  profiles: CapacityProfile[];
  members: CapacityMember[];
  workItems: CapacityWorkItem[];
  rebalancingSuggestions: CapacityRebalanceSuggestion[];
  snapshots: CapacitySnapshotSummary[];
}
