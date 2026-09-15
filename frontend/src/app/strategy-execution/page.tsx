"use client";

import {
  Camera,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureStrategyExecutionReview,
  getStrategyExecutionDashboard,
  getStrategyRoadmapDashboard,
  importStrategyExecutionRoadmap,
} from "@/lib/api";

import type {
  StrategyExecutionDashboard,
} from "@/types/strategy-execution";

import type {
  StrategyRoadmapDashboard,
} from "@/types/strategy-roadmap";

import {
  useEffect,
  useState,
} from "react";

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

export default function StrategyExecutionPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategyExecutionDashboard |
      null
    >(null);

  const [
    roadmaps,
    setRoadmaps,
  ] =
    useState<
      StrategyRoadmapDashboard |
      null
    >(null);

  const [
    selectedRoadmapId,
    setSelectedRoadmapId,
  ] =
    useState("");

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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

  useEffect(() => {
    let active = true;

    Promise.all([
      getStrategyExecutionDashboard(),
      getStrategyRoadmapDashboard(),
    ])
      .then(
        ([
          execution,
          roadmapResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDashboard(
            execution,
          );

          setRoadmaps(
            roadmapResponse,
          );

          const activeRoadmap =
            roadmapResponse
              .roadmaps
              .find(
                roadmap =>
                  roadmap.status ===
                    "ACTIVE",
              );

          if (activeRoadmap) {
            setSelectedRoadmapId(
              activeRoadmap.id,
            );
          }
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load strategic execution.",
            );
          }
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
  }, []);

  async function reload() {
    setDashboard(
      await getStrategyExecutionDashboard(),
    );
  }

  async function importRoadmap() {
    if (!selectedRoadmapId) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDashboard(
        await importStrategyExecutionRoadmap(
          selectedRoadmapId,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to import roadmap commitments.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureReview() {
    if (!selectedRoadmapId) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await captureStrategyExecutionReview(
        selectedRoadmapId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture execution review.",
      );
    } finally {
      setRunning(false);
    }
  }

  const summary =
    dashboard?.summary;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategy-to-outcome governance
          </span>

          <h1>
            Strategic execution
          </h1>

          <p>
            Convert active roadmap
            initiatives into governed
            execution commitments and
            keep planned, reported and
            validated contribution
            strictly separated.
          </p>
        </div>

        {canManage ? (
          <div className="execution-heading-actions">
            <label className="execution-roadmap-select">
              <span>
                Active roadmap
              </span>

              <select
                value={selectedRoadmapId}
                onChange={
                  event =>
                    setSelectedRoadmapId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select roadmap
                </option>

                {roadmaps
                  ?.roadmaps
                  .filter(
                    roadmap =>
                      roadmap.status ===
                        "ACTIVE",
                  )
                  .map(
                    roadmap => (
                      <option
                        key={roadmap.id}
                        value={roadmap.id}
                      >
                        {roadmap.roadmapNumber}
                        {" — "}
                        {roadmap.title}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !selectedRoadmapId
              }
              onClick={
                () =>
                  void importRoadmap()
              }
            >
              Import commitments
            </button>

            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !selectedRoadmapId
              }
              onClick={
                () =>
                  void captureReview()
              }
            >
              <Camera
                size={15}
              />
              Capture review
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="execution-score-grid">
        <article className="execution-score-card">
          <span>
            Execution score
          </span>

          <strong>
            {(
              summary
                ?.executionScore ??
                0
            ).toFixed(1)}
          </strong>

          <small>
            {summary
              ? readable(
                  summary.executionHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Average progress
          </span>

          <strong>
            {(
              summary
                ?.averageProgressPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Schedule health
          </span>

          <strong>
            {(
              summary
                ?.scheduleHealthPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Outcome validation
          </span>

          <strong>
            {(
              summary
                ?.outcomeValidationPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Value at risk
          </span>

          <strong className="execution-risk-text">
            {(
              summary
                ?.valueAtRiskPoints ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Validated contribution
          </span>

          <strong>
            {(
              summary
                ?.validatedContributionPoints ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>
      </section>

      <section className="execution-signal-grid">
        <article>
          <span>
            Commitments
          </span>

          <strong>
            {summary
              ?.commitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Completed
          </span>

          <strong>
            {summary
              ?.completedCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Blocked
          </span>

          <strong className="execution-risk-text">
            {summary
              ?.blockedCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            At risk
          </span>

          <strong className="execution-risk-text">
            {summary
              ?.atRiskCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Overdue
          </span>

          <strong className="execution-risk-text">
            {summary
              ?.overdueCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Planned / reported
          </span>

          <strong>
            {(
              summary
                ?.plannedContributionPoints ??
                0
            ).toFixed(1)}
            {" / "}
            {(
              summary
                ?.reportedContributionPoints ??
                0
            ).toFixed(1)}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Delivery commitments
            </span>

            <h2>
              Strategic execution portfolio
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Commitment</th>
                <th>Roadmap</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Health</th>
                <th>Progress</th>
                <th>Forecast</th>
                <th>Planned</th>
                <th>Reported</th>
                <th>Validated</th>
                <th>VAR</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.commitments
                  .map(
                    commitment => (
                      <tr
                        key={commitment.id}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {commitment.sourceInitiativeTitle}
                            </strong>

                            <span>
                              {commitment.commitmentNumber}
                              {" · "}
                              {commitment.sourceInitiativeNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {commitment.sourceRoadmapNumber}
                        </td>

                        <td>
                          {commitment.ownerName}
                        </td>

                        <td>
                          {readable(
                            commitment.status,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              `execution-health execution-health--${commitment.health.toLowerCase().replaceAll("_", "-")}`
                            }
                          >
                            {readable(
                              commitment.health,
                            )}
                          </span>
                        </td>

                        <td>
                          {commitment.progressPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {commitment.forecastEndDate}
                        </td>

                        <td>
                          {commitment.plannedContributionPoints.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {commitment.reportedContributionPoints.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {commitment.validatedContributionPoints.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              commitment.valueAtRiskPoints >
                              0
                                ? "execution-risk-text"
                                : ""
                            }
                          >
                            {commitment.valueAtRiskPoints.toFixed(
                              1,
                            )}
                          </span>
                        </td>

                        <td>
                          <Link
                            href={
                              `/strategy-execution/${commitment.id}`
                            }
                            className="table-action"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.commitments
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="table-empty-state"
                  >
                    No strategic execution
                    commitments have been
                    imported.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable governance evidence
            </span>

            <h2>
              Execution reviews
            </h2>
          </div>

          <Camera
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Review</th>
                <th>Roadmap</th>
                <th>Score</th>
                <th>Health</th>
                <th>Completed</th>
                <th>Blocked</th>
                <th>Validated</th>
                <th>VAR</th>
                <th>Captured</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.reviews
                .map(
                  review => (
                    <tr
                      key={review.id}
                    >
                      <td>
                        <strong>
                          {review.reviewNumber}
                        </strong>
                      </td>

                      <td>
                        {review.roadmapNumber}
                      </td>

                      <td>
                        {review.executionScore.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {readable(
                          review.executionHealth,
                        )}
                      </td>

                      <td>
                        {review.completedCommitmentCount}
                        {" / "}
                        {review.commitmentCount}
                      </td>

                      <td>
                        {review.blockedCommitmentCount}
                      </td>

                      <td>
                        {review.validatedContributionPoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {review.valueAtRiskPoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {new Date(
                          review.capturedAt,
                        )
                          .toLocaleString()}
                      </td>

                      <td>
                        <Link
                          href={
                            `/strategy-execution/reviews/${review.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="execution-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Reported contribution is never treated as validated value
          </strong>

          <p>
            Completed commitments may
            report outcome evidence, but
            validated contribution remains
            zero until a procurement
            manager or administrator
            explicitly validates that
            evidence. Rejected reports can
            be replaced with a new report
            without rewriting history.
          </p>
        </div>
      </section>
    </div>
  );
}
