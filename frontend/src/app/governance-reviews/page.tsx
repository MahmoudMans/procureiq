"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  Landmark,
  Plus,
  Scale,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getGovernanceReviewDashboard,
} from "@/lib/api";

import type {
  GovernanceReviewDashboard,
} from "@/types/governance-review";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

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

function money(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function GovernanceReviewsPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      GovernanceReviewDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    statusFilter,
    setStatusFilter,
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

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    getGovernanceReviewDashboard(
      currency,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
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
              : "Unable to load executive governance reviews.",
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
  }, [
    currency,
  ]);

  const reviews =
    useMemo(
      () =>
        dashboard
          ?.reviews
          .filter(
            review =>
              !statusFilter
              ||
              review.status ===
                statusFilter,
          )
        ??
        [],
      [
        dashboard,
        statusFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Executive procurement governance
          </span>

          <h1>
            Governance reviews
          </h1>

          <p>
            Freeze procurement
            performance into a board-ready
            review period, resolve formal
            decisions and track management
            actions without rewriting
            operational source systems.
          </p>
        </div>

        <div className="governance-heading-actions">
          <label className="governance-currency">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event => {
                  setLoading(true);

                  setCurrency(
                    event.target.value,
                  );
                }
              }
            >
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          {canManage ? (
            <Link
              href={
                `/governance-reviews/new?currency=${currency}`
              }
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New review
            </Link>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="governance-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Latest target
          </span>

          <strong className="kpi-card__value governance-money-kpi">
            {money(
              dashboard
                ?.summary
                .latestTargetSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            Frozen review snapshot.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Latest validated
          </span>

          <strong className="kpi-card__value governance-money-kpi">
            {money(
              dashboard
                ?.summary
                .latestValidatedSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            Formally validated value.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Latest value at risk
          </span>

          <strong className="kpi-card__value governance-money-kpi governance-risk-text">
            {money(
              dashboard
                ?.summary
                .latestAtRiskAmount ??
                0,
              currency,
            )}
          </strong>

          <p>
            Snapshot forecast gap +
            leakage.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Critical suppliers
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .latestCriticalSuppliers ??
              0}
          </strong>

          <p>
            Latest frozen risk position.
          </p>
        </article>
      </section>

      <section className="governance-signal-grid">
        <article>
          <Landmark
            size={17}
          />

          <div>
            <span>
              Active reviews
            </span>

            <strong>
              {dashboard
                ?.summary
                .activeReviews ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <Scale
            size={17}
          />

          <div>
            <span>
              Open decisions
            </span>

            <strong>
              {dashboard
                ?.summary
                .openDecisions ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <ClipboardCheck
            size={17}
          />

          <div>
            <span>
              Open actions
            </span>

            <strong>
              {dashboard
                ?.summary
                .openActions ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <AlertTriangle
            size={17}
          />

          <div>
            <span>
              Overdue actions
            </span>

            <strong>
              {dashboard
                ?.summary
                .overdueActions ??
                0}
            </strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Review calendar
            </span>

            <h2>
              Executive governance reviews
            </h2>
          </div>

          <select
            className="governance-status-filter"
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

            <option value="FROZEN">
              Frozen
            </option>

            <option value="IN_REVIEW">
              In review
            </option>

            <option value="CLOSED">
              Closed
            </option>

            <option value="ARCHIVED">
              Archived
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Review</th>
                <th>Period</th>
                <th>Status</th>
                <th>Target</th>
                <th>Validated</th>
                <th>At risk</th>
                <th>Decisions</th>
                <th>Actions</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                reviews.map(
                  review => (
                    <tr
                      key={review.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {review.title}
                          </strong>

                          <span>
                            {review.reviewNumber}
                            {" · Chair: "}
                            {review.chairName}
                          </span>
                        </div>
                      </td>

                      <td>
                        {review.periodStart}
                        {" → "}
                        {review.periodEnd}
                      </td>

                      <td>
                        <span
                          className={
                            `governance-review-status governance-review-status--${review.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            review.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          review.snapshotTargetSavings,
                          review.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          review.snapshotValidatedSavings,
                          review.currency,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            review.snapshotAtRiskAmount >
                            0
                              ? "governance-risk-text"
                              : ""
                          }
                        >
                          {money(
                            review.snapshotAtRiskAmount,
                            review.currency,
                          )}
                        </span>
                      </td>

                      <td>
                        {review.openDecisions}
                      </td>

                      <td>
                        <span
                          className={
                            review.overdueActions >
                            0
                              ? "governance-risk-text"
                              : ""
                          }
                        >
                          {review.openActions}
                          {review.overdueActions >
                          0
                            ? ` · ${review.overdueActions} overdue`
                            : ""}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/governance-reviews/${review.id}`
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
              reviews.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No executive
                    governance reviews
                    match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="governance-integrity-note">
        <BadgeCheck
          size={18}
        />

        <div>
          <strong>
            Frozen review evidence
          </strong>

          <p>
            Once a review is frozen, its
            executive scorecard and
            ranked evidence items are
            persisted as a point-in-time
            snapshot. Later operational
            changes do not rewrite that
            board-review evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
