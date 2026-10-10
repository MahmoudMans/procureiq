"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Hourglass,
  Info,
  Layers,
  RefreshCw,
  Repeat,
  TrendingDown,
  TrendingUp,
  WalletCards,
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
import { getCapitalFlywheelSnapshot } from "@/lib/api";
import type { CapitalFlywheelSnapshotDetail } from "@/types/capital-flywheel";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = CapitalFlywheelSnapshotDetail["items"][number];

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

function buildItemColumns(): Column<SnapshotItem>[] {
  return [
    {
      id: "lineage",
      header: "Lineage",
      sortValue: (item) => String(item.rootTargetInitiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.rootTargetInitiativeTitle}</strong>

          <small>{item.lineageNumber}</small>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.lineageStatus),
      cell: (item) => (
        <StatusBadge
          value={String(item.lineageStatus)}
          label={readable(String(item.lineageStatus))}
        />
      ),
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.flywheelHealth),
      cell: (item) => (
        <StatusBadge
          value={String(item.flywheelHealth)}
          label={readable(String(item.flywheelHealth))}
        />
      ),
    },
    {
      id: "cycles",
      header: "Cycles",
      align: "right",
      sortValue: (item) => item.cycleCount,
      cell: (item) => item.cycleCount,
    },
    {
      id: "original",
      header: "Original capital",
      align: "right",
      sortValue: (item) => item.originalCapitalAmount,
      cell: (item) => money(item.originalCapitalAmount, item.currency),
    },
    {
      id: "net",
      header: "Cumulative net",
      align: "right",
      sortValue: (item) => item.cumulativeProjectedNetValueAmount,
      cell: (item) => money(item.cumulativeProjectedNetValueAmount, item.currency),
    },
    {
      id: "compounding",
      header: "Compounding",
      align: "right",
      sortValue: (item) => item.cumulativeCompoundingValueAmount,
      cell: (item) => money(item.cumulativeCompoundingValueAmount, item.currency),
    },
    {
      id: "decay",
      header: "Decay",
      align: "right",
      sortValue: (item) => item.cumulativeDecayedValueAmount,
      cell: (item) => (
        <span className={item.cumulativeDecayedValueAmount > 0.005 ? "kit-text-warning" : undefined}>
          {money(item.cumulativeDecayedValueAmount, item.currency)}
        </span>
      ),
    },
    {
      id: "multiple",
      header: "Value multiple",
      align: "right",
      sortValue: (item) => item.cumulativeValueMultiple,
      cell: (item) => <strong>{item.cumulativeValueMultiple.toFixed(2)}x</strong>,
    },
    {
      id: "marginal",
      header: "Marginal multiple",
      align: "right",
      sortValue: (item) => item.latestMarginalValueMultiple,
      cell: (item) => (
        <span className={item.diminishingReturns ? "kit-text-warning" : undefined}>
          {item.latestMarginalValueMultiple.toFixed(2)}x
        </span>
      ),
    },
    {
      id: "retention",
      header: "Marginal retention",
      align: "right",
      sortValue: (item) => item.latestMarginalNetValueRetentionPct,
      cell: (item) => `${item.latestMarginalNetValueRetentionPct.toFixed(1)}%`,
    },
    {
      id: "diminishing",
      header: "Diminishing",
      sortValue: (item) => (item.diminishingReturns ? 1 : 0),
      cell: (item) =>
        item.diminishingReturns ? (
          <StatusBadge value="PENDING" label="Diminishing" />
        ) : (
          <span className="kit-text-muted">No</span>
        ),
    },
    {
      id: "recommendation",
      header: "Recommendation",
      sortValue: (item) => String(item.recommendation),
      cell: (item) => (
        <StatusBadge
          value={String(item.recommendation)}
          label={readable(String(item.recommendation))}
        />
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 100,
      cell: (item) => (
        <Link
          href={`/capital-flywheel/${encodeURIComponent(String(item.lineageId))}`}
          className="table-action"
        >
          Open lineage
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
  detail: CapitalFlywheelSnapshotDetail;
}

export default function CapitalFlywheelSnapshotPage() {
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
        const response = await getCapitalFlywheelSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load capital-flywheel snapshot.",
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
        <Link href="/capital-flywheel" className="request-back-link">
          <ArrowLeft size={16} />
          Capital flywheel
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
  const pending = snapshot.reviewPendingLineageCount;
  const diminishingCount = snapshot.diminishingReturnLineageCount;
  const lineages = snapshot.lineageCount;
  const decayPresent = snapshot.totalDecayedValueAmount > 0.005;

  const orderedItems = [...items].sort(
    (a, b) =>
      Number(b.diminishingReturns) - Number(a.diminishingReturns) ||
      a.latestMarginalValueMultiple - b.latestMarginalValueMultiple,
  );
  const weakest = orderedItems.length > 0 ? orderedItems[0] : null;
  const averageRetention = hasItems
    ? items.reduce((sum, item) => sum + item.latestMarginalNetValueRetentionPct, 0) / items.length
    : 0;

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-lineages.csv`,
      [
        "Lineage",
        "Lineage number",
        "Status",
        "Health",
        "Cycles",
        "Original capital",
        "Cumulative net",
        "Compounding",
        "Decay",
        "Value multiple",
        "Marginal multiple",
        "Marginal retention %",
        "Diminishing returns",
        "Recommendation",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.rootTargetInitiativeTitle),
        String(item.lineageNumber),
        readable(String(item.lineageStatus)),
        readable(String(item.flywheelHealth)),
        item.cycleCount,
        item.originalCapitalAmount,
        item.cumulativeProjectedNetValueAmount,
        item.cumulativeCompoundingValueAmount,
        item.cumulativeDecayedValueAmount,
        item.cumulativeValueMultiple,
        item.latestMarginalValueMultiple,
        item.latestMarginalNetValueRetentionPct,
        item.diminishingReturns ? "Yes" : "No",
        readable(String(item.recommendation)),
        String(item.currency ?? ""),
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "lineage", "lineages"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Lineages",
      icon: Layers,
      value: String(lineages),
      note: "Capital lineages captured",
    },
    {
      label: "Cycles",
      icon: Repeat,
      value: String(snapshot.totalCycleCount),
      note: "Across all lineages",
    },
    {
      label: "Review queue",
      icon: Hourglass,
      value: String(pending),
      note: "Lineages awaiting review",
      tone: pending > 0 ? "warning" : "default",
    },
    {
      label: "Diminishing",
      icon: TrendingDown,
      value: String(diminishingCount),
      note: "Lineages with diminishing returns",
      tone: diminishingCount > 0 ? "warning" : "default",
    },
    {
      label: "Marginal multiple",
      icon: TrendingUp,
      value: `${snapshot.averageLatestMarginalValueMultiple.toFixed(2)}x`,
      note: "Average, latest cycle",
    },
    {
      label: "Cumulative value multiple",
      icon: Gauge,
      value: `${snapshot.averageCumulativeValueMultiple.toFixed(2)}x`,
      note: "Average per original capital unit",
    },
  ];

  const valueKpis: KpiItem[] = [
    {
      label: "Original capital",
      icon: Coins,
      value: money(snapshot.totalOriginalCapitalAmount),
      note: "Summed across lineages",
    },
    {
      label: "Cumulative projected net",
      icon: WalletCards,
      value: money(snapshot.totalCumulativeProjectedNetValueAmount),
      note: "Projected net value to date",
    },
    {
      label: "Compounding",
      icon: TrendingUp,
      value: money(snapshot.totalCompoundingValueAmount),
      note: "Value from reinvested cycles",
    },
    {
      label: "Decay",
      icon: TrendingDown,
      value: money(snapshot.totalDecayedValueAmount),
      note: "Value lost to decay",
      tone: decayPresent ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/capital-flywheel" className="request-back-link">
        <ArrowLeft size={16} />
        Capital flywheel
      </Link>

      <section className="flywheel-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable capital-flywheel portfolio</span>

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

      {diminishingCount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(diminishingCount, "lineage showed", "lineages showed")} diminishing returns.
            </strong>
            {weakest !== null && weakest.diminishingReturns
              ? ` The weakest marginal multiple was ${weakest.rootTargetInitiativeTitle} at ${weakest.latestMarginalValueMultiple.toFixed(2)}x.`
              : ""}
          </div>
        </div>
      ) : null}

      {pending > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(pending, "lineage was", "lineages were")} in the review queue at capture.
            </strong>{" "}
            Continuation for {pending === 1 ? "it" : "them"} had not been decided.
          </div>
        </div>
      ) : null}

      {decayPresent ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{money(snapshot.totalDecayedValueAmount)} of value decay was recorded.</strong>{" "}
            The Decay column shows which lineages carry it.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no lineages.</strong> There was no capital flywheel
            portfolio when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Capital flywheel snapshot summary" />

      <KpiGrid items={valueKpis} ariaLabel="Capital flywheel value summary" />

      {hasItems && lineages > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Lineage health at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={((lineages - diminishingCount) / lineages) * 100}
            tone={diminishingCount === 0 ? meterToneFor("success") : "primary"}
            caption={`${Math.max(0, lineages - diminishingCount)} of ${plural(lineages, "lineage", "lineages")} had no diminishing returns`}
            label="Lineages without diminishing returns"
          />

          <ProgressLine
            pct={((lineages - pending) / lineages) * 100}
            tone={pending === 0 ? meterToneFor("success") : "primary"}
            caption={`${Math.max(0, lineages - pending)} of ${plural(lineages, "lineage", "lineages")} were outside the review queue`}
            label="Lineages outside the review queue"
          />

          <ProgressLine
            pct={averageRetention}
            tone={averageRetention >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average marginal retention ${averageRetention.toFixed(1)}%`}
            label="Average marginal retention"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen multi-cycle economics</span>

            <h2>Capital lineages at capture time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Diminishing returns first, then the lowest marginal multiple, across{" "}
            {plural(items.length, "lineage", "lineages")}. Open lineage shows the live record,
            which may have changed since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.lineageId)}
          ariaLabel="Frozen capital lineages"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No lineages captured"
              description="This snapshot has no capital lineages."
            />
          }
        />
      </section>

      <section className="flywheel-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable multi-cycle compounding evidence</strong>

          <p>
            This snapshot freezes cumulative value per original capital unit, marginal returns,
            diminishing-return signals and continuation recommendations without changing Steps
            56–65.
          </p>
        </div>
      </section>
    </div>
  );
}
