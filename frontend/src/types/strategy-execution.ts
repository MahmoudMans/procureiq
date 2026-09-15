import type {
  BoardDimensionKey,
} from "@/types/strategy-cockpit";

export type ExecutionCommitmentStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type ExecutionCommitmentHealth =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "WATCH"
  | "AT_RISK"
  | "BLOCKED"
  | "OVERDUE"
  | "COMPLETED"
  | "CANCELLED";

export type ExecutionPortfolioHealth =
  | "HEALTHY"
  | "WATCH"
  | "AT_RISK"
  | "CRITICAL";

export type ExecutionValidationDecision =
  | "VALIDATED"
  | "REJECTED";

export interface ExecutionProgress {
  id: string;
  commitmentId: string;
  progressPct: number;
  forecastEndDate: string;
  blockerCount: number;
  blockerSummary: string | null;
  updateNote: string;
  createdByName: string;
  createdAt: string;
}

export interface ExecutionOutcomeReport {
  id: string;
  commitmentId: string;
  reportedContributionPoints: number;
  evidenceNote: string;
  reportedByName: string;
  reportedAt: string;
  validationDecision: ExecutionValidationDecision | null;
  validatedContributionPoints: number | null;
  validationNote: string | null;
  validatedByName: string | null;
  validatedAt: string | null;
}

export interface ExecutionCommitment {
  id: string;
  commitmentNumber: string;
  sourceRoadmapId: string;
  sourceRoadmapNumber: string;
  sourceRoadmapTitle: string;
  sourceInitiativeId: string | null;
  sourceInitiativeNumber: string;
  sourceInitiativeTitle: string;
  dimensionKey: BoardDimensionKey | null;
  ownerUserId: string | null;
  ownerName: string;
  currency: string;
  fiscalYear: number;
  plannedStartDate: string | null;
  plannedEndDate: string;
  plannedContributionPoints: number;
  status: ExecutionCommitmentStatus;
  progressPct: number;
  forecastEndDate: string;
  blockerCount: number;
  blockerSummary: string | null;
  health: ExecutionCommitmentHealth;
  expectedProgressPct: number;
  scheduleVariancePct: number;
  reportedContributionPoints: number;
  validatedContributionPoints: number;
  valueAtRiskPoints: number;
  actualStartAt: string | null;
  actualCompletedAt: string | null;
  cancelledAt: string | null;
}

export interface ExecutionCommitmentDetail {
  commitment: ExecutionCommitment;
  progressUpdates: ExecutionProgress[];
  outcomes: ExecutionOutcomeReport[];
}

export interface StrategyExecutionSummary {
  commitmentCount: number;
  completedCommitmentCount: number;
  blockedCommitmentCount: number;
  atRiskCommitmentCount: number;
  overdueCommitmentCount: number;
  plannedContributionPoints: number;
  reportedContributionPoints: number;
  validatedContributionPoints: number;
  valueAtRiskPoints: number;
  averageProgressPct: number;
  scheduleHealthPct: number;
  outcomeValidationPct: number;
  executionScore: number;
  executionHealth: ExecutionPortfolioHealth;
}

export interface ExecutionReviewSummary {
  id: string;
  reviewNumber: string;
  roadmapId: string;
  roadmapNumber: string;
  roadmapTitle: string;
  commitmentCount: number;
  completedCommitmentCount: number;
  blockedCommitmentCount: number;
  atRiskCommitmentCount: number;
  overdueCommitmentCount: number;
  plannedContributionPoints: number;
  reportedContributionPoints: number;
  validatedContributionPoints: number;
  valueAtRiskPoints: number;
  executionScore: number;
  executionHealth: ExecutionPortfolioHealth;
  capturedByName: string;
  capturedAt: string;
}

export interface ExecutionReviewDetail {
  review: ExecutionReviewSummary;
  summary: StrategyExecutionSummary;
  commitments: ExecutionCommitment[];
}

export interface StrategyExecutionDashboard {
  summary: StrategyExecutionSummary;
  commitments: ExecutionCommitment[];
  reviews: ExecutionReviewSummary[];
}
