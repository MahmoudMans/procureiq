"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  AlertTriangle,
  CircleAlert,
  Coins,
  Layers3,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getCategoryManagementDashboard,
} from "@/lib/api";

import type {
  CategoryManagementDashboard,
} from "@/types/category-management";

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

export default function CategoryManagementPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CategoryManagementDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    matrixFilter,
    setMatrixFilter,
  ] =
    useState("");

  const [
    strategyFilter,
    setStrategyFilter,
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

    getCategoryManagementDashboard(
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
              : "Unable to load category management.",
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

  const filteredInsights =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return (
          dashboard
            ?.categoryInsights
            .filter(
              category =>
                !matrixFilter
                ||
                category.matrixPosition ===
                  matrixFilter,
            )
            .filter(
              category =>
                !normalized
                ||
                category.categoryName
                  .toLowerCase()
                  .includes(
                    normalized,
                  ),
            )
          ??
          []
        );
      },
      [
        dashboard,
        query,
        matrixFilter,
      ],
    );

  const filteredStrategies =
    useMemo(
      () =>
        dashboard
          ?.strategies
          .filter(
            strategy =>
              !strategyFilter
              ||
              strategy.status ===
                strategyFilter,
          )
        ??
        [],
      [
        dashboard,
        strategyFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategic procurement
          </span>

          <h1>
            Category management
          </h1>

          <p>
            Prioritize categories using
            live spend and supplier risk,
            size transparent
            opportunities, establish
            category strategies and
            govern sourcing initiatives.
          </p>
        </div>

        <div className="category-heading-actions">
          <label className="category-currency">
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
              href={
                `/category-management/new?currency=${currency}`
              }
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New strategy
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

      <section className="category-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Addressable spend
          </span>

          <strong className="kpi-card__value category-money-kpi">
            {money(
              dashboard
                ?.summary
                .totalSpend ??
                0,
              currency,
            )}
          </strong>

          <p>
            {dashboard
              ?.summary
              .categories ??
              0}
            {" categories"}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Modeled opportunity
          </span>

          <strong className="kpi-card__value category-money-kpi">
            {money(
              dashboard
                ?.summary
                .modeledOpportunity ??
                0,
              currency,
            )}
          </strong>

          <p>
            Transparent fragmentation
            model.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Strategy target
          </span>

          <strong className="kpi-card__value category-money-kpi">
            {money(
              dashboard
                ?.summary
                .strategyTargetSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            {dashboard
              ?.summary
              .activeStrategies ??
              0}
            {" active strategies"}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Realized savings
          </span>

          <strong className="kpi-card__value category-money-kpi">
            {money(
              dashboard
                ?.summary
                .realizedSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            {dashboard
              ?.summary
              .activeInitiatives ??
              0}
            {" active initiatives"}
          </p>
        </article>
      </section>

      <section className="category-summary-strip">
        <article>
          <AlertTriangle
            size={17}
          />

          <div>
            <span>
              High-risk categories
            </span>

            <strong>
              {dashboard
                ?.summary
                .highRiskCategories ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <Target
            size={17}
          />

          <div>
            <span>
              Active strategies
            </span>

            <strong>
              {dashboard
                ?.summary
                .activeStrategies ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <TrendingUp
            size={17}
          />

          <div>
            <span>
              Sourcing pipeline
            </span>

            <strong>
              {dashboard
                ?.summary
                .activeInitiatives ??
                0}
            </strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Risk / value portfolio
            </span>

            <h2>
              Category intelligence
            </h2>
          </div>

          <Layers3
            size={19}
          />
        </div>

        <div className="category-toolbar">
          <input
            value={query}
            placeholder={
              "Search category"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={matrixFilter}
            onChange={
              event =>
                setMatrixFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All matrix positions
            </option>

            <option value="CRITICAL_PRIORITY">
              Critical priority
            </option>

            <option value="VALUE_OPTIMIZATION">
              Value optimization
            </option>

            <option value="RISK_MITIGATION">
              Risk mitigation
            </option>

            <option value="MANAGE">
              Manage
            </option>
          </select>
        </div>

        <div className="category-insight-grid">
          {!loading &&
            filteredInsights.map(
              category => (
                <article
                  key={
                    category.categoryName
                  }
                  className={
                    `category-insight-card category-insight-card--${category.matrixPosition.toLowerCase().replaceAll("_", "-")}`
                  }
                >
                  <div className="category-insight-heading">
                    <div>
                      <span
                        className={
                          `category-matrix category-matrix--${category.matrixPosition.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          category.matrixPosition,
                        )}
                      </span>

                      <strong>
                        {category.categoryName}
                      </strong>

                      <small>
                        {category.supplierCount}
                        {" active suppliers"}
                      </small>
                    </div>

                    <div>
                      <span>
                        Spend
                      </span>

                      <strong>
                        {money(
                          category.totalSpend,
                          category.currency,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="category-score-grid">
                    <div>
                      <span>
                        Value
                      </span>

                      <strong>
                        {category.strategicValueScore.toFixed(
                          0,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Risk
                      </span>

                      <strong>
                        {category.weightedSupplierRiskScore.toFixed(
                          0,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Top supplier
                      </span>

                      <strong>
                        {category.topSupplierSpendShare.toFixed(
                          1,
                        )}
                        %
                      </strong>
                    </div>

                    <div>
                      <span>
                        High risk
                      </span>

                      <strong>
                        {category.highRiskSuppliers}
                      </strong>
                    </div>
                  </div>

                  <div className="category-opportunity">
                    <div>
                      <span>
                        Modeled opportunity
                      </span>

                      <strong>
                        {money(
                          category.modeledOpportunityAmount,
                          category.currency,
                        )}
                      </strong>
                    </div>

                    <span>
                      {category.modeledOpportunityPct.toFixed(
                        1,
                      )}
                      %
                    </span>
                  </div>
                </article>
              ),
            )}

          {!loading &&
          filteredInsights.length ===
            0 ? (
            <div className="category-empty">
              No category intelligence
              matches the selected filter.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Strategy portfolio
            </span>

            <h2>
              Category strategies
            </h2>
          </div>

          <select
            className="category-status-filter"
            value={strategyFilter}
            onChange={
              event =>
                setStrategyFilter(
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

            <option value="ACTIVE">
              Active
            </option>

            <option value="ON_HOLD">
              On hold
            </option>

            <option value="CLOSED">
              Closed
            </option>

            <option value="ARCHIVED">
              Archived
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>FY</th>
                <th>Status</th>
                <th>Baseline</th>
                <th>Target</th>
                <th>Realized</th>
                <th>Pipeline</th>
                <th>Matrix</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredStrategies.map(
                  strategy => (
                    <tr
                      key={strategy.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {strategy.categoryName}
                          </strong>

                          <span>
                            {strategy.strategyCode}
                            {" · "}
                            {strategy.ownerName}
                          </span>
                        </div>
                      </td>

                      <td>
                        {strategy.fiscalYear}
                      </td>

                      <td>
                        <span
                          className={
                            `category-strategy-status category-strategy-status--${strategy.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            strategy.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          strategy.spendBaseline,
                          strategy.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          strategy.savingsTargetAmount,
                          strategy.currency,
                        )}
                      </td>

                      <td>
                        <span>
                          {money(
                            strategy.realizedSavings,
                            strategy.currency,
                          )}
                          {" · "}
                          {strategy.realizationPct.toFixed(
                            0,
                          )}
                          %
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            strategy.overdueInitiatives >
                              0
                            ||
                            strategy.overdueMilestones >
                              0
                              ? "category-overdue"
                              : ""
                          }
                        >
                          {strategy.activeInitiatives}
                          {" active"}
                          {strategy.overdueInitiatives >
                          0
                            ? ` · ${strategy.overdueInitiatives} late`
                            : ""}
                        </span>
                      </td>

                      <td>
                        {readable(
                          strategy.matrixPosition,
                        )}
                      </td>

                      <td>
                        <Link
                          href={
                            `/category-management/${strategy.id}`
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
              filteredStrategies.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No category
                    strategies match the
                    selected status.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="category-methodology-note">
        <Coins
          size={18}
        />

        <div>
          <strong>
            Transparent opportunity model
          </strong>

          <p>
            Modeled opportunity is an
            indicative portfolio-sizing
            metric based on supplier
            fragmentation and category
            spend. It is not booked
            savings. Realized savings only
            come from completed governed
            category initiatives.
          </p>
        </div>
      </section>
    </div>
  );
}
