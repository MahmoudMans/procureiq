"use client";

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Download,
  PackageSearch,
  RefreshCw,
  SearchX,
  ShieldAlert,
  Truck,
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
  formatDate,
  formatMoney,
  timeOf,
  todayIso,
  useToast,
} from "@/components/kit";
import { getDeliverySummary, getPurchaseOrders } from "@/lib/api";
import type { DeliverySummary } from "@/types/delivery";
import type { PurchaseOrder } from "@/types/purchase-order";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const ALLOWED_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

/** Orders that belong on the delivery board. */
const TRACKED: string[] = ["ISSUED", "PARTIALLY_RECEIVED", "RECEIVED"];

/** Orders where goods are still expected. */
const AWAITING: string[] = ["ISSUED", "PARTIALLY_RECEIVED"];

const integer = new Intl.NumberFormat("en-US");

function isLate(order: PurchaseOrder, today: string): boolean {
  return AWAITING.includes(order.status) && order.expectedDeliveryDate < today;
}

function daysLate(expected: string, today: string): number {
  const now = timeOf(today);
  const due = timeOf(expected);

  if (now === null || due === null) {
    return 0;
  }

  return Math.max(Math.round((now - due) / 86_400_000), 0);
}

/** Open orders first (soonest date on top), then received orders (newest first). */
function byUrgency(a: PurchaseOrder, b: PurchaseOrder): number {
  const aOpen = AWAITING.includes(a.status);
  const bOpen = AWAITING.includes(b.status);

  if (aOpen !== bOpen) {
    return aOpen ? -1 : 1;
  }

  return aOpen
    ? a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate)
    : b.expectedDeliveryDate.localeCompare(a.expectedDeliveryDate);
}

function buildColumns(today: string): Column<PurchaseOrder>[] {
  return [
    {
      id: "order",
      header: "Purchase order",
      sortValue: (order) => order.poNumber,
      cell: (order) => (
        <div className="request-primary-cell">
          <strong>
            <Link href={`/purchase-orders/${order.id}`} className="supplier-360-link">
              {order.poNumber}
            </Link>
          </strong>

          <span>{order.rfqNumber}</span>
        </div>
      ),
    },
    {
      id: "supplier",
      header: "Supplier",
      sortValue: (order) => order.supplierName.toLowerCase(),
      cell: (order) => (
        <div className="stacked-cell">
          <strong>{order.supplierName}</strong>
          <span>{order.supplierCode}</span>
        </div>
      ),
    },
    {
      id: "delivery",
      header: "Expected delivery",
      sortValue: (order) => order.expectedDeliveryDate,
      cell: (order) => (
        <div className="kit-cell-stack">
          <span>{formatDate(order.expectedDeliveryDate)}</span>

          {isLate(order, today) ? (
            <small className="kit-cell-flag">
              Overdue by {daysLate(order.expectedDeliveryDate, today)}d
            </small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (order) => order.status,
      cell: (order) => <StatusBadge value={order.status} />,
    },
    {
      id: "value",
      header: "Value",
      align: "right",
      sortValue: (order) => order.totalAmount,
      firstSort: "desc",
      cell: (order) => (
        <strong className="kit-num">
          {formatMoney(order.totalAmount, order.currency)}
        </strong>
      ),
    },
    {
      id: "action",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 80,
      cell: (order) => (
        <Link href={`/purchase-orders/${order.id}`} className="table-action">
          {order.status === "RECEIVED" ? "View" : "Receive"}
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DeliveriesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const allowed = user !== null && ALLOWED_ROLES.includes(user.role);

  const [today] = useState(() => todayIso());
  const columns = useMemo(() => buildColumns(today), [today]);

  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);
      setSummaryFailed(false);

      const [orderResult, summaryResult] = await Promise.allSettled([
        getPurchaseOrders(),
        getDeliverySummary(),
      ]);

      if (!active) {
        return;
      }

      if (orderResult.status === "fulfilled") {
        setOrders(orderResult.value);
      } else {
        setError(
          orderResult.reason instanceof Error
            ? orderResult.reason.message
            : "Unable to load delivery operations.",
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummaryFailed(true);
      }

      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [allowed, reloadKey]);

  const tracked = useMemo(
    () => (orders ?? []).filter((order) => TRACKED.includes(order.status)),
    [orders],
  );

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return tracked
      .filter((order) =>
        filter === "OVERDUE"
          ? isLate(order, today)
          : !filter || order.status === filter,
      )
      .filter(
        (order) =>
          !normalized ||
          [order.poNumber, order.rfqNumber, order.supplierName, order.supplierCode]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      )
      .sort(byUrgency);
  }, [tracked, query, filter, today]);

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="Access restricted"
            description="Your role cannot access delivery operations."
          />
        </section>
      </div>
    );
  }

  const initialLoad = orders === null && error === null;
  const hasFilters = query.trim() !== "" || filter !== "";
  const overdueCount = tracked.filter((order) => isLate(order, today)).length;

  const filterOptions: SegmentedOption[] = [
    { value: "", label: "All" },
    {
      value: "OVERDUE",
      label: overdueCount > 0 ? `Overdue · ${overdueCount}` : "Overdue",
    },
    { value: "ISSUED", label: "Issued" },
    { value: "PARTIALLY_RECEIVED", label: "Partially received" },
    { value: "RECEIVED", label: "Received" },
  ];

  function clearFilters() {
    setQuery("");
    setFilter("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-deliveries-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "PO number",
        "Supplier",
        "Supplier code",
        "Source RFQ",
        "Expected delivery",
        "Status",
        "Overdue",
        "Currency",
        "Total",
      ],
      rows.map((order) => [
        order.poNumber,
        order.supplierName,
        order.supplierCode,
        order.rfqNumber,
        order.expectedDeliveryDate,
        order.status,
        isLate(order, today) ? "Yes" : "No",
        order.currency,
        order.totalAmount,
      ]),
    );

    toast.success(
      "Deliveries exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const overdueOrders = summary?.overdueOrders ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Goods receipts",
      icon: Truck,
      value: summary ? integer.format(summary.totalReceipts) : "—",
      note: "Recorded physical delivery events.",
    },
    {
      label: "Open deliveries",
      icon: Boxes,
      value: summary ? integer.format(summary.openOrders) : "—",
      note: "Issued or partially received purchase orders.",
    },
    {
      label: "Overdue orders",
      icon: AlertTriangle,
      value: summary ? integer.format(overdueOrders) : "—",
      note: "Open commitments past expected delivery.",
      tone: overdueOrders > 0 ? "warning" : "default",
    },
    {
      label: "Completed",
      icon: CheckCircle2,
      value: summary ? integer.format(summary.completedOrders) : "—",
      note: "Fully received purchase orders.",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No orders match these filters"
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
      icon={PackageSearch}
      title="No orders to track yet"
      description="Issued purchase orders appear here so you can record receipts as goods arrive."
      action={
        <Link href="/purchase-orders" className="button button--secondary">
          Go to purchase orders
        </Link>
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Order fulfillment</span>

          <h1>Deliveries</h1>

          <p>
            Track supplier fulfillment, partial receipts, overdue orders and
            completed deliveries.
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
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Delivery totals"
      />

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search PO, supplier or RFQ"
          ariaLabel="Search deliveries"
          shortcut
        />

        <SegmentedFilter
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter deliveries"
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

      {error && orders === null ? null : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(order) => order.id}
          ariaLabel="Tracked deliveries"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="deliveries"
          resetKey={`${query}|${filter}`}
        />
      )}
    </div>
  );
}
