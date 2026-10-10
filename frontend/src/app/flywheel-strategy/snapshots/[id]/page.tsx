"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Info,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  Target,
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
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { getFlywheelStrategySnapshot } from "@/lib/api";
import type { FlywheelStrategySnapshotDetail } from "@/types/flywheel-strategy";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = FlywheelStrategySnapshotDetail["items"][number];

function amount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function money(value: number, currency: string): string {
  return `${amount(value)} ${currency}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function isPending(item: SnapshotItem): boolean {
  return String(item.decision).toUpperCase() === "PENDING";
}

/** True when the latest cycle returned less per unit of capital than the lineage average. */
function isSoftening(item: SnapshotItem): boolean {
  return item.latestMarginalValueMultiple < item.cumulativeValueMultiple - 0.005;
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
      id: "proposed",
      header: "Proposed",
      align: "right",
      sortValue: (item) => item.proposedCapacityAmount,
      cell: (item) => amount(item.proposedCapacityAmount),
    },
    {
      id: "cumulative",
      header: "Cumulative value",
      align: "right",
      sortValue: (item) => item.cumulativeValueMultiple,
      cell: (item) => `${item.cumulativeValueMultiple.toFixed(2)}x`,
    },
    {
      id: "marginal",
      header: "Marginal value",
      align: "right",
      sortValue: (item) => item.latestMarginalValueMultiple,
      cell: (item) => (
        <span className={isSoftening(item) ? "kit-text-warning" : undefined}>
          {item.latestMarginalValueMultiple.toFixed(2)}x
        </span>
      ),
    },
    {
      id: "retention",
      header: "Retention",
      align: "right",
      sortValue: (item) => item.latestMarginalNetValueRetentionPct,
      cell: (item) => `${item.latestMarginalNetValueRetentionPct.toFixed(1)}%`,
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (item) => item.priorityScore,
      cell: (item) => <strong>{item.priorityScore.toFixed(1)}</strong>,
    },
    {
      id: "advisory",
      header: "Advisory",
      sortValue: (item) => String(item.advisoryRecommendation),
      cell: (item) => (
        <StatusBadge
          value={String(item.advisoryRecommendation)}
          label={readable(String(item.advisoryRecommendation))}
        />
      ),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => (
        <div className="kit-cell-stack">
          <StatusBadge value={String(item.decision)} label={readable(String(item.decision))} />

          {item.decisionNote ? (
            <small className="kit-clamp" title={String(item.decisionNote)}>
              {item.decisionNote}
            </small>
          ) : null}
        </div>
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 100,
      cell: (item) => (
        <Link
          href={`/capital-flywheel/${encodeURIComponent(String(item.flywheelLineageId))}`}
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
  detail: FlywheelStrategySnapshotDetail;
}

export default function FlywheelStrategySnapshotPage() {
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
        const response = await getFlywheelStrategySnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load immutable strategy evidence.",
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
        <Link href="/flywheel-strategy" className="request-back-link">
          <ArrowLeft size={16} />
          Flywheel strategy
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
  const currency = snapshot.currency;
  const hasItems = items.length > 0;
  const overCapacity = snapshot.remainingCapacityAmount < -0.005;

  const pendingItems = items.filter(isPending);
  const decided = items.length - pendingItems.length;
  const softening = items.filter(isSoftening);
  const averageRetention = hasItems
    ? items.reduce((sum, item) => sum + item.latestMarginalNetValueRetentionPct, 0) / items.length
    : 0;

  const orderedItems = [...items].sort((a, b) => b.priorityScore - a.priorityScore);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-strategy.csv`,
      [
        "Lineage",
        "Lineage number",
        "Proposed capacity",
        "Cumulative value multiple",
        "Marginal value multiple",
        "Marginal retention %",
        "Priority score",
        "Advisory",
        "Decision",
        "Decision note",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.rootTargetInitiativeTitle),
        String(item.lineageNumber),
        item.proposedCapacityAmount,
        item.cumulativeValueMultiple,
        item.latestMarginalValueMultiple,
        item.latestMarginalNetValueRetentionPct,
        item.priorityScore,
        readable(String(item.advisoryRecommendation)),
        readable(String(item.decision)),
        String(item.decisionNote ?? ""),
        currency,
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "lineage", "lineages"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Capacity",
      icon: Banknote,
      value: money(snapshot.capitalCapacityAmount, currency),
      note: "Capital capacity",
    },
    {
      label: "Prioritized",
      icon: Coins,
      value: money(snapshot.prioritizedCapacityAmount, currency),
      note: "Capacity prioritized to lineages",
    },
    {
      label: "Remaining",
      icon: WalletCards,
      value: money(snapshot.remainingCapacityAmount, currency),
      note: overCapacity ? "Prioritized above capacity" : "Capacity left",
      tone: overCapacity ? "warning" : "default",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${snapshot.capacityUtilizationPct.toFixed(1)}%`,
      note: "Prioritized against capacity",
      tone: snapshot.capacityUtilizationPct > 100.005 ? "warning" : "default",
    },
    {
      label: "Average priority",
      icon: Target,
      value: snapshot.averagePriorityScore.toFixed(1),
      note: "Across the lineages",
    },
    {
      label: "Lineages",
      icon: ListChecks,
      value: String(items.length),
      note: `${decided} with a decision`,
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link
        href={`/flywheel-strategy/${encodeURIComponent(String(snapshot.portfolioId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Portfolio
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(snapshot.portfolioStatus)}
              label={readable(String(snapshot.portfolioStatus))}
            />
          </div>

          <span className="eyebrow">Immutable portfolio evidence</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.portfolioNumber}
            {" · "}
            {currency}
            {" · FY "}
            {snapshot.fiscalYear}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div className="fwstrategy-heading-actions">
            <LockKeyhole size={18} />

            <span className="fwstrategy-status-chip">Immutable</span>
          </div>

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

      {overCapacity ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              Prioritized capacity exceeded the capital capacity by{" "}
              {money(Math.abs(snapshot.remainingCapacityAmount), currency)}.
            </strong>{" "}
            {money(snapshot.prioritizedCapacityAmount, currency)} was prioritized against{" "}
            {money(snapshot.capitalCapacityAmount, currency)} of capacity.
          </div>
        </div>
      ) : null}

      {pendingItems.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(pendingItems.length, "lineage had", "lineages had")} no decision recorded.
            </strong>{" "}
            The Decision column shows them as pending.
          </div>
        </div>
      ) : null}

      {softening.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(softening.length, "lineage had", "lineages had")} a latest marginal multiple
              below {softening.length === 1 ? "its" : "their"} cumulative multiple.
            </strong>{" "}
            The latest cycle returned less per unit of capital than the lineage average. The
            Marginal value column shows them in amber.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no lineages.</strong> There was no lineage allocation
            when it was sealed.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Flywheel strategy snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Portfolio at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.capacityUtilizationPct}
            tone="primary"
            caption={`${money(snapshot.prioritizedCapacityAmount, currency)} prioritized of ${money(snapshot.capitalCapacityAmount, currency)} capacity (${snapshot.capacityUtilizationPct.toFixed(1)}%)`}
            label="Prioritized capacity against capital capacity"
          />

          <ProgressLine
            pct={(decided / items.length) * 100}
            tone={decided === items.length ? meterToneFor("success") : "primary"}
            caption={`${decided} of ${plural(items.length, "lineage", "lineages")} had a decision recorded`}
            label="Lineages with a decision"
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
            <span className="eyebrow">Frozen lineage allocation evidence</span>

            <h2>Snapshot items</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Highest priority first, across {plural(items.length, "lineage", "lineages")}. Amounts
            are in {currency}. Open lineage shows the live record, which may have changed since
            capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.flywheelLineageId)}
          ariaLabel="Frozen strategy lineages"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No lineage rows"
              description="Snapshot contains no lineage allocation rows."
            />
          }
        />
      </section>

      <section className="fwstrategy-method-note">
        <LockKeyhole size={18} />

        <div>
          <strong>Evidence is append-only</strong>

          <p>
            Snapshot headers and snapshot lineage rows are protected against update and deletion
            by database triggers. This page is intentionally read-only.
          </p>
        </div>
      </section>
    </div>
  );
}
