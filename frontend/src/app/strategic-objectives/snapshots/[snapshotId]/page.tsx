"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Goal,
  Info,
  ListChecks,
  RefreshCw,
  Scale,
  Target,
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
  meterToneFor,
  readable,
  toneFor,
  useToast,
} from "@/components/kit";
import { getOkrSnapshot } from "@/lib/api";
import type { KeyResultMetricType, OkrSnapshotDetail } from "@/types/strategic-okr";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotKeyResult = OkrSnapshotDetail["keyResults"][number];

function displayValue(value: number, metricType: KeyResultMetricType, currency: string): string {
  if (metricType === "CURRENCY") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (metricType === "PERCENTAGE") {
    return `${value.toFixed(1)}%`;
  }

  if (metricType === "HOURS") {
    return `${value.toFixed(1)}h`;
  }

  return value.toFixed(1);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** True when the shared badge colours rate this health as a warning or worse. */
function needsAttention(keyResult: SnapshotKeyResult): boolean {
  const tone = toneFor(String(keyResult.health));

  return tone === "warning" || tone === "danger";
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

function buildKeyResultColumns(currency: string): Column<SnapshotKeyResult>[] {
  return [
    {
      id: "keyResult",
      header: "Key result",
      sortValue: (item) => String(item.title).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.title}</strong>

          <small>{readable(String(item.sourceType))}</small>
        </div>
      ),
    },
    {
      id: "weight",
      header: "Weight",
      align: "right",
      sortValue: (item) => item.weightPct,
      cell: (item) => `${item.weightPct.toFixed(0)}%`,
    },
    {
      id: "baseline",
      header: "Baseline",
      align: "right",
      sortValue: (item) => item.baselineValue,
      cell: (item) => displayValue(item.baselineValue, item.metricType, currency),
    },
    {
      id: "actual",
      header: "Actual",
      align: "right",
      sortValue: (item) => item.actualValue,
      cell: (item) => <strong>{displayValue(item.actualValue, item.metricType, currency)}</strong>,
    },
    {
      id: "target",
      header: "Target",
      align: "right",
      sortValue: (item) => item.targetValue,
      cell: (item) => displayValue(item.targetValue, item.metricType, currency),
    },
    {
      id: "progress",
      header: "Progress",
      align: "right",
      sortValue: (item) => item.progressPct,
      cell: (item) => `${item.progressPct.toFixed(1)}%`,
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
      id: "confidence",
      header: "Confidence",
      align: "right",
      sortValue: (item) => item.confidencePct,
      cell: (item) => `${item.confidencePct.toFixed(1)}%`,
    },
    {
      id: "contributions",
      header: "Contributions",
      align: "right",
      sortValue: (item) => item.contributionCount,
      cell: (item) => (
        <span className={item.contributionCount === 0 ? "kit-text-warning" : undefined}>
          {item.contributionCount}
        </span>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: OkrSnapshotDetail;
}

export default function OkrSnapshotPage() {
  const params = useParams<{ snapshotId: string }>();
  const toast = useToast();

  const [result, setResult] = useState<SnapshotData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.snapshotId;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getOkrSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load OKR snapshot.");
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
  }, [params.snapshotId, reloadKey]);

  const data = result !== null && result.id === params.snapshotId ? result : null;
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
        <Link href="/strategic-objectives" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic objectives
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

  const { snapshot, keyResults } = detail;
  const currency = detail.currency;
  const hasRows = keyResults.length > 0;
  const total = snapshot.keyResultCount;
  const achieved = snapshot.achievedKeyResultCount;
  const achievedPct = total > 0 ? (achieved / total) * 100 : 0;
  const period =
    detail.periodType === "QUARTERLY"
      ? `Q${detail.quarter} ${detail.fiscalYear}`
      : `FY ${detail.fiscalYear}`;

  const attention = keyResults.filter(needsAttention);
  const noContribution = keyResults.filter((item) => item.contributionCount === 0);
  const totalWeight = keyResults.reduce((sum, item) => sum + item.weightPct, 0);

  const orderedKeyResults = [...keyResults].sort((a, b) => a.progressPct - b.progressPct);
  const first = orderedKeyResults.length > 0 ? orderedKeyResults[0] : null;
  const weakestAttention = orderedKeyResults.find(needsAttention) ?? null;

  function exportKeyResults() {
    downloadRows(
      `${snapshot.snapshotNumber}-key-results.csv`,
      [
        "Key result",
        "Source type",
        "Metric type",
        "Weight %",
        "Baseline",
        "Actual",
        "Target",
        "Progress %",
        "Health",
        "Confidence %",
        "Contributions",
      ],
      orderedKeyResults.map((item) => [
        String(item.title),
        readable(String(item.sourceType)),
        readable(String(item.metricType)),
        item.weightPct,
        item.baselineValue,
        item.actualValue,
        item.targetValue,
        item.progressPct,
        readable(String(item.health)),
        item.confidencePct,
        item.contributionCount,
      ]),
    );

    toast.success("Snapshot exported", plural(keyResults.length, "key result", "key results"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Progress",
      icon: Gauge,
      value: `${snapshot.overallProgressPct.toFixed(1)}%`,
      note: "Overall objective progress",
    },
    {
      label: "Health",
      icon: Activity,
      value: readable(String(snapshot.overallHealth)),
      note: "Overall objective health",
    },
    {
      label: "Confidence",
      icon: BadgeCheck,
      value: `${snapshot.overallConfidencePct.toFixed(1)}%`,
      note: "Overall confidence",
    },
    {
      label: "Achieved key results",
      icon: Target,
      value: `${achieved} / ${total}`,
      note: total > 0 ? `${achievedPct.toFixed(0)}% achieved` : "No key results",
    },
    {
      label: "Without contributions",
      icon: ListChecks,
      value: String(noContribution.length),
      note: "Key results with no contribution",
      tone: noContribution.length > 0 ? "warning" : "default",
    },
    {
      label: "Total weight",
      icon: Scale,
      value: `${totalWeight.toFixed(0)}%`,
      note: "Summed across the key results",
    },
  ];

  const keyResultColumns = buildKeyResultColumns(currency);

  return (
    <div className="page-stack">
      <Link
        href={`/strategic-objectives/${encodeURIComponent(String(snapshot.objectiveId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Objective
      </Link>

      <section className="okr-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(snapshot.overallHealth)}
              label={readable(String(snapshot.overallHealth))}
            />
          </div>

          <span className="eyebrow">Immutable executive OKR record</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {detail.objectiveNumber}
            {" · "}
            {detail.objectiveTitle}
            {" · "}
            {period}
            {" · Captured by "}
            {snapshot.capturedByName ?? "Procurement management"}
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
            onClick={exportKeyResults}
            disabled={!hasRows}
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

      {attention.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(attention.length, "key result needed", "key results needed")} attention at
              capture.
            </strong>
            {weakestAttention !== null
              ? ` The furthest behind was ${weakestAttention.title} at ${weakestAttention.progressPct.toFixed(1)}% progress.`
              : ""}
          </div>
        </div>
      ) : null}

      {noContribution.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(noContribution.length, "key result had", "key results had")} no recorded
              contributions.
            </strong>{" "}
            The Contributions column shows {noContribution.length === 1 ? "it" : "them"} in amber.
          </div>
        </div>
      ) : null}

      {!hasRows ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no key results.</strong> The objective had no scorecard
            when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="OKR snapshot summary" />

      {hasRows ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Objective at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.overallProgressPct}
            tone={snapshot.overallProgressPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Overall progress ${snapshot.overallProgressPct.toFixed(1)}%`}
            label="Overall progress"
          />

          <ProgressLine
            pct={snapshot.overallConfidencePct}
            tone={snapshot.overallConfidencePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Overall confidence ${snapshot.overallConfidencePct.toFixed(1)}%`}
            label="Overall confidence"
          />

          {total > 0 ? (
            <ProgressLine
              pct={achievedPct}
              tone={achieved === total ? meterToneFor("success") : "primary"}
              caption={`${achieved} of ${plural(total, "key result", "key results")} achieved`}
              label="Achieved key results"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen key-result evidence</span>

            <h2>Snapshot scorecard</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasRows && first !== null ? (
          <p className="kit-meta-line">
            Lowest progress first, across {plural(keyResults.length, "key result", "key results")}.
            Currency values are shown in {currency}.
          </p>
        ) : null}

        <DataTable
          columns={keyResultColumns}
          rows={orderedKeyResults}
          getRowId={(item) => String(item.id)}
          ariaLabel="Frozen key-result scorecard"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No key results"
              description="This snapshot has no key results."
            />
          }
        />
      </section>

      <section className="okr-method-note">
        <Goal size={18} />

        <div>
          <strong>Immutable executive evidence</strong>

          <p>
            This snapshot stores the objective score and every key-result actual, target, health
            and confidence value as they existed at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
