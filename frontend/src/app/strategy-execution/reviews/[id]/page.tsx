"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Camera,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Info,
  RefreshCw,
  ShieldAlert,
  Target,
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
import { getStrategyExecutionReview } from "@/lib/api";
import type { ExecutionReviewDetail } from "@/types/strategy-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ReviewCommitment = ExecutionReviewDetail["commitments"][number];

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
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

function buildCommitmentColumns(): Column<ReviewCommitment>[] {
  return [
    {
      id: "commitment",
      header: "Commitment",
      sortValue: (item) => String(item.sourceInitiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.sourceInitiativeTitle}</strong>

          <small>{item.commitmentNumber}</small>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (item) => String(item.ownerName ?? "").toLowerCase(),
      cell: (item) => item.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.status),
      cell: (item) => (
        <StatusBadge value={String(item.status)} label={readable(String(item.status))} />
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
      id: "progress",
      header: "Progress",
      align: "right",
      sortValue: (item) => item.progressPct,
      cell: (item) => <strong>{item.progressPct.toFixed(1)}%</strong>,
    },
    {
      id: "forecast",
      header: "Forecast end",
      sortValue: (item) => String(item.forecastEndDate ?? ""),
      cell: (item) => showDate(item.forecastEndDate),
    },
    {
      id: "blockers",
      header: "Blockers",
      align: "right",
      sortValue: (item) => item.blockerCount,
      cell: (item) => (
        <span className={item.blockerCount > 0 ? "kit-text-warning" : undefined}>
          {item.blockerCount}
        </span>
      ),
    },
    {
      id: "planned",
      header: "Planned",
      align: "right",
      sortValue: (item) => item.plannedContributionPoints,
      cell: (item) => item.plannedContributionPoints.toFixed(1),
    },
    {
      id: "reported",
      header: "Reported",
      align: "right",
      sortValue: (item) => item.reportedContributionPoints,
      cell: (item) => item.reportedContributionPoints.toFixed(1),
    },
    {
      id: "validated",
      header: "Validated",
      align: "right",
      sortValue: (item) => item.validatedContributionPoints,
      cell: (item) => <strong>{item.validatedContributionPoints.toFixed(1)}</strong>,
    },
    {
      id: "var",
      header: "Value at risk",
      align: "right",
      sortValue: (item) => item.valueAtRiskPoints,
      cell: (item) => (
        <span className={item.valueAtRiskPoints > 0.005 ? "kit-text-warning" : undefined}>
          {item.valueAtRiskPoints.toFixed(1)}
        </span>
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 120,
      cell: (item) => (
        <Link
          href={`/strategy-execution/${encodeURIComponent(String(item.id))}`}
          className="table-action"
        >
          Open commitment
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface ReviewData {
  id: string;
  detail: ExecutionReviewDetail;
}

export default function StrategyExecutionReviewPage() {
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
        const response = await getStrategyExecutionReview(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load execution review.");
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
        <Link href="/strategy-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic execution
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

  const { review, summary, commitments } = detail;
  const hasRows = commitments.length > 0;

  const blocked = commitments.filter((commitment) => commitment.blockerCount > 0);
  const totalBlockers = commitments.reduce((sum, commitment) => sum + commitment.blockerCount, 0);
  const atRisk = commitments.filter((commitment) => commitment.valueAtRiskPoints > 0.005);
  const unvalidated = commitments.filter(
    (commitment) =>
      commitment.reportedContributionPoints - commitment.validatedContributionPoints > 0.05,
  );
  const unvalidatedPoints = unvalidated.reduce(
    (sum, commitment) =>
      sum + (commitment.reportedContributionPoints - commitment.validatedContributionPoints),
    0,
  );
  const planned = commitments.reduce(
    (sum, commitment) => sum + commitment.plannedContributionPoints,
    0,
  );
  const validatedPct = planned > 0 ? (summary.validatedContributionPoints / planned) * 100 : 0;
  const varPresent = summary.valueAtRiskPoints > 0.005;

  const orderedCommitments = [...commitments].sort(
    (a, b) => b.valueAtRiskPoints - a.valueAtRiskPoints,
  );
  const topRisk = orderedCommitments.length > 0 ? orderedCommitments[0] : null;

  function exportCommitments() {
    downloadRows(
      `${review.reviewNumber}-execution.csv`,
      [
        "Commitment",
        "Commitment number",
        "Owner",
        "Status",
        "Health",
        "Progress %",
        "Forecast end",
        "Blockers",
        "Planned points",
        "Reported points",
        "Validated points",
        "Value at risk points",
      ],
      orderedCommitments.map((commitment) => [
        String(commitment.sourceInitiativeTitle),
        String(commitment.commitmentNumber),
        String(commitment.ownerName ?? ""),
        readable(String(commitment.status)),
        readable(String(commitment.health)),
        commitment.progressPct,
        String(commitment.forecastEndDate ?? ""),
        commitment.blockerCount,
        commitment.plannedContributionPoints,
        commitment.reportedContributionPoints,
        commitment.validatedContributionPoints,
        commitment.valueAtRiskPoints,
      ]),
    );

    toast.success("Review exported", plural(commitments.length, "commitment", "commitments"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Execution score",
      icon: Gauge,
      value: summary.executionScore.toFixed(1),
      note: readable(String(summary.executionHealth)),
    },
    {
      label: "Average progress",
      icon: Activity,
      value: `${summary.averageProgressPct.toFixed(1)}%`,
      note: "Across the commitments",
    },
    {
      label: "Schedule health",
      icon: CalendarClock,
      value: `${summary.scheduleHealthPct.toFixed(1)}%`,
      note: "Delivery against the plan",
    },
    {
      label: "Outcome validation",
      icon: BadgeCheck,
      value: `${summary.outcomeValidationPct.toFixed(1)}%`,
      note: "Reported outcomes validated",
    },
    {
      label: "Validated contribution",
      icon: Target,
      value: summary.validatedContributionPoints.toFixed(1),
      note: planned > 0 ? `${planned.toFixed(1)} points planned` : "Manager-validated points",
    },
    {
      label: "Value at risk",
      icon: ShieldAlert,
      value: summary.valueAtRiskPoints.toFixed(1),
      note: "Planned points not yet secured",
      tone: varPresent ? "warning" : "default",
    },
  ];

  const commitmentColumns = buildCommitmentColumns();

  return (
    <div className="page-stack">
      <Link href="/strategy-execution" className="request-back-link">
        <ArrowLeft size={16} />
        Strategic execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{review.reviewNumber}</span>

            <StatusBadge
              value={String(summary.executionHealth)}
              label={readable(String(summary.executionHealth))}
            />
          </div>

          <span className="eyebrow">Immutable execution review</span>

          <h1>{review.reviewNumber}</h1>

          <p>
            {review.roadmapNumber}
            {" · "}
            {review.roadmapTitle}
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
            onClick={exportCommitments}
            disabled={!hasRows}
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

      {varPresent ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{summary.valueAtRiskPoints.toFixed(1)} points were at risk at capture.</strong>{" "}
            {plural(atRisk.length, "commitment carried", "commitments carried")} value at risk
            {topRisk !== null && topRisk.valueAtRiskPoints > 0.005
              ? `, the largest being ${topRisk.sourceInitiativeTitle} at ${topRisk.valueAtRiskPoints.toFixed(1)} points.`
              : "."}
          </div>
        </div>
      ) : null}

      {blocked.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(blocked.length, "commitment had", "commitments had")} open blockers.
            </strong>{" "}
            {plural(totalBlockers, "blocker was", "blockers were")} open in total when the review
            was captured.
          </div>
        </div>
      ) : null}

      {unvalidated.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(unvalidated.length, "commitment reported", "commitments reported")}{" "}
              contribution that was not fully validated.
            </strong>{" "}
            {unvalidatedPoints.toFixed(1)} reported points had no validation yet. Only validated
            points count towards the contribution.
          </div>
        </div>
      ) : null}

      {!hasRows ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This review captured no commitments.</strong> There was no execution portfolio
            when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Execution review summary" />

      {hasRows ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Delivery at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={summary.averageProgressPct}
            tone={summary.averageProgressPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average progress ${summary.averageProgressPct.toFixed(1)}% across ${plural(commitments.length, "commitment", "commitments")}`}
            label="Average progress"
          />

          <ProgressLine
            pct={summary.scheduleHealthPct}
            tone={summary.scheduleHealthPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Schedule health ${summary.scheduleHealthPct.toFixed(1)}%`}
            label="Schedule health"
          />

          <ProgressLine
            pct={summary.outcomeValidationPct}
            tone={summary.outcomeValidationPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Outcome validation ${summary.outcomeValidationPct.toFixed(1)}%`}
            label="Outcome validation"
          />

          {planned > 0 ? (
            <ProgressLine
              pct={validatedPct}
              tone={validatedPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${summary.validatedContributionPoints.toFixed(1)} of ${planned.toFixed(1)} planned points validated (${validatedPct.toFixed(1)}%)`}
              label="Validated against planned contribution"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen execution portfolio</span>

            <h2>Commitments at review time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasRows ? (
          <p className="kit-meta-line">
            Most value at risk first, across {plural(commitments.length, "commitment", "commitments")}.
            Open commitment shows the live record, which may have changed since capture.
          </p>
        ) : null}

        <DataTable
          columns={commitmentColumns}
          rows={orderedCommitments}
          getRowId={(commitment) => String(commitment.id)}
          ariaLabel="Frozen execution portfolio"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No commitments captured"
              description="This review has no execution commitments."
            />
          }
        />
      </section>

      <section className="execution-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable execution evidence</strong>

          <p>
            This review freezes commitment health, schedule position, blockers and value
            realization as they existed when the review was captured.
          </p>
        </div>
      </section>
    </div>
  );
}
