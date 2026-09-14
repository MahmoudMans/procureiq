"use client";

import {
  Banknote,
  CircleAlert,
  FileClock,
  PackageCheck,
  PackageOpen,
  Plus,
  Search,
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
  getPurchaseOrders,
  getPurchaseOrderSummary,
} from "@/lib/api";

import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
} from "@/types/purchase-order";

export default function PurchaseOrdersPage() {
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
      PurchaseOrderSummary |
      null
    >(null);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    status,
    setStatus,
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

    const timer =
      window.setTimeout(
        () => {
          Promise.all([
            getPurchaseOrders(
              query ||
                undefined,
              (
                status as
                  PurchaseOrderStatus
              ) ||
                undefined,
            ),

            getPurchaseOrderSummary(),
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
                    : "Unable to load purchase orders.",
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
        },
        180,
      );

    return () => {
      active = false;

      window.clearTimeout(
        timer,
      );
    };
  }, [
    allowed,
    query,
    status,
  ]);

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

          Your ProcureIQ role
          cannot manage purchase
          orders.
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
            Procure-to-order
          </span>

          <h1>
            Purchase orders
          </h1>

          <p>
            Convert awarded sourcing
            decisions into controlled
            supplier purchase orders.
          </p>
        </div>

        <Link
          href={
            "/purchase-orders/new"
          }
          className={
            "button button--primary"
          }
        >
          <Plus size={17} />
          New purchase order
        </Link>
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
          "po-kpi-grid"
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
              <PackageOpen
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Purchase orders
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.totalOrders ??
              "—"}
          </strong>

          <p>
            Awarded sourcing
            commitments converted
            into orders.
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
              <FileClock
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Draft orders
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.draftOrders ??
              "—"}
          </strong>

          <p>
            Orders prepared but
            not yet issued.
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
              <PackageCheck
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Issued orders
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.issuedOrders ??
              "—"}
          </strong>

          <p>
            Purchase commitments
            formally issued.
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
            Issued value
          </span>

          <strong
            className={
              "kpi-card__value po-value"
            }
          >
            {summary
              ? new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        "EUR",
                      notation:
                        "compact",
                      maximumFractionDigits:
                        1,
                    },
                  )
                  .format(
                    summary
                      .issuedValue,
                  )
              : "—"}
          </strong>

          <p>
            Commercial value of
            issued orders.
          </p>
        </article>
      </section>

      <section
        className={
          "po-toolbar"
        }
      >
        <div
          className={
            "supplier-toolbar__search"
          }
        >
          <Search size={18} />

          <input
            value={query}
            onChange={
              event =>
                setQuery(
                  event
                    .target
                    .value,
                )
            }
            placeholder={
              "Search PO, supplier or RFQ"
            }
          />
        </div>

        <div
          className={
            "select-wrapper"
          }
        >
          <select
            value={status}
            onChange={
              event =>
                setStatus(
                  event
                    .target
                    .value,
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="ISSUED">
              Issued
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </section>

      <section
        className={
          "panel po-list-panel"
        }
      >
        <div
          className={
            "supplier-panel__summary"
          }
        >
          <div>
            <PackageOpen
              size={18}
            />

            <span>
              {loading
                ? "Loading purchase orders..."
                : `${
                    orders.length
                  } orders found`}
            </span>
          </div>

          <span>
            Award-to-order workspace
          </span>
        </div>

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table po-table"
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
                  Source RFQ
                </th>

                <th>
                  Delivery
                </th>

                <th>
                  Status
                </th>

                <th>
                  Value
                </th>

                <th>
                  Created by
                </th>

                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                orders.map(
                  order => (
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
                                .purchaseRequestNumber
                            }
                            {" · "}
                            {
                              order.lines
                                .length
                            }
                            {" lines"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div
                          className={
                            "po-supplier-cell"
                          }
                        >
                          <strong>
                            {
                              order
                                .supplierName
                            }
                          </strong>

                          <span>
                            {
                              order
                                .supplierCode
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          order
                            .rfqNumber
                        }
                      </td>

                      <td>
                        {
                          new Date(
                            `${order.expectedDeliveryDate}T00:00:00`,
                          )
                            .toLocaleDateString()
                        }
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
                        {
                          order
                            .createdByName
                        }
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
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              orders.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={8}
                      className={
                        "table-empty-state"
                      }
                    >
                      No purchase orders
                      match the current
                      filters.
                    </td>
                  </tr>
                )
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
