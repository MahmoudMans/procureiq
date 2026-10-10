"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  FileCheck2,
  Gauge,
  Goal,
  Hourglass,
  Info,
  Plus,
  RefreshCw,
  Send,
  Target,
  TrendingDown,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  Field,
  KpiGrid,
  type KpiItem,
  Meter,
  type MeterTone,
  Modal,
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  closeReinvestmentPersistenceCase,
  getReinvestmentPersistenceCase,
  recordReinvestmentPersistenceObservation,
  reviewReinvestmentPersistenceCase,
  submitReinvestmentPersistenceForReview,
  validateReinvestmentPersistenceObservation,
} from "@/lib/api";
import type { ReinvestmentPersistenceCaseDetail } from "@/types/reinvestment-persistence";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type PersistenceCase = ReinvestmentPersistenceCaseDetail["persistenceCase"];
type Observation = ReinvestmentPersistenceCaseDetail["observations"][number];
type ReviewRecord = ReinvestmentPersistenceCaseDetail["reviews"][number];
type ObservationField = "date" | "value" | "evidence";
type ValidationField = "value" | "note";
type ValidationChoice = "VALIDATED" | "REJECTED";
type RationaleRequest = { kind: "SUSTAIN" } | { kind: "REMEDIATE" } | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function CaseBadge({ status }: { status: string }) {
  switch (status) {
    case "REMEDIATION_REQUIRED":
      return <StatusBadge value="AT_RISK" label="Remediation required" />;

    case "READY_FOR_REVIEW":
      return <StatusBadge value="IN_REVIEW" label="Ready for review" />;

    case "SUSTAINED":
      return <StatusBadge value="COMPLETED" label="Sustained" />;

    default:
      return <StatusBadge value={status} label={readable(status)} />;
  }
}

function ValidationBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return <StatusBadge value="PENDING" label="Awaiting validation" />;
  }

  return <StatusBadge value={decision} label={readable(decision)} />;
}

function ReviewBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "SUSTAINED":
      return <StatusBadge value="COMPLETED" label="Sustained" />;

    case "REMEDIATION_REQUIRED":
      return <StatusBadge value="AT_RISK" label="Remediation required" />;

    default:
      return <StatusBadge value={decision} label={readable(decision)} />;
  }
}

function ProgressLine({
  pct,
  tone,
  caption,
  label,
}: {
  pct: number;
  tone: MeterTone;
  caption: string;
  label: string;
}) {
  return (
    <div className="kit-meter-wrap">
      <Meter value={clampPercent(pct)} max={100} tone={tone} ariaLabel={label} />

      <span className="kit-meter-caption">{caption}</span>
    </div>
  );
}

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  cancelLabel?: string;
  tone: "primary" | "danger";
  done: string;
}

function rationaleCopy(request: RationaleRequest, persistenceCase: PersistenceCase): RationaleCopy {
  switch (request.kind) {
    case "SUSTAIN": {
      const short =
        persistenceCase.valuePersistencePct < persistenceCase.minimumValuePersistencePct - 0.05 ||
        persistenceCase.efficiencyRetentionPct <
          persistenceCase.minimumEfficiencyRetentionPct - 0.05;

      return {
        eyebrow: "Independent persistence review",
        title: "Mark as sustained",
        description: `${persistenceCase.persistenceCaseNumber} will be marked sustained with value persistence of ${persistenceCase.valuePersistencePct.toFixed(1)}% (minimum ${persistenceCase.minimumValuePersistencePct.toFixed(1)}%) and efficiency retention of ${persistenceCase.efficiencyRetentionPct.toFixed(1)}% (minimum ${persistenceCase.minimumEfficiencyRetentionPct.toFixed(1)}%).${short ? " At least one of these is below its minimum, so the rationale should explain why the case is sustained." : ""}`,
        label: "Review rationale",
        placeholder: "Why is the recycled-capital value judged sustained?",
        confirm: "Mark sustained",
        busy: "Recording…",
        tone: "primary",
        done: "Persistence sustained",
      };
    }

    case "REMEDIATE":
      return {
        eyebrow: "Independent persistence review",
        title: "Require remediation",
        description: `${persistenceCase.persistenceCaseNumber} will go back into remediation. New persistence observations are needed before it can be submitted for review again.`,
        label: "Review rationale",
        placeholder: "What needs to be remediated?",
        confirm: "Require remediation",
        busy: "Recording…",
        cancelLabel: "Go back",
        tone: "danger",
        done: "Remediation required",
      };

    case "CLOSE":
      return {
        eyebrow: "Governance closure",
        title: "Close persistence case",
        description: `${persistenceCase.persistenceCaseNumber} was sustained. Closing it finishes the governance lifecycle.`,
        label: "Closure note",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close persistence case",
        busy: "Closing…",
        tone: "primary",
        done: "Persistence case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<ReinvestmentPersistenceCaseDetail> {
  switch (request.kind) {
    case "SUSTAIN":
      return reviewReinvestmentPersistenceCase(caseId, {
        decision: "SUSTAINED",
        reviewNote: note,
      });

    case "REMEDIATE":
      return reviewReinvestmentPersistenceCase(caseId, {
        decision: "REMEDIATION_REQUIRED",
        reviewNote: note,
      });

    case "CLOSE":
      return closeReinvestmentPersistenceCase(caseId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ObservationColumnOptions {
  currency: string;
  canValidate: boolean;
  busy: boolean;
  onValidate: (observation: Observation) => void;
}

function buildObservationColumns(options: ObservationColumnOptions): Column<Observation>[] {
  const { currency } = options;

  return [
    {
      id: "observed",
      header: "Observed",
      sortValue: (item) => String(item.observedOn ?? ""),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{showDate(item.observedOn)}</strong>

          <small>
            {item.reportedByName ? `By ${item.reportedByName}` : ""}
            {item.reportedAt ? ` · ${formatDateTime(item.reportedAt)}` : ""}
          </small>
        </div>
      ),
    },
    {
      id: "reported",
      header: "Reported current annualized",
      align: "right",
      sortValue: (item) => item.reportedCurrentAnnualizedValueAmount,
      cell: (item) => <strong>{money(item.reportedCurrentAnnualizedValueAmount, currency)}</strong>,
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: (item) => <span>{item.evidenceNote}</span>,
    },
    {
      id: "validation",
      header: "Validation",
      sortValue: (item) => (item.validationDecision ? String(item.validationDecision) : ""),
      cell: (item) => (
        <div className="kit-cell-stack">
          <ValidationBadge
            decision={item.validationDecision ? String(item.validationDecision) : null}
          />

          {item.validationNote ? <small>{item.validationNote}</small> : null}

          {item.validatedByName ? <small>By {item.validatedByName}</small> : null}
        </div>
      ),
    },
    {
      id: "validated",
      header: "Validated annualized",
      align: "right",
      sortValue: (item) => item.validatedCurrentAnnualizedValueAmount ?? null,
      cell: (item) =>
        typeof item.validatedCurrentAnnualizedValueAmount === "number" ? (
          <strong>{money(item.validatedCurrentAnnualizedValueAmount, currency)}</strong>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 120,
      cell: (item) =>
        options.canValidate && !item.validationDecision ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onValidate(item)}
          >
            <BadgeCheck size={14} />
            Validate
          </button>
        ) : null,
    },
  ];
}

function buildReviewColumns(): Column<ReviewRecord>[] {
  return [
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => <ReviewBadge decision={String(item.decision)} />,
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.health),
      cell: (item) => (
        <StatusBadge value={String(item.health)} label={readable(String(item.health))} />
      ),
    },
    {
      id: "persistence",
      header: "Value persistence",
      align: "right",
      sortValue: (item) => item.valuePersistencePct,
      cell: (item) => `${item.valuePersistencePct.toFixed(1)}%`,
    },
    {
      id: "efficiency",
      header: "Efficiency retention",
      align: "right",
      sortValue: (item) => item.efficiencyRetentionPct,
      cell: (item) => `${item.efficiencyRetentionPct.toFixed(1)}%`,
    },
    {
      id: "roi",
      header: "Projected ROI",
      align: "right",
      sortValue: (item) => item.currentProjectedRoiPct,
      cell: (item) => `${item.currentProjectedRoiPct.toFixed(1)}%`,
    },
    {
      id: "variance",
      header: "ROI variance",
      align: "right",
      sortValue: (item) => item.roiVariancePct,
      cell: (item) => `${item.roiVariancePct.toFixed(1)} pts`,
    },
    {
      id: "note",
      header: "Rationale",
      cell: (item) => <span>{item.reviewNote}</span>,
    },
    {
      id: "by",
      header: "Reviewed by",
      sortValue: (item) => String(item.reviewedByName ?? "").toLowerCase(),
      cell: (item) => item.reviewedByName ?? <span className="kit-text-muted">—</span>,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Record observation modal                                            */
/* ------------------------------------------------------------------ */

interface ObservationModalProps {
  caseId: string;
  persistenceCase: PersistenceCase;
  onClose: () => void;
  onSaved: (updated: ReinvestmentPersistenceCaseDetail, detail: string) => void;
}

function ObservationModal({ caseId, persistenceCase, onClose, onSaved }: ObservationModalProps) {
  const currency = persistenceCase.currency;
  const baseline = persistenceCase.baselineValidatedAnnualizedValueAmount;
  const minimum = persistenceCase.minimumValuePersistencePct;

  const [date, setDate] = useState(() => isoDate(0));
  const [value, setValue] = useState(() => String(baseline));
  const [evidence, setEvidence] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ObservationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valueValid = numberError(value, { min: 0 }) === undefined;
  const pctOfBaseline = valueValid && baseline > 0 ? (Number(value) / baseline) * 100 : null;

  let regressionNote: string | null = null;

  if (pctOfBaseline !== null && Number(value) < baseline - 0.005) {
    regressionNote = `The reported value is ${pctOfBaseline.toFixed(1)}% of the baseline annual value of ${money(baseline, currency)}${
      pctOfBaseline < minimum - 0.05
        ? `, below the minimum persistence of ${minimum.toFixed(1)}%`
        : ""
    }, so the evidence should explain the regression.`;
  }

  function clearError(field: ObservationField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<ObservationField, string>> = {};

    if (!date) {
      next.date = "Choose the observation date.";
    } else if (date > isoDate(0)) {
      next.date = "The observation date cannot be in the future.";
    }

    const problem = numberError(value, { min: 0 });

    if (problem) {
      next.value = problem;
    }

    if (!evidence.trim()) {
      next.evidence = "Describe the evidence behind the observation.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await recordReinvestmentPersistenceObservation(caseId, {
        observedOn: date,
        reportedCurrentAnnualizedValueAmount: Number(value),
        evidenceNote: evidence.trim(),
      });

      onSaved(updated, `${money(Number(value), currency)} annualized`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record persistence evidence.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Longitudinal outcome evidence"
      title="Record persistence observation"
      description="The observation is immutable once recorded. A manager then validates or rejects it."
      size="lg"
      dismissible={!saving}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="persistence-observation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record immutable observation"}
          </button>
        </>
      }
    >
      <form id="persistence-observation-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Observed on" htmlFor="persistence-date" error={errors.date}>
            <input
              id="persistence-date"
              className="kit-field-input"
              type="date"
              value={date}
              aria-invalid={errors.date ? true : undefined}
              onChange={(event) => {
                setDate(event.target.value);
                clearError("date");
              }}
            />
          </Field>

          <div>
            <NumberField
              id="persistence-value"
              label={`Current annualized value (${currency})`}
              min={0}
              step="0.01"
              value={value}
              error={errors.value}
              onChange={(next) => {
                setValue(next);
                clearError("value");
              }}
            />

            <p className="kit-meta-line">
              Baseline annual value: {money(baseline, currency)}
            </p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Evidence" htmlFor="persistence-evidence" error={errors.evidence}>
              <textarea
                id="persistence-evidence"
                className="kit-field-input"
                rows={5}
                value={evidence}
                aria-invalid={errors.evidence ? true : undefined}
                onChange={(event) => {
                  setEvidence(event.target.value);
                  clearError("evidence");
                }}
              />
            </Field>
          </div>
        </div>

        {regressionNote ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            {regressionNote}
          </p>
        ) : null}

        {error ? (
          <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Validate observation modal                                          */
/* ------------------------------------------------------------------ */

interface ValidationModalProps {
  observation: Observation;
  currency: string;
  onClose: () => void;
  onSaved: (updated: ReinvestmentPersistenceCaseDetail, title: string) => void;
}

function ValidationModal({ observation, currency, onClose, onSaved }: ValidationModalProps) {
  const reported = observation.reportedCurrentAnnualizedValueAmount;

  const [decision, setDecision] = useState<ValidationChoice>("VALIDATED");
  const [value, setValue] = useState(() => String(reported));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ValidationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validating = decision === "VALIDATED";
  const valueValid = validating && numberError(value, { min: 0 }) === undefined;
  const haircut = valueValid && Number(value) < reported - 0.005;

  function clearError(field: ValidationField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<ValidationField, string>> = {};

    if (validating) {
      const problem = numberError(value, { min: 0 });

      if (problem) {
        next.value = problem;
      } else if (Number(value) > reported + 0.005) {
        next.value = `Cannot exceed the reported value of ${money(reported, currency)}.`;
      }
    }

    if (!note.trim()) {
      next.note = "A validation note is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await validateReinvestmentPersistenceObservation(observation.id, {
        decision,
        validatedCurrentAnnualizedValueAmount: validating ? Number(value) : undefined,
        validationNote: note.trim(),
      });

      onSaved(updated, validating ? "Observation validated" : "Observation rejected");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to validate persistence evidence.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Independent validation"
      title="Validate observation"
      description={`Reported ${money(reported, currency)} annualized on ${showDate(observation.observedOn)}.`}
      size="md"
      dismissible={!saving}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="persistence-validation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : validating ? "Validate observation" : "Reject observation"}
          </button>
        </>
      }
    >
      <form id="persistence-validation-form" onSubmit={handleSubmit} noValidate>
        <p className="kit-meta-line" style={{ marginBottom: 12 }}>
          Evidence: {observation.evidenceNote}
        </p>

        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Decision" htmlFor="persistence-decision">
              <select
                id="persistence-decision"
                className="kit-field-input"
                value={decision}
                onChange={(event) => {
                  setDecision(event.target.value as ValidationChoice);
                  clearError("value");
                }}
              >
                <option value="VALIDATED">Validate</option>

                <option value="REJECTED">Reject</option>
              </select>
            </Field>
          </div>

          {validating ? (
            <div className="kit-pair-wide">
              <NumberField
                id="persistence-validated-value"
                label={`Validated value (${currency})`}
                min={0}
                step="0.01"
                value={value}
                error={errors.value}
                onChange={(next) => {
                  setValue(next);
                  clearError("value");
                }}
              />
            </div>
          ) : null}

          <div className="kit-pair-wide">
            <Field
              label="Validation note"
              htmlFor="persistence-validation-note"
              error={errors.note}
            >
              <textarea
                id="persistence-validation-note"
                className="kit-field-input"
                rows={4}
                value={note}
                aria-invalid={errors.note ? true : undefined}
                onChange={(event) => {
                  setNote(event.target.value);
                  clearError("note");
                }}
              />
            </Field>
          </div>
        </div>

        {haircut ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            Validating less than reported takes {money(reported - Number(value), currency)} off the
            current value, so the note should explain why.
          </p>
        ) : null}

        {!validating ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            A rejected observation carries no validated value.
          </p>
        ) : null}

        {error ? (
          <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface CaseData {
  id: string;
  detail: ReinvestmentPersistenceCaseDetail;
}

export default function ReinvestmentPersistenceCasePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<CaseData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitRunning, setSubmitRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getReinvestmentPersistenceCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load reinvestment-persistence case.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, reloadKey]);

  const data = result !== null && result.id === params.id ? result : null;
  const detail = data?.detail ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyDetail(updated: ReinvestmentPersistenceCaseDetail) {
    setResult((current) => (current ? { ...current, detail: updated } : current));
  }

  if (detail === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/reinvestment-persistence" className="request-back-link">
          <ArrowLeft size={16} />
          Reinvestment persistence
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { persistenceCase: pc, observations, reviews } = detail;
  const currency = pc.currency;
  const status = String(pc.status);
  const mutable = status === "ACTIVE" || status === "REMEDIATION_REQUIRED";
  const remediation = status === "REMEDIATION_REQUIRED";
  const readyForReview = status === "READY_FOR_REVIEW";
  const sustained = status === "SUSTAINED";
  const busyAny = submitRunning || rationaleRunning;
  const pendingObservations = observations.filter((observation) => !observation.validationDecision);
  const validatedCount = observations.length - pendingObservations.length;
  const canRecord = canManage && mutable;
  const canValidate = canFinalize && mutable;
  const persistenceShort =
    pc.assessed && pc.valuePersistencePct < pc.minimumValuePersistencePct - 0.05;
  const efficiencyShort =
    pc.assessed && pc.efficiencyRetentionPct < pc.minimumEfficiencyRetentionPct - 0.05;
  const validatingObservation =
    observations.find((observation) => String(observation.id) === validatingId) ?? null;

  const shortParts: string[] = [];

  if (persistenceShort) {
    shortParts.push(
      `value persistence is ${pc.valuePersistencePct.toFixed(1)}% against a minimum of ${pc.minimumValuePersistencePct.toFixed(1)}%`,
    );
  }

  if (efficiencyShort) {
    shortParts.push(
      `efficiency retention is ${pc.efficiencyRetentionPct.toFixed(1)}% against a minimum of ${pc.minimumEfficiencyRetentionPct.toFixed(1)}%`,
    );
  }

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      applyDetail(await submitReinvestmentPersistenceForReview(params.id));

      setSubmitting(false);

      toast.success("Submitted for review", pc.persistenceCaseNumber);
    } catch (caught) {
      setSubmitting(false);

      toast.error(
        "Could not submit the case",
        caught instanceof Error ? caught.message : "Unable to submit persistence case.",
      );
    } finally {
      setSubmitRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, pc);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, pc.persistenceCaseNumber);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to record the decision.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(request: RationaleRequest) {
    setRationaleError(null);
    setRationale(request);
  }

  function handleRecorded(updated: ReinvestmentPersistenceCaseDetail, detailText: string) {
    applyDetail(updated);
    setRecording(false);
    toast.success("Observation recorded", detailText);
  }

  function handleValidated(updated: ReinvestmentPersistenceCaseDetail, title: string) {
    applyDetail(updated);
    setValidatingId(null);
    toast.success(title, pc.persistenceCaseNumber);
  }

  const orderedObservations = [...observations].sort((a, b) =>
    String(b.observedOn ?? "").localeCompare(String(a.observedOn ?? "")),
  );

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, pc) : null;

  const kpis: KpiItem[] = [
    {
      label: "Value persistence",
      icon: Gauge,
      value: pc.assessed ? `${pc.valuePersistencePct.toFixed(1)}%` : "Unassessed",
      note: pc.assessed
        ? `Minimum ${pc.minimumValuePersistencePct.toFixed(1)}%`
        : "Needs a validated observation",
      tone: persistenceShort ? "warning" : "default",
    },
    {
      label: "Efficiency retention",
      icon: Activity,
      value: pc.assessed ? `${pc.efficiencyRetentionPct.toFixed(1)}%` : "—",
      note: `Minimum ${pc.minimumEfficiencyRetentionPct.toFixed(1)}%`,
      tone: efficiencyShort ? "warning" : "default",
    },
    {
      label: "Projected ROI",
      icon: Target,
      value: pc.assessed ? `${pc.currentProjectedRoiPct.toFixed(1)}%` : "—",
      note: "On current validated value",
    },
    {
      label: "ROI variance",
      icon: TrendingDown,
      value: pc.assessed ? `${pc.roiVariancePct.toFixed(1)} pts` : "—",
      note: "Against the baseline",
    },
    {
      label: "Compounding value",
      icon: Coins,
      value: pc.assessed ? money(pc.compoundingValueAmount, currency) : "—",
      note: "Above the Step 64 baseline",
    },
    {
      label: "Decayed value",
      icon: Hourglass,
      value: pc.assessed ? money(pc.decayedValueAmount, currency) : "—",
      note: "Below the baseline",
    },
  ];

  const observationColumns = buildObservationColumns({
    currency,
    canValidate,
    busy: busyAny,
    onValidate: (observation) => setValidatingId(String(observation.id)),
  });

  const reviewColumns = buildReviewColumns();

  return (
    <div className="page-stack">
      <Link href="/reinvestment-persistence" className="request-back-link">
        <ArrowLeft size={16} />
        Reinvestment persistence
      </Link>

      <section className="rpersist-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{pc.persistenceCaseNumber}</span>

            <CaseBadge status={status} />

            <StatusBadge value={String(pc.health)} label={readable(String(pc.health))} />
          </div>

          <span className="eyebrow">Durable recycled-capital value</span>

          <h1>{pc.targetInitiativeTitle}</h1>

          <p>
            {pc.sourcePerformanceCaseNumber}
            {" · "}
            {pc.redeploymentNumber}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canRecord ? (
            <button
              type="button"
              className={`button ${observations.length === 0 ? "button--primary" : "button--secondary"}`}
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record observation
            </button>
          ) : null}

          {canRecord ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !pc.assessed}
              title={
                pc.assessed
                  ? undefined
                  : "At least one observation must be validated before the case can be submitted"
              }
              onClick={() => setSubmitting(true)}
            >
              <Send size={15} />
              Submit for review
            </button>
          ) : null}

          {canFinalize && readyForReview ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "REMEDIATE" })}
            >
              <XCircle size={15} />
              Require remediation
            </button>
          ) : null}

          {canFinalize && readyForReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "SUSTAIN" })}
            >
              <BadgeCheck size={16} />
              Mark sustained
            </button>
          ) : null}

          {canFinalize && sustained ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close case
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {remediation ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The case requires remediation.</strong>{" "}
            {canManage
              ? "Record new persistence observations, have them validated, then submit the case for review again."
              : "New persistence observations are needed before it can be reviewed again."}
          </div>
        </div>
      ) : null}

      {shortParts.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The value is below a governance threshold.</strong> {shortParts.join(" and ")}.
          </div>
        </div>
      ) : null}

      {mutable && canManage && observations.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Record the first persistence observation.</strong> Longitudinal evidence is
            validated by a manager, and the case is assessed from the validated values.
          </div>
        </div>
      ) : null}

      {mutable && pendingObservations.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {pendingObservations.length}{" "}
              {pendingObservations.length === 1 ? "observation is" : "observations are"} awaiting
              validation.
            </strong>{" "}
            {canFinalize
              ? "Use Validate on each row to validate or reject it."
              : "A procurement manager or administrator needs to validate them."}
          </div>
        </div>
      ) : null}

      {mutable && !pc.assessed && observations.length > 0 && pendingObservations.length === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No observation has been validated.</strong> Persistence stays unassessed, and
            the case cannot be submitted for review until an observation is validated.
          </div>
        </div>
      ) : null}

      {mutable && canManage && pc.assessed && pendingObservations.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The case is assessed.</strong> Submit it for review when the persistence
            evidence is complete.
          </div>
        </div>
      ) : null}

      {readyForReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting independent review.</strong>{" "}
            {canFinalize
              ? "Use Mark sustained or Require remediation above."
              : "A procurement manager or administrator needs to review it."}
          </div>
        </div>
      ) : null}

      {sustained && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The value is sustained.</strong> Close the case to finish the governance
            lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Persistence summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Persistence against the thresholds</h2>
          </div>

          <Gauge size={19} />
        </div>

        {pc.assessed ? (
          <>
            <ProgressLine
              pct={pc.valuePersistencePct}
              tone={
                pc.valuePersistencePct >= pc.minimumValuePersistencePct
                  ? meterToneFor("success")
                  : "primary"
              }
              caption={`Value persistence ${pc.valuePersistencePct.toFixed(1)}% against a minimum of ${pc.minimumValuePersistencePct.toFixed(1)}%`}
              label="Value persistence against the minimum"
            />

            <ProgressLine
              pct={pc.efficiencyRetentionPct}
              tone={
                pc.efficiencyRetentionPct >= pc.minimumEfficiencyRetentionPct
                  ? meterToneFor("success")
                  : "primary"
              }
              caption={`Efficiency retention ${pc.efficiencyRetentionPct.toFixed(1)}% against a minimum of ${pc.minimumEfficiencyRetentionPct.toFixed(1)}%`}
              label="Efficiency retention against the minimum"
            />
          </>
        ) : (
          <p className="kit-meta-line">
            Persistence is measured once an observation has been validated.
          </p>
        )}

        {observations.length > 0 ? (
          <ProgressLine
            pct={(validatedCount / observations.length) * 100}
            tone={pendingObservations.length === 0 ? meterToneFor("success") : "primary"}
            caption={`${validatedCount} of ${observations.length} observations have a validation decision`}
            label="Observations with a validation decision"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Recycling-effectiveness baseline</span>

            <h2>Governance thresholds</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="rpersist-objective">{pc.persistenceObjective}</p>

        <div className="rpersist-context-grid">
          <div>
            <span>Owner</span>

            <strong>{pc.persistenceOwnerName}</strong>
          </div>

          <div>
            <span>Observation window</span>

            <strong>{pc.persistenceObservationWindowMonths} months</strong>
          </div>

          <div>
            <span>Minimum persistence</span>

            <strong>{pc.minimumValuePersistencePct.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Minimum efficiency</span>

            <strong>{pc.minimumEfficiencyRetentionPct.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Baseline efficiency</span>

            <strong>{pc.baselineCapitalEfficiencyMultiple.toFixed(2)}x</strong>
          </div>

          <div>
            <span>Current efficiency</span>

            <strong>
              {pc.assessed ? `${pc.currentCapitalEfficiencyMultiple.toFixed(2)}x` : "—"}
            </strong>
          </div>

          <div>
            <span>Baseline annual value</span>

            <strong>{money(pc.baselineValidatedAnnualizedValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Current annual value</span>

            <strong>
              {pc.assessed ? money(pc.currentValidatedAnnualizedValueAmount, currency) : "—"}
            </strong>
          </div>

          <div>
            <span>Baseline horizon value</span>

            <strong>{money(pc.baselineRealizedHorizonValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Current projected horizon</span>

            <strong>
              {pc.assessed ? money(pc.currentProjectedHorizonValueAmount, currency) : "—"}
            </strong>
          </div>

          <div>
            <span>Baseline net value</span>

            <strong>{money(pc.baselineRealizedNetValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Current projected net</span>

            <strong>
              {pc.assessed ? money(pc.currentProjectedNetValueAmount, currency) : "—"}
            </strong>
          </div>
        </div>
      </section>

      <div className="rpersist-source-links">
        <Link
          href={`/reinvestment-performance/${pc.sourcePerformanceCaseId}`}
          className="table-action"
        >
          Step 64 performance baseline
        </Link>

        <Link href={`/capital-redeployment/${pc.redeploymentCaseId}`} className="table-action">
          Step 63 redeployment
        </Link>

        <Link href={`/strategic-value/${pc.targetValueCaseId}`} className="table-action">
          Target value case
        </Link>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable persistence evidence</span>

            <h2>Observation history</h2>
          </div>

          {canRecord ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record observation
            </button>
          ) : (
            <Activity size={19} />
          )}
        </div>

        <DataTable
          columns={observationColumns}
          rows={orderedObservations}
          getRowId={(item) => String(item.id)}
          ariaLabel="Persistence observations"
          busy={fetching}
          empty={
            <EmptyState
              icon={Activity}
              title="No observations"
              description="No persistence observation has been recorded."
              action={
                canRecord ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setRecording(true)}
                  >
                    <Plus size={15} />
                    Record observation
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable sustainability decisions</span>

            <h2>Review history</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        <DataTable
          columns={reviewColumns}
          rows={reviews}
          getRowId={(item) => String(item.id)}
          ariaLabel="Persistence review history"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No persistence review"
              description="No persistence review has been recorded."
            />
          }
        />
      </section>

      <section className="rpersist-method-note">
        <Goal size={18} />

        <div>
          <strong>
            Recycling effectiveness is measured through durable value, not repeated money movement
          </strong>

          <p>
            Compounding means the validated outcome now exceeds its Step 64 value baseline while
            retaining or improving recycled-capital efficiency. Regression creates remediation
            evidence rather than rewriting upstream history.
          </p>
        </div>
      </section>

      {recording ? (
        <ObservationModal
          caseId={params.id}
          persistenceCase={pc}
          onClose={() => setRecording(false)}
          onSaved={handleRecorded}
        />
      ) : null}

      {validatingObservation !== null ? (
        <ValidationModal
          observation={validatingObservation}
          currency={currency}
          onClose={() => setValidatingId(null)}
          onSaved={handleValidated}
        />
      ) : null}

      {submitting ? (
        <ActionDialog
          eyebrow="Sustainability gate"
          title="Submit for review?"
          description={`${pc.persistenceCaseNumber} will be submitted with value persistence of ${pc.valuePersistencePct.toFixed(1)}% (minimum ${pc.minimumValuePersistencePct.toFixed(1)}%) and efficiency retention of ${pc.efficiencyRetentionPct.toFixed(1)}% (minimum ${pc.minimumEfficiencyRetentionPct.toFixed(1)}%). Observations cannot be recorded or validated while it is under review.`}
          confirmLabel="Submit for review"
          busyLabel="Submitting…"
          cancelLabel="Not yet"
          busy={submitRunning}
          onConfirm={() => void confirmSubmit()}
          onCancel={() => setSubmitting(false)}
        />
      ) : null}

      {rationale !== null && rationaleInfo !== null ? (
        <RationaleDialog
          eyebrow={rationaleInfo.eyebrow}
          title={rationaleInfo.title}
          description={rationaleInfo.description}
          label={rationaleInfo.label}
          placeholder={rationaleInfo.placeholder}
          confirmLabel={rationaleInfo.confirm}
          busyLabel={rationaleInfo.busy}
          cancelLabel={rationaleInfo.cancelLabel}
          tone={rationaleInfo.tone}
          maxLength={5000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
