export type AlignmentSourceType =
  | "CATEGORY_INITIATIVE"
  | "IMPROVEMENT_INITIATIVE"
  | "EXECUTION_PORTFOLIO"
  | "RISK_ESCALATION";

export type AlignmentRole =
  | "PRIMARY"
  | "ENABLER"
  | "VALUE_DELIVERY"
  | "RISK_MITIGATION";

export type AlignmentStatus =
  | "UNALIGNED"
  | "PARTIAL"
  | "FULL"
  | "CONFLICT";

export type AlignmentHealth =
  | "EXCELLENT"
  | "STRONG"
  | "WATCH"
  | "CRITICAL";

export interface AlignmentLink {
  id: string;
  objectiveId: string;
  objectiveNumber: string;
  objectiveTitle: string;
  sourceType: AlignmentSourceType;
  sourceEntityId: string;
  sourceReference: string;
  sourceTitle: string;
  alignmentRole: AlignmentRole;
  allocationPct: number;
  rationale: string;
  createdByName: string;
  createdAt: string;
}

export interface AlignmentSource {
  sourceType: AlignmentSourceType;
  sourceEntityId: string;
  sourceReference: string;
  sourceTitle: string;
  sourceStatus: string;
  strategicValue: number;
  riskExposure: number;
  riskScore: number;
  dueDate: string | null;
  directAllocationPct: number;
  linkedObjectiveCount: number;
  okrContributionCount: number;
  alignmentStatus: AlignmentStatus;
  splitCommitment: boolean;
  deadlineConflictCount: number;
}

export interface ObjectiveAlignmentSummary {
  id: string;
  objectiveNumber: string;
  title: string;
  status: string;
  endDate: string;
  ownerName: string;
  okrProgressPct: number;
  okrHealth: string;
  linkedSourceCount: number;
  allocatedStrategicValue: number;
  coveredRiskExposure: number;
  deadlineConflictCount: number;
}

export interface StrategicAlignmentSummary {
  objectiveCount: number;
  objectivesWithAlignment: number;
  candidateSourceCount: number;
  alignedSourceCount: number;
  unalignedSourceCount: number;
  fullyAlignedSourceCount: number;
  partiallyAlignedSourceCount: number;
  splitCommitmentCount: number;
  deadlineConflictCount: number;
  strategicValueTotal: number;
  strategicValueAligned: number;
  riskExposureTotal: number;
  riskExposureAligned: number;
  sourceCoveragePct: number;
  objectiveCoveragePct: number;
  valueCoveragePct: number;
  riskCoveragePct: number;
  scheduleAlignmentPct: number;
  alignmentScore: number;
  alignmentHealth: AlignmentHealth;
}

export interface AlignmentReviewSummary {
  id: string;
  reviewNumber: string;
  currency: string;
  fiscalYear: number;
  alignmentScore: number;
  alignmentHealth: AlignmentHealth;
  alignedSourceCount: number;
  unalignedSourceCount: number;
  deadlineConflictCount: number;
  capturedByName: string;
  capturedAt: string;
}

export interface StrategicAlignmentDashboard {
  currency: string;
  fiscalYear: number;
  summary: StrategicAlignmentSummary;
  objectives: ObjectiveAlignmentSummary[];
  sources: AlignmentSource[];
  reviews: AlignmentReviewSummary[];
}

export interface ObjectiveAlignmentDetail {
  objective: ObjectiveAlignmentSummary;
  links: AlignmentLink[];
  candidateSources: AlignmentSource[];
}

export interface AlignmentReviewDetail {
  review: AlignmentReviewSummary;
  summary: StrategicAlignmentSummary;
  sources: AlignmentSource[];
}
