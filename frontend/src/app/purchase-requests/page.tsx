"use client";

import {
  Banknote,
  CircleAlert,
  ClipboardList,
  Download,
  FileClock,
  Plus,
  RefreshCw,
  SearchX,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  Skeleton,
  StatusBadge,
  downloadCsv,
  formatDate,
  formatMoney,
  useToast,
} from "@/components/kit";
import { getPurchaseRequests, getPurchaseRequestSummary } from "@/lib/api";
import type {
  PurchaseRequest,
  PurchaseRequestStatus,
  PurchaseRequestSummary,
} from "@/types/purchase-request";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const CREATOR_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER", "REQUESTER"];

const STATUS_FILTERS: SegmentedOption[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const EMPTY_REQUESTS: PurchaseRequest[] = [];
const integer = new Intl.NumberFormat("en-US");

/** Local date as YYYY-MM-DD, comparable with the API's date-only strings. */
function isoToday(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function buildColumns(today: string): Column<PurchaseRequest>[] {
  return [
    {
      id: "request",
      header: "Request",
      sortValue: (request) => request.title.toLowerCase(),
      cell: (request) => (
        <div className="request-primary-cell">
          <strong>
            <Link
              href={`/purchase-requests/${request.id}`}
              className="supplier-360-link"
            >
              {request.title}
            </Link>
          </strong>

          <span>
            {request.requestNumber} · {request.items.length} line
            {request.items.length === 1 ? "" : "s"}
          </span>
        </div>
      ),
    },
    {
      id: "requester",
      header: "Requester",
      sortValue: (request) => request.requesterName.toLowerCase(),
      cell: (request) => request.requesterName,
    },
    {
      id: "department",
      header: "Department",
      sortValue: (request) => request.departmentName.toLowerCase(),
      cell: (request) => request.departmentName,
    },
    {
      id: "costCenter",
      header: "Cost center",
      sortValue: (request) => request.costCenter.toLowerCase(),
      cell: (request) => request.costCenter,
    },
    {
      id: "delivery",
      header: "Delivery",
      sortValue: (request) => request.desiredDeliveryDate,
      cell: (request) => {
        const passed =
          (request.status === "DRAFT" || request.status === "SUBMITTED") &&
          request.desiredDeliveryDate < today;

        return (
          <div className="kit-cell-stack">
            <span>{formatDate(request.desiredDeliveryDate)}</span>

            {passed ? <small className="kit-cell-flag">Date passed</small> : null}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      sortValue: (request) => request.status,
      cell: (request) => <StatusBadge value={request.status} />,
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (request) => request.estimatedTotalAmount,
      firstSort: "desc",
      cell: (request) => (
        <strong className="kit-num">
          {formatMoney(request.estimatedTotalAmount, request.currency)}
        </strong>
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 70,
      cell: (request) => (
        <Link href={`/purchase-requests/${request.id}`} className="table-action">
          Open
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PurchaseRequestsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canCreate = user !== null && CREATOR_ROLES.includes(user.role);

  const [today] = useState(() => isoToday());
  const columns = useMemo(() => buildColumns(today), [today]);

  const [requests, setRequests] = useState<PurchaseRequest[] | null>(null);
  const [summary, setSummary] = useState<PurchaseRequestSummary | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Headline numbers: loaded once, and again on Refresh.
  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const response = await getPurchaseRequestSummary();

        if (active) {
          setSummary(response);
        }
      } catch {
        // The list below reports connectivity problems; the cards just show a dash.
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // The list: debounced, and re-run whenever a filter changes.
  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getPurchaseRequests({
          query: query.trim() || undefined,
          status: (status as PurchaseRequestStatus) || undefined,
        });

        if (active) {
          setRequests(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load purchase requests.",
          );
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
  }, [query, status, reloadKey]);

  const rows = requests ?? EMPTY_REQUESTS;
  const initialLoad = requests === null && error === null;
  const hasFilters = query.trim() !== "" || status !== "";

  function clearFilters() {
    setQuery("");
    setStatus("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-purchase-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Request number",
        "Title",
        "Requester",
        "Department",
        "Cost center",
        "Desired delivery",
        "Status",
        "Lines",
        "Currency",
        "Estimated total",
      ],
      rows.map((request) => [
        request.requestNumber,
        request.title,
        request.requesterName,
        request.departmentName,
        request.costCenter,
        request.desiredDeliveryDate,
        request.status,
        request.items.length,
        request.currency,
        request.estimatedTotalAmount,
      ]),
    );

    toast.success(
      "Purchase requests exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const kpis = [
    {
      label: "Total requests",
      icon: ClipboardList,
      value: summary ? integer.format(summary.totalRequests) : "—",
      note: "Requests visible to your ProcureIQ role.",
    },
    {
      label: "Draft requests",
      icon: FileClock,
      value: summary ? integer.format(summary.draftRequests) : "—",
      note: "Requirements still being prepared.",
    },
    {
      label: "Submitted",
      icon: Send,
      value: summary ? integer.format(summary.submittedRequests) : "—",
      note: "Requests awaiting the next governance stage.",
    },
    {
      label: "Submitted value",
      icon: Banknote,
      value: summary ? formatMoney(summary.totalSubmittedValue, "EUR", true) : "—",
      note: "Submitted and approved estimated request value.",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No purchase requests match these filters"
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
      icon={ClipboardList}
      title="No purchase requests yet"
      description="Capture a purchasing need and send it into the approval flow."
      action={
        canCreate ? (
          <Link href="/purchase-requests/new" className="button button--primary">
            <Plus size={16} />
            New request
          </Link>
        ) : undefined
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procure-to-request</span>

          <h1>Purchase requests</h1>

          <p>
            Capture purchasing demand, estimate cost and submit requirements into
            the ProcureIQ governance flow.
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

          {canCreate ? (
            <Link href="/purchase-requests/new" className="button button--primary">
              <Plus size={17} />
              New request
            </Link>
          ) : null}
        </div>
      </section>

      <section className="request-kpi-grid" aria-label="Request totals">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;

          return (
            <article key={kpi.label} className="kpi-card">
              <div className="kpi-card__topline">
                <div className="kpi-card__icon">
                  <Icon size={20} />
                </div>
              </div>

              <span className="kpi-card__label">{kpi.label}</span>

              {initialLoad ? (
                <Skeleton height={26} width="50%" />
              ) : (
                <strong className="kpi-card__value">{kpi.value}</strong>
              )}

              <p>{kpi.note}</p>
            </article>
          );
        })}
      </section>

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search number, title, description or cost center"
          ariaLabel="Search purchase requests"
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

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(request) => request.id}
        ariaLabel="Purchase requests"
        loading={initialLoad}
        busy={fetching}
        empty={emptyNode}
        persistKey="purchase-requests"
        resetKey={`${query}|${status}`}
      />
    </div>
  );
}
