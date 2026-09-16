"use client";

import {
  ArrowLeft,
  CircleAlert,
  LockKeyhole,
} from "lucide-react";

import Link from "next/link";

import {
  getFlywheelVarianceSnapshot,
} from "@/lib/api";

import type {
  FlywheelVarianceSnapshotDetail,
} from "@/types/flywheel-variance";

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

export default function FlywheelVarianceSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FlywheelVarianceSnapshotDetail |
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

    getFlywheelVarianceSnapshot(
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
                : "Unable to load variance evidence.",
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
        Loading variance evidence...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-variance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Variance resolution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Variance snapshot not found."}
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
          `/flywheel-variance/${snapshot.variancePlanId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Variance plan
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable variance evidence
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {snapshot.planNumber}
            {" · "}
            {snapshot.currency}
            {" · "}
            {
              snapshot
                .reconciliationNumber
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
            Recovery
          </span>

          <strong>
            {money(
              snapshot
                .recoverAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Write-off
          </span>

          <strong>
            {money(
              snapshot
                .writeOffAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Investigation
          </span>

          <strong>
            {money(
              snapshot
                .investigationAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Coverage
          </span>

          <strong>
            {
              snapshot
                .coveragePct
                .toFixed(1)
            }
            %
          </strong>
        </article>

        <article>
          <span>
            Status
          </span>

          <strong>
            {readable(
              snapshot
                .planStatus,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen treatment authority
            </span>

            <h2>
              Snapshot decisions
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Variance</th>
                <th>Decision</th>
                <th>Target</th>
                <th>Rationale</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={
                      item
                        .settlementItemId
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
                          .sourceVarianceAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.decision,
                      )}
                    </td>

                    <td>
                      {
                        item
                          .targetDate
                      }
                    </td>

                    <td>
                      {
                        item
                          .decisionRationale
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
            Treatment evidence is sealed
          </strong>

          <p>
            The snapshot preserves the
            approved treatment mix and
            cannot be rewritten after
            sealing.
          </p>
        </div>
      </section>
    </div>
  );
}
