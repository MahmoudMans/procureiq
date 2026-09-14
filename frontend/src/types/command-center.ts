export type CommandCenterSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "INFO";

export type CommandCenterActionType =
  | "PENDING_REQUEST"
  | "RFQ_DEADLINE"
  | "OVERDUE_PURCHASE_ORDER"
  | "CONTRACT_EXPIRY"
  | "COMPLIANCE_EXPIRY"
  | "PROCUREMENT_RISK"
  | "BUDGET_EXCEPTION"
  | "PLANNING_DEMAND"
  | "SAVINGS_VALIDATION"
  | "SAVINGS_REALIZATION";

export interface CommandCenterAction {
  id: string;
  type: CommandCenterActionType;
  severity: CommandCenterSeverity;
  title: string;
  description: string;
  reference: string | null;
  dueDate: string | null;
  daysToDue: number | null;
  overdue: boolean;
  amount: number | null;
  currency: string | null;
  ownerName: string | null;
  href: string;
}

export interface CommandCenterSummary {
  totalActions: number;
  criticalActions: number;
  highActions: number;
  overdueActions: number;

  pendingRequests: number;
  rfqDeadlines: number;
  overduePurchaseOrders: number;
  contractComplianceIssues: number;
  criticalRisks: number;
  budgetExceptions: number;
  upcomingDemand: number;
  savingsActions: number;

  realizedSavings: number;
  currency: string;
}

export interface CommandCenterBreakdown {
  type: CommandCenterActionType;
  total: number;
  critical: number;
  high: number;
  overdue: number;
}

export interface CommandCenter {
  generatedAt: string;
  horizonDays: number;
  summary: CommandCenterSummary;
  breakdown: CommandCenterBreakdown[];
  actions: CommandCenterAction[];
}
