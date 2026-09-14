export type ProcurementPolicyType =
  | "COMPETITIVE_SOURCING_THRESHOLD"
  | "PURCHASE_ORDER_REQUIRED_THRESHOLD"
  | "CONTRACT_REQUIRED_THRESHOLD"
  | "HIGH_RISK_SUPPLIER_RESTRICTION";

export type ProcurementPolicySeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type ProcurementPolicyStatus =
  | "ACTIVE"
  | "INACTIVE";

export type PolicyViolationSourceType =
  | "PURCHASE_REQUEST"
  | "PURCHASE_ORDER";

export type PolicyViolationStatus =
  | "OPEN"
  | "WAIVER_REQUESTED"
  | "WAIVED"
  | "RESOLVED"
  | "DISMISSED";

export type PolicyWaiverStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type PolicyEvidenceType =
  | "NOTE"
  | "REFERENCE";

export interface ProcurementPolicy {
  id: string;
  policyCode: string;
  name: string;
  description: string | null;
  policyType: ProcurementPolicyType;
  severity: ProcurementPolicySeverity;
  status: ProcurementPolicyStatus;
  thresholdAmount: number | null;
  currency: string | null;
  requiresWaiver: boolean;
  ownerUserId: string;
  ownerName: string;
  openViolations: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PolicyViolation {
  id: string;

  policyId: string;
  policyCode: string;
  policyName: string;
  policyType: ProcurementPolicyType;

  sourceType: PolicyViolationSourceType;
  sourceId: string;
  sourceReference: string | null;

  sourceAmount: number | null;
  currency: string | null;

  severity: ProcurementPolicySeverity;
  status: PolicyViolationStatus;

  details: string;
  policyOwnerName: string;

  sourceHref: string;

  detectedAt: string;
  lastCheckedAt: string;

  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PolicyWaiver {
  id: string;
  waiverNumber: string;
  violationId: string;
  rationale: string;
  status: PolicyWaiverStatus;
  requestedByUserId: string;
  requestedByName: string;
  requestedAt: string;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PolicyEvidence {
  id: string;
  violationId: string;
  evidenceType: PolicyEvidenceType;
  content: string;
  addedByUserId: string;
  addedByName: string;
  createdAt: string;
}

export interface PolicyViolationDetail {
  violation: PolicyViolation;
  waivers: PolicyWaiver[];
  evidence: PolicyEvidence[];
}

export interface PolicyEvaluation {
  policiesEvaluated: number;
  candidatesEvaluated: number;
  createdViolations: number;
  refreshedViolations: number;
}

export interface PolicyComplianceSummary {
  totalPolicies: number;
  activePolicies: number;
  totalViolations: number;
  openViolations: number;
  criticalViolations: number;
  highViolations: number;
  pendingWaivers: number;
  waivedViolations: number;
  resolvedViolations: number;
  resolutionRate: number;
}

export interface ComplianceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface PolicyComplianceContext {
  users: ComplianceUserOption[];
}
