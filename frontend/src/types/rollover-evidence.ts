export type EvidenceStatus =
  | "PLAN_DRAFT"
  | "PLAN_REVIEW"
  | "PLAN_APPROVED"
  | "OBSERVING"
  | "EVIDENCE_REVIEW"
  | "VERIFIED"
  | "CLOSED";

export type EvidenceAction =
  | "RECOVERY_RETRY"
  | "WRITE_OFF_ESCALATION"
  | "INVESTIGATION_ESCALATION"
  | "RISK_ACCEPTANCE_ESCALATION";

export type EvidenceResolution =
  | "RECOVERY_CONFIRMED"
  | "WRITE_OFF_CONFIRMED"
  | "INVESTIGATION_CONCLUDED"
  | "RISK_ACCEPTANCE_CONFIRMED"
  | "PARTIAL"
  | "UNRESOLVED";

export interface EvidencePermissions {
  write: boolean;
  manage: boolean;
}

export interface EvidenceCycle {
  id: string;
  rootRolloverId: string;
  rootRolloverNumber: string;
  parentCycleId: string | null;
  sourceSnapshotId: string | null;
  cycleNumber: number;
  title: string;
  currency: string;
  fiscalYear: number;
  status: EvidenceStatus;
  version: number;
  createdAt: string;
}

export interface EvidenceMetrics {
  opening: string;
  recovered: string;
  writeOff: string;
  otherReduction: string;
  reduction: string;
  remaining: string;
  reductionPercent: string;
  itemCount: number;
  observedCount: number;
  complete: boolean;
  disposition:
    | "PENDING_VERIFICATION"
    | "FULLY_RESOLVED"
    | "FURTHER_GOVERNANCE_REQUIRED";
}

export interface EvidenceItem {
  id: string;
  sourceRolloverItemId: string;
  parentItemId: string | null;
  action: EvidenceAction;
  openingAmount: string;
  plan: {
    targetDate: string;
    rationale: string;
  } | null;
  observation: {
    resolutionType: EvidenceResolution;
    reductionAmount: string;
    remainingAmount: string;
    observedOn: string;
    evidenceReference: string;
    evidenceNote: string;
  } | null;
}

export interface EvidenceDocument {
  schemaVersion: number;
  cycle: EvidenceCycle;
  metrics: EvidenceMetrics;
  items: EvidenceItem[];
  events: {
    version: number;
    type: string;
    actorName: string;
    actorRole: string;
    note: string;
    at: string;
  }[];
}

export interface EvidenceDetail extends EvidenceDocument {
  permissions: EvidencePermissions;
  nextCycleId: string | null;
  snapshots: {
    id: string;
    version: number;
    capturedAt: string;
  }[];
}

export interface EvidenceSnapshot {
  id: string;
  capturedAt: string;
  document: EvidenceDocument;
}

export interface EvidenceDashboard {
  permissions: EvidencePermissions;
  sources: {
    id: string;
    number: string;
    title: string;
    currency: string;
    amount: string;
  }[];
  cycles: {
    cycle: EvidenceCycle;
    metrics: EvidenceMetrics;
    isLatest: boolean;
  }[];
  exposure: {
    currency: string;
    original: string;
    remaining: string;
    cumulativeReduction: string;
  }[];
}

export interface EvidenceObservationInput {
  itemId: string;
  version: number;
  resolutionType: EvidenceResolution;
  reductionAmount: string;
  observedOn: string;
  evidenceReference: string;
  evidenceNote: string;
}

export interface EvidencePlanInput {
  itemId: string;
  version: number;
  targetDate: string;
  rationale: string;
}

export interface EvidenceTransitionInput {
  version: number;
  operation: string;
  note: string;
}

// Validate the runtime boundary before treating JSON as application data.
type Check = (value: unknown) => void;

const invalid = (): never => {
  throw new Error(
    "The server returned an invalid rollover evidence contract.",
  );
};

const text: Check = value => {
  if (typeof value !== "string") invalid();
};

const integer: Check = value => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) invalid();
};

const boolean: Check = value => {
  if (typeof value !== "boolean") invalid();
};

const money: Check = value => {
  if (
    typeof value !== "string" ||
    !/^\d+(?:\.\d{1,2})?$/.test(value)
  ) invalid();
};

const enumeration = (...choices: string[]): Check => value => {
  if (
    typeof value !== "string" ||
    !choices.includes(value)
  ) invalid();
};

const nullable = (check: Check): Check => value => {
  if (value !== null) check(value);
};

const array = (check: Check): Check => value => {
  if (!Array.isArray(value)) invalid();
  (value as unknown[]).forEach(check);
};

const object = (fields: Record<string, Check>): Check => value => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) invalid();

  const record = value as Record<string, unknown>;

  for (const [name, check] of Object.entries(fields)) {
    check(record[name]);
  }
};

const permissions = object({
  write: boolean,
  manage: boolean,
});

const cycle = object({
  id: text,
  rootRolloverId: text,
  rootRolloverNumber: text,
  parentCycleId: nullable(text),
  sourceSnapshotId: nullable(text),
  cycleNumber: integer,
  title: text,
  currency: text,
  fiscalYear: integer,
  status: enumeration(
    "PLAN_DRAFT",
    "PLAN_REVIEW",
    "PLAN_APPROVED",
    "OBSERVING",
    "EVIDENCE_REVIEW",
    "VERIFIED",
    "CLOSED",
  ),
  version: integer,
  createdAt: text,
});

const metrics = object({
  opening: money,
  recovered: money,
  writeOff: money,
  otherReduction: money,
  reduction: money,
  remaining: money,
  reductionPercent: money,
  itemCount: integer,
  observedCount: integer,
  complete: boolean,
  disposition: enumeration(
    "PENDING_VERIFICATION",
    "FULLY_RESOLVED",
    "FURTHER_GOVERNANCE_REQUIRED",
  ),
});

const action = enumeration(
  "RECOVERY_RETRY",
  "WRITE_OFF_ESCALATION",
  "INVESTIGATION_ESCALATION",
  "RISK_ACCEPTANCE_ESCALATION",
);

const resolution = enumeration(
  "RECOVERY_CONFIRMED",
  "WRITE_OFF_CONFIRMED",
  "INVESTIGATION_CONCLUDED",
  "RISK_ACCEPTANCE_CONFIRMED",
  "PARTIAL",
  "UNRESOLVED",
);

const item = object({
  id: text,
  sourceRolloverItemId: text,
  parentItemId: nullable(text),
  action,
  openingAmount: money,
  plan: nullable(object({
    targetDate: text,
    rationale: text,
  })),
  observation: nullable(object({
    resolutionType: resolution,
    reductionAmount: money,
    remainingAmount: money,
    observedOn: text,
    evidenceReference: text,
    evidenceNote: text,
  })),
});

const schemaVersion: Check = value => {
  if (value !== 1) invalid();
};

const documentFields = {
  schemaVersion,
  cycle,
  metrics,
  items: array(item),
  events: array(object({
    version: integer,
    type: text,
    actorName: text,
    actorRole: text,
    note: text,
    at: text,
  })),
};

const document = object(documentFields);

function checked<T>(value: unknown, check: Check): T {
  check(value);
  return value as T;
}

export const decodeEvidenceDetail = (
  value: unknown,
): EvidenceDetail => checked(
  value,
  object({
    ...documentFields,
    permissions,
    nextCycleId: nullable(text),
    snapshots: array(object({
      id: text,
      version: integer,
      capturedAt: text,
    })),
  }),
);

export const decodeEvidenceSnapshot = (
  value: unknown,
): EvidenceSnapshot => checked(
  value,
  object({
    id: text,
    capturedAt: text,
    document,
  }),
);

export const decodeEvidenceDashboard = (
  value: unknown,
): EvidenceDashboard => checked(
  value,
  object({
    permissions,
    sources: array(object({
      id: text,
      number: text,
      title: text,
      currency: text,
      amount: money,
    })),
    cycles: array(object({
      cycle,
      metrics,
      isLatest: boolean,
    })),
    exposure: array(object({
      currency: text,
      original: money,
      remaining: money,
      cumulativeReduction: money,
    })),
  }),
);
