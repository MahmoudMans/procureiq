"use client";

import {
  AlertTriangle,
  CircleAlert,
  Coins,
  Download,
  FileCheck2,
  Plus,
  ReceiptText,
  RefreshCw,
  SearchX,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  type FilterChip,
  FilterChips,
  KpiGrid,
  type KpiItem,
  SearchField,
  SelectField,
  type SelectOption,
  type StatItem,
  StatStrip,
  StatusBadge,
  downloadCsv,
  formatDate,
  formatMoney,
  readable,
  useToast,
} from "@/components/kit";
import { getInvoiceSummary, getProcurementInvoices } from "@/lib/api";
import type { InvoiceSummary, ProcurementInvoice } from "@/types/invoice-control";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CREATOR_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const CLOSED_STATUSES: string[] = ["PAID", "CANCELLED"];

const CURRENCY_OPTIONS: SelectOption[] = ["EUR", "USD", "GBP", "TND"].map(
  (code) => ({ value: code, label: code }),
);

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "MATCH_PENDING", label: "Match pending" },
  { value: "MATCHED", label: "Matched" },
  { value: "EXCEPTION", label: "Exception" },
  { value: "APPROVED", label: "Approved" },
  { value: "PAYMENT_HOLD", label: "Payment hold" },
  { value: "READY_FOR_PAYMENT", label: "Ready for payment" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

const MATCH_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "NOT_RUN", label: "Not run" },
  { value: "MATCHED", label: "Matched" },
  { value: "EXCEPTION", label: "Exception" },
];

const integer = new Intl.NumberFormat("en-US");

/** Overdue first (most overdue on top), then upcoming by due date, paid/cancelled last. */
function priority(invoice: ProcurementInvoice): number {
  if (CLOSED_STATUSES.includes(invoice.status)) {
    return 2;
  }

  return invoice.overdue ? 0 : 1;
}

function byPriority(a: ProcurementInvoice, b: ProcurementInvoice): number {
  const difference = priority(a) - priority(b);

  if (difference !== 0) {
    return difference;
  }

  if (priority(a) === 0) {
    return b.agingDays - a.agingDays;
  }

  return a.dueDate.localeCompare(b.dueDate);
}

const COLUMNS: Column<ProcurementInvoice>[] = [
  {
    id: "invoice",
    header: "Invoice",
    sortValue: (invoice) => invoice.invoiceNumber,
    cell: (invoice) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/invoice-control/${invoice.id}`} className="supplier-360-link">
            {invoice.invoiceNumber}
          </Link>
        </strong>

        <span>{invoice.supplierInvoiceNumber}</span>
      </div>
    ),
  },
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (invoice) => invoice.supplierName.toLowerCase(),
    cell: (invoice) => (
      <div className="stacked-cell">
        <strong>{invoice.supplierName}</strong>
        <span>{invoice.supplierCode}</span>
      </div>
    ),
  },
  {
    id: "po",
    header: "PO",
    sortValue: (invoice) => invoice.purchaseOrderNumber,
    cell: (invoice) => invoice.purchaseOrderNumber,
  },
  {
    id: "total",
    header: "Total",
    align: "right",
    sortValue: (invoice) => invoice.totalAmount,
    firstSort: "desc",
    cell: (invoice) => (
      <strong className="kit-num">
        {formatMoney(invoice.totalAmount, invoice.currency)}
      </strong>
    ),
  },
  {
    id: "match",
    header: "Match",
    sortValue: (invoice) => invoice.matchStatus,
    cell: (invoice) => <StatusBadge value={invoice.matchStatus} />,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (invoice) => invoice.status,
    cell: (invoice) => <StatusBadge value={invoice.status} />,
  },
  {
    id: "due",
    header: "Due",
    sortValue: (invoice) => invoice.dueDate,
    cell: (invoice) => formatDate(invoice.dueDate),
  },
  {
    id: "aging",
    header: "Aging",
    sortValue: (invoice) => (invoice.overdue ? invoice.agingDays : 0),
    firstSort: "desc",
    cell: (invoice) =>
      invoice.overdue ? (
        <span className="kit-text-danger">{invoice.agingDays}d overdue</span>
      ) : (
        <span className="kit-text-muted">Current</span>
      ),
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (invoice) => (
      <Link href={`/invoice-control/${invoice.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function InvoiceControlPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canCreate = user !== null && CREATOR_ROLES.includes(user.role);

  const [invoices, setInvoices] = useState<ProcurementInvoice[] | null>(null);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [summaryCurrency, setSummaryCurrency] = useState("EUR");
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [currency, setCurrency] = useState("EUR");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);
      setSummaryFailed(false);

      const [invoiceResult, summaryResult] = await Promise.allSettled([
        getProcurementInvoices(currency),
        getInvoiceSummary(currency),
      ]);

      if (!active) {
        return;
      }

      if (invoiceResult.status === "fulfilled") {
        setInvoices(invoiceResult.value);
      } else {
        setError(
          invoiceResult.reason instanceof Error
            ? invoiceResult.reason.message
            : "Unable to load invoice control.",
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
        setSummaryCurrency(currency);
      } else {
        setSummaryFailed(true);
      }

      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [currency, reloadKey]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (invoices ?? [])
      .filter((invoice) => !statusFilter || invoice.status === statusFilter)
      .filter((invoice) => !matchFilter || invoice.matchStatus === matchFilter)
      .filter((invoice) => {
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
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      })
      .sort(byPriority);
  }, [invoices, query, statusFilter, matchFilter]);

  const initialLoad = invoices === null && error === null;

  // Figures are only shown once they belong to the selected currency.
  const figures = summary !== null && summaryCurrency === currency ? summary : null;
  const figuresLoading = figures === null && !summaryFailed;

  const hasFilters = query.trim() !== "" || statusFilter !== "" || matchFilter !== "";

  const chips: FilterChip[] = [];

  if (query.trim()) {
    chips.push({
      key: "query",
      label: `Search: “${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  if (statusFilter) {
    chips.push({
      key: "status",
      label: `Status: ${readable(statusFilter)}`,
      onRemove: () => setStatusFilter(""),
    });
  }

  if (matchFilter) {
    chips.push({
      key: "match",
      label: `Match: ${readable(matchFilter)}`,
      onRemove: () => setMatchFilter(""),
    });
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("");
    setMatchFilter("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Invoice number",
        "Supplier invoice number",
        "Supplier",
        "Supplier code",
        "Purchase order",
        "Currency",
        "Total",
        "Match",
        "Status",
        "Due date",
        "Overdue",
        "Days overdue",
      ],
      rows.map((invoice) => [
        invoice.invoiceNumber,
        invoice.supplierInvoiceNumber,
        invoice.supplierName,
        invoice.supplierCode,
        invoice.purchaseOrderNumber,
        invoice.currency,
        invoice.totalAmount,
        invoice.matchStatus,
        invoice.status,
        invoice.dueDate,
        invoice.overdue ? "Yes" : "No",
        invoice.overdue ? invoice.agingDays : 0,
      ]),
    );

    toast.success(
      "Invoices exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const openExceptions = figures?.openExceptions ?? 0;
  const heldInvoices = figures?.heldInvoices ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "AP exposure",
      icon: Coins,
      value: figures ? formatMoney(figures.accountsPayableExposure, currency, true) : "—",
      note: "Open unpaid invoice value.",
    },
    {
      label: "Match exceptions",
      icon: ShieldAlert,
      value: figures ? integer.format(openExceptions) : "—",
      note: `${integer.format(figures?.exceptionInvoices ?? 0)} invoices affected`,
      tone: openExceptions > 0 ? "warning" : "default",
    },
    {
      label: "Payment holds",
      icon: AlertTriangle,
      value: figures ? integer.format(heldInvoices) : "—",
      note: `${formatMoney(figures?.paymentHoldExposure ?? 0, currency, true)} held`,
      tone: heldInvoices > 0 ? "warning" : "default",
    },
    {
      label: "Ready for payment",
      icon: FileCheck2,
      value: figures ? integer.format(figures.readyForPaymentInvoices) : "—",
      note: `${integer.format(figures?.overdueInvoices ?? 0)} overdue invoices`,
    },
  ];

  const duplicates = figures?.duplicateExceptions ?? 0;
  const overdueExposure = figures?.overdueExposure ?? 0;

  const stats: StatItem[] = [
    {
      label: "Total invoices",
      value: figures ? integer.format(figures.totalInvoices) : "—",
    },
    {
      label: "Matched",
      value: figures ? integer.format(figures.matchedInvoices) : "—",
    },
    {
      label: "Duplicate exceptions",
      value: figures ? integer.format(duplicates) : "—",
      tone: duplicates > 0 ? "danger" : "default",
    },
    {
      label: "Overdue exposure",
      value: figures ? formatMoney(overdueExposure, currency, true) : "—",
      tone: overdueExposure > 0 ? "danger" : "default",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No invoices match these filters"
      description="Try a different search term, or clear the filters to see every invoice."
      action={
        <button
          type="button"
          className="button button--secondary"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      }
    />
  ) : (
    <EmptyState
      icon={ReceiptText}
      title="No invoices yet"
      description="Record a supplier invoice to run the PO, receipt and invoice match."
      action={
        canCreate ? (
          <Link href="/invoice-control/new" className="button button--primary">
            <Plus size={16} />
            New invoice
          </Link>
        ) : undefined
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procure-to-pay control</span>

          <h1>Invoice control</h1>

          <p>
            Intake supplier invoices, execute PO/receipt/invoice matching, manage
            payment exceptions and control accounts-payable exposure.
          </p>
        </div>

        <div className="page-heading__actions">
          <SelectField
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
          />

          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>

          {canCreate ? (
            <Link href="/invoice-control/new" className="button button--primary">
              <Plus size={16} />
              New invoice
            </Link>
          ) : null}
        </div>
      </section>

      <KpiGrid items={kpis} loading={figuresLoading} ariaLabel="Invoice totals" />

      <StatStrip items={stats} loading={figuresLoading} />

      <div className="kit-filters">
        <div className="kit-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search invoice, supplier or PO"
            ariaLabel="Search invoices"
            shortcut
          />

          <SelectField
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />

          <SelectField
            label="Match"
            value={matchFilter}
            onChange={setMatchFilter}
            options={MATCH_OPTIONS}
          />
        </div>

        <FilterChips chips={chips} onClearAll={clearFilters} />
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {error && invoices === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(invoice) => invoice.id}
          ariaLabel="Invoices"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="invoices"
          resetKey={`${query}|${statusFilter}|${matchFilter}`}
        />
      )}
    </div>
  );
}
