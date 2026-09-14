export type NegotiationWorkspaceStatus =
  | "DRAFT"
  | "ACTIVE"
  | "AGREED"
  | "CLOSED"
  | "CANCELLED";

export type NegotiationScenarioType =
  | "TARGET"
  | "WALK_AWAY"
  | "OPTION"
  | "FINAL";

export type NegotiationRoundSide =
  | "BUYER"
  | "SUPPLIER";

export interface NegotiationScenario {
  id: string;
  workspaceId: string;
  name: string;
  scenarioType: NegotiationScenarioType;
  totalValue: number;
  paymentTermsDays: number;
  leadTimeDays: number;
  warrantyMonths: number;
  volumeCommitment: number | null;
  priceSavings: number;
  savingsPct: number;
  scenarioScore: number;
  preferred: boolean;
  notes: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface NegotiationRound {
  id: string;
  workspaceId: string;
  roundNumber: number;
  actorSide: NegotiationRoundSide;
  offerValue: number;
  paymentTermsDays: number;
  leadTimeDays: number;
  warrantyMonths: number;
  volumeCommitment: number | null;
  notes: string | null;
  createdByUserId: string;
  createdByName: string;
  roundAt: string;
  createdAt: string;
}

export interface NegotiationWorkspace {
  id: string;
  negotiationNumber: string;

  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;

  supplierId: string;
  supplierName: string;
  supplierRiskLevel: string | null;

  baselineQuotationId: string;
  baselineQuotationReference: string;

  status: NegotiationWorkspaceStatus;
  currency: string;

  baselineValue: number;
  targetValue: number | null;
  walkAwayValue: number | null;
  agreedValue: number | null;

  targetSavings: number;
  agreedSavings: number;
  agreedSavingsPct: number;

  agreedScenarioId: string | null;

  ownerUserId: string;
  ownerName: string;

  notes: string | null;

  agreedAt: string | null;
  closedAt: string | null;

  awardedQuotationId: string | null;
  awardedSupplierId: string | null;
  awardedSupplierName: string | null;
  awardedValue: number | null;
  awardSavingsFromBaseline: number | null;
  agreementToAwardDelta: number | null;
  agreementSupplierMatchesAward: boolean | null;

  scenarios: NegotiationScenario[];
  rounds: NegotiationRound[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface NegotiationSummary {
  totalWorkspaces: number;
  draftWorkspaces: number;
  activeWorkspaces: number;
  agreedWorkspaces: number;
  closedWorkspaces: number;
  suppliersInNegotiation: number;
  baselinePipelineValue: number;
  targetSavingsOpportunity: number;
  agreedSavings: number;
  averageAgreedSavingsPct: number;
}

export interface NegotiationQuotationOption {
  id: string;
  quotationReference: string;

  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;

  supplierId: string;
  supplierName: string;
  supplierRiskLevel: string | null;

  currency: string;
  totalAmount: number;
  status: string;
}

export interface NegotiationUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface NegotiationContext {
  quotations: NegotiationQuotationOption[];
  users: NegotiationUserOption[];
}
