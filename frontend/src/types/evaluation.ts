export interface SupplierQualityScoreInput {
  quotationId: string;
  qualityScore: number;
}

export interface RfqEvaluationInput {
  priceWeight: number;
  deliveryWeight: number;
  supplierRatingWeight: number;
  riskWeight: number;
  qualityWeight: number;
  qualityScores: SupplierQualityScoreInput[];
}

export interface SupplierEvaluation {
  evaluationId: string;
  quotationId: string;
  quotationNumber: string;
  supplierId: string;
  supplierName: string;
  quotationTotal: number;
  leadTimeDays: number;
  supplierRating: number | null;
  supplierRiskLevel:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";
  priceScore: number;
  deliveryScore: number;
  supplierRatingScore: number;
  riskScore: number;
  qualityScore: number;
  weightedTotalScore: number;
  rankPosition: number;
  recommended: boolean;
}

export interface RfqEvaluation {
  rfqId: string;
  rfqNumber: string;
  priceWeight: number;
  deliveryWeight: number;
  supplierRatingWeight: number;
  riskWeight: number;
  qualityWeight: number;
  recommendedQuotationId: string | null;
  recommendedSupplierName: string | null;
  evaluatedSupplierCount: number;
  scorecards: SupplierEvaluation[];
}

export interface AwardDecision {
  id: string;
  rfqId: string;
  rfqNumber: string;
  selectedQuotationId: string;
  selectedQuotationNumber: string;
  selectedSupplierId: string;
  selectedSupplierName: string;
  selectedTotalAmount: number;
  recommendedQuotationId: string;
  recommendedSupplierName: string;
  manualOverride: boolean;
  rationale: string;
  decidedByUserId: string;
  decidedByName: string;
  decidedAt: string;
}
