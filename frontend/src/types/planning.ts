export type ProcurementPlanStatus =
  | "DRAFT"
  | "ACTIVE"
  | "CLOSED"
  | "ARCHIVED";

export type ProcurementPlanItemStatus =
  | "PLANNED"
  | "READY"
  | "CONVERTED"
  | "COMPLETED"
  | "CANCELLED";

export type ProcurementPlanPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface ProcurementPlan {
  id: string;
  planNumber: string;
  name: string;
  fiscalYear: number;
  currency: string;
  status: ProcurementPlanStatus;
  ownerUserId: string;
  ownerName: string;
  notes: string | null;
  totalItems: number;
  convertedItems: number;
  completedItems: number;
  plannedValue: number;
  linkedActualValue: number;
  variance: number;
  conversionRate: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProcurementPlanItem {
  id: string;
  planId: string;
  title: string;
  description: string | null;
  departmentId: string;
  departmentName: string;
  category: string;
  plannedValue: number;
  targetSourcingDate: string;
  priority: ProcurementPlanPriority;
  status: ProcurementPlanItemStatus;

  linkedPurchaseRequestId: string | null;
  linkedRequestNumber: string | null;
  linkedRequestStatus: string | null;
  linkedRequestValue: number | null;

  variance: number;
  overdue: boolean;
  notes: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProcurementPlanDetail {
  plan: ProcurementPlan;
  items: ProcurementPlanItem[];
}

export interface PlanningSummary {
  fiscalYear: number;
  currency: string;
  activePlans: number;
  plannedInitiatives: number;
  upcomingInitiatives: number;
  overdueInitiatives: number;
  convertedInitiatives: number;
  plannedDemand: number;
  linkedActualDemand: number;
  variance: number;
  conversionRate: number;
}

export interface PlanningMonthlyForecast {
  month: string;
  plannedValue: number;
  linkedActualValue: number;
  initiativeCount: number;
}

export interface PlanningCategoryVariance {
  category: string;
  plannedValue: number;
  linkedActualValue: number;
  variance: number;
  initiativeCount: number;
}

export interface PlanningUpcomingDemand {
  itemId: string;
  planId: string;
  planNumber: string;
  title: string;
  departmentName: string;
  category: string;
  priority: ProcurementPlanPriority;
  status: ProcurementPlanItemStatus;
  plannedValue: number;
  targetSourcingDate: string;
  daysUntilTarget: number;
}

export interface PlanningDepartmentOption {
  id: string;
  name: string;
}

export interface PlanningUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface PlanningRequestOption {
  id: string;
  requestNumber: string;
  title: string;
  departmentId: string;
  departmentName: string;
  currency: string;
  status: string;
  estimatedTotal: number;
}

export interface PlanningContextOptions {
  departments: PlanningDepartmentOption[];
  users: PlanningUserOption[];
  purchaseRequests: PlanningRequestOption[];
  categories: string[];
}
