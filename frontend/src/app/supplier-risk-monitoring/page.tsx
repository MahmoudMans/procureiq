"use client";

import {
  Activity,
  AlertTriangle,
  CircleAlert,
  Coins,
  RefreshCcw,
  ShieldAlert,
  UserRoundSearch,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getSupplierRiskMonitoringDashboard,
  runSupplierRiskEvaluation,
} from "@/lib/api";

import type {
  SupplierRiskDashboard,
} from "@/types/supplier-risk-monitoring";

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

export default function SupplierRiskMonitoringPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      SupplierRiskDashboard |
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
    bandFilter,
    setBandFilter,
  ] =
    useState("");

  const [
    recommendationFilter,
    setRecommendationFilter,
  ] =
    useState("");

  const [
    evaluationMessage,
    setEvaluationMessage,
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
    evaluating,
    setEvaluating,
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

  useEffect(() => {
    let active = true;

    getSupplierRiskMonitoringDashboard(
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
              : "Unable to load continuous supplier risk.",
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

  async function reload() {
    setDashboard(
      await getSupplierRiskMonitoringDashboard(
        currency,
      ),
    );
  }

  async function evaluate() {
    try {
      setEvaluating(true);
      setError(null);
      setEvaluationMessage(null);

      const result =
        await runSupplierRiskEvaluation(
          currency,
        );

      await reload();

      setEvaluationMessage(
        `${result.evaluatedSuppliers} suppliers evaluated · ${result.alertsCreated} alerts created · ${result.alertsRefreshed} refreshed · ${result.alertsResolved} resolved · ${result.deterioratingSuppliers} deteriorating`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to run supplier-risk evaluation.",
      );
    } finally {
      setEvaluating(false);
    }
  }

  const filtered =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return (
          dashboard
            ?.suppliers
            .filter(
              supplier =>
                !bandFilter
                ||
                supplier.riskBand ===
                  bandFilter,
            )
            .filter(
              supplier =>
                !recommendationFilter
                ||
                supplier.recommendation ===
                  recommendationFilter,
            )
            .filter(
              supplier => {
                if (!normalized) {
                  return true;
                }

                return [
                  supplier.supplierCode,
                  supplier.supplierName,
                  supplier.supplierCategory ??
                    "",
                  supplier.supplierCountry ??
                    "",
                ]
                  .join(
                    " ",
                  )
                  .toLowerCase()
                  .includes(
                    normalized,
                  );
              },
            )
          ??
          []
        );
      },
      [
        dashboard,
        query,
        bandFilter,
        recommendationFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Continuous supplier assurance
          </span>

          <h1>
            Supplier risk monitoring
          </h1>

          <p>
            Re-evaluate supplier risk
            using qualification,
            compliance documents, ESG,
            anomaly controls,
            collaboration performance,
            commercial leakage and spend
            dependency.
          </p>
        </div>

        <div className="supplier-risk-heading-actions">
          <label className="supplier-risk-currency">
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

          {canEvaluate ? (
            <button
              type="button"
              className="button button--primary"
              disabled={evaluating}
              onClick={
                () =>
                  void evaluate()
              }
            >
              <RefreshCcw
                size={16}
              />

              {evaluating
                ? "Evaluating..."
                : "Run risk evaluation"}
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

      {evaluationMessage ? (
        <div className="supplier-risk-run-banner">
          <Activity
            size={16}
          />
          {evaluationMessage}
        </div>
      ) : null}

      <section className="supplier-risk-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            High / critical
          </span>

          <strong className="kpi-card__value">
            {(
              dashboard
                ?.summary
                .highRiskSuppliers ??
                0
            )
            +
            (
              dashboard
                ?.summary
                .criticalRiskSuppliers ??
                0
            )}
          </strong>

          <p>
            {dashboard
              ?.summary
              .criticalRiskSuppliers ??
              0}
            {" critical"}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Deteriorating
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .deterioratingSuppliers ??
              0}
          </strong>

          <p>
            Risk increased by at least
            10 points.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Requalification
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .requalificationRecommended ??
              0}
          </strong>

          <p>
            Governance review
            recommended.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Spend at high risk
          </span>

          <strong className="kpi-card__value supplier-risk-money-kpi">
            {money(
              dashboard
                ?.summary
                .spendAtHighRisk ??
                0,
              currency,
            )}
          </strong>

          <p>
            Currency-scoped PO exposure.
          </p>
        </article>
      </section>

      <section className="supplier-risk-signal-grid">
        <article>
          <span>
            Watchlisted
          </span>

          <strong>
            {dashboard
              ?.summary
              .watchlistedSuppliers ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Active alerts
          </span>

          <strong>
            {dashboard
              ?.summary
              .activeAlerts ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Escalation cases
          </span>

          <strong>
            {dashboard
              ?.summary
              .openEscalationCases ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Evaluated suppliers
          </span>

          <strong>
            {dashboard
              ?.summary
              .evaluatedSuppliers ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Risk portfolio
            </span>

            <h2>
              Continuous supplier risk
            </h2>
          </div>

          <UserRoundSearch
            size={19}
          />
        </div>

        <div className="supplier-risk-toolbar">
          <input
            value={query}
            placeholder={
              "Search supplier, category or country"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={bandFilter}
            onChange={
              event =>
                setBandFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All risk bands
            </option>

            <option value="LOW">
              Low
            </option>

            <option value="MODERATE">
              Moderate
            </option>

            <option value="HIGH">
              High
            </option>

            <option value="CRITICAL">
              Critical
            </option>
          </select>

          <select
            value={recommendationFilter}
            onChange={
              event =>
                setRecommendationFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All recommendations
            </option>

            <option value="MONITOR">
              Monitor
            </option>

            <option value="WATCHLIST">
              Watchlist
            </option>

            <option value="REQUALIFY">
              Requalify
            </option>

            <option value="ESCALATE">
              Escalate
            </option>

            <option value="CRITICAL_REVIEW">
              Critical review
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Score</th>
                <th>Band</th>
                <th>Change</th>
                <th>Recommendation</th>
                <th>Spend</th>
                <th>Dependency</th>
                <th>Governance</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  supplier => (
                    <tr
                      key={
                        supplier.supplierId
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {supplier.supplierName}
                          </strong>

                          <span>
                            {supplier.supplierCode}
                            {" · "}
                            {supplier.supplierCategory ??
                              "Uncategorized"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong className="supplier-risk-score">
                          {supplier.overallScore.toFixed(
                            1,
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `supplier-risk-band supplier-risk-band--${supplier.riskBand.toLowerCase()}`
                          }
                        >
                          {supplier.riskBand}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            supplier.deterioration
                              ? "supplier-risk-deterioration"
                              : ""
                          }
                        >
                          {supplier.deltaScore ===
                          null
                            ? "—"
                            : `${
                                supplier.deltaScore >
                                0
                                  ? "+"
                                  : ""
                              }${supplier.deltaScore.toFixed(1)}`}
                        </span>
                      </td>

                      <td>
                        {readable(
                          supplier.recommendation,
                        )}
                      </td>

                      <td>
                        {money(
                          supplier.spendExposure,
                          supplier.currency,
                        )}
                      </td>

                      <td>
                        {supplier.categorySpendShare.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        <div className="supplier-risk-governance-tags">
                          {supplier.watchlisted ? (
                            <span>
                              Watchlist
                            </span>
                          ) : null}

                          {supplier.activeAlerts >
                          0 ? (
                            <span>
                              {supplier.activeAlerts}
                              {" alerts"}
                            </span>
                          ) : null}

                          {supplier.openEscalations >
                          0 ? (
                            <span>
                              {supplier.openEscalations}
                              {" cases"}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <Link
                          href={
                            `/supplier-risk-monitoring/${supplier.supplierId}?currency=${currency}`
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
              filtered.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No supplier-risk
                    evaluations match the
                    selected filters.
                    Run the evaluation if
                    this portfolio has not
                    yet been scored.
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
              Early warning
            </span>

            <h2>
              Active supplier-risk alerts
            </h2>
          </div>

          <ShieldAlert
            size={19}
          />
        </div>

        <div className="supplier-risk-alert-list">
          {dashboard
            ?.alerts
            .slice(
              0,
              30,
            )
            .map(
              alert => {
                const supplier =
                  dashboard.suppliers.find(
                    candidate =>
                      candidate.supplierId ===
                      alert.supplierId,
                  );

                return (
                  <Link
                    key={alert.id}
                    href={
                      `/supplier-risk-monitoring/${alert.supplierId}?currency=${currency}`
                    }
                    className="supplier-risk-alert"
                  >
                    <span
                      className={
                        `supplier-risk-alert-severity supplier-risk-alert-severity--${alert.severity.toLowerCase()}`
                      }
                    >
                      {alert.severity}
                    </span>

                    <div>
                      <strong>
                        {alert.title}
                      </strong>

                      <span>
                        {supplier?.supplierName ??
                          alert.supplierId}
                        {" · "}
                        {readable(
                          alert.alertType,
                        )}
                      </span>
                    </div>

                    <span>
                      {readable(
                        alert.status,
                      )}
                    </span>
                  </Link>
                );
              },
            )}

          {dashboard
            &&
          dashboard.alerts.length ===
            0 ? (
            <div className="supplier-risk-empty">
              No active supplier-risk
              alerts.
            </div>
          ) : null}
        </div>
      </section>

      <section className="supplier-risk-methodology-note">
        <AlertTriangle
          size={18}
        />

        <div>
          <strong>
            Explainable risk, not an opaque blacklist
          </strong>

          <p>
            ProcureIQ calculates risk from
            seven visible factors:
            onboarding 20%, document
            compliance 20%, ESG 15%,
            anomaly controls 15%,
            collaboration 10%, commercial
            leakage 10% and spend
            dependency 10%. A
            requalification recommendation
            does not automatically suspend
            or alter a supplier.
          </p>
        </div>
      </section>
    </div>
  );
}
