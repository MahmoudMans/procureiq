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
  Hourglass,
  Info,
  RefreshCw,
  ShieldAlert,
  Target,
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
import { getOutcomePersistenceReview } from "@/lib/api";
import type { PersistenceReviewDetail } from "@/types/outcome-persistence";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ReviewItem = PersistenceReviewDetail["items"][number];

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

function buildItemColumns(): Column<ReviewItem>[] {
  return [
    {
      id: "plan",
      header: "Plan",
      sortValue: (item) => String(item.initiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.initiativeTitle}</strong>

          <small>
            {item.planNumber} · {item.commitmentNumber}
          </small>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.planStatus),
      cell: (item) => (
        <StatusBadge value={String(item.planStatus)} label={readable(String(item.planStatus))} />
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (item) => String(item.persistenceOwnerName ?? "").toLowerCase(),
      cell: (item) => item.persistenceOwnerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "baseline",
      header: "Baseline",
      align: "right",
      sortValue: (item) => item.baselineValidatedPoints,
      cell: (item) => item.baselineValidatedPoints.toFixed(1),
    },
    {
      id: "current",
      header: "Current",
      align: "right",
      sortValue: (item) => item.currentValidatedPoints,
      cell: (item) => item.currentValidatedPoints.toFixed(1),
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (item) => item.persistencePct,
      cell: (item) => (
        <strong className={item.decayPoints > 0.005 ? "kit-text-warning" : undefined}>
          {item.persistencePct.toFixed(1)}%
        </strong>
      ),
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.persistenceHealth),
      cell: (item) => (
        <StatusBadge
          value={String(item.persistenceHealth)}
          label={readable(String(item.persistenceHealth))}
        />
      ),
    },
    {
      id: "decay",
      header: "Decay",
      align: "right",
      sortValue: (item) => item.decayPoints,
      cell: (item) => (
        <span className={item.decayPoints > 0.005 ? "kit-text-warning" : undefined}>
          {item.decayPoints.toFixed(1)}
        </span>
      ),
    },
    {
      id: "due",
      header: "Observation due",
      sortValue: (item) => (item.observationDue ? 1 : 0),
      cell: (item) =>
        item.observationDue ? (
          <StatusBadge value="PENDING" label="Due" />
        ) : (
          <span className="kit-text-muted">No</span>
        ),
    },
    {
      id: "controls",
      header: "Controls",
      align: "right",
      sortValue: (item) => item.overdueControlCount * 1000 + item.openControlCount,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{item.openControlCount} open</span>

          <small className={item.overdueControlCount > 0 ? "kit-text-warning" : undefined}>
            {item.overdueControlCount} overdue
          </small>
        </div>
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link href={`/outcome-persistence/${encodeURIComponent(String(item.planId))}`} className="table-action">
          Open plan
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
  detail: PersistenceReviewDetail;
}

export default function OutcomePersistenceReviewPage() {
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
        const response = await getOutcomePersistenceReview(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load persistence review.",
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
        <Link href="/outcome-persistence" className="request-back-link">
          <ArrowLeft size={16} />
          Outcome persistence
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

  const { review, items } = detail;
  const hasItems = items.length > 0;
  const decayed = review.decayedPlanCount;
  const overdue = review.overdueControlCount;
  const dueCount = items.filter((item) => item.observationDue).length;
  const holding = items.filter((item) => item.decayPoints <= 0.005).length;
  const orderedItems = [...items].sort((a, b) => a.persistencePct - b.persistencePct);
  const weakest = orderedItems.length > 0 ? orderedItems[0] : null;
  const decaying = review.totalDecayPoints > 0.005;

  function exportItems() {
    downloadRows(
      `${review.reviewNumber}-persistence.csv`,
      [
        "Plan",
        "Plan number",
        "Commitment",
        "Status",
        "Owner",
        "Baseline points",
        "Current points",
        "Persistence %",
        "Health",
        "Decay points",
        "Observation due",
        "Open controls",
        "Overdue controls",
      ],
      orderedItems.map((item) => [
        String(item.initiativeTitle),
        String(item.planNumber),
        String(item.commitmentNumber),
        readable(String(item.planStatus)),
        String(item.persistenceOwnerName ?? ""),
        item.baselineValidatedPoints,
        item.currentValidatedPoints,
        item.persistencePct,
        readable(String(item.persistenceHealth)),
        item.decayPoints,
        item.observationDue ? "Yes" : "No",
        item.openControlCount,
        item.overdueControlCount,
      ]),
    );

    toast.success("Review exported", plural(items.length, "plan", "plans"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Portfolio persistence",
      icon: Gauge,
      value: `${review.averagePersistencePct.toFixed(1)}%`,
      note: readable(String(review.portfolioHealth)),
    },
    {
      label: "Assessed baseline",
      icon: Target,
      value: review.assessedBaselinePoints.toFixed(1),
      note: "Validated points at baseline",
    },
    {
      label: "Current validated",
      icon: BadgeCheck,
      value: review.currentValidatedPoints.toFixed(1),
      note: "Validated points at capture",
    },
    {
      label: "Total decay",
      icon: TrendingDown,
      value: review.totalDecayPoints.toFixed(1),
      note: "Points lost against baseline",
      tone: decaying ? "warning" : "default",
    },
    {
      label: "Decayed plans",
      icon: Hourglass,
      value: String(decayed),
      note: `Of ${plural(items.length, "plan", "plans")}`,
      tone: decayed > 0 ? "warning" : "default",
    },
    {
      label: "Overdue controls",
      icon: ShieldAlert,
      value: String(overdue),
      note: "Controls past their date",
      tone: overdue > 0 ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/outcome-persistence" className="request-back-link">
        <ArrowLeft size={16} />
        Outcome persistence
      </Link>

      <section className="persistence-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{review.reviewNumber}</span>

            <StatusBadge
              value={String(review.portfolioHealth)}
              label={readable(String(review.portfolioHealth))}
            />
          </div>

          <span className="eyebrow">Immutable persistence review</span>

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

      {decayed > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(decayed, "plan had", "plans had")} decayed against{" "}
              {decayed === 1 ? "its" : "their"} baseline.
            </strong>{" "}
            Total decay was {review.totalDecayPoints.toFixed(1)} points.
            {weakest !== null
              ? ` The lowest persistence was ${weakest.initiativeTitle} at ${weakest.persistencePct.toFixed(1)}%.`
              : ""}
          </div>
        </div>
      ) : null}

      {overdue > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(overdue, "control was", "controls were")} overdue when the review was
              captured.
            </strong>{" "}
            The rows below show which plans carry them.
          </div>
        </div>
      ) : null}

      {dueCount > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(dueCount, "plan had", "plans had")} an observation due at capture.
            </strong>{" "}
            Open the plan to record it on the live record.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This review captured no persistence plans.</strong> There was nothing in the
            portfolio when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Persistence review summary" />

      {hasItems ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Persistence at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={review.averagePersistencePct}
            tone={review.averagePersistencePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Portfolio persistence ${review.averagePersistencePct.toFixed(1)}% — ${review.currentValidatedPoints.toFixed(1)} of ${review.assessedBaselinePoints.toFixed(1)} baseline points held`}
            label="Portfolio persistence"
          />

          <ProgressLine
            pct={(holding / items.length) * 100}
            tone={holding === items.length ? meterToneFor("success") : "primary"}
            caption={`${holding} of ${plural(items.length, "plan", "plans")} held their baseline`}
            label="Plans holding their baseline"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen value-persistence portfolio</span>

            <h2>Post-implementation state at review time</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Lowest persistence first, across {plural(items.length, "plan", "plans")}. Open plan
            shows the live record, which may have changed since capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.planId)}
          ariaLabel="Frozen persistence portfolio"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No plans captured"
              description="This review has no persistence plans."
            />
          }
        />
      </section>

      <section className="persistence-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable post-implementation evidence</strong>

          <p>
            This review freezes assessed baselines, current validated persistence, benefit decay,
            control exposure and verification readiness at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
