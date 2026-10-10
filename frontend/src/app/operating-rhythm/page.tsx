"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  AlertTriangle,
  CircleAlert,
  Clock3,
  GaugeCircle,
  History,
  Plus,
  Users,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureOperatingRhythmSnapshot,
  getOperatingRhythmDashboard,
} from "@/lib/api";

import type {
  OperatingRhythmDashboard,
} from "@/types/operating-rhythm";

import {
  useEffect,
  useState,
} from "react";

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

function periodStart(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() - 29,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function OperatingRhythmPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      OperatingRhythmDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    snapshotStart,
    setSnapshotStart,
  ] =
    useState(
      periodStart(),
    );

  const [
    snapshotEnd,
    setSnapshotEnd,
  ] =
    useState(
      today(),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    capturing,
    setCapturing,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  const canCapture =
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

    getOperatingRhythmDashboard(
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
              : "Unable to load operating-rhythm intelligence.",
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

  async function reload() {
    setDashboard(
      await getOperatingRhythmDashboard(
        currency,
      ),
    );
  }

  async function capture() {
    try {
      setCapturing(true);
      setError(null);
      setMessage(null);

      const result =
        await captureOperatingRhythmSnapshot({
          currency,
          periodStart:
            snapshotStart,
          periodEnd:
            snapshotEnd,
        });

      await reload();

      setMessage(
        `${result.snapshot.snapshotNumber} captured · ${result.metrics.activeBacklogCount} active · ${result.metrics.resolvedCount} resolved · ${result.metrics.slaAttainmentPct.toFixed(1)}% SLA attainment`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture operating-rhythm snapshot.",
      );
    } finally {
      setCapturing(false);
    }
  }

  const metrics =
    dashboard?.liveMetrics;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement operating system
          </span>

          <h1>
            Operating rhythm
          </h1>

          <p>
            Measure how effectively the
            procurement control tower
            converts exceptions into
            accountable, SLA-governed
            resolution.
          </p>
        </div>

        <label className="rhythm-currency">
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
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rhythm-message">
          <GaugeCircle
            size={16}
          />
          {message}
        </div>
      ) : null}

      <section className="rhythm-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Active backlog
          </span>

          <strong className="kpi-card__value">
            {metrics
              ?.activeBacklogCount ??
              0}
          </strong>

          <p>
            {metrics
              ?.persistentExceptionCount ??
              0}
            {" persistent ≥7d"}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            SLA attainment
          </span>

          <strong className="kpi-card__value">
            {metrics &&
            metrics.resolvedCount >
              0
              ? `${metrics.slaAttainmentPct.toFixed(1)}%`
              : "—"}
          </strong>

          <p>
            {metrics
              ?.resolvedCount ??
              0}
            {" resolved in rolling 30d"}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            SLA overdue
          </span>

          <strong className="kpi-card__value rhythm-risk-text">
            {metrics
              ?.slaOverdueCount ??
              0}
          </strong>

          <p>
            Active queue breaches.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Active exposure
          </span>

          <strong className="kpi-card__value rhythm-money-kpi">
            {money(
              metrics
                ?.activeMonetaryExposure ??
                0,
              currency,
            )}
          </strong>

          <p>
            Value at stake in active
            exceptions.
          </p>
        </article>
      </section>

      <section className="rhythm-signal-grid">
        <article>
          <Clock3
            size={17}
          />

          <div>
            <span>
              Avg resolution time
            </span>

            <strong>
              {(
                metrics
                  ?.avgResolutionHours ??
                  0
              ).toFixed(1)}
              {"h"}
            </strong>
          </div>
        </article>

        <article>
          <History
            size={17}
          />

          <div>
            <span>
              Avg active age
            </span>

            <strong>
              {(
                metrics
                  ?.avgActiveAgeDays ??
                  0
              ).toFixed(1)}
              {"d"}
            </strong>
          </div>
        </article>

        <article>
          <Users
            size={17}
          />

          <div>
            <span>
              Unassigned
            </span>

            <strong>
              {metrics
                ?.unassignedCount ??
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
              Critical + high
            </span>

            <strong>
              {(
                metrics
                  ?.criticalBacklogCount ??
                  0
              )
              +
              (
                metrics
                  ?.highBacklogCount ??
                  0
              )}
            </strong>
          </div>
        </article>
      </section>

      {canCapture ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Historical operating record
              </span>

              <h2>
                Capture performance snapshot
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="rhythm-capture-controls">
            <label className="request-field">
              <span>
                Period start
              </span>

              <input
                type="date"
                value={snapshotStart}
                onChange={
                  event =>
                    setSnapshotStart(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Period end
              </span>

              <input
                type="date"
                value={snapshotEnd}
                onChange={
                  event =>
                    setSnapshotEnd(
                      event.target.value,
                    )
                }
              />
            </label>

            <button
              type="button"
              className="button button--primary"
              disabled={
                capturing
                ||
                !snapshotStart
                ||
                !snapshotEnd
              }
              onClick={
                () =>
                  void capture()
              }
            >
              {capturing
                ? "Capturing..."
                : "Capture immutable snapshot"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rhythm-analysis-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Bottlenecks
              </span>

              <h2>
                Performance by domain
              </h2>
            </div>
          </div>

          <div className="rhythm-domain-list">
            {dashboard
              ?.liveDomains
              .map(
                domain => (
                  <article
                    key={domain.dimensionKey}
                  >
                    <div>
                      <strong>
                        {domain.dimensionLabel}
                      </strong>

                      <span>
                        {domain.workloadSharePct.toFixed(
                          1,
                        )}
                        % of active workload
                      </span>
                    </div>

                    <div>
                      <span>
                        Active
                      </span>

                      <strong>
                        {domain.activeCount}
                      </strong>
                    </div>

                    <div>
                      <span>
                        SLA overdue
                      </span>

                      <strong
                        className={
                          domain.slaOverdueCount >
                          0
                            ? "rhythm-risk-text"
                            : ""
                        }
                      >
                        {domain.slaOverdueCount}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Persistent
                      </span>

                      <strong>
                        {domain.persistentCount}
                      </strong>
                    </div>

                    <div>
                      <span>
                        SLA attainment
                      </span>

                      <strong>
                        {domain.resolvedCount >
                        0
                          ? `${domain.slaAttainmentPct.toFixed(0)}%`
                          : "—"}
                      </strong>
                    </div>
                  </article>
                ),
              )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Capacity
              </span>

              <h2>
                Owner workload
              </h2>
            </div>
          </div>

          <div className="table-scroll">
            <SmartTable className="data-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Active</th>
                  <th>Share</th>
                  <th>SLA late</th>
                  <th>Persistent</th>
                  <th>Resolved</th>
                  <th>Avg resolve</th>
                </tr>
              </thead>

              <tbody>
                {dashboard
                  ?.liveOwners
                  .map(
                    owner => (
                      <tr
                        key={owner.dimensionKey}
                      >
                        <td>
                          <strong>
                            {owner.dimensionLabel}
                          </strong>
                        </td>

                        <td>
                          {owner.activeCount}
                        </td>

                        <td>
                          {owner.workloadSharePct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          <span
                            className={
                              owner.slaOverdueCount >
                              0
                                ? "rhythm-risk-text"
                                : ""
                            }
                          >
                            {owner.slaOverdueCount}
                          </span>
                        </td>

                        <td>
                          {owner.persistentCount}
                        </td>

                        <td>
                          {owner.resolvedCount}
                        </td>

                        <td>
                          {owner.avgResolutionHours.toFixed(
                            1,
                          )}
                          h
                        </td>
                      </tr>
                    ),
                  )}
              </tbody>
            </SmartTable>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Historical trend
            </span>

            <h2>
              Performance snapshots
            </h2>
          </div>

          <History
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Period</th>
                <th>Backlog</th>
                <th>SLA overdue</th>
                <th>Persistent</th>
                <th>Resolved</th>
                <th>SLA attainment</th>
                <th>Avg resolve</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.snapshots
                  .map(
                    snapshot => (
                      <tr
                        key={snapshot.id}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {snapshot.snapshotNumber}
                            </strong>

                            <span>
                              {snapshot.capturedByName}
                              {" · "}
                              {new Date(
                                snapshot.capturedAt,
                              )
                                .toLocaleString()}
                            </span>
                          </div>
                        </td>

                        <td>
                          {snapshot.periodStart}
                          {" → "}
                          {snapshot.periodEnd}
                        </td>

                        <td>
                          {snapshot.activeBacklogCount}
                        </td>

                        <td>
                          <span
                            className={
                              snapshot.slaOverdueCount >
                              0
                                ? "rhythm-risk-text"
                                : ""
                            }
                          >
                            {snapshot.slaOverdueCount}
                          </span>
                        </td>

                        <td>
                          {snapshot.persistentExceptionCount}
                        </td>

                        <td>
                          {snapshot.resolvedCount}
                        </td>

                        <td>
                          {snapshot.resolvedCount >
                          0
                            ? `${snapshot.slaAttainmentPct.toFixed(1)}%`
                            : "—"}
                        </td>

                        <td>
                          {snapshot.avgResolutionHours.toFixed(
                            1,
                          )}
                          h
                        </td>

                        <td>
                          <Link
                            href={
                              `/operating-rhythm/${snapshot.id}`
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
              (
                dashboard
                  ?.snapshots
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No performance
                    snapshots have been
                    captured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="rhythm-method-note">
        <GaugeCircle
          size={18}
        />

        <div>
          <strong>
            SLA methodology
          </strong>

          <p>
            Resolved-item SLA attainment
            uses the actual control-tower
            lifecycle: an item is on time
            only when its resolution
            timestamp is on or before its
            SLA deadline. Persistent
            backlog means an active
            exception has remained in the
            queue for at least seven days.
          </p>
        </div>
      </section>
    </div>
  );
}
