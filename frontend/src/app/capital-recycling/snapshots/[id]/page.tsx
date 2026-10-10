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
  Hourglass,
  Info,
  Layers,
  Recycle,
  RefreshCw,
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
import { getCapitalRecyclingSnapshot } from "@/lib/api";
import type { CapitalRecyclingSnapshotDetail } from "@/types/capital-recycling";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = CapitalRecyclingSnapshotDetail["items"][number];

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
      id: "source",
      header: "Source",
      sortValue: (item) => String(item.sourceInitiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.sourceInitiativeTitle}</strong>

          <small>{item.sourceNumber}</small>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.sourceStatus),
      cell: (item) => (
        <StatusBadge
          value={String(item.sourceStatus)}
          label={readable(String(item.sourceStatus))}
        />
      ),
    },
    {
      id: "action",
      header: "Action",
      sortValue: (item) => String(item.sourceAction),
      cell: (item) => (
        <StatusBadge
          value={String(item.sourceAction)}
          label={readable(String(item.sourceAction))}
        />
      ),
    },
    {
      id: "recyclable",
      header: "Recyclable",
      align: "right",
      sortValue: (item) => item.recyclableCapitalAmount,
      cell: (item) => money(item.recyclableCapitalAmount, item.currency),
    },
    {
      id: "approved",
      header: "Approved",
      align: "right",
      sortValue: (item) => item.approvedReinvestmentAmount,
      cell: (item) => money(item.approvedReinvestmentAmount, item.currency),
    },
    {
      id: "pending",
      header: "Pending",
      align: "right",
      sortValue: (item) => item.pendingReinvestmentAmount,
      cell: (item) => money(item.pendingReinvestmentAmount, item.currency),
    },
    {
      id: "available",
      header: "Available",
      align: "right",
      sortValue: (item) => item.availableCapitalAmount,
      cell: (item) => <strong>{money(item.availableCapitalAmount, item.currency)}</strong>,
    },
    {
      id: "utilization",
      header: "Utilization",
      align: "right",
      sortValue: (item) => item.utilizationPct,
      cell: (item) => `${item.utilizationPct.toFixed(1)}%`,
    },
    {
      id: "funding",
      header: "Funding remaining",
      align: "right",
      sortValue: (item) => item.currentFundingRemainingAmount,
      cell: (item) => money(item.currentFundingRemainingAmount, item.currency),
    },
    {
      id: "target",
      header: "Preferred target",
      sortValue: (item) => String(item.preferredTargetValueCaseNumber ?? ""),
      cell: (item) =>
        item.preferredTargetValueCaseNumber ? (
          item.preferredTargetValueCaseNumber
        ) : (
          <span
            className={item.availableCapitalAmount > 0.005 ? "kit-text-warning" : "kit-text-muted"}
          >
            —
          </span>
        ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 100,
      cell: (item) => (
        <Link
          href={`/capital-recycling/${encodeURIComponent(String(item.recyclingSourceId))}`}
          className="table-action"
        >
          Open source
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
  detail: CapitalRecyclingSnapshotDetail;
}

export default function CapitalRecyclingSnapshotPage() {
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
        const response = await getCapitalRecyclingSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load recycling snapshot.",
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
        <Link href="/capital-recycling" className="request-back-link">
          <ArrowLeft size={16} />
          Capital recycling
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
  const sources = snapshot.sourceCount;
  const recyclable = snapshot.totalRecyclableCapitalAmount;
  const approved = snapshot.totalApprovedReinvestmentAmount;

  const noTarget = items.filter(
    (item) => item.availableCapitalAmount > 0.005 && !item.preferredTargetValueCaseNumber,
  );
  const withPending = items.filter((item) => item.pendingReinvestmentAmount > 0.005);
  const allocatedShare = sources > 0 ? (snapshot.fullyAllocatedSourceCount / sources) * 100 : 0;
  const approvedPct = recyclable > 0 ? (approved / recyclable) * 100 : 0;

  const orderedItems = [...items].sort((a, b) => b.availableCapitalAmount - a.availableCapitalAmount);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-sources.csv`,
      [
        "Source",
        "Source number",
        "Status",
        "Action",
        "Recyclable",
        "Approved",
        "Pending",
        "Available",
        "Utilization %",
        "Funding remaining",
        "Preferred target",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.sourceInitiativeTitle),
        String(item.sourceNumber),
        readable(String(item.sourceStatus)),
        readable(String(item.sourceAction)),
        item.recyclableCapitalAmount,
        item.approvedReinvestmentAmount,
        item.pendingReinvestmentAmount,
        item.availableCapitalAmount,
        item.utilizationPct,
        item.currentFundingRemainingAmount,
        String(item.preferredTargetValueCaseNumber ?? ""),
        String(item.currency ?? ""),
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "source", "sources"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Sources",
      icon: Layers,
      value: String(sources),
      note: "Recycling sources captured",
    },
    {
      label: "Open",
      icon: Hourglass,
      value: String(snapshot.openSourceCount),
      note: "Sources still open",
    },
    {
      label: "Fully allocated",
      icon: BadgeCheck,
      value: String(snapshot.fullyAllocatedSourceCount),
      note: "Nothing left to reinvest",
    },
    {
      label: "Recyclable",
      icon: Recycle,
      value: money(recyclable),
      note: "Verified recyclable capital",
    },
    {
      label: "Approved",
      icon: Coins,
      value: money(approved),
      note: "Approved reinvestment",
    },
    {
      label: "Available",
      icon: WalletCards,
      value: money(snapshot.totalAvailableCapitalAmount),
      note: "Balance still to reinvest",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/capital-recycling" className="request-back-link">
        <ArrowLeft size={16} />
        Capital recycling
      </Link>

      <section className="recycling-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable recycling portfolio</span>

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

      {noTarget.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(noTarget.length, "source held", "sources held")} available capital with no
              preferred target.
            </strong>{" "}
            That capital had nowhere nominated to go. The Preferred target column marks them in
            amber.
          </div>
        </div>
      ) : null}

      {withPending.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(withPending.length, "source had", "sources had")} pending reinvestment
              proposals.
            </strong>{" "}
            Pending amounts are not yet approved, so they still count as available.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no recycling sources.</strong> There was no recycling
            portfolio when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Capital recycling snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Reinvestment at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          {sources > 0 ? (
            <ProgressLine
              pct={allocatedShare}
              tone={allocatedShare >= 100 ? meterToneFor("success") : "primary"}
              caption={`${snapshot.fullyAllocatedSourceCount} of ${plural(sources, "source", "sources")} were fully allocated`}
              label="Fully allocated sources"
            />
          ) : null}

          {recyclable > 0 ? (
            <ProgressLine
              pct={approvedPct}
              tone={approvedPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${money(approved)} approved of ${money(recyclable)} recyclable (${approvedPct.toFixed(1)}%)`}
              label="Approved reinvestment against recyclable capital"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen recycling state</span>

            <h2>Source utilization at capture time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Most available capital first, across {plural(items.length, "source", "sources")}.
            Open source shows the live record, which may have changed since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.recyclingSourceId)}
          ariaLabel="Frozen recycling sources"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No sources captured"
              description="This snapshot has no recycling sources."
            />
          }
        />
      </section>

      <section className="recycling-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable capital-recycling evidence</strong>

          <p>
            This snapshot freezes verified recyclable capital, approved reinvestment, pending
            proposals, available balance and current Step 58 funding safety context.
          </p>
        </div>
      </section>
    </div>
  );
}
