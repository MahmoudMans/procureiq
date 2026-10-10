"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  Info,
  Play,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  approveSupplierPerformanceReview,
  cancelSupplierCorrectiveAction,
  completeSupplierCorrectiveAction,
  createSupplierCorrectiveAction,
  getSupplierPerformanceContext,
  getSupplierPerformanceReview,
  rejectSupplierPerformanceReview,
  startSupplierCorrectiveAction,
  submitSupplierPerformanceReview,
} from "@/lib/api";
import type {
  CorrectiveAction,
  SupplierPerformanceContext,
  SupplierPerformanceReviewDetail,
} from "@/types/supplier-performance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Review = SupplierPerformanceReviewDetail["review"];
type PerfUser = SupplierPerformanceContext["users"][number];
type HistoryItem = SupplierPerformanceReviewDetail["supplierHistory"][number];
type HistoryRow = HistoryItem & { delta: number | null };
type ReviewDecision = "APPROVE" | "REJECT";
type ActionField = "title" | "dueDate";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const WEAK_BANDS = ["NEEDS_IMPROVEMENT", "POOR", "CRITICAL", "AT_RISK"];
const HISTORY_LIMIT = 8;
const EMPTY_USERS: PerfUser[] = [];

const DIMENSIONS = [
  { key: "qualityScore", label: "Quality", weight: 25 },
  { key: "deliveryScore", label: "Delivery", weight: 25 },
  { key: "commercialScore", label: "Commercial", weight: 20 },
  { key: "serviceScore", label: "Service", weight: 15 },
  { key: "complianceScore", label: "Compliance", weight: 15 },
] as const;

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function scoreTone(score: number) {
  return meterToneFor(score >= 80 ? "success" : score >= 60 ? "warning" : "danger");
}

function isOpenAction(action: CorrectiveAction): boolean {
  return action.status === "OPEN" || action.status === "IN_PROGRESS";
}

interface DecisionCopy {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  tone: "primary" | "danger";
  done: string;
}

function decisionCopy(decision: ReviewDecision, review: Review): DecisionCopy {
  if (decision === "APPROVE") {
    return {
      title: "Approve this review",
      description: `${review.reviewNumber} for ${review.supplierName} will be approved. Corrective actions can be added once it is approved.`,
      label: "Decision rationale",
      placeholder: "Why is this review being approved?",
      confirm: "Approve review",
      busy: "Approving…",
      tone: "primary",
      done: "Review approved",
    };
  }

  return {
    title: "Reject this review",
    description: `${review.reviewNumber} for ${review.supplierName} will be rejected.`,
    label: "Decision rationale",
    placeholder: "What needs to change before this review can be approved?",
    confirm: "Reject review",
    busy: "Rejecting…",
    tone: "danger",
    done: "Review rejected",
  };
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildHistoryColumns(currentId: string): Column<HistoryRow>[] {
  return [
    {
      id: "review",
      header: "Review",
      sortValue: (item) => item.reviewNumber,
      cell: (item) =>
        String(item.reviewId) === currentId ? (
          <div className="kit-cell-stack">
            <strong>{item.reviewNumber}</strong>

            <small>This review</small>
          </div>
        ) : (
          <Link href={`/supplier-performance/${item.reviewId}`} className="table-action">
            {item.reviewNumber}
          </Link>
        ),
    },
    {
      id: "period",
      header: "Period end",
      sortValue: (item) => item.periodEnd,
      cell: (item) => formatDate(item.periodEnd),
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: (item) => item.weightedScore,
      cell: (item) => <strong>{item.weightedScore.toFixed(1)}</strong>,
    },
    {
      id: "change",
      header: "Change",
      align: "right",
      sortValue: (item) => item.delta,
      cell: (item) => {
        if (item.delta === null) {
          return <span className="kit-text-muted">—</span>;
        }

        const rounded = Math.round(item.delta * 10) / 10;

        if (rounded === 0) {
          return <span className="kit-text-muted">0.0</span>;
        }

        return (
          <span className={rounded < 0 ? "kit-text-danger" : undefined}>
            {rounded > 0 ? "+" : "−"}
            {Math.abs(rounded).toFixed(1)}
          </span>
        );
      },
    },
    {
      id: "band",
      header: "Band",
      sortValue: (item) => item.performanceBand,
      cell: (item) => <StatusBadge value={item.performanceBand} />,
    },
  ];
}

interface ActionColumnOptions {
  canManage: boolean;
  canApprove: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (action: CorrectiveAction) => void;
  onComplete: (action: CorrectiveAction) => void;
  onCancel: (action: CorrectiveAction) => void;
}

function buildActionColumns(options: ActionColumnOptions): Column<CorrectiveAction>[] {
  return [
    {
      id: "action",
      header: "Action",
      sortValue: (action) => action.title.toLowerCase(),
      cell: (action) => (
        <div className="request-primary-cell">
          <strong>{action.title}</strong>

          <span>{action.description ?? "No additional description."}</span>
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
      sortValue: (action) => action.status,
      cell: (action) => <StatusBadge value={action.status} />,
    },
    {
      id: "outcome",
      header: "Outcome",
      sortValue: (action) => (action.completionNote ?? "").toLowerCase(),
      cell: (action) =>
        action.completionNote ? (
          <div className="kit-cell-stack">
            <span>{action.completionNote}</span>

            {action.completedAt ? <small>{formatDateTime(action.completedAt)}</small> : null}
          </div>
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
        if (!options.canManage || !isOpenAction(action)) {
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
              <CheckCircle2 size={14} />
              Complete
            </button>

            {options.canApprove ? (
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
/* Dimension card                                                      */
/* ------------------------------------------------------------------ */

interface DimensionCardProps {
  label: string;
  weight: number;
  score: number;
}

function DimensionCard({ label, weight, score }: DimensionCardProps) {
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <article className="supplier-dimension-card">
      <div>
        <span>{label}</span>

        <small>Weight {weight}%</small>
      </div>

      <strong>{score.toFixed(1)}</strong>

      <Meter value={clamped} max={100} tone={scoreTone(clamped)} ariaLabel={`${label} score`} />
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Add corrective action                                               */
/* ------------------------------------------------------------------ */

interface AddActionModalProps {
  review: Review;
  users: PerfUser[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

function AddActionModal({ review, users, onClose, onSaved }: AddActionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(() => isoDate(30));
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
      await createSupplierCorrectiveAction(review.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerId || undefined,
        dueDate,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create corrective action.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Corrective action"
      title="Add improvement action"
      description={`A step to improve the performance of ${review.supplierName}.`}
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
            form="performance-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add action"}
          </button>
        </>
      }
    >
      <form id="performance-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Action title" htmlFor="capa-title" error={errors.title}>
              <input
                id="capa-title"
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
            <Field label="Description" htmlFor="capa-description">
              <textarea
                id="capa-description"
                className="kit-field-input"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Owner" htmlFor="capa-owner">
            <select
              id="capa-owner"
              className="kit-field-input"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName} — {candidate.role}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="capa-due" error={errors.dueDate}>
            <input
              id="capa-due"
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
  detail: SupplierPerformanceReviewDetail;
  context: SupplierPerformanceContext;
}

export default function SupplierPerformanceDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<ReviewData | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitRunning, setSubmitRunning] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [decisionRunning, setDecisionRunning] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<CorrectiveAction | null>(null);
  const [completeRunning, setCompleteRunning] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<CorrectiveAction | null>(null);
  const [cancelRunning, setCancelRunning] = useState(false);
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
        const [reviewResponse, contextResponse] = await Promise.all([
          getSupplierPerformanceReview(id),
          getSupplierPerformanceContext(),
        ]);

        if (active) {
          setResult({ id, detail: reviewResponse, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load supplier performance review.",
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
  const users = data ? data.context.users.filter((candidate) => candidate.role !== "REQUESTER") : EMPTY_USERS;

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
        <Link href="/supplier-performance" className="request-back-link">
          <ArrowLeft size={16} />
          Supplier performance
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

  const { review, correctiveActions, supplierHistory } = detail;

  const busyAny =
    submitRunning || decisionRunning || completeRunning || cancelRunning || workingId !== null;

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      await submitSupplierPerformanceReview(review.id);

      setSubmitOpen(false);

      toast.success("Review submitted", review.reviewNumber);
      reload();
    } catch (caught) {
      setSubmitOpen(false);

      toast.error(
        "Could not submit the review",
        caught instanceof Error ? caught.message : "Unable to update supplier performance workflow.",
      );
    } finally {
      setSubmitRunning(false);
    }
  }

  async function confirmDecision(note: string) {
    if (decision === null) {
      return;
    }

    const kind = decision;

    setDecisionRunning(true);
    setDecisionError(null);

    try {
      if (kind === "APPROVE") {
        await approveSupplierPerformanceReview(review.id, note);
      } else {
        await rejectSupplierPerformanceReview(review.id, note);
      }

      setDecision(null);

      toast.success(decisionCopy(kind, review).done, review.reviewNumber);
      reload();
    } catch (caught) {
      setDecisionError(
        caught instanceof Error ? caught.message : "Unable to update supplier performance workflow.",
      );
    } finally {
      setDecisionRunning(false);
    }
  }

  async function startAction(action: CorrectiveAction) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(action.id));

    try {
      await startSupplierCorrectiveAction(action.id);

      toast.success("Action started", action.title);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the action",
        caught instanceof Error ? caught.message : "Unable to start corrective action.",
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
      await completeSupplierCorrectiveAction(action.id, note);

      setCompleting(null);

      toast.success("Action completed", action.title);
      reload();
    } catch (caught) {
      setCompleteError(
        caught instanceof Error ? caught.message : "Unable to complete corrective action.",
      );
    } finally {
      setCompleteRunning(false);
    }
  }

  async function confirmCancel() {
    if (cancelling === null) {
      return;
    }

    const action = cancelling;

    setCancelRunning(true);

    try {
      await cancelSupplierCorrectiveAction(action.id);

      setCancelling(null);

      toast.success("Action cancelled", action.title);
      reload();
    } catch (caught) {
      setCancelling(null);

      toast.error(
        "Could not cancel the action",
        caught instanceof Error ? caught.message : "Unable to cancel corrective action.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  function handleActionAdded(title: string) {
    setAdding(false);
    toast.success("Corrective action added", title);
    reload();
  }

  function openDecision(next: ReviewDecision) {
    setDecisionError(null);
    setDecision(next);
  }

  const openActions = correctiveActions.filter(isOpenAction);

  const orderedActions = [...correctiveActions].sort((a, b) => {
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

  const sortedHistory = [...supplierHistory].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  const historyRows: HistoryRow[] = sortedHistory.slice(0, HISTORY_LIMIT).map((item, index) => {
    const previous = sortedHistory[index + 1];

    return {
      ...item,
      delta: previous ? item.weightedScore - previous.weightedScore : null,
    };
  });

  const latestDelta = historyRows.length > 0 ? historyRows[0].delta : null;

  const dimensionScores = DIMENSIONS.map((dimension) => ({
    label: dimension.label,
    weight: dimension.weight,
    score: review[dimension.key],
  }));

  let weakest: (typeof dimensionScores)[number] | null = null;

  for (const item of dimensionScores) {
    if (weakest === null || item.score < weakest.score) {
      weakest = item;
    }
  }

  const weakBand = WEAK_BANDS.includes(review.performanceBand);
  const decisionInfo = decision !== null ? decisionCopy(decision, review) : null;

  const kpis: KpiItem[] = [
    {
      label: "Weighted score",
      icon: Gauge,
      value: review.weightedScore.toFixed(1),
      note: readable(review.performanceBand),
    },
    {
      label: "Purchase orders",
      icon: ClipboardCheck,
      value: String(review.purchaseOrderCountSnapshot),
      note: `${money(review.purchaseOrderValueSnapshot)} total value`,
    },
    {
      label: "Overdue POs",
      icon: AlertTriangle,
      value: String(review.overduePurchaseOrderCountSnapshot),
      note: "Snapshot at review creation",
      tone: review.overduePurchaseOrderCountSnapshot > 0 ? "warning" : "default",
    },
    {
      label: "Corrective actions",
      icon: BadgeCheck,
      value: String(review.openCorrectiveActions),
      note: `open · ${review.overdueCorrectiveActions} overdue`,
      tone: review.overdueCorrectiveActions > 0 ? "warning" : "default",
    },
  ];

  const actionColumns = buildActionColumns({
    canManage,
    canApprove,
    workingId,
    busy: busyAny,
    onStart: (action) => void startAction(action),
    onComplete: (action) => {
      setCompleteError(null);
      setCompleting(action);
    },
    onCancel: (action) => setCancelling(action),
  });

  const canAddAction = canManage && review.status === "APPROVED";

  return (
    <div className="page-stack">
      <Link href="/supplier-performance" className="request-back-link">
        <ArrowLeft size={16} />
        Supplier performance
      </Link>

      <section className="supplier-performance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{review.reviewNumber}</span>

            <StatusBadge value={review.status} />

            <StatusBadge value={review.performanceBand} />
          </div>

          <h1>{review.supplierName}</h1>

          <p>
            {review.supplierCode}
            {" · "}
            {review.supplierCategory ?? "Uncategorized"}
            {" · "}
            {formatDate(review.periodStart)}
            {" — "}
            {formatDate(review.periodEnd)}
          </p>
        </div>

        <div className="supplier-performance-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canApprove && review.status === "SUBMITTED" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openDecision("REJECT")}
            >
              <XCircle size={16} />
              Reject
            </button>
          ) : null}

          {canApprove && review.status === "SUBMITTED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openDecision("APPROVE")}
            >
              <CheckCircle2 size={16} />
              Approve review
            </button>
          ) : null}

          {canManage && review.status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setSubmitOpen(true)}
            >
              <Send size={16} />
              Submit review
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

      {review.status === "DRAFT" && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: submit this review.</strong> It goes to a procurement manager or
            administrator for a decision.
          </div>
        </div>
      ) : null}

      {review.status === "SUBMITTED" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting a decision.</strong>{" "}
            {canApprove
              ? "Approve or reject this review using the buttons above."
              : "A procurement manager or administrator needs to approve or reject this review."}
          </div>
        </div>
      ) : null}

      {review.overdueCorrectiveActions > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {review.overdueCorrectiveActions} corrective{" "}
              {review.overdueCorrectiveActions === 1 ? "action is" : "actions are"} overdue.
            </strong>{" "}
            Follow up with the owner or complete the action.
          </div>
        </div>
      ) : null}

      {review.status === "APPROVED" && weakBand && correctiveActions.length === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This supplier is rated {readable(review.performanceBand)}</strong> and has no
            improvement actions. Consider adding one.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Review summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Supplier scorecard</span>

            <h2>Weighted dimensions</h2>
          </div>
        </div>

        <div className="supplier-dimension-grid">
          {dimensionScores.map((dimension) => (
            <DimensionCard
              key={dimension.label}
              label={dimension.label}
              weight={dimension.weight}
              score={dimension.score}
            />
          ))}
        </div>

        {weakest !== null && weakest.score < 80 ? (
          <p className="kit-meta-line" style={{ marginTop: 12 }}>
            Weakest dimension: {weakest.label} ({weakest.score.toFixed(1)})
          </p>
        ) : null}
      </section>

      <section className="supplier-performance-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Supplier snapshot</span>

              <h2>Review context</h2>
            </div>
          </div>

          <div className="supplier-performance-context-grid">
            <div>
              <span>Supplier rating</span>

              <strong>{review.supplierRatingSnapshot ?? "—"}</strong>
            </div>

            <div>
              <span>Risk level</span>

              <strong>{review.supplierRiskSnapshot ?? "—"}</strong>
            </div>

            <div>
              <span>Review owner</span>

              <strong>{review.ownerName}</strong>
            </div>

            <div>
              <span>Category</span>

              <strong>{review.supplierCategory ?? "—"}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Performance history</span>

              <h2>Supplier trend</h2>
            </div>

            <TrendingUp size={19} />
          </div>

          {latestDelta !== null ? (
            <p className="kit-meta-line" style={{ marginBottom: 10 }}>
              {Math.round(latestDelta * 10) === 0
                ? "Score unchanged since the previous review."
                : `Score ${latestDelta > 0 ? "up" : "down"} ${Math.abs(latestDelta).toFixed(1)} points since the previous review.`}
            </p>
          ) : null}

          <DataTable
            columns={buildHistoryColumns(String(review.id))}
            rows={historyRows}
            getRowId={(item) => String(item.reviewId)}
            ariaLabel="Supplier performance history"
            empty={
              <EmptyState
                compact
                icon={TrendingUp}
                title="No history yet"
                description="Earlier reviews of this supplier will appear here."
              />
            }
          />
        </section>
      </section>

      {review.decisionNote ? (
        <section className="supplier-performance-decision-card">
          <BadgeCheck size={19} />

          <div>
            <span>Governance decision</span>

            <strong>{review.decisionNote}</strong>

            <small>
              {review.decidedByName ?? "Management"}
              {review.decidedAt ? ` · ${formatDateTime(review.decidedAt)}` : ""}
            </small>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Improvement management</span>

            <h2>Corrective action plan</h2>
          </div>

          {canAddAction ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add action
            </button>
          ) : (
            <ClipboardCheck size={19} />
          )}
        </div>

        {correctiveActions.length > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={correctiveActions.length - openActions.length}
              max={correctiveActions.length}
              tone={openActions.length === 0 ? meterToneFor("success") : "primary"}
              ariaLabel="Corrective actions finished"
            />

            <span className="kit-meter-caption">
              {correctiveActions.length - openActions.length} of {correctiveActions.length} actions
              finished
            </span>
          </div>
        ) : null}

        <DataTable
          columns={actionColumns}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="Corrective actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardCheck}
              title="No corrective actions"
              description={
                review.status === "APPROVED"
                  ? "No corrective actions are attached to this review."
                  : "Corrective actions can be added once the review is approved."
              }
              action={
                canAddAction ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
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

      {adding ? (
        <AddActionModal
          review={review}
          users={users}
          onClose={() => setAdding(false)}
          onSaved={handleActionAdded}
        />
      ) : null}

      {submitOpen ? (
        <ActionDialog
          eyebrow="Submit review"
          title="Submit this review?"
          description={`${review.reviewNumber} for ${review.supplierName} will be sent for approval.`}
          confirmLabel="Submit review"
          busyLabel="Submitting…"
          cancelLabel="Not yet"
          busy={submitRunning}
          onConfirm={() => void confirmSubmit()}
          onCancel={() => setSubmitOpen(false)}
        />
      ) : null}

      {decision !== null && decisionInfo !== null ? (
        <RationaleDialog
          eyebrow="Performance governance"
          title={decisionInfo.title}
          description={decisionInfo.description}
          label={decisionInfo.label}
          placeholder={decisionInfo.placeholder}
          confirmLabel={decisionInfo.confirm}
          busyLabel={decisionInfo.busy}
          tone={decisionInfo.tone}
          maxLength={2000}
          busy={decisionRunning}
          error={decisionError}
          onConfirm={(note) => void confirmDecision(note)}
          onCancel={() => setDecision(null)}
        />
      ) : null}

      {completing !== null ? (
        <RationaleDialog
          eyebrow="Corrective action"
          title="Complete this action"
          description={`Record the evidence or result for “${completing.title}”.`}
          label="Completion evidence / result"
          placeholder="What was done, and what was the result?"
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
        <ActionDialog
          eyebrow="Corrective action"
          title="Cancel this action?"
          description={`“${cancelling.title}” will be cancelled and no longer count as an open action.`}
          confirmLabel="Cancel action"
          busyLabel="Cancelling…"
          cancelLabel="Keep action"
          tone="danger"
          busy={cancelRunning}
          onConfirm={() => void confirmCancel()}
          onCancel={() => setCancelling(null)}
        />
      ) : null}
    </div>
  );
}
