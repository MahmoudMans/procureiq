"use client";

import {
  BadgeDollarSign,
  Banknote,
  CircleAlert,
  Download,
  Gauge,
  Plus,
  RefreshCw,
  SearchX,
  Target,
  TrendingDown,
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
  Meter,
  SearchField,
  SelectField,
  type SelectOption,
  Skeleton,
  StatusBadge,
  downloadCsv,
  formatMoney,
  readable,
  useToast,
} from "@/components/kit";
import {
  discoverSavingsOpportunities,
  getSavingsCategoryAttribution,
  getSavingsInitiatives,
  getSavingsMonthly,
  getSavingsSummary,
  getSavingsSupplierAttribution,
} from "@/lib/api";
import type {
  SavingsAttribution,
  SavingsInitiative,
  SavingsMonthly,
  SavingsSummary,
} from "@/types/savings";

/* ------------------------------------------------------------------ */
/* Constants & data loading                                            */
/* ------------------------------------------------------------------ */

const CURRENT_YEAR = new Date().getUTCFullYear();
const MANAGER_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const YEAR_OPTIONS: SelectOption[] = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(
  (year) => ({ value: String(year), label: String(year) }),
);

const CURRENCY_OPTIONS: SelectOption[] = ["EUR", "USD", "GBP", "TND"].map((code) => ({
  value: code,
  label: code,
}));

const EMPTY_INITIATIVES: SavingsInitiative[] = [];
const EMPTY_MONTHLY: SavingsMonthly[] = [];
const EMPTY_ATTRIBUTION: SavingsAttribution[] = [];

interface SavingsData {
  key: string;
  summary: SavingsSummary | null;
  initiatives: SavingsInitiative[] | null;
  monthly: SavingsMonthly[];
  suppliers: SavingsAttribution[];
  categories: SavingsAttribution[];
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
    : "Unable to load savings intelligence.";
}

async function fetchSavings(
  fiscalYear: number,
  currency: string,
): Promise<{ data: SavingsData; error: string | null }> {
  const [summaryR, initiativesR, monthlyR, suppliersR, categoriesR] =
    await Promise.allSettled([
      getSavingsSummary(fiscalYear, currency),
      getSavingsInitiatives(fiscalYear, currency),
      getSavingsMonthly(fiscalYear, currency),
      getSavingsSupplierAttribution(fiscalYear, currency),
      getSavingsCategoryAttribution(fiscalYear, currency),
    ]);

  return {
    data: {
      key: `${fiscalYear}|${currency}`,
      summary: valueOf<SavingsSummary | null>(summaryR, null),
      initiatives: valueOf<SavingsInitiative[] | null>(initiativesR, null),
      monthly: valueOf<SavingsMonthly[]>(monthlyR, EMPTY_MONTHLY),
      suppliers: valueOf<SavingsAttribution[]>(suppliersR, EMPTY_ATTRIBUTION),
      categories: valueOf<SavingsAttribution[]>(categoriesR, EMPTY_ATTRIBUTION),
    },
    error:
      messageOf(summaryR) ??
      messageOf(initiativesR) ??
      messageOf(monthlyR) ??
      messageOf(suppliersR) ??
      messageOf(categoriesR),
  };
}

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

const COLUMNS: Column<SavingsInitiative>[] = [
  {
    id: "initiative",
    header: "Initiative",
    sortValue: (initiative) => initiative.savingsNumber,
    cell: (initiative) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/savings/${initiative.id}`} className="supplier-360-link">
            {initiative.savingsNumber}
          </Link>
        </strong>

        <span>{initiative.title}</span>
      </div>
    ),
  },
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (initiative) => (initiative.supplierName ?? "").toLowerCase(),
    cell: (initiative) => initiative.supplierName ?? "—",
  },
  {
    id: "type",
    header: "Type",
    sortValue: (initiative) => initiative.savingsType,
    cell: (initiative) => readable(initiative.savingsType),
  },
  {
    id: "target",
    header: "Target",
    align: "right",
    sortValue: (initiative) => initiative.targetSavings,
    firstSort: "desc",
    cell: (initiative) => (
      <span className="kit-num">
        {formatMoney(initiative.targetSavings, initiative.currency)}
      </span>
    ),
  },
  {
    id: "realized",
    header: "Realized",
    align: "right",
    sortValue: (initiative) => initiative.realizedSavings,
    firstSort: "desc",
    cell: (initiative) => (
      <strong className="kit-num kit-text-success">
        {formatMoney(initiative.realizedSavings, initiative.currency)}
      </strong>
    ),
  },
  {
    id: "rate",
    header: "Rate",
    sortValue: (initiative) => initiative.realizationRate,
    firstSort: "desc",
    cell: (initiative) => (
      <Meter
        value={initiative.realizationRate}
        max={100}
        label={`${initiative.realizationRate.toFixed(1)}%`}
        tone={initiative.realizationRate >= 100 ? "success" : "primary"}
        ariaLabel="Realization rate"
      />
    ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (initiative) => initiative.status,
    cell: (initiative) => <StatusBadge value={initiative.status} />,
  },
  {
    id: "owner",
    header: "Owner",
    sortValue: (initiative) => initiative.ownerName.toLowerCase(),
    cell: (initiative) => initiative.ownerName,
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (initiative) => (
      <Link href={`/savings/${initiative.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SavingsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGER_ROLES.includes(user.role);

  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);
  const [currency, setCurrency] = useState("EUR");
  const [result, setResult] = useState<SavingsData | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fetching, setFetching] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      const response = await fetchSavings(fiscalYear, currency);

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
  const initiatives = data?.initiatives ?? null;
  const monthly = data?.monthly ?? EMPTY_MONTHLY;

  const maxMonthly = useMemo(
    () => Math.max(1, ...monthly.map((item) => item.realizedSavings)),
    [monthly],
  );

  const statusOptions = useMemo<SelectOption[]>(() => {
    const unique = Array.from(
      new Set((initiatives ?? EMPTY_INITIATIVES).map((item) => item.status)),
    ).sort();

    return [
      { value: "", label: "All" },
      ...unique.map((value) => ({ value, label: readable(value) })),
    ];
  }, [initiatives]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (initiatives ?? EMPTY_INITIATIVES)
      .filter((item) => !status || item.status === status)
      .filter(
        (item) =>
          !normalized ||
          [item.savingsNumber, item.title, item.supplierName ?? "", item.ownerName]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [initiatives, query, status]);

  const hasFilters = query.trim() !== "" || status !== "";

  function clearFilters() {
    setQuery("");
    setStatus("");
  }

  async function discover() {
    setDiscovering(true);

    try {
      const outcome = await discoverSavingsOpportunities();

      toast.success(
        "Awards discovered",
        `${outcome.discoveredOpportunities} opportunities · ${outcome.createdInitiatives} created · ${outcome.updatedInitiatives} updated · ${outcome.createdRealizations} PO realizations created`,
      );

      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(
        "Could not discover awards",
        caught instanceof Error ? caught.message : "Unable to discover sourcing savings.",
      );
    } finally {
      setDiscovering(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-savings-${fiscalYear}-${currency}.csv`,
      [
        "Savings number",
        "Title",
        "Supplier",
        "Type",
        "Currency",
        "Target savings",
        "Realized savings",
        "Realization rate (%)",
        "Status",
        "Owner",
      ],
      rows.map((item) => [
        item.savingsNumber,
        item.title,
        item.supplierName ?? "",
        item.savingsType,
        item.currency,
        item.targetSavings,
        item.realizedSavings,
        item.realizationRate.toFixed(1),
        item.status,
        item.ownerName,
      ]),
    );

    toast.success(
      "Initiatives exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const kpis: KpiItem[] = [
    {
      label: "Validated target",
      icon: Target,
      value: summary ? formatMoney(summary.validatedTargetSavings, currency, true) : "—",
      note: `${summary?.validatedInitiatives ?? 0} validated initiatives`,
    },
    {
      label: "Realized savings",
      icon: Banknote,
      value: summary ? formatMoney(summary.realizedSavings, currency, true) : "—",
      note: "Value recorded against validated initiatives.",
    },
    {
      label: "Realization rate",
      icon: Gauge,
      value: summary ? `${summary.realizationRate.toFixed(1)}%` : "—",
      note: `${summary?.pendingInitiatives ?? 0} pending validation`,
    },
    {
      label: "Remaining opportunity",
      icon: TrendingDown,
      value: summary ? formatMoney(summary.remainingSavings, currency, true) : "—",
      note: "Validated target not yet realized.",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No initiatives match these filters"
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
      icon={BadgeDollarSign}
      title={`No savings initiatives for ${fiscalYear}`}
      description="Discover awards to create initiatives from sourcing decisions, or add one manually."
      action={
        canManage ? (
          <Link href="/savings/new" className="button button--primary">
            <Plus size={16} />
            New initiative
          </Link>
        ) : undefined
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Value realization</span>

          <h1>Savings &amp; value</h1>

          <p>
            Discover sourcing savings, validate procurement value, track PO
            realization and attribute value to suppliers and spend categories.
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
            <>
              <button
                type="button"
                className="button button--secondary"
                disabled={discovering}
                onClick={() => void discover()}
              >
                <RefreshCw size={15} className={discovering ? "kit-spin" : undefined} />
                {discovering ? "Discovering…" : "Discover awards"}
              </button>

              <Link href="/savings/new" className="button button--primary">
                <Plus size={16} />
                New initiative
              </Link>
            </>
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
        ariaLabel="Savings totals"
      />

      <section className="savings-main-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Realization trend</span>

              <h2>Monthly realized savings</h2>
            </div>

            <BadgeDollarSign size={19} />
          </div>

          {data === null ? (
            <Skeleton height={150} />
          ) : monthly.length === 0 ? (
            <EmptyState
              compact
              icon={BadgeDollarSign}
              title="No realized savings yet"
              description="Nothing has been recorded for this period."
            />
          ) : (
            <div className="savings-month-list">
              {monthly.map((item) => (
                <article key={item.month} className="savings-month-row">
                  <div>
                    <strong>{monthLabel(item.month)}</strong>

                    <span>{item.realizationCount} entries</span>
                  </div>

                  <div className="savings-bar-track">
                    <div
                      style={{
                        width: `${Math.max(3, (item.realizedSavings / maxMonthly) * 100)}%`,
                      }}
                    />
                  </div>

                  <strong>{formatMoney(item.realizedSavings, currency, true)}</strong>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Value classification</span>

              <h2>Savings mix</h2>
            </div>
          </div>

          <div className="savings-mix-grid">
            <article>
              <span>Hard savings</span>

              <strong>
                {summary ? formatMoney(summary.hardSavings, currency, true) : "—"}
              </strong>

              <p>
                Realized commercial reductions backed by validated procurement
                initiatives.
              </p>
            </article>

            <article>
              <span>Cost avoidance</span>

              <strong>
                {summary ? formatMoney(summary.costAvoidance, currency, true) : "—"}
              </strong>

              <p>Validated avoided future expenditure.</p>
            </article>
          </div>
        </section>
      </section>

      <section className="savings-attribution-grid">
        <AttributionPanel
          eyebrow="Supplier value"
          title="Supplier attribution"
          rows={data?.suppliers ?? EMPTY_ATTRIBUTION}
          currency={currency}
          loading={data === null}
        />

        <AttributionPanel
          eyebrow="Category value"
          title="Category attribution"
          rows={data?.categories ?? EMPTY_ATTRIBUTION}
          currency={currency}
          loading={data === null}
        />
      </section>

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search initiative, supplier or owner"
          ariaLabel="Search savings initiatives"
          shortcut
        />

        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          options={statusOptions}
        />
      </div>

      {data !== null && data.initiatives === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(item) => item.id}
          ariaLabel="Savings initiatives"
          loading={data === null}
          busy={fetching}
          empty={emptyNode}
          defaultSort={{ id: "realized", dir: "desc" }}
          persistKey="savings"
          resetKey={`${query}|${status}|${fiscalYear}|${currency}`}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attribution panel                                                   */
/* ------------------------------------------------------------------ */

interface AttributionPanelProps {
  eyebrow: string;
  title: string;
  rows: SavingsAttribution[];
  currency: string;
  loading: boolean;
}

function AttributionPanel({
  eyebrow,
  title,
  rows,
  currency,
  loading,
}: AttributionPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">{eyebrow}</span>

          <h2>{title}</h2>
        </div>
      </div>

      {loading ? (
        <Skeleton height={150} />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={BadgeDollarSign}
          title="No attribution yet"
          description="Validated initiatives will appear here."
        />
      ) : (
        <div className="savings-attribution-list">
          {rows.slice(0, 8).map((row) => (
            <article key={row.label} className="savings-attribution-row">
              <div>
                <strong>{row.label}</strong>

                <span>{row.initiativeCount} initiatives</span>
              </div>

              <div>
                <span>Target</span>

                <strong>{formatMoney(row.targetSavings, currency, true)}</strong>
              </div>

              <div>
                <span>Realized</span>

                <strong>{formatMoney(row.realizedSavings, currency, true)}</strong>
              </div>

              <div>
                <span>Rate</span>

                <strong>{row.realizationRate.toFixed(1)}%</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
