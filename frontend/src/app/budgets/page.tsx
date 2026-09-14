"use client";

import {
  AlertTriangle,
  Banknote,
  CircleAlert,
  Gauge,
  Landmark,
  Plus,
  SearchCheck,
  WalletCards,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  checkPurchaseRequestBudget,
  getBudgetAlerts,
  getBudgetContextOptions,
  getBudgetSummary,
  getBudgetUsage,
} from "@/lib/api";

import type {
  BudgetAlert,
  BudgetContextOptions,
  BudgetSummary,
  BudgetUsage,
  PurchaseRequestBudgetCheck,
} from "@/types/budget";

const CURRENT_YEAR =
  new Date()
    .getUTCFullYear();

function money(
  value: number,
  currency: string,
): string {
  return new Intl
    .NumberFormat(
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
    )
    .format(value);
}

export default function BudgetsPage() {
  const {
    user,
  } = useAuth();

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      CURRENT_YEAR,
    );

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    summary,
    setSummary,
  ] =
    useState<
      BudgetSummary |
      null
    >(null);

  const [
    usage,
    setUsage,
  ] =
    useState<
      BudgetUsage[]
    >([]);

  const [
    alerts,
    setAlerts,
  ] =
    useState<
      BudgetAlert[]
    >([]);

  const [
    options,
    setOptions,
  ] =
    useState<
      BudgetContextOptions |
      null
    >(null);

  const [
    requestId,
    setRequestId,
  ] =
    useState("");

  const [
    requestCheck,
    setRequestCheck,
  ] =
    useState<
      PurchaseRequestBudgetCheck |
      null
    >(null);

  const [
    checking,
    setChecking,
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
    useState<string | null>(
      null,
    );

  const canManage =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getBudgetSummary(
        fiscalYear,
        currency,
      ),
      getBudgetUsage(
        fiscalYear,
        currency,
      ),
      getBudgetAlerts(
        fiscalYear,
        currency,
      ),
      getBudgetContextOptions(),
    ])
      .then(
        ([
          summaryResponse,
          usageResponse,
          alertResponse,
          optionResponse,
        ]) => {
          if (!active) {
            return;
          }

          setSummary(
            summaryResponse,
          );

          setUsage(
            usageResponse,
          );

          setAlerts(
            alertResponse,
          );

          setOptions(
            optionResponse,
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
              : "Unable to load budget control.",
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
    fiscalYear,
    currency,
  ]);

  async function runBudgetCheck() {
    if (!requestId) {
      return;
    }

    try {
      setChecking(true);
      setError(null);

      setRequestCheck(
        await checkPurchaseRequestBudget(
          requestId,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to evaluate purchase request budget.",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Procurement planning
          </span>

          <h1>
            Budget control
          </h1>

          <p>
            Track approved budgets,
            committed spend, open
            procurement exposure,
            forecast utilization and
            request-level budget impact.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/budgets/new"
            className={
              "button button--primary"
            }
          >
            <Plus size={16} />
            New allocation
          </Link>
        ) : null}
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section
        className={
          "budget-period-control"
        }
      >
        <label>
          <span>
            Fiscal year
          </span>

          <select
            value={
              fiscalYear
            }
            onChange={
              event =>
                setFiscalYear(
                  Number(
                    event.target.value,
                  ),
                )
            }
          >
            {[
              CURRENT_YEAR - 1,
              CURRENT_YEAR,
              CURRENT_YEAR + 1,
              CURRENT_YEAR + 2,
            ].map(
              year => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>Currency</span>

          <select
            value={currency}
            onChange={
              event =>
                setCurrency(
                  event.target.value,
                )
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
      </section>

      <section
        className={
          "budget-kpi-grid"
        }
      >
        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <WalletCards
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Total budget
          </span>

          <strong
            className={
              "kpi-card__value budget-money-kpi"
            }
          >
            {summary
              ? money(
                  summary
                    .totalBudget,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            {
              summary
                ?.activeAllocations ??
              0
            }
            {" active allocations"}
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Banknote
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Committed
          </span>

          <strong
            className={
              "kpi-card__value budget-money-kpi"
            }
          >
            {summary
              ? money(
                  summary
                    .committedSpend,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            {summary
              ?.utilizationPercent
              .toFixed(1) ??
              "0.0"}
            {"% utilization"}
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Landmark
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Open exposure
          </span>

          <strong
            className={
              "kpi-card__value budget-money-kpi"
            }
          >
            {summary
              ? money(
                  summary
                    .openRequestExposure,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            Submitted and approved
            requests not yet committed.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Gauge
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Forecast utilization
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.forecastUtilizationPercent
              .toFixed(1) ??
              "—"}
            %
          </strong>

          <p>
            {
              summary
                ?.exceededAllocations ??
              0
            }
            {" exceeded · "}
            {
              summary
                ?.warningAllocations ??
              0
            }
            {" warning"}
          </p>
        </article>
      </section>

      {alerts.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Budget alerts
              </span>

              <h2>
                Forecast exceptions
              </h2>
            </div>

            <AlertTriangle size={19} />
          </div>

          <div className="budget-alert-list">
            {alerts.map(
              alert => (
                <article
                  key={alert.allocationId}
                  className={
                    `budget-alert budget-alert--${alert.alertLevel.toLowerCase()}`
                  }
                >
                  <div>
                    <strong>
                      {alert.scopeLabel}
                    </strong>

                    <span>
                      {alert.message}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {alert.forecastUtilizationPercent.toFixed(1)}
                      %
                    </strong>

                    <span>
                      {alert.hardLimit
                        ? "Hard limit"
                        : "Soft limit"}
                    </span>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Budget utilization
            </span>

            <h2>
              Allocation control
            </h2>
          </div>

          <WalletCards size={19} />
        </div>

        <div className="budget-allocation-list">
          {!loading &&
            usage.map(
              item => (
                <article
                  key={item.allocationId}
                  className={
                    `budget-allocation-card budget-allocation-card--${item.alertLevel.toLowerCase()}`
                  }
                >
                  <div className="budget-allocation-heading">
                    <div>
                      <strong>
                        {item.scopeLabel}
                      </strong>

                      <span>
                        {item.scopeType ===
                        "DEPARTMENT"
                          ? "Department budget"
                          : "Category budget"}
                        {" · "}
                        {item.hardLimit
                          ? "Hard limit"
                          : "Soft limit"}
                      </span>
                    </div>

                    <strong>
                      {money(
                        item.budgetAmount,
                        item.currency,
                      )}
                    </strong>
                  </div>

                  <div className="budget-progress-labels">
                    <span>
                      Committed{" "}
                      {money(
                        item.committedSpend,
                        item.currency,
                      )}
                    </span>

                    <span>
                      Pipeline{" "}
                      {money(
                        item.openRequestExposure,
                        item.currency,
                      )}
                    </span>

                    <strong>
                      Forecast{" "}
                      {item.forecastUtilizationPercent.toFixed(1)}
                      %
                    </strong>
                  </div>

                  <div className="budget-progress-track">
                    <div
                      style={{
                        width:
                          `${Math.min(
                            100,
                            Math.max(
                              0,
                              item.forecastUtilizationPercent,
                            ),
                          )}%`,
                      }}
                    />
                  </div>

                  <div className="budget-allocation-footer">
                    <span>
                      Remaining:{" "}
                      {money(
                        item.remainingForecast,
                        item.currency,
                      )}
                    </span>

                    <span>
                      Warning at{" "}
                      {item.warningThresholdPercent.toFixed(0)}
                      %
                    </span>

                    <span
                      className={
                        `budget-level budget-level--${item.alertLevel.toLowerCase()}`
                      }
                    >
                      {item.alertLevel}
                    </span>
                  </div>
                </article>
              ),
            )}

          {!loading &&
          usage.length === 0 ? (
            <div className="budget-empty">
              No active allocations
              exist for this fiscal year
              and currency.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Purchase-request gate
            </span>

            <h2>
              Budget impact check
            </h2>
          </div>

          <SearchCheck size={19} />
        </div>

        <div className="budget-check-controls">
          <label className="request-field">
            <span>
              Purchase request
            </span>

            <select
              value={requestId}
              onChange={
                event => {
                  setRequestId(
                    event.target.value,
                  );

                  setRequestCheck(
                    null,
                  );
                }
              }
            >
              <option value="">
                Select request
              </option>

              {options
                ?.purchaseRequests
                .map(
                  request => (
                    <option
                      key={request.id}
                      value={request.id}
                    >
                      {request.requestNumber}
                      {" — "}
                      {request.title}
                    </option>
                  ),
                )}
            </select>
          </label>

          <button
            type="button"
            className="button button--primary"
            disabled={
              checking ||
              !requestId
            }
            onClick={
              () =>
                void runBudgetCheck()
            }
          >
            <SearchCheck size={16} />

            {checking
              ? "Checking..."
              : "Check budget"}
          </button>
        </div>

        {requestCheck ? (
          <article
            className={
              `budget-check-result budget-check-result--${requestCheck.alertLevel.toLowerCase()}`
            }
          >
            <div className="budget-check-result__header">
              <div>
                <strong>
                  {requestCheck.requestNumber}
                </strong>

                <span>
                  {requestCheck.departmentName}
                  {" · "}
                  {money(
                    requestCheck.requestAmount,
                    requestCheck.currency,
                  )}
                </span>
              </div>

              <span
                className={
                  `budget-level budget-level--${requestCheck.alertLevel.toLowerCase()}`
                }
              >
                {requestCheck.blocked
                  ? "BLOCKED"
                  : requestCheck.alertLevel}
              </span>
            </div>

            <p>
              {requestCheck.message}
            </p>

            {requestCheck.budgetConfigured ? (
              <div className="budget-check-metrics">
                <div>
                  <span>Budget</span>
                  <strong>
                    {money(
                      requestCheck.budgetAmount,
                      requestCheck.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Current forecast
                  </span>

                  <strong>
                    {money(
                      requestCheck.currentForecastExposure,
                      requestCheck.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Projected
                  </span>

                  <strong>
                    {money(
                      requestCheck.projectedForecastExposure,
                      requestCheck.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Remaining
                  </span>

                  <strong>
                    {money(
                      requestCheck.remainingAfterRequest,
                      requestCheck.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Utilization
                  </span>

                  <strong>
                    {requestCheck.projectedUtilizationPercent.toFixed(1)}
                    %
                  </strong>
                </div>
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    </div>
  );
}
