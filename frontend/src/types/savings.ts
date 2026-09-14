export type SavingsOrigin =
  | "MANUAL"
  | "SYSTEM";

export type SavingsType =
  | "HARD_SAVINGS"
  | "COST_AVOIDANCE";

export type SavingsStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "VALIDATED"
  | "REJECTED"
  | "CLOSED";

export type SavingsRealizationSourceType =
  | "MANUAL"
  | "PURCHASE_ORDER";

export interface SavingsRealization {
  id: string;
  sourceType: SavingsRealizationSourceType;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  realizationDate: string;
  amount: number;
  notes: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
}

export interface SavingsInitiative {
  id: string;
  savingsNumber: string;
  origin: SavingsOrigin;
  title: string;
  savingsType: SavingsType;
  status: SavingsStatus;
  fiscalYear: number;
  currency: string;
  category: string | null;

  rfqId: string | null;
  rfqNumber: string | null;

  supplierId: string | null;
  supplierName: string | null;

  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;

  baselineValue: number;
  negotiatedValue: number;
  targetSavings: number;
  realizedSavings: number;
  remainingSavings: number;
  realizationRate: number;

  ownerUserId: string;
  ownerName: string;

  decisionNote: string | null;
  decisionAt: string | null;
  decidedByName: string | null;

  notes: string | null;

  realizations: SavingsRealization[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SavingsSummary {
  fiscalYear: number;
  currency: string;
  totalInitiatives: number;
  validatedInitiatives: number;
  pendingInitiatives: number;
  rejectedInitiatives: number;
  validatedTargetSavings: number;
  realizedSavings: number;
  remainingSavings: number;
  realizationRate: number;
  hardSavings: number;
  costAvoidance: number;
}

export interface SavingsMonthly {
  month: string;
  realizedSavings: number;
  realizationCount: number;
}

export interface SavingsAttribution {
  label: string;
  targetSavings: number;
  realizedSavings: number;
  initiativeCount: number;
  realizationRate: number;
}

export interface SavingsUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface SavingsSupplierOption {
  id: string;
  supplierCode: string;
  legalName: string;
  category: string | null;
}

export interface SavingsRfqOption {
  id: string;
  rfqNumber: string;
  title: string;
  currency: string;
  status: string;
}

export interface SavingsPurchaseOrderOption {
  id: string;
  purchaseOrderNumber: string;
  rfqId: string;
  supplierId: string;
  supplierName: string;
  currency: string;
  totalAmount: number;
  status: string;
}

export interface SavingsContextOptions {
  users: SavingsUserOption[];
  suppliers: SavingsSupplierOption[];
  rfqs: SavingsRfqOption[];
  purchaseOrders: SavingsPurchaseOrderOption[];
  categories: string[];
}

export interface SavingsDiscoveryResult {
  discoveredOpportunities: number;
  createdInitiatives: number;
  updatedInitiatives: number;
  createdRealizations: number;
  updatedRealizations: number;
}
