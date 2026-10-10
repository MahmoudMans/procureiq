"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {CircleAlert,
  Plus,
  Target,
  TrendingDown,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getContinuousImprovementDashboard,
} from "@/lib/api";

import type {
  ContinuousImprovementDashboard,
  ImprovementInitiativeStatus,
} from "@/types/continuous-improvement";

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

export default function ContinuousImprovementPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      ContinuousImprovementDashboard |
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
    useState<
      ImprovementInitiativeStatus |
      ""
    >("");

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

    getContinuousImprovementDashboard(
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
              : "Unable to load continuous-improvement intelligence.",
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

  const initiatives =
    useMemo(
      () =>
        dashboard
          ?.initiatives
          .filter(
            initiative =>
              !statusFilter
              ||
              initiative.status ===
                statusFilter,
          )
        ??
        [],
      [
        dashboard,
        statusFilter,
      ],
    );

  const activeCount =
    dashboard
      ?.initiatives
      .filter(
        initiative =>
          initiative.status ===
            "ACTIVE"
        ||
        initiative.status ===
            "ON_HOLD",
      )
      .length
    ??
    0;

  const improvedCount =
    dashboard
      ?.initiatives
      .filter(
        initiative =>
          initiative.latestOutcome ===
            "IMPROVED",
      )
      .length
    ??
    0;

  const overdueCount =
    dashboard
      ?.initiatives
      .filter(
        initiative =>
          initiative.targetOverdue,
      )
      .length
    ??
    0;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Continuous improvement
          </span>

          <h1>
            Root-cause intelligence
          </h1>

          <p>
            Convert operating-rhythm
            bottlenecks into measurable
            improvement initiatives with
            immutable baselines, explicit
            targets and objective
            before/after checkpoints.
          </p>
        </div>

        <div className="improvement-heading-actions">
          <label className="improvement-currency">
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

          {canManage &&
          dashboard
            ?.latestSnapshot ? (
            <Link
              href={
                `/continuous-improvement/new?currency=${currency}&snapshotId=${dashboard.latestSnapshot.id}`
              }
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New initiative
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

      <section className="improvement-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Opportunities
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.opportunities
              .length ??
              0}
          </strong>

          <p>
            Deterministic root-cause
            candidates.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Active initiatives
          </span>

          <strong className="kpi-card__value">
            {activeCount}
          </strong>

          <p>
            Active or on hold.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Improved
          </span>

          <strong className="kpi-card__value">
            {improvedCount}
          </strong>

          <p>
            Latest checkpoint outcome.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Target overdue
          </span>

          <strong className="kpi-card__value improvement-risk-text">
            {overdueCount}
          </strong>

          <p>
            Open initiatives past target.
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Deterministic discovery
            </span>

            <h2>
              Root-cause opportunities
            </h2>
          </div>

          <TrendingDown
            size={19}
          />
        </div>

        {dashboard
          ?.latestSnapshot ? (
          <div className="improvement-snapshot-authority">
            <span>
              Source snapshot
            </span>

            <strong>
              {dashboard.latestSnapshot.snapshotNumber}
            </strong>

            <small>
              {dashboard.latestSnapshot.periodStart}
              {" → "}
              {dashboard.latestSnapshot.periodEnd}
            </small>
          </div>
        ) : null}

        <div className="improvement-opportunity-grid">
          {dashboard
            ?.opportunities
            .map(
              opportunity => (
                <article
                  key={
                    `${opportunity.scopeType}:${opportunity.scopeKey}`
                  }
                >
                  <div className="improvement-opportunity-heading">
                    <div>
                      <span
                        className={
                          `improvement-priority improvement-priority--${opportunity.priority.toLowerCase()}`
                        }
                      >
                        {opportunity.priority}
                      </span>

                      <strong>
                        {opportunity.scopeLabel}
                      </strong>

                      <small>
                        {readable(
                          opportunity.scopeType,
                        )}
                      </small>
                    </div>

                    <div>
                      <span>
                        Opportunity score
                      </span>

                      <strong>
                        {opportunity.opportunityScore.toFixed(
                          1,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="improvement-opportunity-metrics">
                    <span>
                      Active
                      <strong>
                        {opportunity.activeCount}
                      </strong>
                    </span>

                    <span>
                      SLA overdue
                      <strong>
                        {opportunity.slaOverdueCount}
                      </strong>
                    </span>

                    <span>
                      Persistent
                      <strong>
                        {opportunity.persistentCount}
                      </strong>
                    </span>

                    <span>
                      SLA
                      <strong>
                        {opportunity.resolvedCount >
                        0
                          ? `${opportunity.slaAttainmentPct.toFixed(0)}%`
                          : "—"}
                      </strong>
                    </span>

                    <span>
                      Exposure
                      <strong>
                        {money(
                          opportunity.activeExposure,
                          currency,
                        )}
                      </strong>
                    </span>
                  </div>

                  <p>
                    {opportunity.rationale}
                  </p>

                  {canManage ? (
                    <Link
                      href={
                        `/continuous-improvement/new?currency=${currency}&snapshotId=${opportunity.snapshotId}&scopeType=${opportunity.scopeType}&scopeKey=${encodeURIComponent(opportunity.scopeKey)}`
                      }
                      className="table-action"
                    >
                      Create initiative
                    </Link>
                  ) : null}
                </article>
              ),
            )}

          {!loading &&
          (
            dashboard
              ?.opportunities
              .length ??
            0
          ) ===
            0 ? (
            <div className="improvement-empty">
              No material root-cause
              opportunities are available.
              Capture an operating-rhythm
              snapshot first.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Improvement portfolio
            </span>

            <h2>
              Governed initiatives
            </h2>
          </div>

          <select
            className="improvement-status-filter"
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value as
                    ImprovementInitiativeStatus |
                    "",
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="ON_HOLD">
              On hold
            </option>

            <option value="COMPLETED">
              Completed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Scope</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Target date</th>
                <th>Actions</th>
                <th>Checkpoints</th>
                <th>Latest outcome</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                initiatives.map(
                  initiative => (
                    <tr
                      key={initiative.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {initiative.title}
                          </strong>

                          <span>
                            {initiative.initiativeNumber}
                            {" · "}
                            {initiative.ownerName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong>
                          {initiative.scopeLabel}
                        </strong>

                        <span className="improvement-table-sub">
                          {readable(
                            initiative.scopeType,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `improvement-priority improvement-priority--${initiative.priority.toLowerCase()}`
                          }
                        >
                          {initiative.priority}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `improvement-status improvement-status--${initiative.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            initiative.status,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            initiative.targetOverdue
                              ? "improvement-risk-text"
                              : ""
                          }
                        >
                          {initiative.targetDate}
                        </span>
                      </td>

                      <td>
                        {initiative.openActions}
                        {initiative.overdueActions >
                        0
                          ? ` · ${initiative.overdueActions} overdue`
                          : ""}
                      </td>

                      <td>
                        {initiative.checkpointCount}
                      </td>

                      <td>
                        {initiative.latestOutcome ? (
                          <span
                            className={
                              `improvement-outcome improvement-outcome--${initiative.latestOutcome.toLowerCase().replaceAll("_", "-")}`
                            }
                          >
                            {readable(
                              initiative.latestOutcome,
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        <Link
                          href={
                            `/continuous-improvement/${initiative.id}`
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
              initiatives.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No improvement
                    initiatives match the
                    current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="improvement-method-note">
        <Target
          size={18}
        />

        <div>
          <strong>
            Explainable root-cause scoring
          </strong>

          <p>
            Opportunity scores combine
            SLA-overdue concentration,
            persistent backlog, historical
            SLA underperformance, workload
            concentration and active
            monetary exposure. No
            black-box AI or external
            scoring service is used.
          </p>
        </div>
      </section>
    </div>
  );
}
