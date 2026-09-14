export type ExecutionPortfolioStatus =
  | "AUTHORIZED"
  | "IN_EXECUTION"
  | "CLOSED"
  | "ARCHIVED";

export type BenefitItemStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "VALIDATION_PENDING"
  | "VALIDATED"
  | "CANCELLED";

export type BenefitAssumptionType =
  | "DEMAND"
  | "PRICE"
  | "VOLUME"
  | "TIMING"
  | "FX"
  | "SCOPE"
  | "OTHER";

export type BenefitAssumptionStatus =
  | "ACTIVE"
  | "CONFIRMED"
  | "INVALIDATED";

export type BenefitLeakageType =
  | "DEMAND_EROSION"
  | "PRICE_VARIANCE"
  | "SCOPE_CHANGE"
  | "TIMING_SLIPPAGE"
  | "FX_IMPACT"
  | "OTHER";

export type BenefitLeakageStatus =
  | "OPEN"
  | "MITIGATED"
  | "ACCEPTED"
  | "RESOLVED";

export interface ApprovedScenarioOption {
  id: string;
  scenarioCode: string;
  name: string;
  currency: string;
  ownerName: string;
  selectedInitiatives: number;
  selectedBudget: number;
  targetSavings: number;
  averageRisk: number;
  approvedAt: string | null;
}

export interface BenefitUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface BenefitsGovernanceContext {
  approvedScenarios: ApprovedScenarioOption[];
  users: BenefitUserOption[];
}

export interface BenefitItem {
  id: string;
  portfolioId: string;

  scenarioItemId: string;
  initiativeId: string;
  strategyId: string;

  categoryName: string;
  initiativeNumber: string;
  initiativeTitle: string;

  benefitOwnerUserId: string;
  benefitOwnerName: string;

  status: BenefitItemStatus;

  baselineTargetSavings: number;
  forecastSavings: number;
  operationalReportedSavings: number;
  validationRequestedAmount: number | null;
  validatedSavings: number;

  forecastGap: number;
  validationGap: number;

  activeLeakageAmount: number;
  atRiskAmount: number;

  expectedRealizationDate: string | null;

  validationRequestNote: string | null;
  validationRequestedByName: string | null;
  validationRequestedAt: string | null;

  validatedByName: string | null;
  validationNote: string | null;
  validatedAt: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface BenefitAssumption {
  id: string;
  portfolioId: string;
  assumptionType: BenefitAssumptionType;
  description: string;
  financialImpact: number;
  status: BenefitAssumptionStatus;
  ownerUserId: string;
  ownerName: string;
  reviewDate: string | null;
  reviewOverdue: boolean;
  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface BenefitLeakage {
  id: string;
  benefitItemId: string;
  initiativeNumber: string;
  initiativeTitle: string;
  leakageType: BenefitLeakageType;
  amount: number;
  status: BenefitLeakageStatus;
  description: string;
  ownerUserId: string;
  ownerName: string;
  dueDate: string | null;
  overdue: boolean;
  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ExecutionPortfolioSummary {
  id: string;
  portfolioNumber: string;

  sourceScenarioId: string;
  sourceScenarioCode: string;
  sourceScenarioName: string;

  currency: string;
  status: ExecutionPortfolioStatus;

  ownerUserId: string;
  ownerName: string;

  authorizedByName: string;
  authorizedAt: string;

  baselineSelectedBudget: number;
  baselineTargetSavings: number;
  baselineAverageRisk: number;
  selectedInitiativeCount: number;

  currentForecastSavings: number;
  operationalReportedSavings: number;
  validatedSavings: number;
  activeLeakageAmount: number;
  atRiskAmount: number;

  forecastCoveragePct: number;
  validationCoveragePct: number;

  activeBenefitItems: number;
  validationPendingItems: number;
  validatedItems: number;

  activeAssumptions: number;
  invalidatedAssumptions: number;

  activeLeakageCases: number;
  overdueLeakageCases: number;

  closedAt: string | null;
  archivedAt: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ExecutionPortfolioDetail {
  portfolio: ExecutionPortfolioSummary;
  notes: string | null;
  benefitItems: BenefitItem[];
  assumptions: BenefitAssumption[];
  leakage: BenefitLeakage[];
}

export interface BenefitsGovernanceSummary {
  currency: string;
  portfolios: number;
  activePortfolios: number;
  validationPendingItems: number;
  portfoliosWithLeakage: number;
  baselineTargetSavings: number;
  forecastSavings: number;
  operationalReportedSavings: number;
  validatedSavings: number;
  activeLeakageAmount: number;
  atRiskAmount: number;
  forecastCoveragePct: number;
  validationCoveragePct: number;
}

export interface BenefitsGovernanceDashboard {
  summary: BenefitsGovernanceSummary;
  portfolios: ExecutionPortfolioSummary[];
}
