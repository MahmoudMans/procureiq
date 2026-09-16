"use client";

import {
  ArrowLeft,
  CircleAlert,
  LockKeyhole,
} from "lucide-react";

import Link from "next/link";

import {
  getFlywheelAllocationSnapshot,
} from "@/lib/api";

import type {
  FlywheelAllocationSnapshotDetail,
} from "@/types/flywheel-allocation";

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

export default function FlywheelAllocationSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FlywheelAllocationSnapshotDetail |
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

    getFlywheelAllocationSnapshot(
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
                : "Unable to load immutable allocation evidence.",
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
        Loading allocation evidence...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-allocation"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital mandates
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Allocation snapshot not found."}
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
          `/flywheel-allocation/${snapshot.mandateId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Allocation mandate
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable allocation evidence
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {snapshot.mandateNumber}
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
            Mandate status
          </span>

          <strong>
            {readable(
              snapshot.mandateStatus,
            )}
          </strong>
        </article>

        <article>
          <span>
            Strategy capacity
          </span>

          <strong>
            {money(
              snapshot
                .strategyPrioritizedCapacityAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Requested
          </span>

          <strong>
            {money(
              snapshot
                .requestedAllocationAmount,
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
                .remainingStrategyCapacityAmount,
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
                .allocationUtilizationPct
                .toFixed(1)
            }
            %
          </strong>
        </article>

        <article>
          <span>
            Items
          </span>

          <strong>
            {snapshot.itemCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen allocation evidence
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
                <th>Step 67 capacity</th>
                <th>Requested</th>
                <th>Priority</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={
                      item.strategyItemId
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
                          .strategyProposedCapacityAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      <strong>
                        {money(
                          item
                            .requestedAllocationAmount,
                          snapshot.currency,
                        )}
                      </strong>
                    </td>

                    <td>
                      {
                        item
                          .strategyPriorityScore
                          .toFixed(1)
                      }
                    </td>
                  </tr>
                ),
              )}

              {detail.items.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="table-empty-state"
                  >
                    Snapshot contains no
                    allocation items.
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
            Authorization evidence is append-only
          </strong>

          <p>
            Snapshot headers and
            allocation rows are
            protected from UPDATE and
            DELETE operations by
            database triggers.
          </p>
        </div>
      </section>
    </div>
  );
}
