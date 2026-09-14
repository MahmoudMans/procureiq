import type {
  CategoryInitiativePriority,
  CategoryInitiativeType,
  CategoryMatrixPosition,
} from "@/types/category-management";

export type PortfolioScenarioStatus =
  | "DRAFT"
  | "EVALUATED"
  | "APPROVED"
  | "ARCHIVED";

export type PortfolioScenarioDecision =
  | "SELECTED"
  | "EXCLUDED";

export interface PortfolioScenarioItem {
  id: string;
  scenarioId: string;
  initiativeId: string;
  initiativeNumber: string;
  categoryName: string;
  initiativeTitle: string;
  initiativeType: CategoryInitiativeType;
  priority: CategoryInitiativePriority;
  matrixPosition: CategoryMatrixPosition;
  decision: PortfolioScenarioDecision;
  rankPosition: number | null;
  estimatedValue: number;
  targetSavings: number;
  savingsEfficiencyPct: number;
  strategicValueScore: number;
  supplyRiskScore: number;
  priorityScore: number;
  matrixUrgencyScore: number;
  utilityScore: number;
  exclusionReason: string | null;
}

export interface PortfolioScenarioSummary {
  id: string;
  scenarioCode: string;
  name: string;
  currency: string;
  status: PortfolioScenarioStatus;

  ownerUserId: string;
  ownerName: string;

  budgetLimit: number;
  maxInitiatives: number;
  maxAverageRiskScore: number;
  minTotalTargetSavings: number;
  allowCriticalPriority: boolean;

  candidateCount: number;
  selectedCount: number;
  excludedCount: number;

  selectedBudget: number;
  selectedTargetSavings: number;
  averageSelectedRisk: number;
  savingsToBudgetPct: number;

  minimumTargetMet: boolean;

  evaluatedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PortfolioScenarioDetail {
  scenario: PortfolioScenarioSummary;
  notes: string | null;
  items: PortfolioScenarioItem[];
}

export interface PortfolioOptimizationSummary {
  currency: string;
  scenarios: number;
  evaluatedScenarios: number;
  approvedScenarios: number;
  approvedPortfolioBudget: number;
  approvedPortfolioSavings: number;
  recommendedScenarioId: string | null;
}

export interface PortfolioOptimizationDashboard {
  summary: PortfolioOptimizationSummary;
  scenarios: PortfolioScenarioSummary[];
}

export interface PortfolioOptimizationRun {
  candidateCount: number;
  selectedCount: number;
  excludedCount: number;
  selectedBudget: number;
  selectedTargetSavings: number;
  averageRiskScore: number;
  minimumTargetMet: boolean;
}

export interface PortfolioUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface PortfolioOptimizationContext {
  users: PortfolioUserOption[];
}
