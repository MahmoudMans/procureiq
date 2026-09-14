"use client";

import {
  ArrowLeft,
  CircleAlert,
  GaugeCircle,
  History,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  getOperatingRhythmSnapshot,
} from "@/lib/api";

import type {
  OperatingRhythmSnapshotDetail,
} from "@/types/operating-rhythm";

function money(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export default function OperatingRhythmSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      OperatingRhythmSnapshotDetail |
      null
    >(null);

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

    getOperatingRhythmSnapshot(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDetail(
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
              : "Unable to load operating-rhythm snapshot.",
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
    params.id,
  ]);

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading operating-rhythm snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/operating-rhythm"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Operating rhythm
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Operating-rhythm snapshot not found."}
        </div>
      </div>
    );
  }

  const {
    snapshot,
    metrics,
  } = detail;

  return (
    <div className="page-stack">
      <Link
        href="/operating-rhythm"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Operating rhythm
      </Link>

      <section className="rhythm-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable operating snapshot
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {snapshot.periodStart}
            {" → "}
            {snapshot.periodEnd}
            {" · "}
            {snapshot.currency}
            {" · Captured by "}
            {snapshot.capturedByName}
          </p>
        </div>

        <div className="rhythm-captured-card">
          <span>
            Captured
          </span>

          <strong>
            {new Date(
              snapshot.capturedAt,
            )
              .toLocaleString()}
          </strong>
        </div>
      </section>

      <section className="rhythm-detail-kpis">
        <article>
          <span>Active backlog</span>
          <strong>{metrics.activeBacklogCount}</strong>
        </article>

        <article>
          <span>SLA overdue</span>
          <strong className={metrics.slaOverdueCount > 0 ? "rhythm-risk-text" : ""}>
            {metrics.slaOverdueCount}
          </strong>
        </article>

        <article>
          <span>Persistent ≥7d</span>
          <strong>{metrics.persistentExceptionCount}</strong>
        </article>

        <article>
          <span>Resolved</span>
          <strong>{metrics.resolvedCount}</strong>
        </article>

        <article>
          <span>SLA attainment</span>
          <strong>
            {metrics.resolvedCount > 0
              ? `${metrics.slaAttainmentPct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article>
          <span>Active exposure</span>
          <strong>
            {money(
              metrics.activeMonetaryExposure,
              snapshot.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="rhythm-detail-secondary">
        <article>
          <span>Critical backlog</span>
          <strong>{metrics.criticalBacklogCount}</strong>
        </article>

        <article>
          <span>High backlog</span>
          <strong>{metrics.highBacklogCount}</strong>
        </article>

        <article>
          <span>Unassigned</span>
          <strong>{metrics.unassignedCount}</strong>
        </article>

        <article>
          <span>On-time resolutions</span>
          <strong>{metrics.onTimeResolvedCount}</strong>
        </article>

        <article>
          <span>Late resolutions</span>
          <strong>{metrics.lateResolvedCount}</strong>
        </article>

        <article>
          <span>Avg resolution</span>
          <strong>{metrics.avgResolutionHours.toFixed(1)}h</strong>
        </article>

        <article>
          <span>Avg backlog age</span>
          <strong>{metrics.avgActiveAgeDays.toFixed(1)}d</strong>
        </article>
      </section>

      <section className="rhythm-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Bottlenecks</span>
              <h2>Domain scorecard</h2>
            </div>

            <GaugeCircle size={19} />
          </div>

          <div className="rhythm-domain-list">
            {detail.domains.map(
              domain => (
                <article key={domain.dimensionKey}>
                  <div>
                    <strong>{domain.dimensionLabel}</strong>
                    <span>{domain.workloadSharePct.toFixed(1)}% workload share</span>
                  </div>

                  <div>
                    <span>Active</span>
                    <strong>{domain.activeCount}</strong>
                  </div>

                  <div>
                    <span>SLA overdue</span>
                    <strong>{domain.slaOverdueCount}</strong>
                  </div>

                  <div>
                    <span>Persistent</span>
                    <strong>{domain.persistentCount}</strong>
                  </div>

                  <div>
                    <span>SLA</span>
                    <strong>
                      {domain.resolvedCount > 0
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
              <span className="eyebrow">Workload</span>
              <h2>Owner performance</h2>
            </div>

            <History size={19} />
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Active</th>
                  <th>Share</th>
                  <th>Late</th>
                  <th>Persistent</th>
                  <th>Resolved</th>
                  <th>SLA</th>
                </tr>
              </thead>

              <tbody>
                {detail.owners.map(
                  owner => (
                    <tr key={owner.dimensionKey}>
                      <td><strong>{owner.dimensionLabel}</strong></td>
                      <td>{owner.activeCount}</td>
                      <td>{owner.workloadSharePct.toFixed(1)}%</td>
                      <td>{owner.slaOverdueCount}</td>
                      <td>{owner.persistentCount}</td>
                      <td>{owner.resolvedCount}</td>
                      <td>
                        {owner.resolvedCount > 0
                          ? `${owner.slaAttainmentPct.toFixed(0)}%`
                          : "—"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Root-cause concentration</span>
            <h2>Exception-type performance</h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Exception type</th>
                <th>Active</th>
                <th>Workload share</th>
                <th>SLA overdue</th>
                <th>Persistent</th>
                <th>Resolved</th>
                <th>SLA attainment</th>
                <th>Exposure</th>
              </tr>
            </thead>

            <tbody>
              {detail.exceptionTypes.map(
                type => (
                  <tr key={type.dimensionKey}>
                    <td><strong>{type.dimensionLabel}</strong></td>
                    <td>{type.activeCount}</td>
                    <td>{type.workloadSharePct.toFixed(1)}%</td>
                    <td>{type.slaOverdueCount}</td>
                    <td>{type.persistentCount}</td>
                    <td>{type.resolvedCount}</td>
                    <td>
                      {type.resolvedCount > 0
                        ? `${type.slaAttainmentPct.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td>
                      {money(
                        type.activeExposure,
                        snapshot.currency,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rhythm-method-note">
        <GaugeCircle size={18} />

        <div>
          <strong>Immutable operating record</strong>

          <p>
            Snapshot metrics and dimension rows cannot be updated or deleted
            after capture. This preserves an auditable historical view even
            as the live control-tower queue continues to change.
          </p>
        </div>
      </section>
    </div>
  );
}
