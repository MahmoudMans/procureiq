"use client";

import {
  BadgeCheck,
  CircleAlert,
  Coins,
  GitCompareArrows,
  Plus,
  SlidersHorizontal,
  Target,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getPortfolioOptimizationDashboard,
} from "@/lib/api";

import type {
  PortfolioOptimizationDashboard,
} from "@/types/portfolio-optimization";

import {
  useEffect,
  useMemo,
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
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function PortfolioOptimizationPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      PortfolioOptimizationDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("");

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

    getPortfolioOptimizationDashboard(
      currency,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
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
              : "Unable to load portfolio optimization.",
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
    currency,
  ]);

  const scenarios =
    useMemo(
      () =>
        dashboard
          ?.scenarios
          .filter(
            scenario =>
              !statusFilter
              ||
              scenario.status ===
                statusFilter,
          )
        ??
        [],
      [
        dashboard,
        statusFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Executive portfolio planning
          </span>

          <h1>
            Portfolio optimization
          </h1>

          <p>
            Compare procurement scenarios
            under explicit budget,
            capacity and risk constraints,
            with transparent initiative
            scores and selection reasons.
          </p>
        </div>

        <div className="portfolio-heading-actions">
          <label className="portfolio-currency">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event => {
                  setLoading(true);

                  setCurrency(
                    event.target.value,
                  );
                }
              }
            >
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          {canManage ? (
            <Link
              href="/portfolio-optimization/new"
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New scenario
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

      <section className="portfolio-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Scenarios
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .scenarios ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .evaluatedScenarios ??
              0}
            {" evaluated"}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Approved scenarios
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .approvedScenarios ??
              0}
          </strong>

          <p>
            Governed portfolio decisions.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Approved managed value
          </span>

          <strong className="kpi-card__value portfolio-money-kpi">
            {money(
              dashboard
                ?.summary
                .approvedPortfolioBudget ??
                0,
              currency,
            )}
          </strong>

          <p>
            Selected initiative value.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Approved savings target
          </span>

          <strong className="kpi-card__value portfolio-money-kpi">
            {money(
              dashboard
                ?.summary
                .approvedPortfolioSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            Target, not realized savings.
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Scenario comparison
            </span>

            <h2>
              Executive portfolio scenarios
            </h2>
          </div>

          <select
            className="portfolio-status-filter"
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="EVALUATED">
              Evaluated
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="ARCHIVED">
              Archived
            </option>
          </select>
        </div>

        <div className="portfolio-scenario-grid">
          {!loading &&
            scenarios.map(
              scenario => {
                const recommended =
                  dashboard
                    ?.summary
                    .recommendedScenarioId ===
                  scenario.id;

                return (
                  <article
                    key={scenario.id}
                    className={
                      recommended
                        ? "portfolio-scenario-card portfolio-scenario-card--recommended"
                        : "portfolio-scenario-card"
                    }
                  >
                    <div className="portfolio-scenario-heading">
                      <div>
                        {recommended ? (
                          <span className="portfolio-recommended">
                            Recommended
                          </span>
                        ) : null}

                        <span
                          className={
                            `portfolio-status portfolio-status--${scenario.status.toLowerCase()}`
                          }
                        >
                          {readable(
                            scenario.status,
                          )}
                        </span>

                        <strong>
                          {scenario.name}
                        </strong>

                        <small>
                          {scenario.scenarioCode}
                          {" · "}
                          {scenario.ownerName}
                        </small>
                      </div>

                      <Link
                        href={
                          `/portfolio-optimization/${scenario.id}`
                        }
                      >
                        Open
                      </Link>
                    </div>

                    <div className="portfolio-scenario-metrics">
                      <div>
                        <span>
                          Selected
                        </span>

                        <strong>
                          {scenario.selectedCount}
                          {" / "}
                          {scenario.candidateCount}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Managed value
                        </span>

                        <strong>
                          {money(
                            scenario.selectedBudget,
                            scenario.currency,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Target savings
                        </span>

                        <strong>
                          {money(
                            scenario.selectedTargetSavings,
                            scenario.currency,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Avg risk
                        </span>

                        <strong>
                          {scenario.averageSelectedRisk.toFixed(
                            1,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="portfolio-scenario-constraints">
                      <span>
                        Budget:
                        {" "}
                        <strong>
                          {money(
                            scenario.budgetLimit,
                            scenario.currency,
                          )}
                        </strong>
                      </span>

                      <span>
                        Max initiatives:
                        {" "}
                        <strong>
                          {scenario.maxInitiatives}
                        </strong>
                      </span>

                      <span>
                        Max avg risk:
                        {" "}
                        <strong>
                          {scenario.maxAverageRiskScore.toFixed(
                            0,
                          )}
                        </strong>
                      </span>
                    </div>

                    <div
                      className={
                        scenario.minimumTargetMet
                          ? "portfolio-target portfolio-target--met"
                          : "portfolio-target"
                      }
                    >
                      <Target
                        size={14}
                      />

                      <span>
                        Minimum savings
                        {" "}
                        {scenario.minimumTargetMet
                          ? "satisfied"
                          : "not satisfied"}
                      </span>
                    </div>
                  </article>
                );
              },
            )}

          {!loading &&
          scenarios.length ===
            0 ? (
            <div className="portfolio-empty">
              No portfolio scenarios match
              the selected status.
            </div>
          ) : null}
        </div>
      </section>

      <section className="portfolio-method-note">
        <GitCompareArrows
          size={18}
        />

        <div>
          <strong>
            Deterministic recommendation
          </strong>

          <p>
            The recommended scenario is
            the evaluated or approved
            scenario that satisfies its
            minimum savings target and
            provides the highest selected
            target savings, with lower
            average risk and lower managed
            value used as tie-breakers.
          </p>
        </div>
      </section>

      <section className="portfolio-method-note portfolio-method-note--secondary">
        <SlidersHorizontal
          size={18}
        />

        <div>
          <strong>
            Explainable portfolio scoring
          </strong>

          <p>
            Initiative utility is 40%
            savings efficiency, 25%
            strategic category value, 20%
            initiative priority and 15%
            category matrix urgency.
            Budget, maximum initiative
            count, average risk and
            critical-category policy are
            enforced separately as hard
            scenario constraints.
          </p>
        </div>
      </section>
    </div>
  );
}
