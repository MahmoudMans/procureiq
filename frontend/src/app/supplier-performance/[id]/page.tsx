"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  Play,
  Plus,
  Send,
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
  approveSupplierPerformanceReview,
  cancelSupplierCorrectiveAction,
  completeSupplierCorrectiveAction,
  createSupplierCorrectiveAction,
  getSupplierPerformanceContext,
  getSupplierPerformanceReview,
  rejectSupplierPerformanceReview,
  startSupplierCorrectiveAction,
  submitSupplierPerformanceReview,
} from "@/lib/api";

import type {
  CorrectiveAction,
  SupplierPerformanceContext,
  SupplierPerformanceReviewDetail,
} from "@/types/supplier-performance";

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

function money(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export default function SupplierPerformanceDetailPage() {
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
      SupplierPerformanceReviewDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      SupplierPerformanceContext |
      null
    >(null);

  const [
    decisionNote,
    setDecisionNote,
  ] =
    useState("");

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
    actionOwnerUserId,
    setActionOwnerUserId,
  ] =
    useState("");

  const [
    actionDueDate,
    setActionDueDate,
  ] =
    useState("");

  const [
    completionNotes,
    setCompletionNotes,
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
    actionSaving,
    setActionSaving,
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

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getSupplierPerformanceReview(
        params.id,
      ),
      getSupplierPerformanceContext(),
    ])
      .then(
        ([
          reviewResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            reviewResponse,
          );

          setContext(
            contextResponse,
          );

          const owner =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                "REQUESTER",
            );

          if (owner) {
            setActionOwnerUserId(
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
              : "Unable to load supplier performance review.",
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
      await getSupplierPerformanceReview(
        params.id,
      ),
    );
  }

  async function runReviewLifecycle(
    action:
      | "SUBMIT"
      | "APPROVE"
      | "REJECT",
  ) {
    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "SUBMIT"
      ) {
        await submitSupplierPerformanceReview(
          detail.review.id,
        );
      } else if (
        action ===
        "APPROVE"
      ) {
        await approveSupplierPerformanceReview(
          detail.review.id,
          decisionNote,
        );
      } else {
        await rejectSupplierPerformanceReview(
          detail.review.id,
          decisionNote,
        );
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update supplier performance workflow.",
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

    if (!detail) {
      return;
    }

    try {
      setActionSaving(true);
      setError(null);

      await createSupplierCorrectiveAction(
        detail.review.id,
        {
          title:
            actionTitle.trim(),
          description:
            actionDescription
              .trim()
              ||
            undefined,
          ownerUserId:
            actionOwnerUserId
              ||
            undefined,
          dueDate:
            actionDueDate,
        },
      );

      setActionTitle("");
      setActionDescription("");
      setActionDueDate("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create corrective action.",
      );
    } finally {
      setActionSaving(false);
    }
  }

  async function startAction(
    action:
      CorrectiveAction,
  ) {
    try {
      setError(null);

      await startSupplierCorrectiveAction(
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
          : "Unable to start corrective action.",
      );
    }
  }

  async function completeAction(
    action:
      CorrectiveAction,
  ) {
    const note =
      completionNotes[
        action.id
      ] ?? "";

    if (!note.trim()) {
      setError(
        "A completion note is required.",
      );

      return;
    }

    try {
      setError(null);

      await completeSupplierCorrectiveAction(
        action.id,
        note,
      );

      setCompletionNotes(
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
          : "Unable to complete corrective action.",
      );
    }
  }

  async function cancelAction(
    action:
      CorrectiveAction,
  ) {
    try {
      setError(null);

      await cancelSupplierCorrectiveAction(
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
          : "Unable to cancel corrective action.",
      );
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading supplier performance
        review...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/supplier-performance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Supplier performance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Supplier performance review not found."}
        </div>
      </div>
    );
  }

  const {
    review,
    correctiveActions,
    supplierHistory,
  } = detail;

  return (
    <div className="page-stack">
      <Link
        href="/supplier-performance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier performance
      </Link>

      <section className="supplier-performance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {review.reviewNumber}
            </span>

            <span
              className={
                `performance-review-status performance-review-status--${review.status.toLowerCase()}`
              }
            >
              {readable(
                review.status,
              )}
            </span>

            <span
              className={
                `performance-band performance-band--${review.performanceBand.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                review.performanceBand,
              )}
            </span>
          </div>

          <h1>
            {review.supplierName}
          </h1>

          <p>
            {review.supplierCode}
            {" · "}
            {review.supplierCategory ??
              "Uncategorized"}
            {" · "}
            {new Date(
              `${review.periodStart}T00:00:00`,
            )
              .toLocaleDateString()}
            {" — "}
            {new Date(
              `${review.periodEnd}T00:00:00`,
            )
              .toLocaleDateString()}
          </p>
        </div>

        <div className="supplier-performance-detail-actions">
          {canManage &&
          review.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void runReviewLifecycle(
                    "SUBMIT",
                  )
              }
            >
              <Send
                size={16}
              />
              Submit review
            </button>
          ) : null}
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

      <section className="supplier-performance-detail-kpis">
        <article className="request-detail-summary-card">
          <Gauge
            size={18}
          />

          <div>
            <span>
              Weighted score
            </span>

            <strong>
              {review.weightedScore.toFixed(1)}
            </strong>

            <small>
              {readable(
                review.performanceBand,
              )}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <ClipboardCheck
            size={18}
          />

          <div>
            <span>
              Purchase orders
            </span>

            <strong>
              {review.purchaseOrderCountSnapshot}
            </strong>

            <small>
              {money(
                review.purchaseOrderValueSnapshot,
              )}
              {" total value"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <AlertTriangle
            size={18}
          />

          <div>
            <span>
              Overdue POs
            </span>

            <strong>
              {review.overduePurchaseOrderCountSnapshot}
            </strong>

            <small>
              Snapshot at review
              creation
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <BadgeCheck
            size={18}
          />

          <div>
            <span>
              Corrective actions
            </span>

            <strong>
              {review.openCorrectiveActions}
            </strong>

            <small>
              {review.overdueCorrectiveActions}
              {" overdue"}
            </small>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Supplier scorecard
            </span>

            <h2>
              Weighted dimensions
            </h2>
          </div>
        </div>

        <div className="supplier-dimension-grid">
          <Dimension
            label="Quality"
            score={
              review.qualityScore
            }
            weight="25%"
          />

          <Dimension
            label="Delivery"
            score={
              review.deliveryScore
            }
            weight="25%"
          />

          <Dimension
            label="Commercial"
            score={
              review.commercialScore
            }
            weight="20%"
          />

          <Dimension
            label="Service"
            score={
              review.serviceScore
            }
            weight="15%"
          />

          <Dimension
            label="Compliance"
            score={
              review.complianceScore
            }
            weight="15%"
          />
        </div>
      </section>

      <section className="supplier-performance-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Supplier snapshot
              </span>

              <h2>
                Review context
              </h2>
            </div>
          </div>

          <div className="supplier-performance-context-grid">
            <div>
              <span>
                Supplier rating
              </span>

              <strong>
                {review.supplierRatingSnapshot ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Risk level
              </span>

              <strong>
                {review.supplierRiskSnapshot ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Review owner
              </span>

              <strong>
                {review.ownerName}
              </strong>
            </div>

            <div>
              <span>
                Category
              </span>

              <strong>
                {review.supplierCategory ??
                  "—"}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Performance history
              </span>

              <h2>
                Supplier trend
              </h2>
            </div>
          </div>

          <div className="supplier-performance-history">
            {supplierHistory
              .slice(
                0,
                8,
              )
              .map(
                history => (
                  <article
                    key={
                      history.reviewId
                    }
                  >
                    <div>
                      <strong>
                        {history.reviewNumber}
                      </strong>

                      <span>
                        {new Date(
                          `${history.periodEnd}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </span>
                    </div>

                    <strong>
                      {history.weightedScore.toFixed(1)}
                    </strong>

                    <span
                      className={
                        `performance-band performance-band--${history.performanceBand.toLowerCase().replaceAll("_", "-")}`
                      }
                    >
                      {readable(
                        history.performanceBand,
                      )}
                    </span>
                  </article>
                ),
              )}
          </div>
        </section>
      </section>

      {canApprove &&
      review.status ===
        "SUBMITTED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Performance governance
              </span>

              <h2>
                Review decision
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Decision rationale
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="supplier-performance-decision-actions">
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
                  void runReviewLifecycle(
                    "REJECT",
                  )
              }
            >
              <XCircle
                size={16}
              />
              Reject
            </button>

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
                  void runReviewLifecycle(
                    "APPROVE",
                  )
              }
            >
              <CheckCircle2
                size={16}
              />
              Approve review
            </button>
          </div>
        </section>
      ) : null}

      {review.decisionNote ? (
        <section className="supplier-performance-decision-card">
          <BadgeCheck
            size={19}
          />

          <div>
            <span>
              Governance decision
            </span>

            <strong>
              {review.decisionNote}
            </strong>

            <small>
              {review.decidedByName ??
                "Management"}
              {review.decidedAt
                ? ` · ${new Date(
                    review.decidedAt,
                  ).toLocaleString()}`
                : ""}
            </small>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Improvement management
            </span>

            <h2>
              Corrective action plan
            </h2>
          </div>

          <ClipboardCheck
            size={19}
          />
        </div>

        {correctiveActions.length ===
        0 ? (
          <div className="supplier-performance-empty">
            No corrective actions are
            attached to this review.
          </div>
        ) : (
          <div className="supplier-corrective-action-list">
            {correctiveActions.map(
              action => (
                <CorrectiveActionCard
                  key={action.id}
                  action={action}
                  canManage={
                    canManage
                  }
                  canApprove={
                    canApprove
                  }
                  completionNote={
                    completionNotes[
                      action.id
                    ] ??
                    ""
                  }
                  setCompletionNote={
                    value =>
                      setCompletionNotes(
                        current => ({
                          ...current,
                          [action.id]:
                            value,
                        }),
                      )
                  }
                  startAction={
                    () =>
                      void startAction(
                        action,
                      )
                  }
                  completeAction={
                    () =>
                      void completeAction(
                        action,
                      )
                  }
                  cancelAction={
                    () =>
                      void cancelAction(
                        action,
                      )
                  }
                />
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      review.status ===
        "APPROVED" ? (
        <form
          className="panel"
          onSubmit={createAction}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Corrective action
              </span>

              <h2>
                Add improvement action
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="supplier-performance-form-grid">
            <label className="request-field supplier-performance-form-wide">
              <span>
                Action title
              </span>

              <input
                required
                maxLength={220}
                value={actionTitle}
                onChange={
                  event =>
                    setActionTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field supplier-performance-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={actionDescription}
                onChange={
                  event =>
                    setActionDescription(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Owner
              </span>

              <select
                value={actionOwnerUserId}
                onChange={
                  event =>
                    setActionOwnerUserId(
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
                        key={
                          candidate.id
                        }
                        value={
                          candidate.id
                        }
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Due date
              </span>

              <input
                required
                type="date"
                value={actionDueDate}
                onChange={
                  event =>
                    setActionDueDate(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="supplier-performance-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                actionSaving
                ||
                !actionTitle.trim()
                ||
                !actionDueDate
              }
            >
              <Plus
                size={16}
              />

              {actionSaving
                ? "Adding..."
                : "Add corrective action"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

interface DimensionProps {
  label: string;
  score: number;
  weight: string;
}

function Dimension({
  label,
  score,
  weight,
}: DimensionProps) {
  return (
    <article className="supplier-dimension-card">
      <div>
        <span>
          {label}
        </span>

        <small>
          Weight {weight}
        </small>
      </div>

      <strong>
        {score.toFixed(1)}
      </strong>

      <div className="supplier-dimension-track">
        <div
          style={{
            width:
              `${Math.min(
                100,
                Math.max(
                  0,
                  score,
                ),
              )}%`,
          }}
        />
      </div>
    </article>
  );
}

interface CorrectiveActionCardProps {
  action:
    CorrectiveAction;

  canManage:
    boolean;

  canApprove:
    boolean;

  completionNote:
    string;

  setCompletionNote:
    (value: string) =>
      void;

  startAction:
    () => void;

  completeAction:
    () => void;

  cancelAction:
    () => void;
}

function CorrectiveActionCard({
  action,
  canManage,
  canApprove,
  completionNote,
  setCompletionNote,
  startAction,
  completeAction,
  cancelAction,
}: CorrectiveActionCardProps) {
  return (
    <article
      className={
        `supplier-corrective-action supplier-corrective-action--${action.status.toLowerCase().replaceAll("_", "-")} ${
          action.overdue
            ? "supplier-corrective-action--overdue"
            : ""
        }`
      }
    >
      <div className="supplier-corrective-action-heading">
        <div>
          <span
            className={
              `supplier-capa-status supplier-capa-status--${action.status.toLowerCase().replaceAll("_", "-")}`
            }
          >
            {readable(
              action.status,
            )}
          </span>

          <strong>
            {action.title}
          </strong>

          <p>
            {action.description ??
              "No additional description."}
          </p>
        </div>

        <div>
          <span>
            Due
          </span>

          <strong
            className={
              action.overdue
                ? "supplier-capa-overdue"
                : ""
            }
          >
            {new Date(
              `${action.dueDate}T00:00:00`,
            )
              .toLocaleDateString()}
          </strong>
        </div>
      </div>

      <div className="supplier-corrective-action-meta">
        <span>
          Owner:
          {" "}
          {action.ownerName}
        </span>

        {action.completedAt ? (
          <span>
            Completed:
            {" "}
            {new Date(
              action.completedAt,
            )
              .toLocaleString()}
          </span>
        ) : null}
      </div>

      {action.completionNote ? (
        <div className="supplier-capa-completion-note">
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
        <div className="supplier-corrective-action-controls">
          {action.status ===
          "OPEN" ? (
            <button
              type="button"
              className="supplier-performance-inline-action"
              onClick={
                startAction
              }
            >
              <Play
                size={14}
              />
              Start
            </button>
          ) : null}

          <input
            value={completionNote}
            placeholder={
              "Completion evidence / result"
            }
            onChange={
              event =>
                setCompletionNote(
                  event.target.value,
                )
            }
          />

          <button
            type="button"
            className="supplier-performance-inline-action"
            disabled={
              !completionNote.trim()
            }
            onClick={
              completeAction
            }
          >
            <CheckCircle2
              size={14}
            />
            Complete
          </button>

          {canApprove ? (
            <button
              type="button"
              className="supplier-performance-inline-action supplier-performance-inline-action--danger"
              onClick={
                cancelAction
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
  );
}
