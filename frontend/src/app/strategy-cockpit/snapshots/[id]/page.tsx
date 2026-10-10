"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Goal,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
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
  toneFor,
  useToast,
} from "@/components/kit";
import { getStrategyCockpitSnapshot } from "@/lib/api";
import type { BoardSnapshotDetail } from "@/types/strategy-cockpit";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotDimension = BoardSnapshotDetail["dimensions"][number];
type SnapshotException = BoardSnapshotDetail["exceptions"][number];

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function severityRank(value: string): number {
  return SEVERITY_RANK[value.toUpperCase()] ?? 4;
}

function signed(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function isDeclining(dimension: SnapshotDimension): boolean {
  return dimension.previousScore !== null && dimension.scoreDelta < -0.05;
}

/** True when the shared badge colours rate this health as a warning or worse. */
function needsAttention(dimension: SnapshotDimension): boolean {
  const tone = toneFor(String(dimension.health));

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

function buildDimensionColumns(): Column<SnapshotDimension>[] {
  return [
    {
      id: "dimension",
      header: "Dimension",
      sortValue: (item) => String(item.label).toLowerCase(),
      cell: (item) => <strong>{item.label}</strong>,
    },
    {
      id: "weight",
      header: "Weight",
      align: "right",
      sortValue: (item) => item.weightPct,
      cell: (item) => `${item.weightPct.toFixed(0)}%`,
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: (item) => item.score,
      cell: (item) => <strong>{item.score.toFixed(1)}</strong>,
    },
    {
      id: "contribution",
      header: "Contribution",
      align: "right",
      sortValue: (item) => item.weightedContribution,
      cell: (item) => item.weightedContribution.toFixed(1),
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
      id: "previous",
      header: "Previous",
      align: "right",
      sortValue: (item) => item.previousScore ?? null,
      cell: (item) => (item.previousScore === null ? <Dash /> : item.previousScore.toFixed(1)),
    },
    {
      id: "delta",
      header: "Delta",
      align: "right",
      sortValue: (item) => item.scoreDelta,
      cell: (item) => (
        <span className={isDeclining(item) ? "kit-text-warning" : undefined}>
          {signed(item.scoreDelta)}
        </span>
      ),
    },
    {
      id: "evidence",
      header: "Evidence",
      sortValue: (item) => String(item.sourceDetail ?? "").toLowerCase(),
      cell: (item) =>
        item.sourceDetail ? (
          <span className="kit-clamp" title={String(item.sourceDetail)}>
            {item.sourceDetail}
          </span>
        ) : (
          <Dash />
        ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: BoardSnapshotDetail;
}

export default function StrategyCockpitSnapshotPage() {
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
        const response = await getStrategyCockpitSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load procurement board pack.",
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
        <Link href="/strategy-cockpit" className="request-back-link">
          <ArrowLeft size={16} />
          Strategy cockpit
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

  const { snapshot, summary, dimensions, exceptions } = detail;
  const hasDimensions = dimensions.length > 0;
  const hasExceptions = exceptions.length > 0;

  const declining = dimensions.filter(isDeclining);
  const attention = dimensions.filter(needsAttention);
  const critical = summary.criticalExceptionCount;

  const orderedDimensions = [...dimensions].sort((a, b) => a.score - b.score);
  const weakestDimension = orderedDimensions.length > 0 ? orderedDimensions[0] : null;
  const steepest = [...declining].sort((a, b) => a.scoreDelta - b.scoreDelta);
  const biggestDrop = steepest.length > 0 ? steepest[0] : null;

  const orderedExceptions = [...exceptions].sort(
    (a, b) =>
      severityRank(String(a.severity)) - severityRank(String(b.severity)) ||
      b.occurrenceCount - a.occurrenceCount,
  );

  function exportDimensions() {
    downloadRows(
      `${snapshot.snapshotNumber}-dimensions.csv`,
      [
        "Dimension",
        "Key",
        "Weight %",
        "Score",
        "Weighted contribution",
        "Health",
        "Previous score",
        "Score delta",
        "Evidence",
      ],
      orderedDimensions.map((item) => [
        String(item.label),
        String(item.key),
        item.weightPct,
        item.score,
        item.weightedContribution,
        readable(String(item.health)),
        item.previousScore === null ? "" : item.previousScore,
        item.scoreDelta,
        String(item.sourceDetail ?? ""),
      ]),
    );

    toast.success("Board pack exported", plural(dimensions.length, "dimension", "dimensions"));
  }

  function exportExceptions() {
    downloadRows(
      `${snapshot.snapshotNumber}-exceptions.csv`,
      ["Severity", "Title", "Detail", "Type", "Occurrences"],
      orderedExceptions.map((item: SnapshotException) => [
        readable(String(item.severity)),
        String(item.title),
        String(item.detail ?? ""),
        readable(String(item.type)),
        item.occurrenceCount,
      ]),
    );

    toast.success("Board pack exported", plural(exceptions.length, "exception", "exceptions"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Board score",
      icon: Gauge,
      value: summary.overallScore.toFixed(1),
      note: readable(String(summary.overallHealth)),
    },
    {
      label: "Movement",
      icon: Activity,
      value: readable(String(summary.movement)),
      note: `${signed(summary.scoreDelta)} pts`,
    },
    {
      label: "Exceptions",
      icon: ShieldAlert,
      value: String(summary.exceptionCount),
      note: `${critical} critical`,
      tone: summary.exceptionCount > 0 ? "warning" : "default",
    },
    {
      label: "Dimensions",
      icon: Layers,
      value: String(dimensions.length),
      note: "Scored in the board pack",
    },
    {
      label: "Weakest dimension",
      icon: Target,
      value: weakestDimension === null ? "N/A" : String(weakestDimension.label),
      note:
        weakestDimension === null ? "No dimensions captured" : `Score ${weakestDimension.score.toFixed(1)}`,
    },
    {
      label: "Declining dimensions",
      icon: TrendingDown,
      value: String(declining.length),
      note: "Score below the previous period",
      tone: declining.length > 0 ? "warning" : "default",
    },
  ];

  const dimensionColumns = buildDimensionColumns();

  return (
    <div className="page-stack">
      <Link href="/strategy-cockpit" className="request-back-link">
        <ArrowLeft size={16} />
        Strategy cockpit
      </Link>

      <section className="strategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(snapshot.overallHealth)}
              label={readable(String(snapshot.overallHealth))}
            />
          </div>

          <span className="eyebrow">Immutable procurement board pack</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            FY {snapshot.fiscalYear}
            {" · "}
            {snapshot.currency}
            {" · Captured by "}
            {snapshot.capturedByName ?? "Procurement management"}
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
            onClick={exportDimensions}
            disabled={!hasDimensions}
          >
            <Download size={15} />
            Export dimensions
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportExceptions}
            disabled={!hasExceptions}
          >
            <Download size={15} />
            Export exceptions
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

      {critical > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(critical, "critical exception was", "critical exceptions were")} in the board
              pack.
            </strong>{" "}
            {plural(summary.exceptionCount, "exception was", "exceptions were")} captured in
            total. They are listed below, most severe first.
          </div>
        </div>
      ) : null}

      {declining.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(declining.length, "dimension scored", "dimensions scored")} lower than in the
              previous period.
            </strong>
            {biggestDrop !== null
              ? ` The largest drop was ${biggestDrop.label} at ${signed(biggestDrop.scoreDelta)} pts.`
              : ""}
          </div>
        </div>
      ) : null}

      {attention.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(attention.length, "dimension was", "dimensions were")} not rated healthy at
              capture.
            </strong>{" "}
            The Health column shows the rating for each.
          </div>
        </div>
      ) : null}

      {!hasDimensions ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This board pack captured no dimensions.</strong> There was no scorecard
            composition when it was sealed.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Board pack summary" />

      <section className="panel strategy-executive-summary">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen executive narrative</span>

            <h2>Board summary</h2>
          </div>

          <Goal size={19} />
        </div>

        <p>{summary.generatedSummary}</p>
      </section>

      {snapshot.boardCommentary ? (
        <section className="panel strategy-board-commentary">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Governed commentary</span>

              <h2>Board note</h2>
            </div>
          </div>

          <p>{snapshot.boardCommentary}</p>
        </section>
      ) : null}

      {hasDimensions ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Scores at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={summary.overallScore}
            tone={toneFor(String(summary.overallHealth)) === "success" ? meterToneFor("success") : "primary"}
            caption={`Board score ${summary.overallScore.toFixed(1)} of 100`}
            label="Board score"
          />

          {orderedDimensions.map((dimension) => (
            <ProgressLine
              key={dimension.key}
              pct={dimension.score}
              tone={
                toneFor(String(dimension.health)) === "success" ? meterToneFor("success") : "primary"
              }
              caption={`${dimension.label} ${dimension.score.toFixed(1)} (weight ${dimension.weightPct.toFixed(0)}%)`}
              label={`${dimension.label} score`}
            />
          ))}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen strategic dimensions</span>

            <h2>Scorecard composition</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasDimensions ? (
          <p className="kit-meta-line">
            Lowest score first, across {plural(dimensions.length, "dimension", "dimensions")}.
          </p>
        ) : null}

        <DataTable
          columns={dimensionColumns}
          rows={orderedDimensions}
          getRowId={(item) => String(item.key)}
          ariaLabel="Frozen scorecard composition"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No dimensions captured"
              description="This board pack has no scorecard dimensions."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen strategic exceptions</span>

            <h2>Board attention items</h2>
          </div>

          <ShieldAlert size={19} />
        </div>

        {hasExceptions ? (
          <p className="kit-meta-line">
            Most severe first, across {plural(exceptions.length, "exception", "exceptions")}.
          </p>
        ) : null}

        {hasExceptions ? (
          <div className="strategy-exception-list">
            {orderedExceptions.map((exception) => (
              <article key={exception.stableKey}>
                <div className="strategy-exception-heading">
                  <StatusBadge
                    value={String(exception.severity)}
                    label={readable(String(exception.severity))}
                  />

                  <strong>{exception.title}</strong>
                </div>

                <p>{exception.detail}</p>

                <div className="strategy-exception-footer">
                  <span>Count: {exception.occurrenceCount}</span>

                  <span>{readable(String(exception.type))}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="No strategic exceptions"
            description="No strategic exceptions were captured in this board pack."
          />
        )}
      </section>

      <section className="strategy-method-note">
        <Goal size={18} />

        <div>
          <strong>Immutable executive evidence</strong>

          <p>
            This pack freezes dimension scores, strategic exceptions, deterministic narrative,
            governed commentary and period movement at capture time. Later changes to source
            authorities do not rewrite this record.
          </p>
        </div>
      </section>
    </div>
  );
}
