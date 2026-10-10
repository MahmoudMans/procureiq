"use client";

import {
  Banknote,
  CircleAlert,
  Download,
  FileClock,
  PackageCheck,
  PackageOpen,
  Plus,
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
  KpiGrid,
  type KpiItem,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  StatusBadge,
  downloadCsv,
  formatDate,
  formatMoney,
  todayIso,
  useToast,
} from "@/components/kit";
import { getPurchaseOrders, getPurchaseOrderSummary } from "@/lib/api";
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
} from "@/types/purchase-order";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const ALLOWED_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const STATUS_FILTERS: SegmentedOption[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "SUPPLIER_REJECTED", label: "Rejected by supplier" },
  { value: "PARTIALLY_RECEIVED", label: "Partially received" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Statuses where goods are still expected, so a past delivery date means "late". */
const AWAITING_DELIVERY: string[] = ["ISSUED", "PARTIALLY_RECEIVED"];

const EMPTY_ORDERS: PurchaseOrder[] = [];
const integer = new Intl.NumberFormat("en-US");

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

          <span>
            {order.purchaseRequestNumber} · {order.lines.length} line
            {order.lines.length === 1 ? "" : "s"}
          </span>
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
      id: "rfq",
      header: "Source RFQ",
      sortValue: (order) => order.rfqNumber,
      cell: (order) => order.rfqNumber,
    },
    {
      id: "delivery",
      header: "Delivery",
      sortValue: (order) => order.expectedDeliveryDate,
      cell: (order) => {
        const late =
          AWAITING_DELIVERY.includes(order.status) &&
          order.expectedDeliveryDate < today;

        return (
          <div className="kit-cell-stack">
            <span>{formatDate(order.expectedDeliveryDate)}</span>

            {late ? <small className="kit-cell-flag">Overdue</small> : null}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      sortValue: (order) => order.status,
      cell: (order) => (
        <div className="kit-cell-stack">
          <StatusBadge value={order.status} />
          {order.status === "ISSUED" && order.supplierResponse === "REJECTED" ? (
            <StatusBadge value="REJECTED" label="Supplier rejected" />
          ) : null}
        </div>
      ),
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
      id: "createdBy",
      header: "Created by",
      sortValue: (order) => order.createdByName.toLowerCase(),
      cell: (order) => order.createdByName,
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 70,
      cell: (order) => (
        <Link href={`/purchase-orders/${order.id}`} className="table-action">
          Open
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const toast = useToast();

  const allowed = user !== null && ALLOWED_ROLES.includes(user.role);

  const [today] = useState(() => todayIso());
  const columns = useMemo(() => buildColumns(today), [today]);

  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [summary, setSummary] = useState<PurchaseOrderSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const visibleOrders = useMemo(() => {
    const loaded = orders ?? EMPTY_ORDERS;

    if (status !== "SUPPLIER_REJECTED") {
      return loaded;
    }

    return loaded.filter(
      (order) => order.status === "ISSUED" && order.supplierResponse === "REJECTED",
    );
  }, [orders, status]);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    async function loadSummary() {
      try {
        const response = await getPurchaseOrderSummary();

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

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getPurchaseOrders(
          query.trim() || undefined,
          ((status === "SUPPLIER_REJECTED" ? "ISSUED" : status) as PurchaseOrderStatus) ||
          undefined,
        );

        if (active) {
          setOrders(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load purchase orders.",
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
  }, [allowed, query, status, reloadKey]);

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="Access restricted"
            description="Your ProcureIQ role cannot manage purchase orders."
          />
        </section>
      </div>
    );
  }

  const rows = visibleOrders;
  const initialLoad = orders === null && error === null;
  const hasFilters = query.trim() !== "" || status !== "";

  function clearFilters() {
    setQuery("");
    setStatus("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "PO number",
        "Purchase request",
        "Supplier",
        "Supplier code",
        "Source RFQ",
        "Expected delivery",
        "Status",
        "Supplier response",
        "Lines",
        "Currency",
        "Total",
        "Created by",
      ],
      rows.map((order) => [
        order.poNumber,
        order.purchaseRequestNumber,
        order.supplierName,
        order.supplierCode,
        order.rfqNumber,
        order.expectedDeliveryDate,
        order.status,
        order.issuedAt ? order.supplierResponse : "",
        order.lines.length,
        order.currency,
        order.totalAmount,
        order.createdByName,
      ]),
    );

    toast.success(
      "Purchase orders exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const kpis: KpiItem[] = [
    {
      label: "Purchase orders",
      icon: PackageOpen,
      value: summary ? integer.format(summary.totalOrders) : "—",
      note: "Awarded sourcing commitments converted into orders.",
    },
    {
      label: "Draft orders",
      icon: FileClock,
      value: summary ? integer.format(summary.draftOrders) : "—",
      note: "Orders prepared but not yet issued.",
    },
    {
      label: "Issued orders",
      icon: PackageCheck,
      value: summary ? integer.format(summary.issuedOrders) : "—",
      note: "Purchase commitments formally issued.",
    },
    {
      label: "Issued value",
      icon: Banknote,
      value: summary ? formatMoney(summary.issuedValue, "EUR", true) : "—",
      note: "Commercial value of issued orders.",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No purchase orders match these filters"
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
      icon={PackageOpen}
      title="No purchase orders yet"
      description="Purchase orders are created from awarded RFQs."
      action={
        <Link href="/purchase-orders/new" className="button button--primary">
          <Plus size={16} />
          New purchase order
        </Link>
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procure-to-order</span>

          <h1>Purchase orders</h1>

          <p>
            Convert awarded sourcing decisions into controlled supplier purchase
            orders.
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

          <Link href="/purchase-orders/new" className="button button--primary">
            <Plus size={17} />
            New purchase order
          </Link>
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Purchase order totals"
      />

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search PO, supplier or RFQ"
          ariaLabel="Search purchase orders"
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

      {error && orders === null ? null : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(order) => order.id}
          ariaLabel="Purchase orders"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="purchase-orders"
          resetKey={`${query}|${status}`}
        />
      )}
    </div>
  );
}
