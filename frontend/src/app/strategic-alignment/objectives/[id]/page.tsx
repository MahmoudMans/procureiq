"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  Gauge,
  Info,
  Link2,
  ListChecks,
  Percent,
  Plus,
  RefreshCw,
  Target,
  Trash2,
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
  createStrategicAlignmentLink,
  deleteStrategicAlignmentLink,
  getObjectiveAlignment,
} from "@/lib/api";
import type {
  AlignmentRole,
  AlignmentSourceType,
  ObjectiveAlignmentDetail,
} from "@/types/strategic-alignment";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type AlignmentLink = ObjectiveAlignmentDetail["links"][number];
type Candidate = ObjectiveAlignmentDetail["candidateSources"][number];
type AlignField = "entity" | "allocation" | "rationale";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const SOURCE_TYPES: Array<{ value: AlignmentSourceType; label: string }> = [
  { value: "CATEGORY_INITIATIVE", label: "Category / sourcing initiative" },
  { value: "IMPROVEMENT_INITIATIVE", label: "Improvement initiative" },
  { value: "EXECUTION_PORTFOLIO", label: "Benefits execution portfolio" },
  { value: "RISK_ESCALATION", label: "Supplier-risk escalation" },
];

const ROLES: Array<{ value: AlignmentRole; label: string }> = [
  { value: "PRIMARY", label: "Primary" },
  { value: "ENABLER", label: "Enabler" },
  { value: "VALUE_DELIVERY", label: "Value delivery" },
  { value: "RISK_MITIGATION", label: "Risk mitigation" },
];

const FALLBACK_TYPE: AlignmentSourceType = "CATEGORY_INITIATIVE";

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

interface LinkColumnOptions {
  canRemove: boolean;
  busy: boolean;
  onRemove: (link: AlignmentLink) => void;
}

function buildLinkColumns(options: LinkColumnOptions): Column<AlignmentLink>[] {
  return [
    {
      id: "work",
      header: "Work item",
      sortValue: (item) => String(item.sourceTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.sourceTitle}</strong>

          <small>{item.sourceReference}</small>
        </div>
      ),
    },
    {
      id: "type",
      header: "Source type",
      sortValue: (item) => String(item.sourceType),
      cell: (item) => readable(String(item.sourceType)),
    },
    {
      id: "role",
      header: "Role",
      sortValue: (item) => String(item.alignmentRole),
      cell: (item) => (
        <StatusBadge
          value={String(item.alignmentRole)}
          label={readable(String(item.alignmentRole))}
        />
      ),
    },
    {
      id: "allocation",
      header: "Allocation",
      align: "right",
      sortValue: (item) => item.allocationPct,
      cell: (item) => <strong>{item.allocationPct.toFixed(1)}%</strong>,
    },
    {
      id: "rationale",
      header: "Strategic rationale",
      cell: (item) => <span>{item.rationale}</span>,
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
/* Align work item modal                                               */
/* ------------------------------------------------------------------ */

interface AlignModalProps {
  objectiveId: string;
  objectiveNumber: string;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (label: string) => Promise<void>;
}

function AlignModal({
  objectiveId,
  objectiveNumber,
  candidates,
  onClose,
  onSaved,
}: AlignModalProps) {
  const initialType =
    SOURCE_TYPES.find((type) => candidates.some((source) => source.sourceType === type.value))
      ?.value ?? FALLBACK_TYPE;

  const [sourceType, setSourceType] = useState<AlignmentSourceType>(initialType);
  const [entityId, setEntityId] = useState(
    () =>
      candidates.find((source) => source.sourceType === initialType)?.sourceEntityId ?? "",
  );
  const [role, setRole] = useState<AlignmentRole>("PRIMARY");
  const [allocation, setAllocation] = useState("100");
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AlignField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const typeCandidates = candidates.filter((source) => source.sourceType === sourceType);
  const selected = typeCandidates.find((source) => source.sourceEntityId === entityId) ?? null;
  const allocationValid =
    numberError(allocation, { min: 0.01 }) === undefined && Number(allocation) <= 100;
  const combined =
    selected !== null && allocationValid ? selected.directAllocationPct + Number(allocation) : 0;
  const overAllocated = selected !== null && allocationValid && combined > 100.005;

  function clearError(field: AlignField) {
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

    const next: Partial<Record<AlignField, string>> = {};

    if (!entityId || selected === null) {
      next.entity = "Select a work item to align.";
    }

    const problem = numberError(allocation, { min: 0.01 });

    if (problem) {
      next.allocation = problem;
    } else if (Number(allocation) > 100) {
      next.allocation = "The allocation cannot exceed 100%.";
    }

    if (!rationale.trim()) {
      next.rationale = "Explain why this work supports the objective.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    const label = selected ? `${selected.sourceReference} — ${selected.sourceTitle}` : "Work item";

    setSaving(true);
    setError(null);

    try {
      await createStrategicAlignmentLink(objectiveId, {
        sourceType,
        sourceEntityId: entityId,
        alignmentRole: role,
        allocationPct: Number(allocation),
        rationale: rationale.trim(),
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create strategic alignment.",
      );
      setSaving(false);

      return;
    }

    await onSaved(label);
  }

  return (
    <Modal
      eyebrow="Strategy-to-execution link"
      title="Align work item"
      description={`Link a work item to ${objectiveNumber} and say how much of it supports the objective.`}
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
            form="alignment-link-form"
            className="button button--primary"
            disabled={saving}
          >
            <Plus size={16} />
            {saving ? "Aligning…" : "Align work item"}
          </button>
        </>
      }
    >
      <form id="alignment-link-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Source type" htmlFor="alignment-source-type">
            <select
              id="alignment-source-type"
              className="kit-field-input"
              value={sourceType}
              onChange={(event) => {
                const value = event.target.value as AlignmentSourceType;

                setSourceType(value);
                setEntityId(
                  candidates.find((source) => source.sourceType === value)?.sourceEntityId ?? "",
                );
                clearError("entity");
              }}
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Alignment role" htmlFor="alignment-role">
            <select
              id="alignment-role"
              className="kit-field-input"
              value={role}
              onChange={(event) => setRole(event.target.value as AlignmentRole)}
            >
              {ROLES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="kit-pair-wide">
            <Field label="Work item" htmlFor="alignment-entity" error={errors.entity}>
              <select
                id="alignment-entity"
                className="kit-field-input"
                value={entityId}
                aria-invalid={errors.entity ? true : undefined}
                onChange={(event) => {
                  setEntityId(event.target.value);
                  clearError("entity");
                }}
              >
                <option value="">Select work item</option>

                {typeCandidates.map((source) => (
                  <option key={source.sourceEntityId} value={source.sourceEntityId}>
                    {source.sourceReference} — {source.sourceTitle} ·{" "}
                    {source.directAllocationPct.toFixed(0)}% already allocated
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              {typeCandidates.length === 0
                ? "No unlinked work items of this type are available."
                : "Only work items not yet linked to this objective are listed."}
            </p>
          </div>

          <div className="kit-pair-wide">
            <NumberField
              id="alignment-allocation"
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
          </div>

          <div className="kit-pair-wide">
            <Field label="Strategic rationale" htmlFor="alignment-rationale" error={errors.rationale}>
              <textarea
                id="alignment-rationale"
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

        {overAllocated && selected !== null ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            Together with the {selected.directAllocationPct.toFixed(0)}% already allocated, this
            would bring the work item to {combined.toFixed(0)}%, which is above 100%.
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

interface AlignmentData {
  id: string;
  detail: ObjectiveAlignmentDetail;
}

export default function ObjectiveAlignmentPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);

  const [result, setResult] = useState<AlignmentData | null>(null);
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
        const response = await getObjectiveAlignment(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load objective alignment.",
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

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getObjectiveAlignment(id);

      setResult((current) => (current && current.id === id ? { ...current, detail: fresh } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the objective.");
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
        <Link href="/strategic-alignment" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic alignment
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

  const { objective, links } = detail;
  const unlinked = detail.candidateSources.filter(
    (source) =>
      !links.some(
        (link) =>
          link.sourceType === source.sourceType &&
          link.sourceEntityId === source.sourceEntityId,
      ),
  );
  const hasLinks = links.length > 0;
  const canAdd = canManage && unlinked.length > 0;
  const addBlocked =
    unlinked.length === 0 ? "Every available work item is already linked" : undefined;
  const conflicts = objective.deadlineConflictCount;
  const averageAllocation = hasLinks
    ? links.reduce((sum, link) => sum + link.allocationPct, 0) / links.length
    : null;
  const removing = links.find((link) => String(link.id) === removeId) ?? null;
  const busyAny = removeRunning;

  const orderedLinks = [...links].sort((a, b) => b.allocationPct - a.allocationPct);

  async function confirmRemove() {
    if (removing === null) {
      return;
    }

    const label = `${removing.sourceReference} — ${removing.sourceTitle}`;

    setRemoveRunning(true);

    try {
      await deleteStrategicAlignmentLink(removing.id);

      await refresh();

      setRemoveId(null);

      toast.success("Alignment removed", label);
    } catch (caught) {
      setRemoveId(null);

      toast.error(
        "Could not remove the alignment",
        caught instanceof Error ? caught.message : "Unable to remove strategic alignment.",
      );
    } finally {
      setRemoveRunning(false);
    }
  }

  async function handleAligned(label: string) {
    await refresh();

    setAdding(false);

    toast.success("Work item aligned", label);
  }

  const kpis: KpiItem[] = [
    {
      label: "Linked work",
      icon: Link2,
      value: String(objective.linkedSourceCount),
      note: "Strategic work items",
    },
    {
      label: "OKR progress",
      icon: Gauge,
      value: `${objective.okrProgressPct.toFixed(1)}%`,
      note: "Across the key results",
    },
    {
      label: "OKR health",
      icon: Target,
      value: readable(String(objective.okrHealth)),
      note: "Current objective health",
    },
    {
      label: "Deadline conflicts",
      icon: CalendarClock,
      value: String(conflicts),
      note: "Linked work against the objective",
      tone: conflicts > 0 ? "warning" : "default",
    },
    {
      label: "Available work",
      icon: ListChecks,
      value: String(unlinked.length),
      note: "Not yet linked",
    },
    {
      label: "Average allocation",
      icon: Percent,
      value: averageAllocation === null ? "—" : `${averageAllocation.toFixed(1)}%`,
      note: "Across the linked work",
    },
  ];

  const linkColumns = buildLinkColumns({
    canRemove: canManage,
    busy: busyAny,
    onRemove: (link) => setRemoveId(String(link.id)),
  });

  return (
    <div className="page-stack">
      <Link href="/strategic-alignment" className="request-back-link">
        <ArrowLeft size={16} />
        Strategic alignment
      </Link>

      <section className="alignment-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{objective.objectiveNumber}</span>

            <StatusBadge
              value={String(objective.okrHealth)}
              label={readable(String(objective.okrHealth))}
            />
          </div>

          <span className="eyebrow">Objective execution map</span>

          <h1>{objective.title}</h1>

          <p>
            {objective.ownerName}
            {" · OKR "}
            {objective.okrProgressPct.toFixed(1)}%
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
              className={`button ${hasLinks ? "button--secondary" : "button--primary"}`}
              disabled={busyAny || !canAdd}
              title={addBlocked}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Align work item
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

      {conflicts > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(conflicts, "deadline conflict is", "deadline conflicts are")} flagged.
            </strong>{" "}
            Review the linked work against the objective&apos;s timing.
          </div>
        </div>
      ) : null}

      {!hasLinks && canManage && unlinked.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: link the first work item.</strong> No strategic work has been linked
            to this objective yet.
          </div>
        </div>
      ) : null}

      {!hasLinks && canManage && unlinked.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No work item is available to link.</strong> No strategic work has been linked
            to this objective, and there are no candidate work items yet.
          </div>
        </div>
      ) : null}

      {!hasLinks && !canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No strategic work is linked yet.</strong> A buyer or manager needs to link work
            items to this objective.
          </div>
        </div>
      ) : null}

      {hasLinks && canManage && unlinked.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Every available work item is already linked.</strong> Remove a link to realign
            it with a different role or allocation.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Objective summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Objective delivery</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={objective.okrProgressPct}
          tone={objective.okrProgressPct >= 100 ? meterToneFor("success") : "primary"}
          caption={`OKR progress ${objective.okrProgressPct.toFixed(1)}% — ${readable(String(objective.okrHealth))}`}
          label="OKR progress"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Existing commitments</span>

            <h2>Linked strategic work</h2>
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
              Align work item
            </button>
          ) : (
            <Link2 size={19} />
          )}
        </div>

        <DataTable
          columns={linkColumns}
          rows={orderedLinks}
          getRowId={(link) => String(link.id)}
          ariaLabel="Linked strategic work"
          busy={fetching}
          empty={
            <EmptyState
              icon={Link2}
              title="No linked work"
              description="No strategic work has been linked to this objective."
              action={
                canAdd ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Align work item
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {adding ? (
        <AlignModal
          objectiveId={params.id}
          objectiveNumber={objective.objectiveNumber}
          candidates={unlinked}
          onClose={() => setAdding(false)}
          onSaved={handleAligned}
        />
      ) : null}

      {removing !== null ? (
        <ActionDialog
          eyebrow="Strategy-to-execution link"
          title="Remove this alignment?"
          description={`${removing.sourceReference} — ${removing.sourceTitle} (${readable(String(removing.alignmentRole))}, ${removing.allocationPct.toFixed(1)}%) will no longer be linked to ${objective.objectiveNumber}. The work item itself is not deleted.`}
          confirmLabel="Remove alignment"
          busyLabel="Removing…"
          cancelLabel="Keep alignment"
          busy={removeRunning}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoveId(null)}
        />
      ) : null}
    </div>
  );
}
