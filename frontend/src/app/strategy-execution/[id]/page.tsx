"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Gauge,
  Goal,
  Info,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
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
import {
  cancelStrategyExecutionCommitment,
  completeStrategyExecutionCommitment,
  getStrategyExecutionCommitment,
  recordStrategyExecutionProgress,
  reportStrategyExecutionOutcome,
  startStrategyExecutionCommitment,
  validateStrategyExecutionOutcome,
} from "@/lib/api";
import type { ExecutionCommitmentDetail } from "@/types/strategy-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Commitment = ExecutionCommitmentDetail["commitment"];
type ProgressUpdate = ExecutionCommitmentDetail["progressUpdates"][number];
type Outcome = ExecutionCommitmentDetail["outcomes"][number];
type Flow = "START" | "COMPLETE" | "CANCEL";
type ProgressField = "progress" | "forecast" | "blockers" | "blockerSummary" | "note";
type OutcomeField = "points" | "evidence";
type ValidationField = "points" | "note";
type ValidationChoice = "VALIDATED" | "REJECTED";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const VALIDATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function signed(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  const days = Math.round((end - start) / 86400000);

  return Number.isFinite(days) ? days : 0;
}

function ValidationBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return <StatusBadge value="PENDING" label="Awaiting validation" />;
  }

  return <StatusBadge value={decision} label={readable(decision)} />;
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

interface FlowCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const FLOWS: Record<Flow, FlowCopy> = {
  START: {
    eyebrow: "Commitment lifecycle",
    title: "Start this commitment?",
    confirm: "Start commitment",
    busy: "Starting…",
    keep: "Not yet",
    done: "Commitment started",
    failed: "Could not start the commitment",
  },
  COMPLETE: {
    eyebrow: "Commitment lifecycle",
    title: "Complete this commitment?",
    confirm: "Complete commitment",
    busy: "Completing…",
    keep: "Not yet",
    done: "Commitment completed",
    failed: "Could not complete the commitment",
  },
  CANCEL: {
    eyebrow: "Commitment lifecycle",
    title: "Cancel this commitment?",
    confirm: "Cancel commitment",
    busy: "Cancelling…",
    keep: "Keep commitment",
    done: "Commitment cancelled",
    failed: "Could not cancel the commitment",
  },
};

function flowDescription(flow: Flow, commitment: Commitment): string {
  switch (flow) {
    case "START":
      return `${commitment.commitmentNumber} becomes in progress, and immutable delivery evidence can be recorded against it.`;

    case "COMPLETE":
      return `${commitment.commitmentNumber} will be marked completed at ${commitment.progressPct.toFixed(1)}% with no open blockers. The contribution outcome can then be reported for validation.`;

    case "CANCEL":
      return `${commitment.commitmentNumber} will be cancelled and will not deliver its planned contribution of ${commitment.plannedContributionPoints.toFixed(1)} points.`;
  }
}

function performFlow(flow: Flow, commitmentId: string): Promise<ExecutionCommitmentDetail> {
  switch (flow) {
    case "START":
      return startStrategyExecutionCommitment(commitmentId);

    case "COMPLETE":
      return completeStrategyExecutionCommitment(commitmentId);

    case "CANCEL":
      return cancelStrategyExecutionCommitment(commitmentId);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildUpdateColumns(): Column<ProgressUpdate>[] {
  return [
    {
      id: "recorded",
      header: "Recorded",
      sortValue: (item) => String(item.createdAt ?? ""),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.createdAt ? formatDateTime(item.createdAt) : "—"}</strong>

          {item.createdByName ? <small>By {item.createdByName}</small> : null}
        </div>
      ),
    },
    {
      id: "progress",
      header: "Progress",
      align: "right",
      sortValue: (item) => item.progressPct,
      cell: (item) => <strong>{item.progressPct.toFixed(1)}%</strong>,
    },
    {
      id: "forecast",
      header: "Forecast end",
      sortValue: (item) => String(item.forecastEndDate ?? ""),
      cell: (item) => showDate(item.forecastEndDate),
    },
    {
      id: "blockers",
      header: "Blockers",
      align: "right",
      sortValue: (item) => item.blockerCount,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span className={item.blockerCount > 0 ? "kit-text-warning" : undefined}>
            {item.blockerCount}
          </span>

          {item.blockerSummary ? <small>{item.blockerSummary}</small> : null}
        </div>
      ),
    },
    {
      id: "note",
      header: "Update note",
      cell: (item) => <span>{item.updateNote}</span>,
    },
  ];
}

interface OutcomeColumnOptions {
  canValidate: boolean;
  busy: boolean;
  onValidate: (outcome: Outcome) => void;
}

function buildOutcomeColumns(options: OutcomeColumnOptions): Column<Outcome>[] {
  return [
    {
      id: "reported",
      header: "Reported",
      sortValue: (item) => String(item.reportedAt ?? ""),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.reportedAt ? formatDateTime(item.reportedAt) : "—"}</strong>

          {item.reportedByName ? <small>By {item.reportedByName}</small> : null}
        </div>
      ),
    },
    {
      id: "points",
      header: "Reported points",
      align: "right",
      sortValue: (item) => item.reportedContributionPoints,
      cell: (item) => <strong>{item.reportedContributionPoints.toFixed(1)} pts</strong>,
    },
    {
      id: "validatedPoints",
      header: "Validated points",
      align: "right",
      sortValue: (item) => item.validatedContributionPoints ?? null,
      cell: (item) =>
        typeof item.validatedContributionPoints === "number" ? (
          <strong>{item.validatedContributionPoints.toFixed(1)} pts</strong>
        ) : (
          <span className="kit-text-muted">—</span>
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

/* ------------------------------------------------------------------ */
/* Record progress modal                                               */
/* ------------------------------------------------------------------ */

interface ProgressModalProps {
  commitmentId: string;
  commitment: Commitment;
  onClose: () => void;
  onSaved: (updated: ExecutionCommitmentDetail, detail: string) => void;
}

function ProgressModal({ commitmentId, commitment, onClose, onSaved }: ProgressModalProps) {
  const [progress, setProgress] = useState(() => String(commitment.progressPct));
  const [forecast, setForecast] = useState(commitment.forecastEndDate);
  const [blockers, setBlockers] = useState(() => String(commitment.blockerCount));
  const [summary, setSummary] = useState(commitment.blockerSummary ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ProgressField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const progressValid =
    numberError(progress, { min: commitment.progressPct }) === undefined && Number(progress) <= 100;
  const blockersValid =
    numberError(blockers, { min: 0 }) === undefined && Number.isInteger(Number(blockers));
  const blockerCount = blockersValid ? Number(blockers) : 0;
  const lateDays =
    forecast && commitment.plannedEndDate ? daysBetween(commitment.plannedEndDate, forecast) : 0;
  const completable = progressValid && Number(progress) >= 100 && blockersValid && blockerCount === 0;

  function clearError(field: ProgressField) {
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

    const next: Partial<Record<ProgressField, string>> = {};

    const progressProblem = numberError(progress, { min: commitment.progressPct });

    if (progressProblem) {
      next.progress = progressProblem;
    } else if (Number(progress) > 100) {
      next.progress = "Progress cannot exceed 100%.";
    }

    if (!forecast) {
      next.forecast = "Choose the forecast end date.";
    }

    const blockerProblem = numberError(blockers, { min: 0 });

    if (blockerProblem) {
      next.blockers = blockerProblem;
    } else if (!Number.isInteger(Number(blockers))) {
      next.blockers = "Enter a whole number of blockers.";
    } else if (Number(blockers) > 0 && !summary.trim()) {
      next.blockerSummary = "Summarise the open blockers.";
    }

    if (!note.trim()) {
      next.note = "Describe the progress evidence.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await recordStrategyExecutionProgress(commitmentId, {
        progressPct: Number(progress),
        forecastEndDate: forecast,
        blockerCount: Number(blockers),
        blockerSummary: Number(blockers) > 0 ? summary.trim() : undefined,
        updateNote: note.trim(),
      });

      onSaved(updated, `${Number(progress).toFixed(1)}% complete`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record progress.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Immutable delivery evidence"
      title="Record progress"
      description="Progress updates are immutable once recorded, and progress can only move forward."
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
            form="execution-progress-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record progress"}
          </button>
        </>
      }
    >
      <form id="execution-progress-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div>
            <NumberField
              id="execution-progress"
              label="Progress (%)"
              min={commitment.progressPct}
              step="0.1"
              value={progress}
              error={errors.progress}
              onChange={(value) => {
                setProgress(value);
                clearError("progress");
              }}
            />

            <p className="kit-meta-line">
              Currently {commitment.progressPct.toFixed(1)}%, expected{" "}
              {commitment.expectedProgressPct.toFixed(1)}%.
            </p>
          </div>

          <div>
            <Field label="Forecast end" htmlFor="execution-forecast" error={errors.forecast}>
              <input
                id="execution-forecast"
                className="kit-field-input"
                type="date"
                value={forecast}
                aria-invalid={errors.forecast ? true : undefined}
                onChange={(event) => {
                  setForecast(event.target.value);
                  clearError("forecast");
                }}
              />
            </Field>

            <p className="kit-meta-line">
              Planned end: {showDate(commitment.plannedEndDate)}
            </p>
          </div>

          <NumberField
            id="execution-blockers"
            label="Blocker count"
            min={0}
            step="1"
            value={blockers}
            error={errors.blockers}
            onChange={(value) => {
              setBlockers(value);
              clearError("blockers");
              clearError("blockerSummary");
            }}
          />

          <div className="kit-pair-wide">
            <Field
              label="Blocker summary"
              htmlFor="execution-blocker-summary"
              error={errors.blockerSummary}
            >
              <textarea
                id="execution-blocker-summary"
                className="kit-field-input"
                rows={4}
                value={summary}
                aria-invalid={errors.blockerSummary ? true : undefined}
                onChange={(event) => {
                  setSummary(event.target.value);
                  clearError("blockerSummary");
                }}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Progress evidence / update note"
              htmlFor="execution-note"
              error={errors.note}
            >
              <textarea
                id="execution-note"
                className="kit-field-input"
                rows={5}
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

        {lateDays > 0 ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The forecast end is {plural(lateDays, "day", "days")} after the planned end of{" "}
            {showDate(commitment.plannedEndDate)}.
          </p>
        ) : null}

        {blockersValid && blockerCount > 0 ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            While blockers are open, the commitment cannot be completed.
          </p>
        ) : null}

        {completable ? (
          <p className="kit-dialog-note" style={{ marginTop: 14 }}>
            Progress is at 100% with no blockers, so the commitment can be completed after this
            update.
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
/* Report contribution modal                                           */
/* ------------------------------------------------------------------ */

interface OutcomeModalProps {
  commitmentId: string;
  commitment: Commitment;
  onClose: () => void;
  onSaved: (updated: ExecutionCommitmentDetail, detail: string) => void;
}

function OutcomeModal({ commitmentId, commitment, onClose, onSaved }: OutcomeModalProps) {
  const planned = commitment.plannedContributionPoints;

  const [points, setPoints] = useState(() => String(planned));
  const [evidence, setEvidence] = useState("");
  const [errors, setErrors] = useState<Partial<Record<OutcomeField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pointsValid = numberError(points, { min: 0 }) === undefined && Number(points) <= 100;
  const belowPlan = pointsValid && Number(points) < planned - 0.05;
  const abovePlan = pointsValid && Number(points) > planned + 0.05;

  function clearError(field: OutcomeField) {
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

    const next: Partial<Record<OutcomeField, string>> = {};

    const problem = numberError(points, { min: 0 });

    if (problem) {
      next.points = problem;
    } else if (Number(points) > 100) {
      next.points = "Contribution cannot exceed 100 points.";
    }

    if (!evidence.trim()) {
      next.evidence = "Describe the outcome evidence.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await reportStrategyExecutionOutcome(commitmentId, {
        reportedContributionPoints: Number(points),
        evidenceNote: evidence.trim(),
      });

      onSaved(updated, `${Number(points).toFixed(1)} pts reported`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to report outcome.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Outcome evidence"
      title="Report contribution"
      description="The report is immutable once submitted. A manager then validates or rejects it."
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
            form="execution-outcome-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Submitting…" : "Submit outcome report"}
          </button>
        </>
      }
    >
      <form id="execution-outcome-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <NumberField
              id="execution-points"
              label="Reported contribution points"
              min={0}
              step="0.1"
              value={points}
              error={errors.points}
              onChange={(value) => {
                setPoints(value);
                clearError("points");
              }}
            />

            <p className="kit-meta-line">Planned contribution: {planned.toFixed(1)} points</p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Outcome evidence" htmlFor="execution-evidence" error={errors.evidence}>
              <textarea
                id="execution-evidence"
                className="kit-field-input"
                rows={6}
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

        {belowPlan ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The reported contribution is below the planned {planned.toFixed(1)} points, so the
            evidence should explain the shortfall.
          </p>
        ) : null}

        {abovePlan ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The reported contribution is above the planned {planned.toFixed(1)} points, so the
            evidence should support the difference.
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
/* Validate outcome modal                                              */
/* ------------------------------------------------------------------ */

interface ValidationModalProps {
  outcome: Outcome;
  onClose: () => void;
  onSaved: (updated: ExecutionCommitmentDetail, title: string) => void;
}

function ValidationModal({ outcome, onClose, onSaved }: ValidationModalProps) {
  const reported = outcome.reportedContributionPoints;

  const [decision, setDecision] = useState<ValidationChoice>("VALIDATED");
  const [points, setPoints] = useState(() => String(reported));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ValidationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validating = decision === "VALIDATED";
  const pointsValid = validating && numberError(points, { min: 0 }) === undefined;
  const haircut = pointsValid && Number(points) < reported - 0.05;

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
      const problem = numberError(points, { min: 0 });

      if (problem) {
        next.points = problem;
      } else if (Number(points) > reported + 0.005) {
        next.points = `Cannot exceed the reported ${reported.toFixed(1)} points.`;
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
      const updated = await validateStrategyExecutionOutcome(outcome.id, {
        decision,
        validatedContributionPoints: validating ? Number(points) : undefined,
        validationNote: note.trim(),
      });

      onSaved(updated, validating ? "Outcome validated" : "Outcome rejected");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to validate outcome.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Independent validation"
      title="Validate outcome"
      description={`Reported ${reported.toFixed(1)} points${outcome.reportedAt ? ` on ${formatDateTime(outcome.reportedAt)}` : ""}.`}
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
            form="execution-validation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : validating ? "Validate outcome" : "Reject outcome"}
          </button>
        </>
      }
    >
      <form id="execution-validation-form" onSubmit={handleSubmit} noValidate>
        <p className="kit-meta-line" style={{ marginBottom: 12 }}>
          Evidence: {outcome.evidenceNote}
        </p>

        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Decision" htmlFor="execution-decision">
              <select
                id="execution-decision"
                className="kit-field-input"
                value={decision}
                onChange={(event) => {
                  setDecision(event.target.value as ValidationChoice);
                  clearError("points");
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
                id="execution-validated-points"
                label="Validated contribution points"
                min={0}
                step="0.1"
                value={points}
                error={errors.points}
                onChange={(value) => {
                  setPoints(value);
                  clearError("points");
                }}
              />
            </div>
          ) : null}

          <div className="kit-pair-wide">
            <Field label="Validation note" htmlFor="execution-validation-note" error={errors.note}>
              <textarea
                id="execution-validation-note"
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
            Validating less than reported takes {(reported - Number(points)).toFixed(1)} points off
            the validated contribution, so the note should explain why.
          </p>
        ) : null}

        {!validating ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            A rejected outcome carries no validated contribution, and a new outcome can then be
            reported.
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

interface CommitmentData {
  id: string;
  detail: ExecutionCommitmentDetail;
}

export default function StrategyExecutionCommitmentPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canValidate = user !== null && VALIDATE_ROLES.includes(user.role);

  const [result, setResult] = useState<CommitmentData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
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
        const response = await getStrategyExecutionCommitment(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load execution commitment.",
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

  function applyDetail(updated: ExecutionCommitmentDetail) {
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
        <Link href="/strategy-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic execution
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

  const { commitment: cm, progressUpdates, outcomes } = detail;
  const status = String(cm.status);
  const isPlanned = status === "PLANNED";
  const inProgress = status === "IN_PROGRESS";
  const completed = status === "COMPLETED";
  const cancelled = status === "CANCELLED";
  const busyAny = flowRunning;

  const orderedOutcomes = [...outcomes].sort((a, b) =>
    String(b.reportedAt ?? "").localeCompare(String(a.reportedAt ?? "")),
  );
  const orderedUpdates = [...progressUpdates].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );

  const latestOutcome = orderedOutcomes.length > 0 ? orderedOutcomes[0] : null;
  const pendingOutcomes = outcomes.filter((outcome) => !outcome.validationDecision).length;
  const canReportOutcome =
    completed && (latestOutcome === null || latestOutcome.validationDecision === "REJECTED");

  const behindSchedule = cm.scheduleVariancePct < -10;
  const atRisk = cm.valueAtRiskPoints > 0.005;
  const hasBlockers = cm.blockerCount > 0;
  const forecastDays =
    cm.forecastEndDate && cm.plannedEndDate ? daysBetween(cm.plannedEndDate, cm.forecastEndDate) : 0;
  const forecastLate = (isPlanned || inProgress) && forecastDays > 0;
  const fullProgress = cm.progressPct >= 100;
  const canComplete = fullProgress && !hasBlockers;
  const completeBlocked = !fullyOrNull(fullProgress)
    ? "Progress must reach 100% before the commitment can be completed"
    : hasBlockers
      ? "Open blockers must be cleared before the commitment can be completed"
      : undefined;

  const validatingOutcome =
    outcomes.find((outcome) => String(outcome.id) === validatingId) ?? null;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      applyDetail(await performFlow(action, params.id));

      setFlow(null);

      toast.success(FLOWS[action].done, cm.commitmentNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update execution commitment.",
      );
    } finally {
      setFlowRunning(false);
    }
  }

  function handleProgressSaved(updated: ExecutionCommitmentDetail, detailText: string) {
    applyDetail(updated);
    setRecordingProgress(false);
    toast.success("Progress recorded", detailText);
  }

  function handleOutcomeSaved(updated: ExecutionCommitmentDetail, detailText: string) {
    applyDetail(updated);
    setReporting(false);
    toast.success("Outcome reported", detailText);
  }

  function handleValidated(updated: ExecutionCommitmentDetail, title: string) {
    applyDetail(updated);
    setValidatingId(null);
    toast.success(title, cm.commitmentNumber);
  }

  const kpis: KpiItem[] = [
    {
      label: "Progress",
      icon: Gauge,
      value: `${cm.progressPct.toFixed(1)}%`,
      note: `Expected ${cm.expectedProgressPct.toFixed(1)}%`,
    },
    {
      label: "Schedule variance",
      icon: TrendingDown,
      value: `${signed(cm.scheduleVariancePct)} pts`,
      note: "Progress against expected",
      tone: behindSchedule ? "warning" : "default",
    },
    {
      label: "Planned contribution",
      icon: Target,
      value: cm.plannedContributionPoints.toFixed(1),
      note: "From the roadmap",
    },
    {
      label: "Reported",
      icon: Activity,
      value: cm.reportedContributionPoints.toFixed(1),
      note: "Reported outcome points",
    },
    {
      label: "Validated",
      icon: BadgeCheck,
      value: cm.validatedContributionPoints.toFixed(1),
      note: "Manager-validated points",
    },
    {
      label: "Value at risk",
      icon: ShieldAlert,
      value: cm.valueAtRiskPoints.toFixed(1),
      note: "Planned points not yet secured",
      tone: atRisk ? "warning" : "default",
    },
  ];

  const updateColumns = buildUpdateColumns();
  const outcomeColumns = buildOutcomeColumns({
    canValidate,
    busy: busyAny,
    onValidate: (outcome) => setValidatingId(String(outcome.id)),
  });

  return (
    <div className="page-stack">
      <Link href="/strategy-execution" className="request-back-link">
        <ArrowLeft size={16} />
        Strategic execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{cm.commitmentNumber}</span>

            <StatusBadge value={status} label={readable(status)} />

            <StatusBadge value={String(cm.health)} label={readable(String(cm.health))} />
          </div>

          <span className="eyebrow">Governed execution commitment</span>

          <h1>{cm.sourceInitiativeTitle}</h1>

          <p>
            {cm.sourceInitiativeNumber}
            {" · "}
            {cm.sourceRoadmapNumber}
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

          {canValidate && (isPlanned || inProgress) ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => setFlow("CANCEL")}
            >
              <XCircle size={15} />
              Cancel commitment
            </button>
          ) : null}

          {canManage && inProgress ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecordingProgress(true)}
            >
              <Plus size={15} />
              Record progress
            </button>
          ) : null}

          {canManage && inProgress ? (
            <button
              type="button"
              className={`button ${canComplete ? "button--primary" : "button--secondary"}`}
              disabled={busyAny || !canComplete}
              title={completeBlocked}
              onClick={() => setFlow("COMPLETE")}
            >
              <CheckCircle2 size={15} />
              Complete commitment
            </button>
          ) : null}

          {canManage && isPlanned ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("START")}
            >
              <Play size={15} />
              Start commitment
            </button>
          ) : null}

          {canManage && canReportOutcome ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setReporting(true)}
            >
              <Plus size={15} />
              Report contribution
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

      {behindSchedule && (isPlanned || inProgress) ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Delivery is behind schedule.</strong> Progress is {cm.progressPct.toFixed(1)}%
            against an expected {cm.expectedProgressPct.toFixed(1)}% (
            {signed(cm.scheduleVariancePct)} pts).
          </div>
        </div>
      ) : null}

      {forecastLate ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The forecast end is after the planned end.</strong> It is{" "}
            {plural(forecastDays, "day", "days")} past {showDate(cm.plannedEndDate)}.
          </div>
        </div>
      ) : null}

      {hasBlockers && (isPlanned || inProgress) ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{plural(cm.blockerCount, "blocker is", "blockers are")} open.</strong>{" "}
            {cm.blockerSummary ? `${cm.blockerSummary} ` : ""}
            {fullProgress ? "The commitment cannot be completed until they are cleared." : ""}
          </div>
        </div>
      ) : null}

      {canManage && isPlanned ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Start the commitment to begin delivery.</strong> Immutable progress evidence can
            be recorded once it is in progress.
          </div>
        </div>
      ) : null}

      {canManage && inProgress && !fullProgress ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Record progress as delivery moves.</strong> The commitment can be completed once
            progress reaches 100% with no open blockers.
          </div>
        </div>
      ) : null}

      {canManage && inProgress && canComplete ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The commitment is ready to complete.</strong> Progress is at 100% with no open
            blockers.
          </div>
        </div>
      ) : null}

      {completed && canReportOutcome && latestOutcome !== null ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The latest outcome report was rejected.</strong>{" "}
            {canManage
              ? "Report the contribution again with corrected evidence."
              : "A buyer or manager needs to report the contribution again."}
          </div>
        </div>
      ) : null}

      {completed && canReportOutcome && latestOutcome === null ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Report the contribution outcome.</strong>{" "}
            {canManage
              ? "A manager then validates it, and only validated points count."
              : "A buyer or manager needs to report it."}
          </div>
        </div>
      ) : null}

      {pendingOutcomes > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(pendingOutcomes, "outcome report is", "outcome reports are")} awaiting
              validation.
            </strong>{" "}
            {canValidate
              ? "Use Validate on the row to validate or reject it."
              : "A procurement manager or administrator needs to validate it."}
          </div>
        </div>
      ) : null}

      {cancelled ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This commitment was cancelled.</strong> It will not deliver its planned
            contribution.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Commitment summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Delivery and contribution</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={cm.progressPct}
          tone={fullProgress ? meterToneFor("success") : "primary"}
          caption={`Progress ${cm.progressPct.toFixed(1)}% against an expected ${cm.expectedProgressPct.toFixed(1)}%`}
          label="Delivery progress"
        />

        {cm.plannedContributionPoints > 0 ? (
          <ProgressLine
            pct={(cm.validatedContributionPoints / cm.plannedContributionPoints) * 100}
            tone={
              cm.validatedContributionPoints >= cm.plannedContributionPoints
                ? meterToneFor("success")
                : "primary"
            }
            caption={`${cm.validatedContributionPoints.toFixed(1)} of ${cm.plannedContributionPoints.toFixed(1)} planned points validated`}
            label="Validated against planned contribution"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Commitment authority</span>

            <h2>Delivery context</h2>
          </div>

          <Goal size={19} />
        </div>

        <div className="execution-context-grid">
          <div>
            <span>Owner</span>

            <strong>{cm.ownerName}</strong>
          </div>

          <div>
            <span>Planned window</span>

            <strong>
              {showDate(cm.plannedStartDate)}
              {" → "}
              {showDate(cm.plannedEndDate)}
            </strong>
          </div>

          <div>
            <span>Forecast end</span>

            <strong className={forecastLate ? "kit-text-warning" : undefined}>
              {showDate(cm.forecastEndDate)}
            </strong>
          </div>

          <div>
            <span>Active blockers</span>

            <strong className={hasBlockers ? "kit-text-warning" : undefined}>
              {cm.blockerCount}
            </strong>
          </div>
        </div>

        {cm.blockerSummary ? (
          <p className="execution-blocker-summary">{cm.blockerSummary}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Delivery history</span>

            <h2>Immutable progress updates</h2>
          </div>

          {canManage && inProgress ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecordingProgress(true)}
            >
              <Plus size={15} />
              Record progress
            </button>
          ) : (
            <Activity size={19} />
          )}
        </div>

        <DataTable
          columns={updateColumns}
          rows={orderedUpdates}
          getRowId={(item) => String(item.id)}
          ariaLabel="Progress updates"
          busy={fetching}
          empty={
            <EmptyState
              icon={Activity}
              title="No progress evidence"
              description="No progress evidence has been recorded."
              action={
                canManage && inProgress ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setRecordingProgress(true)}
                  >
                    <Plus size={15} />
                    Record progress
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
            <span className="eyebrow">Value realization evidence</span>

            <h2>Outcome reports</h2>
          </div>

          {canManage && canReportOutcome ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setReporting(true)}
            >
              <Plus size={15} />
              Report contribution
            </button>
          ) : (
            <FileCheck2 size={19} />
          )}
        </div>

        <DataTable
          columns={outcomeColumns}
          rows={orderedOutcomes}
          getRowId={(item) => String(item.id)}
          ariaLabel="Outcome reports"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No outcome report"
              description="No outcome report has been submitted."
              action={
                canManage && canReportOutcome ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setReporting(true)}
                  >
                    <Plus size={15} />
                    Report contribution
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="execution-method-note">
        <Goal size={18} />

        <div>
          <strong>Planned ≠ reported ≠ validated</strong>

          <p>
            The roadmap contribution is the plan. An execution owner may later report an outcome,
            but only an explicit manager validation can create validated contribution.
          </p>
        </div>
      </section>

      {recordingProgress ? (
        <ProgressModal
          commitmentId={params.id}
          commitment={cm}
          onClose={() => setRecordingProgress(false)}
          onSaved={handleProgressSaved}
        />
      ) : null}

      {reporting ? (
        <OutcomeModal
          commitmentId={params.id}
          commitment={cm}
          onClose={() => setReporting(false)}
          onSaved={handleOutcomeSaved}
        />
      ) : null}

      {validatingOutcome !== null ? (
        <ValidationModal
          outcome={validatingOutcome}
          onClose={() => setValidatingId(null)}
          onSaved={handleValidated}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, cm)}
          confirmLabel={FLOWS[flow].confirm}
          busyLabel={FLOWS[flow].busy}
          cancelLabel={FLOWS[flow].keep}
          busy={flowRunning}
          onConfirm={() => void confirmFlow()}
          onCancel={() => setFlow(null)}
        />
      ) : null}
    </div>
  );
}

function fullyOrNull(value: boolean): boolean {
  return value;
}
