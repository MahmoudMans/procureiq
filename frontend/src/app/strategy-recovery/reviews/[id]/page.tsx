"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Info,
  RefreshCw,
  ShieldAlert,
  Target,
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
import { getStrategyRecoveryReview } from "@/lib/api";
import type { RecoveryReviewDetail } from "@/types/strategy-recovery";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ReviewCase = RecoveryReviewDetail["cases"][number];

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

function buildCaseColumns(): Column<ReviewCase>[] {
  return [
    {
      id: "recovery",
      header: "Recovery",
      sortValue: (item) => String(item.initiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.initiativeTitle}</strong>

          <small>
            {item.recoveryNumber} · {item.commitmentNumber}
          </small>
        </div>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      sortValue: (item) => String(item.severity),
      cell: (item) => (
        <StatusBadge value={String(item.severity)} label={readable(String(item.severity))} />
      ),
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
      id: "owner",
      header: "Owner",
      sortValue: (item) => String(item.recoveryOwnerName ?? "").toLowerCase(),
      cell: (item) => item.recoveryOwnerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "baselineRisk",
      header: "Baseline risk",
      align: "right",
      sortValue: (item) => item.baselineRiskScore,
      cell: (item) => item.baselineRiskScore.toFixed(1),
    },
    {
      id: "currentRisk",
      header: "Current risk",
      align: "right",
      sortValue: (item) => item.currentRiskScore,
      cell: (item) => (
        <strong
          className={
            item.currentRiskScore > item.baselineRiskScore + 0.05 ? "kit-text-warning" : undefined
          }
        >
          {item.currentRiskScore.toFixed(1)}
        </strong>
      ),
    },
    {
      id: "effectiveness",
      header: "Effectiveness",
      align: "right",
      sortValue: (item) => item.effectivenessPct,
      cell: (item) => `${item.effectivenessPct.toFixed(1)}%`,
    },
    {
      id: "score",
      header: "Recovery score",
      align: "right",
      sortValue: (item) => item.recoveryScore,
      cell: (item) => <strong>{item.recoveryScore.toFixed(1)}</strong>,
    },
    {
      id: "var",
      header: "Value at risk",
      align: "right",
      sortValue: (item) => item.currentValueAtRiskPoints,
      cell: (item) => (
        <span className={item.currentValueAtRiskPoints > 0.005 ? "kit-text-warning" : undefined}>
          {item.currentValueAtRiskPoints.toFixed(1)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      sortValue: (item) => item.overdueActionCount * 1000 + item.openActionCount,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{item.openActionCount} open</span>

          <small className={item.overdueActionCount > 0 ? "kit-text-warning" : undefined}>
            {item.overdueActionCount} overdue
          </small>
        </div>
      ),
    },
    {
      id: "escalations",
      header: "Escalations",
      align: "right",
      sortValue: (item) => item.escalationCount,
      cell: (item) => (
        <span className={item.escalationCount > 0 ? "kit-text-warning" : undefined}>
          {item.escalationCount}
        </span>
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 110,
      cell: (item) => (
        <Link
          href={`/strategy-recovery/${encodeURIComponent(String(item.id))}`}
          className="table-action"
        >
          Open recovery
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
  detail: RecoveryReviewDetail;
}

export default function StrategyRecoveryReviewPage() {
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
        const response = await getStrategyRecoveryReview(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load recovery review.");
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
        <Link href="/strategy-recovery" className="request-back-link">
          <ArrowLeft size={16} />
          Execution recovery
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

  const { review, cases } = detail;
  const hasRows = cases.length > 0;

  const baselineVar = review.totalBaselineValueAtRiskPoints;
  const currentVar = review.totalCurrentValueAtRiskPoints;
  const recovered = baselineVar - currentVar;
  const recoveredPct = baselineVar > 0 ? (recovered / baselineVar) * 100 : 0;
  const varPresent = currentVar > 0.005;
  const worse = cases.filter((item) => item.currentRiskScore > item.baselineRiskScore + 0.05);
  const openActions = cases.reduce((sum, item) => sum + item.openActionCount, 0);
  const overdueActions = cases.reduce((sum, item) => sum + item.overdueActionCount, 0);
  const critical = review.criticalCaseCount;
  const escalations = review.escalationCount;

  const orderedCases = [...cases].sort(
    (a, b) => b.currentValueAtRiskPoints - a.currentValueAtRiskPoints,
  );
  const topRisk = orderedCases.length > 0 ? orderedCases[0] : null;

  let varNote = "Unchanged from baseline";

  if (recovered > 0.005) {
    varNote = `${recovered.toFixed(1)} points recovered`;
  } else if (recovered < -0.005) {
    varNote = `${Math.abs(recovered).toFixed(1)} points above baseline`;
  }

  function exportCases() {
    downloadRows(
      `${review.reviewNumber}-recovery.csv`,
      [
        "Recovery",
        "Recovery number",
        "Commitment",
        "Severity",
        "Status",
        "Owner",
        "Baseline risk",
        "Current risk",
        "Effectiveness %",
        "Recovery score",
        "Value at risk points",
        "Open actions",
        "Overdue actions",
        "Escalations",
      ],
      orderedCases.map((item) => [
        String(item.initiativeTitle),
        String(item.recoveryNumber),
        String(item.commitmentNumber),
        readable(String(item.severity)),
        readable(String(item.status)),
        String(item.recoveryOwnerName ?? ""),
        item.baselineRiskScore,
        item.currentRiskScore,
        item.effectivenessPct,
        item.recoveryScore,
        item.currentValueAtRiskPoints,
        item.openActionCount,
        item.overdueActionCount,
        item.escalationCount,
      ]),
    );

    toast.success("Review exported", plural(cases.length, "recovery case", "recovery cases"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Portfolio health",
      icon: Gauge,
      value: readable(String(review.portfolioHealth)),
      note: `${review.averageRecoveryScore.toFixed(1)} / 100 average recovery score`,
    },
    {
      label: "Average effectiveness",
      icon: Activity,
      value: `${review.averageEffectivenessPct.toFixed(1)}%`,
      note: "Across the recovery cases",
    },
    {
      label: "Baseline VAR",
      icon: Target,
      value: baselineVar.toFixed(1),
      note: "Value at risk when recovery began",
    },
    {
      label: "Current VAR",
      icon: ShieldAlert,
      value: currentVar.toFixed(1),
      note: varNote,
      tone: varPresent ? "warning" : "default",
    },
    {
      label: "Critical cases",
      icon: AlertTriangle,
      value: String(critical),
      note: "Critical severity at capture",
      tone: critical > 0 ? "warning" : "default",
    },
    {
      label: "Escalations",
      icon: TrendingUp,
      value: String(escalations),
      note: "Raised across the portfolio",
      tone: escalations > 0 ? "warning" : "default",
    },
  ];

  const caseColumns = buildCaseColumns();

  return (
    <div className="page-stack">
      <Link href="/strategy-recovery" className="request-back-link">
        <ArrowLeft size={16} />
        Execution recovery
      </Link>

      <section className="recovery-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{review.reviewNumber}</span>

            <StatusBadge
              value={String(review.portfolioHealth)}
              label={readable(String(review.portfolioHealth))}
            />
          </div>

          <span className="eyebrow">Immutable strategic recovery review</span>

          <h1>{review.reviewNumber}</h1>

          <p>
            Captured by {review.capturedByName ?? "Procurement management"}
            {review.capturedAt ? ` · ${formatDateTime(review.capturedAt)}` : ""}
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
            onClick={exportCases}
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

      {critical > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(critical, "recovery case was", "recovery cases were")} critical at capture.
            </strong>{" "}
            {varPresent
              ? `${currentVar.toFixed(1)} points of value were still at risk.`
              : "No value was left at risk."}
          </div>
        </div>
      ) : null}

      {overdueActions > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(overdueActions, "corrective action was", "corrective actions were")} overdue.
            </strong>{" "}
            {plural(openActions, "action was", "actions were")} open in total when the review was
            captured.
          </div>
        </div>
      ) : null}

      {worse.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(worse.length, "case had", "cases had")} a higher risk than its baseline.
            </strong>{" "}
            Recovery had not reduced the risk there yet. The Current risk column shows them in
            amber.
          </div>
        </div>
      ) : null}

      {escalations > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{plural(escalations, "escalation was", "escalations were")} on record.</strong>{" "}
            {topRisk !== null && topRisk.currentValueAtRiskPoints > 0.005
              ? `The largest value at risk was ${topRisk.initiativeTitle} at ${topRisk.currentValueAtRiskPoints.toFixed(1)} points.`
              : "The table shows which cases carried them."}
          </div>
        </div>
      ) : null}

      {!hasRows ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This review captured no recovery cases.</strong> There was no recovery
            portfolio when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Recovery review summary" />

      {hasRows ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Recovery at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={review.averageRecoveryScore}
            tone={review.averageRecoveryScore >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average recovery score ${review.averageRecoveryScore.toFixed(1)} of 100`}
            label="Average recovery score"
          />

          <ProgressLine
            pct={review.averageEffectivenessPct}
            tone={review.averageEffectivenessPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Average effectiveness ${review.averageEffectivenessPct.toFixed(1)}%`}
            label="Average effectiveness"
          />

          {baselineVar > 0 ? (
            <ProgressLine
              pct={recoveredPct}
              tone={recoveredPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${recovered.toFixed(1)} of ${baselineVar.toFixed(1)} baseline VAR points recovered (${recoveredPct.toFixed(1)}%)`}
              label="Value at risk recovered against the baseline"
            />
          ) : null}

          {openActions > 0 ? (
            <ProgressLine
              pct={((openActions - overdueActions) / openActions) * 100}
              tone={overdueActions === 0 ? meterToneFor("success") : "primary"}
              caption={`${openActions - overdueActions} of ${plural(openActions, "open action", "open actions")} were on time`}
              label="Open corrective actions on time"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen recovery portfolio</span>

            <h2>Recovery state at review time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasRows ? (
          <p className="kit-meta-line">
            Most value at risk first, across {plural(cases.length, "recovery case", "recovery cases")}.
            Open recovery shows the live record, which may have changed since capture.
          </p>
        ) : null}

        <DataTable
          columns={caseColumns}
          rows={orderedCases}
          getRowId={(item) => String(item.id)}
          ariaLabel="Frozen recovery portfolio"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No recovery cases captured"
              description="This review has no recovery cases."
            />
          }
        />
      </section>

      <section className="recovery-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable recovery evidence</strong>

          <p>
            This review freezes recovery risk, effectiveness, current value at risk, corrective
            action exposure and escalation counts at the review capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
