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
  captureInvestmentPerformanceSnapshot,
  createInvestmentPerformanceCase,
  getInvestmentPerformanceDashboard,
} from "@/lib/api";

import type {
  InvestmentPerformanceDashboard,
} from "@/types/investment-performance";

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

export default function InvestmentPerformancePage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      InvestmentPerformanceDashboard |
      null
    >(null);

  const [
    fundingCommitmentId,
    setFundingCommitmentId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

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

    getInvestmentPerformanceDashboard()
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
            setFundingCommitmentId(
              response.candidates[0].fundingCommitmentId,
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
                : "Unable to load investment-performance governance.",
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
      await getInvestmentPerformanceDashboard(),
    );
  }

  async function createCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !fundingCommitmentId
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

      await createInvestmentPerformanceCase(
        fundingCommitmentId,
        {
          performanceOwnerUserId:
            ownerUserId,
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
          : "Unable to create investment-performance case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureInvestmentPerformanceSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture investment-performance snapshot.",
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
            Post-funding economics
          </span>

          <h1>
            Investment performance
          </h1>

          <p>
            Compare actual released
            capital against independently
            validated realized value,
            distinguish Step 56 ROI
            assumptions from realized
            economics and govern
            underperforming investments.
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

      <section className="investment-performance-score-grid">
        <article className="investment-performance-score-card">
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
            ROI variance
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

        <article>
          <span>
            Funding variance
          </span>

          <strong>
            {(
              summary
                ?.averageFundingVariancePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Capital efficiency
          </span>

          <strong>
            {(
              summary
                ?.averageCapitalEfficiencyMultiple ??
                0
            ).toFixed(2)}
            x
          </strong>
        </article>

        <article>
          <span>
            Underperforming
          </span>

          <strong className="investment-performance-risk-text">
            {summary
              ?.underperformingCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            In remediation
          </span>

          <strong className="investment-performance-risk-text">
            {summary
              ?.remediationCaseCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="investment-performance-signal-grid">
        <article>
          <span>
            Eligible commitments
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
            Outperforming
          </span>

          <strong>
            {summary
              ?.outperformingCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            On track
          </span>

          <strong>
            {summary
              ?.onTrackCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Watch
          </span>

          <strong>
            {summary
              ?.watchCaseCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Released Step 58 capital
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
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Funding</th>
                <th>Released</th>
                <th>Release %</th>
                <th>Step 56 investment</th>
                <th>Baseline ROI</th>
                <th>Durable value</th>
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
                        key={candidate.fundingCommitmentId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.initiativeTitle}
                            </strong>

                            <span>
                              {candidate.valueCaseNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {candidate.fundingCommitmentNumber}
                        </td>

                        <td>
                          {money(
                            candidate.currentReleasedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.releasePct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {money(
                            candidate.baselineInvestmentCostAmount,
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
                          {money(
                            candidate.baselineDurableHorizonValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/funding-execution/${candidate.fundingCommitmentId}`
                            }
                            className="table-action"
                          >
                            Funding evidence
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
                    No Step 58 funding
                    commitment with released
                    capital is waiting for
                    investment-performance
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
                Post-funding governance
              </span>

              <h2>
                Open performance case
              </h2>
            </div>
          </div>

          <div className="investment-performance-case-form">
            <label className="request-field investment-performance-form-wide">
              <span>
                Funding commitment
              </span>

              <select
                value={fundingCommitmentId}
                onChange={
                  event =>
                    setFundingCommitmentId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.fundingCommitmentId}
                        value={candidate.fundingCommitmentId}
                      >
                        {candidate.fundingCommitmentNumber}
                        {" — "}
                        {candidate.initiativeTitle}
                        {" · "}
                        {candidate.releasePct.toFixed(
                          1,
                        )}
                        {"% released"}
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

            <label className="request-field investment-performance-form-wide">
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

          <div className="investment-performance-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !fundingCommitmentId
                ||
                !ownerUserId
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
              Realized investment economics
            </span>

            <h2>
              Performance cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Health</th>
                <th>Released</th>
                <th>Baseline ROI</th>
                <th>Realized ROI</th>
                <th>ROI variance</th>
                <th>Funding variance</th>
                <th>Efficiency</th>
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
                            {performanceCase.initiativeTitle}
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
                            `investment-performance-health investment-performance-health--${performanceCase.health.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            performanceCase.health,
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          performanceCase.currentReleasedCapitalAmount,
                          performanceCase.currency,
                        )}
                      </td>

                      <td>
                        {performanceCase.baselineRoiPct.toFixed(
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
                          ? `${performanceCase.fundingVariancePct.toFixed(1)}%`
                          : "—"}
                      </td>

                      <td>
                        {performanceCase.assessed
                          ? `${performanceCase.capitalEfficiencyMultiple.toFixed(2)}x`
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
                            `/investment-performance/${performanceCase.id}`
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
              Immutable executive evidence
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
          <SmartTable className="data-table">
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
                <th>Efficiency</th>
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
                        {snapshot.averageCapitalEfficiencyMultiple.toFixed(
                          2,
                        )}
                        x
                      </td>

                      <td>
                        <Link
                          href={
                            `/investment-performance/snapshots/${snapshot.id}`
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

      <section className="investment-performance-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Approved ROI and realized ROI remain separate authorities
          </strong>

          <p>
            Step 56 financial assumptions
            remain frozen as the baseline.
            Step 59 calculates realized
            economics only from Step 58
            released capital and separately
            validated post-funding value
            evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
