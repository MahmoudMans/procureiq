"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  PackageCheck,
  ShieldAlert,
  Star,
  Target,
  Trophy,
} from "lucide-react";

import Link from "next/link";

import {
  type ComponentType,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  getSupplier360,
} from "@/lib/api";

import type {
  Supplier360,
  Supplier360CategorySpend,
} from "@/types/supplier-360";

function money(
  value: number,
): string {
  return new Intl
    .NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: "EUR",
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

export default function Supplier360Page() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    supplier,
    setSupplier,
  ] =
    useState<
      Supplier360 |
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

  useEffect(() => {
    let active = true;

    getSupplier360(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setSupplier(
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
              : "Unable to load supplier profile.",
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
    params.id,
  ]);

  const maxMonthlySpend =
    useMemo(
      () =>
        Math.max(
          1,
          ...(
            supplier
              ?.monthlySpend
              .map(
                month =>
                  month.amount,
              ) ??
            []
          ),
        ),
      [supplier],
    );

  if (loading) {
    return (
      <div
        className={
          "supplier360-loading"
        }
      >
        Building supplier
        intelligence profile...
      </div>
    );
  }

  if (!supplier) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href="/suppliers"
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />

          Suppliers
        </Link>

        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />

          {error ??
            "Supplier profile is unavailable."}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <Link
        href="/suppliers"
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Suppliers
      </Link>

      <section
        className={
          "supplier360-hero"
        }
      >
        <div
          className={
            "supplier360-hero__identity"
          }
        >
          <div
            className={
              "supplier360-hero__icon"
            }
          >
            <Building2
              size={26}
            />
          </div>

          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Supplier 360°
            </span>

            <h1>
              {
                supplier
                  .legalName
              }
            </h1>

            <div
              className={
                "supplier360-hero__meta"
              }
            >
              <span>
                {
                  supplier
                    .supplierCode
                }
              </span>

              <span>
                {
                  supplier.category
                }
              </span>

              <span>
                {
                  supplier.country
                }
              </span>
            </div>
          </div>
        </div>

        <div
          className={
            "supplier360-hero__badges"
          }
        >
          <span
            className={
              `supplier360-status supplier360-status--${
                supplier.status
                  .toLowerCase()
              }`
            }
          >
            {
              readable(
                supplier.status,
              )
            }
          </span>

          <span
            className={
              `supplier360-risk supplier360-risk--${
                supplier.riskLevel
                  .toLowerCase()
              }`
            }
          >
            <ShieldAlert
              size={14}
            />

            {
              readable(
                supplier
                  .riskLevel,
              )
            }
            {" risk"}
          </span>

          <span
            className={
              "supplier360-rating"
            }
          >
            <Star
              size={14}
            />

            {
              supplier.rating
                ?.toFixed(1) ??
              "—"
            }
            {" / 5"}
          </span>
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

      <section
        className={
          "supplier360-kpi-grid"
        }
      >
        <SupplierKpi
          icon={Banknote}
          label={
            "Committed spend"
          }
          value={
            money(
              supplier
                .committedSpend,
            )
          }
          note={
            `${supplier.purchaseOrderCount} purchase orders`
          }
        />

        <SupplierKpi
          icon={Trophy}
          label={
            "Awards won"
          }
          value={
            String(
              supplier
                .awardCount,
            )
          }
          note={
            `${supplier.sourcingWinRate.toFixed(1)}% sourcing win rate`
          }
        />

        <SupplierKpi
          icon={Target}
          label={
            "RFQ participation"
          }
          value={
            String(
              supplier
                .invitedRfqCount,
            )
          }
          note={
            `${supplier.submittedQuotationCount} submitted quotations`
          }
        />

        <SupplierKpi
          icon={
            CalendarCheck
          }
          label={
            "On-time delivery"
          }
          value={
            `${supplier.onTimeDeliveryRate.toFixed(1)}%`
          }
          note={
            `${supplier.onTimeOrders} on-time / ${supplier.completedDeliveryOrders} completed`
          }
        />

        <SupplierKpi
          icon={Boxes}
          label={
            "Fulfillment"
          }
          value={
            `${supplier.fulfillmentRate.toFixed(1)}%`
          }
          note={
            `${supplier.trackedDeliveryOrders} delivery orders tracked`
          }
        />

        <SupplierKpi
          icon={
            AlertTriangle
          }
          label={
            "Operational exposure"
          }
          value={
            String(
              supplier
                .overduePurchaseOrderCount,
            )
          }
          note={
            `${supplier.openPurchaseOrderCount} open orders · ${supplier.lateOrders} late completed`
          }
        />
      </section>

      <section
        className={
          "supplier360-primary-grid"
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
                Spend intelligence
              </span>

              <h2>
                12-month spend trend
              </h2>
            </div>

            <BarChart3
              size={19}
            />
          </div>

          {supplier
            .monthlySpend
            .length === 0 ? (
            <div
              className={
                "supplier360-empty"
              }
            >
              No committed spend
              exists yet.
            </div>
          ) : (
            <div
              className={
                "supplier360-spend-list"
              }
            >
              {supplier
                .monthlySpend
                .map(
                  month => (
                    <article
                      key={
                        month.month
                      }
                      className={
                        "supplier360-spend-row"
                      }
                    >
                      <div>
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
                          "supplier360-spend-track"
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

                      <strong>
                        {
                          money(
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

        <CategoryExposure
          items={
            supplier
              .categorySpend
          }
        />
      </section>

      <section
        className={
          "supplier360-performance-grid"
        }
      >
        <article
          className={
            "panel supplier360-performance-card"
          }
        >
          <div>
            <CheckCircle2
              size={20}
            />

            <span>
              Delivery performance
            </span>
          </div>

          <strong>
            {
              supplier
                .onTimeDeliveryRate
                .toFixed(1)
            }
            %
          </strong>

          <p>
            {
              supplier
                .completedDeliveryOrders
            }
            {" completed orders with "}
            {
              supplier
                .lateOrders
            }
            {" late deliveries."}
          </p>
        </article>

        <article
          className={
            "panel supplier360-performance-card"
          }
        >
          <div>
            <Award
              size={20}
            />

            <span>
              Average award value
            </span>
          </div>

          <strong>
            {
              money(
                supplier
                  .averageAwardValue,
              )
            }
          </strong>

          <p>
            Average value of
            awarded supplier
            quotations.
          </p>
        </article>

        <article
          className={
            "panel supplier360-performance-card"
          }
        >
          <div>
            <PackageCheck
              size={20}
            />

            <span>
              Last receipt
            </span>
          </div>

          <strong
            className={
              "supplier360-date-value"
            }
          >
            {
              supplier
                .lastReceiptDate
                ? new Date(
                    `${supplier.lastReceiptDate}T00:00:00`,
                  )
                    .toLocaleDateString()
                : "No receipt"
            }
          </strong>

          <p>
            Most recent physical
            delivery registered for
            this supplier.
          </p>
        </article>
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
              Source-to-contract
            </span>

            <h2>
              Recent sourcing
              participation
            </h2>
          </div>

          <FileText
            size={19}
          />
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
                <th>RFQ</th>
                <th>Event</th>
                <th>
                  Invitation
                </th>
                <th>
                  Quotation
                </th>
                <th>
                  Quote value
                </th>
                <th>
                  Deadline
                </th>
              </tr>
            </thead>

            <tbody>
              {supplier
                .recentSourcing
                .map(
                  row => (
                    <tr
                      key={
                        row.rfqId
                      }
                    >
                      <td>
                        <Link
                          href={
                            `/rfqs/${row.rfqId}`
                          }
                          className={
                            "supplier360-table-link"
                          }
                        >
                          {
                            row.rfqNumber
                          }
                        </Link>
                      </td>

                      <td>
                        <div
                          className={
                            "request-primary-cell"
                          }
                        >
                          <strong>
                            {
                              row.title
                            }
                          </strong>

                          <span>
                            {
                              readable(
                                row.rfqStatus,
                              )
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          readable(
                            row.invitationStatus,
                          )
                        }
                      </td>

                      <td>
                        {
                          row.quotationNumber ??
                          "—"
                        }
                      </td>

                      <td>
                        {
                          row.quotationTotal !==
                          null
                            ? money(
                                row.quotationTotal,
                              )
                            : "—"
                        }
                      </td>

                      <td>
                        {
                          new Date(
                            row.responseDeadline,
                          )
                            .toLocaleDateString()
                        }
                      </td>
                    </tr>
                  ),
                )}

              {supplier
                .recentSourcing
                .length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={
                      "table-empty-state"
                    }
                  >
                    No sourcing
                    participation yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={
          "supplier360-two-column"
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
                Award history
              </span>

              <h2>
                Recent wins
              </h2>
            </div>

            <Trophy
              size={19}
            />
          </div>

          {supplier
            .recentAwards
            .length === 0 ? (
            <div
              className={
                "supplier360-empty"
              }
            >
              No awarded sourcing
              events yet.
            </div>
          ) : (
            <div
              className={
                "supplier360-award-list"
              }
            >
              {supplier
                .recentAwards
                .map(
                  award => (
                    <article
                      key={
                        award
                          .quotationId
                      }
                      className={
                        "supplier360-award-row"
                      }
                    >
                      <div
                        className={
                          "supplier360-award-icon"
                        }
                      >
                        <Award
                          size={16}
                        />
                      </div>

                      <div>
                        <Link
                          href={
                            `/rfqs/${award.rfqId}`
                          }
                        >
                          {
                            award.rfqNumber
                          }
                        </Link>

                        <span>
                          {
                            award.quotationNumber
                          }
                        </span>
                      </div>

                      <strong>
                        {
                          money(
                            award
                              .awardValue,
                          )
                        }
                      </strong>

                      {award.manualOverride ? (
                        <small
                          className={
                            "supplier360-override"
                          }
                        >
                          Override
                        </small>
                      ) : (
                        <small
                          className={
                            "supplier360-recommended"
                          }
                        >
                          Recommended
                        </small>
                      )}
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
                Order exposure
              </span>

              <h2>
                Recent purchase orders
              </h2>
            </div>

            <PackageCheck
              size={19}
            />
          </div>

          {supplier
            .recentPurchaseOrders
            .length === 0 ? (
            <div
              className={
                "supplier360-empty"
              }
            >
              No purchase orders
              exist yet.
            </div>
          ) : (
            <div
              className={
                "supplier360-po-list"
              }
            >
              {supplier
                .recentPurchaseOrders
                .map(
                  order => (
                    <Link
                      key={
                        order.id
                      }
                      href={
                        `/purchase-orders/${order.id}`
                      }
                      className={
                        "supplier360-po-row"
                      }
                    >
                      <div>
                        <strong>
                          {
                            order.poNumber
                          }
                        </strong>

                        <span>
                          {
                            order.rfqNumber
                          }
                        </span>
                      </div>

                      <span
                        className={
                          `po-status po-status--${
                            order.status
                              .toLowerCase()
                          }`
                        }
                      >
                        {
                          readable(
                            order.status,
                          )
                        }
                      </span>

                      <strong>
                        {
                          money(
                            order
                              .totalAmount,
                          )
                        }
                      </strong>
                    </Link>
                  ),
                )}
            </div>
          )}
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
              Supplier lifecycle
            </span>

            <h2>
              Recent activity
            </h2>
          </div>

          <Activity
            size={19}
          />
        </div>

        {supplier
          .recentActivity
          .length === 0 ? (
          <div
            className={
              "supplier360-empty"
            }
          >
            No supplier activity
            is available yet.
          </div>
        ) : (
          <div
            className={
              "supplier360-timeline"
            }
          >
            {supplier
              .recentActivity
              .map(
                (
                  event,
                  index,
                ) => (
                  <article
                    key={
                      `${event.eventType}-${event.occurredAt}-${index}`
                    }
                    className={
                      "supplier360-event"
                    }
                  >
                    <div
                      className={
                        "supplier360-event__marker"
                      }
                    >
                      <Clock3
                        size={14}
                      />
                    </div>

                    <div
                      className={
                        "supplier360-event__content"
                      }
                    >
                      <div>
                        <strong>
                          {
                            event.title
                          }
                        </strong>

                        <span>
                          {
                            event.detail
                          }
                        </span>
                      </div>

                      <div>
                        <time>
                          {
                            new Date(
                              event
                                .occurredAt,
                            )
                              .toLocaleString()
                          }
                        </time>

                        <Link
                          href={
                            event.href
                          }
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </article>
                ),
              )}
          </div>
        )}
      </section>
    </div>
  );
}

interface SupplierKpiProps {
  icon:
    ComponentType<{
      size?: number;
    }>;
  label: string;
  value: string;
  note: string;
}

function SupplierKpi({
  icon: Icon,
  label,
  value,
  note,
}: SupplierKpiProps) {
  return (
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
          "kpi-card__value supplier360-kpi-value"
        }
      >
        {value}
      </strong>

      <p>{note}</p>
    </article>
  );
}

interface CategoryExposureProps {
  items:
    Supplier360CategorySpend[];
}

function CategoryExposure({
  items,
}: CategoryExposureProps) {
  return (
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
            Category exposure
          </span>

          <h2>
            Spend mix
          </h2>
        </div>

        <Boxes
          size={19}
        />
      </div>

      {items.length === 0 ? (
        <div
          className={
            "supplier360-empty"
          }
        >
          No category spend
          exists yet.
        </div>
      ) : (
        <div
          className={
            "supplier360-category-list"
          }
        >
          {items.map(
            item => (
              <article
                key={
                  item.category
                }
                className={
                  "supplier360-category-row"
                }
              >
                <div
                  className={
                    "supplier360-category-heading"
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
                        item.lineCount
                      }
                      {" PO lines"}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {
                        money(
                          item.amount,
                        )
                      }
                    </strong>

                    <span>
                      {
                        item.sharePercent
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
                    "supplier360-category-track"
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
