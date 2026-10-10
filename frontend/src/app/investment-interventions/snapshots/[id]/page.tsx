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
  RefreshCw,
  Repeat,
  TrendingDown,
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
import { getInvestmentInterventionSnapshot } from "@/lib/api";
import type { InvestmentInterventionSnapshotDetail } from "@/types/investment-intervention";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotItem = InvestmentInterventionSnapshotDetail["items"][number];

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

/** True when the committee approved a different action from the advisory recommendation. */
function isOverridden(item: SnapshotItem): boolean {
  return Boolean(item.approvedAction) && String(item.approvedAction) !== String(item.recommendedAction);
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
      id: "case",
      header: "Case",
      sortValue: (item) => String(item.initiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.initiativeTitle}</strong>

          <small>{item.interventionNumber}</small>
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
      sortValue: (item) => String(item.currentPerformanceHealth),
      cell: (item) => (
        <StatusBadge
          value={String(item.currentPerformanceHealth)}
          label={readable(String(item.currentPerformanceHealth))}
        />
      ),
    },
    {
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.currentReleasedCapitalAmount,
      cell: (item) => money(item.currentReleasedCapitalAmount, item.currency),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.currentRemainingCommitmentAmount,
      cell: (item) => money(item.currentRemainingCommitmentAmount, item.currency),
    },
    {
      id: "roi",
      header: "Realized ROI",
      align: "right",
      sortValue: (item) => item.currentRealizedRoiPct,
      cell: (item) => (
        <span className={item.currentRealizedRoiPct < 0 ? "kit-text-danger" : undefined}>
          {item.currentRealizedRoiPct.toFixed(1)}%
        </span>
      ),
    },
    {
      id: "roiVariance",
      header: "ROI variance",
      align: "right",
      sortValue: (item) => item.currentRoiVariancePct,
      cell: (item) => (
        <strong className={item.currentRoiVariancePct < 0 ? "kit-text-warning" : undefined}>
          {item.currentRoiVariancePct.toFixed(1)} pts
        </strong>
      ),
    },
    {
      id: "efficiency",
      header: "Efficiency",
      align: "right",
      sortValue: (item) => item.currentCapitalEfficiencyMultiple,
      cell: (item) => `${item.currentCapitalEfficiencyMultiple.toFixed(2)}x`,
    },
    {
      id: "recommendation",
      header: "Recommendation",
      sortValue: (item) => String(item.recommendedAction),
      cell: (item) => (
        <StatusBadge
          value={String(item.recommendedAction)}
          label={readable(String(item.recommendedAction))}
        />
      ),
    },
    {
      id: "approvedAction",
      header: "Approved action",
      sortValue: (item) => String(item.approvedAction ?? ""),
      cell: (item) =>
        item.approvedAction ? (
          <StatusBadge
            value={String(item.approvedAction)}
            label={readable(String(item.approvedAction))}
          />
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "affected",
      header: "Affected",
      align: "right",
      sortValue: (item) => item.approvedAffectedCapitalAmount,
      cell: (item) => money(item.approvedAffectedCapitalAmount, item.currency),
    },
    {
      id: "target",
      header: "Target",
      sortValue: (item) => String(item.approvedTargetValueCaseNumber ?? ""),
      cell: (item) =>
        item.approvedTargetValueCaseNumber ? (
          item.approvedTargetValueCaseNumber
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link
          href={`/investment-interventions/${encodeURIComponent(String(item.interventionCaseId))}`}
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
  detail: InvestmentInterventionSnapshotDetail;
}

export default function InvestmentInterventionSnapshotPage() {
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
        const response = await getInvestmentInterventionSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load intervention snapshot.",
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
        <Link href="/investment-interventions" className="request-back-link">
          <ArrowLeft size={16} />
          Investment intervention
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
  const underperforming = snapshot.underperformingCaseCount;
  const inReview = snapshot.inReviewCaseCount;
  const approved = snapshot.approvedCaseCount;
  const affected = snapshot.totalApprovedAffectedCapitalAmount;
  const reallocation = snapshot.totalApprovedReallocationAmount;
  const reallocationPct = affected > 0 ? (reallocation / affected) * 100 : 0;
  const approvedPct = cases > 0 ? (approved / cases) * 100 : 0;
  const performingCount = Math.max(0, cases - underperforming);

  const overridden = items.filter(isOverridden);
  const orderedItems = [...items].sort((a, b) => a.currentRoiVariancePct - b.currentRoiVariancePct);
  const weakest = orderedItems.length > 0 ? orderedItems[0] : null;

  function exportItems() {
    downloadRows(
      `${snapshot.snapshotNumber}-interventions.csv`,
      [
        "Case",
        "Intervention number",
        "Status",
        "Health",
        "Released",
        "Remaining",
        "Realized ROI %",
        "ROI variance pts",
        "Efficiency multiple",
        "Recommendation",
        "Approved action",
        "Affected capital",
        "Target value case",
        "Currency",
      ],
      orderedItems.map((item) => [
        String(item.initiativeTitle),
        String(item.interventionNumber),
        readable(String(item.caseStatus)),
        readable(String(item.currentPerformanceHealth)),
        item.currentReleasedCapitalAmount,
        item.currentRemainingCommitmentAmount,
        item.currentRealizedRoiPct,
        item.currentRoiVariancePct,
        item.currentCapitalEfficiencyMultiple,
        readable(String(item.recommendedAction)),
        item.approvedAction ? readable(String(item.approvedAction)) : "",
        item.approvedAffectedCapitalAmount,
        String(item.approvedTargetValueCaseNumber ?? ""),
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
      note: "Intervention cases captured",
    },
    {
      label: "In review",
      icon: Hourglass,
      value: String(inReview),
      note: "Awaiting a decision",
    },
    {
      label: "Approved",
      icon: BadgeCheck,
      value: String(approved),
      note: "Interventions approved",
    },
    {
      label: "Underperforming",
      icon: TrendingDown,
      value: String(underperforming),
      note: "Cases below plan",
      tone: underperforming > 0 ? "warning" : "default",
    },
    {
      label: "Affected capital",
      icon: Coins,
      value: money(affected),
      note: "Approved, summed across cases",
    },
    {
      label: "Approved reallocation",
      icon: Repeat,
      value: money(reallocation),
      note: "Capital approved to move",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/investment-interventions" className="request-back-link">
        <ArrowLeft size={16} />
        Investment intervention
      </Link>

      <section className="intervention-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>
          </div>

          <span className="eyebrow">Immutable intervention portfolio</span>

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

      {underperforming > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(underperforming, "case was", "cases were")} underperforming at capture.
            </strong>
            {weakest !== null && weakest.currentRoiVariancePct < 0
              ? ` The largest ROI shortfall was ${weakest.initiativeTitle} at ${weakest.currentRoiVariancePct.toFixed(1)} pts.`
              : ""}
          </div>
        </div>
      ) : null}

      {inReview > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(inReview, "case was", "cases were")} still in review when the snapshot was
              captured.
            </strong>{" "}
            No approved action had been recorded for {inReview === 1 ? "it" : "them"} yet.
          </div>
        </div>
      ) : null}

      {overridden.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(overridden.length, "case was", "cases were")} approved with an action
              different from the advisory recommendation.
            </strong>{" "}
            Compare the Recommendation and Approved action columns.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no cases.</strong> There was no intervention portfolio
            when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Investment intervention snapshot summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Governance at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          {cases > 0 ? (
            <ProgressLine
              pct={approvedPct}
              tone={approvedPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${approved} of ${plural(cases, "case", "cases")} approved`}
              label="Approved cases"
            />
          ) : null}

          {cases > 0 ? (
            <ProgressLine
              pct={(performingCount / cases) * 100}
              tone={underperforming === 0 ? meterToneFor("success") : "primary"}
              caption={`${performingCount} of ${plural(cases, "case", "cases")} were not underperforming`}
              label="Cases not underperforming"
            />
          ) : null}

          {affected > 0 ? (
            <ProgressLine
              pct={reallocationPct}
              tone="primary"
              caption={`${money(reallocation)} approved for reallocation of ${money(affected)} affected capital (${reallocationPct.toFixed(1)}%)`}
              label="Approved reallocation against affected capital"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen intervention portfolio</span>

            <h2>Governance state at capture time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Largest ROI shortfall first, across {plural(items.length, "case", "cases")}. Amounts
            show the currency of each case. Open case shows the live record, which may have
            changed since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.interventionCaseId)}
          ariaLabel="Frozen intervention cases"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No cases captured"
              description="This snapshot has no intervention cases."
            />
          }
        />
      </section>

      <section className="intervention-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable intervention evidence</strong>

          <p>
            This snapshot freezes current performance, remaining unreleased capital, advisory
            recommendations and approved intervention decisions without altering any upstream
            funding or performance record.
          </p>
        </div>
      </section>
    </div>
  );
}
