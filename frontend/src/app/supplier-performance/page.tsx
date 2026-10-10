"use client";

import {
  AlertTriangle,
  CircleAlert,
  ClipboardCheck,
  Download,
  Gauge,
  Plus,
  RefreshCw,
  SearchX,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  SelectField,
  type SelectOption,
  StatusBadge,
  downloadCsv,
  formatDate,
  readable,
  useToast,
} from "@/components/kit";
import {
  getSupplierPerformanceReviews,
  getSupplierPerformanceSummary,
} from "@/lib/api";
import type {
  SupplierPerformanceReview,
  SupplierPerformanceSummary,
} from "@/types/supplier-performance";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const BANDS = ["EXCELLENT", "GOOD", "NEEDS_IMPROVEMENT", "CRITICAL"];

const BAND_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "NEEDS_IMPROVEMENT", label: "Needs improvement" },
  { value: "CRITICAL", label: "Critical" },
];

const EMPTY_REVIEWS: SupplierPerformanceReview[] = [];
const integer = new Intl.NumberFormat("en-US");

const COLUMNS: Column<SupplierPerformanceReview>[] = [
  {
    id: "review",
    header: "Review",
    sortValue: (review) => review.reviewNumber,
    cell: (review) => (
      <strong>
        <Link href={`/supplier-performance/${review.id}`} className="supplier-360-link">
          {review.reviewNumber}
        </Link>
      </strong>
    ),
  },
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (review) => review.supplierName.toLowerCase(),
    cell: (review) => (
      <div className="stacked-cell">
        <strong>{review.supplierName}</strong>

        <span>
          {review.supplierCode}
          {review.supplierCategory ? ` · ${review.supplierCategory}` : ""}
        </span>
      </div>
    ),
  },
  {
    id: "period",
    header: "Period",
    sortValue: (review) => review.periodEnd,
    firstSort: "desc",
    cell: (review) => (
      <span className="kit-num">
        {formatDate(review.periodStart)} – {formatDate(review.periodEnd)}
      </span>
    ),
  },
  {
    id: "score",
    header: "Score",
    align: "right",
    sortValue: (review) => review.weightedScore,
    firstSort: "desc",
    cell: (review) => (
      <strong className="kit-num">{review.weightedScore.toFixed(1)}</strong>
    ),
  },
  {
    id: "band",
    header: "Band",
    sortValue: (review) => BANDS.indexOf(review.performanceBand),
    cell: (review) => <StatusBadge value={review.performanceBand} />,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (review) => review.status,
    cell: (review) => <StatusBadge value={review.status} />,
  },
  {
    id: "capa",
    header: "CAPA",
    sortValue: (review) =>
      review.overdueCorrectiveActions * 1000 + review.openCorrectiveActions,
    firstSort: "desc",
    cell: (review) => (
      <div className="kit-cell-stack">
        <span>{review.openCorrectiveActions} open</span>

        {review.overdueCorrectiveActions > 0 ? (
          <small className="kit-cell-flag">
            {review.overdueCorrectiveActions} overdue
          </small>
        ) : null}
      </div>
    ),
  },
  {
    id: "owner",
    header: "Owner",
    sortValue: (review) => review.ownerName.toLowerCase(),
    cell: (review) => review.ownerName,
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (review) => (
      <Link href={`/supplier-performance/${review.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SupplierPerformancePage() {
  const toast = useToast();

  const [reviews, setReviews] = useState<SupplierPerformanceReview[] | null>(null);
  const [summary, setSummary] = useState<SupplierPerformanceSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);
      setSummaryFailed(false);

      const [reviewResult, summaryResult] = await Promise.allSettled([
        getSupplierPerformanceReviews(),
        getSupplierPerformanceSummary(),
      ]);

      if (!active) {
        return;
      }

      if (reviewResult.status === "fulfilled") {
        setReviews(reviewResult.value);
      } else {
        setError(
          reviewResult.reason instanceof Error
            ? reviewResult.reason.message
            : "Unable to load supplier performance governance.",
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummaryFailed(true);
      }

      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [reloadKey]);

  const all = reviews ?? EMPTY_REVIEWS;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const review of all) {
      counts[review.status] = (counts[review.status] ?? 0) + 1;
    }

    return counts;
  }, [all]);

  // Only approved reviews count towards the band distribution.
  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const review of all) {
      if (review.status === "APPROVED") {
        counts[review.performanceBand] = (counts[review.performanceBand] ?? 0) + 1;
      }
    }

    return counts;
  }, [all]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return all
      .filter((review) => !status || review.status === status)
      .filter((review) => !band || review.performanceBand === band)
      .filter(
        (review) =>
          !normalized ||
          [
            review.reviewNumber,
            review.supplierCode,
            review.supplierName,
            review.supplierCategory ?? "",
            review.ownerName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [all, query, status, band]);

  const initialLoad = reviews === null && error === null;
  const hasFilters = query.trim() !== "" || status !== "" || band !== "";

  function countLabel(label: string, key: string): string {
    return reviews ? `${label} · ${statusCounts[key] ?? 0}` : label;
  }

  const statusFilters: SegmentedOption[] = [
    { value: "", label: reviews ? `All · ${all.length}` : "All" },
    { value: "DRAFT", label: countLabel("Draft", "DRAFT") },
    { value: "SUBMITTED", label: countLabel("Submitted", "SUBMITTED") },
    { value: "APPROVED", label: countLabel("Approved", "APPROVED") },
    { value: "REJECTED", label: countLabel("Rejected", "REJECTED") },
  ];

  function clearFilters() {
    setQuery("");
    setStatus("");
    setBand("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-supplier-reviews-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Review number",
        "Supplier",
        "Supplier code",
        "Category",
        "Period start",
        "Period end",
        "Weighted score",
        "Performance band",
        "Status",
        "Open corrective actions",
        "Overdue corrective actions",
        "Owner",
      ],
      rows.map((review) => [
        review.reviewNumber,
        review.supplierName,
        review.supplierCode,
        review.supplierCategory ?? "",
        review.periodStart,
        review.periodEnd,
        review.weightedScore,
        review.performanceBand,
        review.status,
        review.openCorrectiveActions,
        review.overdueCorrectiveActions,
        review.ownerName,
      ]),
    );

    toast.success(
      "Reviews exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const improvementRequired =
    (summary?.needsImprovement ?? 0) + (summary?.criticalReviews ?? 0);

  const kpis: KpiItem[] = [
    {
      label: "Average approved score",
      icon: Gauge,
      value: summary ? summary.averageApprovedScore.toFixed(1) : "—",
      note: "Weighted supplier performance score.",
    },
    {
      label: "Reviewed suppliers",
      icon: Users,
      value: summary ? integer.format(summary.reviewedSuppliers) : "—",
      note: `${integer.format(summary?.totalReviews ?? 0)} total reviews`,
    },
    {
      label: "Improvement required",
      icon: AlertTriangle,
      value: summary ? integer.format(improvementRequired) : "—",
      note: `${integer.format(summary?.criticalReviews ?? 0)} critical reviews`,
      tone: improvementRequired > 0 ? "warning" : "default",
    },
    {
      label: "Corrective actions",
      icon: ClipboardCheck,
      value: summary ? integer.format(summary.openCorrectiveActions) : "—",
      note: `${integer.format(summary?.overdueCorrectiveActions ?? 0)} overdue · ${integer.format(
        summary?.pendingApproval ?? 0,
      )} reviews awaiting approval`,
      tone: (summary?.overdueCorrectiveActions ?? 0) > 0 ? "warning" : "default",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No reviews match these filters"
      description="Try a different search term, status or band, or clear the filters."
      action={
        <button
          type="button"
          className="button button--secondary"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      }
    />
  ) : (
    <EmptyState
      icon={ClipboardCheck}
      title="No supplier reviews yet"
      description="Run a periodic scorecard to start tracking supplier performance."
      action={
        <Link href="/supplier-performance/new" className="button button--primary">
          <Plus size={16} />
          New review
        </Link>
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Supplier governance</span>

          <h1>Supplier performance</h1>

          <p>
            Run periodic supplier scorecards, approve performance reviews and manage
            corrective actions through measurable improvement plans.
          </p>
        </div>

        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>

          <Link href="/supplier-performance/new" className="button button--primary">
            <Plus size={16} />
            New review
          </Link>
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Supplier performance totals"
      />

      {reviews ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Performance pulse</span>

              <h2>Approved reviews by band</h2>
            </div>

            <TrendingUp size={19} />
          </div>

          <div className="supplier-band-grid">
            {BANDS.map((key) => (
              <article
                key={key}
                className={`supplier-band-card supplier-band-card--${key
                  .toLowerCase()
                  .replaceAll("_", "-")}`}
              >
                <span>{readable(key)}</span>

                <strong>{bandCounts[key] ?? 0}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search supplier, review or owner"
          ariaLabel="Search supplier reviews"
          shortcut
        />

        <SelectField label="Band" value={band} onChange={setBand} options={BAND_OPTIONS} />

        <SegmentedFilter
          options={statusFilters}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by review status"
        />
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {error && reviews === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(review) => review.id}
          ariaLabel="Supplier performance reviews"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          defaultSort={{ id: "period", dir: "desc" }}
          persistKey="supplier-performance"
          resetKey={`${query}|${status}|${band}`}
        />
      )}
    </div>
  );
}
