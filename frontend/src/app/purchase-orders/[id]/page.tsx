"use client";

import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CircleAlert,
  FileText,
  PackageCheck,
  PackageOpen,
  ReceiptText,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  issuePurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/api";

import type {
  PurchaseOrder,
} from "@/types/purchase-order";

export default function PurchaseOrderDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    order,
    setOrder,
  ] =
    useState<
      PurchaseOrder |
      null
    >(null);

  const [
    expectedDeliveryDate,
    setExpectedDeliveryDate,
  ] =
    useState("");

  const [
    deliveryAddress,
    setDeliveryAddress,
  ] =
    useState("");

  const [
    buyerNotes,
    setBuyerNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    actionRunning,
    setActionRunning,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    getPurchaseOrder(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setOrder(
            response,
          );

          setExpectedDeliveryDate(
            response
              .expectedDeliveryDate,
          );

          setDeliveryAddress(
            response
              .deliveryAddress,
          );

          setBuyerNotes(
            response
              .buyerNotes ??
            "",
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
              : "Unable to load purchase order.",
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

  async function handleSave(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!order) {
      return;
    }

    try {
      setSaving(
        true,
      );

      setError(
        null,
      );

      const updated =
        await updatePurchaseOrder(
          order.id,
          {
            expectedDeliveryDate,

            deliveryAddress:
              deliveryAddress
                .trim(),

            buyerNotes:
              buyerNotes
                .trim() ||
              undefined,
          },
        );

      setOrder(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to update purchase order.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function runAction(
    action:
      "ISSUE" |
      "CANCEL",
  ) {
    if (!order) {
      return;
    }

    try {
      setActionRunning(
        true,
      );

      setError(
        null,
      );

      const updated =
        action ===
          "ISSUE"
          ? await issuePurchaseOrder(
              order.id,
            )
          : await cancelPurchaseOrder(
              order.id,
            );

      setOrder(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to update purchase order status.",
      );
    } finally {
      setActionRunning(
        false,
      );
    }
  }

  if (loading) {
    return (
      <div
        className={
          "request-detail-loading"
        }
      >
        Loading purchase
        order...
      </div>
    );
  }

  if (!order) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href={
            "/purchase-orders"
          }
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />

          Purchase orders
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
            "Purchase order not found."}
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
        href={
          "/purchase-orders"
        }
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Purchase orders
      </Link>

      <section
        className={
          "po-detail-heading"
        }
      >
        <div>
          <div
            className={
              "request-detail-heading__meta"
            }
          >
            <span>
              {order.poNumber}
            </span>

            <span
              className={
                `po-status po-status--${
                  order.status
                    .toLowerCase()
                }`
              }
            >
              {order.status}
            </span>
          </div>

          <h1>
            {
              order
                .supplierName
            }
          </h1>

          <p>
            Purchase commitment generated
            from awarded sourcing event
            {` ${order.rfqNumber}.`}
          </p>
        </div>

        <div
          className={
            "po-detail-actions"
          }
        >
          {(
            order.status ===
              "DRAFT" ||
            order.status ===
              "ISSUED"
          ) ? (
            <button
              type="button"
              className={
                "button button--secondary request-cancel-button"
              }
              disabled={
                actionRunning
              }
              onClick={
                () =>
                  void runAction(
                    "CANCEL",
                  )
              }
            >
              <Ban size={16} />
              Cancel PO
            </button>
          ) : null}

          {order.status ===
            "DRAFT" ? (
            <button
              type="button"
              className={
                "button button--primary"
              }
              disabled={
                actionRunning
              }
              onClick={
                () =>
                  void runAction(
                    "ISSUE",
                  )
              }
            >
              <PackageCheck
                size={16}
              />

              {actionRunning
                ? "Processing..."
                : "Issue purchase order"}
            </button>
          ) : null}
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
          "po-detail-summary-grid"
        }
      >
        <article
          className={
            "request-detail-summary-card"
          }
        >
          <Building2
            size={18}
          />

          <div>
            <span>
              Supplier
            </span>

            <strong>
              {
                order
                  .supplierName
              }
            </strong>

            <small>
              {
                order
                  .supplierCode
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <ReceiptText
            size={18}
          />

          <div>
            <span>
              Awarded quotation
            </span>

            <strong>
              {
                order
                  .quotationNumber
              }
            </strong>

            <small>
              {
                order
                  .rfqNumber
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <CalendarDays
            size={18}
          />

          <div>
            <span>
              Expected delivery
            </span>

            <strong>
              {
                new Date(
                  `${order.expectedDeliveryDate}T00:00:00`,
                )
                  .toLocaleDateString()
              }
            </strong>

            <small>
              {
                order
                  .paymentTerms
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <FileText
            size={18}
          />

          <div>
            <span>
              Order value
            </span>

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
                    },
                  )
                  .format(
                    order
                      .totalAmount,
                  )
              }
            </strong>

            <small>
              {
                order.lines
                  .length
              }
              {" lines"}
            </small>
          </div>
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
              Commercial commitment
            </span>

            <h2>
              Purchase order lines
            </h2>
          </div>

          <strong
            className={
              "po-total-highlight"
            }
          >
            {
              new Intl
                .NumberFormat(
                  "en-US",
                  {
                    style:
                      "currency",
                    currency:
                      order.currency,
                  },
                )
                .format(
                  order
                    .totalAmount,
                )
            }
          </strong>
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
                <th>
                  Line
                </th>

                <th>
                  Item
                </th>

                <th>
                  Category
                </th>

                <th>
                  Qty
                </th>

                <th>
                  Unit price
                </th>

                <th>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {order.lines.map(
                line => (
                  <tr
                    key={
                      line.id ??
                      line.lineNumber
                    }
                  >
                    <td>
                      {
                        line
                          .lineNumber
                      }
                    </td>

                    <td>
                      <div
                        className={
                          "request-primary-cell"
                        }
                      >
                        <strong>
                          {
                            line
                              .itemName
                          }
                        </strong>

                        <span>
                          {
                            line
                              .description ??
                            "No description"
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      {
                        line.category
                      }
                    </td>

                    <td>
                      {
                        line.quantity
                      }
                      {" "}
                      {
                        line.unit
                      }
                    </td>

                    <td>
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
                            },
                          )
                          .format(
                            line
                              .unitPrice,
                          )
                      }
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
                              },
                            )
                            .format(
                              line
                                .lineTotal,
                            )
                        }
                      </strong>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        <div
          className={
            "po-commercial-summary"
          }
        >
          <div>
            <span>
              Subtotal
            </span>

            <strong>
              {
                new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        order.currency,
                    },
                  )
                  .format(
                    order.subtotal,
                  )
              }
            </strong>
          </div>

          <div>
            <span>
              Discount
            </span>

            <strong>
              -
              {
                new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        order.currency,
                    },
                  )
                  .format(
                    order
                      .discountAmount,
                  )
              }
            </strong>
          </div>

          <div>
            <span>
              Shipping
            </span>

            <strong>
              {
                new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        order.currency,
                    },
                  )
                  .format(
                    order
                      .shippingAmount,
                  )
              }
            </strong>
          </div>

          <div>
            <span>
              Tax
            </span>

            <strong>
              {
                new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        order.currency,
                    },
                  )
                  .format(
                    order
                      .taxAmount,
                  )
              }
            </strong>
          </div>

          <div
            className={
              "po-commercial-summary__total"
            }
          >
            <span>
              Final total
            </span>

            <strong>
              {
                new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        order.currency,
                    },
                  )
                  .format(
                    order
                      .totalAmount,
                  )
              }
            </strong>
          </div>
        </div>
      </section>

      {order.status ===
        "DRAFT" ? (
        <form
          className={
            "panel"
          }
          onSubmit={
            handleSave
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
                Order logistics
              </span>

              <h2>
                Delivery details
              </h2>
            </div>
          </div>

          <div
            className={
              "po-form-grid"
            }
          >
            <label
              className={
                "request-field"
              }
            >
              <span>
                Expected delivery
              </span>

              <input
                required
                type="date"
                value={
                  expectedDeliveryDate
                }
                onChange={
                  event =>
                    setExpectedDeliveryDate(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field po-form-wide"
              }
            >
              <span>
                Delivery address
              </span>

              <textarea
                required
                rows={4}
                maxLength={1000}
                value={
                  deliveryAddress
                }
                onChange={
                  event =>
                    setDeliveryAddress(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field po-form-wide"
              }
            >
              <span>
                Buyer notes
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={
                  buyerNotes
                }
                onChange={
                  event =>
                    setBuyerNotes(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "po-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : "Save PO draft"}
            </button>
          </div>
        </form>
      ) : (
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
                Delivery instructions
              </span>

              <h2>
                Receiving information
              </h2>
            </div>
          </div>

          <div
            className={
              "po-readonly-grid"
            }
          >
            <div>
              <span>
                Address
              </span>

              <p>
                {
                  order
                    .deliveryAddress
                }
              </p>
            </div>

            <div>
              <span>
                Buyer notes
              </span>

              <p>
                {
                  order
                    .buyerNotes ??
                  "No buyer notes."
                }
              </p>
            </div>

            {order.issuedAt ? (
              <div>
                <span>
                  Issued
                </span>

                <p>
                  {
                    new Date(
                      order.issuedAt,
                    )
                      .toLocaleString()
                  }
                  {" by "}
                  {
                    order
                      .issuedByName
                  }
                </p>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
