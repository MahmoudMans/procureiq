"use client";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CircleAlert,
  Clock3,
  Download,
  type LucideIcon,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  EmptyState,
  KpiGrid,
  type KpiItem,
  Meter,
  Skeleton,
  StatusBadge,
  downloadCsv,
  formatMoney,
  meterToneFor,
  toneFor,
  useToast,
} from "@/components/kit";
import { getProcurementAnalytics } from "@/lib/api";
import type { AnalyticsBreakdown, ProcurementAnalytics } from "@/types/analytics";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type MonthlySpend = ProcurementAnalytics["monthlySpend"][number];

const ALLOWED_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER", "APPROVER"];
const COLLAPSED_ROWS = 8;
const EMPTY_MONTHS: MonthlySpend[] = [];
const integer = new Intl.NumberFormat("en-US");

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

/* ------------------------------------------------------------------ */
/* Breakdown panel                                                     */
/* ------------------------------------------------------------------ */

interface BreakdownPanelProps {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  items: AnalyticsBreakdown[];
  loading: boolean;
  /** Render labels as coloured status badges (risk levels, PO statuses). */
  asStatus?: boolean;
  /** Shows how much of the total the biggest N entries hold. */
  concentration?: { top: number; noun: string };
}

function BreakdownPanel({
  eyebrow,
  title,
  icon: Icon,
  items,
  loading,
  asStatus = false,
  concentration,
}: BreakdownPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? items : items.slice(0, COLLAPSED_ROWS);

  const topShare =
    concentration && items.length > concentration.top
      ? [...items]
          .sort((a, b) => b.sharePercent - a.sharePercent)
          .slice(0, concentration.top)
          .reduce((sum, item) => sum + item.sharePercent, 0)
      : null;

  return (
    <section className="panel analytics-breakdown-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">{eyebrow}</span>

          <h2>{title}</h2>
        </div>

        <Icon size={19} />
      </div>

      {loading ? (
        <Skeleton height={200} />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={Icon}
          title="No data yet"
          description="This breakdown fills in as purchase orders are committed."
        />
      ) : (
        <>
          {concentration && topShare !== null ? (
            <p className="kit-month-summary">
              <span>
                Top {concentration.top} {concentration.noun} hold{" "}
                <strong className={topShare >= 60 ? "kit-text-warning" : undefined}>
                  {topShare.toFixed(1)}%
                </strong>{" "}
                of spend
              </span>
            </p>
          ) : null}

          <div className="analytics-breakdown-list">
            {visible.map((item) => (
              <article key={item.label} className="analytics-breakdown-row">
                <div className="analytics-breakdown-heading">
                  <div>
                    {asStatus ? (
                      <StatusBadge value={item.label} />
                    ) : (
                      <strong>{item.label}</strong>
                    )}

                    <span>
                      {item.count} {item.count === 1 ? "record" : "records"}
                    </span>
                  </div>

                  <div>
                    <strong>{formatMoney(item.value, "EUR", true)}</strong>

                    <span>{item.sharePercent.toFixed(1)}%</span>
                  </div>
                </div>

                <Meter
                  value={item.sharePercent}
                  max={100}
                  tone={asStatus ? meterToneFor(toneFor(item.label)) : "primary"}
                  ariaLabel={`${item.label} share of total`}
                />
              </article>
            ))}
          </div>

          {items.length > COLLAPSED_ROWS ? (
            <div className="kit-panel-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? "Show fewer" : `Show all ${items.length}`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const allowed = user !== null && ALLOWED_ROLES.includes(user.role);

  const [analytics, setAnalytics] = useState<ProcurementAnalytics | null>(null);
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

      try {
        const response = await getProcurementAnalytics();

        if (active) {
          setAnalytics(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load procurement analytics.",
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
  }, [allowed, reloadKey]);

  const months = analytics?.monthlySpend ?? EMPTY_MONTHS;

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
    const latest = ordered[ordered.length - 1];
    const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
    const change =
      previous && previous.amount > 0
        ? ((latest.amount - previous.amount) / previous.amount) * 100
        : null;

  return { total, peak, change };
  }, [ordered]);

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="Access restricted"
            description="Your current ProcureIQ role cannot access procurement analytics."
          />
        </section>
      </div>
    );
  }

  const pending = analytics === null && error === null;

  function exportCsv() {
    if (!analytics) {
      return;
    }

    const rows: (string | number)[][] = [];

    for (const month of ordered) {
      rows.push([
        "Monthly committed spend",
        month.month,
        month.orderCount,
        month.amount,
        "",
      ]);
    }

    const add = (section: string, items: AnalyticsBreakdown[]) => {
      for (const item of items) {
        rows.push([section, item.label, item.count, item.value, item.sharePercent.toFixed(1)]);
      }
    };

    add("Supplier concentration", analytics.spendBySupplier);
    add("Spend by category", analytics.spendByCategory);
    add("Spend by department", analytics.spendByDepartment);
    add("Supplier risk exposure", analytics.riskExposure);
    add("Purchase order pipeline", analytics.purchaseOrderPipeline);

    downloadCsv(
      `procureiq-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Section", "Label", "Records", "Value (EUR)", "Share (%)"],
      rows,
    );

    toast.success("Analytics exported", `${rows.length} rows saved as CSV.`);
  }

  const summary = analytics?.summary ?? null;
  const overdueDeliveries = summary?.overdueDeliveryOrders ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Committed spend",
      icon: Banknote,
      value: summary ? formatMoney(summary.committedSpend, "EUR", true) : "—",
      note: `${integer.format(summary?.committedOrderCount ?? 0)} committed purchase orders`,
    },
    {
      label: "Sourcing savings",
      icon: TrendingDown,
      value: summary ? formatMoney(summary.sourcingSavings, "EUR", true) : "—",
      note: "Value preserved versus highest submitted offers.",
    },
    {
      label: "Procurement cycle",
      icon: Clock3,
      value: summary ? `${summary.averageProcurementCycleDays.toFixed(1)}d` : "—",
      note: "Average submission-to-award duration.",
    },
    {
      label: "Average PO value",
      icon: PackageCheck,
      value: summary ? formatMoney(summary.averageOrderValue, "EUR", true) : "—",
      note: "Average committed order value.",
    },
    {
      label: "Active suppliers",
      icon: Users,
      value: summary ? integer.format(summary.activeSuppliers) : "—",
      note: "Enabled supplier relationships.",
    },
    {
      label: "Overdue deliveries",
      icon: AlertTriangle,
      value: summary ? integer.format(overdueDeliveries) : "—",
      note: `${integer.format(summary?.openDeliveryOrders ?? 0)} open delivery orders`,
      tone: overdueDeliveries > 0 ? "warning" : "default",
    },
  ];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procurement intelligence</span>

          <h1>Spend analytics</h1>

          <p>
            Executive visibility into committed spend, sourcing savings, supplier
            concentration, risk, procurement cycle time and order execution.
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
            disabled={analytics === null}
          >
            <Download size={15} />
            Export CSV
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

      {error && analytics === null ? null : (
        <>
          <KpiGrid items={kpis} loading={pending} ariaLabel="Spend analytics totals" />

          <section className="analytics-primary-grid">
            <section className="panel analytics-spend-trend">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">Spend trend</span>

                  <h2>Monthly committed spend</h2>
                </div>

                <BarChart3 size={19} />
              </div>

              {analytics === null ? (
                <Skeleton height={220} />
              ) : ordered.length === 0 ? (
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
                        Peak <strong>{monthLabel(trend.peak.month)}</strong> (
                        {formatMoney(trend.peak.amount, "EUR", true)})
                      </span>

                      {trend.change !== null ? (
                        <span>
                          Latest month{" "}
                          <strong>
                            {trend.change > 0 ? "+" : ""}
                            {trend.change.toFixed(1)}%
                          </strong>{" "}
                          vs previous
                        </span>
                      ) : null}
                    </p>
                  ) : null}

                  <div className="analytics-month-list">
                    {ordered.map((month) => (
                      <article key={month.month} className="analytics-month-row">
                        <div className="analytics-month-label">
                          <strong>{monthLabel(month.month)}</strong>

                          <span>
                            {month.orderCount} {month.orderCount === 1 ? "order" : "orders"}
                          </span>
                        </div>

                        <div className="analytics-horizontal-bar">
                          <div
                            style={{
                              width: `${Math.max(3, (month.amount / maxMonthly) * 100)}%`,
                            }}
                          />
                        </div>

                        <strong className="analytics-month-value">
                          {formatMoney(month.amount, "EUR", true)}
                        </strong>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>

            <BreakdownPanel
              eyebrow="Top suppliers"
              title="Supplier concentration"
              icon={Building2}
              items={analytics?.spendBySupplier ?? []}
              loading={analytics === null}
              concentration={{ top: 3, noun: "suppliers" }}
            />
          </section>

          <section className="analytics-secondary-grid">
            <BreakdownPanel
              eyebrow="Category intelligence"
              title="Spend by category"
              icon={Sparkles}
              items={analytics?.spendByCategory ?? []}
              loading={analytics === null}
              concentration={{ top: 3, noun: "categories" }}
            />

            <BreakdownPanel
              eyebrow="Demand ownership"
              title="Spend by department"
              icon={Users}
              items={analytics?.spendByDepartment ?? []}
              loading={analytics === null}
            />
          </section>

          <section className="analytics-secondary-grid">
            <BreakdownPanel
              eyebrow="Committed value at risk"
              title="Supplier risk exposure"
              icon={ShieldAlert}
              items={analytics?.riskExposure ?? []}
              loading={analytics === null}
              asStatus
            />

            <BreakdownPanel
              eyebrow="Execution status"
              title="Purchase order pipeline"
              icon={PackageCheck}
              items={analytics?.purchaseOrderPipeline ?? []}
              loading={analytics === null}
              asStatus
            />
          </section>
        </>
      )}
    </div>
  );
}
