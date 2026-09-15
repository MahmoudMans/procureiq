export type PersistencePlanStatus =
  | "ACTIVE"
  | "READY_FOR_REVIEW"
  | "IN_REMEDIATION"
  | "SUSTAINED"
  | "CLOSED";

export type PersistenceHealth =
  | "UNASSESSED"
  | "SUSTAINED"
  | "WATCH"
  | "DECAYING"
  | "REGRESSED";

export type PersistenceValidationDecision =
  | "VALIDATED"
  | "REJECTED";

export type PersistenceVerificationDecision =
  | "SUSTAINED"
  | "REMEDIATION_REQUIRED";

export type PersistenceControlStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface PersistenceUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface PersistenceCandidate {
  commitmentId: string;
  commitmentNumber: string;
  roadmapId: string;
  roadmapNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  executionOwnerName: string;
  currency: string;
  fiscalYear: number;
  completedOn: string;
  validatedContributionPoints: number;
}

export interface PersistenceObservation {
  id: string;
  planId: string;
  observedOn: string;
  reportedContributionPoints: number;
  evidenceNote: string;
  reportedByName: string;
  reportedAt: string;
  validationDecision: PersistenceValidationDecision | null;
  validatedContributionPoints: number | null;
  validationNote: string | null;
  validatedByName: string | null;
  validatedAt: string | null;
}

export interface PersistenceControl {
  id: string;
  planId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  dueDate: string;
  status: PersistenceControlStatus;
  overdue: boolean;
  completionEvidence: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  version: number;
}

export interface PersistenceVerification {
  id: string;
  planId: string;
  decision: PersistenceVerificationDecision;
  persistencePct: number;
  decayPoints: number;
  persistenceHealth: PersistenceHealth;
  verificationNote: string;
  verifiedByName: string;
  verifiedAt: string;
}

export interface PersistencePlan {
  id: string;
  planNumber: string;
  commitmentId: string;
  commitmentNumber: string;
  roadmapId: string;
  roadmapNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  executionOwnerName: string;
  persistenceOwnerUserId: string;
  persistenceOwnerName: string;
  currency: string;
  fiscalYear: number;
  baselineValidatedContributionPoints: number;
  observationStartDate: string;
  observationEndDate: string;
  minimumPersistencePct: number;
  persistenceObjective: string;
  status: PersistencePlanStatus;

  assessed: boolean;
  currentValidatedContributionPoints: number;
  persistencePct: number;
  decayPoints: number;
  persistenceHealth: PersistenceHealth;

  observationDue: boolean;
  verificationEligible: boolean;
  observationCount: number;
  verificationCount: number;
  openControlCount: number;
  overdueControlCount: number;

  closeNote: string | null;
  closedByName: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PersistencePlanDetail {
  plan: PersistencePlan;
  users: PersistenceUserOption[];
  observations: PersistenceObservation[];
  controls: PersistenceControl[];
  verifications: PersistenceVerification[];
}

export interface OutcomePersistenceSummary {
  candidateCount: number;
  activePlanCount: number;
  remediationPlanCount: number;
  readyForReviewCount: number;
  sustainedPlanCount: number;
  dueObservationCount: number;
  decayedPlanCount: number;
  overdueControlCount: number;
  assessedBaselinePoints: number;
  currentValidatedPoints: number;
  totalDecayPoints: number;
  averagePersistencePct: number;
  portfolioHealth: PersistenceHealth;
}

export interface PersistenceReviewSummary {
  id: string;
  reviewNumber: string;
  activePlanCount: number;
  remediationPlanCount: number;
  readyForReviewCount: number;
  sustainedPlanCount: number;
  dueObservationCount: number;
  decayedPlanCount: number;
  overdueControlCount: number;
  assessedBaselinePoints: number;
  currentValidatedPoints: number;
  totalDecayPoints: number;
  averagePersistencePct: number;
  portfolioHealth: PersistenceHealth;
  capturedByName: string;
  capturedAt: string;
}

export interface PersistenceReviewItem {
  planId: string;
  planNumber: string;
  commitmentNumber: string;
  initiativeNumber: string;
  initiativeTitle: string;
  persistenceOwnerName: string;
  planStatus: PersistencePlanStatus;
  baselineValidatedPoints: number;
  currentValidatedPoints: number;
  persistencePct: number;
  decayPoints: number;
  persistenceHealth: PersistenceHealth;
  observationDue: boolean;
  verificationEligible: boolean;
  openControlCount: number;
  overdueControlCount: number;
  observationCount: number;
  verificationCount: number;
}

export interface PersistenceReviewDetail {
  review: PersistenceReviewSummary;
  items: PersistenceReviewItem[];
}

export interface OutcomePersistenceDashboard {
  summary: OutcomePersistenceSummary;
  users: PersistenceUserOption[];
  candidates: PersistenceCandidate[];
  plans: PersistencePlan[];
  reviews: PersistenceReviewSummary[];
}
