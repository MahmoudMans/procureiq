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
  closeReinvestmentPerformanceCase,
  getReinvestmentPerformanceCase,
  recordReinvestmentPerformanceObservation,
  reviewReinvestmentPerformanceCase,
  submitReinvestmentPerformanceForReview,
  validateReinvestmentPerformanceObservation,
} from "@/lib/api";
import type { ReinvestmentPerformanceCaseDetail } from "@/types/reinvestment-performance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type PerformanceCase = ReinvestmentPerformanceCaseDetail["performanceCase"];
type Observation = ReinvestmentPerformanceCaseDetail["observations"][number];
type ReviewRecord = ReinvestmentPerformanceCaseDetail["reviews"][number];
type ObservationField = "date" | "value" | "evidence";
type ValidationField = "value" | "note";
type ValidationChoice = "VALIDATED" | "REJECTED";
type RationaleRequest = { kind: "CONFIRM" } | { kind: "REMEDIATE" } | { kind: "CLOSE" };

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

    case "VERIFIED":
      return <StatusBadge value="COMPLETED" label="Verified" />;

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
    case "CONFIRMED":
      return <StatusBadge value="COMPLETED" label="Confirmed" />;

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

function rationaleCopy(request: RationaleRequest, performanceCase: PerformanceCase): RationaleCopy {
  switch (request.kind) {
    case "CONFIRM":
      return {
        eyebrow: "Independent value review",
        title: "Confirm performance",
        description: `${performanceCase.performanceCaseNumber} will be confirmed at a realized ROI of ${performanceCase.realizedRoiPct.toFixed(1)}% against a target of ${performanceCase.baselineTargetRoiPct.toFixed(1)}%. Confirmation verifies the performance case.`,
        label: "Review rationale",
        placeholder: "Why is the realized performance confirmed?",
        confirm: "Confirm performance",
        busy: "Confirming…",
        tone: "primary",
        done: "Performance confirmed",
      };

    case "REMEDIATE":
      return {
        eyebrow: "Independent value review",
        title: "Require remediation",
        description: `${performanceCase.performanceCaseNumber} will go back into remediation. New value observations are needed before it can be submitted for review again.`,
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
        title: "Close performance case",
        description: `${performanceCase.performanceCaseNumber} was verified. Closing it finishes the governance lifecycle.`,
        label: "Closure note",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close performance case",
        busy: "Closing…",
        tone: "primary",
        done: "Performance case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<ReinvestmentPerformanceCaseDetail> {
  switch (request.kind) {
    case "CONFIRM":
      return reviewReinvestmentPerformanceCase(caseId, {
        decision: "CONFIRMED",
        reviewNote: note,
      });

    case "REMEDIATE":
      return reviewReinvestmentPerformanceCase(caseId, {
        decision: "REMEDIATION_REQUIRED",
        reviewNote: note,
      });

    case "CLOSE":
      return closeReinvestmentPerformanceCase(caseId, note);
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
      header: "Reported annualized",
      align: "right",
      sortValue: (item) => item.reportedRealizedAnnualizedValueAmount,
      cell: (item) => (
        <strong>{money(item.reportedRealizedAnnualizedValueAmount, currency)}</strong>
      ),
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
      sortValue: (item) => item.validatedRealizedAnnualizedValueAmount ?? null,
      cell: (item) =>
        typeof item.validatedRealizedAnnualizedValueAmount === "number" ? (
          <strong>{money(item.validatedRealizedAnnualizedValueAmount, currency)}</strong>
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

function buildReviewColumns(currency: string): Column<ReviewRecord>[] {
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
      id: "roi",
      header: "Realized ROI",
      align: "right",
      sortValue: (item) => item.realizedRoiPct,
      cell: (item) => `${item.realizedRoiPct.toFixed(1)}%`,
    },
    {
      id: "realization",
      header: "Realization",
      align: "right",
      sortValue: (item) => item.realizationPct,
      cell: (item) => `${item.realizationPct.toFixed(1)}%`,
    },
    {
      id: "variance",
      header: "ROI variance",
      align: "right",
      sortValue: (item) => item.roiVariancePct,
      cell: (item) => `${item.roiVariancePct.toFixed(1)} pts`,
    },
    {
      id: "valueVariance",
      header: "Value variance",
      align: "right",
      sortValue: (item) => item.valueVarianceAmount,
      cell: (item) => money(item.valueVarianceAmount, currency),
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
  performanceCase: PerformanceCase;
  onClose: () => void;
  onSaved: (updated: ReinvestmentPerformanceCaseDetail, detail: string) => void;
}

function ObservationModal({ caseId, performanceCase, onClose, onSaved }: ObservationModalProps) {
  const currency = performanceCase.currency;
  const horizonYears = performanceCase.measurementHorizonMonths / 12;
  const expectedAnnual =
    horizonYears > 0
      ? Math.round((performanceCase.expectedHorizonValueAmount / horizonYears) * 100) / 100
      : 0;

  const [date, setDate] = useState(() => isoDate(0));
  const [value, setValue] = useState(() => String(expectedAnnual));
  const [evidence, setEvidence] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ObservationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valueValid = numberError(value, { min: 0 }) === undefined;
  const belowExpected =
    valueValid && expectedAnnual > 0 && Number(value) < expectedAnnual - 0.005;

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
      const updated = await recordReinvestmentPerformanceObservation(caseId, {
        observedOn: date,
        reportedRealizedAnnualizedValueAmount: Number(value),
        evidenceNote: evidence.trim(),
      });

      onSaved(updated, `${money(Number(value), currency)} annualized`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record realized-value observation.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Outcome evidence"
      title="Record realized value"
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
            form="reinvestment-observation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record immutable observation"}
          </button>
        </>
      }
    >
      <form id="reinvestment-observation-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Observed on" htmlFor="reinvestment-date" error={errors.date}>
            <input
              id="reinvestment-date"
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
              id="reinvestment-value"
              label={`Reported attributable annualized value (${currency})`}
              min={0}
              step="0.01"
              value={value}
              error={errors.value}
              onChange={(next) => {
                setValue(next);
                clearError("value");
              }}
            />

            {expectedAnnual > 0 ? (
              <p className="kit-meta-line">
                Expected annualized value: {money(expectedAnnual, currency)}
              </p>
            ) : null}
          </div>

          <div className="kit-pair-wide">
            <Field label="Evidence" htmlFor="reinvestment-evidence" error={errors.evidence}>
              <textarea
                id="reinvestment-evidence"
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

        {belowExpected ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The reported value is below the expected annualized value of{" "}
            {money(expectedAnnual, currency)}, so the evidence should explain the shortfall.
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
  onSaved: (updated: ReinvestmentPerformanceCaseDetail, title: string) => void;
}

function ValidationModal({ observation, currency, onClose, onSaved }: ValidationModalProps) {
  const reported = observation.reportedRealizedAnnualizedValueAmount;

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
      const updated = await validateReinvestmentPerformanceObservation(observation.id, {
        decision,
        validatedRealizedAnnualizedValueAmount: validating ? Number(value) : undefined,
        validationNote: note.trim(),
      });

      onSaved(updated, validating ? "Observation validated" : "Observation rejected");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to validate realized-value evidence.",
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
            form="reinvestment-validation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : validating ? "Validate observation" : "Reject observation"}
          </button>
        </>
      }
    >
      <form id="reinvestment-validation-form" onSubmit={handleSubmit} noValidate>
        <p className="kit-meta-line" style={{ marginBottom: 12 }}>
          Evidence: {observation.evidenceNote}
        </p>

        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Decision" htmlFor="reinvestment-decision">
              <select
                id="reinvestment-decision"
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
                id="reinvestment-validated-value"
                label={`Validated annualized value (${currency})`}
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
              htmlFor="reinvestment-validation-note"
              error={errors.note}
            >
              <textarea
                id="reinvestment-validation-note"
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
            realized value, so the note should explain why.
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
  detail: ReinvestmentPerformanceCaseDetail;
}

export default function ReinvestmentPerformanceCasePage() {
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
        const response = await getReinvestmentPerformanceCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load reinvestment-performance case.",
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

  function applyDetail(updated: ReinvestmentPerformanceCaseDetail) {
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
        <Link href="/reinvestment-performance" className="request-back-link">
          <ArrowLeft size={16} />
          Reinvestment performance
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

  const { performanceCase: pc, observations, reviews } = detail;
  const currency = pc.currency;
  const status = String(pc.status);
  const mutable = status === "ACTIVE" || status === "REMEDIATION_REQUIRED";
  const remediation = status === "REMEDIATION_REQUIRED";
  const readyForReview = status === "READY_FOR_REVIEW";
  const verified = status === "VERIFIED";
  const busyAny = submitRunning || rationaleRunning;
  const pendingObservations = observations.filter((observation) => !observation.validationDecision);
  const validatedCount = observations.length - pendingObservations.length;
  const canRecord = canManage && mutable;
  const canValidate = canFinalize && mutable;
  const belowTarget = pc.assessed && pc.realizedRoiPct < pc.baselineTargetRoiPct - 0.05;
  const validatingObservation =
    observations.find((observation) => String(observation.id) === validatingId) ?? null;

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      applyDetail(await submitReinvestmentPerformanceForReview(params.id));

      setSubmitting(false);

      toast.success("Submitted for independent review", pc.performanceCaseNumber);
    } catch (caught) {
      setSubmitting(false);

      toast.error(
        "Could not submit the case",
        caught instanceof Error ? caught.message : "Unable to submit performance case.",
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

      toast.success(copy.done, pc.performanceCaseNumber);
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

  function handleRecorded(updated: ReinvestmentPerformanceCaseDetail, detailText: string) {
    applyDetail(updated);
    setRecording(false);
    toast.success("Observation recorded", detailText);
  }

  function handleValidated(updated: ReinvestmentPerformanceCaseDetail, title: string) {
    applyDetail(updated);
    setValidatingId(null);
    toast.success(title, pc.performanceCaseNumber);
  }

  const orderedObservations = [...observations].sort((a, b) =>
    String(b.observedOn ?? "").localeCompare(String(a.observedOn ?? "")),
  );

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, pc) : null;

  const kpis: KpiItem[] = [
    {
      label: "Target ROI",
      icon: Target,
      value: `${pc.baselineTargetRoiPct.toFixed(1)}%`,
      note: "Frozen at redeployment",
    },
    {
      label: "Realized ROI",
      icon: Gauge,
      value: pc.assessed ? `${pc.realizedRoiPct.toFixed(1)}%` : "Unassessed",
      note: pc.assessed ? "From validated observations" : "Needs a validated observation",
      tone: belowTarget ? "warning" : "default",
    },
    {
      label: "ROI variance",
      icon: TrendingDown,
      value: pc.assessed ? `${pc.roiVariancePct.toFixed(1)} pts` : "—",
      note: "Against the target",
    },
    {
      label: "Realization",
      icon: Activity,
      value: pc.assessed ? `${pc.realizationPct.toFixed(1)}%` : "—",
      note: "Of the expected horizon value",
    },
    {
      label: "Value variance",
      icon: Coins,
      value: pc.assessed ? money(pc.valueVarianceAmount, currency) : "—",
      note: "Realized against expected",
    },
    {
      label: "Target health",
      icon: Goal,
      value: readable(String(pc.currentTargetValueHealth)),
      note: "Step 56 target value case",
    },
  ];

  const observationColumns = buildObservationColumns({
    currency,
    canValidate,
    busy: busyAny,
    onValidate: (observation) => setValidatingId(String(observation.id)),
  });

  const reviewColumns = buildReviewColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/reinvestment-performance" className="request-back-link">
        <ArrowLeft size={16} />
        Reinvestment performance
      </Link>

      <section className="reinvestment-performance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{pc.performanceCaseNumber}</span>

            <CaseBadge status={status} />

            <StatusBadge value={String(pc.health)} label={readable(String(pc.health))} />
          </div>

          <span className="eyebrow">Post-redeployment value realization</span>

          <h1>{pc.targetInitiativeTitle}</h1>

          <p>
            {pc.redeploymentNumber}
            {" · "}
            {pc.targetValueCaseNumber}
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
              onClick={() => openRationale({ kind: "CONFIRM" })}
            >
              <BadgeCheck size={16} />
              Confirm performance
            </button>
          ) : null}

          {canFinalize && verified ? (
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
              ? "Record new value observations, have them validated, then submit the case for review again."
              : "New value observations are needed before it can be reviewed again."}
          </div>
        </div>
      ) : null}

      {belowTarget ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Realized ROI is below the target.</strong> It is {pc.realizedRoiPct.toFixed(1)}%
            against a target of {pc.baselineTargetRoiPct.toFixed(1)}% ({pc.roiVariancePct.toFixed(1)}{" "}
            pts).
          </div>
        </div>
      ) : null}

      {mutable && canManage && observations.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Record the first realized-value observation.</strong> Outcome evidence is
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
            <strong>No observation has been validated.</strong> ROI stays unassessed, and the case
            cannot be submitted for review until an observation is validated.
          </div>
        </div>
      ) : null}

      {mutable && canManage && pc.assessed && pendingObservations.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The case is assessed.</strong> Submit it for independent review when the
            outcome evidence is complete.
          </div>
        </div>
      ) : null}

      {readyForReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting independent review.</strong>{" "}
            {canFinalize
              ? "Use Confirm performance or Require remediation above."
              : "A procurement manager or administrator needs to review it."}
          </div>
        </div>
      ) : null}

      {verified && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The performance is confirmed.</strong> Close the case to finish the governance
            lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Performance summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Realization and validated evidence</h2>
          </div>

          <Gauge size={19} />
        </div>

        {pc.assessed ? (
          <ProgressLine
            pct={pc.realizationPct}
            tone={pc.realizationPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`${money(pc.realizedHorizonValueAmount, currency)} of ${money(pc.expectedHorizonValueAmount, currency)} expected horizon value realized (${pc.realizationPct.toFixed(1)}%)`}
            label="Realized against expected horizon value"
          />
        ) : (
          <p className="kit-meta-line">
            Realization is measured once an observation has been validated.
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
            <span className="eyebrow">Measurement methodology</span>

            <h2>Realization baseline</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="reinvestment-performance-objective">{pc.performanceObjective}</p>

        <div className="reinvestment-performance-context-grid">
          <div>
            <span>Owner</span>

            <strong>{pc.performanceOwnerName}</strong>
          </div>

          <div>
            <span>Measurement horizon</span>

            <strong>{pc.measurementHorizonMonths} months</strong>
          </div>

          <div>
            <span>Annual operating cost</span>

            <strong>{money(pc.annualOperatingCostAmount, currency)}</strong>
          </div>

          <div>
            <span>Target persistence</span>

            <strong>{pc.baselineTargetPersistencePct.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Frozen target net value</span>

            <strong>{money(pc.baselineTargetNetValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Operating-cost horizon</span>

            <strong>
              {pc.assessed ? money(pc.operatingCostHorizonAmount, currency) : "Pending assessment"}
            </strong>
          </div>

          <div>
            <span>Redeployed capital</span>

            <strong>{money(pc.redeployedCapitalAmount, currency)}</strong>
          </div>

          <div>
            <span>Total cost</span>

            <strong>{pc.assessed ? money(pc.totalCostAmount, currency) : "—"}</strong>
          </div>

          <div>
            <span>Expected horizon value</span>

            <strong>{pc.assessed ? money(pc.expectedHorizonValueAmount, currency) : "—"}</strong>
          </div>

          <div>
            <span>Realized horizon value</span>

            <strong>{pc.assessed ? money(pc.realizedHorizonValueAmount, currency) : "—"}</strong>
          </div>

          <div>
            <span>Realized net value</span>

            <strong>{pc.assessed ? money(pc.realizedNetValueAmount, currency) : "—"}</strong>
          </div>

          <div>
            <span>Validated annual value</span>

            <strong>
              {pc.assessed ? money(pc.validatedRealizedAnnualizedValueAmount, currency) : "—"}
            </strong>
          </div>
        </div>
      </section>

      <div className="reinvestment-performance-source-links">
        <Link href={`/capital-redeployment/${pc.redeploymentCaseId}`} className="table-action">
          Step 63 redeployment evidence
        </Link>

        <Link href={`/strategic-value/${pc.targetValueCaseId}`} className="table-action">
          Step 56 target authority
        </Link>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable outcome evidence</span>

            <h2>Observations</h2>
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
          ariaLabel="Post-redeployment value observations"
          busy={fetching}
          empty={
            <EmptyState
              icon={Activity}
              title="No observations"
              description="No post-redeployment value observation has been recorded."
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
            <span className="eyebrow">Immutable performance reviews</span>

            <h2>Review history</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        <DataTable
          columns={reviewColumns}
          rows={reviews}
          getRowId={(item) => String(item.id)}
          ariaLabel="Performance review history"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No performance review"
              description="No performance review has been recorded."
            />
          }
        />
      </section>

      <section className="reinvestment-performance-method-note">
        <Goal size={18} />

        <div>
          <strong>
            Underperformance creates remediation evidence, not retroactive investment edits
          </strong>

          <p>
            Step 64 can identify weak post-redeployment value and require remediation, but it
            never changes Step 63 release history or Step 56 target economics.
          </p>
        </div>
      </section>

      {recording ? (
        <ObservationModal
          caseId={params.id}
          performanceCase={pc}
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
          eyebrow="Review gate"
          title="Submit for independent review?"
          description={`${pc.performanceCaseNumber} will be submitted at a realized ROI of ${pc.realizedRoiPct.toFixed(1)}% against a target of ${pc.baselineTargetRoiPct.toFixed(1)}%. Observations cannot be recorded or validated while it is under review.`}
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
