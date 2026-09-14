export type CommercialGovernanceStatus =
  | "ACTIVE"
  | "INACTIVE";

export type ContractRenewalStatus =
  | "UPCOMING"
  | "UNDER_REVIEW"
  | "RENEW"
  | "RENEGOTIATE"
  | "TERMINATE"
  | "COMPLETED";

export type ContractRenewalDecision =
  | "RENEW"
  | "RENEGOTIATE"
  | "TERMINATE";

export type ContractObligationType =
  | "DELIVERY"
  | "SERVICE_LEVEL"
  | "REPORTING"
  | "COMPLIANCE"
  | "PAYMENT"
  | "RENEWAL"
  | "OTHER";

export type ContractObligationStatus =
  | "OPEN"
  | "COMPLETED"
  | "WAIVED";

export type CommercialLeakageType =
  | "NO_ACTIVE_CONTRACT"
  | "EXPIRED_CONTRACT"
  | "PO_VALUE_VARIANCE"
  | "PRICE_ESCALATION_BREACH"
  | "NEGOTIATED_VALUE_VARIANCE";

export type CommercialLeakageSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type CommercialLeakageStatus =
  | "OPEN"
  | "RESOLVED"
  | "DISMISSED";

export interface ContractGovernanceOption {
  contractId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  contractStatus: string;
  endDate: string;
  governanceConfigured: boolean;
}

export interface ContractObligation {
  id: string;
  governanceId: string;
  obligationType: ContractObligationType;
  title: string;
  description: string | null;
  dueDate: string;
  critical: boolean;
  status: ContractObligationStatus;
  ownerUserId: string;
  ownerName: string;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CommercialLeakageFinding {
  id: string;
  governanceId: string | null;
  contractId: string | null;
  supplierId: string;
  supplierName: string;

  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;

  negotiationWorkspaceId: string | null;
  negotiationNumber: string | null;

  findingType: CommercialLeakageType;
  severity: CommercialLeakageSeverity;
  status: CommercialLeakageStatus;

  currency: string | null;

  expectedValue: number | null;
  actualValue: number | null;
  leakageAmount: number;

  sourceReference: string | null;
  details: string;

  detectedAt: string;
  lastCheckedAt: string;

  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CommercialGovernanceRecord {
  id: string;

  contractId: string;

  supplierId: string;
  supplierCode: string;
  supplierName: string;

  contractStatus: string;
  contractEndDate: string;

  governanceStatus: CommercialGovernanceStatus;
  renewalStatus: ContractRenewalStatus;

  noticePeriodDays: number;
  noticeDeadline: string;

  baselineContractValue: number;
  currency: string;

  priceEscalationPct: number;
  maxPoVariancePct: number;

  autoRenewal: boolean;

  ownerUserId: string;
  ownerName: string;

  renewalDecisionNote: string | null;
  renewalDecidedAt: string | null;
  renewalDecidedByName: string | null;

  notes: string | null;

  openObligations: number;
  overdueObligations: number;

  openLeakageFindings: number;
  leakageExposure: number;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CommercialGovernanceDetail {
  governance: CommercialGovernanceRecord;
  obligations: ContractObligation[];
  leakageFindings: CommercialLeakageFinding[];
}

export interface CommercialLeakageDiscovery {
  candidatesDetected: number;
  createdFindings: number;
  refreshedFindings: number;
}

export interface CommercialGovernanceSummary {
  currency: string;
  governedContracts: number;
  activeGovernanceRecords: number;
  renewalReviews: number;
  noticesDueWithin30Days: number;
  expiredContracts: number;
  openObligations: number;
  overdueObligations: number;
  openLeakageFindings: number;
  criticalLeakageFindings: number;
  leakageExposure: number;
  governedContractValue: number;
}

export interface CommercialGovernanceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface CommercialGovernanceContext {
  contracts: ContractGovernanceOption[];
  users: CommercialGovernanceUserOption[];
}
