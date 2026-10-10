"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Goal,
  Info,
  ListChecks,
  Percent,
  RefreshCw,
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
import { getStrategicAlignmentReview } from "@/lib/api";
import type { AlignmentReviewDetail } from "@/types/strategic-alignment";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ReviewSource = AlignmentReviewDetail["sources"][number];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: Math.abs(value) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
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

function buildSourceColumns(currency: string): Column<ReviewSource>[] {
  return [
    {
      id: "work",
      header: "Work item",
      sortValue: (item) => String(item.sourceTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.sourceTitle}</strong>

          <small>{item.sourceReference}</small>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortValue: (item) => String(item.sourceType),
      cell: (item) => readable(String(item.sourceType)),
    },
    {
      id: "allocation",
      header: "Allocation",
      align: "right",
      sortValue: (item) => item.directAllocationPct,
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong className={item.directAllocationPct > 100.005 ? "kit-text-warning" : undefined}>
            {item.directAllocationPct.toFixed(0)}%
          </strong>

          <StatusBadge
            value={String(item.alignmentStatus)}
            label={readable(String(item.alignmentStatus))}
          />
        </div>
      ),
    },
    {
      id: "objectives",
      header: "Objectives",
      align: "right",
      sortValue: (item) => item.linkedObjectiveCount,
      cell: (item) =>
        item.linkedObjectiveCount === 0 ? (
          <span className="kit-text-warning">0</span>
        ) : (
          item.linkedObjectiveCount
        ),
    },
    {
      id: "value",
      header: "Strategic value",
      align: "right",
      sortValue: (item) => item.strategicValue,
      cell: (item) => money(item.strategicValue, currency),
    },
    {
      id: "risk",
      header: "Risk exposure",
      align: "right",
      sortValue: (item) => item.riskExposure,
      cell: (item) => money(item.riskExposure, currency),
    },
    {
      id: "riskScore",
      header: "Risk score",
      align: "right",
      sortValue: (item) => item.riskScore,
      cell: (item) => item.riskScore.toFixed(1),
    },
    {
      id: "conflicts",
      header: "Conflicts",
      align: "right",
      sortValue: (item) => item.deadlineConflictCount,
      cell: (item) => (
        <span className={item.deadlineConflictCount > 0 ? "kit-text-warning" : undefined}>
          {item.deadlineConflictCount}
        </span>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface ReviewData {
  id: string;
  detail: AlignmentReviewDetail;
}

export default function AlignmentReviewPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const [result, setResult] = useState<ReviewData | null>(null);
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
        const response = await getStrategicAlignmentReview(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load strategic alignment review.",
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
        <Link href="/strategic-alignment" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic alignment
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

  const { review, summary, sources } = detail;
  const currency = review.currency;
  const hasSources = sources.length > 0;

  const unaligned = sources.filter((source) => source.linkedObjectiveCount === 0);
  const overAllocated = sources.filter((source) => source.directAllocationPct > 100.005);
  const conflicts = sources.reduce((sum, source) => sum + source.deadlineConflictCount, 0);
  const totalValue = sources.reduce((sum, source) => sum + source.strategicValue, 0);
  const totalRisk = sources.reduce((sum, source) => sum + source.riskExposure, 0);
  const unalignedValue = unaligned.reduce((sum, source) => sum + source.strategicValue, 0);
  const unalignedRisk = unaligned.reduce((sum, source) => sum + source.riskExposure, 0);

  const orderedSources = [...sources].sort((a, b) => a.directAllocationPct - b.directAllocationPct);

  function exportSources() {
    downloadRows(
      `${review.reviewNumber}-alignment.csv`,
      [
        "Work item",
        "Reference",
        "Type",
        "Allocation %",
        "Alignment status",
        "Linked objectives",
        "Strategic value",
        "Risk exposure",
        "Risk score",
        "Deadline conflicts",
        "Currency",
      ],
      orderedSources.map((source) => [
        String(source.sourceTitle),
        String(source.sourceReference),
        readable(String(source.sourceType)),
        source.directAllocationPct,
        readable(String(source.alignmentStatus)),
        source.linkedObjectiveCount,
        source.strategicValue,
        source.riskExposure,
        source.riskScore,
        source.deadlineConflictCount,
        currency,
      ]),
    );

    toast.success("Review exported", plural(sources.length, "work item", "work items"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Alignment score",
      icon: Gauge,
      value: summary.alignmentScore.toFixed(1),
      note: readable(String(summary.alignmentHealth)),
    },
    {
      label: "Work items",
      icon: ListChecks,
      value: String(sources.length),
      note: "Captured in the portfolio",
    },
    {
      label: "Unaligned work",
      icon: CircleAlert,
      value: String(unaligned.length),
      note: "No linked objective",
      tone: unaligned.length > 0 ? "warning" : "default",
    },
    {
      label: "Over-allocated",
      icon: Percent,
      value: String(overAllocated.length),
      note: "Allocation above 100%",
      tone: overAllocated.length > 0 ? "warning" : "default",
    },
    {
      label: "Deadline conflicts",
      icon: CalendarClock,
      value: String(conflicts),
      note: "Across the work items",
      tone: conflicts > 0 ? "warning" : "default",
    },
    {
      label: "Strategic value",
      icon: Banknote,
      value: money(totalValue, currency),
      note: `${money(totalRisk, currency)} risk exposure`,
    },
  ];

  const coverage: Array<{ label: string; name: string; pct: number }> = [
    { label: "Source coverage", name: "Source coverage", pct: summary.sourceCoveragePct },
    { label: "Objective coverage", name: "Objective coverage", pct: summary.objectiveCoveragePct },
    { label: "Value coverage", name: "Value coverage", pct: summary.valueCoveragePct },
    { label: "Risk coverage", name: "Risk coverage", pct: summary.riskCoveragePct },
    {
      label: "Schedule alignment",
      name: "Schedule alignment",
      pct: summary.scheduleAlignmentPct,
    },
  ];

  const sourceColumns = buildSourceColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/strategic-alignment" className="request-back-link">
        <ArrowLeft size={16} />
        Strategic alignment
      </Link>

      <section className="alignment-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{review.reviewNumber}</span>

            <StatusBadge
              value={String(summary.alignmentHealth)}
              label={readable(String(summary.alignmentHealth))}
            />
          </div>

          <span className="eyebrow">Immutable executive review</span>

          <h1>{review.reviewNumber}</h1>

          <p>
            FY {review.fiscalYear}
            {" · "}
            {currency}
            {" · Captured by "}
            {review.capturedByName ?? "Procurement management"}
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
            onClick={exportSources}
            disabled={!hasSources}
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

      {unaligned.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(unaligned.length, "work item has", "work items have")} no linked objective.
            </strong>{" "}
            {unaligned.length === 1 ? "It carries" : "They carry"}{" "}
            {money(unalignedValue, currency)} of strategic value and{" "}
            {money(unalignedRisk, currency)} of risk exposure.
          </div>
        </div>
      ) : null}

      {overAllocated.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(overAllocated.length, "work item was", "work items were")} allocated above
              100%.
            </strong>{" "}
            Their allocations across objectives added up to more than the work itself.
          </div>
        </div>
      ) : null}

      {conflicts > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(conflicts, "deadline conflict was", "deadline conflicts were")} flagged.
            </strong>{" "}
            Schedule alignment was {summary.scheduleAlignmentPct.toFixed(1)}% at capture.
          </div>
        </div>
      ) : null}

      {!hasSources ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This review captured no work items.</strong> There was no strategic work in the
            portfolio when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Alignment review summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Coverage at capture</h2>
          </div>

          <Gauge size={19} />
        </div>

        {coverage.map((item) => (
          <ProgressLine
            key={item.label}
            pct={item.pct}
            tone={item.pct >= 100 ? meterToneFor("success") : "primary"}
            caption={`${item.name} ${item.pct.toFixed(1)}%`}
            label={item.label}
          />
        ))}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen execution evidence</span>

            <h2>Portfolio alignment</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasSources ? (
          <p className="kit-meta-line">
            Least aligned first, across {plural(sources.length, "work item", "work items")}.
          </p>
        ) : null}

        <DataTable
          columns={sourceColumns}
          rows={orderedSources}
          getRowId={(source) => `${String(source.sourceType)}:${String(source.sourceEntityId)}`}
          ariaLabel="Frozen portfolio alignment"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No work items captured"
              description="This review has no work items."
            />
          }
        />
      </section>

      <section className="alignment-method-note">
        <Goal size={18} />

        <div>
          <strong>Immutable strategic evidence</strong>

          <p>
            This review preserves the alignment state as it existed when captured, even if source
            initiatives, objectives or future mappings later change.
          </p>
        </div>
      </section>
    </div>
  );
}
