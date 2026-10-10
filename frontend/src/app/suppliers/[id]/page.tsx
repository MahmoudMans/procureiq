"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  PackageCheck,
  RefreshCw,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  Meter,
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  formatMoney,
  meterToneFor,
  readable,
  timeOf,
} from "@/components/kit";
import { getSupplier360 } from "@/lib/api";
import type { Supplier360, Supplier360CategorySpend } from "@/types/supplier-360";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type MonthlySpend = Supplier360["monthlySpend"][number];
type SourcingRow = Supplier360["recentSourcing"][number];

const EMPTY_MONTHS: MonthlySpend[] = [];

/** "2026-03" -> "Mar 2026"; anything unexpected is shown as it came. */
function monthLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);

  if (!match) {
    return value;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function rateTone(rate: number) {
  return meterToneFor(rate >= 95 ? "success" : rate >= 85 ? "warning" : "danger");
}

const SOURCING_COLUMNS: Column<SourcingRow>[] = [
  {
    id: "rfq",
    header: "RFQ",
    sortValue: (row) => row.rfqNumber,
    cell: (row) => (
      <Link href={`/rfqs/${row.rfqId}`} className="supplier360-table-link">
        {row.rfqNumber}
      </Link>
    ),
  },
  {
    id: "event",
    header: "Event",
    sortValue: (row) => row.title.toLowerCase(),
    cell: (row) => (
      <div className="request-primary-cell">
        <strong>{row.title}</strong>

        <span>{readable(row.rfqStatus)}</span>
      </div>
    ),
  },
  {
    id: "invitation",
    header: "Invitation",
    sortValue: (row) => row.invitationStatus,
    cell: (row) => <StatusBadge value={row.invitationStatus} />,
  },
  {
    id: "quotation",
    header: "Quotation",
    sortValue: (row) => row.quotationNumber ?? "",
    cell: (row) => row.quotationNumber ?? <span className="kit-text-muted">—</span>,
  },
  {
    id: "value",
    header: "Quote value",
    align: "right",
    sortValue: (row) => row.quotationTotal,
    firstSort: "desc",
    cell: (row) =>
      row.quotationTotal !== null ? (
        <span className="kit-num">{formatMoney(row.quotationTotal, "EUR")}</span>
      ) : (
        <span className="kit-text-muted">—</span>
      ),
  },
  {
    id: "deadline",
    header: "Deadline",
    sortValue: (row) => timeOf(row.responseDeadline),
    firstSort: "desc",
    cell: (row) => formatDate(row.responseDeadline),
  },
];

/* ------------------------------------------------------------------ */
/* Category exposure                                                   */
/* ------------------------------------------------------------------ */

function CategoryExposure({ items }: { items: Supplier360CategorySpend[] }) {
  const largest =
    items.length > 0
      ? items.reduce((best, item) => (item.sharePercent > best.sharePercent ? item : best))
      : null;

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Category exposure</span>

          <h2>Spend mix</h2>
        </div>

        <Boxes size={19} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={Boxes}
          title="No category spend yet"
          description="The mix appears once purchase orders are committed."
        />
      ) : (
        <>
          {largest && items.length > 1 ? (
            <p className="kit-month-summary">
              <span>
                Largest category: <strong>{largest.category}</strong> at{" "}
                <strong className={largest.sharePercent >= 60 ? "kit-text-warning" : undefined}>
                  {largest.sharePercent.toFixed(1)}%
                </strong>
              </span>
            </p>
          ) : null}

          <div className="supplier360-category-list">
            {items.map((item) => (
              <article key={item.category} className="supplier360-category-row">
                <div className="supplier360-category-heading">
                  <div>
                    <strong>{item.category}</strong>

                    <span>{item.lineCount} PO lines</span>
                  </div>

                  <div>
                    <strong>{formatMoney(item.amount, "EUR")}</strong>

                    <span>{item.sharePercent.toFixed(1)}%</span>
                  </div>
                </div>

                <Meter
                  value={item.sharePercent}
                  max={100}
                  tone="primary"
                  ariaLabel={`${item.category} share of spend`}
                />
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface ProfileData {
  id: string;
  supplier: Supplier360;
}

export default function Supplier360Page() {
  const params = useParams<{ id: string }>();

  const [result, setResult] = useState<ProfileData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getSupplier360(id);

        if (active) {
          setResult({ id, supplier: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load supplier profile.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, reloadKey]);

  const supplier = result !== null && result.id === params.id ? result.supplier : null;
  const months = supplier?.monthlySpend ?? EMPTY_MONTHS;

  // Oldest first, when the API uses sortable YYYY-MM labels; otherwise as received.
  const ordered = useMemo(
    () =>
      months.every((month) => /^\d{4}-\d{2}/.test(month.month))
        ? [...months].sort((a, b) => a.month.localeCompare(b.month))
        : months,
    [months],
  );

  const maxMonthly = useMemo(
    () => Math.max(1, ...ordered.map((month) => month.amount)),
    [ordered],
  );

  const trend = useMemo(() => {
    if (ordered.length === 0) {
      return null;
    }

    const total = ordered.reduce((sum, month) => sum + month.amount, 0);
    const peak = ordered.reduce(
      (best, month) => (month.amount > best.amount ? month : best),
      ordered[0],
    );

    return { total, average: total / ordered.length, peak };
  }, [ordered]);

  if (supplier === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={120} />
          <Skeleton height={110} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/suppliers" className="request-back-link">
          <ArrowLeft size={16} />
          Suppliers
        </Link>

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
      </div>
    );
  }

  const noDeliveries = supplier.completedDeliveryOrders === 0;
  const onTime = supplier.onTimeDeliveryRate;
  const overdue = supplier.overduePurchaseOrderCount;

  const kpis: KpiItem[] = [
    {
      label: "Committed spend",
      icon: Banknote,
      value: formatMoney(supplier.committedSpend, "EUR", true),
      note: `${supplier.purchaseOrderCount} purchase orders`,
    },
    {
      label: "Awards won",
      icon: Trophy,
      value: String(supplier.awardCount),
      note: `${supplier.sourcingWinRate.toFixed(1)}% sourcing win rate`,
    },
    {
      label: "RFQ participation",
      icon: Target,
      value: String(supplier.invitedRfqCount),
      note: `${supplier.submittedQuotationCount} submitted quotations`,
    },
    {
      label: "On-time delivery",
      icon: CalendarCheck,
      value: noDeliveries ? "—" : `${onTime.toFixed(1)}%`,
      note: `${supplier.onTimeOrders} on-time / ${supplier.completedDeliveryOrders} completed`,
      tone: !noDeliveries && onTime < 85 ? "warning" : "default",
    },
    {
      label: "Fulfillment",
      icon: Boxes,
      value: `${supplier.fulfillmentRate.toFixed(1)}%`,
      note: `${supplier.trackedDeliveryOrders} delivery orders tracked`,
    },
    {
      label: "Operational exposure",
      icon: AlertTriangle,
      value: String(overdue),
      note: `${supplier.openPurchaseOrderCount} open orders · ${supplier.lateOrders} late completed`,
      tone: overdue > 0 ? "warning" : "default",
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/suppliers" className="request-back-link">
        <ArrowLeft size={16} />
        Suppliers
      </Link>

      <section className="supplier360-hero">
        <div className="supplier360-hero__identity">
          <div className="supplier360-hero__icon">
            <Building2 size={26} />
          </div>

          <div>
            <span className="eyebrow">Supplier 360°</span>

            <h1>{supplier.legalName}</h1>

            <div className="supplier360-hero__meta">
              <span>{supplier.supplierCode}</span>

              <span>{supplier.category}</span>

              <span>{supplier.country}</span>
            </div>
          </div>
        </div>

        <div className="supplier360-hero__badges">
          <StatusBadge value={supplier.status} />

          <StatusBadge
            value={supplier.riskLevel}
            label={`${readable(supplier.riskLevel)} risk`}
          />

          <span className="supplier360-rating">
            <Star size={14} />

            {supplier.rating?.toFixed(1) ?? "—"}
            {" / 5"}
          </span>

          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>
        </div>
      </section>

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

      <KpiGrid items={kpis} ariaLabel="Supplier totals" />

      <section className="supplier360-primary-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Spend intelligence</span>

              <h2>12-month spend trend</h2>
            </div>

            <BarChart3 size={19} />
          </div>

          {ordered.length === 0 ? (
            <EmptyState
              compact
              icon={BarChart3}
              title="No committed spend yet"
              description="Monthly spend appears once purchase orders are committed."
            />
          ) : (
            <>
              {trend ? (
                <p className="kit-month-summary">
                  <span>
                    Total <strong>{formatMoney(trend.total, "EUR", true)}</strong>
                  </span>

                  <span>
                    Average <strong>{formatMoney(trend.average, "EUR", true)}</strong> / month
                  </span>

                  <span>
                    Peak <strong>{monthLabel(trend.peak.month)}</strong> (
                    {formatMoney(trend.peak.amount, "EUR", true)})
                  </span>
                </p>
              ) : null}

              <div className="supplier360-spend-list">
                {ordered.map((month) => (
                  <article key={month.month} className="supplier360-spend-row">
                    <div>
                      <strong>{monthLabel(month.month)}</strong>

                      <span>
                        {month.orderCount} {month.orderCount === 1 ? "order" : "orders"}
                      </span>
                    </div>

                    <div className="supplier360-spend-track">
                      <div
                        style={{
                          width: `${Math.max(3, (month.amount / maxMonthly) * 100)}%`,
                        }}
                      />
                    </div>

                    <strong>{formatMoney(month.amount, "EUR", true)}</strong>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <CategoryExposure items={supplier.categorySpend} />
      </section>

      <section className="supplier360-performance-grid">
        <article className="panel supplier360-performance-card">
          <div>
            <CheckCircle2 size={20} />

            <span>Delivery performance</span>
          </div>

          <strong>{noDeliveries ? "—" : `${onTime.toFixed(1)}%`}</strong>

          {noDeliveries ? null : (
            <div className="kit-meter-wrap">
              <Meter
                value={onTime}
                max={100}
                tone={rateTone(onTime)}
                ariaLabel="On-time delivery rate"
              />
            </div>
          )}

          <p>
            {noDeliveries
              ? "No completed deliveries yet."
              : `${supplier.completedDeliveryOrders} completed orders with ${supplier.lateOrders} late deliveries.`}
          </p>
        </article>

        <article className="panel supplier360-performance-card">
          <div>
            <Award size={20} />

            <span>Average award value</span>
          </div>

          <strong>{formatMoney(supplier.averageAwardValue, "EUR")}</strong>

          <p>Average value of awarded supplier quotations.</p>
        </article>

        <article className="panel supplier360-performance-card">
          <div>
            <PackageCheck size={20} />

            <span>Last receipt</span>
          </div>

          <strong className="supplier360-date-value">
            {supplier.lastReceiptDate
              ? new Date(`${supplier.lastReceiptDate}T00:00:00`).toLocaleDateString()
              : "No receipt"}
          </strong>

          <p>Most recent physical delivery registered for this supplier.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Source-to-contract</span>

            <h2>Recent sourcing participation</h2>
          </div>

          <FileText size={19} />
        </div>

        <DataTable
          columns={SOURCING_COLUMNS}
          rows={supplier.recentSourcing}
          getRowId={(row) => String(row.rfqId)}
          ariaLabel="Recent sourcing participation"
          defaultSort={{ id: "deadline", dir: "desc" }}
          persistKey="supplier-360-sourcing"
          empty={
            <EmptyState
              compact
              icon={FileText}
              title="No sourcing participation yet"
              description="RFQs this supplier is invited to will be listed here."
            />
          }
        />
      </section>

      <section className="supplier360-two-column">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Award history</span>

              <h2>Recent wins</h2>
            </div>

            <Trophy size={19} />
          </div>

          {supplier.recentAwards.length === 0 ? (
            <EmptyState
              compact
              icon={Trophy}
              title="No awards yet"
              description="Awarded sourcing events will be listed here."
            />
          ) : (
            <div className="supplier360-award-list">
              {supplier.recentAwards.map((award) => (
                <article key={award.quotationId} className="supplier360-award-row">
                  <div className="supplier360-award-icon">
                    <Award size={16} />
                  </div>

                  <div>
                    <Link href={`/rfqs/${award.rfqId}`}>{award.rfqNumber}</Link>

                    <span>{award.quotationNumber}</span>
                  </div>

                  <strong>{formatMoney(award.awardValue, "EUR")}</strong>

                  {award.manualOverride ? (
                    <StatusBadge value="OVERRIDE" label="Override" tone="warning" dot={false} />
                  ) : (
                    <StatusBadge
                      value="RECOMMENDED"
                      label="Recommended"
                      tone="success"
                      dot={false}
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Order exposure</span>

              <h2>Recent purchase orders</h2>
            </div>

            <PackageCheck size={19} />
          </div>

          {supplier.recentPurchaseOrders.length === 0 ? (
            <EmptyState
              compact
              icon={PackageCheck}
              title="No purchase orders yet"
              description="Orders placed with this supplier will be listed here."
            />
          ) : (
            <div className="supplier360-po-list">
              {supplier.recentPurchaseOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/purchase-orders/${order.id}`}
                  className="supplier360-po-row"
                >
                  <div>
                    <strong>{order.poNumber}</strong>

                    <span>{order.rfqNumber}</span>
                  </div>

                  <StatusBadge value={order.status} />

                  <strong>{formatMoney(order.totalAmount, "EUR")}</strong>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Supplier lifecycle</span>

            <h2>Recent activity</h2>
          </div>

          <Activity size={19} />
        </div>

        {supplier.recentActivity.length === 0 ? (
          <EmptyState
            compact
            icon={Activity}
            title="No activity yet"
            description="Supplier lifecycle events will be listed here."
          />
        ) : (
          <div className="supplier360-timeline">
            {supplier.recentActivity.map((event, index) => (
              <article
                key={`${event.eventType}-${event.occurredAt}-${index}`}
                className="supplier360-event"
              >
                <div className="supplier360-event__marker">
                  <Clock3 size={14} />
                </div>

                <div className="supplier360-event__content">
                  <div>
                    <strong>{event.title}</strong>

                    <span>{event.detail}</span>
                  </div>

                  <div>
                    <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>

                    <Link href={event.href}>Open</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
