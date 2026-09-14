"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock3,
  FileCheck2,
  LogOut,
  MessageSquareText,
  Send,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

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

import type {
  SupplierPortalAction,
  SupplierPortalWorkspaceDetail,
} from "@/types/supplier-portal";

import type {
  CollaborationMessageType,
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

export default function SupplierPortalWorkspacePage() {
  const params =
    useParams<{
      id: string;
    }>();

  const router =
    useRouter();

  const [
    detail,
    setDetail,
  ] =
    useState<
      SupplierPortalWorkspaceDetail |
      null
    >(null);

  const [
    messageType,
    setMessageType,
  ] =
    useState<CollaborationMessageType>(
      "COMMENT",
    );

  const [
    body,
    setBody,
  ] =
    useState("");

  const [
    referenceText,
    setReferenceText,
  ] =
    useState("");

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
    actionReferences,
    setActionReferences,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

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

  useEffect(() => {
    let active = true;

    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    getSupplierPortalWorkspace(
      token,
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDetail(
            response,
          );

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
              : "Unable to load supplier workspace.",
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
    router,
  ]);

  async function reload() {
    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    setDetail(
      await getSupplierPortalWorkspace(
        token,
        params.id,
      ),
    );
  }

  async function respond(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await sendSupplierPortalResponse(
        token,
        params.id,
        {
          messageType,
          body:
            body.trim(),
          referenceText:
            referenceText.trim()
            ||
            undefined,
        },
      );

      setBody("");
      setReferenceText("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to send supplier response.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function completeAction(
    action:
      SupplierPortalAction,
  ) {
    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    const note =
      actionNotes[
        action.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A completion or acknowledgement note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await completeSupplierPortalAction(
        token,
        action.id,
        {
          note,
          referenceText:
            actionReferences[
              action.id
            ]
            ?.trim()
            ||
            undefined,
        },
      );

      setActionNotes(
        current => ({
          ...current,
          [action.id]:
            "",
        }),
      );

      setActionReferences(
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
          : "Unable to complete supplier action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function logout() {
    const token =
      getSupplierPortalToken();

    clearSupplierPortalToken();

    if (token) {
      await supplierPortalLogout(
        token,
      )
        .catch(
          () => undefined,
        );
    }

    router.replace(
      "/supplier-portal/login",
    );
  }

  if (
    loading
    &&
    !detail
  ) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">
          Loading supplier workspace...
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-content">
          <div className="portal-auth-error">
            <CircleAlert
              size={17}
            />
            {error ??
              "Supplier workspace is unavailable."}
          </div>

          <Link
            href="/supplier-portal/home"
            className="supplier-portal-back-link"
          >
            <ArrowLeft
              size={15}
            />
            Return to portal
          </Link>
        </div>
      </main>
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
    <main className="supplier-portal-shell">
      <header className="supplier-portal-header">
        <div className="supplier-portal-brand">
          <ShieldCheck
            size={25}
          />

          <div>
            <span>
              ProcureIQ
            </span>

            <strong>
              Supplier Portal
            </strong>
          </div>
        </div>

        <button
          type="button"
          onClick={
            () =>
              void logout()
          }
        >
          <LogOut
            size={15}
          />
          Sign out
        </button>
      </header>

      <div className="supplier-portal-content">
        <Link
          href="/supplier-portal/home"
          className="supplier-portal-back-link"
        >
          <ArrowLeft
            size={15}
          />
          Workspaces
        </Link>

        {error ? (
          <div className="portal-auth-error">
            <CircleAlert
              size={17}
            />
            {error}
          </div>
        ) : null}

        <section className="supplier-portal-workspace-heading">
          <div>
            <div>
              <span
                className={
                  `supplier-portal-priority supplier-portal-priority--${workspace.priority.toLowerCase()}`
                }
              >
                {workspace.priority}
              </span>

              <span
                className={
                  `supplier-portal-workspace-status supplier-portal-workspace-status--${workspace.status.toLowerCase().replaceAll("_", "-")}`
                }
              >
                {readable(
                  workspace.status,
                )}
              </span>
            </div>

            <h1>
              {workspace.title}
            </h1>

            <p>
              {workspace.workspaceNumber}
              {" · "}
              {readable(
                workspace.workspaceType,
              )}
            </p>
          </div>

          <div
            className={
              workspace.responseSlaBreached
                ? "supplier-portal-sla supplier-portal-sla--overdue"
                : "supplier-portal-sla"
            }
          >
            <Clock3
              size={17}
            />

            <div>
              <span>
                Response SLA
              </span>

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
            <span>
              Purchase order
            </span>

            <strong>
              {workspace.purchaseOrderNumber ??
                "—"}
            </strong>
          </article>

          <article>
            <span>
              RFQ
            </span>

            <strong>
              {workspace.rfqNumber ??
                "—"}
            </strong>
          </article>

          <article>
            <span>
              External reference
            </span>

            <strong>
              {workspace.externalReference ??
                "—"}
            </strong>
          </article>

          <article>
            <span>
              Open actions
            </span>

            <strong>
              {workspace.openSupplierActions}
            </strong>
          </article>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>
                Shared communication
              </span>

              <h2>
                Messages
              </h2>
            </div>

            <MessageSquareText
              size={18}
            />
          </div>

          <div className="supplier-portal-message-list">
            {messages.map(
              message => (
                <article
                  key={message.id}
                  className={
                    message.direction ===
                    "FROM_SUPPLIER"
                      ? "supplier-portal-message supplier-portal-message--supplier"
                      : "supplier-portal-message supplier-portal-message--procurement"
                  }
                >
                  <div>
                    <strong>
                      {message.senderName}
                    </strong>

                    <span>
                      {readable(
                        message.messageType,
                      )}
                      {" · "}
                      {new Date(
                        message.createdAt,
                      )
                        .toLocaleString()}
                    </span>
                  </div>

                  <p>
                    {message.body}
                  </p>

                  {message.referenceText ? (
                    <small>
                      Reference:
                      {" "}
                      {message.referenceText}
                    </small>
                  ) : null}
                </article>
              ),
            )}

            {messages.length ===
            0 ? (
              <div className="supplier-portal-empty">
                No supplier-shared
                messages are available.
              </div>
            ) : null}
          </div>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>
                Required actions
              </span>

              <h2>
                Supplier actions
              </h2>
            </div>

            <FileCheck2
              size={18}
            />
          </div>

          <div className="supplier-portal-action-list">
            {actions.map(
              action => (
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
                      <span>
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
                      </small>
                    </div>

                    <div>
                      <span>
                        Due
                      </span>

                      <strong
                        className={
                          action.overdue
                            ? "supplier-portal-overdue"
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
                    <div className="supplier-portal-completed-note">
                      <BadgeCheck
                        size={14}
                      />
                      {action.completionNote}
                    </div>
                  ) : null}

                  {active &&
                  (
                    action.status ===
                      "OPEN"
                    ||
                    action.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="supplier-portal-action-form">
                      <textarea
                        rows={3}
                        placeholder={
                          action.actionType ===
                          "ACKNOWLEDGE_PO"
                            ? "PO acknowledgement"
                            : action.actionType ===
                                "CONFIRM_DELIVERY"
                              ? "Delivery confirmation"
                              : "Completion response"
                        }
                        value={
                          actionNotes[
                            action.id
                          ]
                          ??
                          ""
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

                      <input
                        placeholder={
                          "Document / delivery / confirmation reference (optional)"
                        }
                        value={
                          actionReferences[
                            action.id
                          ]
                          ??
                          ""
                        }
                        onChange={
                          event =>
                            setActionReferences(
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
                          size={15}
                        />
                        Complete action
                      </button>
                    </div>
                  ) : null}
                </article>
              ),
            )}

            {actions.length ===
            0 ? (
              <div className="supplier-portal-empty">
                No supplier actions are
                currently assigned.
              </div>
            ) : null}
          </div>
        </section>

        {active ? (
          <form
            className="supplier-portal-panel"
            onSubmit={respond}
          >
            <div className="supplier-portal-panel-heading">
              <div>
                <span>
                  Supplier response
                </span>

                <h2>
                  Reply to procurement
                </h2>
              </div>

              <Send
                size={18}
              />
            </div>

            <div className="supplier-portal-response-form">
              <label>
                <span>
                  Response type
                </span>

                <select
                  value={messageType}
                  onChange={
                    event =>
                      setMessageType(
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
                    Document response
                  </option>

                  <option value="DELIVERY_UPDATE">
                    Delivery update
                  </option>

                  <option value="ISSUE">
                    Issue response
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Response
                </span>

                <textarea
                  required
                  rows={5}
                  value={body}
                  onChange={
                    event =>
                      setBody(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label>
                <span>
                  Reference
                </span>

                <input
                  value={referenceText}
                  onChange={
                    event =>
                      setReferenceText(
                        event.target.value,
                      )
                  }
                />
              </label>

              <button
                type="submit"
                disabled={
                  running
                  ||
                  !body.trim()
                }
              >
                <Send
                  size={15}
                />
                Send response
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
