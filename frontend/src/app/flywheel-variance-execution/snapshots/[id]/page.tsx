"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
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
  ShieldAlert,
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
import { getFlywheelVarianceExecutionSnapshot } from "@/lib/api";
import type { FlywheelVarianceExecutionSnapshotDetail } from "@/types/flywheel-variance-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = FlywheelVarianceExecutionSnapshotDetail["items"][number];

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
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.sourceDecision),
      cell: (item) => (
        <StatusBadge
          value={String(item.sourceDecision)}
          label={readable(String(item.sourceDecision))}
        />
      ),
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => item.sourceVarianceAmount,
      cell: (item) => amount(item.sourceVarianceAmount),
    },
    {
      id: "executed",
      header: "Executed",
      align: "right",
      sortValue: (item) => item.executedAmount,
      cell: (item) => <strong>{amount(item.executedAmount)}</strong>,
    },
    {
      id: "outcome",
      header: "Outcome",
      sortValue: (item) => String(item.outcome),
      cell: (item) => (
        <StatusBadge value={String(item.outcome)} label={readable(String(item.outcome))} />
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
          <span className={item.executedAmount > 0.005 ? "kit-text-warning" : "kit-text-muted"}>
            —
          </span>
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
  detail: FlywheelVarianceExecutionSnapshotDetail;
}

export default function FlywheelVarianceExecutionSnapshotPage() {
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
        const response = await getFlywheelVarianceExecutionSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load execution snapshot.",
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
        <Link href="/flywheel-variance-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Treatment execution
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
  const exposure = snapshot.exposure;
  const hasItems = items.length > 0;

  const variance = snapshot.sourceVarianceAmount;
  const residual = exposure.financialResidualAmount;
  const unrecorded = exposure.unrecordedVarianceAmount;
  const recordedTotal = snapshot.recoveredAmount + snapshot.writtenOffAmount;
  const recordedPct = variance > 0 ? (recordedTotal / variance) * 100 : 0;
  const residualPresent = residual > 0.005;
  const unrecordedPresent = unrecorded > 0.005;

  const unreferenced = items.filter(
    (item) => item.executedAmount > 0.005 && !item.evidenceReference,
  );
  const withReference = items.filter((item) => Boolean(item.evidenceReference)).length;

  const orderedItems = [...items].sort((a, b) => b.sourceVarianceAmount - a.sourceVarianceAmount);

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-treatment-execution.csv`,
      [
        "Lineage",
        "Lineage number",
        "Decision",
        "Variance",
        "Executed",
        "Outcome",
        "Evidence reference",
        "Evidence date",
        "Evidence note",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.rootTargetInitiativeTitle),
        String(item.lineageNumber),
        readable(String(item.sourceDecision)),
        item.sourceVarianceAmount,
        item.executedAmount,
        readable(String(item.outcome)),
        String(item.evidenceReference ?? ""),
        String(item.evidenceDate ?? ""),
        String(item.evidenceNote ?? ""),
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
      note: "Approved variance",
    },
    {
      label: "Recovered",
      icon: Coins,
      value: money(snapshot.recoveredAmount, currency),
      note: "Recorded recoveries",
    },
    {
      label: "Written off",
      icon: Scale,
      value: money(snapshot.writtenOffAmount, currency),
      note: "Recorded write-offs",
    },
    {
      label: "Investigation complete",
      icon: BadgeCheck,
      value: money(snapshot.completedInvestigationAmount, currency),
      note: "Does not reduce the residual",
    },
    {
      label: "Financial residual",
      icon: ShieldAlert,
      value: money(residual, currency),
      note: residualPresent ? "Still open at capture" : "Fully recorded",
      tone: residualPresent ? "warning" : "default",
    },
    {
      label: "Treatment completion",
      icon: Gauge,
      value: `${snapshot.completionPct.toFixed(1)}%`,
      note: "Workflow progress",
    },
  ];

  const evidenceKpis: KpiItem[] = [
    {
      label: "Unrecorded variance",
      icon: AlertTriangle,
      value: money(unrecorded, currency),
      note: unrecordedPresent ? "Variance without recorded evidence" : "All variance has evidence",
      tone: unrecordedPresent ? "warning" : "default",
    },
    {
      label: "Evidence coverage",
      icon: ListChecks,
      value: `${exposure.evidenceCoveragePct.toFixed(1)}%`,
      note: "Recorded evidence against variance",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link
        href={`/flywheel-variance-execution/${encodeURIComponent(String(snapshot.executionCaseId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Execution case
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable treatment evidence</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.executionNumber}
            {" · "}
            {currency}
            {" · "}
            {snapshot.variancePlanNumber}
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

      {residualPresent ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{money(residual, currency)} of financial residual remained.</strong> That is
            approved variance less recorded recoveries and write-offs. Completing an
            investigation does not reduce it.
          </div>
        </div>
      ) : null}

      {unrecordedPresent ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {money(unrecorded, currency)} of variance had no recorded evidence.
            </strong>{" "}
            Evidence coverage was {exposure.evidenceCoveragePct.toFixed(1)}% at capture.
          </div>
        </div>
      ) : null}

      {unreferenced.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(unreferenced.length, "executed item had", "executed items had")} no
              evidence reference.
            </strong>{" "}
            The Reference column marks {unreferenced.length === 1 ? "it" : "them"} in amber.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no treatment items.</strong> There was no execution
            evidence on the case when it was sealed.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Treatment execution snapshot summary" />

      <KpiGrid items={evidenceKpis} ariaLabel="Treatment execution evidence summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Treatment at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={snapshot.completionPct}
            tone={snapshot.completionPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Treatment completion ${snapshot.completionPct.toFixed(1)}% (workflow progress, not cash recovered)`}
            label="Treatment completion"
          />

          {variance > 0 ? (
            <ProgressLine
              pct={recordedPct}
              tone={recordedPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${money(recordedTotal, currency)} recovered or written off of ${money(variance, currency)} approved variance (${recordedPct.toFixed(1)}%)`}
              label="Recoveries and write-offs against approved variance"
            />
          ) : null}

          <ProgressLine
            pct={exposure.evidenceCoveragePct}
            tone={exposure.evidenceCoveragePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Evidence coverage ${exposure.evidenceCoveragePct.toFixed(1)}%`}
            label="Evidence coverage"
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
            <span className="eyebrow">Frozen treatment execution</span>

            <h2>Snapshot evidence</h2>
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
          getRowId={(item) => String(item.varianceItemId)}
          ariaLabel="Frozen treatment execution evidence"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No treatment items"
              description="Snapshot contains no treatment execution items."
            />
          }
        />
      </section>

      <section className="fwstrategy-method-note">
        <LockKeyhole size={18} />

        <div>
          <strong>Financial residual and evidence coverage</strong>

          <p>
            Financial residual equals approved variance minus recorded recoveries and recorded
            write-offs. Completing an investigation does not reduce that residual. Treatment
            completion measures workflow progress, not cash recovered or accounting entries
            posted by ProcureIQ.
          </p>

          <p>
            These additional metrics use only the captured amounts in this snapshot. Its stored
            evidence and original treatment metrics are unchanged.
          </p>
        </div>
      </section>
    </div>
  );
}
