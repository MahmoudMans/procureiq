"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  FileCheck2,
  Gauge,
  Info,
  Leaf,
  Play,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Users,
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
  approveSustainabilityAssessment,
  cancelSustainabilityAction,
  completeSustainabilityAction,
  createSustainabilityAction,
  getSustainabilityAssessment,
  getSustainabilityContext,
  rejectSustainabilityAssessment,
  rejectSustainabilityDeclaration,
  startSustainabilityAction,
  submitSustainabilityAssessment,
  uploadSustainabilityDeclaration,
  verifySustainabilityDeclaration,
} from "@/lib/api";
import type {
  SustainabilityAction,
  SustainabilityActionType,
  SustainabilityAssessment,
  SustainabilityContext,
  SustainabilityDeclaration,
} from "@/types/sustainability";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SustainUser = SustainabilityContext["users"][number];
type ActionField = "title" | "dueDate";

type RationaleRequest =
  | { kind: "VERIFY"; declaration: SustainabilityDeclaration }
  | { kind: "REJECT_DECLARATION"; declaration: SustainabilityDeclaration }
  | { kind: "APPROVE" }
  | { kind: "REJECT_ASSESSMENT" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: SustainUser[] = [];
const DAY_MS = 86400000;

const ACTION_TYPES: { value: SustainabilityActionType; label: string }[] = [
  { value: "CARBON_REDUCTION", label: "Carbon reduction" },
  { value: "LABOR_PRACTICES", label: "Labor practices" },
  { value: "GOVERNANCE_CONTROL", label: "Governance control" },
  { value: "RESPONSIBLE_SOURCING", label: "Responsible sourcing" },
  { value: "EVIDENCE_REMEDIATION", label: "Evidence remediation" },
  { value: "OTHER", label: "Other" },
];

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isOpenAction(action: SustainabilityAction): boolean {
  return action.status === "OPEN" || action.status === "IN_PROGRESS";
}

interface ExpiryNote {
  text: string;
  late: boolean;
}

function expiryNote(date: string, now: number | null): ExpiryNote | null {
  if (now === null) {
    return null;
  }

  const target = new Date(`${date}T00:00:00`).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  const days = Math.ceil((target - now) / DAY_MS);

  if (days < 0) {
    return { text: `Expired ${-days} ${-days === 1 ? "day" : "days"} ago`, late: true };
  }

  if (days === 0) {
    return { text: "Expires today", late: false };
  }

  if (days <= 30) {
    return { text: `Expires in ${days} ${days === 1 ? "day" : "days"}`, late: false };
  }

  return null;
}

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  tone: "primary" | "danger";
  done: string;
}

function rationaleCopy(request: RationaleRequest, assessment: SustainabilityAssessment): RationaleCopy {
  switch (request.kind) {
    case "VERIFY":
      return {
        eyebrow: "Declaration review",
        title: "Verify declaration",
        description: `Confirm that ${readable(request.declaration.declarationType)} is valid for ${assessment.supplierName}.`,
        label: "Review note",
        placeholder: "What was checked, and why is it valid?",
        confirm: "Verify declaration",
        busy: "Verifying…",
        tone: "primary",
        done: "Declaration verified",
      };

    case "REJECT_DECLARATION":
      return {
        eyebrow: "Declaration review",
        title: "Reject declaration",
        description: `${readable(request.declaration.declarationType)} will be rejected and no longer counts toward responsible-sourcing eligibility.`,
        label: "Rejection reason",
        placeholder: "What is wrong with this declaration?",
        confirm: "Reject declaration",
        busy: "Rejecting…",
        tone: "danger",
        done: "Declaration rejected",
      };

    case "APPROVE":
      return {
        eyebrow: "Sustainability governance",
        title: "Approve this assessment",
        description: `${assessment.assessmentNumber} for ${assessment.supplierName} will be approved.`,
        label: "Decision rationale",
        placeholder: "Why is this assessment being approved?",
        confirm: "Approve assessment",
        busy: "Approving…",
        tone: "primary",
        done: "Assessment approved",
      };

    case "REJECT_ASSESSMENT":
      return {
        eyebrow: "Sustainability governance",
        title: "Reject this assessment",
        description: `${assessment.assessmentNumber} for ${assessment.supplierName} will be rejected.`,
        label: "Decision rationale",
        placeholder: "What needs to change before this can be approved?",
        confirm: "Reject assessment",
        busy: "Rejecting…",
        tone: "danger",
        done: "Assessment rejected",
      };
  }
}

/* ------------------------------------------------------------------ */
/* Action table columns                                                */
/* ------------------------------------------------------------------ */

interface ActionColumnOptions {
  canManage: boolean;
  canApprove: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (action: SustainabilityAction) => void;
  onComplete: (action: SustainabilityAction) => void;
  onCancel: (action: SustainabilityAction) => void;
}

function buildActionColumns(options: ActionColumnOptions): Column<SustainabilityAction>[] {
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
/* Declaration card                                                    */
/* ------------------------------------------------------------------ */

interface DeclarationCardProps {
  declaration: SustainabilityDeclaration;
  assessmentId: string;
  canEdit: boolean;
  busy: boolean;
  now: number | null;
  onSaved: () => void;
  onReview: (kind: "VERIFY" | "REJECT", declaration: SustainabilityDeclaration) => void;
}

function DeclarationCard({
  declaration,
  assessmentId,
  canEdit,
  busy,
  now,
  onSaved,
  onReview,
}: DeclarationCardProps) {
  const toast = useToast();

  const [reference, setReference] = useState(declaration.documentReference ?? "");
  const [expiry, setExpiry] = useState(declaration.expiryDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savedReference = (declaration.documentReference ?? "").trim();
  const dirty = reference.trim() !== savedReference || expiry !== (declaration.expiryDate ?? "");
  const blocked = declaration.status === "REJECTED" || declaration.status === "EXPIRED";
  const expiryFlag = declaration.expiryDate ? expiryNote(declaration.expiryDate, now) : null;
  const reviewBlocked = savedReference === "" || dirty;

  async function save() {
    if (saving) {
      return;
    }

    if (!reference.trim()) {
      setError("Declaration document reference is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await uploadSustainabilityDeclaration(assessmentId, declaration.declarationType, {
        documentReference: reference.trim(),
        expiryDate: expiry || undefined,
      });

      toast.success("Declaration saved", readable(declaration.declarationType));
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save sustainability declaration.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={
        blocked
          ? "sustainability-declaration sustainability-declaration--blocked"
          : "sustainability-declaration"
      }
    >
      <div className="sustainability-declaration-heading">
        <div>
          <strong>{readable(declaration.declarationType)}</strong>

          <span>{declaration.mandatory ? "Mandatory" : "Optional"}</span>
        </div>

        <StatusBadge value={declaration.status} />
      </div>

      <div className="sustainability-declaration-fields">
        <label>
          <span>Document / declaration reference</span>

          <input
            disabled={!canEdit}
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setError(null);
            }}
          />
        </label>

        <label>
          <span>Expiry date</span>

          <input
            type="date"
            disabled={!canEdit}
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <small className="kit-text-danger" role="alert">
          {error}
        </small>
      ) : null}

      {expiryFlag ? (
        <small className={expiryFlag.late ? "kit-text-danger" : "kit-text-warning"}>
          {expiryFlag.text}
        </small>
      ) : null}

      {canEdit ? (
        <div className="sustainability-declaration-controls">
          <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? "Saving…" : "Save declaration"}
          </button>

          <button
            type="button"
            disabled={busy || reviewBlocked}
            title={
              reviewBlocked
                ? "Save the declaration reference before reviewing it"
                : "Verify this declaration"
            }
            onClick={() => onReview("VERIFY", declaration)}
          >
            <BadgeCheck size={14} />
            Verify
          </button>

          <button
            type="button"
            className="sustainability-danger-button"
            disabled={busy || reviewBlocked}
            title={
              reviewBlocked
                ? "Save the declaration reference before reviewing it"
                : "Reject this declaration"
            }
            onClick={() => onReview("REJECT", declaration)}
          >
            <XCircle size={14} />
            Reject
          </button>
        </div>
      ) : null}

      {declaration.reviewNote ? (
        <div className="sustainability-review-note">
          {declaration.reviewNote}
          {declaration.reviewedByName ? ` — ${declaration.reviewedByName}` : ""}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Add ESG action                                                      */
/* ------------------------------------------------------------------ */

interface AddActionModalProps {
  assessmentId: string;
  assessmentNumber: string;
  users: SustainUser[];
  defaultOwnerId: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function AddActionModal({
  assessmentId,
  assessmentNumber,
  users,
  defaultOwnerId,
  onClose,
  onSaved,
}: AddActionModalProps) {
  const [type, setType] = useState<SustainabilityActionType>("CARBON_REDUCTION");
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
      await createSustainabilityAction(assessmentId, {
        actionType: type,
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerId || undefined,
        dueDate,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create sustainability action.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Improvement governance"
      title="Add ESG action"
      description={`An improvement step tracked in ${assessmentNumber}.`}
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
            form="sustainability-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add action"}
          </button>
        </>
      }
    >
      <form id="sustainability-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Action type" htmlFor="esg-action-type">
            <select
              id="esg-action-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as SustainabilityActionType)}
            >
              {ACTION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="esg-action-due" error={errors.dueDate}>
            <input
              id="esg-action-due"
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
            <Field label="Action title" htmlFor="esg-action-title" error={errors.title}>
              <input
                id="esg-action-title"
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
            <Field label="Description" htmlFor="esg-action-description">
              <textarea
                id="esg-action-description"
                className="kit-field-input"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Owner" htmlFor="esg-action-owner">
              <select
                id="esg-action-owner"
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

interface SustainData {
  id: string;
  assessment: SustainabilityAssessment;
  users: SustainUser[];
}

export default function SustainabilityAssessmentPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<SustainData | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitRunning, setSubmitRunning] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<SustainabilityAction | null>(null);
  const [completeRunning, setCompleteRunning] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<SustainabilityAction | null>(null);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const [assessmentResponse, contextResponse] = await Promise.all([
          getSustainabilityAssessment(id),
          getSustainabilityContext(),
        ]);

        if (active) {
          setResult({
            id,
            assessment: assessmentResponse,
            users: contextResponse.users.filter((candidate) => candidate.role !== "REQUESTER"),
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load sustainability assessment.",
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

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);

    return () => window.clearTimeout(timer);
  }, [result]);

  const data = result !== null && result.id === params.id ? result : null;
  const assessment = data?.assessment ?? null;
  const users = data?.users ?? EMPTY_USERS;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  if (assessment === null) {
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
        <Link href="/sustainability" className="request-back-link">
          <ArrowLeft size={16} />
          Sustainability
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

  const assessmentId = params.id;
  const status = assessment.status;
  const editable = status === "DRAFT" || status === "SUBMITTED";
  const canEdit = canManage && editable;
  const busyAny =
    submitRunning || rationaleRunning || completeRunning || cancelRunning || workingId !== null;

  const mandatory = assessment.mandatoryDeclarations;
  const verified = assessment.verifiedMandatoryDeclarations;
  const unverified = Math.max(0, mandatory - verified);
  const allVerified = unverified === 0;

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      await submitSustainabilityAssessment(assessmentId);

      setSubmitOpen(false);

      toast.success("Assessment submitted", assessment!.assessmentNumber);
      reload();
    } catch (caught) {
      setSubmitOpen(false);

      toast.error(
        "Could not submit the assessment",
        caught instanceof Error ? caught.message : "Unable to submit sustainability assessment.",
      );
    } finally {
      setSubmitRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, assessment!);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      switch (request.kind) {
        case "VERIFY":
          await verifySustainabilityDeclaration(request.declaration.id, note);
          break;

        case "REJECT_DECLARATION":
          await rejectSustainabilityDeclaration(request.declaration.id, note);
          break;

        case "APPROVE":
          await approveSustainabilityAssessment(assessmentId, note);
          break;

        case "REJECT_ASSESSMENT":
          await rejectSustainabilityAssessment(assessmentId, note);
          break;
      }

      setRationale(null);

      toast.success(copy.done, assessment!.assessmentNumber);
      reload();
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to record the sustainability decision.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(request: RationaleRequest) {
    setRationaleError(null);
    setRationale(request);
  }

  async function startAction(action: SustainabilityAction) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(action.id));

    try {
      await startSustainabilityAction(action.id);

      toast.success("Action started", action.title);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the action",
        caught instanceof Error ? caught.message : "Unable to start sustainability action.",
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
      await completeSustainabilityAction(action.id, note);

      setCompleting(null);

      toast.success("Action completed", action.title);
      reload();
    } catch (caught) {
      setCompleteError(
        caught instanceof Error ? caught.message : "Unable to complete sustainability action.",
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
      await cancelSustainabilityAction(action.id);

      setCancelling(null);

      toast.success("Action cancelled", action.title);
      reload();
    } catch (caught) {
      setCancelling(null);

      toast.error(
        "Could not cancel the action",
        caught instanceof Error ? caught.message : "Unable to cancel sustainability action.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  function handleActionAdded(title: string) {
    setAdding(false);
    toast.success("ESG action added", title);
    reload();
  }

  const actions = assessment.actions;
  const openActions = actions.filter(isOpenAction);
  const overdueOpen = openActions.filter((action) => action.overdue);

  const orderedActions = [...actions].sort((a, b) => {
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

  const reviewDate = assessment.nextReviewDate;
  const reviewOverdue =
    status === "APPROVED" &&
    now !== null &&
    reviewDate !== null &&
    reviewDate !== undefined &&
    new Date(`${reviewDate}T00:00:00`).getTime() < now;

  const defaultOwnerId = users.some((candidate) => candidate.id === assessment.ownerUserId)
    ? assessment.ownerUserId
    : (users[0]?.id ?? "");

  const canAddAction = canManage && status !== "REJECTED";
  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, assessment) : null;

  const kpis: KpiItem[] = [
    {
      label: "Environmental",
      icon: Leaf,
      value: assessment.environmentalScore.toFixed(1),
      note: "40% weighting",
    },
    {
      label: "Social",
      icon: Users,
      value: assessment.socialScore.toFixed(1),
      note: "35% weighting",
    },
    {
      label: "Governance",
      icon: Scale,
      value: assessment.governanceScore.toFixed(1),
      note: "25% weighting",
    },
    {
      label: "Overall ESG",
      icon: Gauge,
      value: assessment.overallScore.toFixed(1),
      note: readable(assessment.rating),
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
      <Link href="/sustainability" className="request-back-link">
        <ArrowLeft size={16} />
        Sustainability
      </Link>

      <section className="sustainability-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{assessment.assessmentNumber}</span>

            <StatusBadge value={status} />

            <StatusBadge value={assessment.rating} />
          </div>

          <h1>{assessment.supplierName}</h1>

          <p>
            {assessment.supplierCode}
            {" · "}
            {assessment.supplierCategory ?? "Uncategorized"}
            {" · Owner: "}
            {assessment.ownerName}
          </p>
        </div>

        <div className="sustainability-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canApprove && status === "SUBMITTED" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "REJECT_ASSESSMENT" })}
            >
              <XCircle size={16} />
              Reject assessment
            </button>
          ) : null}

          {canApprove && status === "SUBMITTED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !allVerified}
              title={allVerified ? undefined : "Verify every mandatory declaration first"}
              onClick={() => openRationale({ kind: "APPROVE" })}
            >
              <BadgeCheck size={16} />
              Approve assessment
            </button>
          ) : null}

          {canManage && status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setSubmitOpen(true)}
            >
              <FileCheck2 size={16} />
              Submit assessment
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

      {status === "DRAFT" && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: complete the declarations, then submit.</strong>{" "}
            {mandatory > 0
              ? `${verified} of ${mandatory} mandatory declarations are verified.`
              : "No mandatory declarations apply."}
          </div>
        </div>
      ) : null}

      {status === "SUBMITTED" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting a decision.</strong>{" "}
            {canApprove
              ? allVerified
                ? "Approve or reject this assessment using the buttons above."
                : `Approval is blocked until every mandatory declaration is verified (${verified} of ${mandatory}).`
              : "A procurement manager or administrator needs to approve or reject this assessment."}
          </div>
        </div>
      ) : null}

      {reviewOverdue && reviewDate ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The next review date has passed.</strong> This assessment was due for review on{" "}
            {formatDate(reviewDate)}.
          </div>
        </div>
      ) : null}

      {overdueOpen.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueOpen.length} improvement {overdueOpen.length === 1 ? "action is" : "actions are"}{" "}
              overdue.
            </strong>{" "}
            Complete or cancel {overdueOpen.length === 1 ? "it" : "them"} in the plan below.
          </div>
        </div>
      ) : null}

      <section
        role="status"
        className={
          assessment.responsibleSourcingEligible
            ? "sustainability-eligibility sustainability-eligibility--pass"
            : "sustainability-eligibility"
        }
      >
        {assessment.responsibleSourcingEligible ? (
          <BadgeCheck size={20} />
        ) : (
          <AlertTriangle size={20} />
        )}

        <div>
          <strong>
            {assessment.responsibleSourcingEligible
              ? "Responsible-sourcing eligible"
              : "Responsible-sourcing eligibility blocked"}
          </strong>

          <p>
            ESG approval: {status === "APPROVED" ? "Yes" : "No"}
            {" · Mandatory declarations: "}
            {verified}
            {" / "}
            {mandatory}
            {" · Onboarding clearance: "}
            {assessment.onboardingClearance ? "Yes" : "No"}
          </p>
        </div>
      </section>

      <KpiGrid items={kpis} ariaLabel="ESG scores" />

      <section className="sustainability-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Responsible sourcing</span>

              <h2>Mandatory declarations</h2>
            </div>

            <ShieldCheck size={19} />
          </div>

          {mandatory > 0 ? (
            <div className="kit-meter-wrap">
              <Meter
                value={Math.min(verified, mandatory)}
                max={mandatory}
                tone={allVerified ? meterToneFor("success") : "primary"}
                ariaLabel="Mandatory declarations verified"
              />

              <span className="kit-meter-caption">
                {verified} of {mandatory} mandatory declarations verified
              </span>
            </div>
          ) : null}

          {assessment.declarations.length === 0 ? (
            <EmptyState
              compact
              icon={ShieldCheck}
              title="No declarations"
              description="No responsible-sourcing declarations apply to this assessment."
            />
          ) : (
            <div className="sustainability-declaration-list">
              {assessment.declarations.map((declaration) => (
                <DeclarationCard
                  key={declaration.id}
                  declaration={declaration}
                  assessmentId={assessmentId}
                  canEdit={canEdit}
                  busy={busyAny}
                  now={now}
                  onSaved={reload}
                  onReview={(kind, item) =>
                    openRationale(
                      kind === "VERIFY"
                        ? { kind: "VERIFY", declaration: item }
                        : { kind: "REJECT_DECLARATION", declaration: item },
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Governance context</span>

              <h2>Assessment status</h2>
            </div>

            <Leaf size={19} />
          </div>

          <div className="sustainability-context-grid">
            <div>
              <span>Supplier risk</span>

              <strong>{assessment.supplierRiskLevel ?? "—"}</strong>
            </div>

            <div>
              <span>Country</span>

              <strong>{assessment.supplierCountry ?? "—"}</strong>
            </div>

            <div>
              <span>Assessment date</span>

              <strong>{formatDate(assessment.assessmentDate)}</strong>
            </div>

            <div>
              <span>Next review</span>

              <strong>{assessment.nextReviewDate ? formatDate(assessment.nextReviewDate) : "—"}</strong>
            </div>

            <div>
              <span>Onboarding clearance</span>

              <strong>{assessment.onboardingClearance ? "Cleared" : "Not cleared"}</strong>
            </div>

            <div>
              <span>Open actions</span>

              <strong>{assessment.openActions}</strong>
            </div>
          </div>

          {assessment.notes ? <div className="sustainability-notes">{assessment.notes}</div> : null}

          {assessment.reviewNote ? (
            <div className="sustainability-review-card">
              <strong>Governance decision</strong>

              <p>{assessment.reviewNote}</p>

              <span>
                {assessment.reviewedByName ?? "Procurement governance"}
                {assessment.reviewedAt ? ` · ${formatDateTime(assessment.reviewedAt)}` : ""}
              </span>
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Supplier improvement</span>

            <h2>ESG improvement plan</h2>
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
            <Wrench size={19} />
          )}
        </div>

        {actions.length > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={actions.length - openActions.length}
              max={actions.length}
              tone={openActions.length === 0 ? meterToneFor("success") : "primary"}
              ariaLabel="Improvement actions finished"
            />

            <span className="kit-meter-caption">
              {actions.length - openActions.length} of {actions.length} actions finished
            </span>
          </div>
        ) : null}

        <DataTable
          columns={actionColumns}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="ESG improvement actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={Wrench}
              title="No improvement actions"
              description="No sustainability improvement actions are currently recorded."
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
          assessmentId={assessmentId}
          assessmentNumber={assessment.assessmentNumber}
          users={users}
          defaultOwnerId={defaultOwnerId}
          onClose={() => setAdding(false)}
          onSaved={handleActionAdded}
        />
      ) : null}

      {submitOpen ? (
        <ActionDialog
          eyebrow="Submit assessment"
          title="Submit this assessment?"
          description={`${assessment.assessmentNumber} for ${assessment.supplierName} will be sent for a governance decision.`}
          confirmLabel="Submit assessment"
          busyLabel="Submitting…"
          cancelLabel="Not yet"
          busy={submitRunning}
          onConfirm={() => void confirmSubmit()}
          onCancel={() => setSubmitOpen(false)}
        >
          {unverified > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {unverified} mandatory {unverified === 1 ? "declaration is" : "declarations are"} not
              verified yet. Approval stays blocked until they are.
            </p>
          ) : null}
        </ActionDialog>
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
          tone={rationaleInfo.tone}
          maxLength={2000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}

      {completing !== null ? (
        <RationaleDialog
          eyebrow="ESG action"
          title="Complete this action"
          description={`Record the completion evidence for “${completing.title}”.`}
          label="Completion evidence"
          placeholder="What was done, and what evidence confirms it?"
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
          eyebrow="ESG action"
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
