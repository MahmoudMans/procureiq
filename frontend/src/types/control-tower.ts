export type ControlTowerExceptionType =
  | "SUPPLIER_RISK_ALERT"
  | "RISK_ESCALATION_OVERDUE"
  | "DOCUMENT_COMPLIANCE_GAP"
  | "SOURCING_INITIATIVE_OVERDUE"
  | "BENEFIT_VALIDATION_PENDING"
  | "BENEFIT_LEAKAGE"
  | "GOVERNANCE_DECISION_OVERDUE"
  | "GOVERNANCE_ACTION_OVERDUE"
  | "COMMERCIAL_LEAKAGE";

export type ControlTowerSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type ControlTowerItemStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED";

export interface ControlTowerRun {
  id: string;
  currency: string;
  status: string;
  startedByName: string;
  discoveredCount: number;
  refreshedCount: number;
  autoResolvedCount: number;
  startedAt: string;
  completedAt: string | null;
}

export interface ControlTowerItem {
  id: string;
  exceptionKey: string;
  exceptionType: ControlTowerExceptionType;

  sourceEntityType: string;
  sourceEntityId: string;
  sourceReference: string;

  currency: string;
  title: string;
  details: string;

  severity: ControlTowerSeverity;
  priorityScore: number;
  monetaryExposure: number;

  sourceDueDate: string | null;
  slaDueAt: string;
  slaOverdue: boolean;

  status: ControlTowerItemStatus;

  ownerUserId: string | null;
  ownerName: string | null;

  acknowledgedByName: string | null;
  acknowledgementNote: string | null;
  acknowledgedAt: string | null;

  startedAt: string | null;

  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;

  firstSeenAt: string;
  lastSeenAt: string;
  ageDays: number;

  version: number;
}

export interface ControlTowerSummary {
  currency: string;
  activeItems: number;
  criticalItems: number;
  highItems: number;
  slaOverdueItems: number;
  unassignedItems: number;
  activeMonetaryExposure: number;
  supplierRiskItems: number;
  complianceItems: number;
  sourcingItems: number;
  benefitsItems: number;
  governanceItems: number;
}

export interface ControlTowerDashboard {
  summary: ControlTowerSummary;
  items: ControlTowerItem[];
  latestRun: ControlTowerRun | null;
}

export interface ControlTowerScan {
  runId: string;
  sourceExceptions: number;
  discoveredCount: number;
  refreshedCount: number;
  autoResolvedCount: number;
}

export interface ControlTowerUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface ControlTowerContext {
  users: ControlTowerUserOption[];
}
