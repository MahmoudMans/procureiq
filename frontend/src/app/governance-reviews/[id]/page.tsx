"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Play,
  Plus,
  Printer,
  Scale,
  Snowflake,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  archiveGovernanceReview,
  cancelGovernanceAction,
  closeGovernanceReview,
  completeGovernanceAction,
  createGovernanceAction,
  createGovernanceDecision,
  freezeGovernanceReview,
  getGovernanceReview,
  getGovernanceReviewContext,
  openGovernanceReview,
  resolveGovernanceDecision,
  startGovernanceAction,
} from "@/lib/api";

import type {
  GovernanceActionPriority,
  GovernanceDecisionStatus,
  GovernanceDecisionType,
  GovernanceReviewContext,
  GovernanceReviewDetail,
  GovernanceSnapshotItemType,
} from "@/types/governance-review";

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
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function defaultDate(
  days: number,
): string {
  const value =
    new Date();

  value.setUTCDate(
    value.getUTCDate() + days,
  );

  return value
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function GovernanceReviewDetailPage() {
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
      GovernanceReviewDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      GovernanceReviewContext |
      null
    >(null);

  const [
    decisionType,
    setDecisionType,
  ] =
    useState<GovernanceDecisionType>(
      "APPROVAL",
    );

  const [
    decisionTitle,
    setDecisionTitle,
  ] =
    useState("");

  const [
    decisionDescription,
    setDecisionDescription,
  ] =
    useState("");

  const [
    decisionOwner,
    setDecisionOwner,
  ] =
    useState("");

  const [
    decisionDueDate,
    setDecisionDueDate,
  ] =
    useState(
      defaultDate(
        7,
      ),
    );

  const [
    decisionNotes,
    setDecisionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    decisionStatuses,
    setDecisionStatuses,
  ] =
    useState<
      Record<
        string,
        GovernanceDecisionStatus
      >
    >({});

  const [
    actionDecisionId,
    setActionDecisionId,
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
    actionOwner,
    setActionOwner,
  ] =
    useState("");

  const [
    actionPriority,
    setActionPriority,
  ] =
    useState<GovernanceActionPriority>(
      "HIGH",
    );

  const [
    actionDueDate,
    setActionDueDate,
  ] =
    useState(
      defaultDate(
        14,
      ),
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
    snapshotFilter,
    setSnapshotFilter,
  ] =
    useState<
      GovernanceSnapshotItemType |
      ""
    >("");

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

  const canChair =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getGovernanceReview(
        params.id,
      ),
      getGovernanceReviewContext(),
    ])
      .then(
        ([
          detailResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            detailResponse,
          );

          setContext(
            contextResponse,
          );

          const governanceUser =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (governanceUser) {
            setDecisionOwner(
              governanceUser.id,
            );

            setActionOwner(
              governanceUser.id,
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
              : "Unable to load governance review.",
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
      await getGovernanceReview(
        params.id,
      ),
    );
  }

  async function transition(
    action:
      "FREEZE"
      |
      "OPEN"
      |
      "CLOSE"
      |
      "ARCHIVE",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "FREEZE"
      ) {
        await freezeGovernanceReview(
          params.id,
        );
      } else if (
        action ===
        "OPEN"
      ) {
        await openGovernanceReview(
          params.id,
        );
      } else if (
        action ===
        "CLOSE"
      ) {
        await closeGovernanceReview(
          params.id,
        );
      } else {
        await archiveGovernanceReview(
          params.id,
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
          : "Unable to update governance review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addDecision(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createGovernanceDecision(
        params.id,
        {
          decisionType,
          title:
            decisionTitle.trim(),
          description:
            decisionDescription.trim(),
          decisionOwnerUserId:
            decisionOwner
            ||
            undefined,
          dueDate:
            decisionDueDate
            ||
            undefined,
        },
      );

      setDecisionTitle("");
      setDecisionDescription("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create governance decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decide(
    decisionId: string,
  ) {
    const note =
      decisionNotes[
        decisionId
      ]
      ??
      "";

    const status =
      decisionStatuses[
        decisionId
      ]
      ??
      "APPROVED";

    if (!note.trim()) {
      setError(
        "A formal decision note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await resolveGovernanceDecision(
        decisionId,
        status,
        note,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to resolve governance decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addAction(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createGovernanceAction(
        params.id,
        {
          decisionId:
            actionDecisionId
            ||
            undefined,
          title:
            actionTitle.trim(),
          description:
            actionDescription.trim()
            ||
            undefined,
          ownerUserId:
            actionOwner
            ||
            undefined,
          priority:
            actionPriority,
          dueDate:
            actionDueDate,
        },
      );

      setActionDecisionId("");
      setActionTitle("");
      setActionDescription("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create management action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function progressAction(
    actionId: string,
    action:
      "START"
      |
      "COMPLETE"
      |
      "CANCEL",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "START"
      ) {
        await startGovernanceAction(
          actionId,
        );
      } else {
        const note =
          actionNotes[
            actionId
          ]
          ??
          "";

        if (!note.trim()) {
          setError(
            "An action completion or cancellation note is required.",
          );

          return;
        }

        if (
          action ===
          "COMPLETE"
        ) {
          await completeGovernanceAction(
            actionId,
            note,
          );
        } else {
          await cancelGovernanceAction(
            actionId,
            note,
          );
        }
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update management action.",
      );
    } finally {
      setRunning(false);
    }
  }

  const snapshotItems =
    useMemo(
      () =>
        detail
          ?.snapshotItems
          .filter(
            item =>
              !snapshotFilter
              ||
              item.itemType ===
                snapshotFilter,
          )
        ??
        [],
      [
        detail,
        snapshotFilter,
      ],
    );

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading governance review...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/governance-reviews"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Governance reviews
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Governance review not found."}
        </div>
      </div>
    );
  }

  const {
    review,
    snapshot,
  } = detail;

  const actionMutable =
    review.status ===
      "IN_REVIEW"
    ||
    review.status ===
      "CLOSED";

  return (
    <div className="page-stack">
      <Link
        href="/governance-reviews"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Governance reviews
      </Link>

      <section className="governance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {review.reviewNumber}
            </span>

            <span
              className={
                `governance-review-status governance-review-status--${review.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                review.status,
              )}
            </span>
          </div>

          <h1>
            {review.title}
          </h1>

          <p>
            {review.periodStart}
            {" → "}
            {review.periodEnd}
            {" · "}
            {review.currency}
            {" · Chair: "}
            {review.chairName}
          </p>
        </div>

        <div className="governance-detail-actions">
          {canManage &&
          review.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "FREEZE",
                  )
              }
            >
              <Snowflake
                size={16}
              />
              Freeze snapshot
            </button>
          ) : null}

          {canManage &&
          review.status ===
            "FROZEN" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "OPEN",
                  )
              }
            >
              <Play
                size={16}
              />
              Open review
            </button>
          ) : null}

          {canChair &&
          review.status ===
            "IN_REVIEW" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                review.openDecisions >
                  0
              }
              onClick={
                () =>
                  void transition(
                    "CLOSE",
                  )
              }
            >
              <BadgeCheck
                size={16}
              />
              Close review
            </button>
          ) : null}

          {canChair &&
          review.status ===
            "CLOSED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                review.openActions >
                  0
              }
              onClick={
                () =>
                  void transition(
                    "ARCHIVE",
                  )
              }
            >
              Archive
            </button>
          ) : null}

          {review.status !==
          "DRAFT" ? (
            <Link
              href={
                `/governance-reviews/${review.id}/print`
              }
              className="button button--secondary"
            >
              <Printer
                size={16}
              />
              Review pack
            </Link>
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

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Management narrative
            </span>

            <h2>
              Executive summary
            </h2>
          </div>

          <FileText
            size={19}
          />
        </div>

        <div className="governance-executive-summary">
          {detail.executiveSummary}
        </div>
      </section>

      {!snapshot ? (
        <section className="governance-freeze-callout">
          <Snowflake
            size={20}
          />

          <div>
            <strong>
              Snapshot not frozen yet
            </strong>

            <p>
              Freeze the draft when the
              executive reporting cut-off
              is reached. ProcureIQ will
              persist the current supplier
              risk, category, benefits and
              execution evidence as the
              immutable review pack.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="governance-detail-kpis">
            <article>
              <span>
                Target savings
              </span>

              <strong>
                {money(
                  snapshot.baselineTargetSavings,
                  review.currency,
                )}
              </strong>
            </article>

            <article>
              <span>
                Forecast
              </span>

              <strong>
                {money(
                  snapshot.forecastSavings,
                  review.currency,
                )}
              </strong>
            </article>

            <article>
              <span>
                Validated
              </span>

              <strong>
                {money(
                  snapshot.validatedSavings,
                  review.currency,
                )}
              </strong>
            </article>

            <article>
              <span>
                At risk
              </span>

              <strong className="governance-risk-text">
                {money(
                  snapshot.atRiskAmount,
                  review.currency,
                )}
              </strong>
            </article>

            <article>
              <span>
                Critical suppliers
              </span>

              <strong>
                {snapshot.criticalRiskSuppliers}
              </strong>
            </article>

            <article>
              <span>
                Overdue initiatives
              </span>

              <strong
                className={
                  snapshot.overdueCategoryInitiatives >
                  0
                    ? "governance-risk-text"
                    : ""
                }
              >
                {snapshot.overdueCategoryInitiatives}
              </strong>
            </article>
          </section>

          <section className="governance-scorecard-grid">
            <article>
              <strong>
                Supplier risk
              </strong>

              <div>
                <span>
                  Evaluated
                </span>

                <b>
                  {snapshot.evaluatedSuppliers}
                </b>
              </div>

              <div>
                <span>
                  High
                </span>

                <b>
                  {snapshot.highRiskSuppliers}
                </b>
              </div>

              <div>
                <span>
                  Critical
                </span>

                <b>
                  {snapshot.criticalRiskSuppliers}
                </b>
              </div>

              <div>
                <span>
                  Active alerts
                </span>

                <b>
                  {snapshot.activeRiskAlerts}
                </b>
              </div>
            </article>

            <article>
              <strong>
                Category execution
              </strong>

              <div>
                <span>
                  Strategies
                </span>

                <b>
                  {snapshot.activeCategoryStrategies}
                </b>
              </div>

              <div>
                <span>
                  Initiatives
                </span>

                <b>
                  {snapshot.activeCategoryInitiatives}
                </b>
              </div>

              <div>
                <span>
                  Overdue
                </span>

                <b>
                  {snapshot.overdueCategoryInitiatives}
                </b>
              </div>

              <div>
                <span>
                  Approved scenarios
                </span>

                <b>
                  {snapshot.approvedScenarios}
                </b>
              </div>
            </article>

            <article>
              <strong>
                Benefits governance
              </strong>

              <div>
                <span>
                  Execution portfolios
                </span>

                <b>
                  {snapshot.activeExecutionPortfolios}
                </b>
              </div>

              <div>
                <span>
                  Pending validations
                </span>

                <b>
                  {snapshot.validationPendingItems}
                </b>
              </div>

              <div>
                <span>
                  Leakage cases
                </span>

                <b>
                  {snapshot.activeLeakageCases}
                </b>
              </div>

              <div>
                <span>
                  Invalid assumptions
                </span>

                <b>
                  {snapshot.invalidatedAssumptions}
                </b>
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Frozen evidence
                </span>

                <h2>
                  Executive attention items
                </h2>
              </div>

              <select
                className="governance-snapshot-filter"
                value={snapshotFilter}
                onChange={
                  event =>
                    setSnapshotFilter(
                      event.target.value as
                        GovernanceSnapshotItemType |
                        "",
                    )
                }
              >
                <option value="">
                  All evidence
                </option>

                <option value="SUPPLIER_RISK">
                  Supplier risk
                </option>

                <option value="CATEGORY_STRATEGY">
                  Category strategy
                </option>

                <option value="BENEFIT_PORTFOLIO">
                  Benefit portfolio
                </option>
              </select>
            </div>

            <div className="governance-snapshot-list">
              {snapshotItems.map(
                item => (
                  <article
                    key={item.id}
                  >
                    <div className="governance-snapshot-heading">
                      <div>
                        <span
                          className={
                            `governance-severity governance-severity--${item.severity.toLowerCase()}`
                          }
                        >
                          {item.severity}
                        </span>

                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {readable(
                            item.itemType,
                          )}
                          {item.subtitle
                            ? ` · ${item.subtitle}`
                            : ""}
                        </small>
                      </div>

                      <div>
                        <span>
                          {item.metricLabel}
                        </span>

                        <strong>
                          {item.currency
                            ? money(
                                item.metricValue,
                                item.currency,
                              )
                            : item.metricValue.toFixed(
                                1,
                              )}
                        </strong>
                      </div>
                    </div>

                    <p>
                      {item.details}
                    </p>
                  </article>
                ),
              )}

              {snapshotItems.length ===
              0 ? (
                <div className="governance-empty">
                  No frozen evidence items
                  in this section.
                </div>
              ) : null}
            </div>
          </section>
        </>
      )}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Formal governance
            </span>

            <h2>
              Decision register
            </h2>
          </div>

          <Scale
            size={19}
          />
        </div>

        <div className="governance-decision-list">
          {detail.decisions.map(
            decision => (
              <article
                key={decision.id}
                className={
                  decision.overdue
                    ? "governance-decision governance-decision--overdue"
                    : "governance-decision"
                }
              >
                <div className="governance-decision-heading">
                  <div>
                    <span
                      className={
                        `governance-decision-status governance-decision-status--${decision.status.toLowerCase()}`
                      }
                    >
                      {readable(
                        decision.status,
                      )}
                    </span>

                    <strong>
                      {decision.title}
                    </strong>

                    <small>
                      {decision.decisionNumber}
                      {" · "}
                      {readable(
                        decision.decisionType,
                      )}
                      {" · Owner: "}
                      {decision.decisionOwnerName}
                    </small>
                  </div>

                  <span
                    className={
                      decision.overdue
                        ? "governance-risk-text"
                        : ""
                    }
                  >
                    Due
                    {" "}
                    {decision.dueDate ??
                      "—"}
                  </span>
                </div>

                <p>
                  {decision.description}
                </p>

                {decision.decisionNote ? (
                  <div className="governance-resolution-note">
                    {decision.decisionNote}
                    {decision.decidedByName
                      ? ` — ${decision.decidedByName}`
                      : ""}
                  </div>
                ) : null}

                {canChair &&
                review.status ===
                  "IN_REVIEW" &&
                decision.status ===
                  "OPEN" ? (
                  <div className="governance-decision-controls">
                    <select
                      value={
                        decisionStatuses[
                          decision.id
                        ]
                        ??
                        "APPROVED"
                      }
                      onChange={
                        event =>
                          setDecisionStatuses(
                            current => ({
                              ...current,
                              [decision.id]:
                                event.target.value as
                                  GovernanceDecisionStatus,
                            }),
                          )
                      }
                    >
                      <option value="APPROVED">
                        Approve
                      </option>

                      <option value="REJECTED">
                        Reject
                      </option>

                      <option value="DEFERRED">
                        Defer
                      </option>
                    </select>

                    <input
                      value={
                        decisionNotes[
                          decision.id
                        ]
                        ??
                        ""
                      }
                      placeholder={
                        "Formal decision note"
                      }
                      onChange={
                        event =>
                          setDecisionNotes(
                            current => ({
                              ...current,
                              [decision.id]:
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
                          decisionNotes[
                            decision.id
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void decide(
                            decision.id,
                          )
                      }
                    >
                      Resolve
                    </button>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.decisions.length ===
          0 ? (
            <div className="governance-empty">
              No formal decision requests.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Accountability
            </span>

            <h2>
              Management actions
            </h2>
          </div>

          <ClipboardCheck
            size={19}
          />
        </div>

        <div className="governance-action-list">
          {detail.actions.map(
            action => (
              <article
                key={action.id}
                className={
                  action.overdue
                    ? "governance-action governance-action--overdue"
                    : "governance-action"
                }
              >
                <div className="governance-action-heading">
                  <div>
                    <span
                      className={
                        `governance-action-status governance-action-status--${action.status.toLowerCase().replaceAll("_", "-")}`
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
                      {action.actionNumber}
                      {" · "}
                      {action.priority}
                      {" · Owner: "}
                      {action.ownerName}
                    </small>
                  </div>

                  <strong
                    className={
                      action.overdue
                        ? "governance-risk-text"
                        : ""
                    }
                  >
                    {action.dueDate}
                  </strong>
                </div>

                {action.description ? (
                  <p>
                    {action.description}
                  </p>
                ) : null}

                {action.completionNote ? (
                  <div className="governance-resolution-note">
                    {action.completionNote}
                  </div>
                ) : null}

                {canManage &&
                actionMutable &&
                action.status ===
                  "OPEN" ? (
                  <button
                    type="button"
                    className="governance-small-button"
                    disabled={running}
                    onClick={
                      () =>
                        void progressAction(
                          action.id,
                          "START",
                        )
                    }
                  >
                    <Play
                      size={12}
                    />
                    Start
                  </button>
                ) : null}

                {canManage &&
                actionMutable &&
                (
                  action.status ===
                    "OPEN"
                  ||
                  action.status ===
                    "IN_PROGRESS"
                ) ? (
                  <div className="governance-action-controls">
                    <input
                      value={
                        actionNotes[
                          action.id
                        ]
                        ??
                        ""
                      }
                      placeholder={
                        "Completion / cancellation note"
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
                          void progressAction(
                            action.id,
                            "COMPLETE",
                          )
                      }
                    >
                      <BadgeCheck
                        size={12}
                      />
                      Complete
                    </button>

                    {canChair ? (
                      <button
                        type="button"
                        className="governance-danger-button"
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
                            void progressAction(
                              action.id,
                              "CANCEL",
                            )
                        }
                      >
                        <XCircle
                          size={12}
                        />
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.actions.length ===
          0 ? (
            <div className="governance-empty">
              No management actions.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      review.status ===
        "IN_REVIEW" ? (
        <section className="governance-form-columns">
          <form
            className="panel"
            onSubmit={addDecision}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Board decision
                </span>

                <h2>
                  Add decision request
                </h2>
              </div>

              <Plus
                size={19}
              />
            </div>

            <div className="governance-form-grid">
              <label className="request-field">
                <span>
                  Decision type
                </span>

                <select
                  value={decisionType}
                  onChange={
                    event =>
                      setDecisionType(
                        event.target.value as
                          GovernanceDecisionType,
                      )
                  }
                >
                  <option value="APPROVAL">
                    Approval
                  </option>

                  <option value="ESCALATION">
                    Escalation
                  </option>

                  <option value="PRIORITY">
                    Priority
                  </option>

                  <option value="RISK_ACCEPTANCE">
                    Risk acceptance
                  </option>

                  <option value="INVESTMENT">
                    Investment
                  </option>

                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </label>

              <label className="request-field">
                <span>
                  Decision owner
                </span>

                <select
                  value={decisionOwner}
                  onChange={
                    event =>
                      setDecisionOwner(
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
                        </option>
                      ),
                    )}
                </select>
              </label>

              <label className="request-field governance-form-wide">
                <span>
                  Title
                </span>

                <input
                  required
                  value={decisionTitle}
                  onChange={
                    event =>
                      setDecisionTitle(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Due date
                </span>

                <input
                  type="date"
                  value={decisionDueDate}
                  onChange={
                    event =>
                      setDecisionDueDate(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field governance-form-wide">
                <span>
                  Decision context
                </span>

                <textarea
                  required
                  rows={5}
                  value={decisionDescription}
                  onChange={
                    event =>
                      setDecisionDescription(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="governance-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !decisionTitle.trim()
                  ||
                  !decisionDescription.trim()
                }
              >
                Add decision
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={addAction}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Management follow-up
                </span>

                <h2>
                  Add action
                </h2>
              </div>

              <Plus
                size={19}
              />
            </div>

            <div className="governance-form-grid">
              <label className="request-field">
                <span>
                  Related decision
                </span>

                <select
                  value={actionDecisionId}
                  onChange={
                    event =>
                      setActionDecisionId(
                        event.target.value,
                      )
                  }
                >
                  <option value="">
                    Independent action
                  </option>

                  {detail.decisions.map(
                    decision => (
                      <option
                        key={decision.id}
                        value={decision.id}
                      >
                        {decision.decisionNumber}
                        {" — "}
                        {decision.title}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Owner
                </span>

                <select
                  value={actionOwner}
                  onChange={
                    event =>
                      setActionOwner(
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
                        </option>
                      ),
                    )}
                </select>
              </label>

              <label className="request-field governance-form-wide">
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

              <label className="request-field">
                <span>
                  Priority
                </span>

                <select
                  value={actionPriority}
                  onChange={
                    event =>
                      setActionPriority(
                        event.target.value as
                          GovernanceActionPriority,
                      )
                  }
                >
                  <option value="LOW">
                    Low
                  </option>

                  <option value="MEDIUM">
                    Medium
                  </option>

                  <option value="HIGH">
                    High
                  </option>

                  <option value="CRITICAL">
                    Critical
                  </option>
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

              <label className="request-field governance-form-wide">
                <span>
                  Description
                </span>

                <textarea
                  rows={5}
                  value={actionDescription}
                  onChange={
                    event =>
                      setActionDescription(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="governance-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !actionTitle.trim()
                }
              >
                Add action
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
