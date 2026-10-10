"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  Coins,
  Download,
  FileCheck2,
  Gauge,
  Hourglass,
  Info,
  RefreshCw,
  TrendingDown,
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
import { getStrategicValueReview } from "@/lib/api";
import type { StrategicValueReviewDetail } from "@/types/strategic-value";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ReviewItem = StrategicValueReviewDetail["items"][number];

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

function buildItemColumns(): Column<ReviewItem>[] {
  return [
    {
      id: "case",
      header: "Case",
      sortValue: (item) => String(item.initiativeTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.initiativeTitle}</strong>

          <small>
            {item.caseNumber} · {item.persistencePlanNumber}
          </small>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (item) => String(item.valueOwnerName ?? "").toLowerCase(),
      cell: (item) => item.valueOwnerName ?? <span className="kit-text-muted">—</span>,
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
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (item) => item.persistencePct,
      cell: (item) => `${item.persistencePct.toFixed(1)}%`,
    },
    {
      id: "investment",
      header: "Investment",
      align: "right",
      sortValue: (item) => item.investmentCostAmount,
      cell: (item) => money(item.investmentCostAmount),
    },
    {
      id: "baseline",
      header: "Baseline value",
      align: "right",
      sortValue: (item) => item.baselineHorizonValueAmount,
      cell: (item) => money(item.baselineHorizonValueAmount),
    },
    {
      id: "durable",
      header: "Durable value",
      align: "right",
      sortValue: (item) => item.durableHorizonValueAmount,
      cell: (item) => money(item.durableHorizonValueAmount),
    },
    {
      id: "decay",
      header: "Decay",
      align: "right",
      sortValue: (item) => item.decayedValueAmount,
      cell: (item) => (
        <span className={item.decayedValueAmount > 0.005 ? "kit-text-warning" : undefined}>
          {money(item.decayedValueAmount)}
        </span>
      ),
    },
    {
      id: "net",
      header: "Net value",
      align: "right",
      sortValue: (item) => item.netValueAmount,
      cell: (item) => (
        <strong className={item.netValueAmount < -0.005 ? "kit-text-danger" : undefined}>
          {money(item.netValueAmount)}
        </strong>
      ),
    },
    {
      id: "roi",
      header: "ROI",
      align: "right",
      sortValue: (item) => item.roiPct,
      cell: (item) => (
        <span className={item.roiPct < 0 ? "kit-text-danger" : undefined}>
          {item.roiPct.toFixed(1)}%
        </span>
      ),
    },
    {
      id: "payback",
      header: "Payback",
      align: "right",
      sortValue: (item) => item.paybackMonths ?? null,
      cell: (item) =>
        item.paybackMonths === null ? (
          <span className="kit-text-muted">N/A</span>
        ) : (
          `${item.paybackMonths.toFixed(1)} mo`
        ),
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.valueHealth),
      cell: (item) => (
        <StatusBadge value={String(item.valueHealth)} label={readable(String(item.valueHealth))} />
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link href={`/strategic-value/${encodeURIComponent(String(item.valueCaseId))}`} className="table-action">
          Open case
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
  detail: StrategicValueReviewDetail;
}

export default function StrategicValueReviewPage() {
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
        const response = await getStrategicValueReview(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load strategic value review.",
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
        <Link href="/strategic-value" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic value
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
  const negative = items.filter((item) => item.netValueAmount < -0.005);
  const noPayback = items.filter((item) => item.paybackMonths === null);
  const positive = items.length - negative.length;
  const sumBaseline = items.reduce((sum, item) => sum + item.baselineHorizonValueAmount, 0);
  const sumDurable = items.reduce((sum, item) => sum + item.durableHorizonValueAmount, 0);
  const durablePct = sumBaseline > 0 ? (sumDurable / sumBaseline) * 100 : 0;
  const decaying = review.totalDecayedValueAmount > 0.005;
  const negativeNet = review.totalNetValueAmount < -0.005;
  const orderedItems = [...items].sort((a, b) => a.roiPct - b.roiPct);
  const weakest = orderedItems.length > 0 ? orderedItems[0] : null;

  function exportItems() {
    downloadRows(
      `${review.reviewNumber}-value.csv`,
      [
        "Case",
        "Case number",
        "Persistence plan",
        "Owner",
        "Status",
        "Persistence %",
        "Investment",
        "Baseline value",
        "Durable value",
        "Decay",
        "Net value",
        "ROI %",
        "Payback months",
        "Health",
      ],
      orderedItems.map((item) => [
        String(item.initiativeTitle),
        String(item.caseNumber),
        String(item.persistencePlanNumber),
        String(item.valueOwnerName ?? ""),
        readable(String(item.caseStatus)),
        item.persistencePct,
        item.investmentCostAmount,
        item.baselineHorizonValueAmount,
        item.durableHorizonValueAmount,
        item.decayedValueAmount,
        item.netValueAmount,
        item.roiPct,
        item.paybackMonths === null ? "N/A" : item.paybackMonths,
        readable(String(item.valueHealth)),
      ]),
    );

    toast.success("Review exported", plural(items.length, "case", "cases"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Portfolio ROI",
      icon: Gauge,
      value: `${review.portfolioRoiPct.toFixed(1)}%`,
      note: readable(String(review.portfolioHealth)),
      tone: review.portfolioRoiPct < 0 ? "warning" : "default",
    },
    {
      label: "Investment",
      icon: Coins,
      value: money(review.totalInvestmentAmount),
      note: "Governed investment cost",
    },
    {
      label: "Durable value",
      icon: WalletCards,
      value: money(review.totalDurableHorizonValueAmount),
      note: hasItems ? `${durablePct.toFixed(1)}% of baseline value` : "Persistence-adjusted",
    },
    {
      label: "Decayed value",
      icon: TrendingDown,
      value: money(review.totalDecayedValueAmount),
      note: "Lost to persistence decay",
      tone: decaying ? "warning" : "default",
    },
    {
      label: "Net value",
      icon: BadgeCheck,
      value: money(review.totalNetValueAmount),
      note: "Durable value less total cost",
      tone: negativeNet ? "warning" : "default",
    },
    {
      label: "Payback",
      icon: Hourglass,
      value:
        review.portfolioPaybackMonths === null
          ? "N/A"
          : `${review.portfolioPaybackMonths.toFixed(1)} mo`,
      note: "Portfolio payback",
    },
  ];

  const itemColumns = buildItemColumns();

  return (
    <div className="page-stack">
      <Link href="/strategic-value" className="request-back-link">
        <ArrowLeft size={16} />
        Strategic value
      </Link>

      <section className="value-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{review.reviewNumber}</span>

            <StatusBadge
              value={String(review.portfolioHealth)}
              label={readable(String(review.portfolioHealth))}
            />
          </div>

          <span className="eyebrow">Immutable executive value review</span>

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

      {negative.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(negative.length, "case has", "cases have")} negative net value.
            </strong>{" "}
            {weakest !== null
              ? `The lowest ROI was ${weakest.initiativeTitle} at ${weakest.roiPct.toFixed(1)}%.`
              : ""}
          </div>
        </div>
      ) : null}

      {decaying ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{money(review.totalDecayedValueAmount)} of value had decayed.</strong>{" "}
            Persistence adjusted the baseline value down to the durable value shown below.
          </div>
        </div>
      ) : null}

      {noPayback.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(noPayback.length, "case has", "cases have")} no payback period.
            </strong>{" "}
            {noPayback.length === 1 ? "It is" : "They are"} shown as N/A in the table.
          </div>
        </div>
      ) : null}

      {!hasItems ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This review captured no value cases.</strong> There was nothing in the value
            portfolio when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Value review summary" />

      {hasItems && sumBaseline > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Value held at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={durablePct}
            tone={durablePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`${money(sumDurable)} durable of ${money(sumBaseline)} baseline value across the cases (${durablePct.toFixed(1)}%)`}
            label="Durable value against baseline value"
          />

          <ProgressLine
            pct={(positive / items.length) * 100}
            tone={positive === items.length ? meterToneFor("success") : "primary"}
            caption={`${positive} of ${plural(items.length, "case", "cases")} have positive net value`}
            label="Cases with positive net value"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen value portfolio</span>

            <h2>Long-term ROI state at review time</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        {hasItems ? (
          <p className="kit-meta-line">
            Lowest ROI first, across {plural(items.length, "case", "cases")}. Amounts are shown
            without a currency code. Open case shows the live record, which may have changed since
            capture.
          </p>
        ) : null}

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.valueCaseId)}
          ariaLabel="Frozen value portfolio"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No cases captured"
              description="This review has no value cases."
            />
          }
        />
      </section>

      <section className="value-method-note">
        <Camera size={18} />

        <div>
          <strong>Immutable executive value evidence</strong>

          <p>
            This review freezes governed investment assumptions, persistence-adjusted durable
            value, decay, ROI, payback and case health at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
