export type CategoryStrategyStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ON_HOLD"
  | "CLOSED"
  | "ARCHIVED";

export type CategoryMatrixPosition =
  | "MANAGE"
  | "VALUE_OPTIMIZATION"
  | "RISK_MITIGATION"
  | "CRITICAL_PRIORITY";

export type CategoryInitiativeType =
  | "SOURCING_WAVE"
  | "NEGOTIATION"
  | "CONSOLIDATION"
  | "SUPPLIER_DIVERSIFICATION"
  | "DEMAND_MANAGEMENT"
  | "CONTRACT_RENEWAL"
  | "RISK_MITIGATION"
  | "OTHER";

export type CategoryInitiativePriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type CategoryInitiativeStatus =
  | "PLANNED"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type CategoryMilestoneStatus =
  | "OPEN"
  | "COMPLETED"
  | "CANCELLED";

export interface CategoryInsight {
  categoryName: string;
  currency: string;
  supplierCount: number;
  totalSpend: number;
  topSupplierSpendShare: number;
  highRiskSuppliers: number;
  weightedSupplierRiskScore: number;
  strategicValueScore: number;
  modeledOpportunityPct: number;
  modeledOpportunityAmount: number;
  matrixPosition: CategoryMatrixPosition;
}

export interface CategorySupplierLandscape {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  country: string | null;
  spend: number;
  spendShare: number;
  continuousRiskScore: number | null;
  continuousRiskBand: string | null;
}

export interface CategoryMilestone {
  id: string;
  initiativeId: string;
  title: string;
  dueDate: string;
  status: CategoryMilestoneStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CategoryInitiative {
  id: string;
  strategyId: string;
  initiativeNumber: string;
  initiativeType: CategoryInitiativeType;
  title: string;
  description: string | null;
  priority: CategoryInitiativePriority;
  status: CategoryInitiativeStatus;
  ownerUserId: string;
  ownerName: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  overdue: boolean;
  estimatedValue: number;
  targetSavings: number;
  realizedSavings: number;
  realizationPct: number;
  milestones: CategoryMilestone[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CategoryStrategySummary {
  id: string;
  strategyCode: string;
  categoryName: string;
  currency: string;
  fiscalYear: number;
  status: CategoryStrategyStatus;
  ownerUserId: string;
  ownerName: string;

  spendBaseline: number;
  currentSpend: number;
  modeledOpportunityAmount: number;

  savingsTargetPct: number;
  savingsTargetAmount: number;
  initiativeTargetSavings: number;
  realizedSavings: number;
  realizationPct: number;

  strategicValueScore: number;
  supplyRiskScore: number;
  matrixPosition: CategoryMatrixPosition;

  activeInitiatives: number;
  overdueInitiatives: number;
  openMilestones: number;
  overdueMilestones: number;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CategoryStrategyDetail {
  strategy: CategoryStrategySummary;
  objectives: string;
  currentInsight: CategoryInsight;
  supplierLandscape: CategorySupplierLandscape[];
  initiatives: CategoryInitiative[];
}

export interface CategoryManagementSummary {
  currency: string;
  categories: number;
  activeStrategies: number;
  activeInitiatives: number;
  highRiskCategories: number;
  totalSpend: number;
  modeledOpportunity: number;
  strategyTargetSavings: number;
  realizedSavings: number;
}

export interface CategoryManagementDashboard {
  summary: CategoryManagementSummary;
  categoryInsights: CategoryInsight[];
  strategies: CategoryStrategySummary[];
}

export interface CategoryUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CategoryContext {
  categories: CategoryInsight[];
  users: CategoryUserOption[];
}
