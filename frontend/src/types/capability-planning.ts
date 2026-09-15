export type CapabilityReadiness =
  | "UNDEFINED"
  | "READY"
  | "WATCH"
  | "GAP"
  | "CRITICAL";

export type CapabilityActionType =
  | "TRAINING"
  | "COACHING"
  | "SHADOWING"
  | "SELF_STUDY"
  | "CERTIFICATION";

export type CapabilityActionStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type CapabilitySourceType =
  | "CATEGORY_INITIATIVE"
  | "IMPROVEMENT_INITIATIVE"
  | "EXECUTION_PORTFOLIO"
  | "RISK_ESCALATION";

export interface CapabilitySkill {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
}

export interface UserCapability {
  id: string;
  userId: string;
  userName: string;
  role: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  skillCategory: string;
  proficiencyLevel: number;
  evidenceNote: string;
  assessedByName: string;
  assessedAt: string;
  version: number;
}

export interface WorkCapabilityRequirement {
  id: string;
  currency: string;
  fiscalYear: number;
  sourceType: CapabilitySourceType;
  sourceEntityId: string;
  sourceReference: string;
  sourceTitle: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  skillCategory: string;
  requiredProficiency: number;
  importanceWeightPct: number;
}

export interface CapabilityMember {
  userId: string;
  userName: string;
  role: string;
  assessedSkillCount: number;
  averageProficiency: number;
  assignedWorkItemCount: number;
  capabilityGapCount: number;
  openDevelopmentActionCount: number;
}

export interface CapabilityWorkItem {
  sourceType: CapabilitySourceType;
  sourceEntityId: string;
  sourceReference: string;
  sourceTitle: string;
  sourceStatus: string;
  assignedMemberCount: number;
  requirementCount: number;
  criticalGapCount: number;
  assignedFitPct: number;
  benchFitPct: number;
  benchReadyMemberCount: number;
  readiness: CapabilityReadiness;
  requirements: WorkCapabilityRequirement[];
  assignedUserIds: string[];
}

export interface CapabilityDevelopmentAction {
  id: string;
  userId: string;
  userName: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  fiscalYear: number;
  actionType: CapabilityActionType;
  title: string;
  description: string | null;
  targetProficiency: number;
  dueDate: string;
  status: CapabilityActionStatus;
  overdue: boolean;
  evidenceNote: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  version: number;
}

export interface CapabilitySummary {
  activeSkillCount: number;
  assessedMemberCount: number;
  strategicWorkCount: number;
  workWithRequirementsCount: number;
  readyWorkCount: number;
  watchWorkCount: number;
  gapWorkCount: number;
  criticalWorkCount: number;
  criticalGapCount: number;
  openDevelopmentActionCount: number;
  requirementCoveragePct: number;
  averageAssignedFitPct: number;
  averageBenchFitPct: number;
  capabilityScore: number;
  capabilityHealth: CapabilityReadiness;
}

export interface CapabilitySnapshotSummary {
  id: string;
  snapshotNumber: string;
  currency: string;
  fiscalYear: number;
  capabilityScore: number;
  capabilityHealth: CapabilityReadiness;
  criticalGapCount: number;
  openDevelopmentActionCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface CapabilitySnapshotDetail {
  snapshot: CapabilitySnapshotSummary;
  summary: CapabilitySummary;
  members: CapabilityMember[];
  workItems: CapabilityWorkItem[];
}

export interface CapabilityPlanningDashboard {
  currency: string;
  fiscalYear: number;
  summary: CapabilitySummary;
  users: Array<{
    id: string;
    fullName: string;
    role: string;
  }>;
  skills: CapabilitySkill[];
  userCapabilities: UserCapability[];
  members: CapabilityMember[];
  workItems: CapabilityWorkItem[];
  developmentActions: CapabilityDevelopmentAction[];
  snapshots: CapabilitySnapshotSummary[];
}
