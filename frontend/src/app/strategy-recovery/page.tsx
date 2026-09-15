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
  captureStrategyRecoveryReview,
  getStrategyRecoveryDashboard,
  openStrategyRecoveryCase,
} from "@/lib/api";

import type {
  StrategyRecoveryDashboard,
} from "@/types/strategy-recovery";

import {
  type FormEvent,
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

function defaultRecoveryDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate()
      + 30,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function StrategyRecoveryPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategyRecoveryDashboard |
      null
    >(null);

  const [
    commitmentId,
    setCommitmentId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    targetDate,
    setTargetDate,
  ] =
    useState(
      defaultRecoveryDate(),
    );

  const [
    objective,
    setObjective,
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

    getStrategyRecoveryDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          if (
            !commitmentId
            &&
            response.candidates[0]
          ) {
            setCommitmentId(
              response.candidates[0].commitmentId,
            );
          }

          if (
            !ownerUserId
            &&
            response.users[0]
          ) {
            setOwnerUserId(
              response.users[0].id,
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
                : "Unable to load strategic recovery governance.",
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
  }, [
    commitmentId,
    ownerUserId,
  ]);

  async function reload() {
    setDashboard(
      await getStrategyRecoveryDashboard(),
    );
  }

  async function openCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !commitmentId
      ||
      !ownerUserId
      ||
      !objective.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await openStrategyRecoveryCase(
        commitmentId,
        {
          recoveryOwnerUserId:
            ownerUserId,
          targetRecoveryDate:
            targetDate,
          recoveryObjective:
            objective.trim(),
        },
      );

      setObjective("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to open strategic recovery case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureReview() {
    try {
      setRunning(true);
      setError(null);

      await captureStrategyRecoveryReview();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture recovery review.",
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
            Strategic delivery recovery
          </span>

          <h1>
            Execution recovery
          </h1>

          <p>
            Detect delivery variance from
            Step 53 evidence, govern
            corrective actions, verify
            recovery effectiveness and
            escalate unresolved strategic
            execution risk.
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            className="button button--primary"
            disabled={running}
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

      <section className="recovery-score-grid">
        <article className="recovery-score-card">
          <span>
            Portfolio health
          </span>

          <strong>
            {summary
              ? readable(
                  summary.portfolioHealth,
                )
              : "—"}
          </strong>

          <small>
            {(
              summary
                ?.averageRecoveryScore ??
                0
            ).toFixed(1)}
            {" / 100"}
          </small>
        </article>

        <article>
          <span>
            Candidates
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            In recovery
          </span>

          <strong>
            {summary
              ?.inRecoveryCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Critical cases
          </span>

          <strong className="recovery-risk-text">
            {summary
              ?.criticalCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Overdue actions
          </span>

          <strong className="recovery-risk-text">
            {summary
              ?.overdueActionCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Escalations
          </span>

          <strong className="recovery-risk-text">
            {summary
              ?.escalationCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="recovery-value-grid">
        <article>
          <span>
            Baseline value at risk
          </span>

          <strong>
            {(
              summary
                ?.totalBaselineValueAtRiskPoints ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Current value at risk
          </span>

          <strong
            className={
              (
                summary
                  ?.totalCurrentValueAtRiskPoints ??
                  0
              ) >
              0
                ? "recovery-risk-text"
                : ""
            }
          >
            {(
              summary
                ?.totalCurrentValueAtRiskPoints ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Avg effectiveness
          </span>

          <strong>
            {(
              summary
                ?.averageEffectivenessPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Ready for verification
          </span>

          <strong>
            {summary
              ?.readyForVerificationCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Verified
          </span>

          <strong>
            {summary
              ?.verifiedCaseCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Variance detection
            </span>

            <h2>
              Recovery candidates
            </h2>
          </div>

          <CircleAlert
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Commitment</th>
                <th>Health</th>
                <th>Severity</th>
                <th>Progress</th>
                <th>Forecast</th>
                <th>Blockers</th>
                <th>VAR</th>
                <th>Risk score</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <tr
                        key={candidate.commitmentId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.initiativeTitle}
                            </strong>

                            <span>
                              {candidate.commitmentNumber}
                              {" · "}
                              {candidate.roadmapNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            candidate.executionHealth,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              `recovery-severity recovery-severity--${candidate.severity.toLowerCase()}`
                            }
                          >
                            {readable(
                              candidate.severity,
                            )}
                          </span>
                        </td>

                        <td>
                          {candidate.progressPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.forecastEndDate}
                        </td>

                        <td>
                          {candidate.blockerCount}
                        </td>

                        <td>
                          {candidate.valueAtRiskPoints.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {candidate.riskScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/strategy-execution/${candidate.commitmentId}`
                            }
                            className="table-action"
                          >
                            Execution evidence
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.candidates
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No unmanaged Step 53
                    variance currently
                    meets recovery
                    criteria.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage &&
      (
        dashboard
          ?.candidates
          .length ??
        0
      ) >
        0 ? (
        <form
          className="panel"
          onSubmit={openCase}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Recovery governance
              </span>

              <h2>
                Open recovery case
              </h2>
            </div>

            <Goal
              size={19}
            />
          </div>

          <div className="recovery-case-form">
            <label className="request-field recovery-form-wide">
              <span>
                Execution commitment
              </span>

              <select
                value={commitmentId}
                onChange={
                  event =>
                    setCommitmentId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.commitmentId}
                        value={candidate.commitmentId}
                      >
                        {candidate.commitmentNumber}
                        {" — "}
                        {candidate.initiativeTitle}
                        {" · "}
                        {candidate.severity}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Recovery owner
              </span>

              <select
                value={ownerUserId}
                onChange={
                  event =>
                    setOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.users
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

            <label className="request-field">
              <span>
                Recovery target date
              </span>

              <input
                type="date"
                value={targetDate}
                onChange={
                  event =>
                    setTargetDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field recovery-form-wide">
              <span>
                Recovery objective
              </span>

              <textarea
                required
                rows={5}
                maxLength={4000}
                value={objective}
                onChange={
                  event =>
                    setObjective(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="recovery-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !commitmentId
                ||
                !ownerUserId
                ||
                !objective.trim()
              }
            >
              Open recovery case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Recovery portfolio
            </span>

            <h2>
              Governed recovery cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Recovery case</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Baseline risk</th>
                <th>Current risk</th>
                <th>Effectiveness</th>
                <th>VAR</th>
                <th>Actions</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  recoveryCase => (
                    <tr
                      key={recoveryCase.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {recoveryCase.initiativeTitle}
                          </strong>

                          <span>
                            {recoveryCase.recoveryNumber}
                            {" · "}
                            {recoveryCase.commitmentNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `recovery-severity recovery-severity--${recoveryCase.severity.toLowerCase()}`
                          }
                        >
                          {readable(
                            recoveryCase.severity,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `recovery-status recovery-status--${recoveryCase.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            recoveryCase.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {recoveryCase.recoveryOwnerName}
                      </td>

                      <td>
                        {recoveryCase.baselineRiskScore.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {recoveryCase.currentRiskScore.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {recoveryCase.effectivenessPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {recoveryCase.currentValueAtRiskPoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {recoveryCase.openActionCount}
                        {" open · "}
                        {recoveryCase.overdueActionCount}
                        {" overdue"}
                      </td>

                      <td>
                        <Link
                          href={
                            `/strategy-recovery/${recoveryCase.id}`
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

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable recovery evidence
            </span>

            <h2>
              Recovery reviews
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
                <th>Health</th>
                <th>Effectiveness</th>
                <th>Recovery score</th>
                <th>Current VAR</th>
                <th>Critical</th>
                <th>Escalations</th>
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
                        {readable(
                          review.portfolioHealth,
                        )}
                      </td>

                      <td>
                        {review.averageEffectivenessPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {review.averageRecoveryScore.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {review.totalCurrentValueAtRiskPoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {review.criticalCaseCount}
                      </td>

                      <td>
                        {review.escalationCount}
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
                            `/strategy-recovery/reviews/${review.id}`
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

      <section className="recovery-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Recovery governance never edits Step 53 evidence
          </strong>

          <p>
            Recovery candidates and
            effectiveness are computed
            from current Step 53
            commitments. Corrective work
            exists only in the recovery
            layer; actual execution
            progress, blockers and
            validated outcomes remain
            authoritative in Step 53.
          </p>
        </div>
      </section>
    </div>
  );
}
