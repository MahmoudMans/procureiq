"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
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
  cancelStrategyRecoveryAction,
  captureStrategyRecoveryCheckpoint,
  closeStrategyRecoveryCase,
  completeStrategyRecoveryAction,
  createStrategyRecoveryAction,
  escalateStrategyRecoveryCase,
  getStrategyRecoveryCase,
  getStrategyRecoveryDashboard,
  markStrategyRecoveryReady,
  startStrategyRecoveryAction,
  startStrategyRecoveryCase,
  verifyStrategyRecoveryCase,
} from "@/lib/api";
import type {
  RecoveryCaseDetail,
  RecoveryEscalationLevel,
  RecoveryUserOption,
} from "@/types/strategy-recovery";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RecoveryCase = RecoveryCaseDetail["recoveryCase"];
type RecoveryAction = RecoveryCaseDetail["actions"][number];
type Checkpoint = RecoveryCaseDetail["checkpoints"][number];
type Escalation = RecoveryCaseDetail["escalations"][number];
type Flow = "START" | "SUBMIT";
type ActionField = "title" | "owner" | "dueDate";

type RationaleRequest =
  | { kind: "CHECKPOINT" }
  | { kind: "VERIFY" }
  | { kind: "CLOSE" }
  | { kind: "ACTION_COMPLETE"; action: RecoveryAction }
  | { kind: "ACTION_CANCEL"; action: RecoveryAction };

interface CompareRow {
  id: string;
  metric: string;
  baseline: string;
  current: string;
  change: string;
  worse: boolean;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: RecoveryUserOption[] = [];
const DAY_MS = 86400000;

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function signed(value: number, digits = 1): string {
  const text = value.toFixed(digits);

  if (Number(text) === 0) {
    return (0).toFixed(digits);
  }

  return value > 0 ? `+${text}` : text;
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayShift(baseline?: string | null, current?: string | null): number | null {
  if (!baseline || !current) {
    return null;
  }

  const from = new Date(`${baseline.slice(0, 10)}T00:00:00`).getTime();
  const to = new Date(`${current.slice(0, 10)}T00:00:00`).getTime();

  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }

  return Math.round((to - from) / DAY_MS);
}

function isOpenAction(action: RecoveryAction): boolean {
  return action.status === "PLANNED" || action.status === "IN_PROGRESS";
}

function CaseBadge({ status }: { status: string }) {
  switch (status) {
    case "IN_RECOVERY":
      return <StatusBadge value="IN_PROGRESS" label="In recovery" />;

    case "READY_FOR_VERIFICATION":
      return <StatusBadge value="READY" label="Ready for verification" />;

    case "VERIFIED":
      return <StatusBadge value="ACHIEVED" label="Verified" />;

    default:
      return <StatusBadge value={status} />;
  }
}

function HealthBadge({ health }: { health: string }) {
  return <StatusBadge value={health} label={readable(health)} />;
}

function EscalationBadge({ level }: { level: string }) {
  if (level === "EXECUTIVE") {
    return <StatusBadge value="OFF_TRACK" label="Executive" />;
  }

  if (level === "MANAGER") {
    return <StatusBadge value="AT_RISK" label="Manager" />;
  }

  return <StatusBadge value={level} label={readable(level)} />;
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

function buildCompareRows(rc: RecoveryCase): CompareRow[] {
  const riskDelta = rc.currentRiskScore - rc.baselineRiskScore;
  const progressDelta = rc.currentProgressPct - rc.baselineProgressPct;
  const blockerDelta = rc.currentBlockerCount - rc.baselineBlockerCount;
  const varDelta = rc.currentValueAtRiskPoints - rc.baselineValueAtRiskPoints;
  const shift = dayShift(rc.baselineForecastEndDate, rc.currentForecastEndDate);
  const sameHealth =
    String(rc.baselineExecutionHealth) === String(rc.currentExecutionHealth);

  return [
    {
      id: "risk",
      metric: "Risk score",
      baseline: rc.baselineRiskScore.toFixed(1),
      current: rc.currentRiskScore.toFixed(1),
      change: signed(riskDelta),
      worse: riskDelta > 0.05,
    },
    {
      id: "health",
      metric: "Execution health",
      baseline: readable(String(rc.baselineExecutionHealth)),
      current: readable(String(rc.currentExecutionHealth)),
      change: sameHealth ? "Unchanged" : "Changed",
      worse: false,
    },
    {
      id: "progress",
      metric: "Progress",
      baseline: `${rc.baselineProgressPct.toFixed(1)}%`,
      current: `${rc.currentProgressPct.toFixed(1)}%`,
      change: `${signed(progressDelta)} pp`,
      worse: progressDelta < -0.05,
    },
    {
      id: "forecast",
      metric: "Forecast end",
      baseline: showDate(rc.baselineForecastEndDate),
      current: showDate(rc.currentForecastEndDate),
      change:
        shift === null
          ? "—"
          : shift === 0
            ? "No change"
            : `${Math.abs(shift)} ${Math.abs(shift) === 1 ? "day" : "days"} ${shift > 0 ? "later" : "earlier"}`,
      worse: shift !== null && shift > 0,
    },
    {
      id: "blockers",
      metric: "Blockers",
      baseline: String(rc.baselineBlockerCount),
      current: String(rc.currentBlockerCount),
      change: signed(blockerDelta, 0),
      worse: blockerDelta > 0,
    },
    {
      id: "var",
      metric: "Value at risk",
      baseline: `${rc.baselineValueAtRiskPoints.toFixed(1)} pts`,
      current: `${rc.currentValueAtRiskPoints.toFixed(1)} pts`,
      change: `${signed(varDelta)} pts`,
      worse: varDelta > 0.05,
    },
  ];
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
    eyebrow: "Recovery execution",
    title: "Start recovery?",
    confirm: "Start recovery",
    busy: "Starting…",
    keep: "Not yet",
    done: "Recovery started",
    failed: "Could not start the recovery",
  },
  SUBMIT: {
    eyebrow: "Recovery verification",
    title: "Submit for verification?",
    confirm: "Submit for verification",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for verification",
    failed: "Could not submit for verification",
  },
};

function flowDescription(flow: Flow, rc: RecoveryCase): string {
  switch (flow) {
    case "START":
      return `${rc.recoveryNumber} will move into recovery so corrective actions can be worked and checkpoints captured.`;

    case "SUBMIT":
      return `${rc.recoveryNumber} will be submitted for independent verification. Corrective actions can no longer be changed while it is under verification.`;
  }
}

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  tone: "primary" | "danger";
  done: string;
  subject: string;
}

function rationaleCopy(request: RationaleRequest, rc: RecoveryCase): RationaleCopy {
  switch (request.kind) {
    case "CHECKPOINT":
      return {
        eyebrow: "Before / after evidence",
        title: "Capture recovery checkpoint",
        description: `The current Step 53 state of ${rc.initiativeTitle} will be recorded against the baseline.`,
        label: "Checkpoint evidence note",
        placeholder: "What does this checkpoint show?",
        confirm: "Capture checkpoint",
        busy: "Capturing…",
        tone: "primary",
        done: "Checkpoint captured",
        subject: rc.recoveryNumber,
      };

    case "VERIFY":
      return {
        eyebrow: "Independent governance decision",
        title: "Verify this recovery",
        description: `${rc.recoveryNumber} meets the recovery gate and will be marked as verified.`,
        label: "Governance note",
        placeholder: "What confirms the recovery?",
        confirm: "Verify recovery",
        busy: "Verifying…",
        tone: "primary",
        done: "Recovery verified",
        subject: rc.recoveryNumber,
      };

    case "CLOSE":
      return {
        eyebrow: "Independent governance decision",
        title: "Close this recovery case",
        description: `${rc.recoveryNumber} was verified. Closing it finishes the recovery case.`,
        label: "Governance note",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close recovery case",
        busy: "Closing…",
        tone: "primary",
        done: "Recovery case closed",
        subject: rc.recoveryNumber,
      };

    case "ACTION_COMPLETE":
      return {
        eyebrow: "Corrective action",
        title: "Complete this action",
        description: `Record the evidence for “${request.action.title}”.`,
        label: "Completion evidence",
        placeholder: "What was done, and what changed?",
        confirm: "Complete action",
        busy: "Completing…",
        tone: "primary",
        done: "Action completed",
        subject: request.action.title,
      };

    case "ACTION_CANCEL":
      return {
        eyebrow: "Corrective action",
        title: "Cancel this action",
        description: `“${request.action.title}” will be cancelled and no longer count as open work.`,
        label: "Cancellation evidence",
        placeholder: "Why is this action being cancelled?",
        confirm: "Cancel action",
        busy: "Cancelling…",
        tone: "danger",
        done: "Action cancelled",
        subject: request.action.title,
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<RecoveryCaseDetail> {
  switch (request.kind) {
    case "CHECKPOINT":
      return captureStrategyRecoveryCheckpoint(caseId, note);

    case "VERIFY":
      return verifyStrategyRecoveryCase(caseId, note);

    case "CLOSE":
      return closeStrategyRecoveryCase(caseId, note);

    case "ACTION_COMPLETE":
      return completeStrategyRecoveryAction(request.action.id, note);

    case "ACTION_CANCEL":
      return cancelStrategyRecoveryAction(request.action.id, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildCompareColumns(): Column<CompareRow>[] {
  return [
    {
      id: "metric",
      header: "Metric",
      cell: (row) => <strong>{row.metric}</strong>,
    },
    {
      id: "baseline",
      header: "Baseline",
      cell: (row) => row.baseline,
    },
    {
      id: "current",
      header: "Current Step 53 evidence",
      cell: (row) => row.current,
    },
    {
      id: "change",
      header: "Change",
      cell: (row) => (
        <span className={row.worse ? "kit-text-danger" : undefined}>{row.change}</span>
      ),
    },
  ];
}

interface ActionColumnOptions {
  canManage: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (action: RecoveryAction) => void;
  onComplete: (action: RecoveryAction) => void;
  onCancel: (action: RecoveryAction) => void;
}

function buildActionColumns(options: ActionColumnOptions): Column<RecoveryAction>[] {
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
      sortValue: (action) => action.dueDate ?? null,
      cell: (action) => (
        <div className="kit-cell-stack">
          <span>{showDate(action.dueDate)}</span>

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
      id: "evidence",
      header: "Evidence",
      cell: (action) =>
        action.completionEvidence ? (
          <span>{action.completionEvidence}</span>
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
    {
      id: "health",
      header: "Recovery health",
      sortValue: (item) => String(item.recoveryHealth),
      cell: (item) => <HealthBadge health={String(item.recoveryHealth)} />,
    },
    {
      id: "effectiveness",
      header: "Effectiveness",
      align: "right",
      sortValue: (item) => item.effectivenessPct,
      cell: (item) => `${item.effectivenessPct.toFixed(1)}%`,
    },
    {
      id: "risk",
      header: "Risk",
      align: "right",
      sortValue: (item) => item.currentRiskScore,
      cell: (item) => item.currentRiskScore.toFixed(1),
    },
    {
      id: "recovery",
      header: "Recovery",
      align: "right",
      sortValue: (item) => item.recoveryScore,
      cell: (item) => item.recoveryScore.toFixed(1),
    },
    {
      id: "progress",
      header: "Progress",
      align: "right",
      sortValue: (item) => item.progressPct,
      cell: (item) => `${item.progressPct.toFixed(1)}%`,
    },
    {
      id: "blockers",
      header: "Blockers",
      align: "right",
      sortValue: (item) => item.blockerCount,
      cell: (item) => item.blockerCount,
    },
    {
      id: "var",
      header: "VAR",
      align: "right",
      sortValue: (item) => item.valueAtRiskPoints,
      cell: (item) => `${item.valueAtRiskPoints.toFixed(1)} pts`,
    },
    {
      id: "note",
      header: "Evidence note",
      cell: (item) => <span>{item.checkpointNote}</span>,
    },
  ];
}

function buildEscalationColumns(): Column<Escalation>[] {
  return [
    {
      id: "level",
      header: "Level",
      sortValue: (item) => String(item.escalationLevel),
      cell: (item) => <EscalationBadge level={String(item.escalationLevel)} />,
    },
    {
      id: "reason",
      header: "Reason",
      cell: (item) => <span>{item.reason}</span>,
    },
    {
      id: "escalated",
      header: "Escalated",
      sortValue: (item) => item.escalatedAt,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{formatDateTime(item.escalatedAt)}</span>

          <small>{item.escalatedByName}</small>
        </div>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add action modal                                                    */
/* ------------------------------------------------------------------ */

interface ActionModalProps {
  caseId: string;
  recovery: RecoveryCase;
  users: RecoveryUserOption[];
  onClose: () => void;
  onSaved: (updated: RecoveryCaseDetail, title: string) => void;
}

function ActionModal({ caseId, recovery, users, onClose, onSaved }: ActionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(() => recovery.targetRecoveryDate || isoDate(14));
  const [errors, setErrors] = useState<Partial<Record<ActionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const target = recovery.targetRecoveryDate;
  const afterTarget = target ? dueDate !== "" && dueDate > target : false;
  const dueInPast = dueDate !== "" && dueDate < isoDate(0);

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

    if (!ownerId) {
      next.owner = "Choose an owner.";
    }

    if (!dueDate) {
      next.dueDate = "Choose a due date.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await createStrategyRecoveryAction(caseId, {
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerId,
        dueDate,
      });

      onSaved(updated, title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create corrective action.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Corrective action plan"
      title="Add recovery action"
      description="A corrective step intended to bring the initiative back on track."
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
            form="recovery-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add recovery action"}
          </button>
        </>
      }
    >
      <form id="recovery-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Action title" htmlFor="recovery-action-title" error={errors.title}>
              <input
                id="recovery-action-title"
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

          <Field label="Owner" htmlFor="recovery-action-owner" error={errors.owner}>
            <select
              id="recovery-action-owner"
              className="kit-field-input"
              value={ownerId}
              aria-invalid={errors.owner ? true : undefined}
              onChange={(event) => {
                setOwnerId(event.target.value);
                clearError("owner");
              }}
            >
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName} — {candidate.role}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="recovery-action-due" error={errors.dueDate}>
            <input
              id="recovery-action-due"
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
            <Field label="Description" htmlFor="recovery-action-description">
              <textarea
                id="recovery-action-description"
                className="kit-field-input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {afterTarget && target ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This date is after the recovery target date of {formatDate(target)}.
          </p>
        ) : null}

        {dueInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The due date is in the past, so this action will be flagged as overdue.
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
/* Escalate modal                                                      */
/* ------------------------------------------------------------------ */

interface EscalateModalProps {
  caseId: string;
  onClose: () => void;
  onSaved: (updated: RecoveryCaseDetail, level: string) => void;
}

function EscalateModal({ caseId, onClose, onSaved }: EscalateModalProps) {
  const [level, setLevel] = useState<RecoveryEscalationLevel>("MANAGER");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!reason.trim()) {
      setReasonError("An escalation reason is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await escalateStrategyRecoveryCase(caseId, {
        escalationLevel: level,
        reason: reason.trim(),
      });

      onSaved(updated, readable(String(level)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to escalate recovery case.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Escalation governance"
      title="Escalate unresolved risk"
      description="Raise this case with a higher level of governance. The escalation is added to the case history."
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
            form="recovery-escalate-form"
            className="button button--primary kit-button-danger"
            disabled={saving}
          >
            {saving ? "Escalating…" : "Escalate"}
          </button>
        </>
      }
    >
      <form id="recovery-escalate-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Level" htmlFor="escalation-level">
              <select
                id="escalation-level"
                className="kit-field-input"
                value={level}
                onChange={(event) => setLevel(event.target.value as RecoveryEscalationLevel)}
              >
                <option value="MANAGER">Manager</option>

                <option value="EXECUTIVE">Executive</option>
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Escalation reason" htmlFor="escalation-reason" error={reasonError}>
              <textarea
                id="escalation-reason"
                className="kit-field-input"
                rows={5}
                maxLength={2000}
                value={reason}
                aria-invalid={reasonError ? true : undefined}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(undefined);
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

interface RecoveryData {
  id: string;
  detail: RecoveryCaseDetail;
  users: RecoveryUserOption[];
}

export default function StrategyRecoveryCasePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<RecoveryData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [addingAction, setAddingAction] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
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
        const [caseResponse, dashboardResponse] = await Promise.all([
          getStrategyRecoveryCase(id),
          getStrategyRecoveryDashboard(),
        ]);

        if (active) {
          setResult({ id, detail: caseResponse, users: dashboardResponse.users });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load recovery case.");
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
  const users = data?.users ?? EMPTY_USERS;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyDetail(updated: RecoveryCaseDetail) {
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
        <Link href="/strategy-recovery" className="request-back-link">
          <ArrowLeft size={16} />
          Execution recovery
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

  const { recoveryCase: rc, actions, checkpoints, escalations } = detail;
  const status = String(rc.status);
  const mutable =
    status !== "READY_FOR_VERIFICATION" && status !== "VERIFIED" && status !== "CLOSED";
  const busyAny = flowRunning || rationaleRunning || workingId !== null;

  const openActions = actions.filter(isOpenAction);
  const overdueActions = openActions.filter((action) => action.overdue);
  const allActionsResolved =
    actions.length > 0 &&
    actions.every((action) => action.status === "COMPLETED" || action.status === "CANCELLED");
  const submitReady = allActionsResolved && rc.verificationEligible;
  const finishedActions = actions.length - openActions.length;
  const canEscalate = canFinalize && status !== "VERIFIED" && status !== "CLOSED";

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "START") {
        applyDetail(await startStrategyRecoveryCase(params.id));
      } else {
        applyDetail(await markStrategyRecoveryReady(params.id));
      }

      setFlow(null);

      toast.success(FLOWS[action].done, rc.recoveryNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the recovery case.",
      );
    } finally {
      setFlowRunning(false);
    }
  }

  async function startAction(action: RecoveryAction) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(action.id));

    try {
      applyDetail(await startStrategyRecoveryAction(action.id));

      toast.success("Action started", action.title);
    } catch (caught) {
      toast.error(
        "Could not start the action",
        caught instanceof Error ? caught.message : "Unable to update corrective action.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, rc);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, copy.subject);
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

  function handleActionAdded(updated: RecoveryCaseDetail, title: string) {
    applyDetail(updated);
    setAddingAction(false);
    toast.success("Recovery action added", title);
  }

  function handleEscalated(updated: RecoveryCaseDetail, level: string) {
    applyDetail(updated);
    setEscalating(false);
    toast.success("Case escalated", level);
  }

  const orderedActions = [...actions].sort((a, b) => {
    const left = isOpenAction(a) ? 0 : 1;
    const right = isOpenAction(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });

  const orderedCheckpoints = [...checkpoints].sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  );

  const orderedEscalations = [...escalations].sort((a, b) =>
    b.escalatedAt.localeCompare(a.escalatedAt),
  );

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, rc) : null;
  const riskWorse = rc.currentRiskScore > rc.baselineRiskScore;
  const gateMatters = status === "IN_RECOVERY" || status === "READY_FOR_VERIFICATION";

  const kpis: KpiItem[] = [
    {
      label: "Baseline risk",
      icon: ShieldAlert,
      value: rc.baselineRiskScore.toFixed(1),
      note: "Recovery baseline",
    },
    {
      label: "Current risk",
      icon: Gauge,
      value: rc.currentRiskScore.toFixed(1),
      note: riskWorse ? "Above the baseline" : "Against the baseline",
      tone: riskWorse ? "warning" : "default",
    },
    {
      label: "Effectiveness",
      icon: TrendingDown,
      value: `${rc.effectivenessPct.toFixed(1)}%`,
      note: readable(String(rc.recoveryHealth)),
    },
    {
      label: "Recovery score",
      icon: Target,
      value: rc.recoveryScore.toFixed(1),
      note: "Current score",
    },
    {
      label: "Current VAR",
      icon: AlertTriangle,
      value: `${rc.currentValueAtRiskPoints.toFixed(1)} pts`,
      note: "Value at risk",
      tone: rc.currentValueAtRiskPoints > 0 ? "warning" : "default",
    },
    {
      label: "Verification eligible",
      icon: FileCheck2,
      value: rc.verificationEligible ? "Yes" : "No",
      note: rc.verificationEligible ? "Meets the recovery gate" : "Recovery gate not met",
      tone: !rc.verificationEligible && gateMatters ? "warning" : "default",
    },
  ];

  const compareColumns = buildCompareColumns();

  const actionColumns = buildActionColumns({
    canManage: canManage && mutable,
    workingId,
    busy: busyAny,
    onStart: (action) => void startAction(action),
    onComplete: (action) => openRationale({ kind: "ACTION_COMPLETE", action }),
    onCancel: (action) => openRationale({ kind: "ACTION_CANCEL", action }),
  });

  const checkpointColumns = buildCheckpointColumns();
  const escalationColumns = buildEscalationColumns();

  return (
    <div className="page-stack">
      <Link href="/strategy-recovery" className="request-back-link">
        <ArrowLeft size={16} />
        Execution recovery
      </Link>

      <section className="recovery-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{rc.recoveryNumber}</span>

            <CaseBadge status={status} />

            <StatusBadge value={String(rc.severity)} />
          </div>

          <span className="eyebrow">Strategic recovery case</span>

          <h1>{rc.initiativeTitle}</h1>

          <p>
            {rc.commitmentNumber}
            {" · "}
            {rc.roadmapNumber}
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

          {rc.commitmentId ? (
            <Link href={`/strategy-execution/${rc.commitmentId}`} className="button button--secondary">
              Step 53 evidence
            </Link>
          ) : null}

          {canManage && mutable ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAddingAction(true)}
            >
              <Plus size={15} />
              Add action
            </button>
          ) : null}

          {canManage && status !== "CLOSED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CHECKPOINT" })}
            >
              <Camera size={15} />
              Capture checkpoint
            </button>
          ) : null}

          {canEscalate ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => setEscalating(true)}
            >
              <ShieldAlert size={15} />
              Escalate
            </button>
          ) : null}

          {canManage && status === "OPEN" && actions.length > 0 ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("START")}
            >
              <Play size={15} />
              Start recovery
            </button>
          ) : null}

          {canManage && status === "IN_RECOVERY" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !submitReady}
              title={
                submitReady
                  ? undefined
                  : "Resolve every corrective action and meet the recovery gate first"
              }
              onClick={() => setFlow("SUBMIT")}
            >
              <FileCheck2 size={16} />
              Submit for verification
            </button>
          ) : null}

          {canFinalize && status === "READY_FOR_VERIFICATION" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !rc.verificationEligible}
              title={
                rc.verificationEligible
                  ? undefined
                  : "Current Step 53 evidence does not meet the recovery gate"
              }
              onClick={() => openRationale({ kind: "VERIFY" })}
            >
              <BadgeCheck size={16} />
              Verify recovery
            </button>
          ) : null}

          {canFinalize && status === "VERIFIED" ? (
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

      {status === "OPEN" && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {actions.length === 0 ? (
              <>
                <strong>Next step: add a corrective action.</strong> Add at least one action, then
                start the recovery.
              </>
            ) : (
              <>
                <strong>Ready to start.</strong> Start the recovery to begin working the corrective
                actions.
              </>
            )}
          </div>
        </div>
      ) : null}

      {status === "IN_RECOVERY" && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {submitReady ? (
              <>
                <strong>Ready to submit.</strong> All corrective actions are resolved and the
                current Step 53 evidence meets the recovery gate.
              </>
            ) : (
              <>
                <strong>Submitting for verification is blocked.</strong>
                {actions.length === 0 ? " No corrective action exists yet." : ""}
                {openActions.length > 0
                  ? ` ${openActions.length} corrective ${openActions.length === 1 ? "action is" : "actions are"} still open.`
                  : ""}
                {!rc.verificationEligible
                  ? " Current Step 53 evidence does not meet the recovery gate yet."
                  : ""}
              </>
            )}
          </div>
        </div>
      ) : null}

      {status === "READY_FOR_VERIFICATION" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting independent verification.</strong>{" "}
            {canFinalize
              ? "Use Verify recovery above."
              : "A procurement manager or administrator needs to verify it."}
          </div>
        </div>
      ) : null}

      {status === "READY_FOR_VERIFICATION" && !rc.verificationEligible ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Verification is blocked.</strong> Current Step 53 evidence no longer meets the
            recovery gate.
          </div>
        </div>
      ) : null}

      {status === "VERIFIED" && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The recovery is verified.</strong> Close the case to finish governance.
          </div>
        </div>
      ) : null}

      {overdueActions.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueActions.length}{" "}
              {overdueActions.length === 1 ? "corrective action is" : "corrective actions are"}{" "}
              overdue.
            </strong>{" "}
            Complete or cancel {overdueActions.length === 1 ? "it" : "them"} in the table below.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Recovery summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Recovery progress</span>

            <h2>Is the recovery working?</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={rc.effectivenessPct}
          tone={rc.verificationEligible ? meterToneFor("success") : "primary"}
          caption={`Effectiveness ${rc.effectivenessPct.toFixed(1)}% · ${readable(String(rc.recoveryHealth))}`}
          label="Recovery effectiveness"
        />

        {actions.length > 0 ? (
          <ProgressLine
            pct={(finishedActions / actions.length) * 100}
            tone={openActions.length === 0 ? meterToneFor("success") : "primary"}
            caption={`${finishedActions} of ${actions.length} corrective actions finished`}
            label="Corrective actions finished"
          />
        ) : null}
      </section>

      <section className="panel recovery-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Recovery commitment</span>

            <h2>Objective</h2>
          </div>

          <Goal size={19} />
        </div>

        <p>{rc.recoveryObjective}</p>

        <div className="recovery-context-grid">
          <div>
            <span>Recovery owner</span>

            <strong>{rc.recoveryOwnerName}</strong>
          </div>

          <div>
            <span>Execution owner</span>

            <strong>{rc.executionOwnerName}</strong>
          </div>

          <div>
            <span>Severity</span>

            <strong>{readable(String(rc.severity))}</strong>
          </div>

          <div>
            <span>Target date</span>

            <strong>{showDate(rc.targetRecoveryDate)}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Before / after</span>

            <h2>Baseline against current Step 53 evidence</h2>
          </div>

          <Target size={19} />
        </div>

        <DataTable
          columns={compareColumns}
          rows={buildCompareRows(rc)}
          getRowId={(row) => row.id}
          ariaLabel="Baseline against current evidence"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Corrective execution</span>

            <h2>Recovery actions</h2>
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

        <DataTable
          columns={actionColumns}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="Recovery actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={Wrench}
              title="No corrective actions"
              description="No corrective actions have been created."
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
            <span className="eyebrow">Before / after evidence</span>

            <h2>Recovery checkpoints</h2>
          </div>

          {canManage && status !== "CLOSED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CHECKPOINT" })}
            >
              <Camera size={15} />
              Capture checkpoint
            </button>
          ) : (
            <Camera size={19} />
          )}
        </div>

        <DataTable
          columns={checkpointColumns}
          rows={orderedCheckpoints}
          getRowId={(item) => String(item.id)}
          ariaLabel="Recovery checkpoints"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No checkpoints"
              description="No recovery checkpoint has been captured yet."
            />
          }
        />
      </section>

      {escalations.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Governance history</span>

              <h2>Escalations</h2>
            </div>

            <ShieldAlert size={19} />
          </div>

          <DataTable
            columns={escalationColumns}
            rows={orderedEscalations}
            getRowId={(item) => String(item.id)}
            ariaLabel="Escalations"
            busy={fetching}
          />
        </section>
      ) : null}

      {rc.verificationNote ? (
        <section className="recovery-verification-note">
          <strong>Verified recovery</strong>

          <p>{rc.verificationNote}</p>

          <small>
            {rc.verifiedByName}
            {rc.verifiedAt ? ` · ${formatDateTime(rc.verifiedAt)}` : ""}
          </small>
        </section>
      ) : null}

      <section className="recovery-method-note">
        <Goal size={18} />

        <div>
          <strong>Recovery verification is evidence-gated</strong>

          <p>
            A case can reach verification only after corrective actions are resolved and Step 53
            shows acceptable health, no active blockers, an acceptable forecast and limited
            remaining value at risk.
          </p>
        </div>
      </section>

      {addingAction ? (
        <ActionModal
          caseId={params.id}
          recovery={rc}
          users={users}
          onClose={() => setAddingAction(false)}
          onSaved={handleActionAdded}
        />
      ) : null}

      {escalating ? (
        <EscalateModal
          caseId={params.id}
          onClose={() => setEscalating(false)}
          onSaved={handleEscalated}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, rc)}
          confirmLabel={FLOWS[flow].confirm}
          busyLabel={FLOWS[flow].busy}
          cancelLabel={FLOWS[flow].keep}
          busy={flowRunning}
          onConfirm={() => void confirmFlow()}
          onCancel={() => setFlow(null)}
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
          tone={rationaleInfo.tone}
          maxLength={2000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
