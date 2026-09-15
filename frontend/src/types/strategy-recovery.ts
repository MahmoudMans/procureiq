import type {
  ExecutionCommitmentHealth,
} from "@/types/strategy-execution";

export type RecoveryCaseStatus =
  | "OPEN"
  | "IN_RECOVERY"
  | "READY_FOR_VERIFICATION"
  | "VERIFIED"
  | "CLOSED";

export type RecoveryActionStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type RecoverySeverity =
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type RecoveryHealth =
  | "RECOVERED"
  | "IMPROVING"
  | "WATCH"
  | "INEFFECTIVE";

export type RecoveryEscalationLevel =
  | "MANAGER"
  | "EXECUTIVE";

export interface RecoveryUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface RecoveryCandidate {
  commitmentId: string;
  commitmentNumber: string;
  roadmapId: string;
  roadmapNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  ownerName: string;
  executionHealth: ExecutionCommitmentHealth;
  progressPct: number;
  plannedEndDate: string;
  forecastEndDate: string;
  blockerCount: number;
  plannedContributionPoints: number;
  validatedContributionPoints: number;
  valueAtRiskPoints: number;
  riskScore: number;
  severity: RecoverySeverity;
}

export interface RecoveryAction {
  id: string;
  recoveryCaseId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  dueDate: string;
  status: RecoveryActionStatus;
  overdue: boolean;
  completionEvidence: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  version: number;
}

export interface RecoveryCheckpoint {
  id: string;
  recoveryCaseId: string;
  executionHealth: ExecutionCommitmentHealth;
  progressPct: number;
  forecastEndDate: string;
  blockerCount: number;
  validatedContributionPoints: number;
  valueAtRiskPoints: number;
  currentRiskScore: number;
  recoveryScore: number;
  effectivenessPct: number;
  recoveryHealth: RecoveryHealth;
  checkpointNote: string;
  capturedByName: string;
  capturedAt: string;
}

export interface RecoveryEscalation {
  id: string;
  recoveryCaseId: string;
  escalationLevel: RecoveryEscalationLevel;
  reason: string;
  escalatedByName: string;
  escalatedAt: string;
}

export interface RecoveryCase {
  id: string;
  recoveryNumber: string;
  commitmentId: string | null;
  commitmentNumber: string;
  roadmapId: string | null;
  roadmapNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  executionOwnerName: string;
  recoveryOwnerUserId: string | null;
  recoveryOwnerName: string;
  severity: RecoverySeverity;
  status: RecoveryCaseStatus;
  recoveryObjective: string;
  targetRecoveryDate: string | null;

  baselineExecutionHealth: ExecutionCommitmentHealth;
  baselineProgressPct: number;
  baselineForecastEndDate: string | null;
  baselineBlockerCount: number;
  baselinePlannedContributionPoints: number;
  baselineValidatedContributionPoints: number;
  baselineValueAtRiskPoints: number;
  baselineRiskScore: number;

  currentExecutionHealth: ExecutionCommitmentHealth;
  currentProgressPct: number;
  currentForecastEndDate: string;
  currentBlockerCount: number;
  currentValidatedContributionPoints: number;
  currentValueAtRiskPoints: number;
  currentRiskScore: number;
  recoveryScore: number;
  effectivenessPct: number;
  recoveryHealth: RecoveryHealth;
  verificationEligible: boolean;

  openActionCount: number;
  overdueActionCount: number;
  escalationCount: number;

  verificationNote: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
}

export interface RecoveryCaseDetail {
  recoveryCase: RecoveryCase;
  actions: RecoveryAction[];
  checkpoints: RecoveryCheckpoint[];
  escalations: RecoveryEscalation[];
}

export interface StrategyRecoverySummary {
  candidateCount: number;
  openCaseCount: number;
  inRecoveryCaseCount: number;
  readyForVerificationCount: number;
  verifiedCaseCount: number;
  criticalCaseCount: number;
  overdueActionCount: number;
  escalationCount: number;
  totalBaselineValueAtRiskPoints: number;
  totalCurrentValueAtRiskPoints: number;
  averageEffectivenessPct: number;
  averageRecoveryScore: number;
  portfolioHealth: RecoveryHealth;
}

export interface RecoveryReviewSummary {
  id: string;
  reviewNumber: string;
  openCaseCount: number;
  inRecoveryCaseCount: number;
  readyForVerificationCount: number;
  verifiedCaseCount: number;
  criticalCaseCount: number;
  overdueActionCount: number;
  escalationCount: number;
  totalBaselineValueAtRiskPoints: number;
  totalCurrentValueAtRiskPoints: number;
  averageEffectivenessPct: number;
  averageRecoveryScore: number;
  portfolioHealth: RecoveryHealth;
  capturedByName: string;
  capturedAt: string;
}

export interface RecoveryReviewDetail {
  review: RecoveryReviewSummary;
  cases: RecoveryCase[];
}

export interface StrategyRecoveryDashboard {
  summary: StrategyRecoverySummary;
  users: RecoveryUserOption[];
  candidates: RecoveryCandidate[];
  cases: RecoveryCase[];
  reviews: RecoveryReviewSummary[];
}
