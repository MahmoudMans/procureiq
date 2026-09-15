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
  captureReinvestmentPerformanceSnapshot,
  createReinvestmentPerformanceCase,
  getReinvestmentPerformanceDashboard,
} from "@/lib/api";

import type {
  ReinvestmentPerformanceDashboard,
} from "@/types/reinvestment-performance";

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

function money(
  value: number,
  currency = "",
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}${currency ? ` ${currency}` : ""}`;
}

export default function ReinvestmentPerformancePage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      ReinvestmentPerformanceDashboard |
      null
    >(null);

  const [
    redeploymentCaseId,
    setRedeploymentCaseId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    horizonMonths,
    setHorizonMonths,
  ] =
    useState(12);

  const [
    annualOperatingCost,
    setAnnualOperatingCost,
  ] =
    useState(0);

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

    getReinvestmentPerformanceDashboard()
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
            setRedeploymentCaseId(
              response.candidates[0].redeploymentCaseId,
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
                : "Unable to load reinvestment-performance governance.",
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
      await getReinvestmentPerformanceDashboard(),
    );
  }

  async function createCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createReinvestmentPerformanceCase(
        redeploymentCaseId,
        {
          performanceOwnerUserId:
            ownerUserId,
          measurementHorizonMonths:
            horizonMonths,
          annualOperatingCostAmount:
            annualOperatingCost,
          performanceObjective:
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
          : "Unable to create reinvestment-performance case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureReinvestmentPerformanceSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture performance snapshot.",
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
            Post-redeployment outcomes
          </span>

          <h1>
            Reinvestment performance
          </h1>

          <p>
            Measure whether fully verified
            Step 63 redeployed capital
            actually creates the expected
            value at the Step 62 target,
            without rewriting upstream
            investment or funding records.
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            className="button button--primary"
            disabled={running}
            onClick={
              () =>
                void captureSnapshot()
            }
          >
            <Camera
              size={15}
            />
            Capture snapshot
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

      <section className="reinvestment-performance-score-grid">
        <article>
          <span>
            Eligible redeployments
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Cases
          </span>

          <strong>
            {summary
              ?.caseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Assessed
          </span>

          <strong>
            {summary
              ?.assessedCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Underperforming
          </span>

          <strong className="reinvestment-performance-risk-text">
            {summary
              ?.underperformingCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Remediation
          </span>

          <strong className="reinvestment-performance-risk-text">
            {summary
              ?.remediationCaseCount ??
              0}
          </strong>
        </article>

        <article className="reinvestment-performance-score-card">
          <span>
            Avg realization
          </span>

          <strong>
            {(
              summary
                ?.averageRealizationPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>
      </section>

      <section className="reinvestment-performance-value-grid">
        <article>
          <span>
            Redeployed capital
          </span>

          <strong>
            {money(
              summary
                ?.totalRedeployedCapitalAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Realized net value
          </span>

          <strong>
            {money(
              summary
                ?.totalRealizedNetValueAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Average realized ROI
          </span>

          <strong>
            {(
              summary
                ?.averageRealizedRoiPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Average ROI variance
          </span>

          <strong>
            {(
              summary
                ?.averageRoiVariancePct ??
                0
            ).toFixed(1)}
            {" pts"}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Verified Step 63 capital
            </span>

            <h2>
              Performance candidates
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
                <th>Target</th>
                <th>Redeployment</th>
                <th>Capital</th>
                <th>Target ROI</th>
                <th>Persistence</th>
                <th>Target net value</th>
                <th>Target health</th>
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
                        key={candidate.redeploymentCaseId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.targetInitiativeTitle}
                            </strong>

                            <span>
                              {candidate.targetValueCaseNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {candidate.redeploymentNumber}
                        </td>

                        <td>
                          {money(
                            candidate.redeployedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.baselineTargetRoiPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.baselineTargetPersistencePct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {money(
                            candidate.baselineTargetNetValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {readable(
                            candidate.targetValueHealth,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/capital-redeployment/${candidate.redeploymentCaseId}`
                            }
                            className="table-action"
                          >
                            Redeployment evidence
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
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No fully verified Step
                    63 capital redeployment
                    is awaiting
                    post-redeployment value
                    governance.
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
          onSubmit={createCase}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Measurement baseline
              </span>

              <h2>
                Open performance case
              </h2>
            </div>
          </div>

          <div className="reinvestment-performance-case-form">
            <label className="request-field reinvestment-performance-form-wide">
              <span>
                Verified redeployment
              </span>

              <select
                value={redeploymentCaseId}
                onChange={
                  event =>
                    setRedeploymentCaseId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.redeploymentCaseId}
                        value={candidate.redeploymentCaseId}
                      >
                        {candidate.redeploymentNumber}
                        {" — "}
                        {candidate.targetInitiativeTitle}
                        {" · "}
                        {money(
                          candidate.redeployedCapitalAmount,
                          candidate.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Performance owner
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
                    option => (
                      <option
                        key={option.id}
                        value={option.id}
                      >
                        {option.fullName}
                        {" — "}
                        {option.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Measurement horizon months
              </span>

              <input
                type="number"
                min="1"
                max="120"
                value={horizonMonths}
                onChange={
                  event =>
                    setHorizonMonths(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Annual attributable operating cost
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={annualOperatingCost}
                onChange={
                  event =>
                    setAnnualOperatingCost(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field reinvestment-performance-form-wide">
              <span>
                Performance objective
              </span>

              <textarea
                required
                rows={5}
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

          <div className="reinvestment-performance-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !redeploymentCaseId
                ||
                !ownerUserId
                ||
                horizonMonths <
                  1
                ||
                horizonMonths >
                  120
                ||
                annualOperatingCost <
                  0
                ||
                !objective.trim()
              }
            >
              Open performance case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Post-redeployment economics
            </span>

            <h2>
              Performance cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Status</th>
                <th>Health</th>
                <th>Capital</th>
                <th>Target ROI</th>
                <th>Realized ROI</th>
                <th>ROI variance</th>
                <th>Realization</th>
                <th>Value variance</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  performanceCase => (
                    <tr
                      key={performanceCase.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {performanceCase.targetInitiativeTitle}
                          </strong>

                          <span>
                            {performanceCase.performanceCaseNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          performanceCase.status,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `reinvestment-performance-health reinvestment-performance-health--${performanceCase.health.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            performanceCase.health,
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          performanceCase.redeployedCapitalAmount,
                          performanceCase.currency,
                        )}
                      </td>

                      <td>
                        {performanceCase.baselineTargetRoiPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {performanceCase.assessed
                          ? `${performanceCase.realizedRoiPct.toFixed(1)}%`
                          : "Unassessed"}
                      </td>

                      <td>
                        {performanceCase.assessed
                          ? `${performanceCase.roiVariancePct.toFixed(1)} pts`
                          : "—"}
                      </td>

                      <td>
                        {performanceCase.assessed
                          ? `${performanceCase.realizationPct.toFixed(1)}%`
                          : "—"}
                      </td>

                      <td>
                        {performanceCase.assessed
                          ? money(
                              performanceCase.valueVarianceAmount,
                              performanceCase.currency,
                            )
                          : "—"}
                      </td>

                      <td>
                        <Link
                          href={
                            `/reinvestment-performance/${performanceCase.id}`
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
              Immutable value realization portfolio
            </span>

            <h2>
              Performance snapshots
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
                <th>Snapshot</th>
                <th>Cases</th>
                <th>Assessed</th>
                <th>Outperforming</th>
                <th>On track</th>
                <th>Watch</th>
                <th>Underperforming</th>
                <th>Realized ROI</th>
                <th>ROI variance</th>
                <th>Realization</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.snapshots
                .map(
                  snapshot => (
                    <tr
                      key={snapshot.id}
                    >
                      <td>
                        <strong>
                          {snapshot.snapshotNumber}
                        </strong>
                      </td>

                      <td>
                        {snapshot.caseCount}
                      </td>

                      <td>
                        {snapshot.assessedCaseCount}
                      </td>

                      <td>
                        {snapshot.outperformingCaseCount}
                      </td>

                      <td>
                        {snapshot.onTrackCaseCount}
                      </td>

                      <td>
                        {snapshot.watchCaseCount}
                      </td>

                      <td>
                        {snapshot.underperformingCaseCount}
                      </td>

                      <td>
                        {snapshot.averageRealizedRoiPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {snapshot.averageRoiVariancePct.toFixed(
                          1,
                        )}
                        {" pts"}
                      </td>

                      <td>
                        {snapshot.averageRealizationPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/reinvestment-performance/snapshots/${snapshot.id}`
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

      <section className="reinvestment-performance-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Realized reinvestment value remains separate from approved target economics
          </strong>

          <p>
            Step 64 compares independently
            validated post-redeployment
            outcomes with the frozen target
            ROI from Step 63. It does not
            revise the Step 56 value case
            or any Step 62–63 capital
            authority.
          </p>
        </div>
      </section>
    </div>
  );
}
