"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Hourglass,
  Info,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  Scale,
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
  formatDate,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { getFlywheelSettlementSnapshot } from "@/lib/api";
import type { FlywheelSettlementSnapshotDetail } from "@/types/flywheel-settlement";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = FlywheelSettlementSnapshotDetail["items"][number];

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

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function hasVariance(item: SnapshotItem): boolean {
  return Math.abs(item.varianceAmount) > 0.005;
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
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.sourceReleasedAmount,
      cell: (item) => amount(item.sourceReleasedAmount),
    },
    {
      id: "settled",
      header: "Settled",
      align: "right",
      sortValue: (item) => item.settledAmount,
      cell: (item) => <strong>{amount(item.settledAmount)}</strong>,
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => item.varianceAmount,
      cell: (item) => (
        <span className={hasVariance(item) ? "kit-text-warning" : undefined}>
          {amount(item.varianceAmount)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.reconciliationStatus),
      cell: (item) => (
        <StatusBadge
          value={String(item.reconciliationStatus)}
          label={readable(String(item.reconciliationStatus))}
        />
      ),
    },
    {
      id: "reference",
      header: "Reference",
      sortValue: (item) => String(item.evidenceReference ?? "").toLowerCase(),
      cell: (item) =>
        item.evidenceReference ? (
          item.evidenceReference
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "date",
      header: "Date",
      sortValue: (item) => String(item.evidenceDate ?? ""),
      cell: (item) => showDate(item.evidenceDate),
    },
    {
      id: "evidence",
      header: "Evidence",
      sortValue: (item) => String(item.evidenceNote ?? "").toLowerCase(),
      cell: (item) =>
        item.evidenceNote ? (
          <span className="kit-clamp" title={String(item.evidenceNote)}>
            {item.evidenceNote}
          </span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: FlywheelSettlementSnapshotDetail;
}

export default function FlywheelSettlementSnapshotPage() {
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
        const response = await getFlywheelSettlementSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load immutable settlement evidence.",
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
        <Link href="/flywheel-settlement" className="request-back-link">
          <ArrowLeft size={16} />
          Settlement evidence
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
  const unresolved = snapshot.unresolvedCount;
  const totalVariance = snapshot.varianceAmount;
  const variancePresent = Math.abs(totalVariance) > 0.005;

  const withVariance = items.filter(hasVariance);
  const matched = items.length - withVariance.length;
  const noReference = items.filter((item) => !item.evidenceReference);
  const withReference = items.length - noReference.length;

  const orderedItems = [...items].sort(
    (a, b) => Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount),
  );

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-settlement.csv`,
      [
        "Lineage",
        "Lineage number",
        "Released",
        "Settled",
        "Variance",
        "Reconciliation status",
        "Evidence reference",
        "Evidence date",
        "Evidence note",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.rootTargetInitiativeTitle),
        String(item.lineageNumber),
        item.sourceReleasedAmount,
        item.settledAmount,
        item.varianceAmount,
        readable(String(item.reconciliationStatus)),
        String(item.evidenceReference ?? ""),
        String(item.evidenceDate ?? ""),
        String(item.evidenceNote ?? ""),
        currency,
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "item", "items"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Released",
      icon: Banknote,
      value: money(snapshot.sourceReleasedAmount, currency),
      note: "Released at source",
    },
    {
      label: "Settled",
      icon: BadgeCheck,
      value: money(snapshot.settledAmount, currency),
      note: "Settled with evidence",
    },
    {
      label: "Variance",
      icon: Scale,
      value: money(totalVariance, currency),
      note: variancePresent ? "Released and settled differ" : "Released matches settled",
      tone: variancePresent ? "warning" : "default",
    },
    {
      label: "Settlement",
      icon: Gauge,
      value: `${snapshot.settlementPct.toFixed(1)}%`,
      note: "Settled against released",
    },
    {
      label: "Unresolved",
      icon: Hourglass,
      value: String(unresolved),
      note: "Items still unresolved",
      tone: unresolved > 0 ? "warning" : "default",
    },
    {
      label: "Items",
      icon: ListChecks,
      value: String(items.length),
      note: `${withReference} with an evidence reference`,
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link
        href={`/flywheel-settlement/${encodeURIComponent(String(snapshot.settlementCaseId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Reconciliation case
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(snapshot.caseStatus)}
              label={readable(String(snapshot.caseStatus))}
            />
          </div>

          <span className="eyebrow">Immutable settlement evidence</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.reconciliationNumber}
            {" · "}
            {currency}
            {" · "}
            {snapshot.releaseNumber}
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

      {unresolved > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(unresolved, "item was", "items were")} unresolved when the evidence was
              sealed.
            </strong>{" "}
            Settlement stood at {snapshot.settlementPct.toFixed(1)}% of the released amount.
          </div>
        </div>
      ) : null}

      {variancePresent ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              A variance of {money(Math.abs(totalVariance), currency)} remained between released
              and settled amounts.
            </strong>{" "}
            {plural(withVariance.length, "item carried", "items carried")} a variance. The
            Variance column shows them in amber.
          </div>
        </div>
      ) : null}

      {noReference.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(noReference.length, "item had", "items had")} no evidence reference.
            </strong>{" "}
            Their settlement is described only by the evidence note.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no settlement items.</strong> There was no evidence on
            the case when it was sealed.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Flywheel settlement snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Settlement at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.settlementPct}
            tone={snapshot.settlementPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`${money(snapshot.settledAmount, currency)} settled of ${money(snapshot.sourceReleasedAmount, currency)} released (${snapshot.settlementPct.toFixed(1)}%)`}
            label="Settled against released"
          />

          <ProgressLine
            pct={(matched / items.length) * 100}
            tone={matched === items.length ? meterToneFor("success") : "primary"}
            caption={`${matched} of ${plural(items.length, "item", "items")} settled with no variance`}
            label="Items settled with no variance"
          />

          <ProgressLine
            pct={(withReference / items.length) * 100}
            tone={withReference === items.length ? meterToneFor("success") : "primary"}
            caption={`${withReference} of ${plural(items.length, "item", "items")} had an evidence reference`}
            label="Items with an evidence reference"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen settlement evidence</span>

            <h2>Snapshot items</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Largest variance first, across {plural(items.length, "item", "items")}. Amounts are in{" "}
            {currency}.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.releaseItemId)}
          ariaLabel="Frozen settlement items"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No settlement items"
              description="Snapshot contains no settlement items."
            />
          }
        />
      </section>

      <section className="fwstrategy-method-note">
        <LockKeyhole size={18} />

        <div>
          <strong>Settlement evidence is sealed</strong>

          <p>
            Snapshot headers and item evidence cannot be modified after sealing. The database also
            validates snapshot totals against the captured item evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
