"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Info,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  Meter,
  type MeterTone,
  Skeleton,
  StatusBadge,
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { getInvestmentPerformanceSnapshot } from "@/lib/api";
import type { InvestmentPerformanceSnapshotDetail } from "@/types/investment-performance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = InvestmentPerformanceSnapshotDetail["items"][number];

function money(value: number, currency?: string | null): string {
  const text = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return currency ? `${text} ${currency}` : text;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Assessed cases first, lowest ROI variance first; unassessed cases last. */
function byRoiVariance(a: SnapshotItem, b: SnapshotItem): number {
  if (a.assessed !== b.assessed) {
    return a.assessed ? -1 : 1;
  }

  return a.roiVariancePct - b.roiVariancePct;
}

/** Downloads rows as a CSV file. Text that could be read as a formula is neutralised. */
function downloadRows(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const cell = (value: string | number): string => {
    const text =
      typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : String(value);

    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  const body = [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Dash() {
  return <span className="kit-text-muted">—</span>;
}

function ProgressLine({
  pct,
  tone,
  caption,
  label,
}: {
  pct: number;
  tone: MeterTone;
  caption: string;
  label: string;
}) {
  return (
    <div className="kit-meter-wrap">
      <Meter value={clampPercent(pct)} max={100} tone={tone} ariaLabel={label} />

      <span className="kit-meter-caption">{caption}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildItemColumns(): Column<SnapshotItem>[] {
  return [
    {
      id: "case",
      header: "Case",
      sortValue: (item) => String(item.initiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.initiativeTitle}</strong>

          <small>{item.performanceCaseNumber}</small>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.caseStatus),
      cell: (item) => (
        <StatusBadge value={String(item.caseStatus)} label={readable(String(item.caseStatus))} />
      ),
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.health),
      cell: (item) => (
        <StatusBadge value={String(item.health)} label={readable(String(item.health))} />
      ),
    },
    {
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.releasedCapitalAmount,
      cell: (item) => money(item.releasedCapitalAmount, item.currency),
    },
    {
      id: "baselineInvestment",
      header: "Baseline investment",
      align: "right",
      sortValue: (item) => item.baselineInvestmentCostAmount,
      cell: (item) => money(item.baselineInvestmentCostAmount, item.currency),
    },
    {
      id: "baselineRoi",
      header: "Baseline ROI",
      align: "right",
      sortValue: (item) => item.baselineRoiPct,
      cell: (item) => `${item.baselineRoiPct.toFixed(1)}%`,
    },
    {
      id: "realizedRoi",
      header: "Realized ROI",
      align: "right",
      sortValue: (item) => (item.assessed ? item.realizedRoiPct : null),
      cell: (item) =>
        item.assessed ? (
          <span className={item.realizedRoiPct < 0 ? "kit-text-danger" : undefined}>
            {item.realizedRoiPct.toFixed(1)}%
          </span>
        ) : (
          <Dash />
        ),
    },
    {
      id: "roiVariance",
      header: "ROI variance",
      align: "right",
      sortValue: (item) => (item.assessed ? item.roiVariancePct : null),
      cell: (item) =>
        item.assessed ? (
          <strong className={item.roiVariancePct < 0 ? "kit-text-warning" : undefined}>
            {item.roiVariancePct.toFixed(1)} pts
          </strong>
        ) : (
          <Dash />
        ),
    },
    {
      id: "fundingVariance",
      header: "Funding variance",
      align: "right",
      sortValue: (item) => (item.assessed ? item.fundingVariancePct : null),
      cell: (item) => (item.assessed ? `${item.fundingVariancePct.toFixed(1)}%` : <Dash />),
    },
    {
      id: "efficiency",
      header: "Efficiency",
      align: "right",
      sortValue: (item) => (item.assessed ? item.capitalEfficiencyMultiple : null),
      cell: (item) =>
        item.assessed ? `${item.capitalEfficiencyMultiple.toFixed(2)}x` : <Dash />,
    },
    {
      id: "valueVariance",
      header: "Value variance",
      align: "right",
      sortValue: (item) => (item.assessed ? item.valueVarianceAmount : null),
      cell: (item) =>
        item.assessed ? money(item.valueVarianceAmount, item.currency) : <Dash />,
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link
          href={`/investment-performance/${encodeURIComponent(String(item.performanceCaseId))}`}
          className="table-action"
        >
          Open case
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: InvestmentPerformanceSnapshotDetail;
}

export default function InvestmentPerformanceSnapshotPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const [result, setResult] = useState<SnapshotData | null>(null);
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
        const response = await getInvestmentPerformanceSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load investment-performance snapshot.",
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

  const data = result !== null && result.id === params.id ? result : null;
  const detail = data?.detail ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  if (detail === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/investment-performance" className="request-back-link">
          <ArrowLeft size={16} />
          Investment performance
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { snapshot, items } = detail;
  const hasItems = items.length > 0;
  const totalCases = items.length;
  const assessedCount = snapshot.assessedCaseCount;
  const underperforming = snapshot.underperformingCaseCount;
  const unassessed = items.filter((item) => !item.assessed);
  const assessedShare = totalCases > 0 ? (assessedCount / totalCases) * 100 : 0;
  const performingCount = Math.max(0, totalCases - underperforming);

  const orderedItems = [...items].sort(byRoiVariance);
  const first = orderedItems.length > 0 ? orderedItems[0] : null;
  const weakest = first !== null && first.assessed && first.roiVariancePct < 0 ? first : null;

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-performance.csv`,
      [
        "Case",
        "Performance case number",
        "Status",
        "Health",
        "Released",
        "Baseline investment",
        "Baseline ROI %",
        "Assessed",
        "Realized ROI %",
        "ROI variance pts",
        "Funding variance %",
        "Efficiency multiple",
        "Value variance",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.initiativeTitle),
        String(item.performanceCaseNumber),
        readable(String(item.caseStatus)),
        readable(String(item.health)),
        item.releasedCapitalAmount,
        item.baselineInvestmentCostAmount,
        item.baselineRoiPct,
        item.assessed ? "Yes" : "No",
        item.assessed ? item.realizedRoiPct : "",
        item.assessed ? item.roiVariancePct : "",
        item.assessed ? item.fundingVariancePct : "",
        item.assessed ? item.capitalEfficiencyMultiple : "",
        item.assessed ? item.valueVarianceAmount : "",
        String(item.currency ?? ""),
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "case", "cases"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Realized ROI",
      icon: TrendingUp,
      value: `${snapshot.averageRealizedRoiPct.toFixed(1)}%`,
      note: "Portfolio average",
    },
    {
      label: "ROI variance",
      icon: Scale,
      value: `${snapshot.averageRoiVariancePct.toFixed(1)} pts`,
      note: "Against baseline ROI",
      tone: snapshot.averageRoiVariancePct < 0 ? "warning" : "default",
    },
    {
      label: "Funding variance",
      icon: Coins,
      value: `${snapshot.averageFundingVariancePct.toFixed(1)}%`,
      note: "Portfolio average",
    },
    {
      label: "Capital efficiency",
      icon: Gauge,
      value: `${snapshot.averageCapitalEfficiencyMultiple.toFixed(2)}x`,
      note: "Portfolio average",
    },
    {
      label: "Assessed",
      icon: BadgeCheck,
      value: String(assessedCount),
      note: `Of ${plural(totalCases, "case", "cases")}`,
    },
    {
      label: "Underperforming",
      icon: TrendingDown,
      value: String(underperforming),
      note: "Cases below plan",
      tone: underperforming > 0 ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/investment-performance" className="request-back-link">
        <ArrowLeft size={16} />
        Investment performance
      </Link>

      <section className="investment-performance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable investment-performance snapshot</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            Captured by {snapshot.capturedByName ?? "Procurement management"}
            {snapshot.capturedAt ? ` · ${formatDateTime(snapshot.capturedAt)}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportItems}
            disabled={!hasItems}
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

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {underperforming > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(underperforming, "case was", "cases were")} underperforming at capture.
            </strong>
            {weakest !== null
              ? ` The largest ROI shortfall was ${weakest.initiativeTitle} at ${weakest.roiVariancePct.toFixed(1)} pts.`
              : ""}
          </div>
        </div>
      ) : null}

      {unassessed.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(unassessed.length, "case had", "cases had")} not been assessed yet.
            </strong>{" "}
            Realized figures show a dash for {unassessed.length === 1 ? "it" : "them"}, and{" "}
            {unassessed.length === 1 ? "it sorts" : "they sort"} last.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no cases.</strong> There was no investment portfolio
            when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Investment performance snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Assessment at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={assessedShare}
            tone={assessedShare >= 100 ? meterToneFor("success") : "primary"}
            caption={`${assessedCount} of ${plural(totalCases, "case", "cases")} assessed`}
            label="Assessed cases"
          />

          <ProgressLine
            pct={(performingCount / totalCases) * 100}
            tone={underperforming === 0 ? meterToneFor("success") : "primary"}
            caption={`${performingCount} of ${plural(totalCases, "case", "cases")} were not underperforming`}
            label="Cases not underperforming"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen realized economics</span>

            <h2>Investment portfolio at capture time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Lowest ROI variance first, across {plural(items.length, "case", "cases")}. Amounts show
            the currency of each case. Open case shows the live record, which may have changed
            since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.performanceCaseId)}
          ariaLabel="Frozen investment portfolio"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No cases captured"
              description="This snapshot has no investment cases."
            />
          }
        />
      </section>

      <section className="investment-performance-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable post-funding performance evidence</strong>

          <p>
            The snapshot freezes realized ROI, funding variance, capital efficiency, value
            variance and health without modifying the Step 56 investment case or Step 58 funding
            evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
