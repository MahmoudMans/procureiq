"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock,
  Database,
  Gauge,
  GitCompare,
  Info,
  Play,
  Plus,
  RefreshCw,
  SearchCheck,
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
  Modal,
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  cancelDataQualityRemediation,
  completeDataQualityRemediation,
  createDataQualityRemediation,
  dismissDataQualityFinding,
  getDataQualityContext,
  getDataQualityFinding,
  resolveDataQualityFinding,
  startDataQualityRemediation,
} from "@/lib/api";
import type {
  DataQualityContext,
  DataQualityFindingDetail,
  DataQualityRemediation,
} from "@/types/data-quality";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Finding = DataQualityFindingDetail["finding"];
type ContextUser = DataQualityContext["users"][number];
type TaskField = "title" | "dueDate";

type RationaleRequest =
  | { kind: "RESOLVE" }
  | { kind: "DISMISS" }
  | { kind: "TASK_COMPLETE"; task: DataQualityRemediation };

type ActionRequest = { kind: "TASK_CANCEL"; task: DataQualityRemediation };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const DISMISS_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isActiveTask(task: DataQualityRemediation): boolean {
  return task.status === "OPEN" || task.status === "IN_PROGRESS";
}

function FindingBadge({ status }: { status: string }) {
  if (status === "REMEDIATION_IN_PROGRESS") {
    return <StatusBadge value="IN_PROGRESS" label="Remediation in progress" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
}

function TaskBadge({ status }: { status: string }) {
  if (status === "IN_PROGRESS") {
    return <StatusBadge value="IN_PROGRESS" label="In progress" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
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
  subject: string;
}

function rationaleCopy(
  request: RationaleRequest,
  finding: Finding,
  activeTasks: number,
): RationaleCopy {
  switch (request.kind) {
    case "RESOLVE":
      return {
        eyebrow: "Finding governance",
        title: "Resolve this finding",
        description: `${finding.ruleCode} will be marked as resolved.${
          activeTasks > 0
            ? ` ${activeTasks} remediation ${activeTasks === 1 ? "task is" : "tasks are"} still active.`
            : ""
        }`,
        label: "Governance evidence / rationale",
        placeholder: "What shows the underlying data is now correct?",
        confirm: "Resolve finding",
        busy: "Resolving…",
        tone: "primary",
        done: "Finding resolved",
        subject: finding.ruleCode,
      };

    case "DISMISS":
      return {
        eyebrow: "Finding governance",
        title: "Dismiss this exception",
        description: `${finding.ruleCode} will be dismissed as an accepted exception. The source data is not corrected.`,
        label: "Dismissal rationale",
        placeholder: "Why is this accepted as an exception?",
        confirm: "Dismiss exception",
        busy: "Dismissing…",
        cancelLabel: "Keep finding",
        tone: "danger",
        done: "Exception dismissed",
        subject: finding.ruleCode,
      };

    case "TASK_COMPLETE":
      return {
        eyebrow: "Remediation task",
        title: "Complete this task",
        description: `Record the completion evidence for “${request.task.title}”.`,
        label: "Completion evidence",
        placeholder: "What was corrected, and where can it be checked?",
        confirm: "Complete task",
        busy: "Completing…",
        tone: "primary",
        done: "Task completed",
        subject: request.task.title,
      };
  }
}

function performRationale(
  request: RationaleRequest,
  findingId: string,
  note: string,
): Promise<unknown> {
  switch (request.kind) {
    case "RESOLVE":
      return resolveDataQualityFinding(findingId, note);

    case "DISMISS":
      return dismissDataQualityFinding(findingId, note);

    case "TASK_COMPLETE":
      return completeDataQualityRemediation(request.task.id, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface TaskColumnOptions {
  canManage: boolean;
  canDismiss: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (task: DataQualityRemediation) => void;
  onComplete: (task: DataQualityRemediation) => void;
  onCancel: (task: DataQualityRemediation) => void;
}

function buildTaskColumns(options: TaskColumnOptions): Column<DataQualityRemediation>[] {
  return [
    {
      id: "task",
      header: "Task",
      sortValue: (task) => task.title.toLowerCase(),
      cell: (task) => <strong>{task.title}</strong>,
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (task) => (task.ownerName ?? "").toLowerCase(),
      cell: (task) => task.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (task) => String(task.dueDate),
      cell: (task) => (
        <div className="kit-cell-stack">
          <span>{formatDate(task.dueDate)}</span>

          {task.overdue && isActiveTask(task) ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (task) => String(task.status),
      cell: (task) => <TaskBadge status={String(task.status)} />,
    },
    {
      id: "evidence",
      header: "Completion evidence",
      cell: (task) =>
        task.completionNote ? (
          <span>{task.completionNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 270,
      cell: (task) => {
        if (!options.canManage || !isActiveTask(task)) {
          return null;
        }

        const starting = options.workingId === String(task.id);

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {task.status === "OPEN" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onStart(task)}
              >
                <Play size={14} />
                {starting ? "Starting…" : "Start"}
              </button>
            ) : null}

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onComplete(task)}
            >
              <BadgeCheck size={14} />
              Complete
            </button>

            {options.canDismiss ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onCancel(task)}
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
/* Add remediation task modal                                          */
/* ------------------------------------------------------------------ */

interface AddTaskModalProps {
  findingId: string;
  owners: ContextUser[];
  onClose: () => void;
  onSaved: (title: string) => Promise<void>;
}

function AddTaskModal({ findingId, owners, onClose, onSaved }: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(() => isoDate(14));
  const [errors, setErrors] = useState<Partial<Record<TaskField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dueInPast = dueDate !== "" && dueDate < isoDate(0);

  function clearError(field: TaskField) {
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

    const next: Partial<Record<TaskField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter a task title.";
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
      await createDataQualityRemediation(findingId, {
        title: title.trim(),
        ownerUserId: ownerId || undefined,
        dueDate,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create remediation task.",
      );
      setSaving(false);

      return;
    }

    await onSaved(title.trim());
  }

  return (
    <Modal
      eyebrow="Corrective action"
      title="Add remediation task"
      description="A task to correct the underlying master data."
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
            form="quality-task-form"
            className="button button--primary"
            disabled={saving}
          >
            <Plus size={16} />
            {saving ? "Creating…" : "Add remediation"}
          </button>
        </>
      }
    >
      <form id="quality-task-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Task title" htmlFor="quality-task-title" error={errors.title}>
              <input
                id="quality-task-title"
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

          {owners.length > 0 ? (
            <Field label="Owner" htmlFor="quality-task-owner">
              <select
                id="quality-task-owner"
                className="kit-field-input"
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                {owners.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} — {candidate.role}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Due date" htmlFor="quality-task-due" error={errors.dueDate}>
            <input
              id="quality-task-due"
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

        {dueInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The due date is in the past, so the task will be flagged as overdue immediately.
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

interface FindingData {
  id: string;
  detail: DataQualityFindingDetail;
  context: DataQualityContext;
}

export default function DataQualityFindingPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canDismiss = user !== null && DISMISS_ROLES.includes(user.role);

  const [result, setResult] = useState<FindingData | null>(null);
  const [adding, setAdding] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionRequest | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
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
        const [findingResponse, contextResponse] = await Promise.all([
          getDataQualityFinding(id),
          getDataQualityContext(),
        ]);

        if (active) {
          setResult({ id, detail: findingResponse, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load data-quality finding.",
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

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getDataQualityFinding(id);

      setResult((current) =>
        current && current.id === id ? { ...current, detail: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the finding.");
    }
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
        <Link href="/data-quality" className="request-back-link">
          <ArrowLeft size={16} />
          Data quality
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

  const { finding, remediationTasks: tasks } = detail;
  const status = String(finding.status);
  const activeFinding = status === "OPEN" || status === "REMEDIATION_IN_PROGRESS";
  const owners = (context?.users ?? []).filter((candidate) => candidate.role !== "REQUESTER");
  const activeTasks = tasks.filter(isActiveTask);
  const overdueTasks = activeTasks.filter((task) => task.overdue);
  const completedCount = tasks.filter((task) => task.status === "COMPLETED").length;
  const busyAny = rationaleRunning || actionRunning || workingId !== null;

  async function handleTaskAdded(title: string) {
    await refresh();

    setAdding(false);

    toast.success("Remediation task added", title);
  }

  async function startTask(task: DataQualityRemediation) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(task.id));

    try {
      await startDataQualityRemediation(task.id);

      await refresh();

      toast.success("Task started", task.title);
    } catch (caught) {
      toast.error(
        "Could not start the task",
        caught instanceof Error ? caught.message : "Unable to start remediation task.",
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
    const copy = rationaleCopy(request, finding, activeTasks.length);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      await performRationale(request, params.id, note.trim());

      await refresh();

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

  async function confirmAction() {
    if (action === null) {
      return;
    }

    const request = action;

    setActionRunning(true);

    try {
      await cancelDataQualityRemediation(request.task.id);

      await refresh();

      setAction(null);

      toast.success("Task cancelled", request.task.title);
    } catch (caught) {
      setAction(null);

      toast.error(
        "Could not cancel the task",
        caught instanceof Error ? caught.message : "Unable to cancel remediation task.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  const orderedTasks = [...tasks].sort((a, b) => {
    const left = isActiveTask(a) ? 0 : 1;
    const right = isActiveTask(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return String(a.dueDate).localeCompare(String(b.dueDate));
  });

  const rationaleInfo =
    rationale !== null ? rationaleCopy(rationale, finding, activeTasks.length) : null;

  const kpis: KpiItem[] = [
    {
      label: "Severity",
      icon: AlertTriangle,
      value: readable(String(finding.severity)),
      note: readable(String(finding.domain)),
    },
    {
      label: "Remediation tasks",
      icon: Wrench,
      value: String(tasks.length),
      note: `${completedCount} completed`,
    },
    {
      label: "Active tasks",
      icon: Gauge,
      value: String(finding.openRemediationTasks),
      note: "Open or in progress",
    },
    {
      label: "Overdue",
      icon: Clock,
      value: String(overdueTasks.length),
      note: overdueTasks.length > 0 ? "Active tasks past their due date" : "No overdue task",
      tone: overdueTasks.length > 0 ? "warning" : "default",
    },
  ];

  const taskColumns = buildTaskColumns({
    canManage,
    canDismiss,
    workingId,
    busy: busyAny,
    onStart: (task) => void startTask(task),
    onComplete: (task) => openRationale({ kind: "TASK_COMPLETE", task }),
    onCancel: (task) => setAction({ kind: "TASK_CANCEL", task }),
  });

  return (
    <div className="page-stack">
      <Link href="/data-quality" className="request-back-link">
        <ArrowLeft size={16} />
        Data quality
      </Link>

      <section className="data-quality-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{finding.ruleCode}</span>

            <StatusBadge
              value={String(finding.severity)}
              label={readable(String(finding.severity))}
            />

            <FindingBadge status={status} />
          </div>

          <h1>{finding.ruleTitle}</h1>

          <p>
            {readable(String(finding.domain))}
            {" · "}
            {readable(String(finding.entityType))}
            {" · "}
            {finding.entityReference ?? finding.entityId}
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

          {canManage && activeFinding ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add task
            </button>
          ) : null}

          {canDismiss && activeFinding ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "DISMISS" })}
            >
              <XCircle size={15} />
              Dismiss exception
            </button>
          ) : null}

          {canManage && activeFinding ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "RESOLVE" })}
            >
              <BadgeCheck size={16} />
              Resolve finding
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

      {activeFinding && canManage && activeTasks.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No remediation task is active.</strong> Add a task to correct the data, or
            resolve the finding with evidence.
          </div>
        </div>
      ) : null}

      {overdueTasks.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueTasks.length} remediation {overdueTasks.length === 1 ? "task is" : "tasks are"}{" "}
              overdue.
            </strong>{" "}
            Complete or cancel {overdueTasks.length === 1 ? "it" : "them"} in the table below.
          </div>
        </div>
      ) : null}

      {activeFinding ? (
        <div className="kit-callout kit-callout--info" role="status">
          <SearchCheck size={17} />

          <div>
            <strong>A completed task does not declare the data correct.</strong> Rerun the quality
            scan after the source record has been corrected. ProcureIQ then auto-resolves defects
            that are no longer present.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Finding summary" />

      <section className="data-quality-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Quality defect</span>

              <h2>Finding evidence</h2>
            </div>

            <SearchCheck size={19} />
          </div>

          <div className="data-quality-evidence-grid">
            <div>
              <span>Entity</span>

              <strong>{readable(String(finding.entityType))}</strong>
            </div>

            <div>
              <span>Entity ID</span>

              <strong className="data-quality-long-id">{finding.entityId}</strong>
            </div>

            <div>
              <span>Related entity</span>

              <strong className="data-quality-long-id">{finding.relatedEntityId ?? "—"}</strong>
            </div>

            <div>
              <span>First detected</span>

              <strong>{formatDateTime(finding.detectedAt)}</strong>
            </div>

            <div>
              <span>Last detected</span>

              <strong>{formatDateTime(finding.lastSeenAt)}</strong>
            </div>

            <div>
              <span>Remediation</span>

              <strong>{finding.openRemediationTasks} active</strong>
            </div>
          </div>

          <div className="data-quality-finding-details">{finding.details}</div>

          {finding.ruleCode === "SUPPLIER_DUPLICATE_NAME" ? (
            <div className="data-quality-duplicate-note">
              <GitCompare size={16} />

              <span>
                This is a duplicate candidate only. ProcureIQ does not automatically merge or
                delete either supplier record.
              </span>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Governance state</span>

              <h2>Finding status</h2>
            </div>

            <Database size={19} />
          </div>

          <div className="data-quality-state-card">
            <FindingBadge status={status} />

            {finding.resolutionNote ? (
              <>
                <strong>{finding.resolutionNote}</strong>

                <small>
                  {finding.resolvedByName ?? "Automated quality scan"}
                  {finding.resolvedAt ? ` · ${formatDateTime(finding.resolvedAt)}` : ""}
                </small>
              </>
            ) : (
              <p>
                This finding remains active until corrected, explicitly resolved or dismissed by
                governance.
              </p>
            )}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Remediation execution</span>

            <h2>Remediation tasks</h2>
          </div>

          {canManage && activeFinding ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add task
            </button>
          ) : (
            <Wrench size={19} />
          )}
        </div>

        <DataTable
          columns={taskColumns}
          rows={orderedTasks}
          getRowId={(task) => String(task.id)}
          ariaLabel="Remediation tasks"
          busy={fetching}
          empty={
            <EmptyState
              icon={Wrench}
              title="No remediation tasks"
              description="No remediation tasks are currently recorded."
              action={
                canManage && activeFinding ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add task
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {adding ? (
        <AddTaskModal
          findingId={params.id}
          owners={owners}
          onClose={() => setAdding(false)}
          onSaved={handleTaskAdded}
        />
      ) : null}

      {action !== null ? (
        <ActionDialog
          eyebrow="Remediation task"
          title="Cancel this task?"
          description={`“${action.task.title}” will be cancelled and will no longer count as active work.`}
          confirmLabel="Cancel task"
          busyLabel="Cancelling…"
          cancelLabel="Keep task"
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setAction(null)}
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
