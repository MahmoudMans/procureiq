"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CircleAlert,
  Gauge,
  Info,
  ListChecks,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
  createWorkCapabilityRequirement,
  deleteWorkCapabilityRequirement,
  getCapabilityPlanningDashboard,
  getCapabilityWorkItem,
} from "@/lib/api";
import type {
  CapabilityPlanningDashboard,
  CapabilitySourceType,
  CapabilityWorkItem,
} from "@/types/capability-planning";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Requirement = CapabilityWorkItem["requirements"][number];
type Skill = CapabilityPlanningDashboard["skills"][number];
type RequirementField = "skill" | "level" | "weight";

interface RequirementPayload {
  skillId: string;
  requiredProficiency: number;
  importanceWeightPct: number;
}

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

interface RequirementColumnOptions {
  canRemove: boolean;
  busy: boolean;
  onRemove: (requirement: Requirement) => void;
}

function buildRequirementColumns(options: RequirementColumnOptions): Column<Requirement>[] {
  return [
    {
      id: "skill",
      header: "Skill",
      sortValue: (item) => String(item.skillCode).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.skillCode}</strong>

          <small>{item.skillName}</small>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortValue: (item) => String(item.skillCategory ?? "").toLowerCase(),
      cell: (item) => item.skillCategory ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "level",
      header: "Required level",
      align: "right",
      sortValue: (item) => item.requiredProficiency,
      cell: (item) => <strong>L{item.requiredProficiency}</strong>,
    },
    {
      id: "weight",
      header: "Importance weight",
      align: "right",
      sortValue: (item) => item.importanceWeightPct,
      cell: (item) => `${item.importanceWeightPct.toFixed(1)}%`,
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
/* Add requirement modal                                               */
/* ------------------------------------------------------------------ */

interface RequirementModalProps {
  skills: Skill[];
  existingWeight: number;
  onClose: () => void;
  onSubmit: (payload: RequirementPayload) => Promise<CapabilityWorkItem>;
  onSaved: (updated: CapabilityWorkItem, label: string) => void;
}

function RequirementModal({
  skills,
  existingWeight,
  onClose,
  onSubmit,
  onSaved,
}: RequirementModalProps) {
  const [skillId, setSkillId] = useState(() => skills.at(0)?.id ?? "");
  const [level, setLevel] = useState("3");
  const [weight, setWeight] = useState("25");
  const [errors, setErrors] = useState<Partial<Record<RequirementField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weightValid = numberError(weight, { min: 0.01 }) === undefined && Number(weight) <= 100;
  const combined = existingWeight + (weightValid ? Number(weight) : 0);
  const overweight = weightValid && combined > 100.005;

  function clearError(field: RequirementField) {
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

    const next: Partial<Record<RequirementField, string>> = {};

    if (!skillId) {
      next.skill = "Select a skill requirement.";
    }

    const levelProblem = numberError(level, { min: 1 });

    if (levelProblem) {
      next.level = levelProblem;
    } else if (!Number.isInteger(Number(level)) || Number(level) > 5) {
      next.level = "Enter a whole level from 1 to 5.";
    }

    const weightProblem = numberError(weight, { min: 0.01 });

    if (weightProblem) {
      next.weight = weightProblem;
    } else if (Number(weight) > 100) {
      next.weight = "The weight cannot exceed 100%.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await onSubmit({
        skillId,
        requiredProficiency: Number(level),
        importanceWeightPct: Number(weight),
      });

      const skill = skills.find((candidate) => candidate.id === skillId);

      onSaved(updated, skill ? `${skill.code} — ${skill.name}` : "Skill requirement");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create work capability requirement.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Requirement governance"
      title="Add required skill"
      description="Each requirement names a skill, the proficiency level it needs and its importance weight."
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
            form="capability-requirement-form"
            className="button button--primary"
            disabled={saving}
          >
            <Plus size={16} />
            {saving ? "Adding…" : "Add requirement"}
          </button>
        </>
      }
    >
      <form id="capability-requirement-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Skill" htmlFor="capability-skill" error={errors.skill}>
              <select
                id="capability-skill"
                className="kit-field-input"
                value={skillId}
                aria-invalid={errors.skill ? true : undefined}
                onChange={(event) => {
                  setSkillId(event.target.value);
                  clearError("skill");
                }}
              >
                <option value="">Select skill</option>

                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.code} — {skill.name}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              Only skills without a requirement on this work item are listed.
            </p>
          </div>

          <NumberField
            id="capability-level"
            label="Required level (1–5)"
            min={1}
            step="1"
            value={level}
            error={errors.level}
            onChange={(value) => {
              setLevel(value);
              clearError("level");
            }}
          />

          <div>
            <NumberField
              id="capability-weight"
              label="Importance weight (%)"
              min={0.01}
              step="0.01"
              value={weight}
              error={errors.weight}
              onChange={(value) => {
                setWeight(value);
                clearError("weight");
              }}
            />

            {existingWeight > 0 ? (
              <p className="kit-meta-line">
                Existing requirements carry {existingWeight.toFixed(1)}%.
              </p>
            ) : null}
          </div>
        </div>

        {overweight ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            Together with the existing requirements, the importance weights would total{" "}
            {combined.toFixed(1)}%, which is above 100%.
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
  key: string;
  item: CapabilityWorkItem;
  dashboard: CapabilityPlanningDashboard;
}

export default function CapabilityWorkPage() {
  const params = useParams<{
    sourceType: string;
    sourceEntityId: string;
  }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();

  const currency = (searchParams.get("currency") ?? "EUR").toUpperCase();
  const fiscalYear = Number(searchParams.get("fiscalYear") ?? new Date().getUTCFullYear());
  const sourceType = params.sourceType as CapabilitySourceType;
  const dataKey = `${sourceType}|${params.sourceEntityId}|${currency}|${fiscalYear}`;

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);

  const [result, setResult] = useState<WorkData | null>(null);
  const [adding, setAdding] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeRunning, setRemoveRunning] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const entityId = params.sourceEntityId;
    const key = `${sourceType}|${entityId}|${currency}|${fiscalYear}`;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const [work, context] = await Promise.all([
          getCapabilityWorkItem(currency, fiscalYear, sourceType, entityId),
          getCapabilityPlanningDashboard(currency, fiscalYear),
        ]);

        if (active) {
          setResult({ key, item: work, dashboard: context });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load capability requirements.",
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
  }, [currency, fiscalYear, params.sourceEntityId, sourceType, reloadKey]);

  const data = result !== null && result.key === dataKey ? result : null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyItem(updated: CapabilityWorkItem) {
    setResult((current) =>
      current && current.key === dataKey ? { ...current, item: updated } : current,
    );
  }

  async function refresh() {
    try {
      const fresh = await getCapabilityWorkItem(
        currency,
        fiscalYear,
        sourceType,
        params.sourceEntityId,
      );

      applyItem(fresh);
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
        <Link href="/capability-planning" className="request-back-link">
          <ArrowLeft size={16} />
          Capability planning
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
  const requirements = item.requirements;
  const hasRequirements = requirements.length > 0;
  const totalWeight = requirements.reduce(
    (sum, requirement) => sum + requirement.importanceWeightPct,
    0,
  );
  const availableSkills = dashboard.skills.filter(
    (skill) => !requirements.some((requirement) => requirement.skillId === skill.id),
  );
  const canAdd = canManage && availableSkills.length > 0;
  const removing = requirements.find((requirement) => String(requirement.id) === removeId) ?? null;
  const critical = item.criticalGapCount > 0;
  const busyAny = removeRunning;

  const orderedRequirements = [...requirements].sort(
    (a, b) => b.importanceWeightPct - a.importanceWeightPct,
  );

  async function confirmRemove() {
    if (removing === null) {
      return;
    }

    const label = `${removing.skillCode} — ${removing.skillName}`;

    setRemoveRunning(true);

    try {
      await deleteWorkCapabilityRequirement(removing.id);

      await refresh();

      setRemoveId(null);

      toast.success("Requirement removed", label);
    } catch (caught) {
      setRemoveId(null);

      toast.error(
        "Could not remove the requirement",
        caught instanceof Error ? caught.message : "Unable to remove capability requirement.",
      );
    } finally {
      setRemoveRunning(false);
    }
  }

  function handleSaved(updated: CapabilityWorkItem, label: string) {
    applyItem(updated);
    setAdding(false);
    toast.success("Requirement added", label);
  }

  const kpis: KpiItem[] = [
    {
      label: "Requirements",
      icon: ListChecks,
      value: String(item.requirementCount),
      note: `${totalWeight.toFixed(1)}% total weight`,
    },
    {
      label: "Assigned members",
      icon: Users,
      value: String(item.assignedMemberCount),
      note: "Currently assigned in Step 47",
    },
    {
      label: "Assigned fit",
      icon: Gauge,
      value: hasRequirements ? `${item.assignedFitPct.toFixed(1)}%` : "—",
      note: "Recorded assessments only",
    },
    {
      label: "Bench fit",
      icon: Target,
      value: hasRequirements ? `${item.benchFitPct.toFixed(1)}%` : "—",
      note: "Assessed members with profiles",
    },
    {
      label: "Bench-ready members",
      icon: UserCheck,
      value: String(item.benchReadyMemberCount),
      note: "Ready to be assigned",
    },
    {
      label: "Critical gaps",
      icon: ShieldAlert,
      value: String(item.criticalGapCount),
      note: "Flagged for attention",
      tone: critical ? "warning" : "default",
    },
  ];

  const requirementColumns = buildRequirementColumns({
    canRemove: canManage,
    busy: busyAny,
    onRemove: (requirement) => setRemoveId(String(requirement.id)),
  });

  return (
    <div className="page-stack">
      <Link href="/capability-planning" className="request-back-link">
        <ArrowLeft size={16} />
        Capability planning
      </Link>

      <section className="capability-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{item.sourceReference}</span>

            <StatusBadge value={String(item.readiness)} label={readable(String(item.readiness))} />
          </div>

          <span className="eyebrow">Strategic work suitability</span>

          <h1>{item.sourceTitle}</h1>

          <p>
            {readable(String(item.sourceType))}
            {" · "}
            {readable(String(item.sourceStatus))}
            {" · FY "}
            {fiscalYear}
            {" · "}
            {currency}
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
              className={`button ${hasRequirements ? "button--secondary" : "button--primary"}`}
              disabled={busyAny || !canAdd}
              title={
                availableSkills.length === 0
                  ? "Every skill already has a requirement on this work item"
                  : undefined
              }
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add requirement
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

      {critical ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(item.criticalGapCount, "critical gap is", "critical gaps are")} flagged.
            </strong>{" "}
            Review the assessments for the skills below against their required levels.
          </div>
        </div>
      ) : null}

      {!hasRequirements && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Define the first skill requirement.</strong> Suitability is measured against
            the governed requirements, so there is nothing to assess until at least one exists.
          </div>
        </div>
      ) : null}

      {!hasRequirements && !canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No skill requirements are defined yet.</strong> A buyer or manager needs to
            define them before suitability can be assessed.
          </div>
        </div>
      ) : null}

      {hasRequirements && item.assignedMemberCount === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No members are assigned to this work item.</strong> Assigned fit cannot be
            measured until people are assigned in capacity planning.
          </div>
        </div>
      ) : null}

      {canManage && hasRequirements && availableSkills.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Every skill already has a requirement.</strong> Remove one to replace it with a
            different level or weight.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Capability summary" />

      {hasRequirements ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Suitability against the requirements</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={item.assignedFitPct}
            tone={item.assignedFitPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Assigned fit ${item.assignedFitPct.toFixed(1)}% across ${plural(item.assignedMemberCount, "assigned member", "assigned members")}`}
            label="Assigned fit"
          />

          <ProgressLine
            pct={item.benchFitPct}
            tone={item.benchFitPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Bench fit ${item.benchFitPct.toFixed(1)}% with ${plural(item.benchReadyMemberCount, "bench-ready member", "bench-ready members")}`}
            label="Bench fit"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Capability specification</span>

            <h2>Skill requirements</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny || !canAdd}
              title={
                availableSkills.length === 0
                  ? "Every skill already has a requirement on this work item"
                  : undefined
              }
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add requirement
            </button>
          ) : (
            <BrainCircuit size={19} />
          )}
        </div>

        {hasRequirements ? (
          <p className="kit-meta-line">
            {plural(requirements.length, "requirement", "requirements")} carrying{" "}
            {totalWeight.toFixed(1)}% of the importance weight.
          </p>
        ) : null}

        <DataTable
          columns={requirementColumns}
          rows={orderedRequirements}
          getRowId={(requirement) => String(requirement.id)}
          ariaLabel="Skill requirements"
          busy={fetching}
          empty={
            <EmptyState
              icon={BrainCircuit}
              title="No skill requirements"
              description="No governed skill requirements are defined for this work item."
              action={
                canAdd ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add requirement
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="capability-method-note">
        <BrainCircuit size={18} />

        <div>
          <strong>Suitability is evidence-based</strong>

          <p>
            Assigned fit uses only recorded assessments for the people currently assigned in Step
            47. Bench fit uses assessed members with capacity profiles. Missing assessments count
            as zero; skills are never inferred.
          </p>
        </div>
      </section>

      {adding ? (
        <RequirementModal
          skills={availableSkills}
          existingWeight={totalWeight}
          onClose={() => setAdding(false)}
          onSubmit={(payload) =>
            createWorkCapabilityRequirement(
              currency,
              fiscalYear,
              sourceType,
              params.sourceEntityId,
              payload,
            )
          }
          onSaved={handleSaved}
        />
      ) : null}

      {removing !== null ? (
        <ActionDialog
          eyebrow="Requirement governance"
          title="Remove this requirement?"
          description={`${removing.skillCode} — ${removing.skillName} (required level L${removing.requiredProficiency}, weight ${removing.importanceWeightPct.toFixed(1)}%) will be removed from ${item.sourceReference}. Fit and gap figures are recalculated without it.`}
          confirmLabel="Remove requirement"
          busyLabel="Removing…"
          cancelLabel="Keep requirement"
          busy={removeRunning}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoveId(null)}
        />
      ) : null}
    </div>
  );
}
