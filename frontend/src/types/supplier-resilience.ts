export type SupplierResilienceProfileStatus =
  | "ACTIVE"
  | "INACTIVE";

export type SupplierCriticality =
  | "STANDARD"
  | "CRITICAL"
  | "STRATEGIC";

export type SupplierCapacityStatus =
  | "UNKNOWN"
  | "ADEQUATE"
  | "CONSTRAINED"
  | "AT_RISK";

export type SupplierResilienceBand =
  | "RESILIENT"
  | "WATCH"
  | "VULNERABLE"
  | "CRITICAL";

export type ResilienceActionType =
  | "QUALIFY_ALTERNATE"
  | "REDUCE_DEPENDENCY"
  | "CONTRACT_COVERAGE"
  | "CAPACITY_REVIEW"
  | "GEOGRAPHIC_DIVERSIFICATION"
  | "PERFORMANCE_IMPROVEMENT"
  | "OTHER";

export type ResilienceActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface SupplierResilienceIntelligence {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  category: string | null;
  country: string | null;
  supplierRating: number | null;
  supplierRiskLevel: string | null;

  profileId: string | null;
  profileStatus: SupplierResilienceProfileStatus | null;
  criticality: SupplierCriticality;
  capacityStatus: SupplierCapacityStatus;
  dependencyTolerancePct: number;
  minimumAlternates: number;
  businessImpact: string | null;
  capacityNotes: string | null;
  profileNotes: string | null;
  profileOwnerUserId: string | null;
  profileOwnerName: string | null;

  currency: string;

  supplierSpend: number;
  portfolioSpend: number;
  spendSharePct: number;

  categorySpend: number;
  categorySharePct: number;

  countrySpend: number;
  countrySpendSharePct: number;

  alternateSupplierCount: number;
  alternateGap: number;

  singleSource: boolean;
  dependencyToleranceBreached: boolean;

  latestPerformanceScore: number | null;
  openCorrectiveActions: number;
  activeContractCoverage: boolean;

  resilienceScore: number;
  resilienceBand: SupplierResilienceBand;

  openMitigationActions: number;
  overdueMitigationActions: number;
}

export interface SupplierAlternative {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  country: string | null;
  rating: number | null;
  riskLevel: string | null;
  latestPerformanceScore: number | null;
}

export interface ResilienceAction {
  id: string;
  profileId: string;
  actionType: ResilienceActionType;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  dueDate: string;
  status: ResilienceActionStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierResilienceDetail {
  intelligence: SupplierResilienceIntelligence;
  alternatives: SupplierAlternative[];
  mitigationActions: ResilienceAction[];
}

export interface SupplierCountryConcentration {
  country: string;
  currency: string;
  supplierCount: number;
  spend: number;
  spendSharePct: number;
}

export interface SupplierResilienceSummary {
  currency: string;
  suppliersEvaluated: number;
  strategicCriticalSuppliers: number;
  vulnerableSuppliers: number;
  criticalResilienceSuppliers: number;
  singleSourceSuppliers: number;
  dependencyBreaches: number;
  constrainedCapacitySuppliers: number;
  openMitigationActions: number;
  overdueMitigationActions: number;
  averageResilienceScore: number;
  spendAtRisk: number;
}

export interface ResilienceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface SupplierResilienceContext {
  users: ResilienceUserOption[];
}
