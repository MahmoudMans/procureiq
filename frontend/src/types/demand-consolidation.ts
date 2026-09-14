import type {
  GuidedBuyingIntakeStatus,
  GuidedBuyingRoute,
} from "@/types/guided-buying";

export type DemandBundleStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "SOURCING"
  | "CLOSED"
  | "CANCELLED";

export interface DemandCandidateIntake {
  id: string;
  intakeNumber: string;
  title: string;
  departmentId: string;
  departmentName: string;
  category: string;
  currency: string;
  estimatedAmount: number;
  status: GuidedBuyingIntakeStatus;
  guidanceRoute: GuidedBuyingRoute;
  createdAt: string;
}

export interface DemandConsolidationCandidate {
  candidateKey: string;
  category: string;
  currency: string;
  intakeCount: number;
  departmentCount: number;
  totalValue: number;
  expectedLeveragePct: number;
  expectedSavings: number;
  intakes: DemandCandidateIntake[];
}

export interface DemandBundleItem {
  id: string;
  intakeId: string;
  intakeNumber: string;
  title: string;
  departmentId: string;
  departmentName: string;
  estimatedAmount: number;
  intakeStatus: GuidedBuyingIntakeStatus;
  guidanceRoute: GuidedBuyingRoute;
}

export interface DemandBundle {
  id: string;
  bundleNumber: string;
  title: string;
  category: string;
  currency: string;

  status: DemandBundleStatus;
  targetSourcingDate: string;

  consolidatedValue: number;
  expectedLeveragePct: number;
  expectedSavings: number;

  intakeCount: number;
  departmentCount: number;

  ownerUserId: string;
  ownerName: string;

  rationale: string | null;

  decisionNote: string | null;
  decidedAt: string | null;
  decidedByName: string | null;

  linkedRfqId: string | null;
  linkedRfqNumber: string | null;
  linkedRfqTitle: string | null;
  linkedRfqStatus: string | null;

  sourcingStartedAt: string | null;
  closedAt: string | null;

  items: DemandBundleItem[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DemandConsolidationSummary {
  candidateGroups: number;
  candidateIntakes: number;
  candidateValue: number;
  openBundles: number;
  approvedBundles: number;
  sourcingBundles: number;
  closedBundles: number;
  bundledValue: number;
  expectedSavings: number;
}

export interface DemandConsolidationUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface DemandConsolidationRfqOption {
  id: string;
  rfqNumber: string;
  title: string;
  currency: string;
  status: string;
}

export interface DemandConsolidationContext {
  users: DemandConsolidationUserOption[];
  rfqs: DemandConsolidationRfqOption[];
}
