"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getSupplierPerformanceReviews,
  getSupplierPerformanceSummary,
} from "@/lib/api";

import type {
  SupplierPerformanceReview,
  SupplierPerformanceSummary,
} from "@/types/supplier-performance";

function readable(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase(),
    );
}

export default function SupplierPerformancePage() {
  const [
    reviews,
    setReviews,
  ] =
    useState<
      SupplierPerformanceReview[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      SupplierPerformanceSummary |
      null
    >(null);

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("");

  const [
    bandFilter,
    setBandFilter,
  ] =
    useState("");

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      getSupplierPerformanceReviews(),
      getSupplierPerformanceSummary(),
    ])
      .then(
        ([
          reviewsResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setReviews(
            reviewsResponse,
          );

          setSummary(
            summaryResponse,
          );

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load supplier performance governance.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(false);
          }
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const filteredReviews =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        return reviews
          .filter(
            review =>
              !statusFilter ||
              review.status ===
                statusFilter,
          )
          .filter(
            review =>
              !bandFilter ||
              review.performanceBand ===
                bandFilter,
          )
          .filter(
            review => {
              if (
                !normalizedQuery
              ) {
                return true;
              }

              return [
                review.reviewNumber,
                review.supplierCode,
                review.supplierName,
                review.supplierCategory ??
                  "",
                review.ownerName,
              ]
                .join(
                  " ",
                )
                .toLowerCase()
                .includes(
                  normalizedQuery,
                );
            },
          );
      },
      [
        reviews,
        statusFilter,
        bandFilter,
        query,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supplier governance
          </span>

          <h1>
            Supplier performance
          </h1>

          <p>
            Run periodic supplier
            scorecards, approve
            performance reviews and
            manage corrective actions
            through measurable
            improvement plans.
          </p>
        </div>

        <Link
          href="/supplier-performance/new"
          className="button button--primary"
        >
          <Plus
            size={16}
          />
          New review
        </Link>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="supplier-performance-kpis">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Gauge
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Average approved score
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.averageApprovedScore
              .toFixed(1) ??
              "—"}
          </strong>

          <p>
            Weighted supplier
            performance score.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Users
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Reviewed suppliers
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.reviewedSuppliers ??
              0}
          </strong>

          <p>
            {summary
              ?.totalReviews ??
              0}
            {" total reviews"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Improvement required
          </span>

          <strong className="kpi-card__value">
            {(summary
              ?.needsImprovement ??
              0)
              +
              (summary
                ?.criticalReviews ??
                0)}
          </strong>

          <p>
            {summary
              ?.criticalReviews ??
              0}
            {" critical reviews"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ClipboardCheck
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Corrective actions
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.openCorrectiveActions ??
              0}
          </strong>

          <p>
            {summary
              ?.overdueCorrectiveActions ??
              0}
            {" overdue · "}
            {summary
              ?.pendingApproval ??
              0}
            {" reviews awaiting approval"}
          </p>
        </article>
      </section>

      <section className="supplier-performance-pulse-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Performance pulse
              </span>

              <h2>
                Supplier performance bands
              </h2>
            </div>

            <TrendingUp
              size={19}
            />
          </div>

          <div className="supplier-band-grid">
            {[
              "EXCELLENT",
              "GOOD",
              "NEEDS_IMPROVEMENT",
              "CRITICAL",
            ].map(
              band => {
                const count =
                  reviews.filter(
                    review =>
                      review.status ===
                        "APPROVED"
                      &&
                      review.performanceBand ===
                        band,
                  )
                    .length;

                return (
                  <article
                    key={band}
                    className={
                      `supplier-band-card supplier-band-card--${band.toLowerCase().replaceAll("_", "-")}`
                    }
                  >
                    <span>
                      {readable(
                        band,
                      )}
                    </span>

                    <strong>
                      {count}
                    </strong>
                  </article>
                );
              },
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance
              </span>

              <h2>
                Review workflow
              </h2>
            </div>

            <BadgeCheck
              size={19}
            />
          </div>

          <div className="supplier-workflow-grid">
            {[
              "DRAFT",
              "SUBMITTED",
              "APPROVED",
              "REJECTED",
            ].map(
              status => (
                <article
                  key={status}
                >
                  <span>
                    {readable(
                      status,
                    )}
                  </span>

                  <strong>
                    {
                      reviews.filter(
                        review =>
                          review.status ===
                            status,
                      )
                        .length
                    }
                  </strong>
                </article>
              ),
            )}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Performance portfolio
            </span>

            <h2>
              Supplier reviews
            </h2>
          </div>

          <span className="supplier-review-count">
            {filteredReviews.length}
            {" reviews"}
          </span>
        </div>

        <div className="supplier-performance-toolbar">
          <input
            value={query}
            placeholder={
              "Search supplier, review or owner"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="SUBMITTED">
              Submitted
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="REJECTED">
              Rejected
            </option>
          </select>

          <select
            value={bandFilter}
            onChange={
              event =>
                setBandFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All performance bands
            </option>

            <option value="EXCELLENT">
              Excellent
            </option>

            <option value="GOOD">
              Good
            </option>

            <option value="NEEDS_IMPROVEMENT">
              Needs improvement
            </option>

            <option value="CRITICAL">
              Critical
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Review</th>
                <th>Supplier</th>
                <th>Period</th>
                <th>Score</th>
                <th>Band</th>
                <th>Status</th>
                <th>CAPA</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredReviews.map(
                  review => (
                    <tr
                      key={review.id}
                    >
                      <td>
                        <strong>
                          {review.reviewNumber}
                        </strong>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {review.supplierName}
                          </strong>

                          <span>
                            {review.supplierCode}
                          </span>
                        </div>
                      </td>

                      <td>
                        {new Date(
                          `${review.periodStart}T00:00:00`,
                        )
                          .toLocaleDateString()}
                        {" — "}
                        {new Date(
                          `${review.periodEnd}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </td>

                      <td>
                        <strong>
                          {review.weightedScore.toFixed(1)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `performance-band performance-band--${review.performanceBand.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            review.performanceBand,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `performance-review-status performance-review-status--${review.status.toLowerCase()}`
                          }
                        >
                          {readable(
                            review.status,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            review.overdueCorrectiveActions >
                            0
                              ? "supplier-capa-overdue"
                              : ""
                          }
                        >
                          {review.openCorrectiveActions}
                          {" open"}
                          {review.overdueCorrectiveActions >
                          0
                            ? ` · ${review.overdueCorrectiveActions} overdue`
                            : ""}
                        </span>
                      </td>

                      <td>
                        {review.ownerName}
                      </td>

                      <td>
                        <Link
                          href={
                            `/supplier-performance/${review.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              filteredReviews.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No supplier performance
                    reviews match the
                    selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
