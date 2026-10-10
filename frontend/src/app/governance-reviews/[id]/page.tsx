"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Info,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Snowflake,
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
  SegmentedFilter,
  type SegmentedOption,
  Skeleton,
  StatusBadge,
  formatDate,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  archiveGovernanceReview,
  cancelGovernanceAction,
  closeGovernanceReview,
  completeGovernanceAction,
  createGovernanceAction,
  createGovernanceDecision,
  freezeGovernanceReview,
  getGovernanceReview,
  getGovernanceReviewContext,
  openGovernanceReview,
  resolveGovernanceDecision,
  startGovernanceAction,
} from "@/lib/api";
import type {
  GovernanceActionPriority,
  GovernanceDecisionStatus,
  GovernanceDecisionType,
  GovernanceReviewContext,
  GovernanceReviewDetail,
} from "@/types/governance-review";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Review = GovernanceReviewDetail["review"];
type Decision = GovernanceReviewDetail["decisions"][number];
type GovAction = GovernanceReviewDetail["actions"][number];
type GovUser = GovernanceReviewContext["users"][number];
type Transition = "FREEZE" | "OPEN" | "CLOSE" | "ARCHIVE";
type DecisionField = "title" | "description" | "dueDate";
type ActionField = "title" | "dueDate";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const CHAIR_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: GovUser[] = [];
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const DECISION_TYPES: { value: string; label: string }[] = [
  { value: "APPROVAL", label: "Approval" },
  { value: "ESCALATION", label: "Escalation" },
  { value: "PRIORITY", label: "Priority" },
  { value: "RISK_ACCEPTANCE", label: "Risk acceptance" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "OTHER", label: "Other" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

interface Resolution {
  value: string;
  label: string;
  confirm: string;
  busy: string;
  done: string;
  danger: boolean;
  hint: string;
}

const RESOLUTIONS: Resolution[] = [
  {
    value: "APPROVED",
    label: "Approve",
    confirm: "Approve decision",
    busy: "Approving…",
    done: "Decision approved",
    danger: false,
    hint: "The decision request is approved.",
  },
  {
    value: "REJECTED",
    label: "Reject",
    confirm: "Reject decision",
    busy: "Rejecting…",
    done: "Decision rejected",
    danger: true,
    hint: "The decision request is rejected.",
  },
  {
    value: "DEFERRED",
    label: "Defer",
    confirm: "Defer decision",
    busy: "Deferring…",
    done: "Decision deferred",
    danger: false,
    hint: "The decision is postponed and recorded as deferred.",
  },
];

function severityRank(value: string): number {
  return SEVERITY_ORDER[value] ?? 4;
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
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

function isOpenAction(action: GovAction): boolean {
  return action.status === "OPEN" || action.status === "IN_PROGRESS";
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
  FREEZE: {
    eyebrow: "Freeze snapshot",
    title: "Freeze this review?",
    confirm: "Freeze snapshot",
    busy: "Freezing…",
    keep: "Not yet",
    done: "Snapshot frozen",
    failed: "Could not freeze the snapshot",
  },
  OPEN: {
    eyebrow: "Open review",
    title: "Open this review?",
    confirm: "Open review",
    busy: "Opening…",
    keep: "Not yet",
    done: "Review opened",
    failed: "Could not open the review",
  },
  CLOSE: {
    eyebrow: "Close review",
    title: "Close this review?",
    confirm: "Close review",
    busy: "Closing…",
    keep: "Keep open",
    done: "Review closed",
    failed: "Could not close the review",
  },
  ARCHIVE: {
    eyebrow: "Archive review",
    title: "Archive this review?",
    confirm: "Archive review",
    busy: "Archiving…",
    keep: "Not yet",
    done: "Review archived",
    failed: "Could not archive the review",
  },
};

function transitionDescription(transition: Transition, review: Review): string {
  switch (transition) {
    case "FREEZE":
      return `${review.reviewNumber} will be frozen. The current supplier risk, category, benefits and execution evidence is stored as the immutable review pack and cannot be changed afterwards.`;

    case "OPEN":
      return `${review.reviewNumber} will be opened for review. Decisions and management actions can then be recorded.`;

    case "CLOSE":
      return `${review.reviewNumber} will be closed. Decisions can no longer be added or resolved.`;

    case "ARCHIVE":
      return `${review.reviewNumber} will be archived.`;
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface DecisionColumnOptions {
  canResolve: boolean;
  busy: boolean;
  onResolve: (decision: Decision) => void;
}

function buildDecisionColumns(options: DecisionColumnOptions): Column<Decision>[] {
  return [
    {
      id: "decision",
      header: "Decision",
      sortValue: (decision) => decision.title.toLowerCase(),
      cell: (decision) => (
        <div className="request-primary-cell">
          <strong>{decision.title}</strong>

          <span>
            {decision.decisionNumber}
            {" · "}
            {readable(decision.decisionType)}
          </span>

          <span className="kit-clamp">{decision.description}</span>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (decision) => (decision.decisionOwnerName ?? "").toLowerCase(),
      cell: (decision) => decision.decisionOwnerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (decision) => decision.dueDate ?? null,
      cell: (decision) => (
        <div className="kit-cell-stack">
          <span>{showDate(decision.dueDate)}</span>

          {decision.overdue && decision.status === "OPEN" ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (decision) => decision.status,
      cell: (decision) => <StatusBadge value={decision.status} />,
    },
    {
      id: "resolution",
      header: "Resolution",
      sortValue: (decision) => (decision.decisionNote ?? "").toLowerCase(),
      cell: (decision) =>
        decision.decisionNote ? (
          <div className="kit-cell-stack">
            <span>{decision.decisionNote}</span>

            {decision.decidedByName ? <small>— {decision.decidedByName}</small> : null}
          </div>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 130,
      cell: (decision) =>
        options.canResolve && decision.status === "OPEN" ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onResolve(decision)}
          >
            <Scale size={14} />
            Resolve
          </button>
        ) : null,
    },
  ];
}

interface ActionColumnOptions {
  canControl: boolean;
  canCancel: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (action: GovAction) => void;
  onComplete: (action: GovAction) => void;
  onCancel: (action: GovAction) => void;
}

function buildActionColumns(options: ActionColumnOptions): Column<GovAction>[] {
  return [
    {
      id: "action",
      header: "Action",
      sortValue: (action) => action.title.toLowerCase(),
      cell: (action) => (
        <div className="request-primary-cell">
          <strong>{action.title}</strong>

          <span>
            {action.actionNumber}
            {action.description ? ` · ${action.description}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (action) => severityRank(String(action.priority)),
      cell: (action) => <StatusBadge value={action.priority} />,
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
      sortValue: (action) => action.status,
      cell: (action) => <StatusBadge value={action.status} />,
    },
    {
      id: "outcome",
      header: "Outcome",
      sortValue: (action) => (action.completionNote ?? "").toLowerCase(),
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
      width: 280,
      cell: (action) => {
        if (!options.canControl || !isOpenAction(action)) {
          return null;
        }

        const starting = options.workingId === String(action.id);

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {action.status === "OPEN" ? (
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

            {options.canCancel ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onCancel(action)}
              >
                <XCircle size={14} />
                Cancel
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Resolve decision modal                                              */
/* ------------------------------------------------------------------ */

interface ResolveModalProps {
  decision: Decision;
  onClose: () => void;
  onSaved: (message: string, title: string) => void;
}

function ResolveModal({ decision, onClose, onSaved }: ResolveModalProps) {
  const [status, setStatus] = useState<GovernanceDecisionStatus>("APPROVED");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choice = RESOLUTIONS.find((item) => item.value === status) ?? RESOLUTIONS[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!note.trim()) {
      setNoteError("A formal decision note is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await resolveGovernanceDecision(decision.id, status, note.trim());

      onSaved(choice.done, decision.title);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to resolve governance decision.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Formal governance"
      title="Resolve decision"
      description={`${decision.decisionNumber} — ${decision.title}`}
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
            form="governance-resolve-form"
            className={
              choice.danger ? "button button--primary kit-button-danger" : "button button--primary"
            }
            disabled={saving}
          >
            {saving ? choice.busy : choice.confirm}
          </button>
        </>
      }
    >
      <form id="governance-resolve-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Outcome" htmlFor="resolve-status">
              <select
                id="resolve-status"
                className="kit-field-input"
                value={status}
                onChange={(event) => setStatus(event.target.value as GovernanceDecisionStatus)}
              >
                {RESOLUTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <p className="kit-meta-line">{choice.hint}</p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Formal decision note" htmlFor="resolve-note" error={noteError}>
              <textarea
                id="resolve-note"
                className="kit-field-input"
                rows={5}
                maxLength={2000}
                value={note}
                aria-invalid={noteError ? true : undefined}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError(undefined);
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
/* Add decision modal                                                  */
/* ------------------------------------------------------------------ */

interface DecisionModalProps {
  reviewId: string;
  users: GovUser[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

function DecisionModal({ reviewId, users, onClose, onSaved }: DecisionModalProps) {
  const [type, setType] = useState<GovernanceDecisionType>("APPROVAL");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => isoDate(7));
  const [errors, setErrors] = useState<Partial<Record<DecisionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: DecisionField) {
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

    const next: Partial<Record<DecisionField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter a decision title.";
    }

    if (!description.trim()) {
      next.description = "Describe the context of the decision.";
    }

    if (dueDate && dueDate < isoDate(0)) {
      next.dueDate = "The due date cannot be in the past.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createGovernanceDecision(reviewId, {
        decisionType: type,
        title: title.trim(),
        description: description.trim(),
        decisionOwnerUserId: ownerId || undefined,
        dueDate: dueDate || undefined,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create governance decision.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Board decision"
      title="Add decision request"
      description="A formal decision the review needs to resolve."
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
            form="governance-decision-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add decision"}
          </button>
        </>
      }
    >
      <form id="governance-decision-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Decision type" htmlFor="decision-type">
            <select
              id="decision-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as GovernanceDecisionType)}
            >
              {DECISION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Decision owner" htmlFor="decision-owner">
            <select
              id="decision-owner"
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

          <div className="kit-pair-wide">
            <Field label="Title" htmlFor="decision-title" error={errors.title}>
              <input
                id="decision-title"
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

          <div className="kit-pair-wide">
            <Field label="Due date" htmlFor="decision-due" error={errors.dueDate}>
              <input
                id="decision-due"
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
          </div>

          <div className="kit-pair-wide">
            <Field label="Decision context" htmlFor="decision-context" error={errors.description}>
              <textarea
                id="decision-context"
                className="kit-field-input"
                rows={5}
                value={description}
                aria-invalid={errors.description ? true : undefined}
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearError("description");
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
/* Add management action modal                                         */
/* ------------------------------------------------------------------ */

interface NewActionModalProps {
  reviewId: string;
  users: GovUser[];
  decisions: Decision[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

function NewActionModal({ reviewId, users, decisions, onClose, onSaved }: NewActionModalProps) {
  const [decisionId, setDecisionId] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<GovernanceActionPriority>("HIGH");
  const [dueDate, setDueDate] = useState(() => isoDate(14));
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ActionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      await createGovernanceAction(reviewId, {
        decisionId: decisionId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerId || undefined,
        priority,
        dueDate,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create management action.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Management follow-up"
      title="Add management action"
      description="An accountable follow-up item, optionally tied to a decision."
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
            form="governance-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add action"}
          </button>
        </>
      }
    >
      <form id="governance-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Related decision" htmlFor="gov-action-decision">
            <select
              id="gov-action-decision"
              className="kit-field-input"
              value={decisionId}
              onChange={(event) => setDecisionId(event.target.value)}
            >
              <option value="">Independent action</option>

              {decisions.map((decision) => (
                <option key={decision.id} value={decision.id}>
                  {decision.decisionNumber} — {decision.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Owner" htmlFor="gov-action-owner">
            <select
              id="gov-action-owner"
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

          <div className="kit-pair-wide">
            <Field label="Action title" htmlFor="gov-action-title" error={errors.title}>
              <input
                id="gov-action-title"
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

          <Field label="Priority" htmlFor="gov-action-priority">
            <select
              id="gov-action-priority"
              className="kit-field-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as GovernanceActionPriority)}
            >
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="gov-action-due" error={errors.dueDate}>
            <input
              id="gov-action-due"
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
            <Field label="Description" htmlFor="gov-action-description">
              <textarea
                id="gov-action-description"
                className="kit-field-input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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

interface ReviewData {
  id: string;
  detail: GovernanceReviewDetail;
  users: GovUser[];
}

export default function GovernanceReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canChair = user !== null && CHAIR_ROLES.includes(user.role);

  const [result, setResult] = useState<ReviewData | null>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [pendingRunning, setPendingRunning] = useState(false);
  const [addingDecision, setAddingDecision] = useState(false);
  const [addingAction, setAddingAction] = useState(false);
  const [resolving, setResolving] = useState<Decision | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<GovAction | null>(null);
  const [completeRunning, setCompleteRunning] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<GovAction | null>(null);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [evidenceView, setEvidenceView] = useState("ALL");
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
        const [detailResponse, contextResponse] = await Promise.all([
          getGovernanceReview(id),
          getGovernanceReviewContext(),
        ]);

        if (active) {
          setResult({
            id,
            detail: detailResponse,
            users: contextResponse.users.filter((candidate) => candidate.role !== "REQUESTER"),
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load governance review.",
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
  const users = data?.users ?? EMPTY_USERS;

  function reload() {
    setReloadKey((key) => key + 1);
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
        <Link href="/governance-reviews" className="request-back-link">
          <ArrowLeft size={16} />
          Governance reviews
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

  const { review, snapshot, decisions, actions, snapshotItems: evidence } = detail;
  const currency = review.currency;

  const status = review.status;
  const canAddRecords = canManage && status === "IN_REVIEW";
  const canResolve = canChair && status === "IN_REVIEW";
  const actionMutable = status === "IN_REVIEW" || status === "CLOSED";
  const busyAny = pendingRunning || completeRunning || cancelRunning || workingId !== null;

  async function confirmTransition() {
    if (pending === null) {
      return;
    }

    const action = pending;

    setPendingRunning(true);

    try {
      if (action === "FREEZE") {
        await freezeGovernanceReview(params.id);
      } else if (action === "OPEN") {
        await openGovernanceReview(params.id);
      } else if (action === "CLOSE") {
        await closeGovernanceReview(params.id);
      } else {
        await archiveGovernanceReview(params.id);
      }

      setPending(null);

      toast.success(TRANSITIONS[action].done, review.reviewNumber);
      reload();
    } catch (caught) {
      setPending(null);

      toast.error(
        TRANSITIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update governance review.",
      );
    } finally {
      setPendingRunning(false);
    }
  }

  async function startAction(action: GovAction) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(action.id));

    try {
      await startGovernanceAction(action.id);

      toast.success("Action started", action.title);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the action",
        caught instanceof Error ? caught.message : "Unable to update management action.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmComplete(note: string) {
    if (completing === null) {
      return;
    }

    const action = completing;

    setCompleteRunning(true);
    setCompleteError(null);

    try {
      await completeGovernanceAction(action.id, note);

      setCompleting(null);

      toast.success("Action completed", action.title);
      reload();
    } catch (caught) {
      setCompleteError(
        caught instanceof Error ? caught.message : "Unable to update management action.",
      );
    } finally {
      setCompleteRunning(false);
    }
  }

  async function confirmCancel(note: string) {
    if (cancelling === null) {
      return;
    }

    const action = cancelling;

    setCancelRunning(true);
    setCancelError(null);

    try {
      await cancelGovernanceAction(action.id, note);

      setCancelling(null);

      toast.success("Action cancelled", action.title);
      reload();
    } catch (caught) {
      setCancelError(
        caught instanceof Error ? caught.message : "Unable to update management action.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  function handleResolved(message: string, title: string) {
    setResolving(null);
    toast.success(message, title);
    reload();
  }

  function handleDecisionAdded(title: string) {
    setAddingDecision(false);
    toast.success("Decision request added", title);
    reload();
  }

  function handleActionAdded(title: string) {
    setAddingAction(false);
    toast.success("Management action added", title);
    reload();
  }

  const openDecisions = decisions.filter((decision) => decision.status === "OPEN");
  const overdueDecisions = openDecisions.filter((decision) => decision.overdue);
  const openActions = actions.filter(isOpenAction);
  const overdueActions = openActions.filter((action) => action.overdue);

  const orderedDecisions = [...decisions].sort((a, b) => {
    const left = a.status === "OPEN" ? 0 : 1;
    const right = b.status === "OPEN" ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });

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

  const typeCount = (type: string) =>
    evidence.filter((item) => String(item.itemType) === type).length;

  const evidenceOptions: SegmentedOption[] = [
    { value: "ALL", label: `All · ${evidence.length}` },
    { value: "SUPPLIER_RISK", label: `Supplier risk · ${typeCount("SUPPLIER_RISK")}` },
    { value: "CATEGORY_STRATEGY", label: `Category strategy · ${typeCount("CATEGORY_STRATEGY")}` },
    { value: "BENEFIT_PORTFOLIO", label: `Benefit portfolio · ${typeCount("BENEFIT_PORTFOLIO")}` },
  ];

  const shownEvidence = evidence
    .filter((item) => evidenceView === "ALL" || String(item.itemType) === evidenceView)
    .sort((a, b) => severityRank(String(a.severity)) - severityRank(String(b.severity)));

  const target = snapshot ? snapshot.baselineTargetSavings : 0;
  const forecastPct = snapshot && target > 0 ? (snapshot.forecastSavings / target) * 100 : null;
  const validatedPct = snapshot && target > 0 ? (snapshot.validatedSavings / target) * 100 : null;

  const kpis: KpiItem[] = snapshot
    ? [
        {
          label: "Target savings",
          icon: Scale,
          value: money(snapshot.baselineTargetSavings, currency),
          note: "Baseline target",
        },
        {
          label: "Forecast",
          icon: ClipboardCheck,
          value: money(snapshot.forecastSavings, currency),
          note: forecastPct !== null ? `${forecastPct.toFixed(0)}% of target` : "Forecast savings",
        },
        {
          label: "Validated",
          icon: BadgeCheck,
          value: money(snapshot.validatedSavings, currency),
          note: validatedPct !== null ? `${validatedPct.toFixed(0)}% of target` : "Validated savings",
        },
        {
          label: "At risk",
          icon: AlertTriangle,
          value: money(snapshot.atRiskAmount, currency),
          note: "Savings at risk",
          tone: snapshot.atRiskAmount > 0 ? "warning" : "default",
        },
        {
          label: "Critical suppliers",
          icon: AlertTriangle,
          value: String(snapshot.criticalRiskSuppliers),
          note: "Critical risk band",
          tone: snapshot.criticalRiskSuppliers > 0 ? "warning" : "default",
        },
        {
          label: "Overdue initiatives",
          icon: ClipboardCheck,
          value: String(snapshot.overdueCategoryInitiatives),
          note: "Category initiatives",
          tone: snapshot.overdueCategoryInitiatives > 0 ? "warning" : "default",
        },
      ]
    : [];

  const decisionColumns = buildDecisionColumns({
    canResolve,
    busy: busyAny,
    onResolve: (decision) => setResolving(decision),
  });

  const actionColumns = buildActionColumns({
    canControl: canManage && actionMutable,
    canCancel: canChair,
    workingId,
    busy: busyAny,
    onStart: (action) => void startAction(action),
    onComplete: (action) => {
      setCompleteError(null);
      setCompleting(action);
    },
    onCancel: (action) => {
      setCancelError(null);
      setCancelling(action);
    },
  });

  return (
    <div className="page-stack">
      <Link href="/governance-reviews" className="request-back-link">
        <ArrowLeft size={16} />
        Governance reviews
      </Link>

      <section className="governance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{review.reviewNumber}</span>

            <StatusBadge value={status} />
          </div>

          <h1>{review.title}</h1>

          <p>
            {formatDate(review.periodStart)}
            {" → "}
            {formatDate(review.periodEnd)}
            {" · "}
            {currency}
            {" · Chair: "}
            {review.chairName}
          </p>
        </div>

        <div className="governance-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canManage && status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPending("FREEZE")}
            >
              <Snowflake size={16} />
              Freeze snapshot
            </button>
          ) : null}

          {canManage && status === "FROZEN" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPending("OPEN")}
            >
              <Play size={16} />
              Open review
            </button>
          ) : null}

          {canChair && status === "IN_REVIEW" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || review.openDecisions > 0}
              title={review.openDecisions > 0 ? "Resolve the open decisions first" : undefined}
              onClick={() => setPending("CLOSE")}
            >
              <BadgeCheck size={16} />
              Close review
            </button>
          ) : null}

          {canChair && status === "CLOSED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny || review.openActions > 0}
              title={review.openActions > 0 ? "Finish the open actions first" : undefined}
              onClick={() => setPending("ARCHIVE")}
            >
              Archive
            </button>
          ) : null}

          {status !== "DRAFT" ? (
            <Link href={`/governance-reviews/${review.id}/print`} className="button button--secondary">
              <Printer size={16} />
              Review pack
            </Link>
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
            <strong>Next step: freeze the snapshot.</strong> Do this when the executive reporting
            cut-off is reached. The evidence then becomes the immutable review pack.
          </div>
        </div>
      ) : null}

      {status === "FROZEN" && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The snapshot is frozen.</strong> Open the review to record decisions and
            management actions.
          </div>
        </div>
      ) : null}

      {canChair && status === "IN_REVIEW" && review.openDecisions > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Closing is blocked.</strong> {review.openDecisions}{" "}
            {review.openDecisions === 1 ? "decision is" : "decisions are"} still open. Resolve{" "}
            {review.openDecisions === 1 ? "it" : "them"} first.
          </div>
        </div>
      ) : null}

      {canChair && status === "CLOSED" && review.openActions > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Archiving is blocked.</strong> {review.openActions} management{" "}
            {review.openActions === 1 ? "action is" : "actions are"} still open.
          </div>
        </div>
      ) : null}

      {overdueDecisions.length > 0 || overdueActions.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Overdue items.</strong>
            {overdueDecisions.length > 0
              ? ` ${overdueDecisions.length} ${overdueDecisions.length === 1 ? "decision is" : "decisions are"} overdue.`
              : ""}
            {overdueActions.length > 0
              ? ` ${overdueActions.length} management ${overdueActions.length === 1 ? "action is" : "actions are"} overdue.`
              : ""}
          </div>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Management narrative</span>

            <h2>Executive summary</h2>
          </div>

          <FileText size={19} />
        </div>

        <div className="governance-executive-summary">{detail.executiveSummary}</div>
      </section>

      {!snapshot ? (
        <section className="governance-freeze-callout">
          <Snowflake size={20} />

          <div>
            <strong>Snapshot not frozen yet</strong>

            <p>
              Freeze the draft when the executive reporting cut-off is reached. ProcureIQ will
              persist the current supplier risk, category, benefits and execution evidence as the
              immutable review pack.
            </p>
          </div>
        </section>
      ) : (
        <>
          <KpiGrid items={kpis} ariaLabel="Review snapshot" />

          {target > 0 && forecastPct !== null && validatedPct !== null ? (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">Savings delivery</span>

                  <h2>Savings against target</h2>
                </div>

                <Scale size={19} />
              </div>

              <div className="kit-meter-wrap">
                <Meter
                  value={clampPercent(validatedPct)}
                  max={100}
                  tone={validatedPct >= 100 ? meterToneFor("success") : "primary"}
                  ariaLabel="Validated savings against the target"
                />

                <span className="kit-meter-caption">
                  Validated {money(snapshot.validatedSavings, currency)} of{" "}
                  {money(target, currency)} ({validatedPct.toFixed(0)}%)
                </span>
              </div>

              <div className="kit-meter-wrap">
                <Meter
                  value={clampPercent(forecastPct)}
                  max={100}
                  tone={forecastPct >= 100 ? meterToneFor("success") : meterToneFor("warning")}
                  ariaLabel="Forecast savings against the target"
                />

                <span className="kit-meter-caption">
                  Forecast {money(snapshot.forecastSavings, currency)} of {money(target, currency)} (
                  {forecastPct.toFixed(0)}%)
                </span>
              </div>
            </section>
          ) : null}

          <section className="governance-scorecard-grid">
            <article>
              <strong>Supplier risk</strong>

              <div>
                <span>Evaluated</span>

                <b>{snapshot.evaluatedSuppliers}</b>
              </div>

              <div>
                <span>High</span>

                <b>{snapshot.highRiskSuppliers}</b>
              </div>

              <div>
                <span>Critical</span>

                <b>{snapshot.criticalRiskSuppliers}</b>
              </div>

              <div>
                <span>Active alerts</span>

                <b>{snapshot.activeRiskAlerts}</b>
              </div>
            </article>

            <article>
              <strong>Category execution</strong>

              <div>
                <span>Strategies</span>

                <b>{snapshot.activeCategoryStrategies}</b>
              </div>

              <div>
                <span>Initiatives</span>

                <b>{snapshot.activeCategoryInitiatives}</b>
              </div>

              <div>
                <span>Overdue</span>

                <b>{snapshot.overdueCategoryInitiatives}</b>
              </div>

              <div>
                <span>Approved scenarios</span>

                <b>{snapshot.approvedScenarios}</b>
              </div>
            </article>

            <article>
              <strong>Benefits governance</strong>

              <div>
                <span>Execution portfolios</span>

                <b>{snapshot.activeExecutionPortfolios}</b>
              </div>

              <div>
                <span>Pending validations</span>

                <b>{snapshot.validationPendingItems}</b>
              </div>

              <div>
                <span>Leakage cases</span>

                <b>{snapshot.activeLeakageCases}</b>
              </div>

              <div>
                <span>Invalid assumptions</span>

                <b>{snapshot.invalidatedAssumptions}</b>
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Frozen evidence</span>

                <h2>Executive attention items</h2>
              </div>
            </div>

            {evidence.length > 0 ? (
              <div className="kit-toolbar" style={{ marginBottom: 14 }}>
                <SegmentedFilter
                  options={evidenceOptions}
                  value={evidenceView}
                  onChange={setEvidenceView}
                  ariaLabel="Filter evidence"
                />
              </div>
            ) : null}

            {shownEvidence.length === 0 ? (
              <EmptyState
                compact
                icon={FileText}
                title={evidence.length === 0 ? "No frozen evidence" : "Nothing in this view"}
                description={
                  evidence.length === 0
                    ? "No evidence items were captured in the snapshot."
                    : "No frozen evidence items in this section."
                }
              />
            ) : (
              <div className="governance-snapshot-list">
                {shownEvidence.map((item) => (
                  <article key={item.id}>
                    <div className="governance-snapshot-heading">
                      <div>
                        <StatusBadge value={item.severity} />

                        <strong>{item.title}</strong>

                        <small>
                          {readable(item.itemType)}
                          {item.subtitle ? ` · ${item.subtitle}` : ""}
                        </small>
                      </div>

                      <div>
                        <span>{item.metricLabel}</span>

                        <strong>
                          {item.currency
                            ? money(item.metricValue, item.currency)
                            : item.metricValue.toFixed(1)}
                        </strong>
                      </div>
                    </div>

                    <p>{item.details}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Formal governance</span>

            <h2>Decision register</h2>
          </div>

          {canAddRecords ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingDecision(true)}
            >
              <Plus size={15} />
              Add decision
            </button>
          ) : (
            <Scale size={19} />
          )}
        </div>

        <DataTable
          columns={decisionColumns}
          rows={orderedDecisions}
          getRowId={(decision) => String(decision.id)}
          ariaLabel="Decision register"
          busy={fetching}
          empty={
            <EmptyState
              icon={Scale}
              title="No decision requests"
              description={
                status === "IN_REVIEW"
                  ? "No formal decision requests have been added."
                  : "Decision requests can be added once the review is open."
              }
              action={
                canAddRecords ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingDecision(true)}
                  >
                    <Plus size={15} />
                    Add decision
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
            <span className="eyebrow">Accountability</span>

            <h2>Management actions</h2>
          </div>

          {canAddRecords ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingAction(true)}
            >
              <Plus size={15} />
              Add action
            </button>
          ) : (
            <ClipboardCheck size={19} />
          )}
        </div>

        {actions.length > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={actions.length - openActions.length}
              max={actions.length}
              tone={openActions.length === 0 ? meterToneFor("success") : "primary"}
              ariaLabel="Management actions finished"
            />

            <span className="kit-meter-caption">
              {actions.length - openActions.length} of {actions.length} actions finished
            </span>
          </div>
        ) : null}

        <DataTable
          columns={actionColumns}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="Management actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardCheck}
              title="No management actions"
              description="No management actions have been recorded."
              action={
                canAddRecords ? (
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

      {addingDecision ? (
        <DecisionModal
          reviewId={params.id}
          users={users}
          onClose={() => setAddingDecision(false)}
          onSaved={handleDecisionAdded}
        />
      ) : null}

      {addingAction ? (
        <NewActionModal
          reviewId={params.id}
          users={users}
          decisions={decisions}
          onClose={() => setAddingAction(false)}
          onSaved={handleActionAdded}
        />
      ) : null}

      {resolving !== null ? (
        <ResolveModal
          decision={resolving}
          onClose={() => setResolving(null)}
          onSaved={handleResolved}
        />
      ) : null}

      {pending !== null ? (
        <ActionDialog
          eyebrow={TRANSITIONS[pending].eyebrow}
          title={TRANSITIONS[pending].title}
          description={transitionDescription(pending, review)}
          confirmLabel={TRANSITIONS[pending].confirm}
          busyLabel={TRANSITIONS[pending].busy}
          cancelLabel={TRANSITIONS[pending].keep}
          busy={pendingRunning}
          onConfirm={() => void confirmTransition()}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {completing !== null ? (
        <RationaleDialog
          eyebrow="Management action"
          title="Complete this action"
          description={`Record how “${completing.title}” was completed.`}
          label="Completion note"
          placeholder="What was done?"
          confirmLabel="Complete action"
          busyLabel="Completing…"
          maxLength={2000}
          busy={completeRunning}
          error={completeError}
          onConfirm={(note) => void confirmComplete(note)}
          onCancel={() => setCompleting(null)}
        />
      ) : null}

      {cancelling !== null ? (
        <RationaleDialog
          eyebrow="Management action"
          title="Cancel this action"
          description={`“${cancelling.title}” will be cancelled and no longer count as an open action.`}
          label="Cancellation note"
          placeholder="Why is this action being cancelled?"
          confirmLabel="Cancel action"
          busyLabel="Cancelling…"
          cancelLabel="Keep action"
          tone="danger"
          maxLength={2000}
          busy={cancelRunning}
          error={cancelError}
          onConfirm={(note) => void confirmCancel(note)}
          onCancel={() => setCancelling(null)}
        />
      ) : null}
    </div>
  );
}
