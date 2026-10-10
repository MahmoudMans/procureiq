"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock3,
  FileCheck2,
  Info,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
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
  Modal,
  SegmentedFilter,
  type SegmentedOption,
  Skeleton,
  type StatItem,
  StatStrip,
  StatusBadge,
  formatDateTime,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addInternalCollaborationMessage,
  cancelSupplierCollaborationAction,
  closeSupplierCollaborationWorkspace,
  completeSupplierCollaborationAction,
  createSupplierCollaborationAction,
  getSupplierCollaborationContext,
  getSupplierCollaborationWorkspace,
  recordSupplierCollaborationResponse,
  resolveSupplierCollaborationWorkspace,
  sendSupplierCollaborationMessage,
  startSupplierCollaborationAction,
} from "@/lib/api";
import type {
  CollaborationAction,
  CollaborationActionAudience,
  CollaborationActionType,
  CollaborationContext,
  CollaborationMessageType,
  CollaborationWorkspaceDetail,
} from "@/types/supplier-collaboration";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Workspace = CollaborationWorkspaceDetail["workspace"];
type Message = CollaborationWorkspaceDetail["messages"][number];
type CollabUser = CollaborationContext["users"][number];
type ComposeMode = "INTERNAL" | "SHARED" | "REPLY";
type MessageKind = "INTERNAL" | "SHARED" | "REPLY";
type CloseKind = "RESOLVE" | "CLOSE";
type ComposeField = "body" | "contact";
type ActionField = "title" | "assignee" | "dueAt";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const CLOSE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: CollabUser[] = [];

const MESSAGE_TYPES: { value: CollaborationMessageType; label: string }[] = [
  { value: "COMMENT", label: "Comment" },
  { value: "CLARIFICATION", label: "Clarification" },
  { value: "STATUS_UPDATE", label: "Status update" },
  { value: "DOCUMENT_REQUEST", label: "Document request" },
  { value: "DELIVERY_UPDATE", label: "Delivery update" },
  { value: "ISSUE", label: "Issue" },
];

const ACTION_TYPES: { value: CollaborationActionType; label: string }[] = [
  { value: "ACKNOWLEDGE_PO", label: "Acknowledge PO" },
  { value: "CONFIRM_DELIVERY", label: "Confirm delivery" },
  { value: "PROVIDE_DOCUMENT", label: "Provide document" },
  { value: "ANSWER_CLARIFICATION", label: "Answer clarification" },
  { value: "RESOLVE_ISSUE", label: "Resolve issue" },
  { value: "OTHER", label: "Other" },
];

interface ComposeCopy {
  eyebrow: string;
  title: string;
  description: string;
  bodyLabel: string;
  submit: string;
  busy: string;
  defaultType: CollaborationMessageType;
  done: string;
}

const COMPOSE: Record<ComposeMode, ComposeCopy> = {
  INTERNAL: {
    eyebrow: "Internal only",
    title: "Add internal note",
    description: "Visible to your team only. The supplier will not see it.",
    bodyLabel: "Note",
    submit: "Add note",
    busy: "Saving…",
    defaultType: "COMMENT",
    done: "Internal note added",
  },
  SHARED: {
    eyebrow: "Supplier shared",
    title: "Send to supplier ledger",
    description: "Recorded in the supplier-shared ledger of this workspace.",
    bodyLabel: "Shared message",
    submit: "Record message",
    busy: "Recording…",
    defaultType: "CLARIFICATION",
    done: "Message recorded",
  },
  REPLY: {
    eyebrow: "Supplier response",
    title: "Record supplier reply",
    description: "Log a reply you received from the supplier.",
    bodyLabel: "Supplier response",
    submit: "Record reply",
    busy: "Recording…",
    defaultType: "CLARIFICATION",
    done: "Supplier reply recorded",
  },
};

/** Local date and time for a datetime-local input. */
function defaultDueAt(): string {
  const date = new Date();

  date.setDate(date.getDate() + 7);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function messageKind(message: Message): MessageKind {
  if (message.direction === "FROM_SUPPLIER") {
    return "REPLY";
  }

  if (message.visibility === "INTERNAL_ONLY") {
    return "INTERNAL";
  }

  return "SHARED";
}

function isOpenAction(action: CollaborationAction): boolean {
  return action.status === "OPEN" || action.status === "IN_PROGRESS";
}

interface CloseCopy {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  tone: "primary" | "danger";
  done: string;
  failed: string;
}

function closeCopy(kind: CloseKind, workspace: Workspace, openCount: number): CloseCopy {
  const pending =
    openCount > 0
      ? ` ${openCount} collaboration ${openCount === 1 ? "action is" : "actions are"} still open.`
      : "";

  if (kind === "RESOLVE") {
    return {
      title: "Resolve this workspace",
      description: `${workspace.workspaceNumber} will be marked as resolved.${pending}`,
      label: "Resolution note",
      placeholder: "How was this resolved?",
      confirm: "Resolve workspace",
      busy: "Resolving…",
      tone: "primary",
      done: "Workspace resolved",
      failed: "Could not resolve the workspace",
    };
  }

  return {
    title: "Close this workspace",
    description: `${workspace.workspaceNumber} will be closed, and no further messages or actions can be added.${pending}`,
    label: "Closure note",
    placeholder: "Why is this workspace being closed?",
    confirm: "Close workspace",
    busy: "Closing…",
    tone: "primary",
    done: "Workspace closed",
    failed: "Could not close the workspace",
  };
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ActionColumnOptions {
  canManage: boolean;
  canClose: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (action: CollaborationAction) => void;
  onComplete: (action: CollaborationAction) => void;
  onCancel: (action: CollaborationAction) => void;
}

function buildActionColumns(options: ActionColumnOptions): Column<CollaborationAction>[] {
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
      id: "assignee",
      header: "Assignee",
      sortValue: (action) =>
        (action.audience === "SUPPLIER"
          ? (action.externalAssigneeLabel ?? "")
          : (action.assigneeName ?? "")
        ).toLowerCase(),
      cell: (action) => (
        <div className="kit-cell-stack">
          <span>
            {(action.audience === "SUPPLIER" ? action.externalAssigneeLabel : action.assigneeName) ??
              "—"}
          </span>

          <small>{action.audience === "SUPPLIER" ? "Supplier" : "Internal"}</small>
        </div>
      ),
    },
    {
      id: "due",
      header: "Due",
      sortValue: (action) => action.dueAt,
      cell: (action) => (
        <div className="kit-cell-stack">
          <span>{formatDateTime(action.dueAt)}</span>

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

            {options.canClose ? (
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
/* Compose modal                                                       */
/* ------------------------------------------------------------------ */

interface ComposeModalProps {
  mode: ComposeMode;
  workspaceId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function ComposeModal({ mode, workspaceId, onClose, onSaved }: ComposeModalProps) {
  const copy = COMPOSE[mode];

  const [type, setType] = useState<CollaborationMessageType>(copy.defaultType);
  const [contact, setContact] = useState("");
  const [body, setBody] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ComposeField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: ComposeField) {
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

    const next: Partial<Record<ComposeField, string>> = {};

    if (!body.trim()) {
      next.body = "Enter a message.";
    }

    if (mode === "REPLY" && !contact.trim()) {
      next.contact = "Enter the supplier contact.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const referenceText = reference.trim() || undefined;

      if (mode === "INTERNAL") {
        await addInternalCollaborationMessage(workspaceId, {
          messageType: type,
          body: body.trim(),
          referenceText,
        });
      } else if (mode === "SHARED") {
        await sendSupplierCollaborationMessage(workspaceId, {
          messageType: type,
          body: body.trim(),
          referenceText,
        });
      } else {
        await recordSupplierCollaborationResponse(workspaceId, {
          messageType: type,
          supplierContactName: contact.trim(),
          body: body.trim(),
          referenceText,
        });
      }

      onSaved(copy.done);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the message.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
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
            form="collaboration-compose-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? copy.busy : copy.submit}
          </button>
        </>
      }
    >
      <form id="collaboration-compose-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Message type" htmlFor="compose-type">
            <select
              id="compose-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as CollaborationMessageType)}
            >
              {MESSAGE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          {mode === "REPLY" ? (
            <Field label="Supplier contact" htmlFor="compose-contact" error={errors.contact}>
              <input
                id="compose-contact"
                className="kit-field-input"
                maxLength={200}
                value={contact}
                aria-invalid={errors.contact ? true : undefined}
                onChange={(event) => {
                  setContact(event.target.value);
                  clearError("contact");
                }}
              />
            </Field>
          ) : (
            <Field label="Reference" htmlFor="compose-reference">
              <input
                id="compose-reference"
                className="kit-field-input"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
          )}

          <div className="kit-pair-wide">
            <Field label={copy.bodyLabel} htmlFor="compose-body" error={errors.body}>
              <textarea
                id="compose-body"
                className="kit-field-input"
                rows={6}
                value={body}
                aria-invalid={errors.body ? true : undefined}
                onChange={(event) => {
                  setBody(event.target.value);
                  clearError("body");
                }}
              />
            </Field>
          </div>

          {mode === "REPLY" ? (
            <div className="kit-pair-wide">
              <Field label="Reference" htmlFor="compose-reference-reply">
                <input
                  id="compose-reference-reply"
                  className="kit-field-input"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </Field>
            </div>
          ) : null}
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
/* Create action modal                                                 */
/* ------------------------------------------------------------------ */

interface ActionModalProps {
  workspace: Workspace;
  workspaceId: string;
  users: CollabUser[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

function ActionModal({ workspace, workspaceId, users, onClose, onSaved }: ActionModalProps) {
  const [type, setType] = useState<CollaborationActionType>("ANSWER_CLARIFICATION");
  const [audience, setAudience] = useState<CollaborationActionAudience>("SUPPLIER");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(users[0]?.id ?? "");
  const [supplierLabel, setSupplierLabel] = useState(workspace.supplierName);
  const [dueAt, setDueAt] = useState(defaultDueAt);
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

    if (audience === "INTERNAL" && !assigneeId) {
      next.assignee = "Choose an assignee.";
    }

    if (audience === "SUPPLIER" && !supplierLabel.trim()) {
      next.assignee = "Enter the supplier or contact.";
    }

    const due = new Date(dueAt);

    if (!dueAt || Number.isNaN(due.getTime())) {
      next.dueAt = "Choose a valid due date and time.";
    } else if (due.getTime() < Date.now()) {
      next.dueAt = "The due time cannot be in the past.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createSupplierCollaborationAction(workspaceId, {
        actionType: type,
        audience,
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeUserId: audience === "INTERNAL" ? assigneeId : undefined,
        externalAssigneeLabel: audience === "SUPPLIER" ? supplierLabel.trim() : undefined,
        dueAt: due.toISOString(),
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create collaboration action.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="New request"
      title="Create collaboration action"
      description={`A request tracked in ${workspace.workspaceNumber}.`}
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
            form="collaboration-action-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Creating…" : "Create action"}
          </button>
        </>
      }
    >
      <form id="collaboration-action-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Action type" htmlFor="collab-action-type">
            <select
              id="collab-action-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as CollaborationActionType)}
            >
              {ACTION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Audience" htmlFor="collab-action-audience">
            <select
              id="collab-action-audience"
              className="kit-field-input"
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value as CollaborationActionAudience);
                clearError("assignee");
              }}
            >
              <option value="SUPPLIER">Supplier</option>

              <option value="INTERNAL">Internal</option>
            </select>
          </Field>

          <div className="kit-pair-wide">
            <Field label="Action title" htmlFor="collab-action-title" error={errors.title}>
              <input
                id="collab-action-title"
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
            <Field label="Description" htmlFor="collab-action-description">
              <textarea
                id="collab-action-description"
                className="kit-field-input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          {audience === "INTERNAL" ? (
            <Field label="Internal assignee" htmlFor="collab-action-assignee" error={errors.assignee}>
              <select
                id="collab-action-assignee"
                className="kit-field-input"
                value={assigneeId}
                aria-invalid={errors.assignee ? true : undefined}
                onChange={(event) => {
                  setAssigneeId(event.target.value);
                  clearError("assignee");
                }}
              >
                {users.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} — {candidate.role}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field
              label="Supplier / contact label"
              htmlFor="collab-action-supplier"
              error={errors.assignee}
            >
              <input
                id="collab-action-supplier"
                className="kit-field-input"
                value={supplierLabel}
                aria-invalid={errors.assignee ? true : undefined}
                onChange={(event) => {
                  setSupplierLabel(event.target.value);
                  clearError("assignee");
                }}
              />
            </Field>
          )}

          <Field label="Due date / time" htmlFor="collab-action-due" error={errors.dueAt}>
            <input
              id="collab-action-due"
              className="kit-field-input"
              type="datetime-local"
              value={dueAt}
              aria-invalid={errors.dueAt ? true : undefined}
              onChange={(event) => {
                setDueAt(event.target.value);
                clearError("dueAt");
              }}
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

interface CollabData {
  id: string;
  detail: CollaborationWorkspaceDetail;
  context: CollaborationContext;
}

export default function SupplierCollaborationDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canClose = user !== null && CLOSE_ROLES.includes(user.role);

  const [result, setResult] = useState<CollabData | null>(null);
  const [composeMode, setComposeMode] = useState<ComposeMode | null>(null);
  const [creatingAction, setCreatingAction] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<CollaborationAction | null>(null);
  const [completeRunning, setCompleteRunning] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<CollaborationAction | null>(null);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [closing, setClosing] = useState<CloseKind | null>(null);
  const [closeRunning, setCloseRunning] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [messageView, setMessageView] = useState("ALL");
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
        const [workspaceResponse, contextResponse] = await Promise.all([
          getSupplierCollaborationWorkspace(id),
          getSupplierCollaborationContext(),
        ]);

        if (active) {
          setResult({ id, detail: workspaceResponse, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load supplier collaboration workspace.",
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
  const users = data ? data.context.users.filter((candidate) => candidate.role !== "REQUESTER") : EMPTY_USERS;

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
        <Link href="/supplier-collaboration" className="request-back-link">
          <ArrowLeft size={16} />
          Supplier collaboration
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

  const { workspace, messages, actions } = detail;

  const workspaceOpen = workspace.status !== "RESOLVED" && workspace.status !== "CLOSED";
  const busyAny = completeRunning || cancelRunning || closeRunning || workingId !== null;

  const openActions = actions.filter(isOpenAction);
  const overdueActions = openActions.filter((action) => action.overdue);

  async function startAction(action: CollaborationAction) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(action.id));

    try {
      await startSupplierCollaborationAction(action.id);

      toast.success("Action started", action.title);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the action",
        caught instanceof Error ? caught.message : "Unable to start collaboration action.",
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
      await completeSupplierCollaborationAction(action.id, note);

      setCompleting(null);

      toast.success("Action completed", action.title);
      reload();
    } catch (caught) {
      setCompleteError(
        caught instanceof Error ? caught.message : "Unable to complete collaboration action.",
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
      await cancelSupplierCollaborationAction(action.id);

      setCancelling(null);

      toast.success("Action cancelled", action.title);
      reload();
    } catch (caught) {
      setCancelling(null);

      toast.error(
        "Could not cancel the action",
        caught instanceof Error ? caught.message : "Unable to cancel collaboration action.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  async function confirmClose(note: string) {
    if (closing === null) {
      return;
    }

    const kind = closing;
    const copy = closeCopy(kind, workspace, openActions.length);

    setCloseRunning(true);
    setCloseError(null);

    try {
      if (kind === "RESOLVE") {
        await resolveSupplierCollaborationWorkspace(params.id, note);
      } else {
        await closeSupplierCollaborationWorkspace(params.id, note);
      }

      setClosing(null);

      toast.success(copy.done, workspace.workspaceNumber);
      reload();
    } catch (caught) {
      setCloseError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setCloseRunning(false);
    }
  }

  function openClose(kind: CloseKind) {
    setCloseError(null);
    setClosing(kind);
  }

  function handleComposed(message: string) {
    setComposeMode(null);
    toast.success(message, workspace.workspaceNumber);
    reload();
  }

  function handleActionCreated(title: string) {
    setCreatingAction(false);
    toast.success("Collaboration action created", title);
    reload();
  }

  const internalCount = messages.filter((message) => messageKind(message) === "INTERNAL").length;
  const sharedCount = messages.filter((message) => messageKind(message) === "SHARED").length;
  const replyCount = messages.filter((message) => messageKind(message) === "REPLY").length;

  const shownMessages = messages.filter(
    (message) => messageView === "ALL" || messageKind(message) === messageView,
  );

  const messageOptions: SegmentedOption[] = [
    { value: "ALL", label: `All · ${messages.length}` },
    { value: "SHARED", label: `Shared · ${sharedCount}` },
    { value: "REPLY", label: `Replies · ${replyCount}` },
    { value: "INTERNAL", label: `Internal · ${internalCount}` },
  ];

  const orderedActions = [...actions].sort((a, b) => {
    const left = isOpenAction(a) ? 0 : 1;
    const right = isOpenAction(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return a.dueAt.localeCompare(b.dueAt);
  });

  const stats: StatItem[] = [
    { label: "Messages", value: String(messages.length) },
    { label: "Supplier replies", value: String(workspace.supplierResponseCount) },
    { label: "Open actions", value: String(openActions.length) },
    { label: "Overdue actions", value: String(overdueActions.length) },
  ];

  const actionColumns = buildActionColumns({
    canManage,
    canClose,
    workingId,
    busy: busyAny,
    onStart: (action) => void startAction(action),
    onComplete: (action) => {
      setCompleteError(null);
      setCompleting(action);
    },
    onCancel: (action) => setCancelling(action),
  });

  const canCompose = canManage && workspaceOpen;
  const closeInfo = closing !== null ? closeCopy(closing, workspace, openActions.length) : null;

  return (
    <div className="page-stack">
      <Link href="/supplier-collaboration" className="request-back-link">
        <ArrowLeft size={16} />
        Supplier collaboration
      </Link>

      <section className="collaboration-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{workspace.workspaceNumber}</span>

            <StatusBadge value={workspace.status} />

            <StatusBadge value={workspace.priority} />
          </div>

          <h1>{workspace.title}</h1>

          <p>
            {workspace.supplierName}
            {" · "}
            {workspace.supplierCode}
            {" · "}
            {readable(workspace.workspaceType)}
          </p>
        </div>

        <div
          className={
            workspace.responseSlaBreached
              ? "collaboration-sla-card collaboration-sla-card--breached"
              : "collaboration-sla-card"
          }
        >
          <Clock3 size={17} />

          <div>
            <span>Supplier response SLA</span>

            <strong>
              {workspace.responseSlaBreached
                ? "Breached"
                : `${workspace.supplierResponseSlaHours}h`}
            </strong>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="button button--secondary"
          onClick={reload}
          disabled={fetching}
        >
          <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
          Refresh
        </button>

        {canManage && workspaceOpen ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busyAny}
            onClick={() => openClose("RESOLVE")}
          >
            <BadgeCheck size={16} />
            Resolve workspace
          </button>
        ) : null}

        {canClose && workspaceOpen ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busyAny}
            onClick={() => openClose("CLOSE")}
          >
            Close workspace
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {workspaceOpen && workspace.responseSlaBreached ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The supplier response SLA has been breached.</strong> The supplier has not
            responded within {workspace.supplierResponseSlaHours} hours. Follow up, or record their
            reply if you have one.
          </div>
        </div>
      ) : null}

      {workspaceOpen && !workspace.responseSlaBreached && workspace.supplierResponseCount === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No supplier reply recorded yet.</strong> The response SLA is{" "}
            {workspace.supplierResponseSlaHours} hours.
          </div>
        </div>
      ) : null}

      {overdueActions.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueActions.length} collaboration{" "}
              {overdueActions.length === 1 ? "action is" : "actions are"} overdue.
            </strong>{" "}
            Complete or cancel {overdueActions.length === 1 ? "it" : "them"} below.
          </div>
        </div>
      ) : null}

      <StatStrip items={stats} />

      <section className="collaboration-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Communication ledger</span>

              <h2>Messages</h2>
            </div>

            {canCompose ? (
              <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setComposeMode("INTERNAL")}
                >
                  <UserRound size={15} />
                  Internal note
                </button>

                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setComposeMode("REPLY")}
                >
                  <MessageSquareText size={15} />
                  Record reply
                </button>

                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setComposeMode("SHARED")}
                >
                  <Send size={15} />
                  Share with supplier
                </button>
              </div>
            ) : (
              <MessageSquareText size={19} />
            )}
          </div>

          {messages.length > 0 ? (
            <div className="kit-toolbar" style={{ marginBottom: 14 }}>
              <SegmentedFilter
                options={messageOptions}
                value={messageView}
                onChange={setMessageView}
                ariaLabel="Filter messages"
              />
            </div>
          ) : null}

          {messages.length === 0 ? (
            <EmptyState
              compact
              icon={MessageSquareText}
              title="No messages yet"
              description="No messages have been recorded in this workspace."
            />
          ) : shownMessages.length === 0 ? (
            <EmptyState
              compact
              icon={MessageSquareText}
              title="Nothing in this view"
              description="No messages match the selected filter."
            />
          ) : (
            <div className="collaboration-message-list">
              {shownMessages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.direction === "FROM_SUPPLIER"
                      ? "collaboration-message collaboration-message--supplier"
                      : message.visibility === "INTERNAL_ONLY"
                        ? "collaboration-message collaboration-message--internal"
                        : "collaboration-message collaboration-message--outbound"
                  }
                >
                  <div className="collaboration-message-heading">
                    <div>
                      <span
                        className={
                          message.visibility === "INTERNAL_ONLY"
                            ? "collaboration-visibility collaboration-visibility--internal"
                            : "collaboration-visibility collaboration-visibility--shared"
                        }
                      >
                        {message.visibility === "INTERNAL_ONLY"
                          ? "Internal only"
                          : message.direction === "FROM_SUPPLIER"
                            ? "Supplier response"
                            : "Supplier shared"}
                      </span>

                      <strong>
                        {message.direction === "FROM_SUPPLIER"
                          ? message.supplierContactName
                          : message.authorName}
                      </strong>

                      <small>{readable(message.messageType)}</small>
                    </div>

                    <time>{formatDateTime(message.createdAt)}</time>
                  </div>

                  <p>{message.body}</p>

                  {message.referenceText ? (
                    <div className="collaboration-message-reference">
                      Reference: {message.referenceText}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Workspace context</span>

              <h2>Procurement links</h2>
            </div>

            <ShieldCheck size={19} />
          </div>

          <div className="collaboration-context-grid">
            <div>
              <span>Supplier</span>

              <strong>{workspace.supplierName}</strong>
            </div>

            <div>
              <span>Owner</span>

              <strong>{workspace.ownerName}</strong>
            </div>

            <div>
              <span>Purchase order</span>

              <strong>{workspace.purchaseOrderNumber ?? "—"}</strong>
            </div>

            <div>
              <span>RFQ</span>

              <strong>{workspace.rfqNumber ?? "—"}</strong>
            </div>

            <div>
              <span>External reference</span>

              <strong>{workspace.externalReference ?? "—"}</strong>
            </div>

            <div>
              <span>Supplier responses</span>

              <strong>{workspace.supplierResponseCount}</strong>
            </div>
          </div>

          {detail.notes ? (
            <div className="collaboration-notes">
              <strong>Internal workspace notes</strong>

              <p>{detail.notes}</p>
            </div>
          ) : null}

          {detail.resolutionNote ? (
            <div className="collaboration-resolution-note">
              <BadgeCheck size={15} />

              <span>{detail.resolutionNote}</span>
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Action management</span>

            <h2>Collaboration actions</h2>
          </div>

          {canCompose ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setCreatingAction(true)}
            >
              <Plus size={15} />
              Create action
            </button>
          ) : (
            <FileCheck2 size={19} />
          )}
        </div>

        <DataTable
          columns={actionColumns}
          rows={orderedActions}
          getRowId={(action) => String(action.id)}
          ariaLabel="Collaboration actions"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No collaboration actions"
              description="No collaboration action requests have been created."
              action={
                canCompose ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setCreatingAction(true)}
                  >
                    <Plus size={15} />
                    Create action
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {composeMode !== null ? (
        <ComposeModal
          key={composeMode}
          mode={composeMode}
          workspaceId={params.id}
          onClose={() => setComposeMode(null)}
          onSaved={handleComposed}
        />
      ) : null}

      {creatingAction ? (
        <ActionModal
          workspace={workspace}
          workspaceId={params.id}
          users={users}
          onClose={() => setCreatingAction(false)}
          onSaved={handleActionCreated}
        />
      ) : null}

      {completing !== null ? (
        <RationaleDialog
          eyebrow="Collaboration action"
          title="Complete this action"
          description={`Record the completion or acknowledgement of “${completing.title}”.`}
          label="Completion / acknowledgement note"
          placeholder="What was done, or what did the supplier confirm?"
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
          eyebrow="Collaboration action"
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

      {closing !== null && closeInfo !== null ? (
        <RationaleDialog
          eyebrow="Workspace governance"
          title={closeInfo.title}
          description={closeInfo.description}
          label={closeInfo.label}
          placeholder={closeInfo.placeholder}
          confirmLabel={closeInfo.confirm}
          busyLabel={closeInfo.busy}
          tone={closeInfo.tone}
          maxLength={2000}
          busy={closeRunning}
          error={closeError}
          onConfirm={(note) => void confirmClose(note)}
          onCancel={() => setClosing(null)}
        />
      ) : null}
    </div>
  );
}
