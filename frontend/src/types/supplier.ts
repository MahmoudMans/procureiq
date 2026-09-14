export type SupplierStatus =
  | "ACTIVE"
  | "ONBOARDING"
  | "SUSPENDED"
  | "INACTIVE";

export type SupplierRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface Supplier {
  id: string;
  supplierCode: string;
  legalName: string;
  tradingName: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  country: string;
  city: string | null;
  category: string;
  status: SupplierStatus;
  riskLevel: SupplierRiskLevel;
  rating: number | null;
  onTimeDeliveryRate: number | null;
  totalSpend: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierSummary {
  totalSuppliers: number;
  activeSuppliers: number;
  onboardingSuppliers: number;
  highRiskSuppliers: number;
  averageRating: number;
  totalSpend: number;
  averageOnTimeDeliveryRate: number;
}

export interface SupplierFilters {
  query?: string;
  status?: SupplierStatus;
  riskLevel?: SupplierRiskLevel;
}

export interface CreateSupplierInput {
  supplierCode: string;
  legalName: string;
  tradingName?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
  country: string;
  city?: string;
  category: string;
  status?: SupplierStatus;
  riskLevel?: SupplierRiskLevel;
  rating?: number;
  onTimeDeliveryRate?: number;
}
