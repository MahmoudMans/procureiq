export type SupplierOnboardingCaseType =
  | "INITIAL"
  | "REQUALIFICATION";

export type SupplierOnboardingStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export type SupplierOnboardingRiskTier =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type QualificationComplianceStatus =
  | "PENDING"
  | "COMPLIANT"
  | "NON_COMPLIANT";

export type OnboardingEvidenceType =
  | "COMPANY_REGISTRATION"
  | "TAX_REGISTRATION"
  | "BANK_INFORMATION"
  | "INSURANCE"
  | "COMPLIANCE_DECLARATION";

export type OnboardingEvidenceStatus =
  | "MISSING"
  | "UPLOADED"
  | "VALID"
  | "REJECTED"
  | "EXPIRED";

export type OnboardingApprovalLevel =
  | "PROCUREMENT"
  | "COMPLIANCE"
  | "RISK";

export type OnboardingApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface QualificationQuestion {
  id: string;
  questionCode: string;
  questionLabel: string;
  mandatory: boolean;
  answerValue: string | null;
  complianceStatus: QualificationComplianceStatus;
  answeredByUserId: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
}

export interface OnboardingEvidence {
  id: string;
  evidenceType: OnboardingEvidenceType;
  mandatory: boolean;
  documentReference: string | null;
  expiryDate: string | null;
  status: OnboardingEvidenceStatus;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface OnboardingApproval {
  id: string;
  approvalLevel: OnboardingApprovalLevel;
  required: boolean;
  status: OnboardingApprovalStatus;
  decidedByName: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
}

export interface SupplierOnboardingCase {
  id: string;
  caseNumber: string;

  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory: string | null;
  supplierCountry: string | null;
  supplierStatus: string | null;
  supplierRiskLevel: string | null;

  caseType: SupplierOnboardingCaseType;
  status: SupplierOnboardingStatus;
  riskTier: SupplierOnboardingRiskTier;

  ownerUserId: string;
  ownerName: string;

  activationClearance: boolean;
  activationEligible: boolean;

  activationGateReasons: string[];

  mandatoryQuestions: number;
  answeredMandatoryQuestions: number;
  nonCompliantMandatoryQuestions: number;

  mandatoryEvidence: number;
  validMandatoryEvidence: number;

  requiredApprovals: number;
  approvedRequiredApprovals: number;

  slaDueAt: string;
  slaOverdue: boolean;
  daysOpen: number;

  submittedAt: string | null;
  decisionAt: string | null;

  requalificationDueDate: string | null;
  requalificationDueWithin30Days: boolean;
  requalificationExpired: boolean;

  decisionNote: string | null;
  notes: string | null;

  questions: QualificationQuestion[];
  evidence: OnboardingEvidence[];
  approvals: OnboardingApproval[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierOnboardingSummary {
  totalCases: number;
  draftCases: number;
  inReviewCases: number;
  overdueCases: number;
  activationReadyCases: number;
  approvedCases: number;
  rejectedCases: number;
  requalificationDueWithin30Days: number;
  requalificationExpired: number;
  highCriticalRiskCases: number;
}

export interface SupplierOnboardingSupplierOption {
  id: string;
  supplierCode: string;
  supplierName: string;
  category: string | null;
  country: string | null;
  status: string | null;
  riskLevel: string | null;
}

export interface SupplierOnboardingUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface SupplierOnboardingContext {
  suppliers: SupplierOnboardingSupplierOption[];
  users: SupplierOnboardingUserOption[];
}
