"use client";

import {
  AlertTriangle,
  Boxes,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Plus,
  Truck,
  X,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createGoodsReceipt,
  getGoodsReceipts,
  getPurchaseOrder,
  getPurchaseOrderReceiving,
  getSupplierDeliveryPerformance,
} from "@/lib/api";

import type {
  GoodsReceipt,
  PurchaseOrderReceiving,
  SupplierDeliveryPerformance,
} from "@/types/delivery";

import type {
  PurchaseOrder,
} from "@/types/purchase-order";

interface DeliveryWorkspaceProps {
  order: PurchaseOrder;
  onOrderUpdated: (
    order: PurchaseOrder,
  ) => void;
}

function todayValue():
string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

export function DeliveryWorkspace({
  order,
  onOrderUpdated,
}: DeliveryWorkspaceProps) {
  const [
    receiving,
    setReceiving,
  ] =
    useState<
      PurchaseOrderReceiving |
      null
    >(null);

  const [
    receipts,
    setReceipts,
  ] =
    useState<GoodsReceipt[]>(
      [],
    );

  const [
    performance,
    setPerformance,
  ] =
    useState<
      SupplierDeliveryPerformance |
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

  const [
    receiptOpen,
    setReceiptOpen,
  ] =
    useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      getPurchaseOrderReceiving(
        order.id,
      ),
      getGoodsReceipts(
        order.id,
      ),
      getSupplierDeliveryPerformance(
        order.supplierId,
      ),
    ])
      .then(
        ([
          receivingResponse,
          receiptsResponse,
          performanceResponse,
        ]) => {
          if (!active) {
            return;
          }

          setReceiving(
            receivingResponse,
          );

          setReceipts(
            receiptsResponse,
          );

          setPerformance(
            performanceResponse,
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
              : "Unable to load delivery tracking.",
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
    order.id,
    order.supplierId,
  ]);

  async function reload() {
    const [
      receivingResponse,
      receiptsResponse,
      performanceResponse,
      orderResponse,
    ] =
      await Promise.all([
        getPurchaseOrderReceiving(
          order.id,
        ),
        getGoodsReceipts(
          order.id,
        ),
        getSupplierDeliveryPerformance(
          order.supplierId,
        ),
        getPurchaseOrder(
          order.id,
        ),
      ]);

    setReceiving(
      receivingResponse,
    );

    setReceipts(
      receiptsResponse,
    );

    setPerformance(
      performanceResponse,
    );

    onOrderUpdated(
      orderResponse,
    );
  }

  const receivedTotal =
    useMemo(
      () =>
        receiving?.lines.reduce(
          (
            total,
            line,
          ) =>
            total +
            line.receivedQuantity,
          0,
        ) ??
        0,
      [receiving],
    );

  const orderedTotal =
    useMemo(
      () =>
        receiving?.lines.reduce(
          (
            total,
            line,
          ) =>
            total +
            line.orderedQuantity,
          0,
        ) ??
        0,
      [receiving],
    );

  const progress =
    orderedTotal > 0
      ? Math.min(
          100,
          (
            receivedTotal /
            orderedTotal
          ) *
            100,
        )
      : 0;

  if (loading) {
    return (
      <section
        className={
          "panel"
        }
      >
        <div
          className={
            "delivery-loading"
          }
        >
          Loading delivery tracking...
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={
          "panel delivery-workspace"
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
              Receiving & fulfillment
            </span>

            <h2>
              Delivery tracking
            </h2>
          </div>

          {(
            order.status ===
              "ISSUED" ||
            order.status ===
              "PARTIALLY_RECEIVED"
          ) ? (
            <button
              type="button"
              className={
                "button button--primary"
              }
              onClick={
                () =>
                  setReceiptOpen(
                    true,
                  )
              }
            >
              <Plus
                size={16}
              />

              Record receipt
            </button>
          ) : null}
        </div>

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

        {receiving ? (
          <>
            <div
              className={
                "delivery-progress-head"
              }
            >
              <div>
                <span>
                  Overall quantity
                  fulfillment
                </span>

                <strong>
                  {
                    progress.toFixed(
                      1,
                    )
                  }
                  %
                </strong>
              </div>

              {receiving.overdue ? (
                <span
                  className={
                    "delivery-overdue"
                  }
                >
                  <AlertTriangle
                    size={14}
                  />
                  Overdue
                </span>
              ) : null}
            </div>

            <div
              className={
                "delivery-progress-track"
              }
            >
              <div
                className={
                  "delivery-progress-value"
                }
                style={{
                  width:
                    `${progress}%`,
                }}
              />
            </div>

            <div
              className={
                "delivery-line-list"
              }
            >
              {receiving.lines.map(
                line => {
                  const lineProgress =
                    line.orderedQuantity >
                    0
                      ? Math.min(
                          100,
                          (
                            line.receivedQuantity /
                            line.orderedQuantity
                          ) *
                            100,
                        )
                      : 0;

                  return (
                    <article
                      key={
                        line.purchaseOrderLineId
                      }
                      className={
                        "delivery-line-card"
                      }
                    >
                      <div
                        className={
                          "delivery-line-card__identity"
                        }
                      >
                        <span>
                          Line
                          {" "}
                          {
                            line.lineNumber
                          }
                        </span>

                        <strong>
                          {
                            line.itemName
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Ordered
                        </span>

                        <strong>
                          {
                            line.orderedQuantity
                          }
                          {" "}
                          {line.unit}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Received
                        </span>

                        <strong>
                          {
                            line.receivedQuantity
                          }
                          {" "}
                          {line.unit}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Remaining
                        </span>

                        <strong>
                          {
                            line.remainingQuantity
                          }
                          {" "}
                          {line.unit}
                        </strong>
                      </div>

                      <div
                        className={
                          "delivery-line-progress"
                        }
                      >
                        <div>
                          <div
                            style={{
                              width:
                                `${lineProgress}%`,
                            }}
                          />
                        </div>

                        {line.complete ? (
                          <CheckCircle2
                            size={16}
                          />
                        ) : (
                          <span>
                            {
                              lineProgress
                                .toFixed(
                                  0,
                                )
                            }
                            %
                          </span>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </>
        ) : null}
      </section>

      {performance ? (
        <section
          className={
            "delivery-performance-grid"
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
                <CalendarCheck
                  size={19}
                />
              </div>
            </div>

            <span
              className={
                "kpi-card__label"
              }
            >
              On-time delivery
            </span>

            <strong
              className={
                "kpi-card__value"
              }
            >
              {
                performance
                  .onTimeDeliveryRate
                  .toFixed(1)
              }
              %
            </strong>

            <p>
              {
                performance
                  .onTimeOrders
              }
              {" on-time / "}
              {
                performance
                  .completedOrders
              }
              {" completed"}
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
                  size={19}
                />
              </div>
            </div>

            <span
              className={
                "kpi-card__label"
              }
            >
              Fulfillment
            </span>

            <strong
              className={
                "kpi-card__value"
              }
            >
              {
                performance
                  .fulfillmentRate
                  .toFixed(1)
              }
              %
            </strong>

            <p>
              Quantity received across
              tracked orders.
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
                <Clock3
                  size={19}
                />
              </div>
            </div>

            <span
              className={
                "kpi-card__label"
              }
            >
              Late orders
            </span>

            <strong
              className={
                "kpi-card__value"
              }
            >
              {
                performance
                  .lateOrders
              }
            </strong>

            <p>
              Completed after the
              expected delivery date.
            </p>
          </article>
        </section>
      ) : null}

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
              Receipt history
            </span>

            <h2>
              Goods receipts
            </h2>
          </div>

          <Truck size={19} />
        </div>

        {receipts.length ===
        0 ? (
          <div
            className={
              "delivery-empty"
            }
          >
            No goods receipts have
            been recorded yet.
          </div>
        ) : (
          <div
            className={
              "delivery-receipt-list"
            }
          >
            {receipts.map(
              receipt => (
                <article
                  key={
                    receipt.id
                  }
                  className={
                    `delivery-receipt-card ${
                      receipt.lateReceipt
                        ? "delivery-receipt-card--late"
                        : ""
                    }`
                  }
                >
                  <div
                    className={
                      "delivery-receipt-card__icon"
                    }
                  >
                    <Truck
                      size={17}
                    />
                  </div>

                  <div
                    className={
                      "delivery-receipt-card__main"
                    }
                  >
                    <strong>
                      {
                        receipt.receiptNumber
                      }
                    </strong>

                    <span>
                      {
                        new Date(
                          `${receipt.receivedDate}T00:00:00`,
                        )
                          .toLocaleDateString()
                      }
                      {" · "}
                      {
                        receipt.recordedByName
                      }
                    </span>

                    {receipt.deliveryReference ? (
                      <small>
                        Reference:
                        {" "}
                        {
                          receipt.deliveryReference
                        }
                      </small>
                    ) : null}
                  </div>

                  <div
                    className={
                      "delivery-receipt-card__lines"
                    }
                  >
                    {
                      receipt.lines
                        .length
                    }
                    {" lines"}
                  </div>

                  {receipt.lateReceipt ? (
                    <span
                      className={
                        "delivery-late-badge"
                      }
                    >
                      Late receipt
                    </span>
                  ) : (
                    <span
                      className={
                        "delivery-ontime-badge"
                      }
                    >
                      On time
                    </span>
                  )}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {receiptOpen &&
      receiving ? (
        <GoodsReceiptDialog
          order={order}
          receiving={
            receiving
          }
          onClose={
            () =>
              setReceiptOpen(
                false,
              )
          }
          onSaved={
            async () => {
              setReceiptOpen(
                false,
              );

              await reload();
            }
          }
        />
      ) : null}
    </>
  );
}

interface GoodsReceiptDialogProps {
  order: PurchaseOrder;
  receiving:
    PurchaseOrderReceiving;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function GoodsReceiptDialog({
  order,
  receiving,
  onClose,
  onSaved,
}: GoodsReceiptDialogProps) {
  const [
    receivedDate,
    setReceivedDate,
  ] =
    useState(
      todayValue(),
    );

  const [
    deliveryReference,
    setDeliveryReference,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    quantities,
    setQuantities,
  ] =
    useState<
      Record<
        string,
        number
      >
    >(
      Object.fromEntries(
        receiving.lines.map(
          line => [
            line
              .purchaseOrderLineId,
            0,
          ],
        ),
      ),
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const lines =
      receiving.lines
        .map(
          line => ({
            purchaseOrderLineId:
              line
                .purchaseOrderLineId,

            quantityReceived:
              Number(
                quantities[
                  line
                    .purchaseOrderLineId
                ] ??
                0,
              ),
          }),
        )
        .filter(
          line =>
            line.quantityReceived >
            0,
        );

    if (lines.length === 0) {
      setError(
        "Enter a received quantity for at least one purchase order line.",
      );

      return;
    }

    try {
      setSaving(
        true,
      );

      setError(
        null,
      );

      await createGoodsReceipt(
        order.id,
        {
          receivedDate,

          deliveryReference:
            deliveryReference
              .trim() ||
            undefined,

          notes:
            notes.trim() ||
            undefined,

          lines,
        },
      );

      await onSaved();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to record goods receipt.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  return (
    <div
      className={
        "dialog-backdrop"
      }
      role="presentation"
      onMouseDown={
        event => {
          if (
            event
              .currentTarget ===
            event.target
          ) {
            onClose();
          }
        }
      }
    >
      <section
        className={
          "dialog delivery-dialog"
        }
        role="dialog"
        aria-modal="true"
      >
        <div
          className={
            "dialog__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Goods receipt
            </span>

            <h2>
              Record delivery
            </h2>

            <p>
              {
                order.poNumber
              }
              {" · "}
              {
                order.supplierName
              }
            </p>
          </div>

          <button
            type="button"
            className={
              "icon-button"
            }
            onClick={
              onClose
            }
            aria-label={
              "Close goods receipt"
            }
          >
            <X size={19} />
          </button>
        </div>

        <form
          className={
            "delivery-receipt-form"
          }
          onSubmit={
            handleSubmit
          }
        >
          <div
            className={
              "delivery-receipt-meta"
            }
          >
            <label
              className={
                "request-field"
              }
            >
              <span>
                Received date
              </span>

              <input
                required
                type="date"
                max={
                  todayValue()
                }
                value={
                  receivedDate
                }
                onChange={
                  event =>
                    setReceivedDate(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Delivery reference
              </span>

              <input
                maxLength={160}
                value={
                  deliveryReference
                }
                placeholder={
                  "Packing slip / delivery note"
                }
                onChange={
                  event =>
                    setDeliveryReference(
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
              "delivery-receipt-lines"
            }
          >
            <div
              className={
                "delivery-receipt-lines__header"
              }
            >
              <span>
                PO line
              </span>

              <span>
                Remaining
              </span>

              <span>
                Receive now
              </span>
            </div>

            {receiving.lines.map(
              line => (
                <div
                  key={
                    line.purchaseOrderLineId
                  }
                  className={
                    "delivery-receipt-lines__row"
                  }
                >
                  <div>
                    <strong>
                      {
                        line.itemName
                      }
                    </strong>

                    <span>
                      Line
                      {" "}
                      {
                        line.lineNumber
                      }
                    </span>
                  </div>

                  <span>
                    {
                      line.remainingQuantity
                    }
                    {" "}
                    {line.unit}
                  </span>

                  <input
                    type="number"
                    min="0"
                    max={
                      line.remainingQuantity
                    }
                    step="0.001"
                    disabled={
                      line.complete
                    }
                    value={
                      quantities[
                        line
                          .purchaseOrderLineId
                      ] ??
                      0
                    }
                    onChange={
                      event =>
                        setQuantities(
                          current => ({
                            ...current,
                            [line.purchaseOrderLineId]:
                              Number(
                                event
                                  .target
                                  .value,
                              ),
                          }),
                        )
                    }
                  />
                </div>
              ),
            )}
          </div>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Receipt notes
            </span>

            <textarea
              rows={4}
              maxLength={2000}
              value={notes}
              placeholder={
                "Optional receiving notes, condition observations or exceptions."
              }
              onChange={
                event =>
                  setNotes(
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

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

          <div
            className={
              "dialog__footer"
            }
          >
            <button
              type="button"
              className={
                "button button--secondary"
              }
              onClick={
                onClose
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={
                saving
              }
            >
              <Truck
                size={16}
              />

              {saving
                ? "Recording..."
                : "Record goods receipt"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
