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
  captureInvestmentInterventionSnapshot,
  createInvestmentInterventionCase,
  getInvestmentInterventionDashboard,
} from "@/lib/api";

import type {
  InvestmentInterventionDashboard,
} from "@/types/investment-intervention";

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

export default function InvestmentInterventionsPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      InvestmentInterventionDashboard |
      null
    >(null);

  const [
    performanceCaseId,
    setPerformanceCaseId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    rationale,
    setRationale,
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

    getInvestmentInterventionDashboard()
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
            setPerformanceCaseId(
              response.candidates[0].performanceCaseId,
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
                : "Unable to load investment-intervention governance.",
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
      await getInvestmentInterventionDashboard(),
    );
  }

  async function createCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !performanceCaseId
      ||
      !ownerUserId
      ||
      !rationale.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createInvestmentInterventionCase(
        performanceCaseId,
        {
          interventionOwnerUserId:
            ownerUserId,
          interventionRationale:
            rationale.trim(),
        },
      );

      setRationale("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create intervention case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureInvestmentInterventionSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture intervention snapshot.",
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
            Capital intervention governance
          </span>

          <h1>
            Investment intervention
          </h1>

          <p>
            Govern continue, hold, reduce
            and reallocation proposals
            using Step 59 realized
            performance while protecting
            Step 58 released capital and
            keeping upstream funding
            authorities read-only.
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

      <section className="intervention-score-grid">
        <article>
          <span>
            Eligible cases
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Active interventions
          </span>

          <strong>
            {summary
              ?.caseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            In review
          </span>

          <strong>
            {summary
              ?.inReviewCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Approved
          </span>

          <strong>
            {summary
              ?.approvedCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Underperforming
          </span>

          <strong className="intervention-risk-text">
            {summary
              ?.underperformingCaseCount ??
              0}
          </strong>
        </article>

        <article className="intervention-score-card">
          <span>
            Remaining capital
          </span>

          <strong>
            {money(
              summary
                ?.totalRemainingCapitalAmount ??
                0,
            )}
          </strong>
        </article>
      </section>

      <section className="intervention-value-grid">
        <article>
          <span>
            Approved affected capital
          </span>

          <strong>
            {money(
              summary
                ?.totalApprovedAffectedCapitalAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Approved reallocation
          </span>

          <strong>
            {money(
              summary
                ?.totalApprovedReallocationAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Open cases
          </span>

          <strong>
            {summary
              ?.openCaseCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Step 59 realized performance
            </span>

            <h2>
              Intervention candidates
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Investment</th>
                <th>Health</th>
                <th>Released</th>
                <th>Unreleased</th>
                <th>Baseline ROI</th>
                <th>Realized ROI</th>
                <th>ROI variance</th>
                <th>Efficiency</th>
                <th>Recommendation</th>
                <th>Affected</th>
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
                        key={candidate.performanceCaseId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.initiativeTitle}
                            </strong>

                            <span>
                              {candidate.performanceCaseNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            candidate.performanceHealth,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.releasedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.remainingCommitmentAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.baselineRoiPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.realizedRoiPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.roiVariancePct.toFixed(
                            1,
                          )}
                          {" pts"}
                        </td>

                        <td>
                          {candidate.capitalEfficiencyMultiple.toFixed(
                            2,
                          )}
                          x
                        </td>

                        <td>
                          <span
                            className={
                              `intervention-action intervention-action--${candidate.recommendation.toLowerCase().replaceAll("_", "-")}`
                            }
                          >
                            {readable(
                              candidate.recommendation,
                            )}
                          </span>
                        </td>

                        <td>
                          {money(
                            candidate.recommendedAffectedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/investment-performance/${candidate.performanceCaseId}`
                            }
                            className="table-action"
                          >
                            Performance evidence
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
                    colSpan={11}
                    className="table-empty-state"
                  >
                    No assessed Step 59 case
                    with unreleased Step 58
                    committed capital is
                    awaiting intervention
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
          onSubmit={createCase}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Intervention case
              </span>

              <h2>
                Open governance case
              </h2>
            </div>
          </div>

          <div className="intervention-case-form">
            <label className="request-field intervention-form-wide">
              <span>
                Performance case
              </span>

              <select
                value={performanceCaseId}
                onChange={
                  event =>
                    setPerformanceCaseId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.performanceCaseId}
                        value={candidate.performanceCaseId}
                      >
                        {candidate.performanceCaseNumber}
                        {" — "}
                        {candidate.initiativeTitle}
                        {" · "}
                        {readable(
                          candidate.recommendation,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Intervention owner
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

            <label className="request-field intervention-form-wide">
              <span>
                Intervention rationale
              </span>

              <textarea
                required
                rows={5}
                value={rationale}
                onChange={
                  event =>
                    setRationale(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="intervention-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !performanceCaseId
                ||
                !ownerUserId
                ||
                !rationale.trim()
              }
            >
              Open intervention case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capital intervention portfolio
            </span>

            <h2>
              Governance cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Current health</th>
                <th>Remaining</th>
                <th>ROI variance</th>
                <th>Recommendation</th>
                <th>Approved action</th>
                <th>Approved affected</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  interventionCase => (
                    <tr
                      key={interventionCase.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {interventionCase.initiativeTitle}
                          </strong>

                          <span>
                            {interventionCase.interventionNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          interventionCase.status,
                        )}
                      </td>

                      <td>
                        {readable(
                          interventionCase.currentPerformanceHealth,
                        )}
                      </td>

                      <td>
                        {money(
                          interventionCase.currentRemainingCommitmentAmount,
                          interventionCase.currency,
                        )}
                      </td>

                      <td>
                        {interventionCase.currentRoiVariancePct.toFixed(
                          1,
                        )}
                        {" pts"}
                      </td>

                      <td>
                        {readable(
                          interventionCase.currentRecommendation,
                        )}
                      </td>

                      <td>
                        {interventionCase.approvedAction
                          ? readable(
                              interventionCase.approvedAction,
                            )
                          : "—"}
                      </td>

                      <td>
                        {money(
                          interventionCase.approvedAffectedCapitalAmount,
                          interventionCase.currency,
                        )}
                      </td>

                      <td>
                        <Link
                          href={
                            `/investment-interventions/${interventionCase.id}`
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
              Immutable intervention evidence
            </span>

            <h2>
              Portfolio snapshots
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
                <th>Snapshot</th>
                <th>Cases</th>
                <th>Open</th>
                <th>In review</th>
                <th>Approved</th>
                <th>Underperforming</th>
                <th>Remaining</th>
                <th>Affected</th>
                <th>Reallocation</th>
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
                        {snapshot.openCaseCount}
                      </td>

                      <td>
                        {snapshot.inReviewCaseCount}
                      </td>

                      <td>
                        {snapshot.approvedCaseCount}
                      </td>

                      <td>
                        {snapshot.underperformingCaseCount}
                      </td>

                      <td>
                        {money(
                          snapshot.totalRemainingCapitalAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalApprovedAffectedCapitalAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalApprovedReallocationAmount,
                        )}
                      </td>

                      <td>
                        <Link
                          href={
                            `/investment-interventions/snapshots/${snapshot.id}`
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

      <section className="intervention-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Intervention approval is governance evidence, not automatic funding execution
          </strong>

          <p>
            Approved HOLD, REDUCE or
            REALLOCATE decisions never
            rewrite Step 57 allocations,
            Step 58 releases or Step 59
            performance evidence. They
            create a governed decision
            boundary for subsequent
            execution.
          </p>
        </div>
      </section>
    </div>
  );
}
