"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Info,
  Layers,
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
import { getReinvestmentPerformanceSnapshot } from "@/lib/api";
import type { ReinvestmentPerformanceSnapshotDetail } from "@/types/reinvestment-performance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = ReinvestmentPerformanceSnapshotDetail["items"][number];

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
      id: "target",
      header: "Target",
      sortValue: (item) => String(item.targetInitiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.targetInitiativeTitle}</strong>

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
      id: "capital",
      header: "Capital",
      align: "right",
      sortValue: (item) => item.redeployedCapitalAmount,
      cell: (item) => money(item.redeployedCapitalAmount, item.currency),
    },
    {
      id: "expected",
      header: "Expected value",
      align: "right",
      sortValue: (item) => (item.assessed ? item.expectedHorizonValueAmount : null),
      cell: (item) =>
        item.assessed ? money(item.expectedHorizonValueAmount, item.currency) : <Dash />,
    },
    {
      id: "realized",
      header: "Realized value",
      align: "right",
      sortValue: (item) => (item.assessed ? item.realizedHorizonValueAmount : null),
      cell: (item) =>
        item.assessed ? money(item.realizedHorizonValueAmount, item.currency) : <Dash />,
    },
    {
      id: "net",
      header: "Net value",
      align: "right",
      sortValue: (item) => (item.assessed ? item.realizedNetValueAmount : null),
      cell: (item) =>
        item.assessed ? (
          <strong className={item.realizedNetValueAmount < -0.005 ? "kit-text-danger" : undefined}>
            {money(item.realizedNetValueAmount, item.currency)}
          </strong>
        ) : (
          <Dash />
        ),
    },
    {
      id: "targetRoi",
      header: "Target ROI",
      align: "right",
      sortValue: (item) => item.baselineTargetRoiPct,
      cell: (item) => `${item.baselineTargetRoiPct.toFixed(1)}%`,
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
      id: "realization",
      header: "Realization",
      align: "right",
      sortValue: (item) => (item.assessed ? item.realizationPct : null),
      cell: (item) => (item.assessed ? `${item.realizationPct.toFixed(1)}%` : <Dash />),
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
          href={`/reinvestment-performance/${encodeURIComponent(String(item.performanceCaseId))}`}
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
  detail: ReinvestmentPerformanceSnapshotDetail;
}

export default function ReinvestmentPerformanceSnapshotPage() {
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
        const response = await getReinvestmentPerformanceSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load reinvestment-performance snapshot.",
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
        <Link href="/reinvestment-performance" className="request-back-link">
          <ArrowLeft size={16} />
          Reinvestment performance
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
  const cases = snapshot.caseCount;
  const assessedCount = snapshot.assessedCaseCount;
  const underperforming = snapshot.underperformingCaseCount;
  const unassessed = items.filter((item) => !item.assessed);
  const assessedShare = cases > 0 ? (assessedCount / cases) * 100 : 0;
  const performingCount = Math.max(0, cases - underperforming);
  const negativeNet = items.filter((item) => item.assessed && item.realizedNetValueAmount < -0.005);

  const orderedItems = [...items].sort(byRoiVariance);
  const first = orderedItems.length > 0 ? orderedItems[0] : null;
  const weakest = first !== null && first.assessed && first.roiVariancePct < 0 ? first : null;

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-realization.csv`,
      [
        "Target",
        "Performance case number",
        "Status",
        "Health",
        "Redeployed capital",
        "Assessed",
        "Expected value",
        "Realized value",
        "Net value",
        "Target ROI %",
        "Realized ROI %",
        "ROI variance pts",
        "Realization %",
        "Value variance",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.targetInitiativeTitle),
        String(item.performanceCaseNumber),
        readable(String(item.caseStatus)),
        readable(String(item.health)),
        item.redeployedCapitalAmount,
        item.assessed ? "Yes" : "No",
        item.assessed ? item.expectedHorizonValueAmount : "",
        item.assessed ? item.realizedHorizonValueAmount : "",
        item.assessed ? item.realizedNetValueAmount : "",
        item.baselineTargetRoiPct,
        item.assessed ? item.realizedRoiPct : "",
        item.assessed ? item.roiVariancePct : "",
        item.assessed ? item.realizationPct : "",
        item.assessed ? item.valueVarianceAmount : "",
        String(item.currency ?? ""),
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "case", "cases"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Cases",
      icon: Layers,
      value: String(cases),
      note: "Performance cases captured",
    },
    {
      label: "Assessed",
      icon: BadgeCheck,
      value: String(assessedCount),
      note: `Of ${plural(cases, "case", "cases")}`,
    },
    {
      label: "Underperforming",
      icon: TrendingDown,
      value: String(underperforming),
      note: "Cases below plan",
      tone: underperforming > 0 ? "warning" : "default",
    },
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
      note: "Against target ROI",
      tone: snapshot.averageRoiVariancePct < 0 ? "warning" : "default",
    },
    {
      label: "Realization",
      icon: Gauge,
      value: `${snapshot.averageRealizationPct.toFixed(1)}%`,
      note: "Realized against expected value",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/reinvestment-performance" className="request-back-link">
        <ArrowLeft size={16} />
        Reinvestment performance
      </Link>

      <section className="reinvestment-performance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable value-realization portfolio</span>

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
              ? ` The largest ROI shortfall was ${weakest.targetInitiativeTitle} at ${weakest.roiVariancePct.toFixed(1)} pts.`
              : ""}
          </div>
        </div>
      ) : null}

      {negativeNet.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(negativeNet.length, "case had", "cases had")} negative realized net value.
            </strong>{" "}
            The Net value column shows {negativeNet.length === 1 ? "it" : "them"} in red.
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
            <strong>This snapshot captured no cases.</strong> There was no reinvestment portfolio
            when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Reinvestment performance snapshot summary" />

      {hasItems && cases > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Realization at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.averageRealizationPct}
            tone={snapshot.averageRealizationPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average realization ${snapshot.averageRealizationPct.toFixed(1)}% of expected value`}
            label="Average realization"
          />

          <ProgressLine
            pct={assessedShare}
            tone={assessedShare >= 100 ? meterToneFor("success") : "primary"}
            caption={`${assessedCount} of ${plural(cases, "case", "cases")} assessed`}
            label="Assessed cases"
          />

          <ProgressLine
            pct={(performingCount / cases) * 100}
            tone={underperforming === 0 ? meterToneFor("success") : "primary"}
            caption={`${performingCount} of ${plural(cases, "case", "cases")} were not underperforming`}
            label="Cases not underperforming"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen post-redeployment outcomes</span>

            <h2>Value realization at capture time</h2>
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
          ariaLabel="Frozen value realization"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No cases captured"
              description="This snapshot has no reinvestment performance cases."
            />
          }
        />
      </section>

      <section className="reinvestment-performance-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable post-redeployment performance evidence</strong>

          <p>
            The snapshot freezes realized ROI, realization percentage, value variance and
            underperformance status without changing Steps 56–63.
          </p>
        </div>
      </section>
    </div>
  );
}
