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
  Scale,
  Search,
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
import { getFlywheelVarianceSnapshot } from "@/lib/api";
import type { FlywheelVarianceSnapshotDetail } from "@/types/flywheel-variance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = FlywheelVarianceSnapshotDetail["items"][number];

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
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => item.sourceVarianceAmount,
      cell: (item) => <strong>{amount(item.sourceVarianceAmount)}</strong>,
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => (
        <StatusBadge value={String(item.decision)} label={readable(String(item.decision))} />
      ),
    },
    {
      id: "target",
      header: "Target",
      sortValue: (item) => String(item.targetDate ?? ""),
      cell: (item) => showDate(item.targetDate),
    },
    {
      id: "rationale",
      header: "Rationale",
      sortValue: (item) => String(item.decisionRationale ?? "").toLowerCase(),
      cell: (item) =>
        item.decisionRationale ? (
          <span className="kit-clamp" title={String(item.decisionRationale)}>
            {item.decisionRationale}
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
  detail: FlywheelVarianceSnapshotDetail;
}

export default function FlywheelVarianceSnapshotPage() {
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
        const response = await getFlywheelVarianceSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load variance evidence.");
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
        <Link href="/flywheel-variance" className="request-back-link">
          <ArrowLeft size={16} />
          Variance resolution
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

  const variance = snapshot.sourceVarianceAmount;
  const recover = snapshot.recoverAmount;
  const writeOff = snapshot.writeOffAmount;
  const investigation = snapshot.investigationAmount;
  const treated = recover + writeOff + investigation;
  const gap = variance - treated;
  const untreated = gap > 0.005;
  const overTreated = gap < -0.005;

  function sharePct(value: number): number {
    return variance > 0 ? (value / variance) * 100 : 0;
  }

  function shareNote(value: number): string {
    return variance > 0 ? `${sharePct(value).toFixed(1)}% of source variance` : "Approved amount";
  }

  const orderedItems = [...items].sort((a, b) => b.sourceVarianceAmount - a.sourceVarianceAmount);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-variance.csv`,
      ["Lineage", "Lineage number", "Variance", "Decision", "Target date", "Rationale", "Currency"],
      orderedItems.map((item) => [
        String(item.rootTargetInitiativeTitle),
        String(item.lineageNumber),
        item.sourceVarianceAmount,
        readable(String(item.decision)),
        String(item.targetDate ?? ""),
        String(item.decisionRationale ?? ""),
        currency,
      ]),
    );

    toast.success("Snapshot exported", plural(items.length, "lineage", "lineages"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Source variance",
      icon: Banknote,
      value: money(variance, currency),
      note: "Variance to be treated",
    },
    {
      label: "Recovery",
      icon: Coins,
      value: money(recover, currency),
      note: shareNote(recover),
    },
    {
      label: "Write-off",
      icon: Scale,
      value: money(writeOff, currency),
      note: shareNote(writeOff),
    },
    {
      label: "Investigation",
      icon: Search,
      value: money(investigation, currency),
      note: shareNote(investigation),
    },
    {
      label: "Coverage",
      icon: Gauge,
      value: `${snapshot.coveragePct.toFixed(1)}%`,
      note: "Treatment against variance",
      tone: untreated ? "warning" : "default",
    },
    {
      label: "Lineages",
      icon: ListChecks,
      value: String(items.length),
      note: "With a treatment decision",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link
        href={`/flywheel-variance/${encodeURIComponent(String(snapshot.variancePlanId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Variance plan
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(snapshot.planStatus)}
              label={readable(String(snapshot.planStatus))}
            />
          </div>

          <span className="eyebrow">Immutable variance evidence</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.planNumber}
            {" · "}
            {currency}
            {" · "}
            {snapshot.reconciliationNumber}
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

      {untreated ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{money(gap, currency)} of source variance had no approved treatment.</strong>{" "}
            Recovery, write-off and investigation added up to {money(treated, currency)} against{" "}
            {money(variance, currency)}.
          </div>
        </div>
      ) : null}

      {overTreated ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              Approved treatment exceeded the source variance by {money(Math.abs(gap), currency)}.
            </strong>{" "}
            Recovery, write-off and investigation added up to {money(treated, currency)} against{" "}
            {money(variance, currency)}.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no treatment decisions.</strong> There were no lineages
            on the plan when it was sealed.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Flywheel variance snapshot summary" />

      {hasItems && variance > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Treatment mix at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.coveragePct}
            tone={snapshot.coveragePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Coverage ${snapshot.coveragePct.toFixed(1)}% of source variance`}
            label="Treatment coverage"
          />

          <ProgressLine
            pct={sharePct(recover)}
            tone="primary"
            caption={`Recovery ${money(recover, currency)} (${sharePct(recover).toFixed(1)}%)`}
            label="Recovery share of source variance"
          />

          <ProgressLine
            pct={sharePct(writeOff)}
            tone="primary"
            caption={`Write-off ${money(writeOff, currency)} (${sharePct(writeOff).toFixed(1)}%)`}
            label="Write-off share of source variance"
          />

          <ProgressLine
            pct={sharePct(investigation)}
            tone="primary"
            caption={`Investigation ${money(investigation, currency)} (${sharePct(investigation).toFixed(1)}%)`}
            label="Investigation share of source variance"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen treatment authority</span>

            <h2>Snapshot decisions</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Largest variance first, across {plural(items.length, "lineage", "lineages")}. Amounts
            are in {currency}.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.settlementItemId)}
          ariaLabel="Frozen treatment decisions"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No treatment decisions"
              description="Snapshot contains no treatment decisions."
            />
          }
        />
      </section>

      <section className="fwstrategy-method-note">
        <LockKeyhole size={18} />

        <div>
          <strong>Treatment evidence is sealed</strong>

          <p>
            The snapshot preserves the approved treatment mix and cannot be rewritten after
            sealing.
          </p>
        </div>
      </section>
    </div>
  );
}
