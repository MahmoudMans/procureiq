"use client";

import "@/app/supplier-portal/portal-extras.css";

import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  LogOut,
  MessageSquareText,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useState } from "react";

import {
  completeSupplierPortalAction,
  getSupplierPortalWorkspace,
  sendSupplierPortalResponse,
  supplierPortalLogout,
} from "@/lib/api";
import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";
import type { CollaborationMessageType } from "@/types/supplier-collaboration";
import type {
  SupplierPortalAction,
  SupplierPortalWorkspaceDetail,
} from "@/types/supplier-portal";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const RESPONSE_TYPES: { value: string; label: string }[] = [
  { value: "COMMENT", label: "Comment" },
  { value: "CLARIFICATION", label: "Clarification" },
  { value: "STATUS_UPDATE", label: "Status update" },
  { value: "DOCUMENT_REQUEST", label: "Document response" },
  { value: "DELIVERY_UPDATE", label: "Delivery update" },
  { value: "ISSUE", label: "Issue response" },
];

function readable(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isOpenAction(action: SupplierPortalAction): boolean {
  return action.status === "OPEN" || action.status === "IN_PROGRESS";
}

function completeLabel(action: SupplierPortalAction): string {
  if (action.actionType === "ACKNOWLEDGE_PO") {
    return "Acknowledge PO";
  }

  if (action.actionType === "CONFIRM_DELIVERY") {
    return "Confirm delivery";
  }

  return "Complete action";
}

function submitOnShortcut(event: KeyboardEvent<HTMLTextAreaElement>, run: () => void) {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    run();
  }
}

interface Feedback {
  /** "reply" for the response form, otherwise the action id. */
  scope: string;
  tone: "error" | "success";
  message: string;
}

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  return feedback.tone === "error" ? (
    <div className="portal-auth-error" role="alert">
      <CircleAlert size={17} />
      {feedback.message}
    </div>
  ) : (
    <div className="portal-notice" role="status">
      <CheckCircle2 size={17} />
      {feedback.message}
    </div>
  );
}

interface WorkspaceData {
  id: string;
  detail: SupplierPortalWorkspaceDetail;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SupplierPortalWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [result, setResult] = useState<WorkspaceData | null>(null);
  const [messageType, setMessageType] = useState<CollaborationMessageType>("COMMENT");
  const [body, setBody] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [actionReferences, setActionReferences] = useState<Record<string, string>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await getSupplierPortalWorkspace(token, id);

        if (active) {
          setResult({ id, detail: response });
          setLoadError(null);
        }
      } catch (caught) {
        if (active) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load supplier workspace.",
          );
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, router, reloadKey]);

  const detail = result !== null && result.id === params.id ? result.detail : null;

  async function submitResponse() {
    if (runningId !== null) {
      return;
    }

    const text = body.trim();

    if (!text) {
      setFeedback({
        scope: "reply",
        tone: "error",
        message: "Write a response before sending.",
      });

      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    setRunningId("reply");
    setFeedback(null);

    try {
      await sendSupplierPortalResponse(token, params.id, {
        messageType,
        body: text,
        referenceText: referenceText.trim() || undefined,
      });

      setBody("");
      setReferenceText("");

      setFeedback({
        scope: "reply",
        tone: "success",
        message: "Your response was sent to procurement.",
      });

      setReloadKey((key) => key + 1);
    } catch (caught) {
      setFeedback({
        scope: "reply",
        tone: "error",
        message:
          caught instanceof Error ? caught.message : "Unable to send supplier response.",
      });
    } finally {
      setRunningId(null);
    }
  }

  async function completeAction(action: SupplierPortalAction) {
    if (runningId !== null) {
      return;
    }

    const note = (actionNotes[action.id] ?? "").trim();

    if (!note) {
      setFeedback({
        scope: action.id,
        tone: "error",
        message: "A completion or acknowledgement note is required.",
      });

      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    setRunningId(action.id);
    setFeedback(null);

    try {
      await completeSupplierPortalAction(token, action.id, {
        note,
        referenceText: actionReferences[action.id]?.trim() || undefined,
      });

      setActionNotes((current) => ({ ...current, [action.id]: "" }));
      setActionReferences((current) => ({ ...current, [action.id]: "" }));

      setFeedback({
        scope: action.id,
        tone: "success",
        message: "Action completed. Procurement has been notified of your response.",
      });

      setReloadKey((key) => key + 1);
    } catch (caught) {
      setFeedback({
        scope: action.id,
        tone: "error",
        message:
          caught instanceof Error ? caught.message : "Unable to complete supplier action.",
      });
    } finally {
      setRunningId(null);
    }
  }

  async function logout() {
    const token = getSupplierPortalToken();

    clearSupplierPortalToken();

    if (token) {
      await supplierPortalLogout(token).catch(() => undefined);
    }

    router.replace("/supplier-portal/login");
  }

  if (detail === null && loadError === null) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">Loading supplier workspace...</div>
      </main>
    );
  }

  if (detail === null) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-content">
          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {loadError ?? "Supplier workspace is unavailable."}

            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </button>
          </div>

          <Link href="/supplier-portal/home" className="supplier-portal-back-link">
            <ArrowLeft size={15} />
            Return to portal
          </Link>
        </div>
      </main>
    );
  }

  const { workspace, messages, actions } = detail;

  const isOpen = workspace.status !== "RESOLVED" && workspace.status !== "CLOSED";

  // Open actions first, overdue ones ahead of the rest, then by due date.
  const orderedActions = [...actions].sort((a, b) => {
    const left = isOpenAction(a) ? 0 : 1;
    const right = isOpenAction(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  });

  const replyFeedback = feedback !== null && feedback.scope === "reply" ? feedback : null;
  const replying = runningId === "reply";

  return (
    <main className="supplier-portal-shell">
      <header className="supplier-portal-header">
        <div className="supplier-portal-brand">
          <ShieldCheck size={25} />

          <div>
            <span>ProcureIQ</span>

            <strong>Supplier Portal</strong>
          </div>
        </div>

        <button type="button" onClick={() => void logout()}>
          <LogOut size={15} />
          Sign out
        </button>
      </header>

      <div className="supplier-portal-content">
        <Link href="/supplier-portal/home" className="supplier-portal-back-link">
          <ArrowLeft size={15} />
          Workspaces
        </Link>

        {loadError ? (
          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {loadError}

            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        ) : null}

        <section className="supplier-portal-workspace-heading">
          <div>
            <div>
              <span
                className={`supplier-portal-priority supplier-portal-priority--${workspace.priority.toLowerCase()}`}
              >
                {workspace.priority}
              </span>

              <span
                className={`supplier-portal-workspace-status supplier-portal-workspace-status--${workspace.status
                  .toLowerCase()
                  .replaceAll("_", "-")}`}
              >
                {readable(workspace.status)}
              </span>
            </div>

            <h1>{workspace.title}</h1>

            <p>
              {workspace.workspaceNumber}
              {" · "}
              {readable(workspace.workspaceType)}
            </p>
          </div>

          <div
            className={
              workspace.responseSlaBreached
                ? "supplier-portal-sla supplier-portal-sla--overdue"
                : "supplier-portal-sla"
            }
          >
            <Clock3 size={17} />

            <div>
              <span>Response SLA</span>

              <strong>
                {workspace.responseSlaBreached
                  ? "Overdue"
                  : `${workspace.supplierResponseSlaHours} hours`}
              </strong>
            </div>
          </div>
        </section>

        <section className="supplier-portal-context-grid">
          <article>
            <span>Purchase order</span>

            <strong>{workspace.purchaseOrderNumber ?? "—"}</strong>
          </article>

          <article>
            <span>RFQ</span>

            <strong>{workspace.rfqNumber ?? "—"}</strong>
          </article>

          <article>
            <span>External reference</span>

            <strong>{workspace.externalReference ?? "—"}</strong>
          </article>

          <article>
            <span>Open actions</span>

            <strong>{workspace.openSupplierActions}</strong>
          </article>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Shared communication</span>

              <h2>Messages ({messages.length})</h2>
            </div>

            <MessageSquareText size={18} />
          </div>

          <div className="supplier-portal-message-list">
            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.direction === "FROM_SUPPLIER"
                    ? "supplier-portal-message supplier-portal-message--supplier"
                    : "supplier-portal-message supplier-portal-message--procurement"
                }
              >
                <div>
                  <strong>
                    {message.senderName}

                    <span className="portal-message-origin">
                      {message.direction === "FROM_SUPPLIER" ? "Your team" : "Procurement"}
                    </span>
                  </strong>

                  <span>
                    {readable(message.messageType)}
                    {" · "}
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>

                <p>{message.body}</p>

                {message.referenceText ? <small>Reference: {message.referenceText}</small> : null}
              </article>
            ))}

            {messages.length === 0 ? (
              <div className="supplier-portal-empty">
                No supplier-shared messages are available.
              </div>
            ) : null}
          </div>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Required actions</span>

              <h2>Supplier actions</h2>
            </div>

            <FileCheck2 size={18} />
          </div>

          <div className="supplier-portal-action-list">
            {orderedActions.map((action) => {
              const actionFeedback =
                feedback !== null && feedback.scope === action.id ? feedback : null;
              const working = runningId === action.id;

              return (
                <article
                  key={action.id}
                  className={
                    action.overdue
                      ? "supplier-portal-action supplier-portal-action--overdue"
                      : "supplier-portal-action"
                  }
                >
                  <div className="supplier-portal-action-heading">
                    <div>
                      <span>{readable(action.status)}</span>

                      <strong>{action.title}</strong>

                      <small>{readable(action.actionType)}</small>
                    </div>

                    <div>
                      <span>Due</span>

                      <strong className={action.overdue ? "supplier-portal-overdue" : ""}>
                        {new Date(action.dueAt).toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {action.description ? <p>{action.description}</p> : null}

                  {action.completionNote ? (
                    <div className="supplier-portal-completed-note">
                      <BadgeCheck size={14} />
                      {action.completionNote}
                    </div>
                  ) : null}

                  {actionFeedback ? (
                    <div className="portal-item-feedback">
                      <FeedbackBanner feedback={actionFeedback} />
                    </div>
                  ) : null}

                  {isOpen && isOpenAction(action) ? (
                    <div className="supplier-portal-action-form">
                      <textarea
                        rows={3}
                        aria-label={`Response for ${action.title}`}
                        placeholder={
                          action.actionType === "ACKNOWLEDGE_PO"
                            ? "PO acknowledgement"
                            : action.actionType === "CONFIRM_DELIVERY"
                              ? "Delivery confirmation"
                              : "Completion response"
                        }
                        value={actionNotes[action.id] ?? ""}
                        onChange={(event) =>
                          setActionNotes((current) => ({
                            ...current,
                            [action.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) =>
                          submitOnShortcut(event, () => void completeAction(action))
                        }
                      />

                      <input
                        aria-label={`Reference for ${action.title}`}
                        placeholder="Document / delivery / confirmation reference (optional)"
                        value={actionReferences[action.id] ?? ""}
                        onChange={(event) =>
                          setActionReferences((current) => ({
                            ...current,
                            [action.id]: event.target.value,
                          }))
                        }
                      />

                      <button
                        type="button"
                        disabled={runningId !== null || !(actionNotes[action.id] ?? "").trim()}
                        onClick={() => void completeAction(action)}
                      >
                        <BadgeCheck size={15} />
                        {working ? "Saving…" : completeLabel(action)}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}

            {actions.length === 0 ? (
              <div className="supplier-portal-empty">
                No supplier actions are currently assigned.
              </div>
            ) : null}
          </div>
        </section>

        {isOpen ? (
          <form
            className="supplier-portal-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void submitResponse();
            }}
          >
            <div className="supplier-portal-panel-heading">
              <div>
                <span>Supplier response</span>

                <h2>Reply to procurement</h2>
              </div>

              <Send size={18} />
            </div>

            <div className="supplier-portal-response-form">
              {replyFeedback ? <FeedbackBanner feedback={replyFeedback} /> : null}

              <label>
                <span>Response type</span>

                <select
                  value={messageType}
                  onChange={(event) =>
                    setMessageType(event.target.value as CollaborationMessageType)
                  }
                >
                  {RESPONSE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Response</span>

                <textarea
                  required
                  rows={5}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  onKeyDown={(event) => submitOnShortcut(event, () => void submitResponse())}
                />

                <small className="portal-form-hint">
                  Press Ctrl or ⌘ + Enter to send.
                </small>
              </label>

              <label>
                <span>Reference</span>

                <input
                  value={referenceText}
                  onChange={(event) => setReferenceText(event.target.value)}
                />
              </label>

              <button type="submit" disabled={runningId !== null || !body.trim()}>
                <Send size={15} />
                {replying ? "Sending…" : "Send response"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
