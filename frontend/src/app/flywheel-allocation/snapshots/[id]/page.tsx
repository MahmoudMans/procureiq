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
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { getFlywheelAllocationSnapshot } from "@/lib/api";
import type { FlywheelAllocationSnapshotDetail } from "@/types/flywheel-allocation";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = FlywheelAllocationSnapshotDetail["items"][number];

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

/** Requested allocation as a share of the capacity proposed for that lineage. */
function sharePct(item: SnapshotItem): number | null {
  return item.strategyProposedCapacityAmount > 0
    ? (item.requestedAllocationAmount / item.strategyProposedCapacityAmount) * 100
    : null;
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
      id: "capacity",
      header: "Step 67 capacity",
      align: "right",
      sortValue: (item) => item.strategyProposedCapacityAmount,
      cell: (item) => amount(item.strategyProposedCapacityAmount),
    },
    {
      id: "requested",
      header: "Requested",
      align: "right",
      sortValue: (item) => item.requestedAllocationAmount,
      cell: (item) => <strong>{amount(item.requestedAllocationAmount)}</strong>,
    },
    {
      id: "share",
      header: "Requested of capacity",
      align: "right",
      sortValue: (item) => sharePct(item),
      cell: (item) => {
        const share = sharePct(item);

        if (share === null) {
          return <span className="kit-text-muted">—</span>;
        }

        return (
          <span className={share > 100.005 ? "kit-text-warning" : undefined}>
            {share.toFixed(1)}%
          </span>
        );
      },
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (item) => item.strategyPriorityScore,
      cell: (item) => item.strategyPriorityScore.toFixed(1),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: FlywheelAllocationSnapshotDetail;
}

export default function FlywheelAllocationSnapshotPage() {
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
        const response = await getFlywheelAllocationSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load immutable allocation evidence.",
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
        <Link href="/flywheel-allocation" className="request-back-link">
          <ArrowLeft size={16} />
          Capital mandates
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
  const overCapacity = snapshot.remainingStrategyCapacityAmount < -0.005;

  const aboveProposed = items.filter(
    (item) => item.requestedAllocationAmount > item.strategyProposedCapacityAmount + 0.005,
  );
  const proposedTotal = items.reduce((sum, item) => sum + item.strategyProposedCapacityAmount, 0);
  const requestedTotal = items.reduce((sum, item) => sum + item.requestedAllocationAmount, 0);
  const requestedVsProposedPct = proposedTotal > 0 ? (requestedTotal / proposedTotal) * 100 : 0;

  const largest = items.reduce<SnapshotItem | null>(
    (best, item) =>
      best === null || item.requestedAllocationAmount > best.requestedAllocationAmount
        ? item
        : best,
    null,
  );

  const orderedItems = [...items].sort((a, b) => b.strategyPriorityScore - a.strategyPriorityScore);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-allocation.csv`,
      [
        "Lineage",
        "Lineage number",
        "Step 67 capacity",
        "Requested",
        "Requested of capacity %",
        "Priority score",
        "Currency",
      ],
      orderedItems.map((item) => {
        const share = sharePct(item);

        return [
          String(item.rootTargetInitiativeTitle),
          String(item.lineageNumber),
          item.strategyProposedCapacityAmount,
          item.requestedAllocationAmount,
          share === null ? "" : share,
          item.strategyPriorityScore,
          currency,
        ];
      }),
    );

    toast.success("Snapshot exported", plural(items.length, "lineage", "lineages"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Strategy capacity",
      icon: Banknote,
      value: money(snapshot.strategyPrioritizedCapacityAmount, currency),
      note: "Prioritized by the strategy",
    },
    {
      label: "Requested",
      icon: Coins,
      value: money(snapshot.requestedAllocationAmount, currency),
      note: "Allocation requested",
    },
    {
      label: "Remaining",
      icon: WalletCards,
      value: money(snapshot.remainingStrategyCapacityAmount, currency),
      note: overCapacity ? "Requested above capacity" : "Strategy capacity left",
      tone: overCapacity ? "warning" : "default",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${snapshot.allocationUtilizationPct.toFixed(1)}%`,
      note: "Requested against capacity",
      tone: snapshot.allocationUtilizationPct > 100.005 ? "warning" : "default",
    },
    {
      label: "Items",
      icon: ListChecks,
      value: String(snapshot.itemCount),
      note: "Lineages in the allocation",
    },
    {
      label: "Largest request",
      icon: TrendingUp,
      value: largest === null ? "N/A" : money(largest.requestedAllocationAmount, currency),
      note: largest === null ? "No items captured" : String(largest.rootTargetInitiativeTitle),
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link
        href={`/flywheel-allocation/${encodeURIComponent(String(snapshot.mandateId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Allocation mandate
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(snapshot.mandateStatus)}
              label={readable(String(snapshot.mandateStatus))}
            />
          </div>

          <span className="eyebrow">Immutable allocation evidence</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.mandateNumber}
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
              Requests exceeded strategy capacity by{" "}
              {money(Math.abs(snapshot.remainingStrategyCapacityAmount), currency)}.
            </strong>{" "}
            {money(snapshot.requestedAllocationAmount, currency)} was requested against{" "}
            {money(snapshot.strategyPrioritizedCapacityAmount, currency)} of capacity.
          </div>
        </div>
      ) : null}

      {aboveProposed.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(aboveProposed.length, "lineage requested", "lineages requested")} more than
              the capacity proposed for {aboveProposed.length === 1 ? "it" : "them"}.
            </strong>{" "}
            The Requested of capacity column shows them in amber.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no allocation items.</strong> There were no lineages in
            the allocation when it was sealed.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Flywheel allocation snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Allocation at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.allocationUtilizationPct}
            tone="primary"
            caption={`${money(snapshot.requestedAllocationAmount, currency)} requested of ${money(snapshot.strategyPrioritizedCapacityAmount, currency)} strategy capacity (${snapshot.allocationUtilizationPct.toFixed(1)}%)`}
            label="Requested allocation against strategy capacity"
          />

          {proposedTotal > 0 ? (
            <ProgressLine
              pct={requestedVsProposedPct}
              tone="primary"
              caption={`${money(requestedTotal, currency)} requested of ${money(proposedTotal, currency)} proposed across the lineages (${requestedVsProposedPct.toFixed(1)}%)`}
              label="Requested against proposed lineage capacity"
            />
          ) : null}

          <ProgressLine
            pct={((items.length - aboveProposed.length) / items.length) * 100}
            tone={aboveProposed.length === 0 ? meterToneFor("success") : "primary"}
            caption={`${items.length - aboveProposed.length} of ${plural(items.length, "lineage", "lineages")} requested within proposed capacity`}
            label="Lineages requesting within proposed capacity"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen allocation evidence</span>

            <h2>Snapshot items</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Highest priority first, across {plural(items.length, "lineage", "lineages")}. Amounts
            are in {currency}.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.strategyItemId)}
          ariaLabel="Frozen allocation items"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No allocation items"
              description="Snapshot contains no allocation items."
            />
          }
        />
      </section>

      <section className="fwstrategy-method-note">
        <LockKeyhole size={18} />

        <div>
          <strong>Authorization evidence is append-only</strong>

          <p>
            Snapshot headers and allocation rows are protected from UPDATE and DELETE operations
            by database triggers.
          </p>
        </div>
      </section>
    </div>
  );
}
