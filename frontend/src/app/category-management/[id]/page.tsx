"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  Flag,
  Info,
  Layers3,
  Play,
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
  Modal,
  SegmentedFilter,
  type SegmentedOption,
  Skeleton,
  type StatItem,
  StatStrip,
  StatusBadge,
  formatDate,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  cancelCategoryInitiative,
  cancelCategoryMilestone,
  completeCategoryInitiative,
  completeCategoryMilestone,
  createCategoryInitiative,
  createCategoryMilestone,
  getCategoryManagementContext,
  getCategoryStrategy,
  readyCategoryInitiative,
  startCategoryInitiative,
  updateCategoryStrategyStatus,
} from "@/lib/api";
import type {
  CategoryContext,
  CategoryInitiative,
  CategoryInitiativePriority,
  CategoryInitiativeType,
  CategoryStrategyDetail,
} from "@/types/category-management";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Strategy = CategoryStrategyDetail["strategy"];
type Milestone = CategoryInitiative["milestones"][number];
type Supplier = CategoryStrategyDetail["supplierLandscape"][number];
type CatUser = CategoryContext["users"][number];
type StrategyTarget = "ACTIVE" | "ON_HOLD" | "CLOSED" | "ARCHIVED";
type InitiativeProgress = "READY" | "START";
type InitiativeField = "title" | "estimated" | "target" | "dates";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const CANCEL_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: CatUser[] = [];

const INITIATIVE_TYPES: { value: CategoryInitiativeType; label: string }[] = [
  { value: "SOURCING_WAVE", label: "Sourcing wave" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "CONSOLIDATION", label: "Consolidation" },
  { value: "SUPPLIER_DIVERSIFICATION", label: "Supplier diversification" },
  { value: "DEMAND_MANAGEMENT", label: "Demand management" },
  { value: "CONTRACT_RENEWAL", label: "Contract renewal" },
  { value: "RISK_MITIGATION", label: "Risk mitigation" },
  { value: "OTHER", label: "Other" },
];

const PRIORITIES: { value: CategoryInitiativePriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isLive(initiative: CategoryInitiative): boolean {
  return initiative.status !== "COMPLETED" && initiative.status !== "CANCELLED";
}

function isActiveStatus(initiative: CategoryInitiative): boolean {
  return (
    initiative.status === "PLANNED" ||
    initiative.status === "READY" ||
    initiative.status === "IN_PROGRESS"
  );
}

function shareTone(share: number) {
  if (share >= 60) {
    return meterToneFor("danger");
  }

  if (share >= 40) {
    return meterToneFor("warning");
  }

  return "primary" as const;
}

function riskTone(score: number) {
  return meterToneFor(score >= 60 ? "danger" : score >= 40 ? "warning" : "success");
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

interface StrategyCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

function strategyCopy(target: StrategyTarget, current: string): StrategyCopy {
  switch (target) {
    case "ACTIVE":
      return current === "ON_HOLD"
        ? {
            eyebrow: "Resume strategy",
            title: "Resume this strategy?",
            confirm: "Resume strategy",
            busy: "Resuming…",
            keep: "Keep on hold",
            done: "Strategy resumed",
            failed: "Could not resume the strategy",
          }
        : {
            eyebrow: "Activate strategy",
            title: "Activate this strategy?",
            confirm: "Activate strategy",
            busy: "Activating…",
            keep: "Not yet",
            done: "Strategy activated",
            failed: "Could not activate the strategy",
          };

    case "ON_HOLD":
      return {
        eyebrow: "Put on hold",
        title: "Put this strategy on hold?",
        confirm: "Put on hold",
        busy: "Updating…",
        keep: "Keep active",
        done: "Strategy put on hold",
        failed: "Could not put the strategy on hold",
      };

    case "CLOSED":
      return {
        eyebrow: "Close strategy",
        title: "Close this strategy?",
        confirm: "Close strategy",
        busy: "Closing…",
        keep: "Keep open",
        done: "Strategy closed",
        failed: "Could not close the strategy",
      };

    case "ARCHIVED":
      return {
        eyebrow: "Archive strategy",
        title: "Archive this strategy?",
        confirm: "Archive",
        busy: "Archiving…",
        keep: "Not yet",
        done: "Strategy archived",
        failed: "Could not archive the strategy",
      };
  }
}

function strategyDescription(
  target: StrategyTarget,
  strategy: Strategy,
  liveInitiatives: number,
): string {
  const name = `${strategy.strategyCode} (${strategy.categoryName})`;

  switch (target) {
    case "ACTIVE":
      return `${name} will be set to active.`;

    case "ON_HOLD":
      return `${name} will be put on hold. You can resume it later.`;

    case "CLOSED":
      return liveInitiatives > 0
        ? `${name} will be closed. ${liveInitiatives} ${liveInitiatives === 1 ? "initiative is" : "initiatives are"} still open and can no longer be changed once it is closed.`
        : `${name} will be closed and can no longer be edited.`;

    case "ARCHIVED":
      return `${name} will be archived.`;
  }
}

/* ------------------------------------------------------------------ */
/* Supplier landscape columns                                          */
/* ------------------------------------------------------------------ */

function buildSupplierColumns(currency: string): Column<Supplier>[] {
  return [
    {
      id: "supplier",
      header: "Supplier",
      sortValue: (supplier) => supplier.supplierName.toLowerCase(),
      cell: (supplier) => (
        <div className="request-primary-cell">
          <strong>{supplier.supplierName}</strong>

          <span>{supplier.supplierCode}</span>
        </div>
      ),
    },
    {
      id: "country",
      header: "Country",
      sortValue: (supplier) => (supplier.country ?? "").toLowerCase(),
      cell: (supplier) => supplier.country ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "spend",
      header: "Spend",
      align: "right",
      sortValue: (supplier) => supplier.spend,
      cell: (supplier) => money(supplier.spend, currency),
    },
    {
      id: "share",
      header: "Share",
      width: 150,
      sortValue: (supplier) => supplier.spendShare,
      cell: (supplier) => (
        <div className="kit-cell-stack">
          <span>{supplier.spendShare.toFixed(1)}%</span>

          <Meter
            value={clampPercent(supplier.spendShare)}
            max={100}
            tone={shareTone(supplier.spendShare)}
            ariaLabel={`${supplier.supplierName} share of spend`}
          />
        </div>
      ),
    },
    {
      id: "risk",
      header: "Risk score",
      align: "right",
      sortValue: (supplier) => supplier.continuousRiskScore,
      cell: (supplier) =>
        supplier.continuousRiskScore !== null ? (
          supplier.continuousRiskScore.toFixed(1)
        ) : (
          <span className="kit-text-muted">Not evaluated</span>
        ),
    },
    {
      id: "band",
      header: "Risk band",
      sortValue: (supplier) => supplier.continuousRiskBand ?? "",
      cell: (supplier) =>
        supplier.continuousRiskBand ? (
          <StatusBadge value={supplier.continuousRiskBand} />
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Initiative card                                                     */
/* ------------------------------------------------------------------ */

interface InitiativeCardProps {
  initiative: CategoryInitiative;
  currency: string;
  canControl: boolean;
  canCancel: boolean;
  busy: boolean;
  workingId: string | null;
  onProgress: (initiative: CategoryInitiative, action: InitiativeProgress) => void;
  onComplete: (initiative: CategoryInitiative) => void;
  onCancel: (initiative: CategoryInitiative) => void;
  onAddMilestone: (initiative: CategoryInitiative) => void;
  onCompleteMilestone: (initiative: CategoryInitiative, milestone: Milestone) => void;
  onCancelMilestone: (initiative: CategoryInitiative, milestone: Milestone) => void;
}

function InitiativeCard({
  initiative,
  currency,
  canControl,
  canCancel,
  busy,
  workingId,
  onProgress,
  onComplete,
  onCancel,
  onAddMilestone,
  onCompleteMilestone,
  onCancelMilestone,
}: InitiativeCardProps) {
  const live = isLive(initiative);
  const controllable = canControl && live;
  const working = workingId === String(initiative.id);

  const countable = initiative.milestones.filter((milestone) => String(milestone.status) !== "CANCELLED");
  const doneMilestones = countable.filter((milestone) => String(milestone.status) === "COMPLETED");

  return (
    <article
      className={
        initiative.overdue && live
          ? "category-initiative category-initiative--overdue"
          : "category-initiative"
      }
    >
      <div className="category-initiative-heading">
        <div>
          <StatusBadge value={initiative.status} />

          <strong>{initiative.title}</strong>

          <small>
            {initiative.initiativeNumber}
            {" · "}
            {readable(initiative.initiativeType)}
            {" · "}
            {initiative.ownerName}
          </small>
        </div>

        <div>
          <span>Target savings</span>

          <strong>{money(initiative.targetSavings, currency)}</strong>

          <small>Realized {initiative.realizationPct.toFixed(0)}%</small>
        </div>
      </div>

      <div className="kit-meter-wrap">
        <Meter
          value={clampPercent(initiative.realizationPct)}
          max={100}
          tone={initiative.realizationPct >= 100 ? meterToneFor("success") : "primary"}
          ariaLabel="Share of target savings realized"
        />
      </div>

      {initiative.description ? <p>{initiative.description}</p> : null}

      <div className="category-initiative-meta">
        <span>
          Priority: <strong>{initiative.priority}</strong>
        </span>

        <span>
          Start:{" "}
          <strong>
            {initiative.plannedStartDate ? formatDate(initiative.plannedStartDate) : "—"}
          </strong>
        </span>

        <span className={initiative.overdue && live ? "category-overdue" : ""}>
          End:{" "}
          <strong>{initiative.plannedEndDate ? formatDate(initiative.plannedEndDate) : "—"}</strong>
          {initiative.overdue && live ? " · Overdue" : ""}
        </span>

        <span>
          Value: <strong>{money(initiative.estimatedValue, currency)}</strong>
        </span>
      </div>

      {controllable ? (
        <div className="category-initiative-controls">
          {initiative.status === "PLANNED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onProgress(initiative, "READY")}
            >
              {working ? "Updating…" : "Ready"}
            </button>
          ) : null}

          {initiative.status === "PLANNED" || initiative.status === "READY" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onProgress(initiative, "START")}
            >
              <Play size={13} />
              {working ? "Updating…" : "Start"}
            </button>
          ) : null}

          {initiative.status === "IN_PROGRESS" ? (
            <button type="button" disabled={busy} onClick={() => onComplete(initiative)}>
              <BadgeCheck size={13} />
              Complete
            </button>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              className="category-danger-button"
              disabled={busy}
              onClick={() => onCancel(initiative)}
            >
              <XCircle size={13} />
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="category-milestone-section">
        <strong>
          Milestones
          {countable.length > 0 ? ` · ${doneMilestones.length}/${countable.length} done` : ""}
        </strong>

        <div className="category-milestone-list">
          {initiative.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={
                milestone.overdue && milestone.status === "OPEN"
                  ? "category-milestone category-milestone--overdue"
                  : "category-milestone"
              }
            >
              <div>
                <StatusBadge value={milestone.status} />

                <strong>{milestone.title}</strong>

                <small>
                  Due {formatDate(milestone.dueDate)}
                  {milestone.overdue && milestone.status === "OPEN" ? " · Overdue" : ""}
                </small>
              </div>

              {controllable && milestone.status === "OPEN" ? (
                <div style={{ display: "inline-flex", gap: 8 }}>
                  <button
                    type="button"
                    className="kit-row-button"
                    disabled={busy}
                    onClick={() => onCompleteMilestone(initiative, milestone)}
                  >
                    <BadgeCheck size={13} />
                    Complete
                  </button>

                  {canCancel ? (
                    <button
                      type="button"
                      className="kit-row-button"
                      disabled={busy}
                      onClick={() => onCancelMilestone(initiative, milestone)}
                    >
                      <XCircle size={13} />
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}

          {initiative.milestones.length === 0 ? (
            <div className="category-milestone-empty">No milestones.</div>
          ) : null}
        </div>

        {controllable ? (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={busy}
              onClick={() => onAddMilestone(initiative)}
            >
              <Plus size={13} />
              Add milestone
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Create initiative modal                                             */
/* ------------------------------------------------------------------ */

interface InitiativeModalProps {
  strategyId: string;
  currency: string;
  users: CatUser[];
  defaultValue: number;
  defaultTarget: number;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function InitiativeModal({
  strategyId,
  currency,
  users,
  defaultValue,
  defaultTarget,
  onClose,
  onSaved,
}: InitiativeModalProps) {
  const [type, setType] = useState<CategoryInitiativeType>("SOURCING_WAVE");
  const [priority, setPriority] = useState<CategoryInitiativePriority>("HIGH");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [startDate, setStartDate] = useState(() => isoDate(0));
  const [endDate, setEndDate] = useState(() => isoDate(90));
  const [estimated, setEstimated] = useState(() => String(round2(defaultValue)));
  const [target, setTarget] = useState(() => String(round2(defaultTarget)));
  const [errors, setErrors] = useState<Partial<Record<InitiativeField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const targetAboveValue =
    numberError(estimated, { min: 0 }) === undefined &&
    numberError(target, { min: 0 }) === undefined &&
    Number(target) > Number(estimated);

  function clearError(field: InitiativeField) {
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

    const next: Partial<Record<InitiativeField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter an initiative title.";
    }

    const estimatedProblem = numberError(estimated, { min: 0 });
    const targetProblem = numberError(target, { min: 0 });

    if (estimatedProblem) {
      next.estimated = estimatedProblem;
    }

    if (targetProblem) {
      next.target = targetProblem;
    }

    if (startDate && endDate && endDate < startDate) {
      next.dates = "The end date cannot be before the start date.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createCategoryInitiative(strategyId, {
        initiativeType: type,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        ownerUserId: ownerId || undefined,
        plannedStartDate: startDate || undefined,
        plannedEndDate: endDate || undefined,
        estimatedValue: Number(estimated),
        targetSavings: Number(target),
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create category initiative.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Pipeline development"
      title="Add category initiative"
      description="The estimated value starts from current category spend, and the target from the strategy savings target."
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
            form="category-initiative-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add initiative"}
          </button>
        </>
      }
    >
      <form id="category-initiative-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Initiative type" htmlFor="initiative-type">
            <select
              id="initiative-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as CategoryInitiativeType)}
            >
              {INITIATIVE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" htmlFor="initiative-priority">
            <select
              id="initiative-priority"
              className="kit-field-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as CategoryInitiativePriority)}
            >
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="kit-pair-wide">
            <Field label="Initiative title" htmlFor="initiative-title" error={errors.title}>
              <input
                id="initiative-title"
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

          <Field label="Owner" htmlFor="initiative-owner">
            <select
              id="initiative-owner"
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

          <div />

          <Field label="Start date" htmlFor="initiative-start" error={errors.dates}>
            <input
              id="initiative-start"
              className="kit-field-input"
              type="date"
              value={startDate}
              aria-invalid={errors.dates ? true : undefined}
              onChange={(event) => {
                setStartDate(event.target.value);
                clearError("dates");
              }}
            />
          </Field>

          <Field label="End date" htmlFor="initiative-end">
            <input
              id="initiative-end"
              className="kit-field-input"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                clearError("dates");
              }}
            />
          </Field>

          <NumberField
            id="initiative-estimated"
            label={`Estimated value (${currency})`}
            min={0}
            step="0.01"
            value={estimated}
            error={errors.estimated}
            onChange={(next) => {
              setEstimated(next);
              clearError("estimated");
            }}
          />

          <NumberField
            id="initiative-target"
            label={`Target savings (${currency})`}
            min={0}
            step="0.01"
            value={target}
            error={errors.target}
            onChange={(next) => {
              setTarget(next);
              clearError("target");
            }}
          />

          <div className="kit-pair-wide">
            <Field label="Description" htmlFor="initiative-description">
              <textarea
                id="initiative-description"
                className="kit-field-input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {targetAboveValue ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The target savings are higher than the estimated value of this initiative.
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
/* Complete initiative modal                                           */
/* ------------------------------------------------------------------ */

interface CompleteInitiativeModalProps {
  initiative: CategoryInitiative;
  currency: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function CompleteInitiativeModal({
  initiative,
  currency,
  onClose,
  onSaved,
}: CompleteInitiativeModalProps) {
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const belowTarget =
    numberError(value, { min: 0 }) === undefined && Number(value) < initiative.targetSavings;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const problem = numberError(value, { min: 0 });

    if (problem) {
      setFieldError(problem);

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await completeCategoryInitiative(initiative.id, Number(value));

      onSaved(initiative.title);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update category initiative.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Complete initiative"
      title="Complete this initiative"
      description={`Record the savings realized by “${initiative.title}”. The target was ${money(initiative.targetSavings, currency)}.`}
      size="sm"
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
            form="category-complete-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Completing…" : "Complete initiative"}
          </button>
        </>
      }
    >
      <form id="category-complete-form" onSubmit={handleSubmit} noValidate>
        <NumberField
          id="initiative-realized"
          label={`Realized savings (${currency})`}
          min={0}
          step="0.01"
          value={value}
          error={fieldError}
          onChange={(next) => {
            setValue(next);
            setFieldError(undefined);
          }}
        />

        {belowTarget ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The realized savings are below the target of{" "}
            {money(initiative.targetSavings, currency)}.
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
/* Add milestone modal                                                 */
/* ------------------------------------------------------------------ */

interface MilestoneModalProps {
  initiative: CategoryInitiative;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function MilestoneModal({ initiative, onClose, onSaved }: MilestoneModalProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(() => isoDate(30));
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const [dueError, setDueError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const missingTitle = !title.trim();
    const missingDue = !dueDate;

    setTitleError(missingTitle ? "Enter a milestone title." : undefined);
    setDueError(missingDue ? "Choose a due date." : undefined);

    if (missingTitle || missingDue) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createCategoryMilestone(initiative.id, { title: title.trim(), dueDate });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create category milestone.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Milestone"
      title="Add milestone"
      description={`A checkpoint for “${initiative.title}”.`}
      size="sm"
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
            form="category-milestone-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add milestone"}
          </button>
        </>
      }
    >
      <form id="category-milestone-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Milestone title" htmlFor="milestone-title" error={titleError}>
              <input
                id="milestone-title"
                className="kit-field-input"
                maxLength={220}
                value={title}
                aria-invalid={titleError ? true : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleError(undefined);
                }}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Due date" htmlFor="milestone-due" error={dueError}>
              <input
                id="milestone-due"
                className="kit-field-input"
                type="date"
                value={dueDate}
                aria-invalid={dueError ? true : undefined}
                onChange={(event) => {
                  setDueDate(event.target.value);
                  setDueError(undefined);
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

interface CategoryData {
  id: string;
  detail: CategoryStrategyDetail;
  users: CatUser[];
}

export default function CategoryStrategyDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canCancel = user !== null && CANCEL_ROLES.includes(user.role);

  const [result, setResult] = useState<CategoryData | null>(null);
  const [pendingStrategy, setPendingStrategy] = useState<StrategyTarget | null>(null);
  const [strategyRunning, setStrategyRunning] = useState(false);
  const [addingInitiative, setAddingInitiative] = useState(false);
  const [completingInitiative, setCompletingInitiative] = useState<CategoryInitiative | null>(null);
  const [cancellingInitiative, setCancellingInitiative] = useState<CategoryInitiative | null>(null);
  const [cancelInitiativeRunning, setCancelInitiativeRunning] = useState(false);
  const [milestoneFor, setMilestoneFor] = useState<CategoryInitiative | null>(null);
  const [completingMilestone, setCompletingMilestone] = useState<Milestone | null>(null);
  const [completeMilestoneRunning, setCompleteMilestoneRunning] = useState(false);
  const [completeMilestoneError, setCompleteMilestoneError] = useState<string | null>(null);
  const [cancellingMilestone, setCancellingMilestone] = useState<Milestone | null>(null);
  const [cancelMilestoneRunning, setCancelMilestoneRunning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [initiativeView, setInitiativeView] = useState("ALL");
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
        const response = await getCategoryStrategy(id);
        const contextResponse = await getCategoryManagementContext(response.strategy.currency);

        if (active) {
          setResult({
            id,
            detail: response,
            users: contextResponse.users.filter((candidate) => candidate.role !== "REQUESTER"),
          });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load category strategy.");
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
        <Link href="/category-management" className="request-back-link">
          <ArrowLeft size={16} />
          Category management
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

  const { strategy, currentInsight, supplierLandscape, initiatives } = detail;
  const currency = strategy.currency;

  const editable = strategy.status !== "CLOSED" && strategy.status !== "ARCHIVED";
  const busyAny =
    strategyRunning ||
    cancelInitiativeRunning ||
    completeMilestoneRunning ||
    cancelMilestoneRunning ||
    workingId !== null;

  const liveInitiatives = initiatives.filter(isLive);

  async function confirmStrategy() {
    if (pendingStrategy === null) {
      return;
    }

    const target = pendingStrategy;
    const copy = strategyCopy(target, strategy.status);

    setStrategyRunning(true);

    try {
      await updateCategoryStrategyStatus(params.id, target);

      setPendingStrategy(null);

      toast.success(copy.done, strategy.strategyCode);
      reload();
    } catch (caught) {
      setPendingStrategy(null);

      toast.error(
        copy.failed,
        caught instanceof Error ? caught.message : "Unable to update category strategy.",
      );
    } finally {
      setStrategyRunning(false);
    }
  }

  async function progressInitiative(initiative: CategoryInitiative, action: InitiativeProgress) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(initiative.id));

    try {
      if (action === "READY") {
        await readyCategoryInitiative(initiative.id);
      } else {
        await startCategoryInitiative(initiative.id);
      }

      toast.success(action === "READY" ? "Marked ready" : "Initiative started", initiative.title);
      reload();
    } catch (caught) {
      toast.error(
        "Could not update the initiative",
        caught instanceof Error ? caught.message : "Unable to update category initiative.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmCancelInitiative() {
    if (cancellingInitiative === null) {
      return;
    }

    const initiative = cancellingInitiative;

    setCancelInitiativeRunning(true);

    try {
      await cancelCategoryInitiative(initiative.id);

      setCancellingInitiative(null);

      toast.success("Initiative cancelled", initiative.title);
      reload();
    } catch (caught) {
      setCancellingInitiative(null);

      toast.error(
        "Could not cancel the initiative",
        caught instanceof Error ? caught.message : "Unable to update category initiative.",
      );
    } finally {
      setCancelInitiativeRunning(false);
    }
  }

  async function confirmCompleteMilestone(note: string) {
    if (completingMilestone === null) {
      return;
    }

    const milestone = completingMilestone;

    setCompleteMilestoneRunning(true);
    setCompleteMilestoneError(null);

    try {
      await completeCategoryMilestone(milestone.id, note);

      setCompletingMilestone(null);

      toast.success("Milestone completed", milestone.title);
      reload();
    } catch (caught) {
      setCompleteMilestoneError(
        caught instanceof Error ? caught.message : "Unable to complete category milestone.",
      );
    } finally {
      setCompleteMilestoneRunning(false);
    }
  }

  async function confirmCancelMilestone() {
    if (cancellingMilestone === null) {
      return;
    }

    const milestone = cancellingMilestone;

    setCancelMilestoneRunning(true);

    try {
      await cancelCategoryMilestone(milestone.id);

      setCancellingMilestone(null);

      toast.success("Milestone cancelled", milestone.title);
      reload();
    } catch (caught) {
      setCancellingMilestone(null);

      toast.error(
        "Could not cancel the milestone",
        caught instanceof Error ? caught.message : "Unable to cancel category milestone.",
      );
    } finally {
      setCancelMilestoneRunning(false);
    }
  }

  function handleInitiativeAdded(title: string) {
    setAddingInitiative(false);
    toast.success("Initiative added", title);
    reload();
  }

  function handleInitiativeCompleted(title: string) {
    setCompletingInitiative(null);
    toast.success("Initiative completed", title);
    reload();
  }

  function handleMilestoneAdded(title: string) {
    setMilestoneFor(null);
    toast.success("Milestone added", title);
    reload();
  }

  const completedCount = initiatives.filter((item) => item.status === "COMPLETED").length;
  const cancelledCount = initiatives.filter((item) => item.status === "CANCELLED").length;
  const activeCount = initiatives.filter(isActiveStatus).length;
  const overdueCount = liveInitiatives.filter((item) => item.overdue).length;

  const pipelineTarget = initiatives
    .filter((item) => item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.targetSavings, 0);

  const coverage =
    strategy.savingsTargetAmount > 0 ? (pipelineTarget / strategy.savingsTargetAmount) * 100 : null;

  const shownInitiatives = initiatives.filter((item) => {
    if (initiativeView === "ACTIVE") {
      return isActiveStatus(item);
    }

    if (initiativeView === "COMPLETED") {
      return item.status === "COMPLETED";
    }

    if (initiativeView === "CANCELLED") {
      return item.status === "CANCELLED";
    }

    return true;
  });

  const initiativeOptions: SegmentedOption[] = [
    { value: "ALL", label: `All · ${initiatives.length}` },
    { value: "ACTIVE", label: `Active · ${activeCount}` },
    { value: "COMPLETED", label: `Completed · ${completedCount}` },
    { value: "CANCELLED", label: `Cancelled · ${cancelledCount}` },
  ];

  const initiativeStats: StatItem[] = [
    { label: "Initiatives", value: String(initiatives.length) },
    { label: "Active", value: String(activeCount) },
    { label: "Overdue", value: String(overdueCount) },
    { label: "Pipeline target", value: money(pipelineTarget, currency) },
  ];

  const spendChange =
    strategy.spendBaseline > 0
      ? ((strategy.currentSpend - strategy.spendBaseline) / strategy.spendBaseline) * 100
      : null;

  const kpis: KpiItem[] = [
    {
      label: "Baseline spend",
      icon: Coins,
      value: money(strategy.spendBaseline, currency),
      note: "Starting point for the strategy",
    },
    {
      label: "Current spend",
      icon: Coins,
      value: money(strategy.currentSpend, currency),
      note:
        spendChange === null
          ? "No baseline to compare"
          : `${spendChange > 0 ? "+" : spendChange < 0 ? "−" : ""}${Math.abs(spendChange).toFixed(1)}% vs baseline`,
    },
    {
      label: "Savings target",
      icon: Target,
      value: money(strategy.savingsTargetAmount, currency),
      note: `${money(currentInsight.modeledOpportunityAmount, currency)} modeled opportunity`,
    },
    {
      label: "Realized",
      icon: BadgeCheck,
      value: money(strategy.realizedSavings, currency),
      note: `${strategy.realizationPct.toFixed(0)}% of target`,
    },
  ];

  const sortedLandscape = [...supplierLandscape].sort((a, b) => b.spend - a.spend);
  const strategyInfo = pendingStrategy !== null ? strategyCopy(pendingStrategy, strategy.status) : null;

  const targetAboveOpportunity =
    editable && strategy.savingsTargetAmount > currentInsight.modeledOpportunityAmount;
  const concentrated = currentInsight.topSupplierSpendShare >= 60;

  const cancelOpenMilestones =
    cancellingInitiative !== null
      ? cancellingInitiative.milestones.filter((milestone) => milestone.status === "OPEN").length
      : 0;

  return (
    <div className="page-stack">
      <Link href="/category-management" className="request-back-link">
        <ArrowLeft size={16} />
        Category management
      </Link>

      <section className="category-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{strategy.strategyCode}</span>

            <StatusBadge value={strategy.status} />

            <StatusBadge
              value={strategy.matrixPosition}
              label={readable(strategy.matrixPosition)}
            />
          </div>

          <h1>{strategy.categoryName}</h1>

          <p>
            FY {strategy.fiscalYear}
            {" · "}
            {strategy.currency}
            {" · Owner: "}
            {strategy.ownerName}
          </p>
        </div>

        <div className="category-status-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canManage && strategy.status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingStrategy("ACTIVE")}
            >
              Activate strategy
            </button>
          ) : null}

          {canManage && strategy.status === "ACTIVE" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPendingStrategy("ON_HOLD")}
            >
              Put on hold
            </button>
          ) : null}

          {canManage && strategy.status === "ACTIVE" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingStrategy("CLOSED")}
            >
              Close strategy
            </button>
          ) : null}

          {canManage && strategy.status === "ON_HOLD" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingStrategy("ACTIVE")}
            >
              Resume strategy
            </button>
          ) : null}

          {canManage && strategy.status === "CLOSED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPendingStrategy("ARCHIVED")}
            >
              Archive
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

      {strategy.status === "ON_HOLD" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This strategy is on hold.</strong> Resume it to keep working on its initiatives.
          </div>
        </div>
      ) : null}

      {concentrated ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Spend is concentrated.</strong> The top supplier holds{" "}
            {currentInsight.topSupplierSpendShare.toFixed(1)}% of category spend. Consider a
            diversification initiative.
          </div>
        </div>
      ) : null}

      {targetAboveOpportunity ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The savings target is above the modeled opportunity.</strong>{" "}
            {money(strategy.savingsTargetAmount, currency)} is targeted against{" "}
            {money(currentInsight.modeledOpportunityAmount, currency)} of modeled opportunity.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Strategy summary" />

      {strategy.savingsTargetAmount > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Savings delivery</span>

              <h2>Realization against target</h2>
            </div>

            <Target size={19} />
          </div>

          <div className="kit-meter-wrap">
            <Meter
              value={clampPercent(strategy.realizationPct)}
              max={100}
              tone={strategy.realizationPct >= 100 ? meterToneFor("success") : "primary"}
              ariaLabel="Savings realized against target"
            />

            <span className="kit-meter-caption">
              {money(strategy.realizedSavings, currency)} of{" "}
              {money(strategy.savingsTargetAmount, currency)} realized (
              {strategy.realizationPct.toFixed(0)}%)
            </span>
          </div>
        </section>
      ) : null}

      <section className="category-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Strategy thesis</span>

              <h2>Objectives</h2>
            </div>

            <Target size={19} />
          </div>

          <div className="category-objectives">{detail.objectives}</div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Current intelligence</span>

              <h2>Risk / value position</h2>
            </div>

            <Layers3 size={19} />
          </div>

          <div className="category-current-intelligence">
            <div>
              <span>Value score</span>

              <strong>{currentInsight.strategicValueScore.toFixed(0)}</strong>
            </div>

            <div>
              <span>Risk score</span>

              <strong>{currentInsight.weightedSupplierRiskScore.toFixed(0)}</strong>
            </div>

            <div>
              <span>Suppliers</span>

              <strong>{currentInsight.supplierCount}</strong>
            </div>

            <div>
              <span>Top supplier</span>

              <strong>{currentInsight.topSupplierSpendShare.toFixed(1)}%</strong>
            </div>

            <div>
              <span>Modeled opportunity</span>

              <strong>{money(currentInsight.modeledOpportunityAmount, currentInsight.currency)}</strong>
            </div>

            <div>
              <span>Matrix</span>

              <strong>{readable(currentInsight.matrixPosition)}</strong>
            </div>
          </div>

          <div className="kit-meter-wrap">
            <Meter
              value={clampPercent(currentInsight.strategicValueScore)}
              max={100}
              tone={meterToneFor("success")}
              ariaLabel="Strategic value score"
            />

            <span className="kit-meter-caption">
              Strategic value {currentInsight.strategicValueScore.toFixed(0)} / 100
            </span>
          </div>

          <div className="kit-meter-wrap">
            <Meter
              value={clampPercent(currentInsight.weightedSupplierRiskScore)}
              max={100}
              tone={riskTone(currentInsight.weightedSupplierRiskScore)}
              ariaLabel="Weighted supplier risk score"
            />

            <span className="kit-meter-caption">
              Weighted supplier risk {currentInsight.weightedSupplierRiskScore.toFixed(0)} / 100
            </span>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Supply market</span>

            <h2>Supplier landscape</h2>
          </div>
        </div>

        <DataTable
          columns={buildSupplierColumns(currency)}
          rows={sortedLandscape}
          getRowId={(supplier) => String(supplier.supplierId)}
          ariaLabel="Supplier landscape"
          busy={fetching}
          empty={
            <EmptyState
              compact
              icon={Layers3}
              title="No suppliers"
              description="No supplier landscape records are available."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Sourcing roadmap</span>

            <h2>Category initiatives</h2>
          </div>

          {canManage && editable ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingInitiative(true)}
            >
              <Plus size={15} />
              Add initiative
            </button>
          ) : (
            <Flag size={19} />
          )}
        </div>

        {initiatives.length > 0 ? <StatStrip items={initiativeStats} /> : null}

        {coverage !== null && initiatives.length > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={clampPercent(coverage)}
              max={100}
              tone={coverage >= 100 ? meterToneFor("success") : meterToneFor("warning")}
              ariaLabel="Initiative pipeline coverage of the savings target"
            />

            <span className="kit-meter-caption">
              The initiative pipeline covers {coverage.toFixed(0)}% of the savings target (
              {money(pipelineTarget, currency)} of {money(strategy.savingsTargetAmount, currency)})
            </span>
          </div>
        ) : null}

        {initiatives.length > 0 ? (
          <div className="kit-toolbar" style={{ margin: "14px 0" }}>
            <SegmentedFilter
              options={initiativeOptions}
              value={initiativeView}
              onChange={setInitiativeView}
              ariaLabel="Filter initiatives"
            />
          </div>
        ) : null}

        {initiatives.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No initiatives yet"
            description="No sourcing or category initiatives have been created."
            action={
              canManage && editable ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setAddingInitiative(true)}
                >
                  <Plus size={15} />
                  Add initiative
                </button>
              ) : undefined
            }
          />
        ) : shownInitiatives.length === 0 ? (
          <EmptyState
            compact
            icon={Flag}
            title="Nothing in this view"
            description="No initiatives match the selected filter."
          />
        ) : (
          <div className="category-initiative-list">
            {shownInitiatives.map((initiative) => (
              <InitiativeCard
                key={initiative.id}
                initiative={initiative}
                currency={currency}
                canControl={canManage && editable}
                canCancel={canCancel}
                busy={busyAny}
                workingId={workingId}
                onProgress={(item, action) => void progressInitiative(item, action)}
                onComplete={(item) => setCompletingInitiative(item)}
                onCancel={(item) => setCancellingInitiative(item)}
                onAddMilestone={(item) => setMilestoneFor(item)}
                onCompleteMilestone={(_item, milestone) => {
                  setCompleteMilestoneError(null);
                  setCompletingMilestone(milestone);
                }}
                onCancelMilestone={(_item, milestone) => setCancellingMilestone(milestone)}
              />
            ))}
          </div>
        )}
      </section>

      {addingInitiative ? (
        <InitiativeModal
          strategyId={params.id}
          currency={currency}
          users={users}
          defaultValue={currentInsight.totalSpend}
          defaultTarget={Math.min(
            strategy.savingsTargetAmount,
            currentInsight.modeledOpportunityAmount,
          )}
          onClose={() => setAddingInitiative(false)}
          onSaved={handleInitiativeAdded}
        />
      ) : null}

      {completingInitiative !== null ? (
        <CompleteInitiativeModal
          initiative={completingInitiative}
          currency={currency}
          onClose={() => setCompletingInitiative(null)}
          onSaved={handleInitiativeCompleted}
        />
      ) : null}

      {milestoneFor !== null ? (
        <MilestoneModal
          initiative={milestoneFor}
          onClose={() => setMilestoneFor(null)}
          onSaved={handleMilestoneAdded}
        />
      ) : null}

      {pendingStrategy !== null && strategyInfo !== null ? (
        <ActionDialog
          eyebrow={strategyInfo.eyebrow}
          title={strategyInfo.title}
          description={strategyDescription(pendingStrategy, strategy, liveInitiatives.length)}
          confirmLabel={strategyInfo.confirm}
          busyLabel={strategyInfo.busy}
          cancelLabel={strategyInfo.keep}
          busy={strategyRunning}
          onConfirm={() => void confirmStrategy()}
          onCancel={() => setPendingStrategy(null)}
        />
      ) : null}

      {cancellingInitiative !== null ? (
        <ActionDialog
          eyebrow="Cancel initiative"
          title="Cancel this initiative?"
          description={`“${cancellingInitiative.title}” will be cancelled and removed from the savings pipeline.`}
          confirmLabel="Cancel initiative"
          busyLabel="Cancelling…"
          cancelLabel="Keep initiative"
          tone="danger"
          busy={cancelInitiativeRunning}
          onConfirm={() => void confirmCancelInitiative()}
          onCancel={() => setCancellingInitiative(null)}
        >
          {cancelOpenMilestones > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {cancelOpenMilestones} open {cancelOpenMilestones === 1 ? "milestone" : "milestones"}{" "}
              will not be completed.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {completingMilestone !== null ? (
        <RationaleDialog
          eyebrow="Milestone"
          title="Complete this milestone"
          description={`Record what was delivered for “${completingMilestone.title}”.`}
          label="Completion note"
          placeholder="What was delivered?"
          confirmLabel="Complete milestone"
          busyLabel="Completing…"
          maxLength={2000}
          busy={completeMilestoneRunning}
          error={completeMilestoneError}
          onConfirm={(note) => void confirmCompleteMilestone(note)}
          onCancel={() => setCompletingMilestone(null)}
        />
      ) : null}

      {cancellingMilestone !== null ? (
        <ActionDialog
          eyebrow="Milestone"
          title="Cancel this milestone?"
          description={`“${cancellingMilestone.title}” will be cancelled.`}
          confirmLabel="Cancel milestone"
          busyLabel="Cancelling…"
          cancelLabel="Keep milestone"
          tone="danger"
          busy={cancelMilestoneRunning}
          onConfirm={() => void confirmCancelMilestone()}
          onCancel={() => setCancellingMilestone(null)}
        />
      ) : null}
    </div>
  );
}
