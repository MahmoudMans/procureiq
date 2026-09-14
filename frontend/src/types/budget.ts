export type BudgetScopeType =
  | "DEPARTMENT"
  | "CATEGORY";

export type BudgetStatus =
  | "ACTIVE"
  | "ARCHIVED";

export type BudgetAlertLevel =
  | "HEALTHY"
  | "WARNING"
  | "EXCEEDED";

export interface BudgetAllocation {
  id: string;
  fiscalYear: number;
  scopeType: BudgetScopeType;
  departmentId: string | null;
  departmentName: string | null;
  category: string | null;
  scopeLabel: string;
  currency: string;
  budgetAmount: number;
  warningThresholdPercent: number;
  hardLimit: boolean;
  status: BudgetStatus;
  ownerUserId: string;
  ownerName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface BudgetAllocationInput {
  fiscalYear: number;
  scopeType: BudgetScopeType;
  departmentId?: string;
  category?: string;
  currency: string;
  budgetAmount: number;
  warningThresholdPercent: number;
  hardLimit: boolean;
  ownerUserId?: string;
  notes?: string;
}

export interface BudgetUsage {
  allocationId: string;
  fiscalYear: number;
  scopeType: BudgetScopeType;
  scopeLabel: string;
  currency: string;
  budgetAmount: number;
  committedSpend: number;
  openRequestExposure: number;
  forecastExposure: number;
  remainingCommitted: number;
  remainingForecast: number;
  utilizationPercent: number;
  forecastUtilizationPercent: number;
  warningThresholdPercent: number;
  hardLimit: boolean;
  alertLevel: BudgetAlertLevel;
}

export interface BudgetSummary {
  fiscalYear: number;
  currency: string;
  activeAllocations: number;
  totalBudget: number;
  committedSpend: number;
  openRequestExposure: number;
  forecastExposure: number;
  remainingForecast: number;
  utilizationPercent: number;
  forecastUtilizationPercent: number;
  warningAllocations: number;
  exceededAllocations: number;
}

export interface BudgetAlert {
  allocationId: string;
  scopeType: BudgetScopeType;
  scopeLabel: string;
  currency: string;
  alertLevel: BudgetAlertLevel;
  forecastUtilizationPercent: number;
  remainingForecast: number;
  hardLimit: boolean;
  message: string;
}

export interface PurchaseRequestBudgetCheck {
  purchaseRequestId: string;
  requestNumber: string;
  departmentId: string;
  departmentName: string;
  currency: string;
  requestAmount: number;

  budgetConfigured: boolean;
  allocationId: string | null;
  budgetAmount: number;
  currentForecastExposure: number;
  projectedForecastExposure: number;
  projectedUtilizationPercent: number;
  remainingAfterRequest: number;
  warningThresholdPercent: number;
  hardLimit: boolean;
  blocked: boolean;
  alertLevel: BudgetAlertLevel;
  message: string;
}

export interface BudgetDepartmentOption {
  id: string;
  name: string;
}

export interface BudgetUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface BudgetRequestOption {
  id: string;
  requestNumber: string;
  title: string;
  departmentName: string;
  status: string;
  currency: string;
  estimatedTotal: number;
}

export interface BudgetContextOptions {
  departments: BudgetDepartmentOption[];
  users: BudgetUserOption[];
  purchaseRequests: BudgetRequestOption[];
  categories: string[];
}
