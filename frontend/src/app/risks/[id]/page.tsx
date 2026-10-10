"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Info,
  Plus,
  RefreshCw,
  ShieldAlert,
  Siren,
  Target,
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
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  acceptRiskCase,
  addRiskMitigationAction,
  completeRiskMitigationAction,
  escalateRiskCase,
  getRiskCase,
  getRiskContextOptions,
  resolveRiskCase,
  startRiskMitigation,
  updateRiskCase,
} from "@/lib/api";
import type { RiskCase, RiskCategory, RiskContextOptions } from "@/types/risk";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type MitigationAction = RiskCase["mitigationActions"][number];
type RiskUser = RiskContextOptions["users"][number];
type LifecycleAction = "MITIGATE" | "ESCALATE";
type CloseAction = "RESOLVE" | "ACCEPT";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const CLOSE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const MAX_SCORE = 25;

const CATEGORIES: { value: RiskCategory; label: string }[] = [
  { value: "SUPPLIER", label: "Supplier" },
  { value: "CONTRACT", label: "Contract" },
  { value: "PURCHASE_ORDER", label: "Purchase order" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "SOURCING", label: "Sourcing" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "OTHER", label: "Other" },
];

const EMPTY_USERS: RiskUser[] = [];

interface LifecycleCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const LIFECYCLE: Record<LifecycleAction, LifecycleCopy> = {
  MITIGATE: {
    eyebrow: "Mitigation",
    title: "Start mitigation?",
    confirm: "Start mitigation",
    busy: "Starting…",
    keep: "Not yet",
    done: "Mitigation started",
    failed: "Could not start mitigation",
  },
  ESCALATE: {
    eyebrow: "Escalation",
    title: "Escalate this risk?",
    confirm: "Escalate risk",
    busy: "Escalating…",
    keep: "Not now",
    done: "Risk escalated",
    failed: "Could not escalate the risk",
  },
};

function lifecycleDescription(action: LifecycleAction, risk: RiskCase): string {
  if (action === "MITIGATE") {
    return `${risk.riskNumber} will move into active mitigation. Track the treatment plan through the mitigation actions below.`;
  }

  return `${risk.riskNumber} will be flagged as escalated for management attention.`;
}

interface CloseCopy {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  done: string;
  failed: string;
}

function closeCopy(action: CloseAction, risk: RiskCase): CloseCopy {
  if (action === "RESOLVE") {
    return {
      title: "Resolve this risk",
      description: `${risk.riskNumber} will be closed as resolved. Record what was done to resolve it.`,
      label: "Resolution rationale",
      placeholder: "What was done to resolve this risk?",
      confirm: "Resolve risk",
      busy: "Resolving…",
      done: "Risk resolved",
      failed: "Could not resolve the risk",
    };
  }

  return {
    title: "Accept this risk",
    description: `${risk.riskNumber} will be closed as accepted, with no further treatment. Record why the exposure is acceptable.`,
    label: "Acceptance rationale",
    placeholder: "Why is this risk acceptable?",
    confirm: "Accept risk",
    busy: "Accepting…",
    done: "Risk accepted",
    failed: "Could not accept the risk",
  };
}

function scoreTone(score: number) {
  return meterToneFor(score >= 15 ? "danger" : score >= 8 ? "warning" : "success");
}

function buildActionColumns(
  canManage: boolean,
  completingId: string | null,
  onComplete: (action: MitigationAction) => void,
): Column<MitigationAction>[] {
  return [
    {
      id: "action",
      header: "Action",
      sortValue: (action) => action.title.toLowerCase(),
      cell: (action) => (
        <div className="request-primary-cell">
          <strong>{action.title}</strong>

          <span>{action.description ?? "No description"}</span>
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
      sortValue: (action) => action.dueDate ?? null,
      cell: (action) =>
        action.dueDate ? (
          <div className="kit-cell-stack">
            <span>{formatDate(action.dueDate)}</span>

            {action.overdue ? <small className="kit-cell-flag">Overdue</small> : null}
          </div>
        ) : (
          <span className="kit-text-muted">No due date</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (action) => action.status,
      cell: (action) => <StatusBadge value={action.status} />,
    },
    {
      id: "complete",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 120,
      cell: (action) =>
        canManage && action.status === "OPEN" ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={completingId !== null}
            onClick={() => onComplete(action)}
          >
            <Check size={14} />
            {completingId === String(action.id) ? "Completing…" : "Complete"}
          </button>
        ) : null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Assessment form                                                     */
/* ------------------------------------------------------------------ */

type AssessmentField = "title" | "description" | "likelihood" | "impact";

interface AssessmentFormProps {
  risk: RiskCase;
  users: RiskUser[];
  onSaved: (updated: RiskCase) => void;
}

function AssessmentForm({ risk, users, onSaved }: AssessmentFormProps) {
  const toast = useToast();

  const [title, setTitle] = useState(risk.title);
  const [description, setDescription] = useState(risk.description);
  const [category, setCategory] = useState<RiskCategory>(risk.category);
  const [likelihood, setLikelihood] = useState(String(risk.likelihood));
  const [impact, setImpact] = useState(String(risk.impact));
  const [dueDate, setDueDate] = useState(risk.dueDate ?? "");
  const [ownerUserId, setOwnerUserId] = useState(risk.ownerUserId);
  const [errors, setErrors] = useState<Partial<Record<AssessmentField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const likelihoodNumber = Number(likelihood);
  const impactNumber = Number(impact);

  const preview =
    numberError(likelihood, { min: 1, max: 5, integer: true }) === undefined &&
    numberError(impact, { min: 1, max: 5, integer: true }) === undefined
      ? likelihoodNumber * impactNumber
      : null;

  const dirty =
    title.trim() !== risk.title ||
    description.trim() !== risk.description ||
    category !== risk.category ||
    likelihoodNumber !== risk.likelihood ||
    impactNumber !== risk.impact ||
    dueDate !== (risk.dueDate ?? "") ||
    ownerUserId !== risk.ownerUserId;

  function clearError(field: AssessmentField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  function reset() {
    setTitle(risk.title);
    setDescription(risk.description);
    setCategory(risk.category);
    setLikelihood(String(risk.likelihood));
    setImpact(String(risk.impact));
    setDueDate(risk.dueDate ?? "");
    setOwnerUserId(risk.ownerUserId);
    setErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<AssessmentField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter a risk title.";
    }

    if (!description.trim()) {
      next.description = "Describe the risk.";
    }

    const likelihoodProblem = numberError(likelihood, { min: 1, max: 5, integer: true });
    const impactProblem = numberError(impact, { min: 1, max: 5, integer: true });

    if (likelihoodProblem) {
      next.likelihood = likelihoodProblem;
    }

    if (impactProblem) {
      next.impact = impactProblem;
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const updated = await updateRiskCase(risk.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        likelihood: likelihoodNumber,
        impact: impactNumber,
        dueDate: dueDate || undefined,
        ownerUserId: ownerUserId || undefined,
      });

      onSaved(updated);

      toast.success("Assessment saved", updated.riskNumber);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to update risk case.";

      setFormError(message);
      toast.error("Could not save the assessment", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div className="panel__header">
        <div>
          <span className="eyebrow">Risk administration</span>

          <h2>Risk assessment</h2>
        </div>
      </div>

      <div className="kit-pair-grid">
        <div className="kit-pair-wide">
          <Field label="Title" htmlFor="risk-title" error={errors.title}>
            <input
              id="risk-title"
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
          <Field label="Description" htmlFor="risk-description" error={errors.description}>
            <textarea
              id="risk-description"
              className="kit-field-input"
              rows={5}
              maxLength={3000}
              value={description}
              aria-invalid={errors.description ? true : undefined}
              onChange={(event) => {
                setDescription(event.target.value);
                clearError("description");
              }}
            />
          </Field>
        </div>

        <Field label="Category" htmlFor="risk-category">
          <select
            id="risk-category"
            className="kit-field-input"
            value={category}
            onChange={(event) => setCategory(event.target.value as RiskCategory)}
          >
            {CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Owner" htmlFor="risk-owner">
          <select
            id="risk-owner"
            className="kit-field-input"
            value={ownerUserId}
            onChange={(event) => setOwnerUserId(event.target.value)}
          >
            {users.map((option) => (
              <option key={option.id} value={option.id}>
                {option.fullName}
              </option>
            ))}
          </select>
        </Field>

        <NumberField
          id="risk-likelihood"
          label="Likelihood (1-5)"
          min={1}
          max={5}
          step={1}
          value={likelihood}
          error={errors.likelihood}
          onChange={(value) => {
            setLikelihood(value);
            clearError("likelihood");
          }}
        />

        <NumberField
          id="risk-impact"
          label="Impact (1-5)"
          min={1}
          max={5}
          step={1}
          value={impact}
          error={errors.impact}
          onChange={(value) => {
            setImpact(value);
            clearError("impact");
          }}
        />

        <Field label="Due date" htmlFor="risk-due">
          <input
            id="risk-due"
            className="kit-field-input"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>
      </div>

      {preview !== null ? (
        <div className="kit-meter-wrap">
          <Meter
            value={preview}
            max={MAX_SCORE}
            tone={scoreTone(preview)}
            ariaLabel="Risk score preview"
          />

          <span className="kit-meter-caption">
            Score preview: {preview}/{MAX_SCORE} (likelihood {likelihoodNumber} × impact{" "}
            {impactNumber})
            {preview !== risk.riskScore ? ` · currently ${risk.riskScore}/${MAX_SCORE}` : ""}
          </span>
        </div>
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

        <button type="submit" className="button button--primary" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save assessment"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Add mitigation action                                               */
/* ------------------------------------------------------------------ */

interface AddActionModalProps {
  risk: RiskCase;
  users: RiskUser[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

function AddActionModal({ risk, users, onClose, onSaved }: AddActionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(risk.ownerUserId);
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!title.trim()) {
      setTitleError("Enter an action title.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addRiskMitigationAction(risk.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        ownerUserId: ownerId || undefined,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add mitigation action.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Treatment plan"
      title="Add mitigation action"
      description={`A step to reduce the exposure of ${risk.riskNumber}.`}
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
            form="risk-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add action"}
          </button>
        </>
      }
    >
      <form id="risk-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Action title" htmlFor="action-title" error={titleError}>
              <input
                id="action-title"
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
            <Field label="Description" htmlFor="action-description">
              <textarea
                id="action-description"
                className="kit-field-input"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Owner" htmlFor="action-owner">
            <select
              id="action-owner"
              className="kit-field-input"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              {users.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="action-due">
            <input
              id="action-due"
              className="kit-field-input"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
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

interface RiskData {
  id: string;
  risk: RiskCase;
  options: RiskContextOptions;
}

export default function RiskDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canClose = user !== null && CLOSE_ROLES.includes(user.role);

  const [result, setResult] = useState<RiskData | null>(null);
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [closing, setClosing] = useState<CloseAction | null>(null);
  const [closeRunning, setCloseRunning] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
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
        const [riskResponse, optionsResponse] = await Promise.all([
          getRiskCase(id),
          getRiskContextOptions(),
        ]);

        if (active) {
          setResult({ id, risk: riskResponse, options: optionsResponse });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load risk case.");
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
  const risk = data?.risk ?? null;
  const users = data?.options.users ?? EMPTY_USERS;

  function applyRisk(updated: RiskCase) {
    setResult((current) => (current ? { ...current, risk: updated } : current));
  }

  async function confirmLifecycle() {
    if (!risk || pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setActionRunning(true);

    try {
      const updated =
        action === "MITIGATE"
          ? await startRiskMitigation(risk.id)
          : await escalateRiskCase(risk.id);

      applyRisk(updated);
      setPendingAction(null);

      toast.success(LIFECYCLE[action].done, updated.riskNumber);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        LIFECYCLE[action].failed,
        caught instanceof Error ? caught.message : "Unable to update risk lifecycle.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function confirmClose(note: string) {
    if (!risk || closing === null) {
      return;
    }

    const action = closing;
    const copy = closeCopy(action, risk);

    setCloseRunning(true);
    setCloseError(null);

    try {
      const updated =
        action === "RESOLVE"
          ? await resolveRiskCase(risk.id, note)
          : await acceptRiskCase(risk.id, note);

      applyRisk(updated);
      setClosing(null);

      toast.success(copy.done, updated.riskNumber);
    } catch (caught) {
      setCloseError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setCloseRunning(false);
    }
  }

  async function completeAction(action: MitigationAction) {
    if (completingId !== null) {
      return;
    }

    setCompletingId(String(action.id));

    try {
      await completeRiskMitigationAction(String(action.id));

      toast.success("Action completed", action.title);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(
        "Could not complete the action",
        caught instanceof Error ? caught.message : "Unable to complete mitigation action.",
      );
    } finally {
      setCompletingId(null);
    }
  }

  function openClose(action: CloseAction) {
    setCloseError(null);
    setClosing(action);
  }

  function handleActionAdded(title: string) {
    setAdding(false);
    toast.success("Mitigation action added", title);
    setReloadKey((key) => key + 1);
  }

  if (risk === null) {
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
        <Link href="/risks" className="request-back-link">
          <ArrowLeft size={16} />
          Risk register
        </Link>

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
      </div>
    );
  }

  const isClosed = risk.status === "RESOLVED" || risk.status === "ACCEPTED";
  const busyAny = actionRunning || closeRunning || completingId !== null;
  const openActions = risk.openMitigationActions;
  const totalActions = openActions + risk.completedMitigationActions;
  const closeInfo = closing !== null ? closeCopy(closing, risk) : null;

  const orderedActions = [...risk.mitigationActions].sort((a, b) => {
    const left = a.status === "COMPLETED" ? 1 : 0;
    const right = b.status === "COMPLETED" ? 1 : 0;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });

  const kpis: KpiItem[] = [
    {
      label: "Risk score",
      icon: ShieldAlert,
      value: `${risk.riskScore}/${MAX_SCORE}`,
      note: `L${risk.likelihood} × I${risk.impact}`,
      tone: !isClosed && risk.riskScore >= 15 ? "warning" : "default",
    },
    {
      label: "Due date",
      icon: Clock3,
      value: risk.dueDate ? formatDate(risk.dueDate) : "No due date",
      note: risk.overdue ? "Overdue" : "Current",
      tone: risk.overdue && !isClosed ? "warning" : "default",
    },
    {
      label: "Mitigation",
      icon: Target,
      value: String(openActions),
      note: `open · ${risk.completedMitigationActions} completed`,
    },
    {
      label: "Origin",
      icon: AlertTriangle,
      value: readable(risk.origin),
      note: readable(risk.category),
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/risks" className="request-back-link">
        <ArrowLeft size={16} />
        Risk register
      </Link>

      <section className="risk-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{risk.riskNumber}</span>

            <StatusBadge value={risk.severity} />

            <StatusBadge value={risk.status} />
          </div>

          <h1>{risk.title}</h1>

          <p>
            {readable(risk.category)}
            {" · Owner: "}
            {risk.ownerName}
          </p>
        </div>

        <div className="risk-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {!isClosed && canManage && risk.status === "OPEN" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPendingAction("MITIGATE")}
            >
              <Target size={16} />
              Start mitigation
            </button>
          ) : null}

          {!isClosed && canClose && !risk.escalated ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPendingAction("ESCALATE")}
            >
              <Siren size={16} />
              Escalate
            </button>
          ) : null}

          {!isClosed && canClose ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => openClose("ACCEPT")}
            >
              <AlertTriangle size={16} />
              Accept risk
            </button>
          ) : null}

          {!isClosed && canClose ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || openActions > 0}
              title={openActions > 0 ? "Complete the open mitigation actions first" : undefined}
              onClick={() => openClose("RESOLVE")}
            >
              <CheckCircle2 size={16} />
              Resolve risk
            </button>
          ) : null}
        </div>
      </section>

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

      {risk.escalated ? (
        <div className="risk-escalated-banner">
          <Siren size={17} />

          <div>
            <strong>Escalated risk</strong>

            <span>
              Escalated by {risk.escalatedByName ?? "management"}
              {risk.escalatedAt ? ` on ${formatDateTime(risk.escalatedAt)}` : ""}
            </span>
          </div>
        </div>
      ) : null}

      {risk.overdue && !isClosed ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This risk is overdue.</strong>
            {risk.dueDate ? ` It was due on ${formatDate(risk.dueDate)}.` : ""} Update the due date
            or close the risk.
          </div>
        </div>
      ) : null}

      {canClose && !isClosed && openActions > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Resolving is blocked.</strong> {openActions} mitigation{" "}
            {openActions === 1 ? "action is" : "actions are"} still open. Complete{" "}
            {openActions === 1 ? "it" : "them"} to resolve the risk, or accept the risk instead.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Risk summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Risk context</span>

            <h2>Linked procurement records</h2>
          </div>
        </div>

        <div className="risk-context-grid">
          <div>
            <span>Supplier</span>

            {risk.supplierId ? (
              <Link href={`/suppliers/${risk.supplierId}`}>{risk.supplierName}</Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>Contract</span>

            {risk.contractId ? (
              <Link href={`/contracts/${risk.contractId}`}>{risk.contractNumber}</Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>Purchase order</span>

            {risk.purchaseOrderId ? (
              <Link href={`/purchase-orders/${risk.purchaseOrderId}`}>
                {risk.purchaseOrderNumber}
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>RFQ</span>

            {risk.rfqId ? (
              <Link href={`/rfqs/${risk.rfqId}`}>{risk.rfqNumber}</Link>
            ) : (
              <strong>—</strong>
            )}
          </div>
        </div>
      </section>

      {canManage && !isClosed ? (
        <AssessmentForm
          key={String(risk.id)}
          risk={risk}
          users={users}
          onSaved={applyRisk}
        />
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Mitigation plan</span>

            <h2>Mitigation actions</h2>
          </div>

          {canManage && !isClosed ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add action
            </button>
          ) : (
            <Target size={19} />
          )}
        </div>

        {totalActions > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={risk.completedMitigationActions}
              max={totalActions}
              tone={openActions === 0 ? meterToneFor("success") : "primary"}
              ariaLabel="Mitigation actions completed"
            />

            <span className="kit-meter-caption">
              {risk.completedMitigationActions} of {totalActions} actions completed
            </span>
          </div>
        ) : null}

        <DataTable
          columns={buildActionColumns(canManage, completingId, (action) =>
            void completeAction(action),
          )}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="Mitigation actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={Target}
              title="No mitigation actions"
              description="No mitigation actions have been created for this risk."
              action={
                canManage && !isClosed ? (
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

      {isClosed && risk.resolutionNote ? (
        <section className="risk-resolution-card">
          <CheckCircle2 size={21} />

          <div>
            <span>{risk.status === "ACCEPTED" ? "Risk accepted" : "Risk resolved"}</span>

            <strong>{risk.resolutionNote}</strong>

            <small>
              {risk.resolvedByName ?? "Management"}
              {risk.resolvedAt ? ` · ${formatDateTime(risk.resolvedAt)}` : ""}
            </small>
          </div>
        </section>
      ) : null}

      {adding ? (
        <AddActionModal
          risk={risk}
          users={users}
          onClose={() => setAdding(false)}
          onSaved={handleActionAdded}
        />
      ) : null}

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={LIFECYCLE[pendingAction].eyebrow}
          title={LIFECYCLE[pendingAction].title}
          description={lifecycleDescription(pendingAction, risk)}
          confirmLabel={LIFECYCLE[pendingAction].confirm}
          busyLabel={LIFECYCLE[pendingAction].busy}
          cancelLabel={LIFECYCLE[pendingAction].keep}
          busy={actionRunning}
          onConfirm={() => void confirmLifecycle()}
          onCancel={() => setPendingAction(null)}
        />
      ) : null}

      {closing !== null && closeInfo !== null ? (
        <RationaleDialog
          eyebrow="Management decision"
          title={closeInfo.title}
          description={closeInfo.description}
          label={closeInfo.label}
          placeholder={closeInfo.placeholder}
          confirmLabel={closeInfo.confirm}
          busyLabel={closeInfo.busy}
          maxLength={3000}
          busy={closeRunning}
          error={closeError}
          onConfirm={(note) => void confirmClose(note)}
          onCancel={() => setClosing(null)}
        />
      ) : null}
    </div>
  );
}
