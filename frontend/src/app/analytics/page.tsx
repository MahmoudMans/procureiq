"use client";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CircleAlert,
  Clock3,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getProcurementAnalytics,
} from "@/lib/api";

import type {
  AnalyticsBreakdown,
  ProcurementAnalytics,
} from "@/types/analytics";

function formatCurrency(
  value: number,
): string {
  return new Intl
    .NumberFormat(
      "en-US",
      {
        style:
          "currency",
        currency:
          "EUR",
        notation:
          Math.abs(value) >=
          100000
            ? "compact"
            : "standard",
        maximumFractionDigits:
          Math.abs(value) >=
          100000
            ? 1
            : 0,
      },
    )
    .format(value);
}

function readableLabel(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase(),
    );
}

export default function AnalyticsPage() {
  const {
    user,
  } = useAuth();

  const [
    analytics,
    setAnalytics,
  ] =
    useState<
      ProcurementAnalytics |
      null
    >(null);

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

  const allowed =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER" ||
    user?.role ===
      "APPROVER";

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    getProcurementAnalytics()
      .then(
        response => {
          if (!active) {
            return;
          }

          setAnalytics(
            response,
          );

          setError(
            null,
          );
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
              ? caughtError
                  .message
              : "Unable to load procurement analytics.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(
              false,
            );
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    allowed,
  ]);

  const maxMonthlySpend =
    useMemo(
      () =>
        Math.max(
          1,
          ...(
            analytics
              ?.monthlySpend
              .map(
                item =>
                  item.amount,
              ) ??
            []
          ),
        ),
      [
        analytics,
      ],
    );

  if (!allowed) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />

          Your current ProcureIQ role
          cannot access procurement
          analytics.
        </div>
      </div>
    );
  }

  if (
    loading &&
    !analytics
  ) {
    return (
      <div
        className={
          "analytics-loading"
        }
      >
        Loading procurement
        intelligence...
      </div>
    );
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
            Procurement intelligence
          </span>

          <h1>
            Spend analytics
          </h1>

          <p>
            Executive visibility into
            committed spend, sourcing
            savings, supplier
            concentration, risk,
            procurement cycle time and
            order execution.
          </p>
        </div>
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

      {analytics ? (
        <>
          <section
            className={
              "analytics-kpi-grid"
            }
          >
            <AnalyticsKpi
              icon={
                Banknote
              }
              label={
                "Committed spend"
              }
              value={
                formatCurrency(
                  analytics.summary
                    .committedSpend,
                )
              }
              note={
                `${analytics.summary.committedOrderCount} committed purchase orders`
              }
            />

            <AnalyticsKpi
              icon={
                TrendingDown
              }
              label={
                "Sourcing savings"
              }
              value={
                formatCurrency(
                  analytics.summary
                    .sourcingSavings,
                )
              }
              note={
                "Value preserved versus highest submitted offers"
              }
            />

            <AnalyticsKpi
              icon={
                Clock3
              }
              label={
                "Procurement cycle"
              }
              value={
                `${analytics.summary.averageProcurementCycleDays.toFixed(1)}d`
              }
              note={
                "Average submission-to-award duration"
              }
            />

            <AnalyticsKpi
              icon={
                PackageCheck
              }
              label={
                "Average PO value"
              }
              value={
                formatCurrency(
                  analytics.summary
                    .averageOrderValue,
                )
              }
              note={
                "Average committed order value"
              }
            />

            <AnalyticsKpi
              icon={
                Users
              }
              label={
                "Active suppliers"
              }
              value={
                String(
                  analytics.summary
                    .activeSuppliers,
                )
              }
              note={
                "Enabled supplier relationships"
              }
            />

            <AnalyticsKpi
              icon={
                AlertTriangle
              }
              label={
                "Overdue deliveries"
              }
              value={
                String(
                  analytics.summary
                    .overdueDeliveryOrders,
                )
              }
              note={
                `${analytics.summary.openDeliveryOrders} open delivery orders`
              }
            />
          </section>

          <section
            className={
              "analytics-primary-grid"
            }
          >
            <section
              className={
                "panel analytics-spend-trend"
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
                    Spend trend
                  </span>

                  <h2>
                    Monthly committed
                    spend
                  </h2>
                </div>

                <BarChart3
                  size={19}
                />
              </div>

              {analytics
                .monthlySpend
                .length === 0 ? (
                <div
                  className={
                    "analytics-empty"
                  }
                >
                  No committed spend
                  exists yet.
                </div>
              ) : (
                <div
                  className={
                    "analytics-month-list"
                  }
                >
                  {analytics
                    .monthlySpend
                    .map(
                      month => (
                        <article
                          key={
                            month.month
                          }
                          className={
                            "analytics-month-row"
                          }
                        >
                          <div
                            className={
                              "analytics-month-label"
                            }
                          >
                            <strong>
                              {
                                month.month
                              }
                            </strong>

                            <span>
                              {
                                month.orderCount
                              }
                              {" orders"}
                            </span>
                          </div>

                          <div
                            className={
                              "analytics-horizontal-bar"
                            }
                          >
                            <div
                              style={{
                                width:
                                  `${
                                    Math.max(
                                      3,
                                      (
                                        month.amount /
                                        maxMonthlySpend
                                      ) *
                                        100,
                                    )
                                  }%`,
                              }}
                            />
                          </div>

                          <strong
                            className={
                              "analytics-month-value"
                            }
                          >
                            {
                              formatCurrency(
                                month.amount,
                              )
                            }
                          </strong>
                        </article>
                      ),
                    )}
                </div>
              )}
            </section>

            <BreakdownPanel
              title={
                "Supplier concentration"
              }
              eyebrow={
                "Top suppliers"
              }
              icon={
                Building2
              }
              items={
                analytics
                  .spendBySupplier
              }
            />
          </section>

          <section
            className={
              "analytics-secondary-grid"
            }
          >
            <BreakdownPanel
              title={
                "Spend by category"
              }
              eyebrow={
                "Category intelligence"
              }
              icon={
                Sparkles
              }
              items={
                analytics
                  .spendByCategory
              }
            />

            <BreakdownPanel
              title={
                "Spend by department"
              }
              eyebrow={
                "Demand ownership"
              }
              icon={
                Users
              }
              items={
                analytics
                  .spendByDepartment
              }
            />
          </section>

          <section
            className={
              "analytics-secondary-grid"
            }
          >
            <BreakdownPanel
              title={
                "Supplier risk exposure"
              }
              eyebrow={
                "Committed value at risk"
              }
              icon={
                ShieldAlert
              }
              items={
                analytics
                  .riskExposure
              }
              transformLabel={
                readableLabel
              }
            />

            <BreakdownPanel
              title={
                "Purchase order pipeline"
              }
              eyebrow={
                "Execution status"
              }
              icon={
                PackageCheck
              }
              items={
                analytics
                  .purchaseOrderPipeline
              }
              transformLabel={
                readableLabel
              }
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

interface AnalyticsKpiProps {
  icon:
    React.ComponentType<{
      size?: number;
    }>;
  label: string;
  value: string;
  note: string;
}

function AnalyticsKpi({
  icon: Icon,
  label,
  value,
  note,
}: AnalyticsKpiProps) {
  return (
    <article
      className={
        "kpi-card analytics-kpi"
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
          <Icon
            size={20}
          />
        </div>
      </div>

      <span
        className={
          "kpi-card__label"
        }
      >
        {label}
      </span>

      <strong
        className={
          "kpi-card__value analytics-kpi-value"
        }
      >
        {value}
      </strong>

      <p>
        {note}
      </p>
    </article>
  );
}

interface BreakdownPanelProps {
  title: string;
  eyebrow: string;
  icon:
    React.ComponentType<{
      size?: number;
    }>;
  items:
    AnalyticsBreakdown[];
  transformLabel?: (
    label: string,
  ) => string;
}

function BreakdownPanel({
  title,
  eyebrow,
  icon: Icon,
  items,
  transformLabel = label =>
    label,
}: BreakdownPanelProps) {
  return (
    <section
      className={
        "panel analytics-breakdown-panel"
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
            {eyebrow}
          </span>

          <h2>
            {title}
          </h2>
        </div>

        <Icon
          size={19}
        />
      </div>

      {items.length === 0 ? (
        <div
          className={
            "analytics-empty"
          }
        >
          No analytics data
          available yet.
        </div>
      ) : (
        <div
          className={
            "analytics-breakdown-list"
          }
        >
          {items.map(
            item => (
              <article
                key={
                  item.label
                }
                className={
                  "analytics-breakdown-row"
                }
              >
                <div
                  className={
                    "analytics-breakdown-heading"
                  }
                >
                  <div>
                    <strong>
                      {
                        transformLabel(
                          item.label,
                        )
                      }
                    </strong>

                    <span>
                      {
                        item.count
                      }
                      {" records"}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {
                        formatCurrency(
                          item.value,
                        )
                      }
                    </strong>

                    <span>
                      {
                        item
                          .sharePercent
                          .toFixed(
                            1,
                          )
                      }
                      %
                    </span>
                  </div>
                </div>

                <div
                  className={
                    "analytics-share-track"
                  }
                >
                  <div
                    style={{
                      width:
                        `${
                          Math.min(
                            100,
                            Math.max(
                              0,
                              item.sharePercent,
                            ),
                          )
                        }%`,
                    }}
                  />
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
