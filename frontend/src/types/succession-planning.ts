export type SuccessionCriticality =
  | "HIGH"
  | "CRITICAL";

export type SuccessionCandidateStatus =
  | "IDENTIFIED"
  | "DEVELOPING"
  | "READY"
  | "DECLINED";

export type SuccessionCandidateReadiness =
  | "READY"
  | "NEAR_READY"
  | "DEVELOPING"
  | "GAP";

export type SuccessionHealth =
  | "UNDEFINED"
  | "RESILIENT"
  | "STABLE"
  | "WATCH"
  | "CRITICAL";

export interface SuccessionCandidate {
  id: string;
  policyId: string;
  userId: string;
  userName: string;
  role: string;
  status: SuccessionCandidateStatus;
  currentProficiency: number;
  proficiencyFitPct: number;
  capacityUtilizationPct: number;
  evidenceScore: number;
  readiness: SuccessionCandidateReadiness;
  openDevelopmentActionCount: number;
  rationale: string;
  targetDate: string | null;
  decisionNote: string | null;
  version: number;
}

export interface SuccessionPolicy {
  id: string;
  currency: string;
  fiscalYear: number;
  skillId: string;
  skillCode: string;
  skillName: string;
  skillCategory: string;
  criticality: SuccessionCriticality;
  requiredProficiency: number;
  targetReadyPeople: number;
  notes: string | null;
  strategicWorkCount: number;
  assignedMemberCount: number;
  readyPeopleCount: number;
  readyBenchCount: number;
  nominatedCandidateCount: number;
  readyCandidateCount: number;
  singlePointFailure: boolean;
  coveragePct: number;
  policyScore: number;
  health: SuccessionHealth;
  version: number;
}

export interface SuccessionPolicyDetail {
  policy: SuccessionPolicy;
  impactedWorkItems:
    import("@/types/capability-planning").CapabilityWorkItem[];
  candidates: SuccessionCandidate[];
}

export interface SuccessionSummary {
  policyCount: number;
  coveredPolicyCount: number;
  exposedPolicyCount: number;
  criticalExposureCount: number;
  singlePointFailureCount: number;
  nominatedCandidateCount: number;
  readyCandidateCount: number;
  averageReadyPeople: number;
  policyCoveragePct: number;
  averagePolicyScore: number;
  successionScore: number;
  successionHealth: SuccessionHealth;
}

export interface SuccessionSnapshotSummary {
  id: string;
  snapshotNumber: string;
  currency: string;
  fiscalYear: number;
  successionScore: number;
  successionHealth: SuccessionHealth;
  singlePointFailureCount: number;
  criticalExposureCount: number;
  readyCandidateCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface SuccessionSnapshotDetail {
  snapshot: SuccessionSnapshotSummary;
  summary: SuccessionSummary;
  policies: SuccessionPolicy[];
  candidates: SuccessionCandidate[];
}

export interface SuccessionPlanningDashboard {
  currency: string;
  fiscalYear: number;
  summary: SuccessionSummary;
  users: Array<{
    id: string;
    fullName: string;
    role: string;
  }>;
  skills:
    import("@/types/capability-planning").CapabilitySkill[];
  policies: SuccessionPolicy[];
  snapshots: SuccessionSnapshotSummary[];
}
