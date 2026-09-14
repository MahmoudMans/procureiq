"use client";

import {
  Banknote,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  approveTask,
  getApprovalQueue,
  getApprovalSummary,
  rejectTask,
} from "@/lib/api";

import type {
  ApprovalSummary,
  ApprovalTask,
  ApprovalTaskStatus,
} from "@/types/approval";

type DecisionType =
  | "APPROVE"
  | "REJECT";

interface DecisionState {
  task: ApprovalTask;
  type: DecisionType;
}

function statusLabel(
  status: ApprovalTaskStatus,
): string {
  return status
    .replaceAll(
      "_",
      " ",
    );
}

function roleLabel(
  role: string,
): string {
  return role
    .replaceAll(
      "_",
      " ",
    );
}

export default function ApprovalsPage() {
  const {
    user,
  } = useAuth();

  const [
    tasks,
    setTasks,
  ] =
    useState<ApprovalTask[]>(
      [],
    );

  const [
    summary,
    setSummary,
  ] =
    useState<
      ApprovalSummary |
      null
    >(null);

  const [
    status,
    setStatus,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    refreshKey,
    setRefreshKey,
  ] =
    useState(0);

  const [
    decision,
    setDecision,
  ] =
    useState<
      DecisionState |
      null
    >(null);

  const allowed =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "APPROVER";

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let mounted = true;

    async function load() {
      try {
        setLoading(
          true,
        );

        setError(
          null,
        );

        const [
          queueResponse,
          summaryResponse,
        ] =
          await Promise.all([
            getApprovalQueue(
              (
                status as
                  ApprovalTaskStatus
              ) ||
              undefined,
            ),

            getApprovalSummary(),
          ]);

        if (!mounted) {
          return;
        }

        setTasks(
          queueResponse,
        );

        setSummary(
          summaryResponse,
        );
      } catch (
        caughtError
      ) {
        if (!mounted) {
          return;
        }

        setError(
          caughtError instanceof
            Error
            ? caughtError
                .message
            : "Unable to load approval queue.",
        );
      } finally {
        if (mounted) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [
    allowed,
    status,
    refreshKey,
  ]);

  function handleDecisionComplete() {
    setDecision(
      null,
    );

    setRefreshKey(
      value =>
        value + 1,
    );
  }

  if (!allowed) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <section
          className={
            "page-heading"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Procurement governance
            </span>

            <h1>
              Approval center
            </h1>
          </div>
        </section>

        <div
          className={
            "error-banner"
          }
        >
          <ShieldCheck
            size={18}
          />

          Your current ProcureIQ role
          does not have access to the
          approval queue.
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Procurement governance
          </span>

          <h1>
            Approval center
          </h1>

          <p>
            Review submitted purchase
            requests, enforce approval
            policies and maintain a
            complete decision history.
          </p>
        </div>
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />

          {error}
        </div>
      ) : null}

      <section
        className={
          "approval-kpi-grid"
        }
      >
        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Clock3
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Pending approvals
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.pendingTasks ??
              "—"}
          </strong>

          <p>
            Decisions currently
            awaiting your role.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <CheckCircle2
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Approved
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.approvedTasks ??
              "—"}
          </strong>

          <p>
            Approved procurement
            decisions in your queue.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon kpi-card__icon--warning"
              }
            >
              <XCircle
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Rejected
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.rejectedTasks ??
              "—"}
          </strong>

          <p>
            Requests declined through
            procurement governance.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Banknote
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Pending value
          </span>

          <strong
            className={
              "kpi-card__value approval-value"
            }
          >
            {
              summary
                ? new Intl
                    .NumberFormat(
                      "en-US",
                      {
                        style:
                          "currency",
                        currency:
                          "EUR",
                        notation:
                          "compact",
                        maximumFractionDigits:
                          1,
                      },
                    )
                    .format(
                      summary
                        .pendingValue,
                    )
                : "—"
            }
          </strong>

          <p>
            Estimated value awaiting
            approval decisions.
          </p>
        </article>
      </section>

      <section
        className={
          "approval-toolbar"
        }
      >
        <div
          className={
            "select-wrapper"
          }
        >
          <select
            value={status}
            onChange={
              event =>
                setStatus(
                  event
                    .target
                    .value,
                )
            }
          >
            <option value="">
              All decisions
            </option>

            <option value="PENDING">
              Pending
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="REJECTED">
              Rejected
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </section>

      <section
        className={
          "panel approval-queue-panel"
        }
      >
        <div
          className={
            "supplier-panel__summary"
          }
        >
          <div>
            <ShieldCheck
              size={18}
            />

            <span>
              {loading
                ? "Loading approval queue..."
                : `${
                    tasks.length
                  } approval tasks`}
            </span>
          </div>

          <span>
            Role:
            {" "}
            {roleLabel(
              user?.role ??
                "",
            )}
          </span>
        </div>

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table approval-table"
            }
          >
            <thead>
              <tr>
                <th>
                  Request
                </th>

                <th>
                  Requester
                </th>

                <th>
                  Policy
                </th>

                <th>
                  Required role
                </th>

                <th>
                  Value
                </th>

                <th>
                  Status
                </th>

                <th>
                  Requested
                </th>

                <th>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                tasks.map(
                  task => (
                    <tr
                      key={
                        task.id
                      }
                    >
                      <td>
                        <div
                          className={
                            "request-primary-cell"
                          }
                        >
                          <strong>
                            {
                              task
                                .requestTitle
                            }
                          </strong>

                          <span>
                            {
                              task
                                .requestNumber
                            }
                            {" · "}
                            {
                              task
                                .departmentName
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <div
                          className={
                            "approval-person-cell"
                          }
                        >
                          <strong>
                            {
                              task
                                .requesterName
                            }
                          </strong>

                          <span>
                            {
                              task
                                .costCenter
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <div
                          className={
                            "approval-policy-cell"
                          }
                        >
                          <strong>
                            {
                              task
                                .policyName
                            }
                          </strong>

                          <span>
                            {
                              task
                                .policyCode
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            "approval-role-badge"
                          }
                        >
                          {
                            roleLabel(
                              task
                                .requiredRole,
                            )
                          }
                        </span>
                      </td>

                      <td>
                        <strong>
                          {
                            new Intl
                              .NumberFormat(
                                "en-US",
                                {
                                  style:
                                    "currency",
                                  currency:
                                    task
                                      .currency,
                                  maximumFractionDigits:
                                    0,
                                },
                              )
                              .format(
                                task
                                  .estimatedTotalAmount,
                              )
                          }
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `approval-status approval-status--${
                              task.status
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            statusLabel(
                              task.status,
                            )
                          }
                        </span>
                      </td>

                      <td>
                        {
                          new Date(
                            task
                              .requestedAt,
                          )
                            .toLocaleDateString()
                        }
                      </td>

                      <td>
                        <div
                          className={
                            "approval-table-actions"
                          }
                        >
                          <Link
                            href={
                              `/purchase-requests/${task.purchaseRequestId}`
                            }
                            className={
                              "approval-icon-action"
                            }
                            aria-label={
                              "View request"
                            }
                          >
                            <Eye
                              size={15}
                            />
                          </Link>

                          {task.status ===
                            "PENDING" ? (
                            <>
                              <button
                                type="button"
                                className={
                                  "approval-decision-button approval-decision-button--approve"
                                }
                                onClick={
                                  () =>
                                    setDecision({
                                      task,
                                      type:
                                        "APPROVE",
                                    })
                                }
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className={
                                  "approval-decision-button approval-decision-button--reject"
                                }
                                onClick={
                                  () =>
                                    setDecision({
                                      task,
                                      type:
                                        "REJECT",
                                    })
                                }
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              tasks.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={8}
                      className={
                        "table-empty-state"
                      }
                    >
                      No approval tasks
                      match the selected
                      status.
                    </td>
                  </tr>
                )
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {decision ? (
        <DecisionDialog
          decision={
            decision
          }
          onClose={
            () =>
              setDecision(
                null,
              )
          }
          onComplete={
            handleDecisionComplete
          }
        />
      ) : null}
    </div>
  );
}

interface DecisionDialogProps {
  decision: DecisionState;
  onClose: () => void;
  onComplete: () => void;
}

function DecisionDialog({
  decision,
  onClose,
  onComplete,
}: DecisionDialogProps) {
  const [
    comment,
    setComment,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const rejecting =
    decision.type ===
      "REJECT";

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(
        true,
      );

      setError(
        null,
      );

      if (rejecting) {
        await rejectTask(
          decision.task.id,
          comment,
        );
      } else {
        await approveTask(
          decision.task.id,
          comment,
        );
      }

      onComplete();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to record approval decision.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  return (
    <div
      className={
        "dialog-backdrop"
      }
      role="presentation"
      onMouseDown={
        event => {
          if (
            event
              .currentTarget ===
            event.target
          ) {
            onClose();
          }
        }
      }
    >
      <section
        className={
          "dialog approval-dialog"
        }
        role="dialog"
        aria-modal="true"
      >
        <div
          className={
            "dialog__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Approval decision
            </span>

            <h2>
              {rejecting
                ? "Reject request"
                : "Approve request"}
            </h2>

            <p>
              {
                decision
                  .task
                  .requestNumber
              }
              {" · "}
              {
                decision
                  .task
                  .requestTitle
              }
            </p>
          </div>

          <button
            type="button"
            className={
              "icon-button"
            }
            onClick={
              onClose
            }
            aria-label={
              "Close dialog"
            }
          >
            <X size={19} />
          </button>
        </div>

        <form
          className={
            "approval-decision-form"
          }
          onSubmit={
            handleSubmit
          }
        >
          <div
            className={
              "approval-decision-summary"
            }
          >
            <div>
              <span>
                Requester
              </span>

              <strong>
                {
                  decision
                    .task
                    .requesterName
                }
              </strong>
            </div>

            <div>
              <span>
                Policy
              </span>

              <strong>
                {
                  decision
                    .task
                    .policyName
                }
              </strong>
            </div>

            <div>
              <span>
                Estimated value
              </span>

              <strong>
                {
                  new Intl
                    .NumberFormat(
                      "en-US",
                      {
                        style:
                          "currency",
                        currency:
                          decision
                            .task
                            .currency,
                      },
                    )
                    .format(
                      decision
                        .task
                        .estimatedTotalAmount,
                    )
                }
              </strong>
            </div>
          </div>

          <label
            className={
              "request-field"
            }
          >
            <span>
              {rejecting
                ? "Rejection reason"
                : "Decision comment"}
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              required={
                rejecting
              }
              value={comment}
              placeholder={
                rejecting
                  ? "Explain why this purchase request is being rejected."
                  : "Optional approval comment."
              }
              onChange={
                event =>
                  setComment(
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          {error ? (
            <div
              className={
                "error-banner"
              }
            >
              <CircleAlert
                size={18}
              />
              {error}
            </div>
          ) : null}

          <div
            className={
              "dialog__footer"
            }
          >
            <button
              type="button"
              className={
                "button button--secondary"
              }
              onClick={
                onClose
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className={
                rejecting
                  ? "button approval-reject-submit"
                  : "button button--primary"
              }
              disabled={
                saving
              }
            >
              {saving
                ? "Saving decision..."
                : rejecting
                  ? "Reject request"
                  : "Approve request"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
