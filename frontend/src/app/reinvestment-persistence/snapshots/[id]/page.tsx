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
  ShieldCheck,
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
import { getReinvestmentPersistenceSnapshot } from "@/lib/api";
import type { ReinvestmentPersistenceSnapshotDetail } from "@/types/reinvestment-persistence";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = ReinvestmentPersistenceSnapshotDetail["items"][number];

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

/** Assessed cases first, lowest value persistence first; unassessed cases last. */
function byPersistence(a: SnapshotItem, b: SnapshotItem): number {
  if (a.assessed !== b.assessed) {
    return a.assessed ? -1 : 1;
  }

  return a.valuePersistencePct - b.valuePersistencePct;
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

          <small>{item.persistenceCaseNumber}</small>
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
      id: "baselineAnnual",
      header: "Baseline annual",
      align: "right",
      sortValue: (item) => item.baselineAnnualizedValueAmount,
      cell: (item) => money(item.baselineAnnualizedValueAmount, item.currency),
    },
    {
      id: "currentAnnual",
      header: "Current annual",
      align: "right",
      sortValue: (item) => (item.assessed ? item.currentAnnualizedValueAmount : null),
      cell: (item) =>
        item.assessed ? money(item.currentAnnualizedValueAmount, item.currency) : <Dash />,
    },
    {
      id: "baselineNet",
      header: "Baseline net",
      align: "right",
      sortValue: (item) => item.baselineNetValueAmount,
      cell: (item) => money(item.baselineNetValueAmount, item.currency),
    },
    {
      id: "projectedNet",
      header: "Projected net",
      align: "right",
      sortValue: (item) => (item.assessed ? item.currentProjectedNetValueAmount : null),
      cell: (item) =>
        item.assessed ? (
          <strong
            className={item.currentProjectedNetValueAmount < -0.005 ? "kit-text-danger" : undefined}
          >
            {money(item.currentProjectedNetValueAmount, item.currency)}
          </strong>
        ) : (
          <Dash />
        ),
    },
    {
      id: "baselineRoi",
      header: "Baseline ROI",
      align: "right",
      sortValue: (item) => item.baselineRoiPct,
      cell: (item) => `${item.baselineRoiPct.toFixed(1)}%`,
    },
    {
      id: "projectedRoi",
      header: "Projected ROI",
      align: "right",
      sortValue: (item) => (item.assessed ? item.currentProjectedRoiPct : null),
      cell: (item) =>
        item.assessed ? (
          <span className={item.currentProjectedRoiPct < 0 ? "kit-text-danger" : undefined}>
            {item.currentProjectedRoiPct.toFixed(1)}%
          </span>
        ) : (
          <Dash />
        ),
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (item) => (item.assessed ? item.valuePersistencePct : null),
      cell: (item) =>
        item.assessed ? <strong>{item.valuePersistencePct.toFixed(1)}%</strong> : <Dash />,
    },
    {
      id: "efficiency",
      header: "Efficiency",
      align: "right",
      sortValue: (item) => (item.assessed ? item.efficiencyRetentionPct : null),
      cell: (item) => (item.assessed ? `${item.efficiencyRetentionPct.toFixed(1)}%` : <Dash />),
    },
    {
      id: "compounding",
      header: "Compounding",
      align: "right",
      sortValue: (item) => (item.assessed ? item.compoundingValueAmount : null),
      cell: (item) =>
        item.assessed ? money(item.compoundingValueAmount, item.currency) : <Dash />,
    },
    {
      id: "decay",
      header: "Decay",
      align: "right",
      sortValue: (item) => (item.assessed ? item.decayedValueAmount : null),
      cell: (item) =>
        item.assessed ? (
          <span className={item.decayedValueAmount > 0.005 ? "kit-text-warning" : undefined}>
            {money(item.decayedValueAmount, item.currency)}
          </span>
        ) : (
          <Dash />
        ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link
          href={`/reinvestment-persistence/${encodeURIComponent(String(item.persistenceCaseId))}`}
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
  detail: ReinvestmentPersistenceSnapshotDetail;
}

export default function ReinvestmentPersistenceSnapshotPage() {
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
        const response = await getReinvestmentPersistenceSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load persistence snapshot.",
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
        <Link href="/reinvestment-persistence" className="request-back-link">
          <ArrowLeft size={16} />
          Reinvestment persistence
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
  const regressed = snapshot.regressedCaseCount;
  const unassessed = items.filter((item) => !item.assessed);
  const withDecay = items.filter((item) => item.assessed && item.decayedValueAmount > 0.005);
  const notRegressed = Math.max(0, cases - regressed);

  const orderedItems = [...items].sort(byPersistence);
  const first = orderedItems.length > 0 ? orderedItems[0] : null;
  const lowest = first !== null && first.assessed ? first : null;

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-persistence.csv`,
      [
        "Target",
        "Persistence case number",
        "Status",
        "Health",
        "Baseline annualized value",
        "Assessed",
        "Current annualized value",
        "Baseline net value",
        "Projected net value",
        "Baseline ROI %",
        "Projected ROI %",
        "Value persistence %",
        "Efficiency retention %",
        "Compounding value",
        "Decayed value",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.targetInitiativeTitle),
        String(item.persistenceCaseNumber),
        readable(String(item.caseStatus)),
        readable(String(item.health)),
        item.baselineAnnualizedValueAmount,
        item.assessed ? "Yes" : "No",
        item.assessed ? item.currentAnnualizedValueAmount : "",
        item.baselineNetValueAmount,
        item.assessed ? item.currentProjectedNetValueAmount : "",
        item.baselineRoiPct,
        item.assessed ? item.currentProjectedRoiPct : "",
        item.assessed ? item.valuePersistencePct : "",
        item.assessed ? item.efficiencyRetentionPct : "",
        item.assessed ? item.compoundingValueAmount : "",
        item.assessed ? item.decayedValueAmount : "",
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
      note: "Persistence cases captured",
    },
    {
      label: "Compounding",
      icon: TrendingUp,
      value: String(snapshot.compoundingCaseCount),
      note: "Cases growing in value",
    },
    {
      label: "Sustained",
      icon: BadgeCheck,
      value: String(snapshot.sustainedCaseCount),
      note: "Cases holding their value",
    },
    {
      label: "Regressed",
      icon: TrendingDown,
      value: String(regressed),
      note: "Cases losing value",
      tone: regressed > 0 ? "warning" : "default",
    },
    {
      label: "Efficiency",
      icon: Gauge,
      value: `${snapshot.averageEfficiencyRetentionPct.toFixed(1)}%`,
      note: "Average efficiency retention",
    },
    {
      label: "Persistence",
      icon: ShieldCheck,
      value: `${snapshot.averageValuePersistencePct.toFixed(1)}%`,
      note: "Average value persistence",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/reinvestment-persistence" className="request-back-link">
        <ArrowLeft size={16} />
        Reinvestment persistence
      </Link>

      <section className="rpersist-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable persistence portfolio</span>

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

      {regressed > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{plural(regressed, "case had", "cases had")} regressed at capture.</strong>
            {lowest !== null
              ? ` The lowest value persistence was ${lowest.targetInitiativeTitle} at ${lowest.valuePersistencePct.toFixed(1)}%.`
              : ""}
          </div>
        </div>
      ) : null}

      {withDecay.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(withDecay.length, "case carried", "cases carried")} decayed value.
            </strong>{" "}
            The Decay column shows {withDecay.length === 1 ? "it" : "them"} in amber.
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
            Current figures show a dash for {unassessed.length === 1 ? "it" : "them"}, and{" "}
            {unassessed.length === 1 ? "it sorts" : "they sort"} last.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no cases.</strong> There was no persistence portfolio
            when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Reinvestment persistence snapshot summary" />

      {hasItems && cases > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Durability at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.averageValuePersistencePct}
            tone={snapshot.averageValuePersistencePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average value persistence ${snapshot.averageValuePersistencePct.toFixed(1)}%`}
            label="Average value persistence"
          />

          <ProgressLine
            pct={snapshot.averageEfficiencyRetentionPct}
            tone={
              snapshot.averageEfficiencyRetentionPct >= 100 ? meterToneFor("success") : "primary"
            }
            caption={`Average efficiency retention ${snapshot.averageEfficiencyRetentionPct.toFixed(1)}%`}
            label="Average efficiency retention"
          />

          <ProgressLine
            pct={(notRegressed / cases) * 100}
            tone={regressed === 0 ? meterToneFor("success") : "primary"}
            caption={`${notRegressed} of ${plural(cases, "case", "cases")} had not regressed`}
            label="Cases that had not regressed"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen recycling effectiveness</span>

            <h2>Durable value at capture time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Lowest value persistence first, across {plural(items.length, "case", "cases")}.
            Amounts show the currency of each case. Open case shows the live record, which may
            have changed since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.persistenceCaseId)}
          ariaLabel="Frozen durable value"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No cases captured"
              description="This snapshot has no persistence cases."
            />
          }
        />
      </section>

      <section className="rpersist-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable recycling-effectiveness evidence</strong>

          <p>
            This snapshot freezes durable value, efficiency retention, projected ROI, compounding
            and decay without modifying any Step 56–64 authority.
          </p>
        </div>
      </section>
    </div>
  );
}
