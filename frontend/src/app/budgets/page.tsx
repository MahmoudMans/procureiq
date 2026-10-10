"use client";

import {
  Banknote,
  CircleAlert,
  Download,
  Gauge,
  Landmark,
  Plus,
  RefreshCw,
  SearchCheck,
  SearchX,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  Meter,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  SelectField,
  type SelectOption,
  StatusBadge,
  downloadCsv,
  formatMoney,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import {
  checkPurchaseRequestBudget,
  getBudgetAlerts,
  getBudgetContextOptions,
  getBudgetSummary,
  getBudgetUsage,
} from "@/lib/api";
import type {
  BudgetAlert,
  BudgetContextOptions,
  BudgetSummary,
  BudgetUsage,
  PurchaseRequestBudgetCheck,
} from "@/types/budget";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const CURRENT_YEAR = new Date().getUTCFullYear();
const MANAGER_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const ALERTS_COLLAPSED = 5;

const YEAR_OPTIONS: SelectOption[] = [
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
  CURRENT_YEAR + 2,
].map((year) => ({ value: String(year), label: String(year) }));

const CURRENCY_OPTIONS: SelectOption[] = ["EUR", "USD", "GBP", "TND"].map((code) => ({
  value: code,
  label: code,
}));

const SCOPE_FILTERS: SegmentedOption[] = [
  { value: "", label: "All" },
  { value: "DEPARTMENT", label: "Department" },
  { value: "CATEGORY", label: "Category" },
];

const EMPTY_USAGE: BudgetUsage[] = [];
const EMPTY_ALERTS: BudgetAlert[] = [];
const EMPTY_REQUESTS: BudgetContextOptions["purchaseRequests"] = [];
const integer = new Intl.NumberFormat("en-US");

/** Alert levels are free text from the API, so colour them by what they say. */
function levelTone(level: string): BadgeTone {
  const value = level.toUpperCase();

  if (value.includes("EXCEED") || value.includes("CRITICAL") || value.includes("BLOCK")) {
    return "danger";
  }

  if (value.includes("WARN")) {
    return "warning";
  }

  return "success";
}

function levelRank(level: string): number {
  const tone = levelTone(level);

  return tone === "danger" ? 2 : tone === "warning" ? 1 : 0;
}

interface BudgetData {
  key: string;
  summary: BudgetSummary | null;
  usage: BudgetUsage[] | null;
  alerts: BudgetAlert[];
  options: BudgetContextOptions | null;
}

function valueOf<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function messageOf(result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== "rejected") {
    return null;
  }

  return result.reason instanceof Error
    ? result.reason.message
    : "Unable to load budget control.";
}

async function fetchBudgets(
  fiscalYear: number,
  currency: string,
): Promise<{ data: BudgetData; error: string | null }> {
  const [summaryR, usageR, alertsR, optionsR] = await Promise.allSettled([
    getBudgetSummary(fiscalYear, currency),
    getBudgetUsage(fiscalYear, currency),
    getBudgetAlerts(fiscalYear, currency),
    getBudgetContextOptions(),
  ]);

  return {
    data: {
      key: `${fiscalYear}|${currency}`,
      summary: valueOf<BudgetSummary | null>(summaryR, null),
      usage: valueOf<BudgetUsage[] | null>(usageR, null),
      alerts: valueOf<BudgetAlert[]>(alertsR, EMPTY_ALERTS),
      options: valueOf<BudgetContextOptions | null>(optionsR, null),
    },
    error: messageOf(summaryR) ?? messageOf(usageR) ?? messageOf(alertsR) ?? messageOf(optionsR),
  };
}

const COLUMNS: Column<BudgetUsage>[] = [
  {
    id: "allocation",
    header: "Allocation",
    sortValue: (item) => item.scopeLabel.toLowerCase(),
    cell: (item) => (
      <div className="stacked-cell">
        <strong>{item.scopeLabel}</strong>

        <span>
          {item.scopeType === "DEPARTMENT" ? "Department" : "Category"} ·{" "}
          {item.hardLimit ? "Hard limit" : "Soft limit"}
        </span>
      </div>
    ),
  },
  {
    id: "budget",
    header: "Budget",
    align: "right",
    sortValue: (item) => item.budgetAmount,
    firstSort: "desc",
    cell: (item) => (
      <strong className="kit-num">{formatMoney(item.budgetAmount, item.currency)}</strong>
    ),
  },
  {
    id: "committed",
    header: "Committed",
    align: "right",
    sortValue: (item) => item.committedSpend,
    firstSort: "desc",
    cell: (item) => (
      <span className="kit-num">{formatMoney(item.committedSpend, item.currency)}</span>
    ),
  },
  {
    id: "pipeline",
    header: "Pipeline",
    align: "right",
    sortValue: (item) => item.openRequestExposure,
    firstSort: "desc",
    cell: (item) => (
      <span className="kit-num">
        {formatMoney(item.openRequestExposure, item.currency)}
      </span>
    ),
  },
  {
    id: "forecast",
    header: "Forecast utilization",
    sortValue: (item) => item.forecastUtilizationPercent,
    firstSort: "desc",
    cell: (item) => {
      const tone = levelTone(item.alertLevel);

      return (
        <Meter
          value={item.forecastUtilizationPercent}
          max={100}
          label={`${item.forecastUtilizationPercent.toFixed(1)}%`}
          tone={tone === "success" ? "primary" : meterToneFor(tone)}
          ariaLabel="Forecast utilization"
        />
      );
    },
  },
  {
    id: "remaining",
    header: "Remaining",
    align: "right",
    sortValue: (item) => item.remainingForecast,
    cell: (item) => (
      <span className={`kit-num${item.remainingForecast < 0 ? " kit-text-danger" : ""}`}>
        {formatMoney(item.remainingForecast, item.currency)}
      </span>
    ),
  },
  {
    id: "level",
    header: "Status",
    sortValue: (item) => levelRank(item.alertLevel),
    firstSort: "desc",
    cell: (item) => (
      <div className="kit-cell-stack">
        <StatusBadge value={item.alertLevel} tone={levelTone(item.alertLevel)} />

        <small>Warns at {item.warningThresholdPercent.toFixed(0)}%</small>
      </div>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function BudgetsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGER_ROLES.includes(user.role);

  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);
  const [currency, setCurrency] = useState("EUR");
  const [result, setResult] = useState<BudgetData | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("");
  const [level, setLevel] = useState("");
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [requestCheck, setRequestCheck] = useState<PurchaseRequestBudgetCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      const response = await fetchBudgets(fiscalYear, currency);

      if (!active) {
        return;
      }

      setResult(response.data);
      setError(response.error);
      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [fiscalYear, currency, reloadKey]);

  // Figures are only shown once they belong to the selected year and currency.
  const data = result !== null && result.key === `${fiscalYear}|${currency}` ? result : null;

  const summary = data?.summary ?? null;
  const usage = data?.usage ?? null;
  const alerts = data?.alerts ?? EMPTY_ALERTS;

  // The request list does not depend on year or currency, so it survives switching.
  const requests = result?.options?.purchaseRequests ?? EMPTY_REQUESTS;

  const requestOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Select request" },
      ...requests.map((request) => ({
        value: String(request.id),
        label: `${request.requestNumber} — ${request.title}`,
      })),
    ],
    [requests],
  );

  const levelOptions = useMemo<SelectOption[]>(() => {
    const unique = Array.from(
      new Set((usage ?? EMPTY_USAGE).map((item) => item.alertLevel)),
    ).sort();

    return [
      { value: "", label: "All" },
      ...unique.map((value) => ({ value, label: readable(value) })),
    ];
  }, [usage]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (usage ?? EMPTY_USAGE)
      .filter((item) => !scope || item.scopeType === scope)
      .filter((item) => !level || item.alertLevel === level)
      .filter((item) => !normalized || item.scopeLabel.toLowerCase().includes(normalized));
  }, [usage, query, scope, level]);

  const hasFilters = query.trim() !== "" || scope !== "" || level !== "";
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, ALERTS_COLLAPSED);

  function clearFilters() {
    setQuery("");
    setScope("");
    setLevel("");
  }

  async function runBudgetCheck() {
    if (!requestId) {
      return;
    }

    setChecking(true);

    try {
      setRequestCheck(await checkPurchaseRequestBudget(requestId));
    } catch (caught) {
      toast.error(
        "Could not check the budget",
        caught instanceof Error
          ? caught.message
          : "Unable to evaluate purchase request budget.",
      );
    } finally {
      setChecking(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-budgets-${fiscalYear}-${currency}.csv`,
      [
        "Allocation",
        "Scope",
        "Limit type",
        "Currency",
        "Budget",
        "Committed",
        "Open request exposure",
        "Forecast utilization (%)",
        "Remaining forecast",
        "Warning threshold (%)",
        "Alert level",
      ],
      rows.map((item) => [
        item.scopeLabel,
        item.scopeType,
        item.hardLimit ? "Hard" : "Soft",
        item.currency,
        item.budgetAmount,
        item.committedSpend,
        item.openRequestExposure,
        item.forecastUtilizationPercent.toFixed(1),
        item.remainingForecast,
        item.warningThresholdPercent,
        item.alertLevel,
      ]),
    );

    toast.success(
      "Budgets exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const exceeded = summary?.exceededAllocations ?? 0;
  const warnings = summary?.warningAllocations ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Total budget",
      icon: WalletCards,
      value: summary ? formatMoney(summary.totalBudget, currency, true) : "—",
      note: `${integer.format(summary?.activeAllocations ?? 0)} active allocations`,
    },
    {
      label: "Committed",
      icon: Banknote,
      value: summary ? formatMoney(summary.committedSpend, currency, true) : "—",
      note: `${(summary?.utilizationPercent ?? 0).toFixed(1)}% utilization`,
    },
    {
      label: "Open exposure",
      icon: Landmark,
      value: summary ? formatMoney(summary.openRequestExposure, currency, true) : "—",
      note: "Submitted and approved requests not yet committed.",
    },
    {
      label: "Forecast utilization",
      icon: Gauge,
      value: summary ? `${summary.forecastUtilizationPercent.toFixed(1)}%` : "—",
      note: `${integer.format(exceeded)} exceeded · ${integer.format(warnings)} warning`,
      tone: exceeded > 0 ? "warning" : "default",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No allocations match these filters"
      description="Try a different search term, scope or status, or clear the filters."
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
      icon={WalletCards}
      title={`No active allocations for ${fiscalYear}`}
      description={`No department or category budgets exist for ${fiscalYear} in ${currency}.`}
      action={
        canManage ? (
          <Link href="/budgets/new" className="button button--primary">
            <Plus size={16} />
            New allocation
          </Link>
        ) : undefined
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procurement planning</span>

          <h1>Budget control</h1>

          <p>
            Track approved budgets, committed spend, open procurement exposure,
            forecast utilization and request-level budget impact.
          </p>
        </div>

        <div className="page-heading__actions">
          <SelectField
            label="Fiscal year"
            value={String(fiscalYear)}
            onChange={(value) => setFiscalYear(Number(value))}
            options={YEAR_OPTIONS}
          />

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

          {canManage ? (
            <Link href="/budgets/new" className="button button--primary">
              <Plus size={16} />
              New allocation
            </Link>
          ) : null}
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

      <KpiGrid
        items={kpis}
        loading={data === null && error === null}
        ariaLabel="Budget totals"
      />

      {alerts.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Budget alerts</span>

              <h2>Forecast exceptions</h2>
            </div>

            <span className="kit-count-pill">{alerts.length}</span>
          </div>

          <div className="budget-alert-list">
            {visibleAlerts.map((alert) => (
              <article
                key={alert.allocationId}
                className={`budget-alert budget-alert--${alert.alertLevel.toLowerCase()}`}
              >
                <div>
                  <strong>{alert.scopeLabel}</strong>

                  <span>{alert.message}</span>
                </div>

                <div>
                  <strong>{alert.forecastUtilizationPercent.toFixed(1)}%</strong>

                  <span>{alert.hardLimit ? "Hard limit" : "Soft limit"}</span>
                </div>
              </article>
            ))}
          </div>

          {alerts.length > ALERTS_COLLAPSED ? (
            <div className="kit-panel-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setShowAllAlerts((open) => !open)}
              >
                {showAllAlerts ? "Show fewer" : `Show all ${alerts.length} alerts`}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search department or category"
          ariaLabel="Search allocations"
          shortcut
        />

        <SegmentedFilter
          options={SCOPE_FILTERS}
          value={scope}
          onChange={setScope}
          ariaLabel="Filter by allocation scope"
        />

        <SelectField
          label="Status"
          value={level}
          onChange={setLevel}
          options={levelOptions}
        />
      </div>

      {data !== null && usage === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(item) => item.allocationId}
          ariaLabel="Budget allocations"
          loading={data === null}
          busy={fetching}
          empty={emptyNode}
          defaultSort={{ id: "forecast", dir: "desc" }}
          persistKey="budgets"
          resetKey={`${query}|${scope}|${level}|${fiscalYear}|${currency}`}
        />
      )}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Purchase-request gate</span>

            <h2>Budget impact check</h2>
          </div>

          <SearchCheck size={19} />
        </div>

        <div className="budget-check-controls">
          <SelectField
            label="Purchase request"
            value={requestId}
            onChange={(value) => {
              setRequestId(value);
              setRequestCheck(null);
            }}
            options={requestOptions}
          />

          <button
            type="button"
            className="button button--primary"
            disabled={checking || !requestId}
            onClick={() => void runBudgetCheck()}
          >
            <SearchCheck size={16} />
            {checking ? "Checking…" : "Check budget"}
          </button>
        </div>

        {requestCheck ? (
          <article
            className={`budget-check-result budget-check-result--${requestCheck.alertLevel.toLowerCase()}`}
          >
            <div className="budget-check-result__header">
              <div>
                <strong>{requestCheck.requestNumber}</strong>

                <span>
                  {requestCheck.departmentName} ·{" "}
                  {formatMoney(requestCheck.requestAmount, requestCheck.currency)}
                </span>
              </div>

              <StatusBadge
                value={requestCheck.blocked ? "BLOCKED" : requestCheck.alertLevel}
                tone={requestCheck.blocked ? "danger" : levelTone(requestCheck.alertLevel)}
              />
            </div>

            <p>{requestCheck.message}</p>

            {requestCheck.budgetConfigured ? (
              <div className="budget-check-metrics">
                {[
                  {
                    label: "Budget",
                    value: formatMoney(requestCheck.budgetAmount, requestCheck.currency),
                  },
                  {
                    label: "Current forecast",
                    value: formatMoney(
                      requestCheck.currentForecastExposure,
                      requestCheck.currency,
                    ),
                  },
                  {
                    label: "Projected",
                    value: formatMoney(
                      requestCheck.projectedForecastExposure,
                      requestCheck.currency,
                    ),
                  },
                  {
                    label: "Remaining",
                    value: formatMoney(
                      requestCheck.remainingAfterRequest,
                      requestCheck.currency,
                    ),
                  },
                  {
                    label: "Utilization",
                    value: `${requestCheck.projectedUtilizationPercent.toFixed(1)}%`,
                  },
                ].map((metric) => (
                  <div key={metric.label}>
                    <span>{metric.label}</span>

                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    </div>
  );
}
