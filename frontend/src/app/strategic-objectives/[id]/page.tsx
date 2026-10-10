"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  Gauge,
  Goal,
  Info,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Target,
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
  achieveStrategicObjective,
  cancelStrategicObjective,
  captureOkrSnapshot,
  closeStrategicObjective,
  createOkrContribution,
  createStrategicKeyResult,
  getStrategicObjective,
  getStrategicOkrContext,
  holdStrategicObjective,
  refreshStrategicObjective,
  resumeStrategicObjective,
  startStrategicObjective,
  updateManualKeyResultActual,
} from "@/lib/api";
import type {
  KeyResultDirection,
  KeyResultMetricType,
  KeyResultSourceType,
  OkrContext,
  OkrSourceScopeType,
  StrategicObjectiveDetail,
} from "@/types/strategic-okr";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Objective = StrategicObjectiveDetail["objective"];
type KeyResult = StrategicObjectiveDetail["keyResults"][number];
type OkrSnapshot = StrategicObjectiveDetail["snapshots"][number];
type Improvement = OkrContext["improvementInitiatives"][number];
type Transition = "START" | "HOLD" | "RESUME" | "ACHIEVE" | "CLOSE";
type KeyResultField = "title" | "baseline" | "target" | "weight" | "scope";
type ContributionField = "weight" | "rationale" | "keyResult" | "initiative";
type ActualField = "value" | "note";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const ANY_NUMBER = { min: -1e12 };

const METRIC_TYPES: { value: string; label: string }[] = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "COUNT", label: "Count" },
  { value: "CURRENCY", label: "Currency" },
  { value: "HOURS", label: "Hours" },
  { value: "NUMBER", label: "Number" },
];

const DIRECTIONS: { value: string; label: string }[] = [
  { value: "INCREASE", label: "Increase" },
  { value: "DECREASE", label: "Decrease" },
];

const SOURCE_TYPES: { value: string; label: string }[] = [
  { value: "MANUAL", label: "Controlled manual" },
  { value: "OPERATING_RHYTHM_SLA_ATTAINMENT", label: "Operating rhythm — SLA attainment" },
  { value: "OPERATING_RHYTHM_ACTIVE_BACKLOG", label: "Operating rhythm — active backlog" },
  { value: "OPERATING_RHYTHM_SLA_OVERDUE", label: "Operating rhythm — SLA overdue" },
  { value: "OPERATING_RHYTHM_PERSISTENT_BACKLOG", label: "Operating rhythm — persistent backlog" },
  { value: "OPERATING_RHYTHM_AVG_RESOLUTION_HOURS", label: "Operating rhythm — avg resolution hours" },
  { value: "OPERATING_RHYTHM_ACTIVE_EXPOSURE", label: "Operating rhythm — active exposure" },
  {
    value: "CONTINUOUS_IMPROVEMENT_ACTIVE_INITIATIVES",
    label: "Improvement — active initiatives",
  },
  {
    value: "CONTINUOUS_IMPROVEMENT_COMPLETED_INITIATIVES",
    label: "Improvement — completed initiatives",
  },
  {
    value: "CONTINUOUS_IMPROVEMENT_IMPROVED_INITIATIVES",
    label: "Improvement — improved initiatives",
  },
  {
    value: "CONTINUOUS_IMPROVEMENT_COMPLETION_RATE",
    label: "Improvement — completion rate",
  },
];

const SCOPE_TYPES: { value: string; label: string }[] = [
  { value: "OVERALL", label: "Overall" },
  { value: "DOMAIN", label: "Domain" },
  { value: "OWNER", label: "Owner" },
  { value: "SEVERITY", label: "Severity" },
  { value: "EXCEPTION_TYPE", label: "Exception type" },
];

function displayValue(value: number, metricType: KeyResultMetricType, currency: string): string {
  if (metricType === "CURRENCY") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (metricType === "PERCENTAGE") {
    return `${value.toFixed(1)}%`;
  }

  if (metricType === "HOURS") {
    return `${value.toFixed(1)}h`;
  }

  return value.toFixed(1);
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function healthTone(health: string) {
  const value = String(health);

  if (value === "ACHIEVED" || value === "ON_TRACK") {
    return meterToneFor("success");
  }

  if (value === "AT_RISK") {
    return meterToneFor("warning");
  }

  if (value === "OFF_TRACK") {
    return meterToneFor("danger");
  }

  return "primary" as const;
}

function periodLabel(objective: Objective): string {
  return objective.periodType === "QUARTERLY"
    ? `Q${objective.quarter} ${objective.fiscalYear}`
    : `FY ${objective.fiscalYear}`;
}

interface TransitionCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const TRANSITIONS: Record<Transition, TransitionCopy> = {
  START: {
    eyebrow: "Start objective",
    title: "Start this objective?",
    confirm: "Start objective",
    busy: "Starting…",
    keep: "Not yet",
    done: "Objective started",
    failed: "Could not start the objective",
  },
  HOLD: {
    eyebrow: "Put on hold",
    title: "Put this objective on hold?",
    confirm: "Put on hold",
    busy: "Updating…",
    keep: "Keep active",
    done: "Objective put on hold",
    failed: "Could not put the objective on hold",
  },
  RESUME: {
    eyebrow: "Resume objective",
    title: "Resume this objective?",
    confirm: "Resume objective",
    busy: "Resuming…",
    keep: "Keep on hold",
    done: "Objective resumed",
    failed: "Could not resume the objective",
  },
  ACHIEVE: {
    eyebrow: "Mark achieved",
    title: "Mark this objective as achieved?",
    confirm: "Mark achieved",
    busy: "Updating…",
    keep: "Not yet",
    done: "Objective achieved",
    failed: "Could not mark the objective as achieved",
  },
  CLOSE: {
    eyebrow: "Close objective",
    title: "Close this objective?",
    confirm: "Close objective",
    busy: "Closing…",
    keep: "Keep open",
    done: "Objective closed",
    failed: "Could not close the objective",
  },
};

function transitionDescription(transition: Transition, objective: Objective): string {
  const name = `${objective.objectiveNumber} (${objective.title})`;

  switch (transition) {
    case "START":
      return `${name} will become active and start tracking its ${objective.keyResultCount} key results.`;

    case "HOLD":
      return `${name} will be put on hold. You can resume it later.`;

    case "RESUME":
      return `${name} will be set back to active.`;

    case "ACHIEVE":
      return `${name} will be marked as achieved.`;

    case "CLOSE":
      return `${name} will be closed.`;
  }
}

/* ------------------------------------------------------------------ */
/* Snapshot table columns                                              */
/* ------------------------------------------------------------------ */

function buildSnapshotColumns(): Column<OkrSnapshot>[] {
  return [
    {
      id: "snapshot",
      header: "Snapshot",
      sortValue: (item) => item.snapshotNumber,
      cell: (item) => <strong>{item.snapshotNumber}</strong>,
    },
    {
      id: "progress",
      header: "Progress",
      align: "right",
      sortValue: (item) => item.overallProgressPct,
      cell: (item) => `${item.overallProgressPct.toFixed(1)}%`,
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => item.overallHealth,
      cell: (item) => <StatusBadge value={item.overallHealth} />,
    },
    {
      id: "confidence",
      header: "Confidence",
      align: "right",
      sortValue: (item) => item.overallConfidencePct,
      cell: (item) => `${item.overallConfidencePct.toFixed(1)}%`,
    },
    {
      id: "results",
      header: "Key results",
      align: "right",
      sortValue: (item) => item.achievedKeyResultCount,
      cell: (item) => `${item.achievedKeyResultCount}/${item.keyResultCount}`,
    },
    {
      id: "captured",
      header: "Captured",
      sortValue: (item) => item.capturedAt,
      cell: (item) => formatDateTime(item.capturedAt),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link href={`/strategic-objectives/snapshots/${item.id}`} className="table-action">
          Open
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add key result modal                                                */
/* ------------------------------------------------------------------ */

interface KeyResultModalProps {
  objectiveId: string;
  currency: string;
  coverage: number;
  context: OkrContext;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function KeyResultModal({
  objectiveId,
  currency,
  coverage,
  context,
  onClose,
  onSaved,
}: KeyResultModalProps) {
  const remaining = Math.max(0, 100 - coverage);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metricType, setMetricType] = useState<KeyResultMetricType>("PERCENTAGE");
  const [direction, setDirection] = useState<KeyResultDirection>("INCREASE");
  const [sourceType, setSourceType] = useState<KeyResultSourceType>("MANUAL");
  const [scopeType, setScopeType] = useState<OkrSourceScopeType>("OVERALL");
  const [scopeKey, setScopeKey] = useState("");
  const [baseline, setBaseline] = useState("0");
  const [target, setTarget] = useState("100");
  const [weight, setWeight] = useState(() => String(round2(remaining > 0 ? Math.min(25, remaining) : 25)));
  const [errors, setErrors] = useState<Partial<Record<KeyResultField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const operating = sourceType.startsWith("OPERATING_RHYTHM_");
  const scopes = context.operatingScopes.filter((scope) => scope.scopeType === scopeType);

  const validNumbers =
    numberError(baseline, ANY_NUMBER) === undefined &&
    numberError(target, ANY_NUMBER) === undefined;

  const wrongWay =
    validNumbers &&
    (direction === "INCREASE"
      ? Number(target) < Number(baseline)
      : Number(target) > Number(baseline));

  const sameValue = validNumbers && Number(target) === Number(baseline);

  const weightProblem = numberError(weight, { min: 0.01, max: 100 });
  const newTotal = weightProblem === undefined ? coverage + Number(weight) : null;

  function clearError(field: KeyResultField) {
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

    const next: Partial<Record<KeyResultField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter a key result title.";
    }

    const baselineProblem = numberError(baseline, ANY_NUMBER);
    const targetProblem = numberError(target, ANY_NUMBER);

    if (baselineProblem) {
      next.baseline = baselineProblem;
    }

    if (targetProblem) {
      next.target = targetProblem;
    }

    if (weightProblem) {
      next.weight = weightProblem;
    }

    if (operating && scopeType !== "OVERALL" && !scopeKey) {
      next.scope = "Select a scope value.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createStrategicKeyResult(objectiveId, {
        title: title.trim(),
        description: description.trim() || undefined,
        metricType,
        direction,
        sourceType,
        sourceScopeType: operating ? scopeType : undefined,
        sourceScopeKey: operating && scopeType !== "OVERALL" ? scopeKey : undefined,
        baselineValue: Number(baseline),
        targetValue: Number(target),
        weightPct: Number(weight),
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create key result.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Measurement"
      title="Add key result"
      description={`Currency ${currency}. ${coverage.toFixed(0)}% of the objective weight is allocated so far.`}
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
            form="okr-key-result-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add key result"}
          </button>
        </>
      }
    >
      <form id="okr-key-result-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Title" htmlFor="kr-title" error={errors.title}>
              <input
                id="kr-title"
                className="kit-field-input"
                maxLength={220}
                value={title}
                aria-invalid={errors.title ? true : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearError("title");
                }}
              />
            </Field>
          </div>

          <Field label="Metric" htmlFor="kr-metric">
            <select
              id="kr-metric"
              className="kit-field-input"
              value={metricType}
              onChange={(event) => setMetricType(event.target.value as KeyResultMetricType)}
            >
              {METRIC_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Direction" htmlFor="kr-direction">
            <select
              id="kr-direction"
              className="kit-field-input"
              value={direction}
              onChange={(event) => setDirection(event.target.value as KeyResultDirection)}
            >
              {DIRECTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="kit-pair-wide">
            <Field label="Actual-value authority" htmlFor="kr-source">
              <select
                id="kr-source"
                className="kit-field-input"
                value={sourceType}
                onChange={(event) => {
                  setSourceType(event.target.value as KeyResultSourceType);
                  setScopeKey("");
                  clearError("scope");
                }}
              >
                {SOURCE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {operating ? (
            <Field label="Scope" htmlFor="kr-scope-type">
              <select
                id="kr-scope-type"
                className="kit-field-input"
                value={scopeType}
                onChange={(event) => {
                  setScopeType(event.target.value as OkrSourceScopeType);
                  setScopeKey("");
                  clearError("scope");
                }}
              >
                {SCOPE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {operating && scopeType !== "OVERALL" ? (
            <Field label="Scope value" htmlFor="kr-scope-key" error={errors.scope}>
              <select
                id="kr-scope-key"
                className="kit-field-input"
                value={scopeKey}
                aria-invalid={errors.scope ? true : undefined}
                onChange={(event) => {
                  setScopeKey(event.target.value);
                  clearError("scope");
                }}
              >
                <option value="">Select scope</option>

                {scopes.map((scope) => (
                  <option key={scope.scopeKey} value={scope.scopeKey}>
                    {scope.scopeLabel}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <NumberField
            id="kr-baseline"
            label="Baseline"
            step="0.01"
            value={baseline}
            error={errors.baseline}
            onChange={(value) => {
              setBaseline(value);
              clearError("baseline");
            }}
          />

          <NumberField
            id="kr-target"
            label="Target"
            step="0.01"
            value={target}
            error={errors.target}
            onChange={(value) => {
              setTarget(value);
              clearError("target");
            }}
          />

          <NumberField
            id="kr-weight"
            label="Weight (%)"
            min={0.01}
            max={100}
            step="0.01"
            value={weight}
            error={errors.weight}
            onChange={(value) => {
              setWeight(value);
              clearError("weight");
            }}
          />

          <div className="kit-pair-wide">
            <Field label="Description" htmlFor="kr-description">
              <textarea
                id="kr-description"
                className="kit-field-input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {wrongWay ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The target is on the wrong side of the baseline for a{" "}
            {direction === "INCREASE" ? "metric that should increase" : "metric that should decrease"}.
          </p>
        ) : null}

        {sameValue ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The baseline and the target are the same, so progress cannot be measured.
          </p>
        ) : null}

        {newTotal !== null && newTotal > 100.005 ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This would bring the total key result weight to {newTotal.toFixed(0)}%, above 100%.
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
/* Map improvement contribution modal                                  */
/* ------------------------------------------------------------------ */

interface ContributionModalProps {
  keyResults: KeyResult[];
  improvements: Improvement[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

function ContributionModal({ keyResults, improvements, onClose, onSaved }: ContributionModalProps) {
  const [keyResultId, setKeyResultId] = useState(keyResults[0]?.id ?? "");
  const [improvementId, setImprovementId] = useState(improvements[0]?.id ?? "");
  const [weight, setWeight] = useState("25");
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ContributionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: ContributionField) {
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

    const next: Partial<Record<ContributionField, string>> = {};

    if (!keyResultId) {
      next.keyResult = "Select a key result.";
    }

    if (!improvementId) {
      next.initiative = "Select an improvement initiative.";
    }

    const weightProblem = numberError(weight, { min: 0.01, max: 100 });

    if (weightProblem) {
      next.weight = weightProblem;
    }

    if (!rationale.trim()) {
      next.rationale = "Explain how the initiative contributes.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createOkrContribution(keyResultId, {
        improvementInitiativeId: improvementId,
        contributionWeightPct: Number(weight),
        rationale: rationale.trim(),
      });

      const initiative = improvements.find((item) => item.id === improvementId);

      onSaved(initiative ? initiative.initiativeNumber : "Contribution mapped");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to map improvement contribution.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Strategy contribution"
      title="Map improvement initiative"
      description="Link an improvement initiative to the key result it moves."
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
            form="okr-contribution-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Mapping…" : "Map contribution"}
          </button>
        </>
      }
    >
      <form id="okr-contribution-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Key result" htmlFor="contribution-kr" error={errors.keyResult}>
              <select
                id="contribution-kr"
                className="kit-field-input"
                value={keyResultId}
                aria-invalid={errors.keyResult ? true : undefined}
                onChange={(event) => {
                  setKeyResultId(event.target.value);
                  clearError("keyResult");
                }}
              >
                <option value="">Select key result</option>

                {keyResults.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Improvement initiative" htmlFor="contribution-initiative" error={errors.initiative}>
              <select
                id="contribution-initiative"
                className="kit-field-input"
                value={improvementId}
                aria-invalid={errors.initiative ? true : undefined}
                onChange={(event) => {
                  setImprovementId(event.target.value);
                  clearError("initiative");
                }}
              >
                <option value="">Select initiative</option>

                {improvements.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.initiativeNumber} — {item.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <NumberField
            id="contribution-weight"
            label="Contribution (%)"
            min={0.01}
            max={100}
            step="0.01"
            value={weight}
            error={errors.weight}
            onChange={(value) => {
              setWeight(value);
              clearError("weight");
            }}
          />

          <div className="kit-pair-wide">
            <Field label="Contribution rationale" htmlFor="contribution-rationale" error={errors.rationale}>
              <textarea
                id="contribution-rationale"
                className="kit-field-input"
                rows={5}
                value={rationale}
                aria-invalid={errors.rationale ? true : undefined}
                onChange={(event) => {
                  setRationale(event.target.value);
                  clearError("rationale");
                }}
              />
            </Field>
          </div>
        </div>

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
/* Manual actual modal                                                 */
/* ------------------------------------------------------------------ */

interface ActualModalProps {
  keyResult: KeyResult;
  currency: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function ActualModal({ keyResult, currency, onClose, onSaved }: ActualModalProps) {
  const [value, setValue] = useState(() => String(keyResult.actualValue));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ActualField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: ActualField) {
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

    const next: Partial<Record<ActualField, string>> = {};

    const valueProblem = numberError(value, ANY_NUMBER);

    if (valueProblem) {
      next.value = valueProblem;
    }

    if (!note.trim()) {
      next.note = "An evidence note is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateManualKeyResultActual(keyResult.id, Number(value), note.trim());

      onSaved(keyResult.title);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update manual key-result actual.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Controlled manual actual"
      title="Update actual value"
      description={`${keyResult.title}. Baseline ${displayValue(keyResult.baselineValue, keyResult.metricType, currency)}, target ${displayValue(keyResult.targetValue, keyResult.metricType, currency)}.`}
      size="sm"
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
            form="okr-actual-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Updating…" : "Update actual"}
          </button>
        </>
      }
    >
      <form id="okr-actual-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <NumberField
              id="actual-value"
              label="Actual value"
              step="0.01"
              value={value}
              error={errors.value}
              onChange={(next) => {
                setValue(next);
                clearError("value");
              }}
            />
          </div>

          <div className="kit-pair-wide">
            <Field label="Evidence note" htmlFor="actual-note" error={errors.note}>
              <textarea
                id="actual-note"
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

interface ObjectiveData {
  id: string;
  detail: StrategicObjectiveDetail;
  context: OkrContext;
}

export default function StrategicObjectivePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<ObjectiveData | null>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [pendingRunning, setPendingRunning] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotRunning, setSnapshotRunning] = useState(false);
  const [refreshRunning, setRefreshRunning] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [addingKeyResult, setAddingKeyResult] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [updating, setUpdating] = useState<KeyResult | null>(null);
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
        const response = await getStrategicObjective(id);
        const contextResponse = await getStrategicOkrContext(response.objective.currency);

        if (active) {
          setResult({ id, detail: response, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load strategic objective.",
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
  const context = data?.context ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyDetail(updated: StrategicObjectiveDetail) {
    setResult((current) => (current ? { ...current, detail: updated } : current));
  }

  if (detail === null || context === null) {
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
        <Link href="/strategic-objectives" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic objectives
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

  const { objective, keyResults, snapshots } = detail;
  const improvements = context.improvementInitiatives;

  const status = objective.status;
  const mutable = status !== "ACHIEVED" && status !== "CLOSED" && status !== "CANCELLED";
  const coverageComplete = Math.abs(objective.weightCoveragePct - 100) < 0.005;
  const canStart = coverageComplete && objective.keyResultCount > 0;
  const busyAny =
    pendingRunning || snapshotRunning || refreshRunning || cancelRunning;
  const objectiveHealth = String(objective.health);

  async function confirmTransition() {
    if (pending === null) {
      return;
    }

    const action = pending;

    setPendingRunning(true);

    try {
      if (action === "START") {
        await startStrategicObjective(params.id);
      } else if (action === "HOLD") {
        await holdStrategicObjective(params.id);
      } else if (action === "RESUME") {
        await resumeStrategicObjective(params.id);
      } else if (action === "ACHIEVE") {
        await achieveStrategicObjective(params.id);
      } else {
        await closeStrategicObjective(params.id);
      }

      setPending(null);

      toast.success(TRANSITIONS[action].done, objective.objectiveNumber);
      reload();
    } catch (caught) {
      setPending(null);

      toast.error(
        TRANSITIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update strategic objective.",
      );
    } finally {
      setPendingRunning(false);
    }
  }

  async function refreshActuals() {
    if (refreshRunning) {
      return;
    }

    setRefreshRunning(true);

    try {
      applyDetail(await refreshStrategicObjective(params.id));

      toast.success("Actuals refreshed", objective.objectiveNumber);
    } catch (caught) {
      toast.error(
        "Could not refresh the actuals",
        caught instanceof Error
          ? caught.message
          : "Unable to refresh authority-backed actuals.",
      );
    } finally {
      setRefreshRunning(false);
    }
  }

  async function confirmSnapshot() {
    setSnapshotRunning(true);

    try {
      await captureOkrSnapshot(params.id);

      setSnapshotOpen(false);

      toast.success("Snapshot captured", objective.objectiveNumber);
      reload();
    } catch (caught) {
      setSnapshotOpen(false);

      toast.error(
        "Could not capture the snapshot",
        caught instanceof Error ? caught.message : "Unable to capture executive OKR snapshot.",
      );
    } finally {
      setSnapshotRunning(false);
    }
  }

  async function confirmCancel(note: string) {
    setCancelRunning(true);
    setCancelError(null);

    try {
      await cancelStrategicObjective(params.id, note);

      setCancelOpen(false);

      toast.success("Objective cancelled", objective.objectiveNumber);
      reload();
    } catch (caught) {
      setCancelError(
        caught instanceof Error ? caught.message : "Unable to update strategic objective.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  function handleKeyResultAdded(title: string) {
    setAddingKeyResult(false);
    toast.success("Key result added", title);
    reload();
  }

  function handleMapped(message: string) {
    setMapping(false);
    toast.success("Contribution mapped", message);
    reload();
  }

  function handleActualUpdated(title: string) {
    setUpdating(null);
    toast.success("Actual updated", title);
    reload();
  }

  const achievedAll =
    objective.keyResultCount > 0 && objective.achievedKeyResultCount >= objective.keyResultCount;
  const notAchieved = Math.max(0, objective.keyResultCount - objective.achievedKeyResultCount);

  const kpis: KpiItem[] = [
    {
      label: "Progress",
      icon: Gauge,
      value: `${objective.progressPct.toFixed(1)}%`,
      note: readable(objective.health),
    },
    {
      label: "Confidence",
      icon: Target,
      value: `${objective.confidencePct.toFixed(1)}%`,
      note: "Weighted key-result confidence",
    },
    {
      label: "KR coverage",
      icon: Goal,
      value: `${objective.weightCoveragePct.toFixed(0)}%`,
      note: "Of key-result weight allocated",
      tone: status === "DRAFT" && !coverageComplete ? "warning" : "default",
    },
    {
      label: "Key results achieved",
      icon: BadgeCheck,
      value: `${objective.achievedKeyResultCount}/${objective.keyResultCount}`,
      note: `${objective.snapshotCount} snapshots captured`,
    },
  ];

  const snapshotColumns = buildSnapshotColumns();

  return (
    <div className="page-stack">
      <Link href="/strategic-objectives" className="request-back-link">
        <ArrowLeft size={16} />
        Strategic objectives
      </Link>

      <section className="okr-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{objective.objectiveNumber}</span>

            <StatusBadge value={status} />

            <StatusBadge value={objective.health} />
          </div>

          <h1>{objective.title}</h1>

          <p>
            {periodLabel(objective)}
            {" · "}
            {formatDate(objective.startDate)}
            {" → "}
            {formatDate(objective.endDate)}
            {" · Owner "}
            {objective.ownerName}
          </p>
        </div>

        <div className="okr-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Reload
          </button>

          {canManage && mutable ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => void refreshActuals()}
            >
              <Gauge size={15} />
              {refreshRunning ? "Refreshing…" : "Refresh actuals"}
            </button>
          ) : null}

          {canManage && status !== "DRAFT" && status !== "CANCELLED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setSnapshotOpen(true)}
            >
              <Camera size={15} />
              Capture snapshot
            </button>
          ) : null}

          {canFinalize && mutable ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => {
                setCancelError(null);
                setCancelOpen(true);
              }}
            >
              <XCircle size={15} />
              Cancel objective
            </button>
          ) : null}

          {canManage && status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !canStart}
              title={canStart ? undefined : "Key result weights must total 100% first"}
              onClick={() => setPending("START")}
            >
              <Play size={15} />
              Start
            </button>
          ) : null}

          {canManage && status === "ACTIVE" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPending("HOLD")}
            >
              <Pause size={15} />
              Hold
            </button>
          ) : null}

          {canManage && status === "ON_HOLD" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPending("RESUME")}
            >
              <Play size={15} />
              Resume
            </button>
          ) : null}

          {canFinalize && (status === "ACTIVE" || status === "ON_HOLD") ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || objective.progressPct < 100}
              title={objective.progressPct < 100 ? "Progress must reach 100% first" : undefined}
              onClick={() => setPending("ACHIEVE")}
            >
              <BadgeCheck size={15} />
              Mark achieved
            </button>
          ) : null}

          {canFinalize && status === "ACHIEVED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPending("CLOSE")}
            >
              Close
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

      {status === "DRAFT" && canManage ? (
        canStart ? (
          <div className="kit-callout kit-callout--info" role="status">
            <Info size={17} />

            <div>
              <strong>Ready to start.</strong> The key result weights total 100%. Start the
              objective to begin tracking progress.
            </div>
          </div>
        ) : (
          <div className="kit-callout kit-callout--warning" role="status">
            <AlertTriangle size={17} />

            <div>
              <strong>The objective cannot start yet.</strong>{" "}
              {objective.keyResultCount === 0
                ? "Add at least one key result."
                : `Key result weights total ${objective.weightCoveragePct.toFixed(0)}% and must reach 100%.`}
            </div>
          </div>
        )
      ) : null}

      {status === "ON_HOLD" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This objective is on hold.</strong> Resume it to keep tracking progress.
          </div>
        </div>
      ) : null}

      {status === "ACTIVE" && objectiveHealth === "OFF_TRACK" ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This objective is off track.</strong> Review the key results below and update
            their actuals.
          </div>
        </div>
      ) : null}

      {status === "ACTIVE" && objectiveHealth === "AT_RISK" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This objective is at risk.</strong> Review the key results below.
          </div>
        </div>
      ) : null}

      {canFinalize && (status === "ACTIVE" || status === "ON_HOLD") && objective.progressPct >= 100 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Progress has reached 100%.</strong> You can now mark the objective as
            achieved.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Objective summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress and coverage</span>

            <h2>Delivery against the objective</h2>
          </div>

          <Gauge size={19} />
        </div>

        <div className="kit-meter-wrap">
          <Meter
            value={clampPercent(objective.progressPct)}
            max={100}
            tone={healthTone(objectiveHealth)}
            ariaLabel="Overall objective progress"
          />

          <span className="kit-meter-caption">
            Overall progress {objective.progressPct.toFixed(1)}%
          </span>
        </div>

        <div className="kit-meter-wrap">
          <Meter
            value={clampPercent(objective.weightCoveragePct)}
            max={100}
            tone={coverageComplete ? meterToneFor("success") : meterToneFor("warning")}
            ariaLabel="Key result weight allocated"
          />

          <span className="kit-meter-caption">
            {objective.weightCoveragePct.toFixed(0)}% of the key result weight is allocated
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Strategic outcome</span>

            <h2>Objective definition</h2>
          </div>

          <Goal size={19} />
        </div>

        <div className="okr-description">{detail.description}</div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Measurable execution</span>

            <h2>Key results</h2>
          </div>

          {canManage && mutable ? (
            <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
              {keyResults.length > 0 ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setMapping(true)}
                >
                  <Target size={15} />
                  Map initiative
                </button>
              ) : null}

              <button
                type="button"
                className="button button--secondary"
                onClick={() => setAddingKeyResult(true)}
              >
                <Plus size={15} />
                Add key result
              </button>
            </div>
          ) : (
            <Target size={19} />
          )}
        </div>

        {keyResults.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No key results"
            description="No key results have been defined for this objective."
            action={
              canManage && mutable ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setAddingKeyResult(true)}
                >
                  <Plus size={15} />
                  Add key result
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="okr-key-result-list">
            {keyResults.map((keyResult) => (
              <article key={keyResult.id}>
                <div className="okr-kr-heading">
                  <div>
                    <StatusBadge value={keyResult.health} />

                    <strong>{keyResult.title}</strong>

                    <small>
                      {readable(keyResult.sourceType)}
                      {" · Weight "}
                      {keyResult.weightPct.toFixed(0)}%
                    </small>
                  </div>

                  <div>
                    <span>Progress</span>

                    <strong>{keyResult.progressPct.toFixed(1)}%</strong>

                    <small>Confidence {keyResult.confidencePct.toFixed(0)}%</small>
                  </div>
                </div>

                <Meter
                  value={clampPercent(keyResult.progressPct)}
                  max={100}
                  tone={healthTone(String(keyResult.health))}
                  ariaLabel={`${keyResult.title} progress`}
                />

                <div className="okr-kr-values">
                  <span>
                    Baseline
                    <strong>
                      {displayValue(keyResult.baselineValue, keyResult.metricType, objective.currency)}
                    </strong>
                  </span>

                  <span>
                    Actual
                    <strong>
                      {displayValue(keyResult.actualValue, keyResult.metricType, objective.currency)}
                    </strong>
                  </span>

                  <span>
                    Target
                    <strong>
                      {displayValue(keyResult.targetValue, keyResult.metricType, objective.currency)}
                    </strong>
                  </span>
                </div>

                {keyResult.description ? <p>{keyResult.description}</p> : null}

                {keyResult.contributions.length > 0 ? (
                  <div className="okr-contribution-list">
                    {keyResult.contributions.map((contribution) => (
                      <span key={contribution.id}>
                        {contribution.initiativeNumber}
                        {" · "}
                        {contribution.initiativeTitle}
                        {" · "}
                        {contribution.contributionWeightPct.toFixed(0)}%
                      </span>
                    ))}
                  </div>
                ) : null}

                {canManage && mutable && keyResult.sourceType === "MANUAL" ? (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="kit-row-button"
                      disabled={busyAny}
                      onClick={() => setUpdating(keyResult)}
                    >
                      Update actual
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Executive progress record</span>

            <h2>Immutable OKR snapshots</h2>
          </div>

          {canManage && status !== "DRAFT" && status !== "CANCELLED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setSnapshotOpen(true)}
            >
              <Camera size={15} />
              Capture snapshot
            </button>
          ) : (
            <Camera size={19} />
          )}
        </div>

        <DataTable
          columns={snapshotColumns}
          rows={snapshots}
          getRowId={(item) => String(item.id)}
          ariaLabel="OKR snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No executive OKR snapshots have been captured."
            />
          }
        />
      </section>

      <section className="okr-method-note">
        <Goal size={18} />

        <div>
          <strong>Authority-preserving strategy execution</strong>

          <p>
            Strategic objectives read operational evidence from Steps 43 and 44 but never rewrite
            those authorities. Executive OKR snapshots are immutable once captured.
          </p>
        </div>
      </section>

      {addingKeyResult ? (
        <KeyResultModal
          objectiveId={params.id}
          currency={objective.currency}
          coverage={objective.weightCoveragePct}
          context={context}
          onClose={() => setAddingKeyResult(false)}
          onSaved={handleKeyResultAdded}
        />
      ) : null}

      {mapping ? (
        <ContributionModal
          keyResults={keyResults}
          improvements={improvements}
          onClose={() => setMapping(false)}
          onSaved={handleMapped}
        />
      ) : null}

      {updating !== null ? (
        <ActualModal
          keyResult={updating}
          currency={objective.currency}
          onClose={() => setUpdating(null)}
          onSaved={handleActualUpdated}
        />
      ) : null}

      {pending !== null ? (
        <ActionDialog
          eyebrow={TRANSITIONS[pending].eyebrow}
          title={TRANSITIONS[pending].title}
          description={transitionDescription(pending, objective)}
          confirmLabel={TRANSITIONS[pending].confirm}
          busyLabel={TRANSITIONS[pending].busy}
          cancelLabel={TRANSITIONS[pending].keep}
          busy={pendingRunning}
          onConfirm={() => void confirmTransition()}
          onCancel={() => setPending(null)}
        >
          {pending === "ACHIEVE" && !achievedAll && notAchieved > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {notAchieved} {notAchieved === 1 ? "key result is" : "key results are"} not marked as
              achieved yet.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {snapshotOpen ? (
        <ActionDialog
          eyebrow="Executive snapshot"
          title="Capture an OKR snapshot?"
          description={`The current progress, health and key results of ${objective.objectiveNumber} are recorded. A snapshot cannot be changed afterwards.`}
          confirmLabel="Capture snapshot"
          busyLabel="Capturing…"
          cancelLabel="Not yet"
          busy={snapshotRunning}
          onConfirm={() => void confirmSnapshot()}
          onCancel={() => setSnapshotOpen(false)}
        />
      ) : null}

      {cancelOpen ? (
        <RationaleDialog
          eyebrow="Governance"
          title="Cancel this objective"
          description={`${objective.objectiveNumber} will be cancelled and stop tracking progress.`}
          label="Cancellation rationale"
          placeholder="Why is this objective being cancelled?"
          confirmLabel="Cancel objective"
          busyLabel="Cancelling…"
          cancelLabel="Keep objective"
          tone="danger"
          maxLength={2000}
          busy={cancelRunning}
          error={cancelError}
          onConfirm={(note) => void confirmCancel(note)}
          onCancel={() => setCancelOpen(false)}
        />
      ) : null}
    </div>
  );
}
