"use client";

import {
  AlertTriangle,
  CircleAlert,
  Coins,
  FileCheck2,
  Plus,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getInvoiceSummary,
  getProcurementInvoices,
} from "@/lib/api";

import type {
  InvoiceSummary,
  ProcurementInvoice,
} from "@/types/invoice-control";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function InvoiceControlPage() {
  const {
    user,
  } = useAuth();

  const [
    invoices,
    setInvoices,
  ] =
    useState<
      ProcurementInvoice[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      InvoiceSummary |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("");

  const [
    matchFilter,
    setMatchFilter,
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
    useState<
      string |
      null
    >(null);

  const canCreate =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getProcurementInvoices(
        currency,
      ),
      getInvoiceSummary(
        currency,
      ),
    ])
      .then(
        ([
          invoiceResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setInvoices(
            invoiceResponse,
          );

          setSummary(
            summaryResponse,
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
              : "Unable to load invoice control.",
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
    currency,
  ]);

  const filtered =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return invoices
          .filter(
            invoice =>
              !statusFilter
              ||
              invoice.status ===
                statusFilter,
          )
          .filter(
            invoice =>
              !matchFilter
              ||
              invoice.matchStatus ===
                matchFilter,
          )
          .filter(
            invoice => {
              if (!normalized) {
                return true;
              }

              return [
                invoice.invoiceNumber,
                invoice.supplierInvoiceNumber,
                invoice.supplierName,
                invoice.supplierCode,
                invoice.purchaseOrderNumber,
              ]
                .join(
                  " ",
                )
                .toLowerCase()
                .includes(
                  normalized,
                );
            },
          );
      },
      [
        invoices,
        query,
        statusFilter,
        matchFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procure-to-pay control
          </span>

          <h1>
            Invoice control
          </h1>

          <p>
            Intake supplier invoices,
            execute PO/receipt/invoice
            matching, manage payment
            exceptions and control
            accounts-payable exposure.
          </p>
        </div>

        <div className="invoice-heading-actions">
          <label className="invoice-currency-control">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event => {
                  setLoading(true);

                  setCurrency(
                    event.target.value,
                  );
                }
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

          {canCreate ? (
            <Link
              href="/invoice-control/new"
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New invoice
            </Link>
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

      <section className="invoice-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Coins
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            AP exposure
          </span>

          <strong className="kpi-card__value invoice-money-kpi">
            {money(
              summary
                ?.accountsPayableExposure ??
                0,
              currency,
            )}
          </strong>

          <p>
            Open unpaid invoice value.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ShieldAlert
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Match exceptions
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.openExceptions ??
              0}
          </strong>

          <p>
            {summary
              ?.exceptionInvoices ??
              0}
            {" invoices affected"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Payment holds
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.heldInvoices ??
              0}
          </strong>

          <p>
            {money(
              summary
                ?.paymentHoldExposure ??
                0,
              currency,
            )}
            {" held"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <FileCheck2
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Ready for payment
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.readyForPaymentInvoices ??
              0}
          </strong>

          <p>
            {summary
              ?.overdueInvoices ??
              0}
            {" overdue invoices"}
          </p>
        </article>
      </section>

      <section className="invoice-signal-grid">
        <article>
          <ReceiptText
            size={17}
          />

          <div>
            <span>
              Total invoices
            </span>

            <strong>
              {summary
                ?.totalInvoices ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <FileCheck2
            size={17}
          />

          <div>
            <span>
              Matched
            </span>

            <strong>
              {summary
                ?.matchedInvoices ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <AlertTriangle
            size={17}
          />

          <div>
            <span>
              Duplicate exceptions
            </span>

            <strong>
              {summary
                ?.duplicateExceptions ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <Coins
            size={17}
          />

          <div>
            <span>
              Overdue exposure
            </span>

            <strong>
              {money(
                summary
                  ?.overdueExposure ??
                  0,
                currency,
              )}
            </strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Accounts payable
            </span>

            <h2>
              Invoice portfolio
            </h2>
          </div>

          <span className="invoice-count">
            {filtered.length}
            {" invoices"}
          </span>
        </div>

        <div className="invoice-toolbar">
          <input
            value={query}
            placeholder={
              "Search invoice, supplier or PO"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All invoice statuses
            </option>

            <option value="MATCH_PENDING">
              Match pending
            </option>

            <option value="MATCHED">
              Matched
            </option>

            <option value="EXCEPTION">
              Exception
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="PAYMENT_HOLD">
              Payment hold
            </option>

            <option value="READY_FOR_PAYMENT">
              Ready for payment
            </option>

            <option value="PAID">
              Paid
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>

          <select
            value={matchFilter}
            onChange={
              event =>
                setMatchFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All match results
            </option>

            <option value="NOT_RUN">
              Not run
            </option>

            <option value="MATCHED">
              Matched
            </option>

            <option value="EXCEPTION">
              Exception
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Supplier</th>
                <th>PO</th>
                <th>Total</th>
                <th>Match</th>
                <th>Status</th>
                <th>Due</th>
                <th>Aging</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  invoice => (
                    <tr
                      key={invoice.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {invoice.invoiceNumber}
                          </strong>

                          <span>
                            {invoice.supplierInvoiceNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {invoice.supplierName}
                          </strong>

                          <span>
                            {invoice.supplierCode}
                          </span>
                        </div>
                      </td>

                      <td>
                        {invoice.purchaseOrderNumber}
                      </td>

                      <td>
                        {money(
                          invoice.totalAmount,
                          invoice.currency,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `invoice-match invoice-match--${invoice.matchStatus.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            invoice.matchStatus,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `invoice-status invoice-status--${invoice.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            invoice.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {new Date(
                          `${invoice.dueDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </td>

                      <td>
                        <span
                          className={
                            invoice.overdue
                              ? "invoice-aging invoice-aging--overdue"
                              : "invoice-aging"
                          }
                        >
                          {invoice.overdue
                            ? `${invoice.agingDays}d overdue`
                            : "Current"}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/invoice-control/${invoice.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              filtered.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No invoices match the
                    selected filters.
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
