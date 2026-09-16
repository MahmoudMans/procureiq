"use client";

import {
  ArrowLeft,
  CircleAlert,
  LockKeyhole,
} from "lucide-react";

import Link from "next/link";

import {
  getFlywheelStrategySnapshot,
} from "@/lib/api";

import type {
  FlywheelStrategySnapshotDetail,
} from "@/types/flywheel-strategy";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

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
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${currency}`;
}

export default function FlywheelStrategySnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FlywheelStrategySnapshotDetail |
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

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    let active = true;

    getFlywheelStrategySnapshot(
      params.id,
    )
      .then(
        response => {
          if (active) {
            setDetail(
              response,
            );
          }
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load immutable strategy evidence.",
            );
          }
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
        Loading immutable strategy evidence...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-strategy"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Flywheel strategy
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Strategy snapshot not found."}
        </div>
      </div>
    );
  }

  const snapshot =
    detail.snapshot;

  return (
    <div className="page-stack">
      <Link
        href={
          `/flywheel-strategy/${snapshot.portfolioId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Portfolio
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable portfolio evidence
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {snapshot.portfolioNumber}
            {" · "}
            {snapshot.currency}
            {" · FY "}
            {snapshot.fiscalYear}
          </p>
        </div>

        <div className="fwstrategy-heading-actions">
          <LockKeyhole
            size={18}
          />

          <span className="fwstrategy-status-chip">
            Immutable
          </span>
        </div>
      </section>

      <section className="fwstrategy-detail-grid">
        <article>
          <span>
            Portfolio status
          </span>

          <strong>
            {readable(
              snapshot
                .portfolioStatus,
            )}
          </strong>
        </article>

        <article>
          <span>
            Capacity
          </span>

          <strong>
            {money(
              snapshot
                .capitalCapacityAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Prioritized
          </span>

          <strong>
            {money(
              snapshot
                .prioritizedCapacityAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining
          </span>

          <strong>
            {money(
              snapshot
                .remainingCapacityAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {
              snapshot
                .capacityUtilizationPct
                .toFixed(1)
            }
            %
          </strong>
        </article>

        <article>
          <span>
            Average priority
          </span>

          <strong>
            {
              snapshot
                .averagePriorityScore
                .toFixed(1)
            }
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen lineage allocation evidence
            </span>

            <h2>
              Snapshot items
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Proposed</th>
                <th>Cumulative value</th>
                <th>Marginal value</th>
                <th>Retention</th>
                <th>Priority</th>
                <th>Advisory</th>
                <th>Decision</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={
                      item
                        .flywheelLineageId
                    }
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {
                            item
                              .rootTargetInitiativeTitle
                          }
                        </strong>

                        <span>
                          {
                            item
                              .lineageNumber
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      {money(
                        item
                          .proposedCapacityAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {
                        item
                          .cumulativeValueMultiple
                          .toFixed(2)
                      }
                      x
                    </td>

                    <td>
                      {
                        item
                          .latestMarginalValueMultiple
                          .toFixed(2)
                      }
                      x
                    </td>

                    <td>
                      {
                        item
                          .latestMarginalNetValueRetentionPct
                          .toFixed(1)
                      }
                      %
                    </td>

                    <td>
                      {
                        item
                          .priorityScore
                          .toFixed(1)
                      }
                    </td>

                    <td>
                      {readable(
                        item
                          .advisoryRecommendation,
                      )}
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {readable(
                            item.decision,
                          )}
                        </strong>

                        {item.decisionNote ? (
                          <span>
                            {
                              item
                                .decisionNote
                            }
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ),
              )}

              {detail.items.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    Snapshot contains no
                    lineage allocation
                    rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fwstrategy-method-note">
        <LockKeyhole
          size={18}
        />

        <div>
          <strong>
            Evidence is append-only
          </strong>

          <p>
            Snapshot headers and
            snapshot lineage rows are
            protected against update
            and deletion by database
            triggers. This page is
            intentionally read-only.
          </p>
        </div>
      </section>
    </div>
  );
}
