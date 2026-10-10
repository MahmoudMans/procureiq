"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CalendarRange,
  Check,
  CircleAlert,
  Clock,
  Gauge,
  Info,
  Link2,
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
  type MeterTone,
  Modal,
  Skeleton,
  StatusBadge,
  formatDate,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import {
  activateProcurementPlan,
  addProcurementPlanItem,
  cancelPlanningItem,
  closeProcurementPlan,
  completePlanningItem,
  getPlanningContextOptions,
  getProcurementPlan,
  linkPlanningItemRequest,
  markPlanningItemReady,
} from "@/lib/api";
import type {
  PlanningContextOptions,
  ProcurementPlanDetail,
  ProcurementPlanItem,
  ProcurementPlanPriority,
} from "@/types/planning";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Plan = ProcurementPlanDetail["plan"];
type RequestOption = PlanningContextOptions["purchaseRequests"][number];
type PlanFlow = "ACTIVATE" | "CLOSE";
type ItemFlowKind = "READY" | "COMPLETE" | "CANCEL";
type ItemField = "title" | "department" | "category" | "value" | "date";

interface ItemFlow {
  kind: ItemFlowKind;
  itemId: string;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const PRIORITIES: { value: ProcurementPlanPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function fiscalDate(year: number): string {
  return `${year}-06-01`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function itemRank(item: ProcurementPlanItem): number {
  const status = String(item.status);

  if (status === "COMPLETED" || status === "CANCELLED") {
    return 2;
  }

  return item.overdue ? 0 : 1;
}

function PlanBadge({ status }: { status: string }) {
  return <StatusBadge value={status} label={readable(status)} />;
}

function ItemStatusBadge({ status }: { status: string }) {
  if (status === "CONVERTED") {
    return <StatusBadge value="AWARDED" label="Converted" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  return <StatusBadge value={priority} label={readable(priority)} />;
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

const PLAN_FLOWS: Record<PlanFlow, FlowCopy> = {
  ACTIVATE: {
    eyebrow: "Plan lifecycle",
    title: "Activate this plan?",
    confirm: "Activate plan",
    busy: "Activating…",
    keep: "Not yet",
    done: "Plan activated",
    failed: "Could not activate the plan",
  },
  CLOSE: {
    eyebrow: "Plan lifecycle",
    title: "Close this plan?",
    confirm: "Close plan",
    busy: "Closing…",
    keep: "Keep open",
    done: "Plan closed",
    failed: "Could not close the plan",
  },
};

const ITEM_FLOWS: Record<ItemFlowKind, FlowCopy> = {
  READY: {
    eyebrow: "Initiative lifecycle",
    title: "Mark this initiative ready?",
    confirm: "Mark ready",
    busy: "Marking…",
    keep: "Not yet",
    done: "Initiative marked ready",
    failed: "Could not mark the initiative ready",
  },
  COMPLETE: {
    eyebrow: "Initiative lifecycle",
    title: "Complete this initiative?",
    confirm: "Complete initiative",
    busy: "Completing…",
    keep: "Not yet",
    done: "Initiative completed",
    failed: "Could not complete the initiative",
  },
  CANCEL: {
    eyebrow: "Initiative lifecycle",
    title: "Cancel this initiative?",
    confirm: "Cancel initiative",
    busy: "Cancelling…",
    keep: "Keep initiative",
    done: "Initiative cancelled",
    failed: "Could not cancel the initiative",
  },
};

function planFlowDescription(flow: PlanFlow, plan: Plan, openCount: number): string {
  switch (flow) {
    case "ACTIVATE":
      return `${plan.planNumber} (${plan.name}) will be activated for fiscal year ${plan.fiscalYear}.`;

    case "CLOSE":
      return openCount > 0
        ? `${plan.planNumber} will be closed. ${plural(openCount, "initiative is", "initiatives are")} still open, and no more initiatives can be added once it is closed.`
        : `${plan.planNumber} will be closed. No more initiatives can be added once it is closed.`;
  }
}

function itemFlowDescription(kind: ItemFlowKind, item: ProcurementPlanItem): string {
  switch (kind) {
    case "READY":
      return `${item.title} will be marked ready for sourcing.`;

    case "COMPLETE":
      return `${item.title}${item.linkedRequestNumber ? ` (linked to ${item.linkedRequestNumber})` : ""} will be marked completed.`;

    case "CANCEL":
      return `${item.title} will be cancelled and will not move forward.`;
  }
}

function performPlanFlow(flow: PlanFlow, planId: string): Promise<unknown> {
  switch (flow) {
    case "ACTIVATE":
      return activateProcurementPlan(planId);

    case "CLOSE":
      return closeProcurementPlan(planId);
  }
}

function performItemFlow(kind: ItemFlowKind, itemId: string): Promise<unknown> {
  switch (kind) {
    case "READY":
      return markPlanningItemReady(itemId);

    case "COMPLETE":
      return completePlanningItem(itemId);

    case "CANCEL":
      return cancelPlanningItem(itemId);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ItemColumnOptions {
  currency: string;
  canManage: boolean;
  busy: boolean;
  linkable: (item: ProcurementPlanItem) => boolean;
  onReady: (item: ProcurementPlanItem) => void;
  onLink: (item: ProcurementPlanItem) => void;
  onComplete: (item: ProcurementPlanItem) => void;
  onCancel: (item: ProcurementPlanItem) => void;
}

function buildItemColumns(options: ItemColumnOptions): Column<ProcurementPlanItem>[] {
  const { currency } = options;

  return [
    {
      id: "initiative",
      header: "Initiative",
      sortValue: (item) => item.title.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.title}</strong>

          <span>
            {item.departmentName}
            {" · "}
            {item.category}
          </span>
        </div>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (item) => PRIORITY_RANK[String(item.priority)] ?? 0,
      cell: (item) => <PriorityBadge priority={String(item.priority)} />,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.status),
      cell: (item) => <ItemStatusBadge status={String(item.status)} />,
    },
    {
      id: "planned",
      header: "Planned",
      align: "right",
      sortValue: (item) => item.plannedValue,
      cell: (item) => <strong>{money(item.plannedValue, currency)}</strong>,
    },
    {
      id: "target",
      header: "Target",
      sortValue: (item) => String(item.targetSourcingDate ?? ""),
      cell: (item) => (
        <div className="kit-cell-stack">
          <span className={item.overdue ? "kit-text-danger" : undefined}>
            {formatDate(item.targetSourcingDate)}
          </span>

          {item.overdue ? <small className="kit-text-danger">Overdue</small> : null}
        </div>
      ),
    },
    {
      id: "request",
      header: "Linked request",
      sortValue: (item) => String(item.linkedRequestNumber ?? ""),
      cell: (item) =>
        item.linkedRequestNumber && item.linkedPurchaseRequestId ? (
          <Link href={`/requests/${item.linkedPurchaseRequestId}`} className="table-action">
            {item.linkedRequestNumber}
          </Link>
        ) : (
          <span className="kit-text-muted">Not linked</span>
        ),
    },
    {
      id: "actual",
      header: "Actual",
      align: "right",
      sortValue: (item) =>
        typeof item.linkedRequestValue === "number" ? item.linkedRequestValue : null,
      cell: (item) =>
        typeof item.linkedRequestValue === "number"
          ? money(item.linkedRequestValue, currency)
          : "—",
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => (item.linkedPurchaseRequestId ? item.variance : null),
      cell: (item) =>
        item.linkedPurchaseRequestId ? (
          <span className={item.variance > 0.005 ? "kit-text-warning" : undefined}>
            {money(item.variance, currency)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      cell: (item) => {
        if (!options.canManage) {
          return null;
        }

        const status = String(item.status);

        if (status === "PLANNED" || status === "READY") {
          const linkable = options.linkable(item);

          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
              {status === "PLANNED" ? (
                <button
                  type="button"
                  className="kit-row-button"
                  disabled={options.busy}
                  onClick={() => options.onReady(item)}
                >
                  <Check size={14} />
                  Mark ready
                </button>
              ) : null}

              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy || !linkable}
                title={
                  linkable
                    ? undefined
                    : "No purchase request in this department and currency is available to link"
                }
                onClick={() => options.onLink(item)}
              >
                <Link2 size={14} />
                Link request
              </button>

              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onCancel(item)}
              >
                <XCircle size={14} />
                Cancel
              </button>
            </div>
          );
        }

        if (status === "CONVERTED") {
          return (
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onComplete(item)}
            >
              <Check size={14} />
              Complete
            </button>
          );
        }

        return null;
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add initiative modal                                                */
/* ------------------------------------------------------------------ */

interface AddModalProps {
  plan: Plan;
  options: PlanningContextOptions;
  onClose: () => void;
  onSaved: (title: string) => Promise<void>;
}

function AddItemModal({ plan, options, onClose, onSaved }: AddModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState(options.departments[0]?.id ?? "");
  const [category, setCategory] = useState(options.categories[0] ?? "");
  const [value, setValue] = useState("10000");
  const [date, setDate] = useState(() => fiscalDate(plan.fiscalYear));
  const [priority, setPriority] = useState<ProcurementPlanPriority>("MEDIUM");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ItemField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const yearStart = `${plan.fiscalYear}-01-01`;
  const yearEnd = `${plan.fiscalYear}-12-31`;
  const dateInPast = date !== "" && date < isoDate(0);
  const noDepartments = options.departments.length === 0;

  function clearError(field: ItemField) {
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

    const next: Partial<Record<ItemField, string>> = {};

    if (!title.trim()) {
      next.title = "Give the initiative a title.";
    }

    if (!departmentId) {
      next.department = "Select a department.";
    }

    if (!category.trim()) {
      next.category = "Choose or enter a category.";
    }

    const problem = numberError(value, { min: 0.01 });

    if (problem) {
      next.value = problem;
    }

    if (!date) {
      next.date = "Choose a target sourcing date.";
    } else if (date < yearStart || date > yearEnd) {
      next.date = `The date must fall within fiscal year ${plan.fiscalYear}.`;
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addProcurementPlanItem(plan.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        departmentId,
        category: category.trim(),
        plannedValue: Number(value),
        targetSourcingDate: date,
        priority,
        notes: notes.trim() || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add planning initiative.");
      setSaving(false);

      return;
    }

    await onSaved(title.trim());
  }

  return (
    <Modal
      eyebrow="Demand intake"
      title="Add planned initiative"
      description={`Add an initiative to ${plan.planNumber} for fiscal year ${plan.fiscalYear}.`}
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
            form="planning-item-form"
            className="button button--primary"
            disabled={saving || noDepartments}
          >
            <Plus size={16} />
            {saving ? "Adding…" : "Add initiative"}
          </button>
        </>
      }
    >
      <form id="planning-item-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Title" htmlFor="planning-title" error={errors.title}>
              <input
                id="planning-title"
                className="kit-field-input"
                maxLength={220}
                placeholder="Network infrastructure refresh"
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
            <Field label="Description" htmlFor="planning-description">
              <textarea
                id="planning-description"
                className="kit-field-input"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Department" htmlFor="planning-department" error={errors.department}>
            <select
              id="planning-department"
              className="kit-field-input"
              value={departmentId}
              aria-invalid={errors.department ? true : undefined}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                clearError("department");
              }}
            >
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <Field label="Category" htmlFor="planning-category" error={errors.category}>
              <input
                id="planning-category"
                className="kit-field-input"
                list="planning-category-options"
                maxLength={120}
                value={category}
                aria-invalid={errors.category ? true : undefined}
                onChange={(event) => {
                  setCategory(event.target.value);
                  clearError("category");
                }}
              />
            </Field>

            <datalist id="planning-category-options">
              {options.categories.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <NumberField
            id="planning-value"
            label={`Planned value (${plan.currency})`}
            min={0.01}
            step="0.01"
            value={value}
            error={errors.value}
            onChange={(next) => {
              setValue(next);
              clearError("value");
            }}
          />

          <div>
            <Field label="Target sourcing date" htmlFor="planning-date" error={errors.date}>
              <input
                id="planning-date"
                className="kit-field-input"
                type="date"
                min={yearStart}
                max={yearEnd}
                value={date}
                aria-invalid={errors.date ? true : undefined}
                onChange={(event) => {
                  setDate(event.target.value);
                  clearError("date");
                }}
              />
            </Field>

            <p className="kit-meta-line">Within fiscal year {plan.fiscalYear}.</p>
          </div>

          <Field label="Priority" htmlFor="planning-priority">
            <select
              id="planning-priority"
              className="kit-field-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ProcurementPlanPriority)}
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="kit-pair-wide">
            <Field label="Notes" htmlFor="planning-notes">
              <textarea
                id="planning-notes"
                className="kit-field-input"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {noDepartments ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            No department is available, so an initiative cannot be added yet.
          </p>
        ) : null}

        {dateInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The target date is in the past, so the initiative will be overdue immediately.
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
/* Link purchase request modal                                         */
/* ------------------------------------------------------------------ */

interface LinkModalProps {
  item: ProcurementPlanItem;
  plan: Plan;
  requests: RequestOption[];
  onClose: () => void;
  onSaved: (requestNumber: string) => Promise<void>;
}

function LinkRequestModal({ item, plan, requests, onClose, onSaved }: LinkModalProps) {
  const [requestId, setRequestId] = useState(requests[0]?.id ?? "");
  const [requestError, setRequestError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = requests.find((request) => request.id === requestId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!requestId || !selected) {
      setRequestError("Select the purchase request to link.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await linkPlanningItemRequest(item.id, requestId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to link purchase request.");
      setSaving(false);

      return;
    }

    await onSaved(selected.requestNumber);
  }

  return (
    <Modal
      eyebrow="Purchase-request handoff"
      title="Link purchase request"
      description={`Link the purchase request that realises “${item.title}”.`}
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
            form="planning-link-form"
            className="button button--primary"
            disabled={saving}
          >
            <Link2 size={16} />
            {saving ? "Linking…" : "Link request"}
          </button>
        </>
      }
    >
      <form id="planning-link-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Matching request" htmlFor="planning-request" error={requestError}>
              <select
                id="planning-request"
                className="kit-field-input"
                value={requestId}
                aria-invalid={requestError ? true : undefined}
                onChange={(event) => {
                  setRequestId(event.target.value);
                  setRequestError(undefined);
                }}
              >
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.requestNumber} — {request.title}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              Only requests from {item.departmentName} in {plan.currency} are listed.
            </p>
          </div>
        </div>

        <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
          Linking converts the initiative and cannot be undone from this page.
        </p>

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

interface PlanData {
  id: string;
  detail: ProcurementPlanDetail;
  options: PlanningContextOptions;
}

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);

  const [result, setResult] = useState<PlanData | null>(null);
  const [planFlow, setPlanFlow] = useState<PlanFlow | null>(null);
  const [planFlowRunning, setPlanFlowRunning] = useState(false);
  const [itemFlow, setItemFlow] = useState<ItemFlow | null>(null);
  const [itemFlowRunning, setItemFlowRunning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
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
          getProcurementPlan(id),
          getPlanningContextOptions(),
        ]);

        if (active) {
          setResult({ id, detail: detailResponse, options: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load procurement plan.");
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

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function refresh() {
    const id = params.id;

    try {
      const [detailResponse, contextResponse] = await Promise.all([
        getProcurementPlan(id),
        getPlanningContextOptions(),
      ]);

      setResult((current) =>
        current && current.id === id
          ? { ...current, detail: detailResponse, options: contextResponse }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the plan.");
    }
  }

  if (data === null) {
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
        <Link href="/planning" className="request-back-link">
          <ArrowLeft size={16} />
          Procurement planning
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

  const { detail, options } = data;
  const { plan, items } = detail;
  const currency = plan.currency;
  const status = String(plan.status);
  const draft = status === "DRAFT";
  const active = status === "ACTIVE";
  const closed = status === "CLOSED";
  const editable = draft || active;
  const busyAny = planFlowRunning || itemFlowRunning;
  const canAdd = canManage && editable && options.departments.length > 0;
  const overdueCount = items.filter((item) => item.overdue).length;
  const readyCount = items.filter((item) => String(item.status) === "READY").length;
  const convertedCount = items.filter((item) => String(item.status) === "CONVERTED").length;
  const openCount = items.filter((item) =>
    ["PLANNED", "READY", "CONVERTED"].includes(String(item.status)),
  ).length;

  function requestsFor(item: ProcurementPlanItem): RequestOption[] {
    return options.purchaseRequests.filter(
      (request) => request.departmentId === item.departmentId && request.currency === currency,
    );
  }

  const linkingItem = items.find((item) => String(item.id) === linkingId) ?? null;
  const flowItem = itemFlow !== null ? (items.find((item) => String(item.id) === itemFlow.itemId) ?? null) : null;

  async function confirmPlanFlow() {
    if (planFlow === null) {
      return;
    }

    const action = planFlow;

    setPlanFlowRunning(true);

    try {
      await performPlanFlow(action, plan.id);

      await refresh();

      setPlanFlow(null);

      toast.success(PLAN_FLOWS[action].done, plan.planNumber);
    } catch (caught) {
      setPlanFlow(null);

      toast.error(
        PLAN_FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update procurement plan.",
      );
    } finally {
      setPlanFlowRunning(false);
    }
  }

  async function confirmItemFlow() {
    if (itemFlow === null) {
      return;
    }

    const { kind, itemId } = itemFlow;
    const title = flowItem ? flowItem.title : plan.planNumber;

    setItemFlowRunning(true);

    try {
      await performItemFlow(kind, itemId);

      await refresh();

      setItemFlow(null);

      toast.success(ITEM_FLOWS[kind].done, title);
    } catch (caught) {
      setItemFlow(null);

      toast.error(
        ITEM_FLOWS[kind].failed,
        caught instanceof Error ? caught.message : "Unable to update the initiative.",
      );
    } finally {
      setItemFlowRunning(false);
    }
  }

  async function handleAdded(title: string) {
    await refresh();

    setAdding(false);

    toast.success("Initiative added", title);
  }

  async function handleLinked(requestNumber: string) {
    await refresh();

    setLinkingId(null);

    toast.success("Purchase request linked", `${requestNumber} — the initiative is converted`);
  }

  const orderedItems = [...items].sort((a, b) => {
    const rank = itemRank(a) - itemRank(b);

    if (rank !== 0) {
      return rank;
    }

    return String(a.targetSourcingDate ?? "").localeCompare(String(b.targetSourcingDate ?? ""));
  });

  const kpis: KpiItem[] = [
    {
      label: "Planned value",
      icon: CalendarRange,
      value: money(plan.plannedValue, currency),
      note: plural(plan.totalItems, "initiative", "initiatives"),
    },
    {
      label: "Linked actual",
      icon: Link2,
      value: money(plan.linkedActualValue, currency),
      note: `${plan.convertedItems} linked`,
    },
    {
      label: "Conversion",
      icon: Target,
      value: `${plan.conversionRate.toFixed(1)}%`,
      note: `${plan.completedItems} completed`,
    },
    {
      label: "Variance",
      icon: CalendarCheck,
      value: money(plan.variance, currency),
      note: "Actual minus plan",
      tone: plan.variance > 0.005 ? "warning" : "default",
    },
    {
      label: "Overdue",
      icon: Clock,
      value: String(overdueCount),
      note: "Past the target date",
      tone: overdueCount > 0 ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns({
    currency,
    canManage,
    busy: busyAny,
    linkable: (item) => requestsFor(item).length > 0,
    onReady: (item) => setItemFlow({ kind: "READY", itemId: item.id }),
    onLink: (item) => setLinkingId(String(item.id)),
    onComplete: (item) => setItemFlow({ kind: "COMPLETE", itemId: item.id }),
    onCancel: (item) => setItemFlow({ kind: "CANCEL", itemId: item.id }),
  });

  return (
    <div className="page-stack">
      <Link href="/planning" className="request-back-link">
        <ArrowLeft size={16} />
        Procurement planning
      </Link>

      <section className="planning-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{plan.planNumber}</span>

            <PlanBadge status={status} />
          </div>

          <h1>{plan.name}</h1>

          <p>
            {plan.fiscalYear}
            {" · "}
            {currency}
            {" · Owner: "}
            {plan.ownerName}
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

          {canAdd ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add initiative
            </button>
          ) : null}

          {canManage && editable ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => setPlanFlow("CLOSE")}
            >
              <XCircle size={15} />
              Close plan
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPlanFlow("ACTIVATE")}
            >
              <CalendarCheck size={16} />
              Activate
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

      {overdueCount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(overdueCount, "initiative is", "initiatives are")} past the target sourcing
              date.
            </strong>{" "}
            They are listed first in the table below.
          </div>
        </div>
      ) : null}

      {draft && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The plan is a draft.</strong>{" "}
            {items.length === 0
              ? "Add the planned initiatives, then activate the plan."
              : "Activate it when the initiatives are complete."}
          </div>
        </div>
      ) : null}

      {editable && canManage && readyCount > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(readyCount, "initiative is", "initiatives are")} ready for sourcing.
            </strong>{" "}
            Link each one to its purchase request to convert it.
          </div>
        </div>
      ) : null}

      {canManage && convertedCount > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(convertedCount, "linked initiative", "linked initiatives")} can be completed.
            </strong>{" "}
            Complete them when the sourcing is finished.
          </div>
        </div>
      ) : null}

      {closed ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This plan is closed.</strong> No more initiatives can be added to it.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Plan summary" />

      {plan.totalItems > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Conversion and completion</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={plan.conversionRate}
            tone="primary"
            caption={`${plan.convertedItems} of ${plan.totalItems} initiatives are linked to a purchase request (${plan.conversionRate.toFixed(1)}%)`}
            label="Initiatives linked to a purchase request"
          />

          <ProgressLine
            pct={(plan.completedItems / plan.totalItems) * 100}
            tone={plan.completedItems === plan.totalItems ? meterToneFor("success") : "primary"}
            caption={`${plan.completedItems} of ${plan.totalItems} initiatives are completed`}
            label="Completed initiatives"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Annual demand</span>

            <h2>Planned initiatives</h2>
          </div>

          {canAdd ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add initiative
            </button>
          ) : (
            <CalendarRange size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Planned initiatives"
          busy={fetching}
          empty={
            <EmptyState
              icon={CalendarRange}
              title="No initiatives"
              description="No procurement initiatives have been added to this plan."
              action={
                canAdd ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add initiative
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {adding ? (
        <AddItemModal
          plan={plan}
          options={options}
          onClose={() => setAdding(false)}
          onSaved={handleAdded}
        />
      ) : null}

      {linkingItem !== null ? (
        <LinkRequestModal
          item={linkingItem}
          plan={plan}
          requests={requestsFor(linkingItem)}
          onClose={() => setLinkingId(null)}
          onSaved={handleLinked}
        />
      ) : null}

      {planFlow !== null ? (
        <ActionDialog
          eyebrow={PLAN_FLOWS[planFlow].eyebrow}
          title={PLAN_FLOWS[planFlow].title}
          description={planFlowDescription(planFlow, plan, openCount)}
          confirmLabel={PLAN_FLOWS[planFlow].confirm}
          busyLabel={PLAN_FLOWS[planFlow].busy}
          cancelLabel={PLAN_FLOWS[planFlow].keep}
          busy={planFlowRunning}
          onConfirm={() => void confirmPlanFlow()}
          onCancel={() => setPlanFlow(null)}
        />
      ) : null}

      {itemFlow !== null && flowItem !== null ? (
        <ActionDialog
          eyebrow={ITEM_FLOWS[itemFlow.kind].eyebrow}
          title={ITEM_FLOWS[itemFlow.kind].title}
          description={itemFlowDescription(itemFlow.kind, flowItem)}
          confirmLabel={ITEM_FLOWS[itemFlow.kind].confirm}
          busyLabel={ITEM_FLOWS[itemFlow.kind].busy}
          cancelLabel={ITEM_FLOWS[itemFlow.kind].keep}
          busy={itemFlowRunning}
          onConfirm={() => void confirmItemFlow()}
          onCancel={() => setItemFlow(null)}
        />
      ) : null}
    </div>
  );
}
