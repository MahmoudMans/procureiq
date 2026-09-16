"use client";

import {
  ArrowLeft,
  CircleAlert,
  LockKeyhole,
} from "lucide-react";

import Link from "next/link";

import {
  getFlywheelVarianceExecutionSnapshot,
} from "@/lib/api";

import type {
  FlywheelVarianceExecutionSnapshotDetail,
} from "@/types/flywheel-variance-execution";

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

export default function FlywheelVarianceExecutionSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FlywheelVarianceExecutionSnapshotDetail |
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

    getFlywheelVarianceExecutionSnapshot(
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
                : "Unable to load execution snapshot.",
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
        Loading execution evidence...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-variance-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Treatment execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Execution snapshot not found."}
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
          `/flywheel-variance-execution/${snapshot.executionCaseId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Execution case
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable treatment evidence
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {
              snapshot
                .executionNumber
            }
            {" · "}
            {snapshot.currency}
            {" · "}
            {
              snapshot
                .variancePlanNumber
            }
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
            Source variance
          </span>

          <strong>
            {money(
              snapshot
                .sourceVarianceAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Recovered
          </span>

          <strong>
            {money(
              snapshot
                .recoveredAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Written off
          </span>

          <strong>
            {money(
              snapshot
                .writtenOffAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Investigation complete
          </span>

          <strong>
            {money(
              snapshot
                .completedInvestigationAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Financial residual
          </span>

          <strong>
            {money(
              snapshot.exposure.financialResidualAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Treatment completion
          </span>

          <strong>
            {
              snapshot
                .completionPct
                .toFixed(1)
            }
            %
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen treatment execution
            </span>

            <h2>
              Snapshot evidence
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Decision</th>
                <th>Variance</th>
                <th>Executed</th>
                <th>Outcome</th>
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
                      item.varianceItemId
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
                      {readable(
                        item
                          .sourceDecision,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .sourceVarianceAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .executedAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.outcome,
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

      <section className="panel">
        <h2>Financial residual and evidence coverage</h2>
        <p>
          Financial residual equals approved variance minus recorded recoveries
          and recorded write-offs. Completing an investigation does not reduce
          that residual. Treatment completion measures workflow progress, not
          cash recovered or accounting entries posted by ProcureIQ.
        </p>

          <p>
            Variance without recorded evidence: {money(
              snapshot.exposure.unrecordedVarianceAmount, snapshot.currency,
            )}. Evidence coverage: {snapshot.exposure.evidenceCoveragePct.toFixed(2)}%.
          </p>

          <p>These additional metrics use only the captured amounts in this snapshot.
          Its stored evidence and original treatment metrics are unchanged.</p>
      </section>
    </div>
  );
}
