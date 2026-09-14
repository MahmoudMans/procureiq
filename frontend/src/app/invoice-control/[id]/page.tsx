"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  FileCheck2,
  PauseCircle,
  PlayCircle,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  approveProcurementInvoice,
  cancelProcurementInvoice,
  dismissInvoiceException,
  getProcurementInvoice,
  holdProcurementInvoice,
  markProcurementInvoicePaid,
  markProcurementInvoiceReady,
  releaseProcurementInvoiceHold,
  resolveInvoiceException,
  runInvoiceMatch,
} from "@/lib/api";

import type {
  InvoiceMatchException,
  ProcurementInvoice,
} from "@/types/invoice-control";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

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
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export default function InvoiceDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    invoice,
    setInvoice,
  ] =
    useState<
      ProcurementInvoice |
      null
    >(null);

  const [
    exceptionNotes,
    setExceptionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    holdReason,
    setHoldReason,
  ] =
    useState("");

  const [
    cancelReason,
    setCancelReason,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
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

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "APPROVER";

  const canPay =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getProcurementInvoice(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setInvoice(
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
              : "Unable to load procurement invoice.",
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
    params.id,
  ]);

  async function reload() {
    setInvoice(
      await getProcurementInvoice(
        params.id,
      ),
    );
  }

  async function rerunMatch() {
    if (!invoice) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await runInvoiceMatch(
        invoice.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to rerun three-way match.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideException(
    exception:
      InvoiceMatchException,
    action:
      "RESOLVE"
      |
      "DISMISS",
  ) {
    const note =
      exceptionNotes[
        exception.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An exception resolution note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "RESOLVE"
      ) {
        await resolveInvoiceException(
          exception.id,
          note,
        );
      } else {
        await dismissInvoiceException(
          exception.id,
          note,
        );
      }

      setExceptionNotes(
        current => ({
          ...current,
          [exception.id]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update invoice exception.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function approveInvoice() {
    if (!invoice) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await approveProcurementInvoice(
        invoice.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to approve invoice.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function holdInvoice() {
    if (!invoice) {
      return;
    }

    if (!holdReason.trim()) {
      setError(
        "A payment-hold rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await holdProcurementInvoice(
        invoice.id,
        holdReason,
      );

      setHoldReason("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to place invoice on payment hold.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function releaseHold() {
    if (!invoice) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await releaseProcurementInvoiceHold(
        invoice.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to release payment hold.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function markReady() {
    if (!invoice) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await markProcurementInvoiceReady(
        invoice.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to mark invoice ready for payment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function markPaid() {
    if (!invoice) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await markProcurementInvoicePaid(
        invoice.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to mark invoice paid.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelInvoice() {
    if (!invoice) {
      return;
    }

    if (!cancelReason.trim()) {
      setError(
        "A cancellation rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await cancelProcurementInvoice(
        invoice.id,
        cancelReason,
      );

      setCancelReason("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel invoice.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading invoice...
      </div>
    );
  }

  if (!invoice) {
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

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Invoice not found."}
        </div>
      </div>
    );
  }

  const canRerunMatch =
    canManage
    &&
    (
      invoice.status ===
        "MATCH_PENDING"
      ||
      invoice.status ===
        "MATCHED"
      ||
      invoice.status ===
        "EXCEPTION"
    );

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

      <section className="invoice-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {invoice.invoiceNumber}
            </span>

            <span
              className={
                `invoice-status invoice-status--${invoice.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                invoice.status,
              )}
            </span>

            <span
              className={
                `invoice-match invoice-match--${invoice.matchStatus.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                invoice.matchStatus,
              )}
            </span>
          </div>

          <h1>
            {invoice.supplierName}
          </h1>

          <p>
            Supplier invoice
            {" "}
            {invoice.supplierInvoiceNumber}
            {" · PO "}
            {invoice.purchaseOrderNumber}
            {" · Created by "}
            {invoice.createdByName}
          </p>
        </div>

        <div className="invoice-detail-actions">
          {canRerunMatch ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void rerunMatch()
              }
            >
              <RefreshCw
                size={16}
              />
              Rerun match
            </button>
          ) : null}

          {canApprove &&
          invoice.status ===
            "MATCHED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void approveInvoice()
              }
            >
              <BadgeCheck
                size={16}
              />
              Approve invoice
            </button>
          ) : null}

          {canManage &&
          invoice.status ===
            "APPROVED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void markReady()
              }
            >
              <PlayCircle
                size={16}
              />
              Ready for payment
            </button>
          ) : null}

          {canPay &&
          invoice.status ===
            "READY_FOR_PAYMENT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void markPaid()
              }
            >
              <Coins
                size={16}
              />
              Mark paid
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

      {invoice.paymentHold ? (
        <section className="invoice-hold-banner">
          <PauseCircle
            size={18}
          />

          <div>
            <strong>
              Payment hold active
            </strong>

            <span>
              {invoice.holdReason ??
                "Payment is blocked until invoice exceptions are cleared."}
            </span>
          </div>

          {canApprove &&
          invoice.status ===
            "PAYMENT_HOLD" &&
          invoice.openExceptions ===
            0 ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void releaseHold()
              }
            >
              Release hold
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="invoice-detail-kpis">
        <article className="request-detail-summary-card">
          <Coins
            size={18}
          />

          <div>
            <span>
              Invoice total
            </span>

            <strong>
              {money(
                invoice.totalAmount,
                invoice.currency,
              )}
            </strong>

            <small>
              Tax
              {" "}
              {money(
                invoice.taxAmount,
                invoice.currency,
              )}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <ReceiptText
            size={18}
          />

          <div>
            <span>
              PO total
            </span>

            <strong>
              {money(
                invoice.purchaseOrderTotal,
                invoice.purchaseOrderCurrency,
              )}
            </strong>

            <small>
              {invoice.purchaseOrderStatus}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <ShieldAlert
            size={18}
          />

          <div>
            <span>
              Open exceptions
            </span>

            <strong>
              {invoice.openExceptions}
            </strong>

            <small>
              Three-way match controls
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <AlertTriangle
            size={18}
          />

          <div>
            <span>
              AP aging
            </span>

            <strong>
              {invoice.overdue
                ? `${invoice.agingDays} days`
                : "Current"}
            </strong>

            <small>
              Due
              {" "}
              {new Date(
                `${invoice.dueDate}T00:00:00`,
              )
                .toLocaleDateString()}
            </small>
          </div>
        </article>
      </section>

      <section className="invoice-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Three-way match
              </span>

              <h2>
                PO & invoice exposure
              </h2>
            </div>

            <FileCheck2
              size={19}
            />
          </div>

          <div className="invoice-match-grid">
            <div>
              <span>
                PO total
              </span>

              <strong>
                {money(
                  invoice.purchaseOrderTotal,
                  invoice.purchaseOrderCurrency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Cumulative invoiced
              </span>

              <strong>
                {money(
                  invoice.cumulativeInvoicedValue,
                  invoice.currency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Remaining PO value
              </span>

              <strong>
                {money(
                  invoice.remainingPoValue,
                  invoice.purchaseOrderCurrency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Variance tolerance
              </span>

              <strong>
                {invoice.poVarianceTolerancePct.toFixed(1)}
                %
              </strong>
            </div>

            <div>
              <span>
                Receipt state
              </span>

              <strong>
                {invoice.purchaseOrderStatus}
              </strong>
            </div>

            <div>
              <span>
                Currency match
              </span>

              <strong>
                {invoice.currency ===
                invoice.purchaseOrderCurrency
                  ? "Matched"
                  : "Mismatch"}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Invoice lifecycle
              </span>

              <h2>
                Approval & payment
              </h2>
            </div>

            <Coins
              size={19}
            />
          </div>

          <div className="invoice-lifecycle-grid">
            <div>
              <span>
                Approved
              </span>

              <strong>
                {invoice.approvedAt
                  ? new Date(
                      invoice.approvedAt,
                    )
                      .toLocaleString()
                  : "—"}
              </strong>

              <small>
                {invoice.approvedByName ??
                  ""}
              </small>
            </div>

            <div>
              <span>
                Ready for payment
              </span>

              <strong>
                {invoice.readyForPaymentAt
                  ? new Date(
                      invoice.readyForPaymentAt,
                    )
                      .toLocaleString()
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                Paid
              </span>

              <strong>
                {invoice.paidAt
                  ? new Date(
                      invoice.paidAt,
                    )
                      .toLocaleString()
                  : "—"}
              </strong>
            </div>
          </div>

          {invoice.notes ? (
            <div className="invoice-notes">
              {invoice.notes}
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Invoice content
            </span>

            <h2>
              Line items
            </h2>
          </div>

          <ReceiptText
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Line total</th>
              </tr>
            </thead>

            <tbody>
              {invoice.lines.map(
                line => (
                  <tr
                    key={line.id}
                  >
                    <td>
                      {line.lineNumber}
                    </td>

                    <td>
                      {line.description}
                    </td>

                    <td>
                      {line.quantity}
                    </td>

                    <td>
                      {money(
                        line.unitPrice,
                        invoice.currency,
                      )}
                    </td>

                    <td>
                      <strong>
                        {money(
                          line.lineTotal,
                          invoice.currency,
                        )}
                      </strong>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Payment exceptions
            </span>

            <h2>
              Match exceptions
            </h2>
          </div>

          <ShieldAlert
            size={19}
          />
        </div>

        {invoice.exceptions.length ===
        0 ? (
          <div className="invoice-empty">
            No matching exceptions have
            been detected.
          </div>
        ) : (
          <div className="invoice-exception-list">
            {invoice.exceptions.map(
              exception => (
                <article
                  key={exception.id}
                  className={
                    `invoice-exception invoice-exception--${exception.severity.toLowerCase()}`
                  }
                >
                  <div className="invoice-exception-heading">
                    <div>
                      <span
                        className={
                          `invoice-exception-severity invoice-exception-severity--${exception.severity.toLowerCase()}`
                        }
                      >
                        {exception.severity}
                      </span>

                      <strong>
                        {readable(
                          exception.exceptionType,
                        )}
                      </strong>

                      <small>
                        {readable(
                          exception.status,
                        )}
                      </small>
                    </div>

                    {exception.varianceAmount !==
                    null ? (
                      <div>
                        <span>
                          Variance
                        </span>

                        <strong>
                          {money(
                            exception.varianceAmount,
                            invoice.currency,
                          )}
                        </strong>
                      </div>
                    ) : null}
                  </div>

                  <p>
                    {exception.details}
                  </p>

                  {exception.expectedValue !==
                    null
                  ||
                  exception.actualValue !==
                    null ? (
                    <div className="invoice-exception-values">
                      <span>
                        Expected:
                        {" "}
                        {exception.expectedValue !==
                        null
                          ? money(
                              exception.expectedValue,
                              invoice.currency,
                            )
                          : "—"}
                      </span>

                      <span>
                        Actual:
                        {" "}
                        {exception.actualValue !==
                        null
                          ? money(
                              exception.actualValue,
                              invoice.currency,
                            )
                          : "—"}
                      </span>
                    </div>
                  ) : null}

                  {exception.resolutionNote ? (
                    <div className="invoice-resolution-note">
                      {exception.resolutionNote}
                      {exception.resolvedByName
                        ? ` — ${exception.resolvedByName}`
                        : ""}
                    </div>
                  ) : null}

                  {exception.status ===
                    "OPEN" &&
                  (
                    canManage
                    ||
                    canApprove
                  ) ? (
                    <div className="invoice-inline-controls">
                      <input
                        value={
                          exceptionNotes[
                            exception.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Resolution evidence / approval rationale"
                        }
                        onChange={
                          event =>
                            setExceptionNotes(
                              current => ({
                                ...current,
                                [exception.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      {canManage ? (
                        <button
                          type="button"
                          className="invoice-inline-button"
                          disabled={
                            running
                            ||
                            !(
                              exceptionNotes[
                                exception.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void decideException(
                                exception,
                                "RESOLVE",
                              )
                          }
                        >
                          <BadgeCheck
                            size={14}
                          />
                          Resolve
                        </button>
                      ) : null}

                      {canApprove ? (
                        <button
                          type="button"
                          className="invoice-inline-button invoice-inline-button--danger"
                          disabled={
                            running
                            ||
                            !(
                              exceptionNotes[
                                exception.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void decideException(
                                exception,
                                "DISMISS",
                              )
                          }
                        >
                          <XCircle
                            size={14}
                          />
                          Dismiss
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      (
        invoice.status ===
          "MATCHED"
        ||
        invoice.status ===
          "APPROVED"
        ||
        invoice.status ===
          "READY_FOR_PAYMENT"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Payment control
              </span>

              <h2>
                Manual payment hold
              </h2>
            </div>

            <PauseCircle
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Hold rationale
            </span>

            <textarea
              rows={4}
              maxLength={2000}
              value={holdReason}
              onChange={
                event =>
                  setHoldReason(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="invoice-form-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !holdReason.trim()
              }
              onClick={
                () =>
                  void holdInvoice()
              }
            >
              <PauseCircle
                size={16}
              />
              Place payment hold
            </button>
          </div>
        </section>
      ) : null}

      {canApprove &&
      invoice.status !==
        "PAID" &&
      invoice.status !==
        "CANCELLED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Invoice governance
              </span>

              <h2>
                Cancel invoice
              </h2>
            </div>

            <XCircle
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Cancellation rationale
            </span>

            <textarea
              rows={4}
              maxLength={2000}
              value={cancelReason}
              onChange={
                event =>
                  setCancelReason(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="invoice-form-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !cancelReason.trim()
              }
              onClick={
                () =>
                  void cancelInvoice()
              }
            >
              <XCircle
                size={16}
              />
              Cancel invoice
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
