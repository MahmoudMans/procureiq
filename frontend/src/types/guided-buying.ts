export type GuidedBuyingIntakeStatus =
  | "DRAFT"
  | "READY"
  | "CONVERTED"
  | "CANCELLED";

export type GuidedBuyingRoute =
  | "DIRECT_BUY"
  | "COMPETITIVE_SOURCING"
  | "PURCHASE_ORDER_CONTROL"
  | "CONTRACT_CONTROL"
  | "RISK_REVIEW"
  | "MULTI_CONTROL";

export interface GuidedBuyingTemplate {
  id: string;
  templateCode: string;
  name: string;
  description: string | null;
  category: string;
  defaultTitle: string | null;
  defaultCurrency: string;
  defaultEstimatedAmount: number | null;
  defaultDepartmentId: string | null;
  defaultDepartmentName: string | null;
  active: boolean;
  ownerUserId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PreferredSupplier {
  id: string;
  category: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCountry: string | null;
  supplierRiskLevel: string | null;
  supplierRating: number;
  preferenceRank: number;
  active: boolean;
  notes: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GuidedBuyingRecommendation {
  route: GuidedBuyingRoute;
  summary: string;
  signals: string[];
  preferredSuppliers: PreferredSupplier[];
}

export interface GuidedBuyingIntake {
  id: string;
  intakeNumber: string;
  title: string;
  description: string | null;

  departmentId: string;
  departmentName: string;

  category: string;
  currency: string;
  estimatedAmount: number;

  supplierId: string | null;
  supplierName: string | null;
  supplierRiskLevel: string | null;

  templateId: string | null;
  templateCode: string | null;
  templateName: string | null;

  requesterUserId: string;
  requesterName: string;

  status: GuidedBuyingIntakeStatus;
  guidanceRoute: GuidedBuyingRoute;
  guidanceSummary: string;

  linkedPurchaseRequestId: string | null;
  linkedRequestNumber: string | null;
  linkedRequestStatus: string | null;

  notes: string | null;

  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GuidedBuyingSummary {
  totalIntakes: number;
  draftIntakes: number;
  readyIntakes: number;
  convertedIntakes: number;
  competitiveSourcingRoutes: number;
  riskReviewRoutes: number;
  multiControlRoutes: number;
  activeTemplates: number;
  activePreferredSuppliers: number;
  openPipelineValue: number;
}

export interface GuidedBuyingDepartmentOption {
  id: string;
  name: string;
}

export interface GuidedBuyingUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface GuidedBuyingRequestOption {
  id: string;
  requestNumber: string;
  title: string;
  departmentId: string;
  departmentName: string;
  status: string;
  currency: string;
  estimatedTotal: number;
}

export interface GuidedBuyingContext {
  departments: GuidedBuyingDepartmentOption[];
  users: GuidedBuyingUserOption[];
  templates: GuidedBuyingTemplate[];
  preferredSuppliers: PreferredSupplier[];
  purchaseRequests: GuidedBuyingRequestOption[];
  categories: string[];
}
