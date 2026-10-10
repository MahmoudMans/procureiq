"use client";

import { SmartTable } from "@/components/kit/smart-table";

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
  captureOutcomePersistenceReview,
  createOutcomePersistencePlan,
  getOutcomePersistenceDashboard,
} from "@/lib/api";

import type {
  OutcomePersistenceDashboard,
} from "@/types/outcome-persistence";

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

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

function futureDate(
  days: number,
): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate()
      + days,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function OutcomePersistencePage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      OutcomePersistenceDashboard |
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
    observationStart,
    setObservationStart,
  ] =
    useState(
      today(),
    );

  const [
    observationEnd,
    setObservationEnd,
  ] =
    useState(
      futureDate(
        90,
      ),
    );

  const [
    minimumPersistence,
    setMinimumPersistence,
  ] =
    useState(80);

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

    getOutcomePersistenceDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          if (
            response.candidates[0]
          ) {
            setCommitmentId(
              response.candidates[0].commitmentId,
            );
          }

          if (
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
                : "Unable to load outcome-persistence governance.",
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
      await getOutcomePersistenceDashboard(),
    );
  }

  async function createPlan(
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

      await createOutcomePersistencePlan(
        commitmentId,
        {
          persistenceOwnerUserId:
            ownerUserId,
          observationStartDate:
            observationStart,
          observationEndDate:
            observationEnd,
          minimumPersistencePct:
            minimumPersistence,
          persistenceObjective:
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
          : "Unable to create persistence plan.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureReview() {
    try {
      setRunning(true);
      setError(null);

      await captureOutcomePersistenceReview();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture persistence review.",
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
            Durable strategic value
          </span>

          <h1>
            Outcome persistence
          </h1>

          <p>
            Test whether Step 53 validated
            contribution persists after
            delivery, distinguish durable
            value from temporary success,
            and govern remediation when
            realized benefits decay.
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

      <section className="persistence-score-grid">
        <article className="persistence-score-card">
          <span>
            Portfolio persistence
          </span>

          <strong>
            {(
              summary
                ?.averagePersistencePct ??
                0
            ).toFixed(1)}
            %
          </strong>

          <small>
            {summary
              ? readable(
                  summary.portfolioHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Eligible outcomes
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Active plans
          </span>

          <strong>
            {summary
              ?.activePlanCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            In remediation
          </span>

          <strong className="persistence-risk-text">
            {summary
              ?.remediationPlanCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Decayed / regressed
          </span>

          <strong className="persistence-risk-text">
            {summary
              ?.decayedPlanCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Observation due
          </span>

          <strong className="persistence-risk-text">
            {summary
              ?.dueObservationCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="persistence-value-grid">
        <article>
          <span>
            Assessed baseline
          </span>

          <strong>
            {(
              summary
                ?.assessedBaselinePoints ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Current validated
          </span>

          <strong>
            {(
              summary
                ?.currentValidatedPoints ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Benefit decay
          </span>

          <strong className="persistence-risk-text">
            {(
              summary
                ?.totalDecayPoints ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Ready for review
          </span>

          <strong>
            {summary
              ?.readyForReviewCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Sustained
          </span>

          <strong>
            {summary
              ?.sustainedPlanCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Overdue controls
          </span>

          <strong className="persistence-risk-text">
            {summary
              ?.overdueControlCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Post-implementation candidates
            </span>

            <h2>
              Validated outcomes eligible for observation
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Outcome</th>
                <th>Roadmap</th>
                <th>Owner</th>
                <th>Completed</th>
                <th>Validated value</th>
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
                              {candidate.initiativeNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {candidate.roadmapNumber}
                        </td>

                        <td>
                          {candidate.executionOwnerName}
                        </td>

                        <td>
                          {candidate.completedOn}
                        </td>

                        <td>
                          {candidate.validatedContributionPoints.toFixed(
                            1,
                          )}
                          {" pts"}
                        </td>

                        <td>
                          <Link
                            href={
                              `/strategy-execution/${candidate.commitmentId}`
                            }
                            className="table-action"
                          >
                            Step 53 evidence
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
                    colSpan={6}
                    className="table-empty-state"
                  >
                    No completed,
                    validated and
                    recovery-cleared Step
                    53 outcomes are waiting
                    for persistence
                    governance.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
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
          onSubmit={createPlan}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Observation governance
              </span>

              <h2>
                Create persistence plan
              </h2>
            </div>

            <Goal
              size={19}
            />
          </div>

          <div className="persistence-plan-form">
            <label className="request-field persistence-form-wide">
              <span>
                Validated Step 53 outcome
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
                        {candidate.validatedContributionPoints.toFixed(
                          1,
                        )}
                        {" pts"}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Persistence owner
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
                Minimum persistence %
              </span>

              <input
                type="number"
                min="1"
                max="100"
                step="0.1"
                value={minimumPersistence}
                onChange={
                  event =>
                    setMinimumPersistence(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Observation start
              </span>

              <input
                type="date"
                value={observationStart}
                onChange={
                  event =>
                    setObservationStart(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Observation end
              </span>

              <input
                type="date"
                value={observationEnd}
                onChange={
                  event =>
                    setObservationEnd(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field persistence-form-wide">
              <span>
                Persistence objective
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

          <div className="persistence-form-actions">
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
              Create persistence plan
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Persistence portfolio
            </span>

            <h2>
              Governed observation plans
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Baseline</th>
                <th>Current</th>
                <th>Persistence</th>
                <th>Health</th>
                <th>Decay</th>
                <th>Controls</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.plans
                .map(
                  plan => (
                    <tr
                      key={plan.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {plan.initiativeTitle}
                          </strong>

                          <span>
                            {plan.planNumber}
                            {" · "}
                            {plan.commitmentNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `persistence-status persistence-status--${plan.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            plan.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {plan.persistenceOwnerName}
                      </td>

                      <td>
                        {plan.baselineValidatedContributionPoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {plan.assessed
                          ? plan.currentValidatedContributionPoints.toFixed(
                              1,
                            )
                          : "—"}
                      </td>

                      <td>
                        {plan.assessed
                          ? `${plan.persistencePct.toFixed(1)}%`
                          : "Unassessed"}
                      </td>

                      <td>
                        <span
                          className={
                            `persistence-health persistence-health--${plan.persistenceHealth.toLowerCase()}`
                          }
                        >
                          {readable(
                            plan.persistenceHealth,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            plan.decayPoints >
                            0
                              ? "persistence-risk-text"
                              : ""
                          }
                        >
                          {plan.decayPoints.toFixed(
                            1,
                          )}
                        </span>
                      </td>

                      <td>
                        {plan.openControlCount}
                        {" open · "}
                        {plan.overdueControlCount}
                        {" overdue"}
                      </td>

                      <td>
                        <Link
                          href={
                            `/outcome-persistence/${plan.id}`
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
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable value-persistence evidence
            </span>

            <h2>
              Persistence reviews
            </h2>
          </div>

          <Camera
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Review</th>
                <th>Health</th>
                <th>Persistence</th>
                <th>Baseline</th>
                <th>Current</th>
                <th>Decay</th>
                <th>Decayed plans</th>
                <th>Overdue controls</th>
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
                        {review.averagePersistencePct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {review.assessedBaselinePoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {review.currentValidatedPoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {review.totalDecayPoints.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {review.decayedPlanCount}
                      </td>

                      <td>
                        {review.overdueControlCount}
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
                            `/outcome-persistence/reviews/${review.id}`
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
          </SmartTable>
        </div>
      </section>

      <section className="persistence-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            A delivery success is not automatically durable value
          </strong>

          <p>
            The Step 53 validated outcome
            is frozen as the baseline.
            Later persistence observations
            are reported and independently
            validated in Step 55. No
            observation can rewrite the
            original Step 53 validated
            contribution.
          </p>
        </div>
      </section>
    </div>
  );
}
