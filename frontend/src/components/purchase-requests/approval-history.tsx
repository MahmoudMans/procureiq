"use client";

import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getApprovalHistory,
} from "@/lib/api";

import type {
  ApprovalTask,
} from "@/types/approval";

interface ApprovalHistoryProps {
  purchaseRequestId: string;
}

function iconForStatus(
  status: ApprovalTask["status"],
) {
  if (
    status === "APPROVED"
  ) {
    return CheckCircle2;
  }

  if (
    status === "REJECTED"
  ) {
    return XCircle;
  }

  if (
    status === "CANCELLED"
  ) {
    return CircleAlert;
  }

  return Clock3;
}

export function ApprovalHistory({
  purchaseRequestId,
}: ApprovalHistoryProps) {
  const [
    tasks,
    setTasks,
  ] =
    useState<ApprovalTask[]>(
      [],
    );

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

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response =
          await getApprovalHistory(
            purchaseRequestId,
          );

        if (mounted) {
          setTasks(
            response,
          );
        }
      } catch (
        caughtError
      ) {
        if (mounted) {
          setError(
            caughtError instanceof
              Error
              ? caughtError
                  .message
              : "Unable to load approval history.",
          );
        }
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
    purchaseRequestId,
  ]);

  return (
    <section
      className={
        "panel"
      }
    >
      <div
        className={
          "panel__header"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Governance
          </span>

          <h2>
            Approval history
          </h2>
        </div>

        <ShieldCheck
          size={19}
        />
      </div>

      {loading ? (
        <div
          className={
            "approval-history-empty"
          }
        >
          Loading approval
          history...
        </div>
      ) : null}

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

      {!loading &&
      !error &&
      tasks.length === 0 ? (
        <div
          className={
            "approval-history-empty"
          }
        >
          No approval task has
          been created yet.
        </div>
      ) : null}

      {!loading &&
      tasks.length > 0 ? (
        <div
          className={
            "approval-history"
          }
        >
          {tasks.map(
            task => {
              const Icon =
                iconForStatus(
                  task.status,
                );

              return (
                <article
                  key={
                    task.id
                  }
                  className={
                    `approval-history__item approval-history__item--${
                      task.status
                        .toLowerCase()
                    }`
                  }
                >
                  <div
                    className={
                      "approval-history__icon"
                    }
                  >
                    <Icon
                      size={17}
                    />
                  </div>

                  <div
                    className={
                      "approval-history__content"
                    }
                  >
                    <div
                      className={
                        "approval-history__heading"
                      }
                    >
                      <div>
                        <strong>
                          {
                            task
                              .policyName
                          }
                        </strong>

                        <span>
                          Required:
                          {" "}
                          {
                            task
                              .requiredRole
                              .replaceAll(
                                "_",
                                " ",
                              )
                          }
                        </span>
                      </div>

                      <span
                        className={
                          `approval-status approval-status--${
                            task.status
                              .toLowerCase()
                          }`
                        }
                      >
                        {
                          task.status
                        }
                      </span>
                    </div>

                    <div
                      className={
                        "approval-history__meta"
                      }
                    >
                      <span>
                        Requested
                        {" "}
                        {
                          new Date(
                            task
                              .requestedAt,
                          )
                            .toLocaleString()
                        }
                      </span>

                      {task.decidedAt ? (
                        <span>
                          Decided
                          {" "}
                          {
                            new Date(
                              task
                                .decidedAt,
                            )
                              .toLocaleString()
                          }
                        </span>
                      ) : null}

                      {task.decidedByName ? (
                        <span>
                          By
                          {" "}
                          {
                            task
                              .decidedByName
                          }
                        </span>
                      ) : null}
                    </div>

                    {task.decisionComment ? (
                      <p>
                        {
                          task
                            .decisionComment
                        }
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            },
          )}
        </div>
      ) : null}
    </section>
  );
}
