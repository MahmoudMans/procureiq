"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Camera,
  CircleAlert,
  Goal,
  Plus,
} from "lucide-react";

import Link from "next/link";

import {
  captureCapitalAllocationSnapshot,
  getCapitalAllocationDashboard,
} from "@/lib/api";

import type {
  CapitalAllocationDashboard,
} from "@/types/capital-allocation";

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

function money(
  value: number,
  currency: string,
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${currency}`;
}

export default function CapitalAllocationPage() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapitalAllocationDashboard |
      null
    >(null);

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

  useEffect(() => {
    let active = true;

    getCapitalAllocationDashboard()
      .then(
        response => {
          if (active) {
            setDashboard(
              response,
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
                : "Unable to load capital-allocation governance.",
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

  async function captureSnapshot(
    cycleId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await captureCapitalAllocationSnapshot(
        cycleId,
      );

      setDashboard(
        await getCapitalAllocationDashboard(),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture allocation snapshot.",
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
            Investment committee governance
          </span>

          <h1>
            Capital allocation
          </h1>

          <p>
            Rank verified strategic value
            cases under explicit budget
            constraints, separate advisory
            recommendations from manual
            funding decisions, and expose
            the opportunity cost of
            deferring valuable work.
          </p>
        </div>

        <Link
          href="/capital-allocation/new"
          className="button button--primary"
        >
          <Plus
            size={15}
          />
          New allocation cycle
        </Link>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="allocation-score-grid">
        <article>
          <span>
            Verified candidates
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Allocation cycles
          </span>

          <strong>
            {summary
              ?.cycleCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Draft
          </span>

          <strong>
            {summary
              ?.draftCycleCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            In review
          </span>

          <strong>
            {summary
              ?.inReviewCycleCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Approved
          </span>

          <strong>
            {summary
              ?.approvedCycleCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Closed
          </span>

          <strong>
            {summary
              ?.closedCycleCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Decision cycles
            </span>

            <h2>
              Strategic capital portfolio
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
                <th>Cycle</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Funded</th>
                <th>Remaining</th>
                <th>Utilization</th>
                <th>Opportunity cost</th>
                <th>Items</th>
                <th>Pending</th>
                <th />
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.cycles
                  .map(
                    cycle => (
                      <tr
                        key={cycle.id}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {cycle.title}
                            </strong>

                            <span>
                              {cycle.cycleNumber}
                              {" · FY "}
                              {cycle.fiscalYear}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              `allocation-status allocation-status--${cycle.status.toLowerCase().replaceAll("_", "-")}`
                            }
                          >
                            {readable(
                              cycle.status,
                            )}
                          </span>
                        </td>

                        <td>
                          {money(
                            cycle.budgetAmount,
                            cycle.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            cycle.fundedAmount,
                            cycle.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            cycle.remainingBudgetAmount,
                            cycle.currency,
                          )}
                        </td>

                        <td>
                          {cycle.budgetUtilizationPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          <span
                            className={
                              cycle.opportunityCostAmount >
                              0
                                ? "allocation-risk-text"
                                : ""
                            }
                          >
                            {money(
                              cycle.opportunityCostAmount,
                              cycle.currency,
                            )}
                          </span>
                        </td>

                        <td>
                          {cycle.itemCount}
                        </td>

                        <td>
                          {cycle.pendingItemCount}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="table-action allocation-link-button"
                            disabled={running}
                            onClick={
                              () =>
                                void captureSnapshot(
                                  cycle.id,
                                )
                            }
                          >
                            Snapshot
                          </button>
                        </td>

                        <td>
                          <Link
                            href={
                              `/capital-allocation/${cycle.id}`
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
                  ?.cycles
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="table-empty-state"
                  >
                    No capital-allocation
                    cycle has been created.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Verified Step 56 evidence
            </span>

            <h2>
              Investment candidates
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Currency</th>
                <th>FY</th>
                <th>Priority</th>
                <th>Recommendation</th>
                <th>ROI</th>
                <th>Persistence</th>
                <th>Net value</th>
                <th>Payback</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.candidates
                .map(
                  candidate => (
                    <tr
                      key={candidate.valueCaseId}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {candidate.initiativeTitle}
                          </strong>

                          <span>
                            {candidate.caseNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {candidate.currency}
                      </td>

                      <td>
                        {candidate.fiscalYear}
                      </td>

                      <td>
                        {candidate.priorityScore.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `allocation-decision allocation-decision--${candidate.recommendation.toLowerCase()}`
                          }
                        >
                          {readable(
                            candidate.recommendation,
                          )}
                        </span>
                      </td>

                      <td>
                        {candidate.roiPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {candidate.persistencePct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {money(
                          candidate.netValueAmount,
                          candidate.currency,
                        )}
                      </td>

                      <td>
                        {candidate.paybackMonths ===
                        null
                          ? "N/A"
                          : `${candidate.paybackMonths.toFixed(1)} mo`}
                      </td>

                      <td>
                        <Link
                          href={
                            `/strategic-value/${candidate.valueCaseId}`
                          }
                          className="table-action"
                        >
                          Value case
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
              Immutable committee evidence
            </span>

            <h2>
              Allocation snapshots
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
                <th>Cycle</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Funded</th>
                <th>Utilization</th>
                <th>Opportunity cost</th>
                <th>Pending</th>
                <th>Captured</th>
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
                        {snapshot.cycleNumber}
                      </td>

                      <td>
                        {readable(
                          snapshot.cycleStatus,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.budgetAmount,
                          snapshot.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.fundedAmount,
                          snapshot.currency,
                        )}
                      </td>

                      <td>
                        {snapshot.budgetUtilizationPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {money(
                          snapshot.opportunityCostAmount,
                          snapshot.currency,
                        )}
                      </td>

                      <td>
                        {snapshot.pendingItemCount}
                      </td>

                      <td>
                        {new Date(
                          snapshot.capturedAt,
                        )
                          .toLocaleString()}
                      </td>

                      <td>
                        <Link
                          href={
                            `/capital-allocation/snapshots/${snapshot.id}`
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

      <section className="allocation-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Priority scores are advisory, never funding decisions
          </strong>

          <p>
            ProcureIQ deterministically
            ranks verified Step 56 value
            cases using ROI, persistence,
            payback and value health.
            Funding remains an explicit
            manager or administrator
            decision, constrained by the
            governed budget.
          </p>
        </div>
      </section>
    </div>
  );
}
