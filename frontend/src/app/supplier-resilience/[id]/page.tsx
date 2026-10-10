"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CircleAlert,
  FileCheck2,
  Gauge,
  Info,
  Network,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  XCircle,
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  cancelSupplierResilienceAction,
  completeSupplierResilienceAction,
  createSupplierResilienceAction,
  deactivateSupplierResilienceProfile,
  getSupplierResilienceContext,
  getSupplierResilienceDetail,
  startSupplierResilienceAction,
  upsertSupplierResilienceProfile,
} from "@/lib/api";
import type {
  ResilienceAction,
  ResilienceActionType,
  SupplierCapacityStatus,
  SupplierCriticality,
  SupplierResilienceContext,
  SupplierResilienceDetail,
} from "@/types/supplier-resilience";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Intelligence = SupplierResilienceDetail["intelligence"];
type Alternative = SupplierResilienceDetail["alternatives"][number];
type ResUser = SupplierResilienceContext["users"][number];
type ProfileField = "tolerance" | "alternates";
type ActionField = "title" | "dueDate";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: ResUser[] = [];
const ALTERNATIVE_LIMIT = 8;

const CRITICALITIES: { value: SupplierCriticality; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "CRITICAL", label: "Critical" },
  { value: "STRATEGIC", label: "Strategic" },
];

const CAPACITIES: { value: SupplierCapacityStatus; label: string }[] = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "ADEQUATE", label: "Adequate" },
  { value: "CONSTRAINED", label: "Constrained" },
  { value: "AT_RISK", label: "At risk" },
];

const ACTION_TYPES: { value: ResilienceActionType; label: string }[] = [
  { value: "QUALIFY_ALTERNATE", label: "Qualify alternate" },
  { value: "REDUCE_DEPENDENCY", label: "Reduce dependency" },
  { value: "CONTRACT_COVERAGE", label: "Contract coverage" },
  { value: "CAPACITY_REVIEW", label: "Capacity review" },
  { value: "GEOGRAPHIC_DIVERSIFICATION", label: "Geographic diversification" },
  { value: "PERFORMANCE_IMPROVEMENT", label: "Performance improvement" },
  { value: "OTHER", label: "Other" },
];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
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

function isOpenAction(action: ResilienceAction): boolean {
  return action.status === "OPEN" || action.status === "IN_PROGRESS";
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildAlternativeColumns(): Column<Alternative>[] {
  return [
    {
      id: "supplier",
      header: "Supplier",
      sortValue: (alternative) => alternative.supplierName.toLowerCase(),
      cell: (alternative) => (
        <div className="request-primary-cell">
          <strong>{alternative.supplierName}</strong>

          <span>{alternative.supplierCode}</span>
        </div>
      ),
    },
    {
      id: "country",
      header: "Country",
      sortValue: (alternative) => (alternative.country ?? "").toLowerCase(),
      cell: (alternative) => alternative.country ?? <span className="kit-text-muted">Unknown</span>,
    },
    {
      id: "risk",
      header: "Risk",
      sortValue: (alternative) => alternative.riskLevel ?? "",
      cell: (alternative) =>
        alternative.riskLevel ? (
          <StatusBadge value={alternative.riskLevel} />
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "rating",
      header: "Rating",
      align: "right",
      sortValue: (alternative) => alternative.rating ?? null,
      cell: (alternative) => alternative.rating?.toFixed(1) ?? "—",
    },
    {
      id: "performance",
      header: "Performance",
      align: "right",
      sortValue: (alternative) => alternative.latestPerformanceScore ?? null,
      cell: (alternative) => alternative.latestPerformanceScore?.toFixed(1) ?? "—",
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (alternative) => (
        <Link href={`/suppliers/${alternative.supplierId}`} className="table-action">
          Open
        </Link>
      ),
    },
  ];
}

interface ActionColumnOptions {
  canManage: boolean;
  canApprove: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (action: ResilienceAction) => void;
  onComplete: (action: ResilienceAction) => void;
  onCancel: (action: ResilienceAction) => void;
}

function buildActionColumns(options: ActionColumnOptions): Column<ResilienceAction>[] {
  return [
    {
      id: "action",
      header: "Action",
      sortValue: (action) => action.title.toLowerCase(),
      cell: (action) => (
        <div className="request-primary-cell">
          <strong>{action.title}</strong>

          <span>
            {readable(action.actionType)}
            {action.description ? ` · ${action.description}` : ""}
          </span>
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
              <BadgeCheck size={14} />
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
/* Continuity profile form                                             */
/* ------------------------------------------------------------------ */

interface ProfileFormProps {
  supplierId: string;
  currency: string;
  intelligence: Intelligence;
  users: ResUser[];
  canDeactivate: boolean;
  busy: boolean;
  onSaved: (detail: SupplierResilienceDetail) => void;
  onDeactivate: () => void;
}

function ProfileForm({
  supplierId,
  currency,
  intelligence,
  users,
  canDeactivate,
  busy,
  onSaved,
  onDeactivate,
}: ProfileFormProps) {
  const toast = useToast();

  const initialOwner = intelligence.profileOwnerUserId ?? users[0]?.id ?? "";
  const hasProfile = Boolean(intelligence.profileId);

  const [criticality, setCriticality] = useState<SupplierCriticality>(intelligence.criticality);
  const [capacityStatus, setCapacityStatus] = useState<SupplierCapacityStatus>(
    intelligence.capacityStatus,
  );
  const [tolerance, setTolerance] = useState(String(intelligence.dependencyTolerancePct));
  const [alternates, setAlternates] = useState(String(intelligence.minimumAlternates));
  const [ownerId, setOwnerId] = useState(initialOwner);
  const [businessImpact, setBusinessImpact] = useState(intelligence.businessImpact ?? "");
  const [capacityNotes, setCapacityNotes] = useState(intelligence.capacityNotes ?? "");
  const [notes, setNotes] = useState(intelligence.profileNotes ?? "");
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    criticality !== intelligence.criticality ||
    capacityStatus !== intelligence.capacityStatus ||
    Number(tolerance) !== intelligence.dependencyTolerancePct ||
    Number(alternates) !== intelligence.minimumAlternates ||
    ownerId !== initialOwner ||
    businessImpact.trim() !== (intelligence.businessImpact ?? "").trim() ||
    capacityNotes.trim() !== (intelligence.capacityNotes ?? "").trim() ||
    notes.trim() !== (intelligence.profileNotes ?? "").trim();

  const noAlternatesRequired = alternates.trim() !== "" && Number(alternates) === 0;

  function clearError(field: ProfileField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  function reset() {
    setCriticality(intelligence.criticality);
    setCapacityStatus(intelligence.capacityStatus);
    setTolerance(String(intelligence.dependencyTolerancePct));
    setAlternates(String(intelligence.minimumAlternates));
    setOwnerId(initialOwner);
    setBusinessImpact(intelligence.businessImpact ?? "");
    setCapacityNotes(intelligence.capacityNotes ?? "");
    setNotes(intelligence.profileNotes ?? "");
    setErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<ProfileField, string>> = {};

    const toleranceProblem = numberError(tolerance, { min: 0, max: 100 });
    const alternatesProblem = numberError(alternates, { min: 0, max: 20, integer: true });

    if (toleranceProblem) {
      next.tolerance = toleranceProblem;
    }

    if (alternatesProblem) {
      next.alternates = alternatesProblem;
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const response = await upsertSupplierResilienceProfile(supplierId, currency, {
        criticality,
        capacityStatus,
        dependencyTolerancePct: Number(tolerance),
        minimumAlternates: Number(alternates),
        ownerUserId: ownerId || undefined,
        businessImpact: businessImpact.trim() || undefined,
        capacityNotes: capacityNotes.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSaved(response);

      toast.success(hasProfile ? "Profile updated" : "Profile created", intelligence.supplierName);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to save supplier resilience profile.";

      setFormError(message);
      toast.error("Could not save the profile", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div className="panel__header">
        <div>
          <span className="eyebrow">Resilience governance</span>

          <h2>Supplier continuity profile</h2>
        </div>

        <ShieldCheck size={19} />
      </div>

      <div className="kit-pair-grid">
        <Field label="Criticality" htmlFor="profile-criticality">
          <select
            id="profile-criticality"
            className="kit-field-input"
            value={criticality}
            onChange={(event) => setCriticality(event.target.value as SupplierCriticality)}
          >
            {CRITICALITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Capacity status" htmlFor="profile-capacity">
          <select
            id="profile-capacity"
            className="kit-field-input"
            value={capacityStatus}
            onChange={(event) => setCapacityStatus(event.target.value as SupplierCapacityStatus)}
          >
            {CAPACITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <NumberField
          id="profile-tolerance"
          label="Dependency tolerance (%)"
          min={0}
          max={100}
          step="0.1"
          value={tolerance}
          error={errors.tolerance}
          onChange={(value) => {
            setTolerance(value);
            clearError("tolerance");
          }}
        />

        <NumberField
          id="profile-alternates"
          label="Minimum alternates (0-20)"
          min={0}
          max={20}
          step={1}
          value={alternates}
          error={errors.alternates}
          onChange={(value) => {
            setAlternates(value);
            clearError("alternates");
          }}
        />

        <div className="kit-pair-wide">
          <Field label="Profile owner" htmlFor="profile-owner">
            <select
              id="profile-owner"
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
        </div>

        <div className="kit-pair-wide">
          <Field label="Business impact" htmlFor="profile-impact">
            <textarea
              id="profile-impact"
              className="kit-field-input"
              rows={3}
              maxLength={2000}
              value={businessImpact}
              onChange={(event) => setBusinessImpact(event.target.value)}
            />
          </Field>
        </div>

        <div className="kit-pair-wide">
          <Field label="Capacity assessment" htmlFor="profile-capacity-notes">
            <textarea
              id="profile-capacity-notes"
              className="kit-field-input"
              rows={3}
              maxLength={2000}
              value={capacityNotes}
              onChange={(event) => setCapacityNotes(event.target.value)}
            />
          </Field>
        </div>

        <div className="kit-pair-wide">
          <Field label="Governance notes" htmlFor="profile-notes">
            <textarea
              id="profile-notes"
              className="kit-field-input"
              rows={3}
              maxLength={3000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      </div>

      {noAlternatesRequired ? (
        <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
          With no minimum alternates, a missing alternate supplier will not count as a gap.
        </p>
      ) : null}

      {formError ? (
        <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
          <CircleAlert size={18} />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="kit-form-footer">
        {dirty ? <span className="kit-form-state">Unsaved changes</span> : null}

        {dirty ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={reset}
            disabled={saving}
          >
            Discard changes
          </button>
        ) : null}

        {canDeactivate ? (
          <button
            type="button"
            className="button button--secondary request-cancel-button"
            disabled={saving || busy}
            onClick={onDeactivate}
          >
            <XCircle size={16} />
            Deactivate profile
          </button>
        ) : null}

        <button
          type="submit"
          className="button button--primary"
          disabled={saving || (hasProfile && !dirty)}
        >
          <ShieldCheck size={16} />
          {saving ? "Saving…" : hasProfile ? "Update profile" : "Create profile"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Add mitigation action                                               */
/* ------------------------------------------------------------------ */

interface AddActionModalProps {
  supplierId: string;
  supplierName: string;
  users: ResUser[];
  defaultOwnerId: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function AddActionModal({
  supplierId,
  supplierName,
  users,
  defaultOwnerId,
  onClose,
  onSaved,
}: AddActionModalProps) {
  const [type, setType] = useState<ResilienceActionType>("QUALIFY_ALTERNATE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
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
      await createSupplierResilienceAction(supplierId, {
        actionType: type,
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerId || undefined,
        dueDate,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create resilience mitigation action.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Continuity mitigation"
      title="Add resilience action"
      description={`A step to reduce the continuity exposure of ${supplierName}.`}
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
            form="resilience-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add action"}
          </button>
        </>
      }
    >
      <form id="resilience-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Action type" htmlFor="resilience-action-type">
            <select
              id="resilience-action-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as ResilienceActionType)}
            >
              {ACTION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="resilience-action-due" error={errors.dueDate}>
            <input
              id="resilience-action-due"
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
            <Field label="Action title" htmlFor="resilience-action-title" error={errors.title}>
              <input
                id="resilience-action-title"
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
            <Field label="Description" htmlFor="resilience-action-description">
              <textarea
                id="resilience-action-description"
                className="kit-field-input"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Owner" htmlFor="resilience-action-owner">
              <select
                id="resilience-action-owner"
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

interface ResilienceData {
  key: string;
  detail: SupplierResilienceDetail;
  users: ResUser[];
}

export default function SupplierResilienceDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const currency = searchParams.get("currency") ?? "EUR";
  const supplierId = params.id;
  const dataKey = `${supplierId}|${currency}`;

  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<ResilienceData | null>(null);
  const [adding, setAdding] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<ResilienceAction | null>(null);
  const [completeRunning, setCompleteRunning] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<ResilienceAction | null>(null);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateRunning, setDeactivateRunning] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const [detailResponse, contextResponse] = await Promise.all([
          getSupplierResilienceDetail(supplierId, currency),
          getSupplierResilienceContext(),
        ]);

        if (active) {
          setResult({
            key: `${supplierId}|${currency}`,
            detail: detailResponse,
            users: contextResponse.users.filter((candidate) => candidate.role !== "REQUESTER"),
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load supplier resilience detail.",
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
  }, [supplierId, currency, reloadKey]);

  const data = result !== null && result.key === dataKey ? result : null;
  const detail = data?.detail ?? null;
  const users = data?.users ?? EMPTY_USERS;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyDetail(updated: SupplierResilienceDetail) {
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
        <Link href="/supplier-resilience" className="request-back-link">
          <ArrowLeft size={16} />
          Supplier resilience
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

  const { intelligence, alternatives, mitigationActions } = detail;

  const busyAny = completeRunning || cancelRunning || deactivateRunning || workingId !== null;
  const profileActive = Boolean(intelligence.profileId) && intelligence.profileStatus === "ACTIVE";
  const canAddAction = canManage && profileActive;
  const defaultOwnerId = intelligence.profileOwnerUserId ?? users[0]?.id ?? "";

  async function startAction(action: ResilienceAction) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(action.id));

    try {
      await startSupplierResilienceAction(action.id);

      toast.success("Action started", action.title);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the action",
        caught instanceof Error ? caught.message : "Unable to start resilience action.",
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
      await completeSupplierResilienceAction(action.id, note);

      setCompleting(null);

      toast.success("Action completed", action.title);
      reload();
    } catch (caught) {
      setCompleteError(
        caught instanceof Error ? caught.message : "Unable to complete resilience action.",
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
      await cancelSupplierResilienceAction(action.id);

      setCancelling(null);

      toast.success("Action cancelled", action.title);
      reload();
    } catch (caught) {
      setCancelling(null);

      toast.error(
        "Could not cancel the action",
        caught instanceof Error ? caught.message : "Unable to cancel resilience action.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  async function confirmDeactivate() {
    setDeactivateRunning(true);

    try {
      const updated = await deactivateSupplierResilienceProfile(supplierId, currency);

      applyDetail(updated);
      setDeactivateOpen(false);

      toast.success("Profile deactivated", intelligence.supplierName);
    } catch (caught) {
      setDeactivateOpen(false);

      toast.error(
        "Could not deactivate the profile",
        caught instanceof Error
          ? caught.message
          : "Unable to deactivate supplier resilience profile.",
      );
    } finally {
      setDeactivateRunning(false);
    }
  }

  function handleActionAdded(title: string) {
    setAdding(false);
    toast.success("Resilience action added", title);
    reload();
  }

  const openActions = mitigationActions.filter(isOpenAction);

  const orderedActions = [...mitigationActions].sort((a, b) => {
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

  const shownAlternatives = alternatives.slice(0, ALTERNATIVE_LIMIT);
  const minimumAlternates = intelligence.minimumAlternates;

  const kpis: KpiItem[] = [
    {
      label: "Resilience score",
      icon: Gauge,
      value: intelligence.resilienceScore.toFixed(1),
      note: readable(intelligence.resilienceBand),
    },
    {
      label: "Category dependency",
      icon: Network,
      value: `${intelligence.categorySharePct.toFixed(1)}%`,
      note: `Tolerance ${intelligence.dependencyTolerancePct.toFixed(1)}%`,
      tone: intelligence.dependencyToleranceBreached ? "warning" : "default",
    },
    {
      label: "Alternate suppliers",
      icon: Building2,
      value: String(intelligence.alternateSupplierCount),
      note: `${intelligence.alternateGap} below configured target`,
      tone: intelligence.alternateGap > 0 ? "warning" : "default",
    },
    {
      label: "Mitigation actions",
      icon: ShieldCheck,
      value: String(intelligence.openMitigationActions),
      note: `${intelligence.overdueMitigationActions} overdue`,
      tone: intelligence.overdueMitigationActions > 0 ? "warning" : "default",
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

  return (
    <div className="page-stack">
      <Link href="/supplier-resilience" className="request-back-link">
        <ArrowLeft size={16} />
        Supplier resilience
      </Link>

      <section className="resilience-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{intelligence.supplierCode}</span>

            <StatusBadge value={intelligence.resilienceBand} />

            <StatusBadge value={intelligence.criticality} />
          </div>

          <h1>{intelligence.supplierName}</h1>

          <p>
            {intelligence.category ?? "Uncategorized"}
            {" · "}
            {intelligence.country ?? "Unknown country"}
            {" · "}
            {currency}
            {" exposure view"}
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

          <Link href={`/suppliers/${intelligence.supplierId}`} className="button button--secondary">
            Supplier 360
          </Link>
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

      {intelligence.singleSource ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Single-source supplier.</strong> No active same-category alternate supplier is
            currently available.
          </div>
        </div>
      ) : null}

      {intelligence.dependencyToleranceBreached ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Category dependency exceeds the tolerance.</strong> This supplier represents{" "}
            {intelligence.categorySharePct.toFixed(1)}% of its category against a tolerance of{" "}
            {intelligence.dependencyTolerancePct.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {intelligence.capacityStatus === "AT_RISK" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Supplier capacity is marked at risk.</strong> Review the capacity assessment in
            the continuity profile.
          </div>
        </div>
      ) : null}

      {!intelligence.activeContractCoverage ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No active contract covers this supplier.</strong> Consider a contract coverage
            action.
          </div>
        </div>
      ) : null}

      {canManage && !profileActive ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {intelligence.profileId
                ? "The continuity profile is not active."
                : "No continuity profile exists yet."}
            </strong>{" "}
            Save the profile below to track mitigation actions for this supplier.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Resilience summary" />

      <section className="resilience-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Dependency intelligence</span>

              <h2>Concentration exposure</h2>
            </div>

            <Network size={19} />
          </div>

          <div className="resilience-exposure-grid">
            <div>
              <span>Supplier spend</span>

              <strong>{money(intelligence.supplierSpend, currency)}</strong>

              <small>{intelligence.spendSharePct.toFixed(1)}% portfolio</small>
            </div>

            <div>
              <span>Category spend</span>

              <strong>{money(intelligence.categorySpend, currency)}</strong>

              <small>Supplier represents {intelligence.categorySharePct.toFixed(1)}%</small>
            </div>

            <div>
              <span>Country spend</span>

              <strong>{money(intelligence.countrySpend, currency)}</strong>

              <small>{intelligence.countrySpendSharePct.toFixed(1)}% portfolio exposure</small>
            </div>

            <div>
              <span>Contract coverage</span>

              <strong>{intelligence.activeContractCoverage ? "Active" : "Missing"}</strong>

              <small>Current supplier contract</small>
            </div>

            <div>
              <span>Latest performance</span>

              <strong>
                {intelligence.latestPerformanceScore !== null
                  ? intelligence.latestPerformanceScore.toFixed(1)
                  : "—"}
              </strong>

              <small>Approved supplier review</small>
            </div>

            <div>
              <span>Open CAPA</span>

              <strong>{intelligence.openCorrectiveActions}</strong>

              <small>Supplier improvement actions</small>
            </div>
          </div>

          <div className="kit-meter-wrap">
            <Meter
              value={clampPercent(intelligence.categorySharePct)}
              max={100}
              tone={meterToneFor(intelligence.dependencyToleranceBreached ? "danger" : "success")}
              ariaLabel="Category dependency against tolerance"
            />

            <span className="kit-meter-caption">
              Category dependency {intelligence.categorySharePct.toFixed(1)}% against a tolerance of{" "}
              {intelligence.dependencyTolerancePct.toFixed(1)}%
            </span>
          </div>

          {minimumAlternates > 0 ? (
            <div className="kit-meter-wrap">
              <Meter
                value={Math.min(intelligence.alternateSupplierCount, minimumAlternates)}
                max={minimumAlternates}
                tone={meterToneFor(intelligence.alternateGap > 0 ? "warning" : "success")}
                ariaLabel="Alternate suppliers against the configured target"
              />

              <span className="kit-meter-caption">
                {intelligence.alternateSupplierCount} of {minimumAlternates} required alternate{" "}
                {minimumAlternates === 1 ? "supplier" : "suppliers"}
              </span>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Alternative supply</span>

              <h2>Same-category coverage</h2>
            </div>

            <Star size={19} />
          </div>

          <DataTable
            columns={buildAlternativeColumns()}
            rows={shownAlternatives}
            getRowId={(alternative) => String(alternative.supplierId)}
            ariaLabel="Alternative suppliers"
            busy={fetching}
            empty={
              <EmptyState
                compact
                icon={Star}
                title="Single-source category"
                description="This is currently a single-source category within the active supplier portfolio."
              />
            }
          />

          {alternatives.length > ALTERNATIVE_LIMIT ? (
            <p className="kit-meta-line" style={{ marginTop: 10 }}>
              Showing {ALTERNATIVE_LIMIT} of {alternatives.length} alternate suppliers.
            </p>
          ) : null}
        </section>
      </section>

      {canManage ? (
        <ProfileForm
          key={String(intelligence.profileId ?? "new")}
          supplierId={supplierId}
          currency={currency}
          intelligence={intelligence}
          users={users}
          canDeactivate={canApprove && profileActive}
          busy={busyAny}
          onSaved={applyDetail}
          onDeactivate={() => setDeactivateOpen(true)}
        />
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Continuity execution</span>

            <h2>Mitigation plan</h2>
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
            <FileCheck2 size={19} />
          )}
        </div>

        {mitigationActions.length > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={mitigationActions.length - openActions.length}
              max={mitigationActions.length}
              tone={openActions.length === 0 ? meterToneFor("success") : "primary"}
              ariaLabel="Mitigation actions finished"
            />

            <span className="kit-meter-caption">
              {mitigationActions.length - openActions.length} of {mitigationActions.length} actions
              finished
            </span>
          </div>
        ) : null}

        <DataTable
          columns={actionColumns}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="Resilience mitigation actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No mitigation actions"
              description={
                profileActive
                  ? "No supplier resilience mitigation actions are currently recorded."
                  : "Save an active continuity profile to start adding mitigation actions."
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
          supplierId={supplierId}
          supplierName={intelligence.supplierName}
          users={users}
          defaultOwnerId={defaultOwnerId}
          onClose={() => setAdding(false)}
          onSaved={handleActionAdded}
        />
      ) : null}

      {completing !== null ? (
        <RationaleDialog
          eyebrow="Mitigation action"
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
          eyebrow="Mitigation action"
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

      {deactivateOpen ? (
        <ActionDialog
          eyebrow="Continuity profile"
          title="Deactivate this profile?"
          description={`The continuity profile for ${intelligence.supplierName} will be deactivated. New mitigation actions can only be added while the profile is active.`}
          confirmLabel="Deactivate profile"
          busyLabel="Deactivating…"
          cancelLabel="Keep profile"
          tone="danger"
          busy={deactivateRunning}
          onConfirm={() => void confirmDeactivate()}
          onCancel={() => setDeactivateOpen(false)}
        >
          {openActions.length > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {openActions.length} mitigation {openActions.length === 1 ? "action is" : "actions are"}{" "}
              still open.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}
    </div>
  );
}
