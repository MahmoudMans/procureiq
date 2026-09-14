"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock3,
  FileCheck2,
  MessageSquareText,
  Play,
  Plus,
  Send,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

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

function readable(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase(),
    );
}

function defaultDueAt(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 7,
  );

  return date
    .toISOString()
    .slice(
      0,
      16,
    );
}

export default function SupplierCollaborationDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      CollaborationWorkspaceDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      CollaborationContext |
      null
    >(null);

  const [
    internalMessageType,
    setInternalMessageType,
  ] =
    useState<CollaborationMessageType>(
      "COMMENT",
    );

  const [
    internalBody,
    setInternalBody,
  ] =
    useState("");

  const [
    internalReference,
    setInternalReference,
  ] =
    useState("");

  const [
    supplierMessageType,
    setSupplierMessageType,
  ] =
    useState<CollaborationMessageType>(
      "CLARIFICATION",
    );

  const [
    supplierBody,
    setSupplierBody,
  ] =
    useState("");

  const [
    supplierReference,
    setSupplierReference,
  ] =
    useState("");

  const [
    supplierContactName,
    setSupplierContactName,
  ] =
    useState("");

  const [
    supplierResponseBody,
    setSupplierResponseBody,
  ] =
    useState("");

  const [
    supplierResponseReference,
    setSupplierResponseReference,
  ] =
    useState("");

  const [
    actionType,
    setActionType,
  ] =
    useState<CollaborationActionType>(
      "ANSWER_CLARIFICATION",
    );

  const [
    actionAudience,
    setActionAudience,
  ] =
    useState<CollaborationActionAudience>(
      "SUPPLIER",
    );

  const [
    actionTitle,
    setActionTitle,
  ] =
    useState("");

  const [
    actionDescription,
    setActionDescription,
  ] =
    useState("");

  const [
    actionAssigneeUserId,
    setActionAssigneeUserId,
  ] =
    useState("");

  const [
    externalAssigneeLabel,
    setExternalAssigneeLabel,
  ] =
    useState("");

  const [
    actionDueAt,
    setActionDueAt,
  ] =
    useState(
      defaultDueAt(),
    );

  const [
    actionNotes,
    setActionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    decisionNote,
    setDecisionNote,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  const canClose =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getSupplierCollaborationWorkspace(
        params.id,
      ),
      getSupplierCollaborationContext(),
    ])
      .then(
        ([
          workspaceResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            workspaceResponse,
          );

          setContext(
            contextResponse,
          );

          setExternalAssigneeLabel(
            workspaceResponse.workspace.supplierName,
          );

          const owner =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (owner) {
            setActionAssigneeUserId(
              owner.id,
            );
          }

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load supplier collaboration workspace.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(false);
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    params.id,
  ]);

  async function reload() {
    setDetail(
      await getSupplierCollaborationWorkspace(
        params.id,
      ),
    );
  }

  async function addInternalMessage(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await addInternalCollaborationMessage(
        params.id,
        {
          messageType:
            internalMessageType,
          body:
            internalBody.trim(),
          referenceText:
            internalReference.trim()
            ||
            undefined,
        },
      );

      setInternalBody("");
      setInternalReference("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save internal collaboration note.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function sendSupplierMessage(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await sendSupplierCollaborationMessage(
        params.id,
        {
          messageType:
            supplierMessageType,
          body:
            supplierBody.trim(),
          referenceText:
            supplierReference.trim()
            ||
            undefined,
        },
      );

      setSupplierBody("");
      setSupplierReference("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record supplier-shared message.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function recordSupplierResponse(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await recordSupplierCollaborationResponse(
        params.id,
        {
          messageType:
            supplierMessageType,
          supplierContactName:
            supplierContactName.trim(),
          body:
            supplierResponseBody.trim(),
          referenceText:
            supplierResponseReference.trim()
            ||
            undefined,
        },
      );

      setSupplierResponseBody("");
      setSupplierResponseReference("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record supplier response.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createAction(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createSupplierCollaborationAction(
        params.id,
        {
          actionType,
          audience:
            actionAudience,
          title:
            actionTitle.trim(),
          description:
            actionDescription.trim()
            ||
            undefined,
          assigneeUserId:
            actionAudience ===
            "INTERNAL"
              ? actionAssigneeUserId
              : undefined,
          externalAssigneeLabel:
            actionAudience ===
            "SUPPLIER"
              ? externalAssigneeLabel.trim()
              : undefined,
          dueAt:
            new Date(
              actionDueAt,
            )
              .toISOString(),
        },
      );

      setActionTitle("");
      setActionDescription("");
      setActionDueAt(
        defaultDueAt(),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create collaboration action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function startAction(
    action:
      CollaborationAction,
  ) {
    try {
      setRunning(true);
      setError(null);

      await startSupplierCollaborationAction(
        action.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start collaboration action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function completeAction(
    action:
      CollaborationAction,
  ) {
    const note =
      actionNotes[
        action.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An action completion note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await completeSupplierCollaborationAction(
        action.id,
        note,
      );

      setActionNotes(
        current => ({
          ...current,
          [action.id]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to complete collaboration action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelAction(
    action:
      CollaborationAction,
  ) {
    try {
      setRunning(true);
      setError(null);

      await cancelSupplierCollaborationAction(
        action.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel collaboration action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function resolveWorkspace() {
    if (!decisionNote.trim()) {
      setError(
        "A resolution note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await resolveSupplierCollaborationWorkspace(
        params.id,
        decisionNote,
      );

      setDecisionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to resolve collaboration workspace.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeWorkspace() {
    if (!decisionNote.trim()) {
      setError(
        "A closure note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await closeSupplierCollaborationWorkspace(
        params.id,
        decisionNote,
      );

      setDecisionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close collaboration workspace.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading supplier collaboration...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/supplier-collaboration"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Supplier collaboration
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Collaboration workspace not found."}
        </div>
      </div>
    );
  }

  const {
    workspace,
    messages,
    actions,
  } = detail;

  const active =
    workspace.status !==
      "RESOLVED"
    &&
    workspace.status !==
      "CLOSED";

  return (
    <div className="page-stack">
      <Link
        href="/supplier-collaboration"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier collaboration
      </Link>

      <section className="collaboration-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {workspace.workspaceNumber}
            </span>

            <span
              className={
                `collaboration-status collaboration-status--${workspace.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                workspace.status,
              )}
            </span>

            <span
              className={
                `collaboration-priority collaboration-priority--${workspace.priority.toLowerCase()}`
              }
            >
              {workspace.priority}
            </span>
          </div>

          <h1>
            {workspace.title}
          </h1>

          <p>
            {workspace.supplierName}
            {" · "}
            {workspace.supplierCode}
            {" · "}
            {readable(
              workspace.workspaceType,
            )}
          </p>
        </div>

        <div
          className={
            workspace.responseSlaBreached
              ? "collaboration-sla-card collaboration-sla-card--breached"
              : "collaboration-sla-card"
          }
        >
          <Clock3
            size={17}
          />

          <div>
            <span>
              Supplier response SLA
            </span>

            <strong>
              {workspace.responseSlaBreached
                ? "Breached"
                : `${workspace.supplierResponseSlaHours}h`}
            </strong>
          </div>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="collaboration-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Communication ledger
              </span>

              <h2>
                Messages
              </h2>
            </div>

            <MessageSquareText
              size={19}
            />
          </div>

          {messages.length ===
          0 ? (
            <div className="collaboration-empty">
              No messages have been
              recorded.
            </div>
          ) : (
            <div className="collaboration-message-list">
              {messages.map(
                message => (
                  <article
                    key={message.id}
                    className={
                      message.direction ===
                      "FROM_SUPPLIER"
                        ? "collaboration-message collaboration-message--supplier"
                        : message.visibility ===
                            "INTERNAL_ONLY"
                          ? "collaboration-message collaboration-message--internal"
                          : "collaboration-message collaboration-message--outbound"
                    }
                  >
                    <div className="collaboration-message-heading">
                      <div>
                        <span
                          className={
                            message.visibility ===
                            "INTERNAL_ONLY"
                              ? "collaboration-visibility collaboration-visibility--internal"
                              : "collaboration-visibility collaboration-visibility--shared"
                          }
                        >
                          {message.visibility ===
                          "INTERNAL_ONLY"
                            ? "Internal only"
                            : message.direction ===
                                "FROM_SUPPLIER"
                              ? "Supplier response"
                              : "Supplier shared"}
                        </span>

                        <strong>
                          {message.direction ===
                          "FROM_SUPPLIER"
                            ? message.supplierContactName
                            : message.authorName}
                        </strong>

                        <small>
                          {readable(
                            message.messageType,
                          )}
                        </small>
                      </div>

                      <time>
                        {new Date(
                          message.createdAt,
                        )
                          .toLocaleString()}
                      </time>
                    </div>

                    <p>
                      {message.body}
                    </p>

                    {message.referenceText ? (
                      <div className="collaboration-message-reference">
                        Reference:
                        {" "}
                        {message.referenceText}
                      </div>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Workspace context
              </span>

              <h2>
                Procurement links
              </h2>
            </div>

            <ShieldCheck
              size={19}
            />
          </div>

          <div className="collaboration-context-grid">
            <div>
              <span>
                Supplier
              </span>

              <strong>
                {workspace.supplierName}
              </strong>
            </div>

            <div>
              <span>
                Owner
              </span>

              <strong>
                {workspace.ownerName}
              </strong>
            </div>

            <div>
              <span>
                Purchase order
              </span>

              <strong>
                {workspace.purchaseOrderNumber ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                RFQ
              </span>

              <strong>
                {workspace.rfqNumber ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                External reference
              </span>

              <strong>
                {workspace.externalReference ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Supplier responses
              </span>

              <strong>
                {workspace.supplierResponseCount}
              </strong>
            </div>
          </div>

          {detail.notes ? (
            <div className="collaboration-notes">
              <strong>
                Internal workspace notes
              </strong>

              <p>
                {detail.notes}
              </p>
            </div>
          ) : null}

          {detail.resolutionNote ? (
            <div className="collaboration-resolution-note">
              <BadgeCheck
                size={15}
              />

              <span>
                {detail.resolutionNote}
              </span>
            </div>
          ) : null}
        </section>
      </section>

      {canManage &&
      active ? (
        <section className="collaboration-composer-grid">
          <form
            className="panel"
            onSubmit={addInternalMessage}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Internal only
                </span>

                <h2>
                  Add internal note
                </h2>
              </div>

              <UserRound
                size={19}
              />
            </div>

            <label className="request-field">
              <span>
                Message type
              </span>

              <select
                value={internalMessageType}
                onChange={
                  event =>
                    setInternalMessageType(
                      event.target.value as
                        CollaborationMessageType,
                    )
                }
              >
                <option value="COMMENT">
                  Comment
                </option>

                <option value="CLARIFICATION">
                  Clarification
                </option>

                <option value="STATUS_UPDATE">
                  Status update
                </option>

                <option value="DOCUMENT_REQUEST">
                  Document request
                </option>

                <option value="DELIVERY_UPDATE">
                  Delivery update
                </option>

                <option value="ISSUE">
                  Issue
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Note
              </span>

              <textarea
                required
                rows={5}
                value={internalBody}
                onChange={
                  event =>
                    setInternalBody(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Reference
              </span>

              <input
                value={internalReference}
                onChange={
                  event =>
                    setInternalReference(
                      event.target.value,
                    )
                }
              />
            </label>

            <div className="collaboration-form-actions">
              <button
                type="submit"
                className="button button--secondary"
                disabled={
                  running
                  ||
                  !internalBody.trim()
                }
              >
                Add internal note
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={sendSupplierMessage}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Supplier shared
                </span>

                <h2>
                  Send to supplier ledger
                </h2>
              </div>

              <Send
                size={19}
              />
            </div>

            <label className="request-field">
              <span>
                Message type
              </span>

              <select
                value={supplierMessageType}
                onChange={
                  event =>
                    setSupplierMessageType(
                      event.target.value as
                        CollaborationMessageType,
                    )
                }
              >
                <option value="CLARIFICATION">
                  Clarification
                </option>

                <option value="COMMENT">
                  Comment
                </option>

                <option value="STATUS_UPDATE">
                  Status update
                </option>

                <option value="DOCUMENT_REQUEST">
                  Document request
                </option>

                <option value="DELIVERY_UPDATE">
                  Delivery update
                </option>

                <option value="ISSUE">
                  Issue
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Shared message
              </span>

              <textarea
                required
                rows={5}
                value={supplierBody}
                onChange={
                  event =>
                    setSupplierBody(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Reference
              </span>

              <input
                value={supplierReference}
                onChange={
                  event =>
                    setSupplierReference(
                      event.target.value,
                    )
                }
              />
            </label>

            <div className="collaboration-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !supplierBody.trim()
                }
              >
                <Send
                  size={16}
                />
                Record supplier-shared message
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={recordSupplierResponse}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Supplier response
                </span>

                <h2>
                  Record supplier reply
                </h2>
              </div>

              <MessageSquareText
                size={19}
              />
            </div>

            <label className="request-field">
              <span>
                Supplier contact
              </span>

              <input
                required
                value={supplierContactName}
                onChange={
                  event =>
                    setSupplierContactName(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Supplier response
              </span>

              <textarea
                required
                rows={5}
                value={supplierResponseBody}
                onChange={
                  event =>
                    setSupplierResponseBody(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Reference
              </span>

              <input
                value={supplierResponseReference}
                onChange={
                  event =>
                    setSupplierResponseReference(
                      event.target.value,
                    )
                }
              />
            </label>

            <div className="collaboration-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !supplierContactName.trim()
                  ||
                  !supplierResponseBody.trim()
                }
              >
                Record supplier reply
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Action management
            </span>

            <h2>
              Collaboration actions
            </h2>
          </div>

          <FileCheck2
            size={19}
          />
        </div>

        {actions.length ===
        0 ? (
          <div className="collaboration-empty">
            No collaboration action
            requests have been created.
          </div>
        ) : (
          <div className="collaboration-action-list">
            {actions.map(
              action => (
                <article
                  key={action.id}
                  className={
                    action.overdue
                      ? "collaboration-action collaboration-action--overdue"
                      : "collaboration-action"
                  }
                >
                  <div className="collaboration-action-heading">
                    <div>
                      <span
                        className={
                          `collaboration-action-status collaboration-action-status--${action.status.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          action.status,
                        )}
                      </span>

                      <strong>
                        {action.title}
                      </strong>

                      <small>
                        {readable(
                          action.actionType,
                        )}
                        {" · "}
                        {action.audience ===
                        "SUPPLIER"
                          ? action.externalAssigneeLabel
                          : action.assigneeName}
                      </small>
                    </div>

                    <div>
                      <span>
                        Due
                      </span>

                      <strong
                        className={
                          action.overdue
                            ? "collaboration-overdue"
                            : ""
                        }
                      >
                        {new Date(
                          action.dueAt,
                        )
                          .toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {action.description ? (
                    <p>
                      {action.description}
                    </p>
                  ) : null}

                  {action.completionNote ? (
                    <div className="collaboration-completion-note">
                      {action.completionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  (
                    action.status ===
                      "OPEN"
                    ||
                    action.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="collaboration-action-controls">
                      {action.status ===
                      "OPEN" ? (
                        <button
                          type="button"
                          disabled={running}
                          onClick={
                            () =>
                              void startAction(
                                action,
                              )
                          }
                        >
                          <Play
                            size={14}
                          />
                          Start
                        </button>
                      ) : null}

                      <input
                        value={
                          actionNotes[
                            action.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Completion / acknowledgement note"
                        }
                        onChange={
                          event =>
                            setActionNotes(
                              current => ({
                                ...current,
                                [action.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <button
                        type="button"
                        disabled={
                          running
                          ||
                          !(
                            actionNotes[
                              action.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void completeAction(
                              action,
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Complete
                      </button>

                      {canClose ? (
                        <button
                          type="button"
                          className="collaboration-danger-button"
                          disabled={running}
                          onClick={
                            () =>
                              void cancelAction(
                                action,
                              )
                          }
                        >
                          <XCircle
                            size={14}
                          />
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      active ? (
        <form
          className="panel"
          onSubmit={createAction}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                New request
              </span>

              <h2>
                Create collaboration action
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="collaboration-form-grid">
            <label className="request-field">
              <span>
                Action type
              </span>

              <select
                value={actionType}
                onChange={
                  event =>
                    setActionType(
                      event.target.value as
                        CollaborationActionType,
                    )
                }
              >
                <option value="ACKNOWLEDGE_PO">
                  Acknowledge PO
                </option>

                <option value="CONFIRM_DELIVERY">
                  Confirm delivery
                </option>

                <option value="PROVIDE_DOCUMENT">
                  Provide document
                </option>

                <option value="ANSWER_CLARIFICATION">
                  Answer clarification
                </option>

                <option value="RESOLVE_ISSUE">
                  Resolve issue
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Audience
              </span>

              <select
                value={actionAudience}
                onChange={
                  event =>
                    setActionAudience(
                      event.target.value as
                        CollaborationActionAudience,
                    )
                }
              >
                <option value="SUPPLIER">
                  Supplier
                </option>

                <option value="INTERNAL">
                  Internal
                </option>
              </select>
            </label>

            <label className="request-field collaboration-form-wide">
              <span>
                Action title
              </span>

              <input
                required
                value={actionTitle}
                onChange={
                  event =>
                    setActionTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field collaboration-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                value={actionDescription}
                onChange={
                  event =>
                    setActionDescription(
                      event.target.value,
                    )
                }
              />
            </label>

            {actionAudience ===
            "INTERNAL" ? (
              <label className="request-field">
                <span>
                  Internal assignee
                </span>

                <select
                  value={actionAssigneeUserId}
                  onChange={
                    event =>
                      setActionAssigneeUserId(
                        event.target.value,
                      )
                  }
                >
                  {context
                    ?.users
                    .filter(
                      candidate =>
                        candidate.role !==
                        "REQUESTER",
                    )
                    .map(
                      candidate => (
                        <option
                          key={candidate.id}
                          value={candidate.id}
                        >
                          {candidate.fullName}
                          {" — "}
                          {candidate.role}
                        </option>
                      ),
                    )}
                </select>
              </label>
            ) : (
              <label className="request-field">
                <span>
                  Supplier / contact label
                </span>

                <input
                  required
                  value={
                    externalAssigneeLabel
                  }
                  onChange={
                    event =>
                      setExternalAssigneeLabel(
                        event.target.value,
                      )
                  }
                />
              </label>
            )}

            <label className="request-field">
              <span>
                Due date / time
              </span>

              <input
                required
                type="datetime-local"
                value={actionDueAt}
                onChange={
                  event =>
                    setActionDueAt(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="collaboration-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !actionTitle.trim()
              }
            >
              <Plus
                size={16}
              />
              Create action
            </button>
          </div>
        </form>
      ) : null}

      {canManage &&
      active ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Workspace governance
              </span>

              <h2>
                Resolve or close
              </h2>
            </div>

            <CheckCircleIcon />
          </div>

          <label className="request-field">
            <span>
              Resolution / closure note
            </span>

            <textarea
              rows={5}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="collaboration-form-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void resolveWorkspace()
              }
            >
              <BadgeCheck
                size={16}
              />
              Resolve workspace
            </button>

            {canClose ? (
              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !decisionNote.trim()
                }
                onClick={
                  () =>
                    void closeWorkspace()
                }
              >
                Close workspace
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <BadgeCheck
      size={19}
    />
  );
}
