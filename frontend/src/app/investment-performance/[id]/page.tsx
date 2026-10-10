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
  closeInvestmentPerformanceCase,
  getInvestmentPerformanceCase,
  recordInvestmentPerformanceObservation,
  reviewInvestmentPerformanceCase,
  submitInvestmentPerformanceForReview,
  validateInvestmentPerformanceObservation,
} from "@/lib/api";
import type { InvestmentPerformanceCaseDetail } from "@/types/investment-performance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type PerformanceCase = InvestmentPerformanceCaseDetail["performanceCase"];
type Observation = InvestmentPerformanceCaseDetail["observations"][number];
type DecisionRecord = InvestmentPerformanceCaseDetail["decisions"][number];
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
    case "IN_REMEDIATION":
      return <StatusBadge value="AT_RISK" label="In remediation" />;

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
        eyebrow: "Independent investment review",
        title: "Confirm performance",
        description: `${performanceCase.performanceCaseNumber} will be confirmed at a realized ROI of ${performanceCase.realizedRoiPct.toFixed(1)}% (${performanceCase.roiVariancePct.toFixed(1)} pts against the baseline). Confirmation verifies the performance case.`,
        label: "Review rationale",
        placeholder: "Why is the realized performance confirmed?",
        confirm: "Confirm performance",
        busy: "Confirming…",
        tone: "primary",
        done: "Performance confirmed",
      };

    case "REMEDIATE":
      return {
        eyebrow: "Independent investment review",
        title: "Require remediation",
        description: `${performanceCase.performanceCaseNumber} will go back into remediation. New realized-value observations are needed before it can be submitted for review again.`,
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
): Promise<InvestmentPerformanceCaseDetail> {
  switch (request.kind) {
    case "CONFIRM":
      return reviewInvestmentPerformanceCase(caseId, {
        decision: "CONFIRMED",
        decisionNote: note,
      });

    case "REMEDIATE":
      return reviewInvestmentPerformanceCase(caseId, {
        decision: "REMEDIATION_REQUIRED",
        decisionNote: note,
      });

    case "CLOSE":
      return closeInvestmentPerformanceCase(caseId, note);
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

          {item.reportedByName ? <small>By {item.reportedByName}</small> : null}
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
      id: "release",
      header: "Funding released",
      align: "right",
      sortValue: (item) => item.releasePctSnapshot,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{item.releasePctSnapshot.toFixed(1)}%</span>

          <small>{money(item.releasedCapitalSnapshot, currency)}</small>
        </div>
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

function buildDecisionColumns(currency: string): Column<DecisionRecord>[] {
  void currency;

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
      id: "variance",
      header: "ROI variance",
      align: "right",
      sortValue: (item) => item.roiVariancePct,
      cell: (item) => `${item.roiVariancePct.toFixed(1)} pts`,
    },
    {
      id: "efficiency",
      header: "Efficiency",
      align: "right",
      sortValue: (item) => item.capitalEfficiencyMultiple,
      cell: (item) => `${item.capitalEfficiencyMultiple.toFixed(2)}x`,
    },
    {
      id: "note",
      header: "Rationale",
      cell: (item) => <span>{item.decisionNote}</span>,
    },
    {
      id: "by",
      header: "Decided by",
      sortValue: (item) => String(item.decidedByName ?? "").toLowerCase(),
      cell: (item) => item.decidedByName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "at",
      header: "Decided",
      sortValue: (item) => String(item.decidedAt ?? ""),
      cell: (item) => (item.decidedAt ? formatDateTime(item.decidedAt) : "—"),
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
  onSaved: (updated: InvestmentPerformanceCaseDetail, detail: string) => void;
}

function ObservationModal({ caseId, performanceCase, onClose, onSaved }: ObservationModalProps) {
  const currency = performanceCase.currency;
  const baseline = performanceCase.baselineDurableAnnualValueAmount;

  const [date, setDate] = useState(() => isoDate(0));
  const [value, setValue] = useState(() => String(baseline));
  const [evidence, setEvidence] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ObservationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valueValid = numberError(value, { min: 0 }) === undefined;
  const belowBaseline = valueValid && Number(value) < baseline - 0.005;

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
      const updated = await recordInvestmentPerformanceObservation(caseId, {
        observedOn: date,
        reportedRealizedAnnualizedValueAmount: Number(value),
        evidenceNote: evidence.trim(),
      });

      onSaved(updated, `${money(Number(value), currency)} reported`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record realized-value observation.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Post-funding evidence"
      title="Record realized-value observation"
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
            form="performance-observation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record immutable observation"}
          </button>
        </>
      }
    >
      <form id="performance-observation-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Observed on" htmlFor="performance-date" error={errors.date}>
            <input
              id="performance-date"
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
              id="performance-value"
              label={`Reported realized annualized value (${currency})`}
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
              Baseline durable annual value: {money(baseline, currency)}
            </p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Evidence" htmlFor="performance-evidence" error={errors.evidence}>
              <textarea
                id="performance-evidence"
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

        {belowBaseline ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The reported value is below the baseline durable annual value of{" "}
            {money(baseline, currency)}, so the evidence should explain the shortfall.
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
  onSaved: (updated: InvestmentPerformanceCaseDetail, title: string) => void;
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
      const updated = await validateInvestmentPerformanceObservation(observation.id, {
        decision,
        validatedRealizedAnnualizedValueAmount: validating ? Number(value) : undefined,
        validationNote: note.trim(),
      });

      onSaved(updated, validating ? "Observation validated" : "Observation rejected");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to validate realized-value observation.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Independent validation"
      title="Validate observation"
      description={`Reported ${money(reported, currency)} on ${showDate(observation.observedOn)}.`}
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
            form="performance-validation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : validating ? "Validate observation" : "Reject observation"}
          </button>
        </>
      }
    >
      <form id="performance-validation-form" onSubmit={handleSubmit} noValidate>
        <p className="kit-meta-line" style={{ marginBottom: 12 }}>
          Evidence: {observation.evidenceNote}
        </p>

        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Decision" htmlFor="performance-decision">
              <select
                id="performance-decision"
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
                id="performance-validated-value"
                label={`Validated realized annual value (${currency})`}
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
            <Field label="Validation note" htmlFor="performance-validation-note" error={errors.note}>
              <textarea
                id="performance-validation-note"
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
  detail: InvestmentPerformanceCaseDetail;
}

export default function InvestmentPerformanceCasePage() {
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
        const response = await getInvestmentPerformanceCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load investment-performance case.",
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

  function applyDetail(updated: InvestmentPerformanceCaseDetail) {
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
        <Link href="/investment-performance" className="request-back-link">
          <ArrowLeft size={16} />
          Investment performance
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

  const { performanceCase: pc, observations, decisions } = detail;
  const currency = pc.currency;
  const status = String(pc.status);
  const mutable = status === "ACTIVE" || status === "IN_REMEDIATION";
  const remediation = status === "IN_REMEDIATION";
  const readyForReview = status === "READY_FOR_REVIEW";
  const verified = status === "VERIFIED";
  const busyAny = submitRunning || rationaleRunning;
  const pendingObservations = observations.filter((observation) => !observation.validationDecision);
  const validatedCount = observations.length - pendingObservations.length;
  const canRecord = canManage && mutable;
  const canValidate = canFinalize && mutable;
  const validatingObservation =
    observations.find((observation) => String(observation.id) === validatingId) ?? null;

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      applyDetail(await submitInvestmentPerformanceForReview(params.id));

      setSubmitting(false);

      toast.success("Submitted for independent review", pc.performanceCaseNumber);
    } catch (caught) {
      setSubmitting(false);

      toast.error(
        "Could not submit the case",
        caught instanceof Error
          ? caught.message
          : "Unable to submit investment-performance case.",
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

  function handleRecorded(updated: InvestmentPerformanceCaseDetail, detailText: string) {
    applyDetail(updated);
    setRecording(false);
    toast.success("Observation recorded", detailText);
  }

  function handleValidated(updated: InvestmentPerformanceCaseDetail, title: string) {
    applyDetail(updated);
    setValidatingId(null);
    toast.success(title, pc.performanceCaseNumber);
  }

  const orderedObservations = [...observations].sort((a, b) =>
    String(b.observedOn ?? "").localeCompare(String(a.observedOn ?? "")),
  );

  const orderedDecisions = [...decisions].sort((a, b) =>
    String(b.decidedAt ?? "").localeCompare(String(a.decidedAt ?? "")),
  );

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, pc) : null;

  const kpis: KpiItem[] = [
    {
      label: "Step 56 baseline ROI",
      icon: Goal,
      value: `${pc.baselineRoiPct.toFixed(1)}%`,
      note: "Approved investment case",
    },
    {
      label: "Realized ROI",
      icon: Gauge,
      value: pc.assessed ? `${pc.realizedRoiPct.toFixed(1)}%` : "Unassessed",
      note: pc.assessed ? "From validated observations" : "Needs a validated observation",
    },
    {
      label: "ROI variance",
      icon: TrendingDown,
      value: pc.assessed ? `${pc.roiVariancePct.toFixed(1)} pts` : "—",
      note: "Against the baseline",
    },
    {
      label: "Funding variance",
      icon: Coins,
      value: pc.assessed ? `${pc.fundingVariancePct.toFixed(1)}%` : "—",
      note: "Released against planned",
    },
    {
      label: "Capital efficiency",
      icon: Activity,
      value: pc.assessed ? `${pc.capitalEfficiencyMultiple.toFixed(2)}x` : "—",
      note: "Value per unit of capital",
    },
    {
      label: "Value variance",
      icon: FileCheck2,
      value: pc.assessed ? money(pc.valueVarianceAmount, currency) : "—",
      note: "Realized against baseline",
    },
  ];

  const observationColumns = buildObservationColumns({
    currency,
    canValidate,
    busy: busyAny,
    onValidate: (observation) => setValidatingId(String(observation.id)),
  });

  const decisionColumns = buildDecisionColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/investment-performance" className="request-back-link">
        <ArrowLeft size={16} />
        Investment performance
      </Link>

      <section className="investment-performance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{pc.performanceCaseNumber}</span>

            <CaseBadge status={status} />

            <StatusBadge value={String(pc.health)} label={readable(String(pc.health))} />
          </div>

          <span className="eyebrow">Realized investment economics</span>

          <h1>{pc.initiativeTitle}</h1>

          <p>
            {pc.fundingCommitmentNumber}
            {" · "}
            {pc.valueCaseNumber}
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
            <strong>The case is in remediation.</strong>{" "}
            {canManage
              ? "Record new realized-value observations, have them validated, then submit the case for review again."
              : "New realized-value observations are needed before it can be reviewed again."}
          </div>
        </div>
      ) : null}

      {mutable && canManage && observations.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Record the first realized-value observation.</strong> Post-funding evidence is
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
            realized-value evidence is complete.
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

            <h2>Funding released and evidence validated</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={pc.currentReleasePct}
          tone="primary"
          caption={`${money(pc.currentReleasedCapitalAmount, currency)} released (${pc.currentReleasePct.toFixed(1)}% of the funding commitment)`}
          label="Funding released"
        />

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
            <span className="eyebrow">Baseline vs realized</span>

            <h2>Investment authority bridge</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="investment-performance-objective">{pc.performanceObjective}</p>

        <div className="investment-performance-context-grid">
          <div>
            <span>Owner</span>

            <strong>{pc.performanceOwnerName}</strong>
          </div>

          <div>
            <span>Baseline investment</span>

            <strong>{money(pc.baselineInvestmentCostAmount, currency)}</strong>
          </div>

          <div>
            <span>Annual operating cost</span>

            <strong>{money(pc.baselineAnnualOperatingCostAmount, currency)}</strong>
          </div>

          <div>
            <span>Value horizon</span>

            <strong>{pc.valueHorizonMonths} months</strong>
          </div>

          <div>
            <span>Baseline annual value</span>

            <strong>{money(pc.baselineAnnualizedValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Validated realized annual value</span>

            <strong>
              {pc.assessed ? money(pc.validatedRealizedAnnualizedValueAmount, currency) : "—"}
            </strong>
          </div>

          <div>
            <span>Step 58 current released</span>

            <strong>{money(pc.currentReleasedCapitalAmount, currency)}</strong>
          </div>

          <div>
            <span>Assessed released capital</span>

            <strong>{money(pc.assessedReleasedCapitalAmount, currency)}</strong>
          </div>

          <div>
            <span>Baseline durable value</span>

            <strong>{money(pc.baselineDurableHorizonValueAmount, currency)}</strong>
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
            <span>Release</span>

            <strong>{pc.currentReleasePct.toFixed(1)}%</strong>
          </div>
        </div>
      </section>

      <div className="investment-performance-source-links">
        <Link href={`/funding-execution/${pc.fundingCommitmentId}`} className="table-action">
          Step 58 funding evidence
        </Link>

        <Link href={`/strategic-value/${pc.valueCaseId}`} className="table-action">
          Step 56 ROI baseline
        </Link>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Realized-value evidence</span>

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
          ariaLabel="Realized-value observations"
          busy={fetching}
          empty={
            <EmptyState
              icon={Activity}
              title="No observations"
              description="No realized-value observation has been recorded."
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
            <span className="eyebrow">Immutable governance decisions</span>

            <h2>Performance review history</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        <DataTable
          columns={decisionColumns}
          rows={orderedDecisions}
          getRowId={(item) => String(item.id)}
          ariaLabel="Performance review history"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No review decision"
              description="No performance review decision has been recorded."
            />
          }
        />
      </section>

      <section className="investment-performance-method-note">
        <Goal size={18} />

        <div>
          <strong>Underperformance never rewrites approved ROI assumptions</strong>

          <p>
            Step 56 remains the approved investment case and Step 58 remains the funding-release
            authority. Step 59 records separate realized economics and immutable review decisions.
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
          eyebrow="Governance gate"
          title="Submit for independent review?"
          description={`${pc.performanceCaseNumber} will be submitted at a realized ROI of ${pc.realizedRoiPct.toFixed(1)}%. Observations cannot be recorded or validated while it is under review.`}
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
