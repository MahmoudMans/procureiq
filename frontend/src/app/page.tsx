"use client";

import { SmartTable } from "@/components/kit/smart-table";

/**
 * Overview dashboard.
 *
 * Data (loaded in parallel; each source may fail independently, e.g. a role
 * without analytics access still sees the supplier parts):
 *   - supplier summary + supplier list
 *   - procurement analytics (spend trend, breakdowns, risk, PO pipeline)
 *   - command center (the actions that need attention)
 */
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CircleAlert,
  Download,
  Euro,
  Gauge,
  Minus,
  PackageSearch,
  Plus,
  RefreshCw,
  ShieldAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  AreaChart,
  BarList,
  DonutChart,
  Sparkline,
  StackedBar,
  type BarListItem,
  type BarSegment,
  type DonutSlice,
  type TrendPoint,
} from "@/components/charts/charts";
import {
  getProcurementAnalytics,
  getProcurementCommandCenter,
  getSuppliers,
  getSupplierSummary,
} from "@/lib/api";
import type {
  AnalyticsBreakdown,
  MonthlySpend,
  ProcurementAnalytics,
} from "@/types/analytics";
import type {
  CommandCenter,
  CommandCenterAction,
  CommandCenterSeverity,
} from "@/types/command-center";
import type { Supplier, SupplierSummary } from "@/types/supplier";

import "./dashboard.css";

/* ------------------------------------------------------------------ */
/* Constants & formatters                                              */
/* ------------------------------------------------------------------ */

const CURRENCY = "EUR";
const ATTENTION_HORIZON_DAYS = 30;
const ATTENTION_LIMIT = 5;

/** Same roles that may create requests on the Purchase requests page. */
const REQUEST_CREATOR_ROLES = [
  "ADMIN",
  "PROCUREMENT_MANAGER",
  "BUYER",
  "REQUESTER",
];

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const RISK_COLORS: Record<string, string> = {
  LOW: "var(--risk-low)",
  MEDIUM: "var(--risk-medium)",
  HIGH: "var(--risk-high)",
  CRITICAL: "var(--risk-critical)",
};

const SEVERITY_RANK: Record<CommandCenterSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  INFO: 3,
};

type BreakdownTab = "category" | "supplier" | "department";

const TAB_ORDER: BreakdownTab[] = ["category", "supplier", "department"];

const TAB_LABELS: Record<BreakdownTab, string> = {
  category: "Category",
  supplier: "Supplier",
  department: "Department",
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("en-US");

function readable(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function greeting(date: Date): string {
  const hour = date.getHours();

  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** "2026-03" -> "Mar 26". Anything else is shown as-is. */
function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);

  if (!match) {
    return month;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, 1),
  ).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/** Sort ascending only when every month is an ISO-style "YYYY-MM"; otherwise trust the API order. */
function normalizeMonthly(rows: MonthlySpend[]): MonthlySpend[] {
  const sortable = rows.every((row) => /^\d{4}-\d{2}/.test(row.month));

  return sortable
    ? [...rows].sort((a, b) => a.month.localeCompare(b.month))
    : rows;
}

function toBarItems(rows: AnalyticsBreakdown[]): BarListItem[] {
  return rows.slice(0, 6).map((row) => ({
    label: row.label,
    value: row.value,
    share: row.sharePercent,
  }));
}

function riskColor(label: string, index: number): string {
  return RISK_COLORS[label.toUpperCase()] ?? PALETTE[index % PALETTE.length];
}

function riskRank(label: string): number {
  const position = RISK_ORDER.indexOf(label.toUpperCase());

  return position === -1 ? RISK_ORDER.length : position;
}

function buildRiskSlices(
  rows: { label: string; value: number }[],
): DonutSlice[] {
  return [...rows]
    .sort((a, b) => riskRank(a.label) - riskRank(b.label))
    .map((row, index) => ({
      label: readable(row.label),
      value: row.value,
      color: riskColor(row.label, index),
    }));
}

function dueInfo(
  action: CommandCenterAction,
): { text: string; overdue: boolean } | null {
  if (action.overdue) {
    return {
      text:
        action.daysToDue !== null
          ? `Overdue by ${Math.abs(action.daysToDue)}d`
          : "Overdue",
      overdue: true,
    };
  }

  if (action.daysToDue === null) {
    return null;
  }

  return {
    text: action.daysToDue === 0 ? "Due today" : `Due in ${action.daysToDue}d`,
    overdue: false,
  };
}

/** CSV cell with quoting, plus a guard against spreadsheet formula injection. */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  return `"${guarded.replaceAll('"', '""')}"`;
}

function downloadSuppliersCsv(suppliers: Supplier[], stamp: string): void {
  const header = [
    "Supplier code",
    "Legal name",
    "Category",
    "Country",
    "City",
    "Status",
    "Risk level",
    "Rating",
    "On-time delivery %",
    `Total spend (${CURRENCY})`,
  ];

  const rows = suppliers.map((supplier) => [
    supplier.supplierCode,
    supplier.legalName,
    supplier.category,
    supplier.country,
    supplier.city,
    supplier.status,
    supplier.riskLevel,
    supplier.rating,
    supplier.onTimeDeliveryRate,
    supplier.totalSpend,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `procureiq-suppliers-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Small presentational components                                     */
/* ------------------------------------------------------------------ */

function Skeleton({
  height,
  width = "100%",
}: {
  height: number;
  width?: number | string;
}) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

function Panel({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>

        {action}
      </div>

      {children}
    </article>
  );
}

interface KpiTrend {
  label: string;
  tone: "positive" | "negative" | "neutral";
  direction: "up" | "down" | "flat";
}

function KpiCard({
  icon: Icon,
  warning = false,
  label,
  value,
  note,
  loading,
  trend,
  spark,
}: {
  icon: LucideIcon;
  warning?: boolean;
  label: string;
  value: string;
  note: string;
  loading: boolean;
  trend?: KpiTrend;
  spark?: number[];
}) {
  const TrendIcon = trend
    ? trend.direction === "up"
      ? ArrowUpRight
      : trend.direction === "down"
        ? ArrowDownRight
        : Minus
    : null;

  return (
    <article className="kpi-card">
      <div className="kpi-card__topline">
        <div
          className={`kpi-card__icon${warning ? " kpi-card__icon--warning" : ""}`}
        >
          <Icon size={20} />
        </div>

        {loading ? (
          <Skeleton height={22} width={84} />
        ) : trend && TrendIcon ? (
          <span className={`trend trend--${trend.tone}`}>
            <TrendIcon size={14} />
            {trend.label}
          </span>
        ) : null}
      </div>

      <span className="kpi-card__label">{label}</span>

      {loading ? (
        <Skeleton height={26} width="55%" />
      ) : (
        <strong className="kpi-card__value">{value}</strong>
      )}

      {!loading && spark && spark.length > 1 ? (
        <div className="kpi-card__spark">
          <Sparkline values={spark} />
        </div>
      ) : null}

      <p>{loading ? "" : note}</p>
    </article>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  danger = false,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
  loading: boolean;
}) {
  return (
    <div className="dash-stat">
      <div className="dash-stat__icon">
        <Icon size={17} />
      </div>

      <div className="dash-stat__text">
        <span className="dash-stat__label">{label}</span>

        {loading ? (
          <Skeleton height={20} width="60%" />
        ) : (
          <>
            <strong className="dash-stat__value">{value}</strong>

            {hint ? (
              <span
                className={`dash-stat__hint${danger ? " dash-stat__hint--danger" : ""}`}
              >
                {hint}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface DashboardData {
  summary: SupplierSummary | null;
  suppliers: Supplier[];
  analytics: ProcurementAnalytics | null;
  analyticsError: string | null;
  commandCenter: CommandCenter | null;
  coreError: string | null;
}

const EMPTY_DATA: DashboardData = {
  summary: null,
  suppliers: [],
  analytics: null,
  analyticsError: null,
  commandCenter: null,
  coreError: null,
};

interface RiskView {
  mode: "spend" | "count";
  slices: DonutSlice[];
  total: number;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [now] = useState(() => new Date());
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>("category");

  useEffect(() => {
    let active = true;

    async function load() {
      const [summaryResult, suppliersResult, analyticsResult, commandResult] =
        await Promise.allSettled([
          getSupplierSummary(),
          getSuppliers(),
          getProcurementAnalytics(),
          getProcurementCommandCenter(ATTENTION_HORIZON_DAYS, CURRENCY),
        ]);

      if (!active) {
        return;
      }

      setData({
        summary:
          summaryResult.status === "fulfilled" ? summaryResult.value : null,
        suppliers:
          suppliersResult.status === "fulfilled" ? suppliersResult.value : [],
        analytics:
          analyticsResult.status === "fulfilled" ? analyticsResult.value : null,
        analyticsError:
          analyticsResult.status === "rejected"
            ? errorMessage(analyticsResult.reason, "Analytics are unavailable.")
            : null,
        commandCenter:
          commandResult.status === "fulfilled" ? commandResult.value : null,
        coreError:
          summaryResult.status === "rejected"
            ? errorMessage(summaryResult.reason, "Unable to load the dashboard.")
            : suppliersResult.status === "rejected"
              ? errorMessage(
                  suppliersResult.reason,
                  "Unable to load the dashboard.",
                )
              : null,
      });

      setLoading(false);
      setRefreshing(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const { summary, suppliers, analytics, analyticsError, commandCenter, coreError } =
    data;

  /* ---- spend trend ---- */

  const monthlySource = analytics?.monthlySpend;

  const monthly = useMemo(
    () => normalizeMonthly(monthlySource ?? []),
    [monthlySource],
  );

  const trendPoints = useMemo<TrendPoint[]>(
    () =>
      monthly.map((row) => ({
        label: formatMonth(row.month),
        value: row.amount,
        detail: `${row.orderCount} order${row.orderCount === 1 ? "" : "s"}`,
      })),
    [monthly],
  );

  const spendValues = useMemo(
    () => monthly.map((row) => row.amount),
    [monthly],
  );

  const trailingTotal = spendValues.reduce((sum, value) => sum + value, 0);
  const monthlyAverage =
    spendValues.length > 0 ? trailingTotal / spendValues.length : 0;

  const monthChange = useMemo(() => {
    if (spendValues.length < 2) {
      return null;
    }

    const latest = spendValues[spendValues.length - 1];
    const previous = spendValues[spendValues.length - 2];

    return previous > 0 ? ((latest - previous) / previous) * 100 : null;
  }, [spendValues]);

  /* ---- spend breakdown ---- */

  const spendByCategory = analytics?.spendByCategory;
  const spendBySupplier = analytics?.spendBySupplier;
  const spendByDepartment = analytics?.spendByDepartment;

  // Used when analytics are unavailable: aggregate straight from the supplier list.
  const fallbackCategories = useMemo<BarListItem[]>(() => {
    const totals = new Map<string, number>();

    for (const supplier of suppliers) {
      totals.set(
        supplier.category,
        (totals.get(supplier.category) ?? 0) + supplier.totalSpend,
      );
    }

    const grand = [...totals.values()].reduce((sum, value) => sum + value, 0);

    return [...totals.entries()]
      .map(([label, value]) => ({
        label,
        value,
        share: grand > 0 ? (value / grand) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [suppliers]);

  const breakdownSources = useMemo<Record<BreakdownTab, BarListItem[]>>(
    () => ({
      category:
        spendByCategory && spendByCategory.length > 0
          ? toBarItems(spendByCategory)
          : fallbackCategories,
      supplier: spendBySupplier ? toBarItems(spendBySupplier) : [],
      department: spendByDepartment ? toBarItems(spendByDepartment) : [],
    }),
    [spendByCategory, spendBySupplier, spendByDepartment, fallbackCategories],
  );

  const availableTabs = TAB_ORDER.filter(
    (tab) => breakdownSources[tab].length > 0,
  );

  const activeTab = availableTabs.includes(breakdownTab)
    ? breakdownTab
    : (availableTabs[0] ?? null);

  /* ---- risk mix ---- */

  const riskExposure = analytics?.riskExposure;

  const riskView = useMemo<RiskView>(() => {
    if (riskExposure && riskExposure.some((row) => row.value > 0)) {
      const slices = buildRiskSlices(riskExposure);

      return {
        mode: "spend",
        slices,
        total: slices.reduce((sum, slice) => sum + slice.value, 0),
      };
    }

    const counts = new Map<string, number>();

    for (const supplier of suppliers) {
      counts.set(supplier.riskLevel, (counts.get(supplier.riskLevel) ?? 0) + 1);
    }

    const slices = buildRiskSlices(
      [...counts.entries()].map(([label, value]) => ({ label, value })),
    );

    return {
      mode: "count",
      slices,
      total: slices.reduce((sum, slice) => sum + slice.value, 0),
    };
  }, [riskExposure, suppliers]);

  /* ---- PO pipeline ---- */

  const pipeline = analytics?.purchaseOrderPipeline;

  const pipelineSegments = useMemo<BarSegment[]>(
    () =>
      (pipeline ?? []).map((row, index) => ({
        label: readable(row.label),
        value: row.value,
        color: PALETTE[index % PALETTE.length],
        note: `${row.count} order${row.count === 1 ? "" : "s"}`,
      })),
    [pipeline],
  );

  const hasPipeline = pipelineSegments.some((segment) => segment.value > 0);

  /* ---- needs attention ---- */

  const commandActions = commandCenter?.actions;

  const attentionActions = useMemo(
    () =>
      [...(commandActions ?? [])]
        .sort(
          (a, b) =>
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
            Number(b.overdue) - Number(a.overdue) ||
            (a.daysToDue ?? 1e9) - (b.daysToDue ?? 1e9),
        )
        .slice(0, ATTENTION_LIMIT),
    [commandActions],
  );

  /* ---- suppliers ---- */

  const topSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 6),
    [suppliers],
  );

  const watchlist = useMemo(
    () =>
      suppliers
        .filter(
          (supplier) =>
            supplier.riskLevel === "HIGH" || supplier.riskLevel === "CRITICAL",
        )
        .sort((a, b) =>
          a.riskLevel === b.riskLevel
            ? b.totalSpend - a.totalSpend
            : a.riskLevel === "CRITICAL"
              ? -1
              : 1,
        )
        .slice(0, 5),
    [suppliers],
  );

  /* ---- KPI values ---- */

  const analyticsSummary = analytics?.summary ?? null;

  const committedSpend = analyticsSummary
    ? analyticsSummary.committedSpend
    : (summary?.totalSpend ?? null);

  const highRiskCount = summary?.highRiskSuppliers ?? 0;
  const onTimeRate = summary?.averageOnTimeDeliveryRate ?? null;

  const spendTrend: KpiTrend | undefined =
    monthChange === null
      ? undefined
      : {
          label: `${monthChange >= 0 ? "+" : "-"}${Math.abs(monthChange).toFixed(1)}% vs prev. month`,
          tone: "neutral",
          direction: monthChange > 0 ? "up" : monthChange < 0 ? "down" : "flat",
        };

  const showAttention = loading || commandCenter !== null;
  const showPipeline = loading || hasPipeline;
  const canCreateRequest =
    user !== null && REQUEST_CREATOR_ROLES.includes(user.role);

  const firstName = user?.fullName.split(" ")[0] ?? "";
  const dateLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function refresh() {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }

  function exportCsv() {
    downloadSuppliersCsv(suppliers, now.toISOString().slice(0, 10));
  }

  return (
    <div className="page-stack">
      <section className="page-heading page-heading--dashboard">
        <div>
          <span className="eyebrow">{dateLabel}</span>

          <h1>
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>

          <p>
            A live view of spend, supplier risk and the actions that need you
            today.
          </p>
        </div>

        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={refresh}
            disabled={refreshing || loading}
          >
            <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={suppliers.length === 0}
          >
            <Download size={15} />
            Export suppliers
          </button>

          {canCreateRequest ? (
            <Link href="/purchase-requests/new" className="button button--primary">
              <Plus size={16} />
              New purchase request
            </Link>
          ) : null}
        </div>
      </section>

      {coreError ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>
            {coreError} Make sure the backend and PostgreSQL are running.
          </span>
        </div>
      ) : null}

      {!loading && !coreError && analyticsError ? (
        <div className="dash-note">
          <CircleAlert size={16} />

          <span>Spend analytics are unavailable: {analyticsError}</span>
        </div>
      ) : null}

      <section className="kpi-grid" aria-label="Key indicators">
        <KpiCard
          icon={Euro}
          label={analyticsSummary ? "Committed spend" : "Managed supplier spend"}
          value={committedSpend === null ? "—" : compactCurrency.format(committedSpend)}
          note={
            analyticsSummary
              ? `${integer.format(analyticsSummary.committedOrderCount)} committed purchase orders`
              : "Across the current supplier portfolio."
          }
          loading={loading}
          trend={spendTrend}
          spark={spendValues}
        />

        <KpiCard
          icon={Building2}
          label="Active suppliers"
          value={summary ? integer.format(summary.activeSuppliers) : "—"}
          note={
            summary
              ? `${integer.format(summary.totalSuppliers)} suppliers in the portfolio`
              : ""
          }
          loading={loading}
          trend={
            summary
              ? {
                  label: `${summary.onboardingSuppliers} onboarding`,
                  tone: "neutral",
                  direction: "flat",
                }
              : undefined
          }
        />

        <KpiCard
          icon={ShieldAlert}
          warning={highRiskCount > 0}
          label="High-risk suppliers"
          value={summary ? integer.format(highRiskCount) : "—"}
          note={
            summary
              ? `of ${integer.format(summary.totalSuppliers)} suppliers need procurement review`
              : ""
          }
          loading={loading}
          trend={
            summary
              ? highRiskCount > 0
                ? { label: "Needs review", tone: "negative", direction: "down" }
                : { label: "All clear", tone: "positive", direction: "up" }
              : undefined
          }
        />

        <KpiCard
          icon={Truck}
          label="Avg. on-time delivery"
          value={onTimeRate === null ? "—" : `${onTimeRate.toFixed(1)}%`}
          note={
            analyticsSummary
              ? `${integer.format(analyticsSummary.openDeliveryOrders)} open orders · ${integer.format(analyticsSummary.overdueDeliveryOrders)} overdue`
              : "Average tracked supplier performance."
          }
          loading={loading}
          trend={
            onTimeRate === null
              ? undefined
              : onTimeRate >= 90
                ? { label: "On target", tone: "positive", direction: "up" }
                : { label: "Below 90%", tone: "negative", direction: "down" }
          }
        />
      </section>

      {loading || analyticsSummary ? (
        <section className="dash-stats" aria-label="Operational indicators">
          <StatTile
            icon={BadgeDollarSign}
            label="Sourcing savings"
            value={
              analyticsSummary
                ? compactCurrency.format(analyticsSummary.sourcingSavings)
                : "—"
            }
            loading={loading}
          />

          <StatTile
            icon={Gauge}
            label="Avg. procurement cycle"
            value={
              analyticsSummary
                ? `${analyticsSummary.averageProcurementCycleDays.toFixed(1)} days`
                : "—"
            }
            loading={loading}
          />

          <StatTile
            icon={Euro}
            label="Avg. order value"
            value={
              analyticsSummary
                ? compactCurrency.format(analyticsSummary.averageOrderValue)
                : "—"
            }
            loading={loading}
          />

          <StatTile
            icon={PackageSearch}
            label="Open deliveries"
            value={
              analyticsSummary
                ? integer.format(analyticsSummary.openDeliveryOrders)
                : "—"
            }
            hint={
              analyticsSummary
                ? analyticsSummary.overdueDeliveryOrders > 0
                  ? `${integer.format(analyticsSummary.overdueDeliveryOrders)} overdue`
                  : "None overdue"
                : undefined
            }
            danger={(analyticsSummary?.overdueDeliveryOrders ?? 0) > 0}
            loading={loading}
          />
        </section>
      ) : null}

      <section className={`dash-grid${showAttention ? "" : " dash-grid--single"}`}>
        <Panel
          eyebrow="Spend intelligence"
          title="Committed spend trend"
          action={
            <Link className="text-button" href="/analytics">
              View analytics <ArrowRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <Skeleton height={290} />
          ) : trendPoints.length > 0 ? (
            <>
              <div className="trend-summary">
                <div>
                  <span>Last {trendPoints.length} months</span>
                  <strong>{fullCurrency.format(trailingTotal)}</strong>
                </div>

                <div>
                  <span>Monthly average</span>
                  <strong>{compactCurrency.format(monthlyAverage)}</strong>
                </div>
              </div>

              <AreaChart
                points={trendPoints}
                formatValue={(value) => fullCurrency.format(value)}
                formatAxis={(value) => compactCurrency.format(value)}
                ariaLabel="Committed spend by month"
              />
            </>
          ) : (
            <div className="dash-empty">
              {analyticsError
                ? "Spend analytics aren't available for your role."
                : "No committed purchase orders yet."}
            </div>
          )}
        </Panel>

        {showAttention ? (
          <Panel
            eyebrow="Operations"
            title="Needs attention"
            action={
              <Link className="text-button" href="/command-center">
                Open command center <ArrowRight size={12} />
              </Link>
            }
          >
            {loading ? (
              <div className="dash-skeleton-rows">
                <Skeleton height={54} />
                <Skeleton height={54} />
                <Skeleton height={54} />
                <Skeleton height={54} />
              </div>
            ) : attentionActions.length === 0 ? (
              <div className="dash-empty">
                Nothing urgent in the next {ATTENTION_HORIZON_DAYS} days.
              </div>
            ) : (
              <>
                {commandCenter ? (
                  <div className="attention-summary">
                    <span className="attention-chip attention-chip--critical">
                      {commandCenter.summary.criticalActions} critical
                    </span>

                    <span className="attention-chip attention-chip--high">
                      {commandCenter.summary.highActions} high
                    </span>

                    <span className="attention-chip">
                      {commandCenter.summary.overdueActions} overdue
                    </span>
                  </div>
                ) : null}

                <ul className="attention-list">
                  {attentionActions.map((action) => {
                    const due = dueInfo(action);

                    return (
                      <li key={action.id}>
                        <Link href={action.href} className="attention-item">
                          <span
                            className={`attention-item__marker attention-item__marker--${action.severity.toLowerCase()}`}
                            aria-hidden="true"
                          />

                          <span className="attention-item__body">
                            <strong>{action.title}</strong>
                            <p>{action.description}</p>
                          </span>

                          {due ? (
                            <span
                              className={`attention-item__due${due.overdue ? " attention-item__due--overdue" : ""}`}
                            >
                              {due.text}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Panel>
        ) : null}
      </section>

      <section className="dash-grid">
        <Panel
          eyebrow="Spend intelligence"
          title="Where the money goes"
          action={
            availableTabs.length > 1 ? (
              <div className="segmented" role="group" aria-label="Breakdown">
                {availableTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={tab === activeTab}
                    onClick={() => setBreakdownTab(tab)}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {loading ? (
            <div className="dash-skeleton-rows">
              <Skeleton height={30} />
              <Skeleton height={30} />
              <Skeleton height={30} />
              <Skeleton height={30} />
            </div>
          ) : activeTab ? (
            <BarList
              items={breakdownSources[activeTab]}
              formatValue={(value) => fullCurrency.format(value)}
            />
          ) : (
            <div className="dash-empty">Supplier spend will appear here.</div>
          )}
        </Panel>

        <Panel eyebrow="Risk intelligence" title="Supplier risk mix">
          {loading ? (
            <Skeleton height={290} />
          ) : riskView.total > 0 ? (
            <>
              <DonutChart
                slices={riskView.slices}
                centerValue={
                  riskView.mode === "spend"
                    ? compactCurrency.format(riskView.total)
                    : integer.format(riskView.total)
                }
                centerLabel={
                  riskView.mode === "spend" ? "total exposure" : "suppliers"
                }
                formatValue={(value) =>
                  riskView.mode === "spend"
                    ? compactCurrency.format(value)
                    : integer.format(value)
                }
              />
            </>
          ) : (
            <div className="dash-empty">No supplier risk data yet.</div>
          )}
        </Panel>
      </section>

      <section className={`dash-grid${showPipeline ? "" : " dash-grid--single"}`}>
        {showPipeline ? (
          <Panel
            eyebrow="Fulfilment"
            title="Purchase order pipeline"
            action={
              <Link className="text-button" href="/purchase-orders">
                Open purchase orders <ArrowRight size={12} />
              </Link>
            }
          >
            {loading ? (
              <Skeleton height={120} />
            ) : (
              <StackedBar
                segments={pipelineSegments}
                formatValue={(value) => compactCurrency.format(value)}
              />
            )}
          </Panel>
        ) : null}

        <Panel
          eyebrow="Risk intelligence"
          title="Supplier watchlist"
          action={
            <Link className="text-button" href="/suppliers">
              View all <ArrowRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <div className="dash-skeleton-rows">
              <Skeleton height={42} />
              <Skeleton height={42} />
              <Skeleton height={42} />
            </div>
          ) : watchlist.length === 0 ? (
            <div className="dash-empty">
              No high-risk suppliers. The portfolio looks healthy.
            </div>
          ) : (
            <div className="watchlist">
              {watchlist.map((supplier) => (
                <Link
                  key={supplier.id}
                  href={`/suppliers/${supplier.id}`}
                  className="watchlist__item watchlist__item--link"
                >
                  <div className="company-avatar">
                    {initialsOf(supplier.legalName)}
                  </div>

                  <div className="watchlist__content">
                    <strong>{supplier.legalName}</strong>
                    <span>{supplier.category}</span>
                  </div>

                  <span
                    className={`badge badge--${supplier.riskLevel.toLowerCase()}`}
                  >
                    {supplier.riskLevel}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Supplier performance</span>
            <h2>Top suppliers by spend</h2>
          </div>

          <Link className="text-button" href="/suppliers">
            Open supplier portfolio <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="dash-skeleton-rows">
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Skeleton height={20} />
          </div>
        ) : topSuppliers.length === 0 ? (
          <div className="dash-empty">No suppliers yet.</div>
        ) : (
          <div className="table-scroll">
            <SmartTable className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Category</th>
                  <th>Risk</th>
                  <th>Rating</th>
                  <th>Delivery</th>
                  <th>Spend</th>
                </tr>
              </thead>

              <tbody>
                {topSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="supplier-cell">
                        <div className="company-avatar">
                          {initialsOf(supplier.legalName)}
                        </div>

                        <Link href={`/suppliers/${supplier.id}`}>
                          <strong>{supplier.legalName}</strong>
                          <span>{supplier.supplierCode}</span>
                        </Link>
                      </div>
                    </td>

                    <td>{supplier.category}</td>

                    <td>
                      <span
                        className={`badge badge--${supplier.riskLevel.toLowerCase()}`}
                      >
                        {supplier.riskLevel}
                      </span>
                    </td>

                    <td>{supplier.rating?.toFixed(2) ?? "—"}</td>

                    <td>
                      {supplier.onTimeDeliveryRate
                        ? `${supplier.onTimeDeliveryRate.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td>{fullCurrency.format(supplier.totalSpend)}</td>
                  </tr>
                ))}
              </tbody>
            </SmartTable>
          </div>
        )}
      </section>
    </div>
  );
}
