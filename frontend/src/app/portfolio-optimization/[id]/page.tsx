"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  GitCompareArrows,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import Link from "next/link";

import {
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
  approvePortfolioOptimizationScenario,
  archivePortfolioOptimizationScenario,
  evaluatePortfolioOptimizationScenario,
  getPortfolioOptimizationScenario,
} from "@/lib/api";

import type {
  PortfolioScenarioDetail,
} from "@/types/portfolio-optimization";

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

export default function PortfolioOptimizationScenarioPage() {
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
      PortfolioScenarioDetail |
      null
    >(null);

  const [
    runMessage,
    setRunMessage,
  ] =
    useState<
      string |
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

  const canEvaluate =
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

    getPortfolioOptimizationScenario(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDetail(
            response,
          );

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
              : "Unable to load portfolio scenario.",
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
      await getPortfolioOptimizationScenario(
        params.id,
      ),
    );
  }

  async function evaluate() {
    try {
      setRunning(true);
      setError(null);
      setRunMessage(null);

      const result =
        await evaluatePortfolioOptimizationScenario(
          params.id,
        );

      await reload();

      setRunMessage(
        `${result.selectedCount} selected · ${result.excludedCount} excluded · ${result.minimumTargetMet ? "minimum savings satisfied" : "minimum savings not satisfied"}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to evaluate portfolio scenario.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function approve() {
    try {
      setRunning(true);
      setError(null);

      await approvePortfolioOptimizationScenario(
        params.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to approve portfolio scenario.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function archive() {
    try {
      setRunning(true);
      setError(null);

      await archivePortfolioOptimizationScenario(
        params.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to archive portfolio scenario.",
      );
    } finally {
      setRunning(false);
    }
  }

  const selected =
    useMemo(
      () =>
        detail
          ?.items
          .filter(
            item =>
              item.decision ===
                "SELECTED",
          )
        ??
        [],
      [
        detail,
      ],
    );

  const excluded =
    useMemo(
      () =>
        detail
          ?.items
          .filter(
            item =>
              item.decision ===
                "EXCLUDED",
          )
        ??
        [],
      [
        detail,
      ],
    );

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading portfolio scenario...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/portfolio-optimization"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Portfolio optimization
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Portfolio scenario not found."}
        </div>
      </div>
    );
  }

  const {
    scenario,
  } = detail;

  return (
    <div className="page-stack">
      <Link
        href="/portfolio-optimization"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Portfolio optimization
      </Link>

      <section className="portfolio-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {scenario.scenarioCode}
            </span>

            <span
              className={
                `portfolio-status portfolio-status--${scenario.status.toLowerCase()}`
              }
            >
              {readable(
                scenario.status,
              )}
            </span>
          </div>

          <h1>
            {scenario.name}
          </h1>

          <p>
            {scenario.currency}
            {" · Owner: "}
            {scenario.ownerName}
          </p>
        </div>

        <div className="portfolio-detail-actions">
          {canEvaluate &&
          (
            scenario.status ===
              "DRAFT"
            ||
            scenario.status ===
              "EVALUATED"
          ) ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void evaluate()
              }
            >
              <RefreshCcw
                size={16}
              />
              {scenario.status ===
              "EVALUATED"
                ? "Re-evaluate"
                : "Evaluate scenario"}
            </button>
          ) : null}

          {canApprove &&
          scenario.status ===
            "EVALUATED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !scenario.minimumTargetMet
                ||
                scenario.selectedCount ===
                  0
              }
              onClick={
                () =>
                  void approve()
              }
            >
              <BadgeCheck
                size={16}
              />
              Approve scenario
            </button>
          ) : null}

          {canApprove &&
          scenario.status !==
            "ARCHIVED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void archive()
              }
            >
              Archive
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

      {runMessage ? (
        <div className="portfolio-run-banner">
          <GitCompareArrows
            size={16}
          />
          {runMessage}
        </div>
      ) : null}

      <section className="portfolio-detail-kpis">
        <article>
          <span>
            Selected initiatives
          </span>

          <strong>
            {scenario.selectedCount}
            {" / "}
            {scenario.candidateCount}
          </strong>
        </article>

        <article>
          <span>
            Managed value
          </span>

          <strong>
            {money(
              scenario.selectedBudget,
              scenario.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Target savings
          </span>

          <strong>
            {money(
              scenario.selectedTargetSavings,
              scenario.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Average risk
          </span>

          <strong>
            {scenario.averageSelectedRisk.toFixed(
              1,
            )}
          </strong>
        </article>
      </section>

      <section className="portfolio-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Hard constraints
              </span>

              <h2>
                Scenario controls
              </h2>
            </div>

            <SlidersHorizontal
              size={19}
            />
          </div>

          <div className="portfolio-constraint-grid">
            <div>
              <span>
                Budget / managed-value cap
              </span>

              <strong>
                {money(
                  scenario.budgetLimit,
                  scenario.currency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Maximum initiatives
              </span>

              <strong>
                {scenario.maxInitiatives}
              </strong>
            </div>

            <div>
              <span>
                Maximum average risk
              </span>

              <strong>
                {scenario.maxAverageRiskScore.toFixed(
                  1,
                )}
              </strong>
            </div>

            <div>
              <span>
                Minimum savings target
              </span>

              <strong>
                {money(
                  scenario.minTotalTargetSavings,
                  scenario.currency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Critical categories
              </span>

              <strong>
                {scenario.allowCriticalPriority
                  ? "Allowed"
                  : "Excluded"}
              </strong>
            </div>

            <div>
              <span>
                Savings / managed value
              </span>

              <strong>
                {scenario.savingsToBudgetPct.toFixed(
                  1,
                )}
                %
              </strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance check
              </span>

              <h2>
                Scenario readiness
              </h2>
            </div>

            <ShieldCheck
              size={19}
            />
          </div>

          <div
            className={
              scenario.minimumTargetMet
                ? "portfolio-readiness portfolio-readiness--ready"
                : "portfolio-readiness"
            }
          >
            <strong>
              {scenario.minimumTargetMet
                ? "Minimum savings constraint satisfied"
                : "Minimum savings constraint not satisfied"}
            </strong>

            <p>
              Required:
              {" "}
              {money(
                scenario.minTotalTargetSavings,
                scenario.currency,
              )}
              {" · Selected: "}
              {money(
                scenario.selectedTargetSavings,
                scenario.currency,
              )}
            </p>
          </div>

          {scenario.approvedAt ? (
            <div className="portfolio-approval-info">
              <BadgeCheck
                size={15}
              />

              <span>
                Approved by
                {" "}
                {scenario.approvedByName ??
                  "Procurement governance"}
                {" on "}
                {new Date(
                  scenario.approvedAt,
                )
                  .toLocaleString()}
              </span>
            </div>
          ) : null}

          {detail.notes ? (
            <div className="portfolio-notes">
              <strong>
                Scenario notes
              </strong>

              <p>
                {detail.notes}
              </p>
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Recommended portfolio
            </span>

            <h2>
              Selected initiatives
            </h2>
          </div>

          <span className="portfolio-count">
            {selected.length}
            {" selected"}
          </span>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Initiative</th>
                <th>Category</th>
                <th>Utility</th>
                <th>Managed value</th>
                <th>Savings</th>
                <th>Efficiency</th>
                <th>Risk</th>
              </tr>
            </thead>

            <tbody>
              {selected.map(
                item => (
                  <tr
                    key={item.id}
                  >
                    <td>
                      <strong>
                        #{item.rankPosition}
                      </strong>
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.initiativeNumber}
                          {" · "}
                          {readable(
                            item.initiativeType,
                          )}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.categoryName}
                        </strong>

                        <span>
                          {readable(
                            item.matrixPosition,
                          )}
                        </span>
                      </div>
                    </td>

                    <td>
                      <strong className="portfolio-utility">
                        {item.utilityScore.toFixed(
                          1,
                        )}
                      </strong>
                    </td>

                    <td>
                      {money(
                        item.estimatedValue,
                        scenario.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.targetSavings,
                        scenario.currency,
                      )}
                    </td>

                    <td>
                      {item.savingsEfficiencyPct.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {item.supplyRiskScore.toFixed(
                        1,
                      )}
                    </td>
                  </tr>
                ),
              )}

              {selected.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No initiatives have
                    been selected. Evaluate
                    the scenario or adjust
                    its constraints by
                    creating another
                    scenario.
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
              Constraint transparency
            </span>

            <h2>
              Excluded initiatives
            </h2>
          </div>

          <span className="portfolio-count">
            {excluded.length}
            {" excluded"}
          </span>
        </div>

        <div className="portfolio-excluded-list">
          {excluded.map(
            item => (
              <article
                key={item.id}
              >
                <div>
                  <strong>
                    {item.initiativeTitle}
                  </strong>

                  <span>
                    {item.initiativeNumber}
                    {" · "}
                    {item.categoryName}
                  </span>
                </div>

                <div>
                  <span>
                    Utility
                  </span>

                  <strong>
                    {item.utilityScore.toFixed(
                      1,
                    )}
                  </strong>
                </div>

                <p>
                  {item.exclusionReason ??
                    "Excluded by scenario constraints."}
                </p>
              </article>
            ),
          )}

          {excluded.length ===
          0 ? (
            <div className="portfolio-empty">
              No excluded initiatives.
            </div>
          ) : null}
        </div>
      </section>

      {detail.items.length >
      0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Explainability
              </span>

              <h2>
                Initiative score decomposition
              </h2>
            </div>
          </div>

          <div className="portfolio-score-list">
            {detail.items
              .slice()
              .sort(
                (
                  left,
                  right,
                ) =>
                  right.utilityScore
                  -
                  left.utilityScore,
              )
              .map(
                item => (
                  <article
                    key={
                      `score-${item.id}`
                    }
                  >
                    <div className="portfolio-score-heading">
                      <div>
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.categoryName}
                        </span>
                      </div>

                      <strong>
                        {item.utilityScore.toFixed(
                          1,
                        )}
                      </strong>
                    </div>

                    <div className="portfolio-score-components">
                      <div>
                        <span>
                          Savings efficiency
                        </span>

                        <strong>
                          {item.savingsEfficiencyPct.toFixed(
                            1,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Strategic value
                        </span>

                        <strong>
                          {item.strategicValueScore.toFixed(
                            1,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Priority
                        </span>

                        <strong>
                          {item.priorityScore.toFixed(
                            1,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Matrix urgency
                        </span>

                        <strong>
                          {item.matrixUrgencyScore.toFixed(
                            1,
                          )}
                        </strong>
                      </div>
                    </div>
                  </article>
                ),
              )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
