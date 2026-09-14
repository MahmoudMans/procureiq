"use client";

import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CircleAlert,
  Clock3,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getPlanningCategoryVariance,
  getPlanningMonthlyForecast,
  getPlanningSummary,
  getPlanningUpcomingDemand,
  getProcurementPlans,
} from "@/lib/api";

import type {
  PlanningCategoryVariance,
  PlanningMonthlyForecast,
  PlanningSummary,
  PlanningUpcomingDemand,
  ProcurementPlan,
} from "@/types/planning";

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

export default function PlanningPage() {
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
      PlanningSummary |
      null
    >(null);

  const [
    plans,
    setPlans,
  ] =
    useState<
      ProcurementPlan[]
    >([]);

  const [
    monthly,
    setMonthly,
  ] =
    useState<
      PlanningMonthlyForecast[]
    >([]);

  const [
    categories,
    setCategories,
  ] =
    useState<
      PlanningCategoryVariance[]
    >([]);

  const [
    upcoming,
    setUpcoming,
  ] =
    useState<
      PlanningUpcomingDemand[]
    >([]);

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
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getPlanningSummary(
        fiscalYear,
        currency,
      ),
      getProcurementPlans(
        fiscalYear,
        currency,
      ),
      getPlanningMonthlyForecast(
        fiscalYear,
        currency,
      ),
      getPlanningCategoryVariance(
        fiscalYear,
        currency,
      ),
      getPlanningUpcomingDemand(
        fiscalYear,
        currency,
      ),
    ])
      .then(
        ([
          summaryResponse,
          planResponse,
          monthlyResponse,
          categoryResponse,
          upcomingResponse,
        ]) => {
          if (!active) {
            return;
          }

          setSummary(
            summaryResponse,
          );

          setPlans(
            planResponse,
          );

          setMonthly(
            monthlyResponse,
          );

          setCategories(
            categoryResponse,
          );

          setUpcoming(
            upcomingResponse,
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
              : "Unable to load procurement planning.",
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

  const maxMonthly =
    useMemo(
      () =>
        Math.max(
          1,
          ...monthly.map(
            item =>
              Math.max(
                item.plannedValue,
                item.linkedActualValue,
              ),
          ),
        ),
      [monthly],
    );

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
            Strategic procurement
          </span>

          <h1>
            Procurement planning
          </h1>

          <p>
            Build annual sourcing plans,
            forecast upcoming demand and
            compare planned procurement
            value with actual purchase
            requests.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/planning/new"
            className={
              "button button--primary"
            }
          >
            <Plus size={16} />
            New plan
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
          "planning-period-control"
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
          "planning-kpi-grid"
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
              <CalendarRange
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Planned demand
          </span>

          <strong
            className={
              "kpi-card__value planning-money-kpi"
            }
          >
            {summary
              ? money(
                  summary
                    .plannedDemand,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            {
              summary
                ?.plannedInitiatives ??
              0
            }
            {" initiatives"}
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
              <TrendingUp
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Linked actual
          </span>

          <strong
            className={
              "kpi-card__value planning-money-kpi"
            }
          >
            {summary
              ? money(
                  summary
                    .linkedActualDemand,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            {
              summary
                ?.convertedInitiatives ??
              0
            }
            {" converted initiatives"}
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
              <Target size={20} />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Conversion rate
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.conversionRate
              .toFixed(1) ??
              "—"}
            %
          </strong>

          <p>
            Planned initiatives linked
            to real purchase requests.
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
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Planning exceptions
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              summary
                ?.overdueInitiatives ??
              0
            }
          </strong>

          <p>
            {
              summary
                ?.upcomingInitiatives ??
              0
            }
            {" due within 60 days"}
          </p>
        </article>
      </section>

      <section
        className={
          "planning-main-grid"
        }
      >
        <section
          className={
            "panel"
          }
        >
          <div
            className={
              "panel__header"
            }
          >
            <div>
              <span
                className={
                  "eyebrow"
                }
              >
                Demand forecast
              </span>

              <h2>
                Monthly plan vs actual
              </h2>
            </div>

            <BarChart3
              size={19}
            />
          </div>

          {monthly.length ===
          0 ? (
            <div
              className={
                "planning-empty"
              }
            >
              No demand forecast
              exists for this period.
            </div>
          ) : (
            <div
              className={
                "planning-month-list"
              }
            >
              {monthly.map(
                item => (
                  <article
                    key={
                      item.month
                    }
                    className={
                      "planning-month-row"
                    }
                  >
                    <div>
                      <strong>
                        {
                          item.month
                        }
                      </strong>

                      <span>
                        {
                          item
                            .initiativeCount
                        }
                        {" initiatives"}
                      </span>
                    </div>

                    <div
                      className={
                        "planning-bars"
                      }
                    >
                      <div>
                        <span>
                          Plan
                        </span>

                        <div
                          className={
                            "planning-bar-track"
                          }
                        >
                          <div
                            style={{
                              width:
                                `${
                                  Math.max(
                                    2,
                                    (
                                      item
                                        .plannedValue /
                                      maxMonthly
                                    ) *
                                      100,
                                  )
                                }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <span>
                          Actual
                        </span>

                        <div
                          className={
                            "planning-bar-track planning-bar-track--actual"
                          }
                        >
                          <div
                            style={{
                              width:
                                `${
                                  Math.max(
                                    0,
                                    (
                                      item
                                        .linkedActualValue /
                                      maxMonthly
                                    ) *
                                      100,
                                  )
                                }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className={
                        "planning-month-values"
                      }
                    >
                      <strong>
                        {
                          money(
                            item
                              .plannedValue,
                            currency,
                          )
                        }
                      </strong>

                      <span>
                        {
                          money(
                            item
                              .linkedActualValue,
                            currency,
                          )
                        }
                      </span>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section
          className={
            "panel"
          }
        >
          <div
            className={
              "panel__header"
            }
          >
            <div>
              <span
                className={
                  "eyebrow"
                }
              >
                Category intelligence
              </span>

              <h2>
                Planning variance
              </h2>
            </div>
          </div>

          <div
            className={
              "planning-category-list"
            }
          >
            {categories.map(
              item => (
                <article
                  key={
                    item.category
                  }
                  className={
                    "planning-category-row"
                  }
                >
                  <div>
                    <strong>
                      {
                        item.category
                      }
                    </strong>

                    <span>
                      {
                        item
                          .initiativeCount
                      }
                      {" initiatives"}
                    </span>
                  </div>

                  <div>
                    <span>
                      Plan
                    </span>

                    <strong>
                      {
                        money(
                          item
                            .plannedValue,
                          currency,
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Actual
                    </span>

                    <strong>
                      {
                        money(
                          item
                            .linkedActualValue,
                          currency,
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Variance
                    </span>

                    <strong
                      className={
                        item.variance >
                        0
                          ? "planning-variance-over"
                          : "planning-variance-under"
                      }
                    >
                      {
                        money(
                          item
                            .variance,
                          currency,
                        )
                      }
                    </strong>
                  </div>
                </article>
              ),
            )}

            {categories.length ===
            0 ? (
              <div
                className={
                  "planning-empty"
                }
              >
                No category variance
                is available yet.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <section
        className={
          "panel"
        }
      >
        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Demand pipeline
            </span>

            <h2>
              Upcoming sourcing demand
            </h2>
          </div>

          <Clock3 size={19} />
        </div>

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table"
            }
          >
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Plan</th>
                <th>Department</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Planned value</th>
                <th>Target</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {upcoming
                .slice(
                  0,
                  15,
                )
                .map(
                  item => (
                    <tr
                      key={
                        item.itemId
                      }
                    >
                      <td>
                        <strong>
                          {
                            item.title
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          item.planNumber
                        }
                      </td>

                      <td>
                        {
                          item
                            .departmentName
                        }
                      </td>

                      <td>
                        {
                          item.category
                        }
                      </td>

                      <td>
                        <span
                          className={
                            `planning-priority planning-priority--${
                              item.priority
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            item.priority
                          }
                        </span>
                      </td>

                      <td>
                        {
                          money(
                            item
                              .plannedValue,
                            currency,
                          )
                        }
                      </td>

                      <td>
                        <div
                          className={
                            "planning-target-cell"
                          }
                        >
                          <span>
                            {
                              new Date(
                                `${item.targetSourcingDate}T00:00:00`,
                              )
                                .toLocaleDateString()
                            }
                          </span>

                          {item
                            .daysUntilTarget <
                          0 ? (
                            <small>
                              Overdue
                            </small>
                          ) : (
                            <small>
                              {
                                item
                                  .daysUntilTarget
                              }
                              d
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        <Link
                          href={
                            `/planning/${item.planId}`
                          }
                          className={
                            "table-action"
                          }
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {upcoming.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className={
                      "table-empty-state"
                    }
                  >
                    No upcoming
                    sourcing demand.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={
          "panel"
        }
      >
        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Annual plans
            </span>

            <h2>
              Procurement plan portfolio
            </h2>
          </div>

          <CalendarRange
            size={19}
          />
        </div>

        <div
          className={
            "planning-plan-grid"
          }
        >
          {plans.map(
            plan => (
              <Link
                key={
                  plan.id
                }
                href={
                  `/planning/${plan.id}`
                }
                className={
                  "planning-plan-card"
                }
              >
                <div
                  className={
                    "planning-plan-card__heading"
                  }
                >
                  <div>
                    <span>
                      {
                        plan
                          .planNumber
                      }
                    </span>

                    <strong>
                      {
                        plan.name
                      }
                    </strong>
                  </div>

                  <span
                    className={
                      `planning-status planning-status--${
                        plan.status
                          .toLowerCase()
                      }`
                    }
                  >
                    {
                      readable(
                        plan.status,
                      )
                    }
                  </span>
                </div>

                <div
                  className={
                    "planning-plan-card__metrics"
                  }
                >
                  <div>
                    <span>Planned</span>
                    <strong>
                      {
                        money(
                          plan
                            .plannedValue,
                          plan.currency,
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Actual</span>
                    <strong>
                      {
                        money(
                          plan
                            .linkedActualValue,
                          plan.currency,
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Conversion
                    </span>
                    <strong>
                      {
                        plan
                          .conversionRate
                          .toFixed(1)
                      }
                      %
                    </strong>
                  </div>
                </div>

                <div
                  className={
                    "planning-plan-card__footer"
                  }
                >
                  <span>
                    {
                      plan.totalItems
                    }
                    {" initiatives"}
                  </span>

                  <span>
                    Owner:
                    {" "}
                    {
                      plan.ownerName
                    }
                  </span>
                </div>
              </Link>
            ),
          )}

          {!loading &&
          plans.length === 0 ? (
            <div
              className={
                "planning-empty planning-empty--wide"
              }
            >
              No procurement plans
              exist for this fiscal year.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
