export type SustainabilityAssessmentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type SustainabilityRating =
  | "LEADING"
  | "GOOD"
  | "MODERATE"
  | "HIGH_RISK"
  | "CRITICAL";

export type SustainabilityDeclarationType =
  | "HUMAN_RIGHTS"
  | "MODERN_SLAVERY"
  | "ANTI_BRIBERY"
  | "ENVIRONMENTAL_POLICY"
  | "RESPONSIBLE_SOURCING"
  | "DIVERSITY_INCLUSION";

export type SustainabilityDeclarationStatus =
  | "MISSING"
  | "DECLARED"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED";

export type SustainabilityActionType =
  | "CARBON_REDUCTION"
  | "LABOR_PRACTICES"
  | "GOVERNANCE_CONTROL"
  | "RESPONSIBLE_SOURCING"
  | "EVIDENCE_REMEDIATION"
  | "OTHER";

export type SustainabilityActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface SustainabilityDeclaration {
  id: string;
  declarationType: SustainabilityDeclarationType;
  mandatory: boolean;
  documentReference: string | null;
  expiryDate: string | null;
  status: SustainabilityDeclarationStatus;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface SustainabilityAction {
  id: string;
  assessmentId: string;
  actionType: SustainabilityActionType;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  dueDate: string;
  status: SustainabilityActionStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SustainabilityAssessment {
  id: string;
  assessmentNumber: string;

  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory: string | null;
  supplierCountry: string | null;
  supplierRiskLevel: string | null;

  status: SustainabilityAssessmentStatus;

  environmentalScore: number;
  socialScore: number;
  governanceScore: number;
  overallScore: number;

  rating: SustainabilityRating;

  assessmentDate: string;
  nextReviewDate: string | null;

  ownerUserId: string;
  ownerName: string;

  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;

  notes: string | null;

  mandatoryDeclarations: number;
  verifiedMandatoryDeclarations: number;

  onboardingClearance: boolean;
  responsibleSourcingEligible: boolean;

  openActions: number;
  overdueActions: number;

  declarations: SustainabilityDeclaration[];
  actions: SustainabilityAction[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SustainabilityPortfolioItem {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  category: string | null;
  country: string | null;
  supplierRiskLevel: string | null;

  currency: string;
  spend: number;

  assessmentId: string | null;
  assessmentNumber: string | null;
  assessmentStatus: SustainabilityAssessmentStatus | null;
  rating: SustainabilityRating | null;

  environmentalScore: number | null;
  socialScore: number | null;
  governanceScore: number | null;
  overallScore: number | null;

  nextReviewDate: string | null;

  onboardingClearance: boolean;
  responsibleSourcingEligible: boolean;

  openActions: number;
  overdueActions: number;
}

export interface SustainabilityCategoryExposure {
  category: string;
  supplierCount: number;
  assessedSuppliers: number;
  highRiskSuppliers: number;
  totalSpend: number;
  assessedSpend: number;
  riskSpend: number;
  coveragePct: number;
}

export interface SustainabilitySummary {
  currency: string;

  activeSuppliers: number;
  assessedSuppliers: number;
  assessmentCoveragePct: number;

  highRiskSuppliers: number;
  responsibleSourcingEligibleSuppliers: number;

  totalSpend: number;
  assessedSpend: number;
  spendAssessmentCoveragePct: number;
  spendAtEsgRisk: number;
  unassessedSpend: number;

  reassessmentsDueWithin30Days: number;
  expiredAssessments: number;

  openImprovementActions: number;
  overdueImprovementActions: number;
}

export interface SustainabilitySupplierOption {
  id: string;
  supplierCode: string;
  supplierName: string;
  category: string | null;
  country: string | null;
  status: string | null;
  riskLevel: string | null;
}

export interface SustainabilityUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface SustainabilityContext {
  suppliers: SustainabilitySupplierOption[];
  users: SustainabilityUserOption[];
}
