"use client";

import {
  ArrowLeft,
  CircleAlert,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createProcurementInvoice,
  getInvoiceContext,
} from "@/lib/api";

import type {
  InvoiceContext,
} from "@/types/invoice-control";

interface InvoiceLineDraft {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

function defaultDueDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 30,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
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
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export default function NewInvoicePage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      InvoiceContext |
      null
    >(null);

  const [
    purchaseOrderId,
    setPurchaseOrderId,
  ] =
    useState("");

  const [
    supplierInvoiceNumber,
    setSupplierInvoiceNumber,
  ] =
    useState("");

  const [
    invoiceDate,
    setInvoiceDate,
  ] =
    useState(
      today(),
    );

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    taxAmount,
    setTaxAmount,
  ] =
    useState(0);

  const [
    tolerancePct,
    setTolerancePct,
  ] =
    useState(2);

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    lines,
    setLines,
  ] =
    useState<
      InvoiceLineDraft[]
    >([
      {
        lineNumber: 1,
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);

  const [
    saving,
    setSaving,
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

  useEffect(() => {
    let active = true;

    getInvoiceContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          const po =
            response.purchaseOrders[0];

          if (po) {
            setPurchaseOrderId(
              po.id,
            );

            setCurrency(
              po.currency,
            );
          }

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
              : "Unable to load invoice context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const selectedPo =
    context
      ?.purchaseOrders
      .find(
        po =>
          po.id ===
          purchaseOrderId,
      )
    ??
    null;

  const subtotal =
    useMemo(
      () =>
        lines.reduce(
          (
            total,
            line,
          ) =>
            total +
            line.quantity *
              line.unitPrice,
          0,
        ),
      [
        lines,
      ],
    );

  const total =
    subtotal +
    taxAmount;

  function selectPo(
    id: string,
  ) {
    setPurchaseOrderId(
      id,
    );

    const po =
      context
        ?.purchaseOrders
        .find(
          candidate =>
            candidate.id ===
            id,
        );

    if (po) {
      setCurrency(
        po.currency,
      );
    }
  }

  function updateLine(
    index: number,
    patch:
      Partial<InvoiceLineDraft>,
  ) {
    setLines(
      current =>
        current.map(
          (
            line,
            lineIndex,
          ) =>
            lineIndex ===
            index
              ? {
                  ...line,
                  ...patch,
                }
              : line,
        ),
    );
  }

  function addLine() {
    setLines(
      current => [
        ...current,
        {
          lineNumber:
            current.length + 1,
          description: "",
          quantity: 1,
          unitPrice: 0,
        },
      ],
    );
  }

  function removeLine(
    index: number,
  ) {
    setLines(
      current =>
        current
          .filter(
            (
              _,
              lineIndex,
            ) =>
              lineIndex !==
              index,
          )
          .map(
            (
              line,
              lineIndex,
            ) => ({
              ...line,
              lineNumber:
                lineIndex + 1,
            }),
          ),
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const invoice =
        await createProcurementInvoice({
          purchaseOrderId,
          supplierInvoiceNumber:
            supplierInvoiceNumber.trim(),
          invoiceDate,
          dueDate,
          currency:
            currency
              .trim()
              .toUpperCase(),
          taxAmount,
          poVarianceTolerancePct:
            tolerancePct,
          notes:
            notes.trim()
            ||
            undefined,
          lines:
            lines.map(
              line => ({
                lineNumber:
                  line.lineNumber,
                description:
                  line.description.trim(),
                quantity:
                  line.quantity,
                unitPrice:
                  line.unitPrice,
              }),
            ),
        });

      router.push(
        `/invoice-control/${invoice.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create procurement invoice.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/invoice-control"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Invoice control
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procure-to-pay
          </span>

          <h1>
            New supplier invoice
          </h1>

          <p>
            Capture invoice lines against
            an existing purchase order.
            ProcureIQ will immediately run
            duplicate, commercial and
            receipt-state matching.
          </p>
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

      {!context ||
      context.purchaseOrders.length ===
        0 ? (
        <section className="panel">
          <div className="invoice-empty">
            No issued or received
            purchase orders are available
            for invoice intake.
          </div>
        </section>
      ) : (
        <form
          className="invoice-create-layout"
          onSubmit={handleSubmit}
        >
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Invoice intake
                </span>

                <h2>
                  Supplier document
                </h2>
              </div>

              <ReceiptText
                size={19}
              />
            </div>

            <div className="invoice-form-grid">
              <label className="request-field invoice-form-wide">
                <span>
                  Purchase order
                </span>

                <select
                  required
                  value={purchaseOrderId}
                  onChange={
                    event =>
                      selectPo(
                        event.target.value,
                      )
                  }
                >
                  {context.purchaseOrders.map(
                    po => (
                      <option
                        key={po.id}
                        value={po.id}
                      >
                        {po.purchaseOrderNumber}
                        {" — "}
                        {po.supplierName}
                        {" — "}
                        {po.currency}
                        {" "}
                        {po.totalAmount}
                        {" — "}
                        {po.status}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field invoice-form-wide">
                <span>
                  Supplier invoice number
                </span>

                <input
                  required
                  maxLength={120}
                  value={
                    supplierInvoiceNumber
                  }
                  onChange={
                    event =>
                      setSupplierInvoiceNumber(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Invoice date
                </span>

                <input
                  required
                  type="date"
                  value={invoiceDate}
                  onChange={
                    event =>
                      setInvoiceDate(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Due date
                </span>

                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={
                    event =>
                      setDueDate(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Invoice currency
                </span>

                <input
                  required
                  minLength={3}
                  maxLength={3}
                  value={currency}
                  onChange={
                    event =>
                      setCurrency(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  PO variance tolerance %
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={tolerancePct}
                  onChange={
                    event =>
                      setTolerancePct(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Tax amount
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={
                    event =>
                      setTaxAmount(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <div />

              <label className="request-field invoice-form-wide">
                <span>
                  Notes
                </span>

                <textarea
                  rows={3}
                  maxLength={3000}
                  value={notes}
                  onChange={
                    event =>
                      setNotes(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="invoice-line-section">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Invoice lines
                  </span>

                  <h2>
                    Line-item value
                  </h2>
                </div>

                <button
                  type="button"
                  className="invoice-inline-button"
                  onClick={addLine}
                >
                  <Plus
                    size={14}
                  />
                  Add line
                </button>
              </div>

              <div className="invoice-line-editor">
                {lines.map(
                  (
                    line,
                    index,
                  ) => (
                    <article
                      key={
                        line.lineNumber
                      }
                    >
                      <span className="invoice-line-number">
                        {line.lineNumber}
                      </span>

                      <input
                        required
                        value={
                          line.description
                        }
                        placeholder="Description"
                        onChange={
                          event =>
                            updateLine(
                              index,
                              {
                                description:
                                  event.target.value,
                              },
                            )
                        }
                      />

                      <input
                        required
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={
                          line.quantity
                        }
                        aria-label="Quantity"
                        onChange={
                          event =>
                            updateLine(
                              index,
                              {
                                quantity:
                                  Number(
                                    event.target.value,
                                  ),
                              },
                            )
                        }
                      />

                      <input
                        required
                        type="number"
                        min="0"
                        step="0.0001"
                        value={
                          line.unitPrice
                        }
                        aria-label="Unit price"
                        onChange={
                          event =>
                            updateLine(
                              index,
                              {
                                unitPrice:
                                  Number(
                                    event.target.value,
                                  ),
                              },
                            )
                        }
                      />

                      <strong>
                        {money(
                          line.quantity *
                            line.unitPrice,
                          currency ||
                            "EUR",
                        )}
                      </strong>

                      <button
                        type="button"
                        disabled={
                          lines.length ===
                          1
                        }
                        onClick={
                          () =>
                            removeLine(
                              index,
                            )
                        }
                      >
                        <Trash2
                          size={14}
                        />
                      </button>
                    </article>
                  ),
                )}
              </div>
            </div>

            <div className="invoice-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  saving
                  ||
                  !purchaseOrderId
                  ||
                  !supplierInvoiceNumber.trim()
                  ||
                  lines.some(
                    line =>
                      !line.description.trim(),
                  )
                }
              >
                <ReceiptText
                  size={16}
                />

                {saving
                  ? "Creating & matching..."
                  : "Create & run match"}
              </button>
            </div>
          </section>

          <aside className="invoice-create-side">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Purchase order
                  </span>

                  <h2>
                    Match authority
                  </h2>
                </div>
              </div>

              {!selectedPo ? (
                <div className="invoice-empty">
                  Select a purchase
                  order.
                </div>
              ) : (
                <div className="invoice-po-preview">
                  <div>
                    <span>
                      Purchase order
                    </span>

                    <strong>
                      {selectedPo.purchaseOrderNumber}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Supplier
                    </span>

                    <strong>
                      {selectedPo.supplierName}
                    </strong>

                    <small>
                      {selectedPo.supplierCode}
                    </small>
                  </div>

                  <div>
                    <span>
                      PO total
                    </span>

                    <strong>
                      {money(
                        selectedPo.totalAmount,
                        selectedPo.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Receipt state
                    </span>

                    <strong>
                      {selectedPo.status}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Invoice arithmetic
                  </span>

                  <h2>
                    Value preview
                  </h2>
                </div>
              </div>

              <div className="invoice-value-preview">
                <div>
                  <span>
                    Subtotal
                  </span>

                  <strong>
                    {money(
                      subtotal,
                      currency ||
                        "EUR",
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Tax
                  </span>

                  <strong>
                    {money(
                      taxAmount,
                      currency ||
                        "EUR",
                    )}
                  </strong>
                </div>

                <div className="invoice-total-preview">
                  <span>
                    Invoice total
                  </span>

                  <strong>
                    {money(
                      total,
                      currency ||
                        "EUR",
                    )}
                  </strong>
                </div>
              </div>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}
