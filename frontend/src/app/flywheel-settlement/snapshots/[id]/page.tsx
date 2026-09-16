"use client";

import {
  ArrowLeft,
  CircleAlert,
  LockKeyhole,
} from "lucide-react";

import Link from "next/link";

import {
  getFlywheelSettlementSnapshot,
} from "@/lib/api";

import type {
  FlywheelSettlementSnapshotDetail,
} from "@/types/flywheel-settlement";

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

export default function FlywheelSettlementSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FlywheelSettlementSnapshotDetail |
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

    getFlywheelSettlementSnapshot(
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
                : "Unable to load immutable settlement evidence.",
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
        Loading settlement evidence...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-settlement"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Settlement evidence
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Settlement snapshot not found."}
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
          `/flywheel-settlement/${snapshot.settlementCaseId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Reconciliation case
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable settlement evidence
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {
              snapshot
                .reconciliationNumber
            }
            {" · "}
            {snapshot.currency}
            {" · "}
            {snapshot.releaseNumber}
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
            Case status
          </span>

          <strong>
            {readable(
              snapshot.caseStatus,
            )}
          </strong>
        </article>

        <article>
          <span>
            Released
          </span>

          <strong>
            {money(
              snapshot
                .sourceReleasedAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Settled
          </span>

          <strong>
            {money(
              snapshot
                .settledAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Variance
          </span>

          <strong>
            {money(
              snapshot
                .varianceAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Settlement
          </span>

          <strong>
            {
              snapshot
                .settlementPct
                .toFixed(1)
            }
            %
          </strong>
        </article>

        <article>
          <span>
            Unresolved
          </span>

          <strong>
            {
              snapshot
                .unresolvedCount
            }
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen settlement evidence
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
                <th>Released</th>
                <th>Settled</th>
                <th>Variance</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Date</th>
                <th>Evidence</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={
                      item.releaseItemId
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
                          .sourceReleasedAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .settledAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .varianceAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {readable(
                        item
                          .reconciliationStatus,
                      )}
                    </td>

                    <td>
                      {
                        item
                          .evidenceReference
                        ??
                        "—"
                      }
                    </td>

                    <td>
                      {
                        item
                          .evidenceDate
                      }
                    </td>

                    <td>
                      {
                        item
                          .evidenceNote
                      }
                    </td>
                  </tr>
                ),
              )}
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
            Settlement evidence is sealed
          </strong>

          <p>
            Snapshot headers and item
            evidence cannot be modified
            after sealing. The database
            also validates snapshot
            totals against the captured
            item evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
