"use client";

import {
  Banknote,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  RefreshCw,
  SearchX,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  Field,
  KpiGrid,
  type KpiItem,
  Modal,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  StatusBadge,
  downloadCsv,
  formatDate,
  formatMoney,
  readable,
  timeOf,
  useToast,
} from "@/components/kit";
import {
  approveTask,
  getApprovalQueue,
  getApprovalSummary,
  rejectTask,
} from "@/lib/api";
import type {
  ApprovalSummary,
  ApprovalTask,
  ApprovalTaskStatus,
} from "@/types/approval";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

type DecisionType = "APPROVE" | "REJECT";

interface DecisionState {
  task: ApprovalTask;
  type: DecisionType;
}

const ALLOWED_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "APPROVER"];

const integer = new Intl.NumberFormat("en-US");
const EMPTY_TASKS: ApprovalTask[] = [];

function waitingDays(requestedAt: string, now: number): number {
  const time = timeOf(requestedAt);

  return time === null ? 0 : Math.max(Math.floor((now - time) / 86_400_000), 0);
}

function buildColumns(
  now: number,
  onDecide: (task: ApprovalTask, type: DecisionType) => void,
): Column<ApprovalTask>[] {
  return [
    {
      id: "request",
      header: "Request",
      sortValue: (task) => task.requestTitle.toLowerCase(),
      cell: (task) => (
        <div className="request-primary-cell">
          <strong>
            <Link
              href={`/purchase-requests/${task.purchaseRequestId}`}
              className="supplier-360-link"
            >
              {task.requestTitle}
            </Link>
          </strong>

          <span>
            {task.requestNumber} · {task.departmentName}
          </span>
        </div>
      ),
    },
    {
      id: "requester",
      header: "Requester",
      sortValue: (task) => task.requesterName.toLowerCase(),
      cell: (task) => (
        <div className="stacked-cell">
          <strong>{task.requesterName}</strong>
          <span>{task.costCenter}</span>
        </div>
      ),
    },
    {
      id: "policy",
      header: "Policy",
      sortValue: (task) => task.policyName.toLowerCase(),
      cell: (task) => (
        <div className="stacked-cell">
          <strong>{task.policyName}</strong>
          <span>{task.policyCode}</span>
        </div>
      ),
    },
    {
      id: "role",
      header: "Required role",
      sortValue: (task) => task.requiredRole,
      cell: (task) => (
        <StatusBadge
          value={task.requiredRole}
          label={readable(task.requiredRole)}
          tone="accent"
          dot={false}
        />
      ),
    },
    {
      id: "value",
      header: "Value",
      align: "right",
      sortValue: (task) => task.estimatedTotalAmount,
      firstSort: "desc",
      cell: (task) => (
        <strong className="kit-num">
          {formatMoney(task.estimatedTotalAmount, task.currency)}
        </strong>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (task) => task.status,
      cell: (task) => <StatusBadge value={task.status} />,
    },
    {
      id: "requested",
      header: "Requested",
      sortValue: (task) => timeOf(task.requestedAt),
      firstSort: "desc",
      cell: (task) => {
        const waiting =
          task.status === "PENDING" ? waitingDays(task.requestedAt, now) : null;

        return (
          <div className="kit-cell-stack">
            <span>{formatDate(task.requestedAt)}</span>

            {waiting !== null ? (
              <small
                className={waiting >= 3 ? "kit-cell-flag kit-cell-flag--warning" : undefined}
              >
                {waiting === 0 ? "Requested today" : `Waiting ${waiting}d`}
              </small>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      cell: (task) => (
        <div className="kit-row-actions">
          <Link
            href={`/purchase-requests/${task.purchaseRequestId}`}
            className="kit-icon-link"
            aria-label={`View request ${task.requestNumber}`}
            title="View request"
          >
            <Eye size={15} />
          </Link>

          {task.status === "PENDING" ? (
            <>
              <button
                type="button"
                className="kit-row-button kit-row-button--approve"
                onClick={() => onDecide(task, "APPROVE")}
              >
                Approve
              </button>

              <button
                type="button"
                className="kit-row-button kit-row-button--reject"
                onClick={() => onDecide(task, "REJECT")}
              >
                Reject
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ApprovalsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const allowed = user !== null && ALLOWED_ROLES.includes(user.role);

  const [now] = useState(() => Date.now());
  const columns = useMemo(
    () => buildColumns(now, (task, type) => setDecision({ task, type })),
    [now],
  );

  const [tasks, setTasks] = useState<ApprovalTask[] | null>(null);
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [decision, setDecision] = useState<DecisionState | null>(null);

  // Headline numbers: loaded once, and again after every decision or Refresh.
  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    async function loadSummary() {
      try {
        const response = await getApprovalSummary();

        if (active) {
          setSummary(response);
          setSummaryFailed(false);
        }
      } catch {
        if (active) {
          setSummaryFailed(true);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [allowed, reloadKey]);

  // The queue: re-run whenever the status filter changes.
  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getApprovalQueue(
          (status as ApprovalTaskStatus) || undefined,
        );

        if (active) {
          setTasks(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load approval queue.",
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
  }, [allowed, status, reloadKey]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return tasks ?? EMPTY_TASKS;
    }

    return (tasks ?? EMPTY_TASKS).filter((task) =>
      [
        task.requestTitle,
        task.requestNumber,
        task.requesterName,
        task.departmentName,
        task.costCenter,
        task.policyName,
        task.policyCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [tasks, query]);

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Procurement governance</span>

            <h1>Approval center</h1>
          </div>
        </section>

        <section className="panel">
          <EmptyState
            icon={ShieldCheck}
            title="Access restricted"
            description="Your current ProcureIQ role does not have access to the approval queue."
          />
        </section>
      </div>
    );
  }

  const initialLoad = tasks === null && error === null;
  const searching = query.trim() !== "";

  const statusFilters: SegmentedOption[] = [
    {
      value: "PENDING",
      label: summary ? `Pending · ${integer.format(summary.pendingTasks)}` : "Pending",
    },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "", label: "All" },
  ];

  function handleDecisionComplete() {
    if (decision) {
      const approved = decision.type === "APPROVE";

      toast.success(
        approved ? "Request approved" : "Request rejected",
        `${decision.task.requestNumber} · ${decision.task.requestTitle}`,
      );
    }

    setDecision(null);
    setReloadKey((key) => key + 1);
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-approvals-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Request number",
        "Title",
        "Requester",
        "Department",
        "Cost center",
        "Policy",
        "Policy code",
        "Required role",
        "Status",
        "Currency",
        "Estimated value",
        "Requested at",
      ],
      rows.map((task) => [
        task.requestNumber,
        task.requestTitle,
        task.requesterName,
        task.departmentName,
        task.costCenter,
        task.policyName,
        task.policyCode,
        task.requiredRole,
        task.status,
        task.currency,
        task.estimatedTotalAmount,
        task.requestedAt,
      ]),
    );

    toast.success(
      "Approvals exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const kpis: KpiItem[] = [
    {
      label: "Pending approvals",
      icon: Clock3,
      value: summary ? integer.format(summary.pendingTasks) : "—",
      note: "Decisions currently awaiting your role.",
    },
    {
      label: "Approved",
      icon: CheckCircle2,
      value: summary ? integer.format(summary.approvedTasks) : "—",
      note: "Approved procurement decisions in your queue.",
    },
    {
      label: "Rejected",
      icon: XCircle,
      value: summary ? integer.format(summary.rejectedTasks) : "—",
      note: "Requests declined through procurement governance.",
      tone: "warning",
    },
    {
      label: "Pending value",
      icon: Banknote,
      value: summary ? formatMoney(summary.pendingValue, "EUR", true) : "—",
      note: "Estimated value awaiting approval decisions.",
    },
  ];

  let emptyNode;

  if (searching) {
    emptyNode = (
      <EmptyState
        icon={SearchX}
        title="No approval tasks match your search"
        description="Try a different request number, requester or policy."
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        }
      />
    );
  } else if (status === "PENDING") {
    emptyNode = (
      <EmptyState
        icon={CheckCircle2}
        title="No pending approvals"
        description="You're all caught up. New requests that need your decision will appear here."
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setStatus("")}
          >
            Show all decisions
          </button>
        }
      />
    );
  } else if (status) {
    emptyNode = (
      <EmptyState
        icon={ShieldCheck}
        title={`No ${readable(status).toLowerCase()} tasks`}
        description="There are no approval tasks with this status."
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setStatus("")}
          >
            Show all decisions
          </button>
        }
      />
    );
  } else {
    emptyNode = (
      <EmptyState
        icon={ShieldCheck}
        title="No approval tasks yet"
        description="Approval tasks are created when purchase requests are submitted."
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procurement governance</span>

          <h1>Approval center</h1>

          <p>
            Review submitted purchase requests, enforce approval policies and
            maintain a complete decision history.
          </p>
        </div>

        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Approval totals"
      />

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search request, requester or policy"
          ariaLabel="Search approval tasks"
          shortcut
        />

        <SegmentedFilter
          options={statusFilters}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by decision status"
        />
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {error && tasks === null ? null : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(task) => task.id}
          ariaLabel="Approval tasks"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          defaultSort={{ id: "requested", dir: "desc" }}
          persistKey="approvals"
          resetKey={`${query}|${status}`}
        />
      )}

      {decision ? (
        <DecisionModal
          decision={decision}
          onClose={() => setDecision(null)}
          onComplete={handleDecisionComplete}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Decision dialog                                                     */
/* ------------------------------------------------------------------ */

interface DecisionModalProps {
  decision: DecisionState;
  onClose: () => void;
  onComplete: () => void;
}

function DecisionModal({ decision, onClose, onComplete }: DecisionModalProps) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  const rejecting = decision.type === "REJECT";
  const { task } = decision;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const text = comment.trim();

    if (rejecting && !text) {
      setFieldError("Please explain why this request is being rejected.");
      document.getElementById("decision-comment")?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (rejecting) {
        await rejectTask(task.id, text);
      } else {
        await approveTask(task.id, text);
      }

      onComplete();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to record the approval decision.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Approval decision"
      title={rejecting ? "Reject request" : "Approve request"}
      description={`${task.requestNumber} · ${task.requestTitle}`}
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
            form="approval-decision-form"
            className={rejecting ? "button kit-btn-danger" : "button button--primary"}
            disabled={saving}
          >
            {saving
              ? "Saving decision…"
              : rejecting
                ? "Reject request"
                : "Approve request"}
          </button>
        </>
      }
    >
      <form id="approval-decision-form" onSubmit={handleSubmit} noValidate>
        <div className="approval-decision-summary">
          <div>
            <span>Requester</span>
            <strong>{task.requesterName}</strong>
          </div>

          <div>
            <span>Policy</span>
            <strong>{task.policyName}</strong>
          </div>

          <div>
            <span>Estimated value</span>
            <strong>{formatMoney(task.estimatedTotalAmount, task.currency)}</strong>
          </div>
        </div>

        <Field
          label={rejecting ? "Rejection reason" : "Decision comment"}
          htmlFor="decision-comment"
          required={rejecting}
          error={fieldError}
          hint={rejecting ? undefined : "Optional comment saved with your decision."}
        >
          <textarea
            id="decision-comment"
            className="kit-textarea"
            rows={5}
            maxLength={2000}
            value={comment}
            placeholder={
              rejecting
                ? "Explain why this purchase request is being rejected."
                : "Optional approval comment."
            }
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "decision-comment-error" : undefined}
            onChange={(event) => {
              setComment(event.target.value);
              setFieldError(undefined);
            }}
          />
        </Field>

        {error ? (
          <div className="error-banner" style={{ marginTop: 16 }}>
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
