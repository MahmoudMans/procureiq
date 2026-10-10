"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Gauge,
  Info,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Target,
  TrendingDown,
  Wrench,
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  cancelImprovementAction,
  cancelImprovementInitiative,
  completeImprovementAction,
  completeImprovementInitiative,
  createImprovementAction,
  createImprovementCheckpoint,
  getContinuousImprovementContext,
  getImprovementInitiative,
  holdImprovementInitiative,
  resumeImprovementInitiative,
  startImprovementAction,
  startImprovementInitiative,
} from "@/lib/api";
import type {
  ImprovementContext,
  ImprovementInitiativeDetail,
} from "@/types/continuous-improvement";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Initiative = ImprovementInitiativeDetail["initiative"];
type ImprovementAction = ImprovementInitiativeDetail["actions"][number];
type Checkpoint = ImprovementInitiativeDetail["checkpoints"][number];
type Snapshot = ImprovementContext["snapshots"][number];
type ImpUser = ImprovementContext["users"][number];
type Transition = "START" | "HOLD" | "RESUME" | "COMPLETE";
type ActionField = "title" | "dueDate";

interface ActionRequest {
  kind: "COMPLETE" | "CANCEL";
  action: ImprovementAction;
}

interface TargetRow {
  id: string;
  metric: string;
  target: string;
  baseline: string;
  latest: string;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const TARGET_COUNT = 5;

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function signed(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isOpenAction(action: ImprovementAction): boolean {
  return action.status === "PLANNED" || action.status === "IN_PROGRESS";
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "IMPROVED") {
    return <StatusBadge value="ACHIEVED" label="Improved" />;
  }

  if (outcome === "MIXED") {
    return <StatusBadge value="AT_RISK" label="Mixed" />;
  }

  if (outcome.includes("DETERIOR") || outcome.includes("WORSE")) {
    return <StatusBadge value="OFF_TRACK" label={readable(outcome)} />;
  }

  return <StatusBadge value={outcome} label={readable(outcome)} />;
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
    eyebrow: "Start initiative",
    title: "Start this initiative?",
    confirm: "Start initiative",
    busy: "Starting…",
    keep: "Not yet",
    done: "Initiative started",
    failed: "Could not start the initiative",
  },
  HOLD: {
    eyebrow: "Put on hold",
    title: "Put this initiative on hold?",
    confirm: "Put on hold",
    busy: "Updating…",
    keep: "Keep active",
    done: "Initiative put on hold",
    failed: "Could not put the initiative on hold",
  },
  RESUME: {
    eyebrow: "Resume initiative",
    title: "Resume this initiative?",
    confirm: "Resume initiative",
    busy: "Resuming…",
    keep: "Keep on hold",
    done: "Initiative resumed",
    failed: "Could not resume the initiative",
  },
  COMPLETE: {
    eyebrow: "Complete initiative",
    title: "Complete this initiative?",
    confirm: "Complete initiative",
    busy: "Completing…",
    keep: "Not yet",
    done: "Initiative completed",
    failed: "Could not complete the initiative",
  },
};

function transitionDescription(transition: Transition, initiative: Initiative): string {
  const name = `${initiative.initiativeNumber} (${initiative.title})`;

  switch (transition) {
    case "START":
      return `${name} will become active so actions and checkpoints can be tracked.`;

    case "HOLD":
      return `${name} will be put on hold. You can resume it later.`;

    case "RESUME":
      return `${name} will be set back to active.`;

    case "COMPLETE":
      return `${name} will be marked as completed. Historical snapshots are not changed.`;
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildTargetColumns(): Column<TargetRow>[] {
  return [
    {
      id: "metric",
      header: "Success criterion",
      cell: (row) => <strong>{row.metric}</strong>,
    },
    {
      id: "target",
      header: "Target",
      cell: (row) => row.target,
    },
    {
      id: "baseline",
      header: "Baseline",
      cell: (row) => row.baseline,
    },
    {
      id: "latest",
      header: "Latest checkpoint",
      cell: (row) =>
        row.latest === "—" ? <span className="kit-text-muted">—</span> : row.latest,
    },
  ];
}

interface ActionColumnOptions {
  canManage: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (action: ImprovementAction) => void;
  onComplete: (action: ImprovementAction) => void;
  onCancel: (action: ImprovementAction) => void;
}

function buildActionColumns(options: ActionColumnOptions): Column<ImprovementAction>[] {
  return [
    {
      id: "action",
      header: "Action",
      sortValue: (action) => action.title.toLowerCase(),
      cell: (action) => (
        <div className="request-primary-cell">
          <strong>{action.title}</strong>

          {action.description ? <span>{action.description}</span> : null}
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (action) => (action.ownerName ?? "").toLowerCase(),
      cell: (action) => action.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (action) => action.dueDate,
      cell: (action) => (
        <div className="kit-cell-stack">
          <span>{formatDate(action.dueDate)}</span>

          {action.overdue && isOpenAction(action) ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (action) => String(action.status),
      cell: (action) => <StatusBadge value={String(action.status)} />,
    },
    {
      id: "outcome",
      header: "Outcome",
      cell: (action) =>
        action.completionNote ? (
          <span>{action.completionNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 260,
      cell: (action) => {
        if (!options.canManage || !isOpenAction(action)) {
          return null;
        }

        const starting = options.workingId === String(action.id);

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {action.status === "PLANNED" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onStart(action)}
              >
                <Play size={14} />
                {starting ? "Starting…" : "Start"}
              </button>
            ) : null}

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onComplete(action)}
            >
              <BadgeCheck size={14} />
              Complete
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onCancel(action)}
            >
              <XCircle size={14} />
              Cancel
            </button>
          </div>
        );
      },
    },
  ];
}

function buildCheckpointColumns(): Column<Checkpoint>[] {
  return [
    {
      id: "snapshot",
      header: "Snapshot",
      sortValue: (item) => item.snapshotNumber,
      cell: (item) => <strong>{item.snapshotNumber}</strong>,
    },
    {
      id: "outcome",
      header: "Outcome",
      sortValue: (item) => String(item.outcome),
      cell: (item) => <OutcomeBadge outcome={String(item.outcome)} />,
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: (item) => item.achievementScore,
      cell: (item) => item.achievementScore.toFixed(1),
    },
    {
      id: "targets",
      header: "Targets met",
      align: "right",
      sortValue: (item) => item.targetsMetCount,
      cell: (item) => `${item.targetsMetCount}/${TARGET_COUNT}`,
    },
    {
      id: "sla",
      header: "SLA Δ",
      align: "right",
      sortValue: (item) => item.slaAttainmentDelta,
      cell: (item) => `${signed(item.slaAttainmentDelta)}pp`,
    },
    {
      id: "overdue",
      header: "Overdue ↓",
      align: "right",
      sortValue: (item) => item.slaOverdueReductionPct,
      cell: (item) => `${item.slaOverdueReductionPct.toFixed(1)}%`,
    },
    {
      id: "persistent",
      header: "Persistent ↓",
      align: "right",
      sortValue: (item) => item.persistentReductionPct,
      cell: (item) => `${item.persistentReductionPct.toFixed(1)}%`,
    },
    {
      id: "resolution",
      header: "Resolution ↓",
      align: "right",
      sortValue: (item) => item.resolutionHoursReductionPct,
      cell: (item) => `${item.resolutionHoursReductionPct.toFixed(1)}%`,
    },
    {
      id: "exposure",
      header: "Exposure ↓",
      align: "right",
      sortValue: (item) => item.exposureReductionPct,
      cell: (item) => `${item.exposureReductionPct.toFixed(1)}%`,
    },
    {
      id: "captured",
      header: "Captured",
      sortValue: (item) => item.capturedAt,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{formatDateTime(item.capturedAt)}</span>

          <small>{item.capturedByName}</small>
        </div>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add action modal                                                    */
/* ------------------------------------------------------------------ */

interface ActionModalProps {
  initiativeId: string;
  initiative: Initiative;
  users: ImpUser[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

function ActionModal({ initiativeId, initiative, users, onClose, onSaved }: ActionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(initiative.ownerUserId);
  const [dueDate, setDueDate] = useState(() => isoDate(14));
  const [errors, setErrors] = useState<Partial<Record<ActionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const afterTarget = dueDate !== "" && dueDate > initiative.targetDate;

  function clearError(field: ActionField) {
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

    const next: Partial<Record<ActionField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter an action title.";
    }

    if (!dueDate) {
      next.dueDate = "Choose a due date.";
    } else if (dueDate < isoDate(0)) {
      next.dueDate = "The due date cannot be in the past.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createImprovementAction(initiativeId, {
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerId || undefined,
        dueDate,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create improvement action.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Corrective experiment"
      title="Add improvement action"
      description="A corrective step intended to move the operating metrics."
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
            form="improvement-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add action"}
          </button>
        </>
      }
    >
      <form id="improvement-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Action title" htmlFor="improvement-action-title" error={errors.title}>
              <input
                id="improvement-action-title"
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

          <Field label="Owner" htmlFor="improvement-action-owner">
            <select
              id="improvement-action-owner"
              className="kit-field-input"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="improvement-action-due" error={errors.dueDate}>
            <input
              id="improvement-action-due"
              className="kit-field-input"
              type="date"
              value={dueDate}
              aria-invalid={errors.dueDate ? true : undefined}
              onChange={(event) => {
                setDueDate(event.target.value);
                clearError("dueDate");
              }}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Description / experiment" htmlFor="improvement-action-description">
              <textarea
                id="improvement-action-description"
                className="kit-field-input"
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {afterTarget ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This date is after the initiative target date of {formatDate(initiative.targetDate)}.
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
/* Evaluate checkpoint modal                                           */
/* ------------------------------------------------------------------ */

interface CheckpointModalProps {
  initiativeId: string;
  snapshots: Snapshot[];
  defaultSnapshotId: string;
  onClose: () => void;
  onSaved: (snapshotNumber: string) => void;
}

function CheckpointModal({
  initiativeId,
  snapshots,
  defaultSnapshotId,
  onClose,
  onSaved,
}: CheckpointModalProps) {
  const [snapshotId, setSnapshotId] = useState(defaultSnapshotId);
  const [snapshotError, setSnapshotError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!snapshotId) {
      setSnapshotError("Select a later operating-rhythm snapshot.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createImprovementCheckpoint(initiativeId, snapshotId);

      const chosen = snapshots.find((item) => item.id === snapshotId);

      onSaved(chosen ? chosen.snapshotNumber : "Checkpoint");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to capture improvement checkpoint.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Objective evidence"
      title="Evaluate checkpoint"
      description="Compare a later operating-rhythm snapshot against the baseline. Checkpoints cannot be changed afterwards."
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
            form="improvement-checkpoint-form"
            className="button button--primary"
            disabled={saving || snapshots.length === 0}
          >
            {saving ? "Evaluating…" : "Evaluate checkpoint"}
          </button>
        </>
      }
    >
      <form id="improvement-checkpoint-form" onSubmit={handleSubmit} noValidate>
        {snapshots.length === 0 ? (
          <p className="kit-meta-line">
            There is no later operating-rhythm snapshot to evaluate yet. Capture a new snapshot in
            the operating rhythm first.
          </p>
        ) : (
          <Field label="Operating snapshot" htmlFor="checkpoint-snapshot" error={snapshotError}>
            <select
              id="checkpoint-snapshot"
              className="kit-field-input"
              value={snapshotId}
              aria-invalid={snapshotError ? true : undefined}
              onChange={(event) => {
                setSnapshotId(event.target.value);
                setSnapshotError(undefined);
              }}
            >
              <option value="">Select later operating snapshot</option>

              {snapshots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.snapshotNumber} · {formatDate(item.periodStart)} →{" "}
                  {formatDate(item.periodEnd)}
                </option>
              ))}
            </select>
          </Field>
        )}

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

interface ImprovementData {
  id: string;
  detail: ImprovementInitiativeDetail;
  context: ImprovementContext;
}

export default function ImprovementInitiativePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<ImprovementData | null>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [pendingRunning, setPendingRunning] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [addingAction, setAddingAction] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
        const response = await getImprovementInitiative(id);
        const contextResponse = await getContinuousImprovementContext(
          response.initiative.currency,
        );

        if (active) {
          setResult({ id, detail: response, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load improvement initiative.",
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
        <Link href="/continuous-improvement" className="request-back-link">
          <ArrowLeft size={16} />
          Continuous improvement
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

  const { initiative, baseline, actions, checkpoints } = detail;
  const currency = initiative.currency;
  const status = initiative.status;
  const mutable = status !== "COMPLETED" && status !== "CANCELLED";
  const trackable = status === "ACTIVE" || status === "ON_HOLD";
  const users = context.users.filter((candidate) => candidate.role !== "REQUESTER");
  const busyAny = pendingRunning || cancelRunning || actionRunning || workingId !== null;

  const latestCheckpoint: Checkpoint | undefined = checkpoints[0];
  const latestOutcome = latestCheckpoint ? String(latestCheckpoint.outcome) : null;
  const outcomeAllowsCompletion = latestOutcome === "IMPROVED" || latestOutcome === "MIXED";
  const canComplete =
    initiative.openActions === 0 && latestCheckpoint !== undefined && outcomeAllowsCompletion;

  const evaluated = new Set(checkpoints.map((item) => item.snapshotId));
  const availableSnapshots = context.snapshots.filter(
    (item) => item.id !== initiative.sourceSnapshotId && !evaluated.has(item.id),
  );
  const createdAt = new Date(initiative.createdAt).getTime();
  const defaultSnapshotId =
    (availableSnapshots.find((item) => new Date(item.capturedAt).getTime() > createdAt) ??
      availableSnapshots[0])?.id ?? "";

  async function confirmTransition() {
    if (pending === null) {
      return;
    }

    const action = pending;

    setPendingRunning(true);

    try {
      if (action === "START") {
        await startImprovementInitiative(params.id);
      } else if (action === "HOLD") {
        await holdImprovementInitiative(params.id);
      } else if (action === "RESUME") {
        await resumeImprovementInitiative(params.id);
      } else {
        await completeImprovementInitiative(params.id);
      }

      setPending(null);

      toast.success(TRANSITIONS[action].done, initiative.initiativeNumber);
      reload();
    } catch (caught) {
      setPending(null);

      toast.error(
        TRANSITIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update improvement initiative.",
      );
    } finally {
      setPendingRunning(false);
    }
  }

  async function confirmCancel(note: string) {
    setCancelRunning(true);
    setCancelError(null);

    try {
      await cancelImprovementInitiative(params.id, note);

      setCancelOpen(false);

      toast.success("Initiative cancelled", initiative.initiativeNumber);
      reload();
    } catch (caught) {
      setCancelError(
        caught instanceof Error ? caught.message : "Unable to update improvement initiative.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  async function startAction(action: ImprovementAction) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(action.id));

    try {
      await startImprovementAction(action.id);

      toast.success("Action started", action.title);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the action",
        caught instanceof Error ? caught.message : "Unable to update improvement action.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmAction(note: string) {
    if (actionRequest === null) {
      return;
    }

    const request = actionRequest;

    setActionRunning(true);
    setActionError(null);

    try {
      if (request.kind === "COMPLETE") {
        await completeImprovementAction(request.action.id, note);
      } else {
        await cancelImprovementAction(request.action.id, note);
      }

      setActionRequest(null);

      toast.success(
        request.kind === "COMPLETE" ? "Action completed" : "Action cancelled",
        request.action.title,
      );
      reload();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Unable to update improvement action.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  function handleActionAdded(title: string) {
    setAddingAction(false);
    toast.success("Improvement action added", title);
    reload();
  }

  function handleCheckpointSaved(snapshotNumber: string) {
    setEvaluating(false);
    toast.success("Checkpoint evaluated", snapshotNumber);
    reload();
  }

  const openActions = actions.filter(isOpenAction);

  const orderedActions = [...actions].sort((a, b) => {
    const left = isOpenAction(a) ? 0 : 1;
    const right = isOpenAction(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return a.dueDate.localeCompare(b.dueDate);
  });

  const targetRows: TargetRow[] = [
    {
      id: "sla",
      metric: "SLA attainment",
      target: `≥ ${detail.targetSlaAttainmentPct.toFixed(1)}%`,
      baseline: baseline.resolvedCount > 0 ? `${baseline.slaAttainmentPct.toFixed(1)}%` : "—",
      latest: latestCheckpoint ? `${signed(latestCheckpoint.slaAttainmentDelta)}pp change` : "—",
    },
    {
      id: "overdue",
      metric: "SLA overdue reduction",
      target: `≥ ${detail.targetSlaOverdueReductionPct.toFixed(1)}%`,
      baseline: `${baseline.slaOverdueCount} overdue`,
      latest: latestCheckpoint
        ? `${latestCheckpoint.slaOverdueReductionPct.toFixed(1)}% reduction`
        : "—",
    },
    {
      id: "persistent",
      metric: "Persistent reduction",
      target: `≥ ${detail.targetPersistentReductionPct.toFixed(1)}%`,
      baseline: `${baseline.persistentCount} persistent`,
      latest: latestCheckpoint
        ? `${latestCheckpoint.persistentReductionPct.toFixed(1)}% reduction`
        : "—",
    },
    {
      id: "resolution",
      metric: "Resolution-time reduction",
      target: `≥ ${detail.targetResolutionHoursReductionPct.toFixed(1)}%`,
      baseline: `${baseline.avgResolutionHours.toFixed(1)}h average`,
      latest: latestCheckpoint
        ? `${latestCheckpoint.resolutionHoursReductionPct.toFixed(1)}% reduction`
        : "—",
    },
    {
      id: "exposure",
      metric: "Exposure reduction",
      target: `≥ ${detail.targetExposureReductionPct.toFixed(1)}%`,
      baseline: money(baseline.activeExposure, currency),
      latest: latestCheckpoint
        ? `${latestCheckpoint.exposureReductionPct.toFixed(1)}% reduction`
        : "—",
    },
  ];

  const kpis: KpiItem[] = [
    {
      label: "Baseline active",
      icon: Gauge,
      value: String(baseline.activeCount),
      note: "Active exceptions",
    },
    {
      label: "SLA overdue",
      icon: AlertTriangle,
      value: String(baseline.slaOverdueCount),
      note: "At the baseline",
    },
    {
      label: "Persistent",
      icon: TrendingDown,
      value: String(baseline.persistentCount),
      note: "Long-running backlog",
    },
    {
      label: "SLA attainment",
      icon: Target,
      value: baseline.resolvedCount > 0 ? `${baseline.slaAttainmentPct.toFixed(1)}%` : "—",
      note: baseline.resolvedCount > 0 ? "Of resolved exceptions" : "Nothing resolved yet",
    },
    {
      label: "Avg resolution",
      icon: Gauge,
      value: `${baseline.avgResolutionHours.toFixed(1)}h`,
      note: "Average time to resolve",
    },
    {
      label: "Exposure",
      icon: AlertTriangle,
      value: money(baseline.activeExposure, currency),
      note: "Active exposure",
    },
  ];

  const actionColumns = buildActionColumns({
    canManage: canManage && mutable,
    workingId,
    busy: busyAny,
    onStart: (action) => void startAction(action),
    onComplete: (action) => {
      setActionError(null);
      setActionRequest({ kind: "COMPLETE", action });
    },
    onCancel: (action) => {
      setActionError(null);
      setActionRequest({ kind: "CANCEL", action });
    },
  });

  const targetColumns = buildTargetColumns();
  const checkpointColumns = buildCheckpointColumns();

  return (
    <div className="page-stack">
      <Link href="/continuous-improvement" className="request-back-link">
        <ArrowLeft size={16} />
        Continuous improvement
      </Link>

      <section className="improvement-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{initiative.initiativeNumber}</span>

            <StatusBadge value={String(initiative.priority)} />

            <StatusBadge value={String(status)} />
          </div>

          <h1>{initiative.title}</h1>

          <p>
            {initiative.scopeLabel}
            {" · "}
            {readable(String(initiative.scopeType))}
            {" · Baseline "}
            {initiative.sourceSnapshotNumber}
            {" · Owner "}
            {initiative.ownerName}
            {" · Target "}
            {formatDate(initiative.targetDate)}
          </p>
        </div>

        <div className="improvement-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

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
              Cancel initiative
            </button>
          ) : null}

          {canManage && status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
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

          {canFinalize && trackable ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !canComplete}
              title={canComplete ? undefined : "Resolve the open actions and record an improving checkpoint first"}
              onClick={() => setPending("COMPLETE")}
            >
              <BadgeCheck size={15} />
              Complete
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
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: start the initiative.</strong> Then add corrective actions and
            evaluate checkpoints against later operating snapshots.
          </div>
        </div>
      ) : null}

      {status === "ON_HOLD" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This initiative is on hold.</strong> Resume it to keep working on the
            corrective actions.
          </div>
        </div>
      ) : null}

      {initiative.targetOverdue && mutable ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The target date has passed.</strong> It was {formatDate(initiative.targetDate)}.
            Evaluate a checkpoint, or complete or cancel the initiative.
          </div>
        </div>
      ) : null}

      {canFinalize && trackable && !canComplete ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Completion is blocked.</strong>
            {initiative.openActions > 0
              ? ` ${initiative.openActions} improvement ${initiative.openActions === 1 ? "action is" : "actions are"} still open.`
              : ""}
            {latestCheckpoint === undefined
              ? " No checkpoint has been evaluated yet."
              : !outcomeAllowsCompletion
                ? " The latest checkpoint is not improved or mixed."
                : ""}
          </div>
        </div>
      ) : null}

      {canFinalize && trackable && canComplete ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Ready to complete.</strong> All actions are resolved and the latest checkpoint
            shows an improvement.
          </div>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Improvement hypothesis</span>

            <h2>Problem definition</h2>
          </div>

          <Target size={19} />
        </div>

        <div className="improvement-description">{detail.description}</div>
      </section>

      <KpiGrid items={kpis} ariaLabel="Baseline" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Objective targets</span>

            <h2>Success criteria</h2>
          </div>

          <Target size={19} />
        </div>

        <DataTable
          columns={targetColumns}
          rows={targetRows}
          getRowId={(row) => row.id}
          ariaLabel="Success criteria"
        />

        {latestCheckpoint ? (
          <ProgressLine
            pct={(latestCheckpoint.targetsMetCount / TARGET_COUNT) * 100}
            tone={
              latestCheckpoint.targetsMetCount >= TARGET_COUNT ? meterToneFor("success") : "primary"
            }
            caption={`${latestCheckpoint.targetsMetCount} of ${TARGET_COUNT} targets met at ${latestCheckpoint.snapshotNumber}`}
            label="Targets met at the latest checkpoint"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Corrective work</span>

            <h2>Improvement actions</h2>
          </div>

          {canManage && mutable ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingAction(true)}
            >
              <Plus size={15} />
              Add action
            </button>
          ) : (
            <Wrench size={19} />
          )}
        </div>

        {actions.length > 0 ? (
          <ProgressLine
            pct={((actions.length - openActions.length) / actions.length) * 100}
            tone={openActions.length === 0 ? meterToneFor("success") : "primary"}
            caption={`${actions.length - openActions.length} of ${actions.length} actions finished`}
            label="Improvement actions finished"
          />
        ) : null}

        <DataTable
          columns={actionColumns}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="Improvement actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={Wrench}
              title="No corrective actions"
              description="No corrective actions have been added yet."
              action={
                canManage && mutable ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingAction(true)}
                  >
                    <Plus size={15} />
                    Add action
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
            <span className="eyebrow">Objective evidence</span>

            <h2>Performance checkpoints</h2>
          </div>

          {canManage && trackable ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setEvaluating(true)}
            >
              <Plus size={15} />
              Evaluate checkpoint
            </button>
          ) : (
            <TrendingDown size={19} />
          )}
        </div>

        <DataTable
          columns={checkpointColumns}
          rows={checkpoints}
          getRowId={(item) => String(item.id)}
          ariaLabel="Performance checkpoints"
          busy={fetching}
          empty={
            <EmptyState
              icon={TrendingDown}
              title="No checkpoints"
              description="No checkpoints have been evaluated yet."
              action={
                canManage && trackable ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setEvaluating(true)}
                  >
                    <Plus size={15} />
                    Evaluate checkpoint
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="improvement-method-note">
        <Target size={18} />

        <div>
          <strong>Before/after authority</strong>

          <p>
            Baseline and checkpoint evidence comes only from immutable Step 43 operating-rhythm
            snapshots. Completing an initiative does not rewrite historical snapshots or Step 42
            control-tower records.
          </p>
        </div>
      </section>

      {addingAction ? (
        <ActionModal
          initiativeId={params.id}
          initiative={initiative}
          users={users}
          onClose={() => setAddingAction(false)}
          onSaved={handleActionAdded}
        />
      ) : null}

      {evaluating ? (
        <CheckpointModal
          initiativeId={params.id}
          snapshots={availableSnapshots}
          defaultSnapshotId={defaultSnapshotId}
          onClose={() => setEvaluating(false)}
          onSaved={handleCheckpointSaved}
        />
      ) : null}

      {pending !== null ? (
        <ActionDialog
          eyebrow={TRANSITIONS[pending].eyebrow}
          title={TRANSITIONS[pending].title}
          description={transitionDescription(pending, initiative)}
          confirmLabel={TRANSITIONS[pending].confirm}
          busyLabel={TRANSITIONS[pending].busy}
          cancelLabel={TRANSITIONS[pending].keep}
          busy={pendingRunning}
          onConfirm={() => void confirmTransition()}
          onCancel={() => setPending(null)}
        >
          {pending === "COMPLETE" && latestOutcome === "MIXED" ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              The latest checkpoint is mixed, so not every target was met.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {cancelOpen ? (
        <RationaleDialog
          eyebrow="Governance"
          title="Cancel this initiative"
          description={`${initiative.initiativeNumber} will be cancelled and stop tracking improvement.${initiative.openActions > 0 ? ` ${initiative.openActions} open ${initiative.openActions === 1 ? "action is" : "actions are"} still attached.` : ""}`}
          label="Cancellation rationale"
          placeholder="Why is this initiative being cancelled?"
          confirmLabel="Cancel initiative"
          busyLabel="Cancelling…"
          cancelLabel="Keep initiative"
          tone="danger"
          maxLength={2000}
          busy={cancelRunning}
          error={cancelError}
          onConfirm={(note) => void confirmCancel(note)}
          onCancel={() => setCancelOpen(false)}
        />
      ) : null}

      {actionRequest !== null ? (
        <RationaleDialog
          eyebrow="Improvement action"
          title={
            actionRequest.kind === "COMPLETE" ? "Complete this action" : "Cancel this action"
          }
          description={
            actionRequest.kind === "COMPLETE"
              ? `Record the evidence for “${actionRequest.action.title}”.`
              : `“${actionRequest.action.title}” will be cancelled and no longer count as open work.`
          }
          label={
            actionRequest.kind === "COMPLETE" ? "Completion evidence" : "Cancellation evidence"
          }
          placeholder={
            actionRequest.kind === "COMPLETE"
              ? "What was done, and what changed?"
              : "Why is this action being cancelled?"
          }
          confirmLabel={actionRequest.kind === "COMPLETE" ? "Complete action" : "Cancel action"}
          busyLabel={actionRequest.kind === "COMPLETE" ? "Completing…" : "Cancelling…"}
          cancelLabel={actionRequest.kind === "COMPLETE" ? "Cancel" : "Keep action"}
          tone={actionRequest.kind === "COMPLETE" ? "primary" : "danger"}
          maxLength={2000}
          busy={actionRunning}
          error={actionError}
          onConfirm={(note) => void confirmAction(note)}
          onCancel={() => setActionRequest(null)}
        />
      ) : null}
    </div>
  );
}
