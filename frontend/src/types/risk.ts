export type RiskOrigin =
  | "MANUAL"
  | "SYSTEM";

export type RiskCategory =
  | "SUPPLIER"
  | "CONTRACT"
  | "PURCHASE_ORDER"
  | "DELIVERY"
  | "SOURCING"
  | "COMPLIANCE"
  | "OTHER";

export type RiskSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type RiskCaseStatus =
  | "OPEN"
  | "IN_MITIGATION"
  | "RESOLVED"
  | "ACCEPTED";

export type MitigationActionStatus =
  | "OPEN"
  | "COMPLETED"
  | "CANCELLED";

export interface RiskMitigationAction {
  id: string;
  title: string;
  description: string | null;
  status: MitigationActionStatus;
  dueDate: string | null;
  overdue: boolean;
  ownerUserId: string;
  ownerName: string;
  completedAt: string | null;
  completedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskCase {
  id: string;
  riskNumber: string;
  origin: RiskOrigin;
  category: RiskCategory;
  severity: RiskSeverity;
  status: RiskCaseStatus;
  title: string;
  description: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  dueDate: string | null;
  overdue: boolean;

  supplierId: string | null;
  supplierName: string | null;

  contractId: string | null;
  contractNumber: string | null;

  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;

  rfqId: string | null;
  rfqNumber: string | null;

  ownerUserId: string;
  ownerName: string;

  createdByUserId: string;
  createdByName: string;

  escalated: boolean;
  escalatedAt: string | null;
  escalatedByName: string | null;

  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;

  openMitigationActions: number;
  completedMitigationActions: number;
  mitigationActions: RiskMitigationAction[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface RiskSummary {
  totalCases: number;
  openCases: number;
  criticalCases: number;
  highCases: number;
  overdueCases: number;
  escalatedCases: number;
  resolvedCases: number;
  averageOpenRiskScore: number;
}

export interface RiskUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface RiskSupplierOption {
  id: string;
  supplierCode: string;
  legalName: string;
}

export interface RiskContractOption {
  id: string;
  contractNumber: string;
  title: string;
  supplierId: string;
  supplierName: string;
}

export interface RiskPurchaseOrderOption {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
}

export interface RiskRfqOption {
  id: string;
  rfqNumber: string;
  title: string;
  status: string;
}

export interface RiskContextOptions {
  users: RiskUserOption[];
  suppliers: RiskSupplierOption[];
  contracts: RiskContractOption[];
  purchaseOrders: RiskPurchaseOrderOption[];
  rfqs: RiskRfqOption[];
}

export interface RiskCaseCreateInput {
  title: string;
  description: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  dueDate?: string;
  ownerUserId?: string;
  supplierId?: string;
  contractId?: string;
  purchaseOrderId?: string;
  rfqId?: string;
}

export interface RiskCaseUpdateInput {
  title: string;
  description: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  dueDate?: string;
  ownerUserId?: string;
}

export interface RiskMitigationActionInput {
  title: string;
  description?: string;
  dueDate?: string;
  ownerUserId?: string;
}

export interface SystemRiskRefreshResult {
  discoveredConditions: number;
  createdCases: number;
  updatedCases: number;
  reopenedCases: number;
}
