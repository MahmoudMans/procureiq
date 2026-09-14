"use client";

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Truck,
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
  getDeliverySummary,
  getPurchaseOrders,
} from "@/lib/api";

import type {
  DeliverySummary,
} from "@/types/delivery";

import type {
  PurchaseOrder,
} from "@/types/purchase-order";

const TODAY_ISO =
  new Date()
    .toISOString()
    .slice(
      0,
      10,
    );

export default function DeliveriesPage() {
  const {
    user,
  } = useAuth();

  const [
    orders,
    setOrders,
  ] =
    useState<PurchaseOrder[]>(
      [],
    );

  const [
    summary,
    setSummary,
  ] =
    useState<
      DeliverySummary |
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
      "BUYER";

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    Promise.all([
      getPurchaseOrders(),
      getDeliverySummary(),
    ])
      .then(
        ([
          orderResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setOrders(
            orderResponse,
          );

          setSummary(
            summaryResponse,
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
              : "Unable to load delivery operations.",
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

  const deliveryOrders =
    useMemo(
      () =>
        orders.filter(
          order =>
            order.status ===
              "ISSUED" ||
            order.status ===
              "PARTIALLY_RECEIVED" ||
            order.status ===
              "RECEIVED",
        ),
      [orders],
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
          Your role cannot
          access delivery operations.
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
            Order fulfillment
          </span>

          <h1>
            Deliveries
          </h1>

          <p>
            Track supplier fulfillment,
            partial receipts, overdue
            orders and completed
            deliveries.
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

      <section
        className={
          "delivery-kpi-grid"
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
              <Truck
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Goods receipts
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              summary
                ?.totalReceipts ??
              "—"
            }
          </strong>

          <p>
            Recorded physical
            delivery events.
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
              <Boxes
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Open deliveries
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              summary
                ?.openOrders ??
              "—"
            }
          </strong>

          <p>
            Issued or partially
            received purchase orders.
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
            Overdue orders
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              summary
                ?.overdueOrders ??
              "—"
            }
          </strong>

          <p>
            Open commitments past
            expected delivery.
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
              <CheckCircle2
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Completed
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              summary
                ?.completedOrders ??
              "—"
            }
          </strong>

          <p>
            Fully received purchase
            orders.
          </p>
        </article>
      </section>

      <section
        className={
          "panel delivery-list-panel"
        }
      >
        <div
          className={
            "supplier-panel__summary"
          }
        >
          <div>
            <Clock3
              size={18}
            />

            <span>
              {loading
                ? "Loading delivery operations..."
                : `${
                    deliveryOrders.length
                  } tracked orders`}
            </span>
          </div>

          <span>
            Receiving control
          </span>
        </div>

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table delivery-table"
            }
          >
            <thead>
              <tr>
                <th>
                  Purchase order
                </th>

                <th>
                  Supplier
                </th>

                <th>
                  Expected delivery
                </th>

                <th>
                  Status
                </th>

                <th>
                  Value
                </th>

                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                deliveryOrders.map(
                  order => {
                    const overdue =
                      (
                        order.status ===
                          "ISSUED" ||
                        order.status ===
                          "PARTIALLY_RECEIVED"
                      )
                      &&
                      order.expectedDeliveryDate <
                        TODAY_ISO;

                    return (
                      <tr
                        key={
                          order.id
                        }
                      >
                        <td>
                          <div
                            className={
                              "request-primary-cell"
                            }
                          >
                            <strong>
                              {
                                order
                                  .poNumber
                              }
                            </strong>

                            <span>
                              {
                                order
                                  .rfqNumber
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          {
                            order
                              .supplierName
                          }
                        </td>

                        <td>
                          <div
                            className={
                              "delivery-date-cell"
                            }
                          >
                            <span>
                              {
                                new Date(
                                  `${order.expectedDeliveryDate}T00:00:00`,
                                )
                                  .toLocaleDateString()
                              }
                            </span>

                            {overdue ? (
                              <small>
                                Overdue
                              </small>
                            ) : null}
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              `po-status po-status--${
                                order.status
                                  .toLowerCase()
                              }`
                            }
                          >
                            {
                              order.status
                                .replaceAll(
                                  "_",
                                  " ",
                                )
                            }
                          </span>
                        </td>

                        <td>
                          <strong>
                            {
                              new Intl
                                .NumberFormat(
                                  "en-US",
                                  {
                                    style:
                                      "currency",
                                    currency:
                                      order
                                        .currency,
                                    maximumFractionDigits:
                                      0,
                                  },
                                )
                                .format(
                                  order
                                    .totalAmount,
                                )
                            }
                          </strong>
                        </td>

                        <td>
                          <Link
                            href={
                              `/purchase-orders/${order.id}`
                            }
                            className={
                              "table-action"
                            }
                          >
                            Receive
                          </Link>
                        </td>
                      </tr>
                    );
                  },
                )}

              {!loading &&
              deliveryOrders.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={
                      "table-empty-state"
                    }
                  >
                    No issued purchase
                    orders are currently
                    tracked for delivery.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
