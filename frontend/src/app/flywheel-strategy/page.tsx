"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  CircleAlert,
  Scale,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createFlywheelStrategyPortfolio,
  getFlywheelStrategyDashboard,
} from "@/lib/api";

import type {
  FlywheelStrategyDashboard,
} from "@/types/flywheel-strategy";

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

export default function FlywheelStrategyPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FlywheelStrategyDashboard |
      null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState(
      "Capital flywheel rebalancing",
    );

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      new Date().getFullYear(),
    );

  const [
    capacity,
    setCapacity,
  ] =
    useState(100000);

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

  async function reload() {
    const response =
      await getFlywheelStrategyDashboard();

    setDashboard(
      response,
    );

    if (
      !ownerUserId
      &&
      response.users[0]
    ) {
      setOwnerUserId(
        response.users[0].id,
      );
    }

    if (
      response.candidates[0]
    ) {
      setCurrency(
        response.candidates[0].currency,
      );

      setFiscalYear(
        Math.max(
          new Date().getFullYear(),
          response.candidates[0].rootFiscalYear,
        ),
      );

      setCapacity(
        Math.max(
          response.candidates[0]
            .referenceNextCycleCapitalAmount
            * 2,
          1,
        ),
      );
    }
  }

  useEffect(() => {
    let active = true;

    getFlywheelStrategyDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          if (
            response.users[0]
          ) {
            setOwnerUserId(
              response.users[0].id,
            );
          }

          if (
            response.candidates[0]
          ) {
            setCurrency(
              response.candidates[0].currency,
            );

            setFiscalYear(
              Math.max(
                new Date().getFullYear(),
                response.candidates[0]
                  .rootFiscalYear,
              ),
            );

            setCapacity(
              Math.max(
                response.candidates[0]
                  .referenceNextCycleCapitalAmount
                  * 2,
                1,
              ),
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
                : "Unable to load flywheel strategy governance.",
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

  async function createPortfolio(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createFlywheelStrategyPortfolio({
        title:
          title.trim(),

        currency:
          currency
            .trim()
            .toUpperCase(),

        fiscalYear,

        capitalCapacityAmount:
          capacity,

        portfolioOwnerUserId:
          ownerUserId,

        strategicObjective:
          objective.trim(),
      });

      setObjective("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create flywheel strategy portfolio.",
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
            Enterprise capital flywheel governance
          </span>

          <h1>
            Flywheel strategy
          </h1>

          <p>
            Compare approved Step 66
            next-cycle lineages inside
            constrained currency-specific
            capital envelopes. Priority
            scores are advisory. Final
            allocation decisions remain
            explicit human governance
            decisions.
          </p>
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

      <section className="fwstrategy-score-grid">
        <article>
          <span>
            Eligible lineages
          </span>

          <strong>
            {summary?.candidateCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Portfolios
          </span>

          <strong>
            {summary?.portfolioCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            In review
          </span>

          <strong>
            {summary?.reviewPortfolioCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Approved
          </span>

          <strong>
            {summary?.approvedPortfolioCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Prioritized
          </span>

          <strong>
            {summary?.prioritizedLineageCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Hold / exit
          </span>

          <strong>
            {(summary?.holdLineageCount ?? 0)
              +
              (summary?.exitLineageCount ?? 0)}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Step 66 read-only authority
            </span>

            <h2>
              Eligible strategy candidates
            </h2>
          </div>

          <Scale
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Currency</th>
                <th>Cycles</th>
                <th>Capital reference</th>
                <th>Cumulative</th>
                <th>Marginal</th>
                <th>Retention</th>
                <th>Priority</th>
                <th>Advisory</th>
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
                        key={
                          candidate.flywheelLineageId
                        }
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {
                                candidate
                                  .rootTargetInitiativeTitle
                              }
                            </strong>

                            <span>
                              {
                                candidate
                                  .lineageNumber
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          {candidate.currency}
                        </td>

                        <td>
                          {candidate.cycleCount}
                        </td>

                        <td>
                          {money(
                            candidate
                              .referenceNextCycleCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {
                            candidate
                              .cumulativeValueMultiple
                              .toFixed(2)
                          }
                          x
                        </td>

                        <td>
                          {
                            candidate
                              .latestMarginalValueMultiple
                              .toFixed(2)
                          }
                          x
                        </td>

                        <td>
                          {
                            candidate
                              .latestMarginalNetValueRetentionPct
                              .toFixed(1)
                          }
                          %
                        </td>

                        <td>
                          <strong>
                            {
                              candidate
                                .priorityScore
                                .toFixed(1)
                            }
                          </strong>
                        </td>

                        <td>
                          {readable(
                            candidate
                              .advisoryRecommendation,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/capital-flywheel/${candidate.flywheelLineageId}`
                            }
                            className="table-action"
                          >
                            Evidence
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
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="table-empty-state"
                  >
                    No unused approved
                    Step 66 next-cycle
                    lineage is currently
                    eligible.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={createPortfolio}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Constrained portfolio envelope
              </span>

              <h2>
                Create strategy portfolio
              </h2>
            </div>
          </div>

          <div className="fwstrategy-form-grid">
            <label className="request-field fwstrategy-form-wide">
              <span>
                Portfolio title
              </span>

              <input
                required
                maxLength={300}
                value={title}
                onChange={
                  event =>
                    setTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Currency
              </span>

              <input
                required
                maxLength={3}
                value={currency}
                onChange={
                  event =>
                    setCurrency(
                      event.target.value
                        .toUpperCase(),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Planning fiscal year
              </span>

              <input
                type="number"
                min="2000"
                max="2200"
                value={fiscalYear}
                onChange={
                  event =>
                    setFiscalYear(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Capital capacity
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={capacity}
                onChange={
                  event =>
                    setCapacity(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Portfolio owner
              </span>

              <select
                required
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

            <label className="request-field fwstrategy-form-wide">
              <span>
                Strategic objective
              </span>

              <textarea
                required
                rows={5}
                maxLength={5000}
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

          <div className="fwstrategy-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !title.trim()
                ||
                currency.trim().length !==
                  3
                ||
                capacity <= 0
                ||
                !ownerUserId
                ||
                !objective.trim()
              }
            >
              Create strategy portfolio
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Rebalancing governance rounds
            </span>

            <h2>
              Strategy portfolios
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Portfolio</th>
                <th>Status</th>
                <th>Currency</th>
                <th>Year</th>
                <th>Envelope</th>
                <th>Prioritized</th>
                <th>Remaining</th>
                <th>Utilization</th>
                <th>Items</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.portfolios
                .map(
                  portfolio => (
                    <tr
                      key={portfolio.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {portfolio.title}
                          </strong>

                          <span>
                            {
                              portfolio
                                .portfolioNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          portfolio.status,
                        )}
                      </td>

                      <td>
                        {portfolio.currency}
                      </td>

                      <td>
                        {portfolio.fiscalYear}
                      </td>

                      <td>
                        {money(
                          portfolio
                            .capitalCapacityAmount,
                          portfolio.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          portfolio
                            .prioritizedCapacityAmount,
                          portfolio.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          portfolio
                            .remainingCapacityAmount,
                          portfolio.currency,
                        )}
                      </td>

                      <td>
                        {
                          portfolio
                            .capacityUtilizationPct
                            .toFixed(1)
                        }
                        %
                      </td>

                      <td>
                        {portfolio.itemCount}
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-strategy/${portfolio.id}`
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
                  ?.portfolios
                  .length ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="table-empty-state"
                  >
                    No flywheel strategy
                    portfolio has been
                    created yet.
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
              Immutable governance evidence
            </span>

            <h2>
              Recent snapshots
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Portfolio</th>
                <th>Status</th>
                <th>Items</th>
                <th>Prioritized</th>
                <th>Utilization</th>
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
                        {
                          snapshot
                            .snapshotNumber
                        }
                      </td>

                      <td>
                        {
                          snapshot
                            .portfolioNumber
                        }
                      </td>

                      <td>
                        {readable(
                          snapshot
                            .portfolioStatus,
                        )}
                      </td>

                      <td>
                        {snapshot.itemCount}
                      </td>

                      <td>
                        {money(
                          snapshot
                            .prioritizedCapacityAmount,
                          snapshot.currency,
                        )}
                      </td>

                      <td>
                        {
                          snapshot
                            .capacityUtilizationPct
                            .toFixed(1)
                        }
                        %
                      </td>

                      <td>
                        {new Date(
                          snapshot.capturedAt,
                        ).toLocaleString()}
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-strategy/snapshots/${snapshot.id}`
                          }
                          className="table-action"
                        >
                          Evidence
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="fwstrategy-method-note">
        <Scale
          size={18}
        />

        <div>
          <strong>
            Advisory scoring never replaces governance authority
          </strong>

          <p>
            Step 67 reads approved
            Step 66 lineage evidence,
            calculates a transparent
            deterministic priority
            score, and constrains
            manual allocation decisions
            by the portfolio envelope.
            It does not move capital
            and does not append a new
            flywheel cycle.
          </p>
        </div>
      </section>
    </div>
  );
}
