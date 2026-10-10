"use client";

import {
  Banknote,
  Building2,
  CircleAlert,
  Download,
  FileText,
  Plus,
  RefreshCw,
  SearchX,
  Send,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  StatusBadge,
  downloadCsv,
  formatDateTime,
  formatMoney,
  timeOf,
  useToast,
} from "@/components/kit";
import { getRfqs, getRfqSummary } from "@/lib/api";
import type { Rfq, RfqStatus, RfqSummary } from "@/types/rfq";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const ALLOWED_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const STATUS_FILTERS: SegmentedOption[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "AWARDED", label: "Awarded" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const EMPTY_RFQS: Rfq[] = [];
const integer = new Intl.NumberFormat("en-US");

function buildColumns(now: number): Column<Rfq>[] {
  return [
    {
      id: "rfq",
      header: "RFQ",
      sortValue: (rfq) => rfq.title.toLowerCase(),
      cell: (rfq) => (
        <div className="request-primary-cell">
          <strong>
            <Link href={`/rfqs/${rfq.id}`} className="supplier-360-link">
              {rfq.title}
            </Link>
          </strong>

          <span>
            {rfq.rfqNumber} · {rfq.lineItems.length} line
            {rfq.lineItems.length === 1 ? "" : "s"}
          </span>
        </div>
      ),
    },
    {
      id: "source",
      header: "Source request",
      sortValue: (rfq) => rfq.purchaseRequestNumber,
      cell: (rfq) => (
        <div className="stacked-cell">
          <strong>{rfq.purchaseRequestNumber}</strong>
          <span>{rfq.departmentName}</span>
        </div>
      ),
    },
    {
      id: "suppliers",
      header: "Suppliers",
      sortValue: (rfq) => rfq.invitations.length,
      firstSort: "desc",
      cell: (rfq) => <span className="kit-num">{rfq.invitations.length}</span>,
    },
    {
      id: "deadline",
      header: "Deadline",
      sortValue: (rfq) => timeOf(rfq.responseDeadline),
      cell: (rfq) => {
        const state: string = rfq.status;
        const deadline = timeOf(rfq.responseDeadline);
        const passed = state === "PUBLISHED" && deadline !== null && deadline < now;

        return (
          <div className="kit-cell-stack">
            <span>{formatDateTime(rfq.responseDeadline)}</span>

            {passed ? (
              <small className="kit-cell-flag kit-cell-flag--warning">
                Deadline passed
              </small>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "value",
      header: "Value",
      align: "right",
      sortValue: (rfq) => rfq.purchaseRequestValue,
      firstSort: "desc",
      cell: (rfq) => (
        <strong className="kit-num">
          {formatMoney(rfq.purchaseRequestValue, rfq.currency)}
        </strong>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (rfq) => rfq.status,
      cell: (rfq) => <StatusBadge value={rfq.status} />,
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (rfq) => rfq.createdByName.toLowerCase(),
      cell: (rfq) => rfq.createdByName,
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 70,
      cell: (rfq) => (
        <Link href={`/rfqs/${rfq.id}`} className="table-action">
          Open
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function RfqsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const allowed = user !== null && ALLOWED_ROLES.includes(user.role);

  const [now] = useState(() => Date.now());
  const columns = useMemo(() => buildColumns(now), [now]);

  const [rfqs, setRfqs] = useState<Rfq[] | null>(null);
  const [summary, setSummary] = useState<RfqSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Headline numbers: loaded once, and again on Refresh.
  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    async function loadSummary() {
      try {
        const response = await getRfqSummary();

        if (active) {
          setSummary(response);
          setSummaryFailed(false);
        }
      } catch {
        if (active) {
          setSummaryFailed(true);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [allowed, reloadKey]);

  // The list: debounced, and re-run whenever a filter changes.
  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getRfqs({
          query: query.trim() || undefined,
          status: (status as RfqStatus) || undefined,
        });

        if (active) {
          setRfqs(response);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load RFQs.");
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [allowed, query, status, reloadKey]);

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="Access restricted"
            description="Your ProcureIQ role cannot access strategic sourcing."
          />
        </section>
      </div>
    );
  }

  const rows = rfqs ?? EMPTY_RFQS;
  const initialLoad = rfqs === null && error === null;
  const hasFilters = query.trim() !== "" || status !== "";

  function clearFilters() {
    setQuery("");
    setStatus("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-rfqs-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "RFQ number",
        "Title",
        "Purchase request",
        "Department",
        "Suppliers invited",
        "Response deadline",
        "Status",
        "Currency",
        "Value",
        "Owner",
      ],
      rows.map((rfq) => [
        rfq.rfqNumber,
        rfq.title,
        rfq.purchaseRequestNumber,
        rfq.departmentName,
        rfq.invitations.length,
        rfq.responseDeadline,
        rfq.status,
        rfq.currency,
        rfq.purchaseRequestValue,
        rfq.createdByName,
      ]),
    );

    toast.success(
      "RFQs exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const kpis: KpiItem[] = [
    {
      label: "Total RFQs",
      icon: FileText,
      value: summary ? integer.format(summary.totalRfqs) : "—",
      note: "Sourcing events managed by ProcureIQ.",
    },
    {
      label: "Published",
      icon: Send,
      value: summary ? integer.format(summary.publishedRfqs) : "—",
      note: "RFQs currently open for supplier responses.",
    },
    {
      label: "Supplier invitations",
      icon: Building2,
      value: summary ? integer.format(summary.invitedSuppliers) : "—",
      note: "Competitive supplier invitations across RFQs.",
    },
    {
      label: "Active sourcing value",
      icon: Banknote,
      value: summary ? formatMoney(summary.activeSourcingValue, "EUR", true) : "—",
      note: "Approved demand currently in active sourcing.",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No RFQs match these filters"
      description="Try a different search term or status, or clear the filters."
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
      icon={FileText}
      title="No RFQs yet"
      description="Turn approved purchasing demand into a competitive sourcing event."
      action={
        <Link href="/rfqs/new" className="button button--primary">
          <Plus size={16} />
          New RFQ
        </Link>
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Strategic sourcing</span>

          <h1>RFQs &amp; sourcing</h1>

          <p>
            Convert approved purchasing demand into competitive sourcing events and
            invite qualified suppliers.
          </p>
        </div>

        <div className="page-heading__actions">
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

          <Link href="/rfqs/new" className="button button--primary">
            <Plus size={17} />
            New RFQ
          </Link>
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="RFQ totals"
      />

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search RFQ number, title or purchase request"
          ariaLabel="Search RFQs"
          shortcut
        />

        <SegmentedFilter
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by status"
        />
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

      {error && rfqs === null ? null : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(rfq) => rfq.id}
          ariaLabel="RFQs"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="rfqs"
          resetKey={`${query}|${status}`}
        />
      )}
    </div>
  );
}
