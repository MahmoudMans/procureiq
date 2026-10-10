"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CircleAlert,
  Clock,
  Gauge,
  Hourglass,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
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
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import {
  createCapacityAssignment,
  deleteCapacityAssignment,
  getCapacityPlanningDashboard,
  getCapacityWorkEstimate,
  updateCapacityWorkEstimate,
} from "@/lib/api";
import type { CapacityPlanningDashboard, CapacityWorkItem } from "@/types/capacity-planning";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Assignment = CapacityWorkItem["assignments"][number];
type Candidate = CapacityPlanningDashboard["users"][number];
type AssignmentField = "member" | "allocation";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
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

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface AssignmentColumnOptions {
  canRemove: boolean;
  busy: boolean;
  onRemove: (assignment: Assignment) => void;
}

function buildAssignmentColumns(options: AssignmentColumnOptions): Column<Assignment>[] {
  return [
    {
      id: "member",
      header: "Team member",
      sortValue: (item) => String(item.userName).toLowerCase(),
      cell: (item) => <strong>{item.userName}</strong>,
    },
    {
      id: "role",
      header: "Role",
      sortValue: (item) => String(item.role),
      cell: (item) => readable(String(item.role)),
    },
    {
      id: "allocation",
      header: "Allocation",
      align: "right",
      sortValue: (item) => item.allocationPct,
      cell: (item) => <strong>{item.allocationPct.toFixed(1)}%</strong>,
    },
    {
      id: "effort",
      header: "Assigned effort",
      align: "right",
      sortValue: (item) => item.assignedEffortHours,
      cell: (item) => `${item.assignedEffortHours.toFixed(0)} h`,
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 120,
      cell: (item) =>
        options.canRemove ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onRemove(item)}
          >
            <Trash2 size={14} />
            Remove
          </button>
        ) : null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Update estimate modal                                               */
/* ------------------------------------------------------------------ */

interface EstimateModalProps {
  workId: string;
  item: CapacityWorkItem;
  onClose: () => void;
  onSaved: (updated: CapacityWorkItem, detail: string) => void;
}

function EstimateModal({ workId, item, onClose, onSaved }: EstimateModalProps) {
  const current = item.estimatedEffortHours;

  const [value, setValue] = useState(() => String(current));
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = numberError(value, { min: 0.01 }) === undefined;
  const next = valid ? Number(value) : current;
  const changePct = valid && current > 0 ? (Math.abs(next - current) / current) * 100 : 0;
  const large = changePct >= 50;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const problem = numberError(value, { min: 0.01 });

    setFieldError(problem);

    if (problem) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateCapacityWorkEstimate(workId, Number(value));

      onSaved(updated, `${Number(value).toFixed(0)} h estimated effort`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update effort estimate.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Demand estimate"
      title="Update effort estimate"
      description={`Estimated effort for ${item.sourceReference}.`}
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
            form="capacity-estimate-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Updating…" : "Update estimate"}
          </button>
        </>
      }
    >
      <form id="capacity-estimate-form" onSubmit={handleSubmit} noValidate>
        <NumberField
          id="capacity-effort"
          label="Estimated effort (hours)"
          min={0.01}
          step="1"
          value={value}
          error={fieldError}
          onChange={(nextValue) => {
            setValue(nextValue);
            setFieldError(undefined);
          }}
        />

        <p className="kit-meta-line">
          Currently {current.toFixed(0)} h, with {item.assignedEffortHours.toFixed(0)} h assigned and{" "}
          {item.unassignedEffortHours.toFixed(0)} h unassigned.
        </p>

        {large ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This changes the estimate by {changePct.toFixed(0)}% ({current.toFixed(0)} h to{" "}
            {next.toFixed(0)} h). Assignments are percentage allocations, so assigned hours change
            with it.
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
/* Add assignment modal                                                */
/* ------------------------------------------------------------------ */

interface AssignmentModalProps {
  workId: string;
  item: CapacityWorkItem;
  candidates: Candidate[];
  remaining: number;
  onClose: () => void;
  onSaved: (label: string) => Promise<void>;
}

function AssignmentModal({
  workId,
  item,
  candidates,
  remaining,
  onClose,
  onSaved,
}: AssignmentModalProps) {
  const [userId, setUserId] = useState(() => candidates.at(0)?.id ?? "");
  const [allocation, setAllocation] = useState(() =>
    String(Math.round(Math.min(25, remaining) * 100) / 100),
  );
  const [errors, setErrors] = useState<Partial<Record<AssignmentField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allocationValid = numberError(allocation, { min: 0.01 }) === undefined;
  const pct = allocationValid ? Number(allocation) : 0;
  const hours = (item.estimatedEffortHours * pct) / 100;
  const completes = allocationValid && pct <= remaining + 0.005 && pct >= remaining - 0.005;

  function clearError(field: AssignmentField) {
    setErrors((currentErrors) => {
      const next = { ...currentErrors };

      delete next[field];

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<AssignmentField, string>> = {};

    if (!userId) {
      next.member = "Select a team member.";
    }

    const problem = numberError(allocation, { min: 0.01 });

    if (problem) {
      next.allocation = problem;
    } else if (Number(allocation) > remaining + 0.005) {
      next.allocation = `Cannot exceed the remaining ${remaining.toFixed(1)}% allocation.`;
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createCapacityAssignment(workId, {
        userId,
        allocationPct: Number(allocation),
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create capacity assignment.",
      );
      setSaving(false);

      return;
    }

    const member = candidates.find((candidate) => candidate.id === userId);

    await onSaved(`${member ? member.fullName : "Team member"} · ${Number(allocation).toFixed(1)}%`);
  }

  return (
    <Modal
      eyebrow="Resource allocation"
      title="Add assignment"
      description={`${remaining.toFixed(1)}% of ${item.sourceReference} is still unallocated.`}
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
            form="capacity-assignment-form"
            className="button button--primary"
            disabled={saving}
          >
            <Plus size={16} />
            {saving ? "Assigning…" : "Assign"}
          </button>
        </>
      }
    >
      <form id="capacity-assignment-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Team member" htmlFor="capacity-member" error={errors.member}>
              <select
                id="capacity-member"
                className="kit-field-input"
                value={userId}
                aria-invalid={errors.member ? true : undefined}
                onChange={(event) => {
                  setUserId(event.target.value);
                  clearError("member");
                }}
              >
                <option value="">Select member</option>

                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} — {candidate.role}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              Only members with a fiscal-year capacity profile who are not yet assigned are listed.
            </p>
          </div>

          <div className="kit-pair-wide">
            <NumberField
              id="capacity-allocation"
              label="Allocation (%)"
              min={0.01}
              step="0.01"
              value={allocation}
              error={errors.allocation}
              onChange={(value) => {
                setAllocation(value);
                clearError("allocation");
              }}
            />

            <p className="kit-meta-line">Up to {remaining.toFixed(1)}% can still be allocated.</p>
          </div>
        </div>

        {allocationValid && pct <= remaining + 0.005 ? (
          <p className="kit-dialog-note" style={{ marginTop: 14 }}>
            At {pct.toFixed(1)}% that is roughly {hours.toFixed(0)} h of the{" "}
            {item.estimatedEffortHours.toFixed(0)} h estimate.
            {completes ? " This completes the allocation to 100%." : ""}
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

interface WorkData {
  id: string;
  item: CapacityWorkItem;
  dashboard: CapacityPlanningDashboard;
}

export default function CapacityWorkPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);

  const [result, setResult] = useState<WorkData | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeRunning, setRemoveRunning] = useState(false);
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
        const [response, context] = await Promise.all([
          getCapacityWorkEstimate(id),
          getCapacityPlanningDashboard(),
        ]);

        if (active) {
          setResult({ id, item: response, dashboard: context });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load capacity work item.");
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

  function applyItem(updated: CapacityWorkItem) {
    setResult((current) => (current ? { ...current, item: updated } : current));
  }

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getCapacityWorkEstimate(id);

      setResult((current) => (current && current.id === id ? { ...current, item: fresh } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the work item.");
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
        <Link href="/capacity-planning" className="request-back-link">
          <ArrowLeft size={16} />
          Capacity planning
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

  const { item, dashboard } = data;
  const remaining = Math.max(0, 100 - item.allocationPct);
  const fullyAllocated = remaining <= 0.005;
  const overAllocated = item.allocationPct > 100.005;
  const hasAssignments = item.assignments.length > 0;
  const unassigned = item.unassignedEffortHours > 0.005;
  const busyAny = removeRunning;

  const candidates = dashboard.users.filter(
    (candidate) =>
      dashboard.profiles.some((profile) => profile.userId === candidate.id) &&
      !item.assignments.some((assignment) => assignment.userId === candidate.id),
  );

  const canAdd = canManage && !fullyAllocated && candidates.length > 0;
  const addBlocked = fullyAllocated
    ? "The work item is fully allocated"
    : candidates.length === 0
      ? "No eligible team member is available"
      : undefined;
  const removing =
    item.assignments.find((assignment) => String(assignment.id) === removeId) ?? null;

  const orderedAssignments = [...item.assignments].sort(
    (a, b) => b.allocationPct - a.allocationPct,
  );

  async function confirmRemove() {
    if (removing === null) {
      return;
    }

    const label = String(removing.userName);

    setRemoveRunning(true);

    try {
      await deleteCapacityAssignment(removing.id);

      await refresh();

      setRemoveId(null);

      toast.success("Assignment removed", label);
    } catch (caught) {
      setRemoveId(null);

      toast.error(
        "Could not remove the assignment",
        caught instanceof Error ? caught.message : "Unable to remove capacity assignment.",
      );
    } finally {
      setRemoveRunning(false);
    }
  }

  function handleEstimated(updated: CapacityWorkItem, detailText: string) {
    applyItem(updated);
    setEstimating(false);
    toast.success("Estimate updated", detailText);
  }

  async function handleAssigned(label: string) {
    await refresh();

    setAdding(false);

    toast.success("Assignment added", label);
  }

  const kpis: KpiItem[] = [
    {
      label: "Estimated effort",
      icon: Clock,
      value: `${item.estimatedEffortHours.toFixed(0)} h`,
      note: "Demand estimate",
    },
    {
      label: "Allocated",
      icon: Gauge,
      value: `${item.allocationPct.toFixed(1)}%`,
      note: `${remaining.toFixed(1)}% remaining`,
      tone: overAllocated ? "warning" : "default",
    },
    {
      label: "Assigned effort",
      icon: UserCheck,
      value: `${item.assignedEffortHours.toFixed(0)} h`,
      note: "Across the team",
    },
    {
      label: "Unassigned effort",
      icon: Hourglass,
      value: `${item.unassignedEffortHours.toFixed(0)} h`,
      note: "Still without an owner",
      tone: unassigned ? "warning" : "default",
    },
    {
      label: "Risk score",
      icon: ShieldAlert,
      value: item.riskScore.toFixed(1),
      note: "Planning risk",
    },
    {
      label: "Assignments",
      icon: Users,
      value: String(item.assignments.length),
      note: "Team members on the work",
    },
  ];

  const assignmentColumns = buildAssignmentColumns({
    canRemove: canManage,
    busy: busyAny,
    onRemove: (assignment) => setRemoveId(String(assignment.id)),
  });

  return (
    <div className="page-stack">
      <Link href="/capacity-planning" className="request-back-link">
        <ArrowLeft size={16} />
        Capacity planning
      </Link>

      <section className="capacity-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{item.sourceReference}</span>

            <StatusBadge
              value={String(item.planningStatus)}
              label={readable(String(item.planningStatus))}
            />
          </div>

          <span className="eyebrow">Strategic work capacity</span>

          <h1>{item.sourceTitle}</h1>

          <p>
            {readable(String(item.sourceType))}
            {" · "}
            {readable(String(item.sourceStatus))}
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

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setEstimating(true)}
            >
              <Pencil size={15} />
              Update estimate
            </button>
          ) : null}

          {canManage ? (
            <button
              type="button"
              className={`button ${hasAssignments ? "button--secondary" : "button--primary"}`}
              disabled={busyAny || !canAdd}
              title={addBlocked}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add assignment
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

      {overAllocated ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The work item is over-allocated.</strong> Assignments total{" "}
            {item.allocationPct.toFixed(1)}%, above the 100% limit.
          </div>
        </div>
      ) : null}

      {canManage && !fullyAllocated && candidates.length === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No eligible team member is left to assign.</strong> Members need a fiscal-year
            capacity profile before they can receive strategic work, and each member can be
            assigned once.
          </div>
        </div>
      ) : null}

      {!hasAssignments && canManage && candidates.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: assign the first team member.</strong> This strategic work item has
            no team allocation yet.
          </div>
        </div>
      ) : null}

      {!hasAssignments && !canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No team allocation yet.</strong> A buyer or manager needs to assign team
            members to this work item.
          </div>
        </div>
      ) : null}

      {hasAssignments && !fullyAllocated && !overAllocated ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{item.allocationPct.toFixed(1)}% is allocated.</strong>{" "}
            {remaining.toFixed(1)}% ({item.unassignedEffortHours.toFixed(0)} h) remains
            unassigned.
          </div>
        </div>
      ) : null}

      {hasAssignments && fullyAllocated && !overAllocated ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The work item is fully allocated.</strong> Remove an assignment to free up
            capacity for someone else.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Capacity summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Allocation of the estimate</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={item.allocationPct}
          tone={fullyAllocated ? meterToneFor("success") : "primary"}
          caption={`${item.allocationPct.toFixed(1)}% allocated — ${item.assignedEffortHours.toFixed(0)} h of ${item.estimatedEffortHours.toFixed(0)} h`}
          label="Allocation of the effort estimate"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Resource ownership</span>

            <h2>Assignments</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny || !canAdd}
              title={addBlocked}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add assignment
            </button>
          ) : (
            <Gauge size={19} />
          )}
        </div>

        <DataTable
          columns={assignmentColumns}
          rows={orderedAssignments}
          getRowId={(assignment) => String(assignment.id)}
          ariaLabel="Work item assignments"
          busy={fetching}
          empty={
            <EmptyState
              icon={Users}
              title="No assignments"
              description="This strategic work item has no team allocation yet."
              action={
                canAdd ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add assignment
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="capacity-method-note">
        <Gauge size={18} />

        <div>
          <strong>Allocation authority</strong>

          <p>
            Assignment percentages cannot exceed 100% for a work item. Team members must have a
            fiscal-year capacity profile before receiving strategic work.
          </p>
        </div>
      </section>

      {estimating ? (
        <EstimateModal
          workId={params.id}
          item={item}
          onClose={() => setEstimating(false)}
          onSaved={handleEstimated}
        />
      ) : null}

      {adding ? (
        <AssignmentModal
          workId={params.id}
          item={item}
          candidates={candidates}
          remaining={remaining}
          onClose={() => setAdding(false)}
          onSaved={handleAssigned}
        />
      ) : null}

      {removing !== null ? (
        <ActionDialog
          eyebrow="Resource allocation"
          title="Remove this assignment?"
          description={`${removing.userName} (${removing.allocationPct.toFixed(1)}% · ${removing.assignedEffortHours.toFixed(0)} h) will be removed from ${item.sourceReference}, leaving ${(item.unassignedEffortHours + removing.assignedEffortHours).toFixed(0)} h unassigned. ${plural(item.assignments.length - 1, "assignment", "assignments")} will remain.`}
          confirmLabel="Remove assignment"
          busyLabel="Removing…"
          cancelLabel="Keep assignment"
          busy={removeRunning}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoveId(null)}
        />
      ) : null}
    </div>
  );
}
