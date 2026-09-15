import type {
  BoardDimensionKey,
  BoardHealth,
  BoardMovement,
  BoardScorecardSummary,
} from "@/types/strategy-cockpit";

export type StrategyScenarioStatus =
  | "DRAFT"
  | "EVALUATED"
  | "APPROVED"
  | "ARCHIVED";

export interface StrategyScenarioAssumption {
  id: string;
  dimensionKey: BoardDimensionKey;
  dimensionLabel: string;
  adjustmentPoints: number;
  rationale: string;
  createdByName: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StrategyScenarioEvaluationDimension {
  dimensionKey: BoardDimensionKey;
  dimensionLabel: string;
  weightPct: number;
  baselineScore: number;
  adjustmentPoints: number;
  simulatedScore: number;
  weightedContribution: number;
  health: BoardHealth;
}

export interface StrategyScenarioEvaluationSummary {
  id: string;
  evaluationNumber: string;
  scenarioId: string;
  baselineOverallScore: number;
  simulatedOverallScore: number;
  simulatedHealth: BoardHealth;
  scoreDelta: number;
  movement: BoardMovement;
  assumptionCount: number;
  improvedDimensionCount: number;
  deterioratedDimensionCount: number;
  evaluatedByName: string;
  evaluatedAt: string;
}

export interface StrategyScenarioEvaluationDetail {
  evaluation: StrategyScenarioEvaluationSummary;
  generatedSummary: string;
  dimensions: StrategyScenarioEvaluationDimension[];
}

export interface StrategyScenarioSummary {
  id: string;
  scenarioNumber: string;
  name: string;
  description: string | null;
  currency: string;
  fiscalYear: number;
  status: StrategyScenarioStatus;
  baselineOverallScore: number;
  baselineHealth: BoardHealth;
  latestSimulatedScore: number | null;
  latestSimulatedHealth: BoardHealth | null;
  latestDelta: number | null;
  latestMovement: BoardMovement | null;
  assumptionCount: number;
  rank: number;
  approvalNote: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  archiveNote: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StrategyScenarioDetail {
  scenario: StrategyScenarioSummary;
  assumptions: StrategyScenarioAssumption[];
  latestEvaluation: StrategyScenarioEvaluationDetail | null;
}

export interface StrategyScenarioDashboard {
  currency: string;
  fiscalYear: number;
  liveBoardBaseline: BoardScorecardSummary;
  scenarios: StrategyScenarioSummary[];
}
