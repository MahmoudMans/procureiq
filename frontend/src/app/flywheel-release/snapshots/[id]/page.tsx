"use client";

import {
  ArrowLeft,
  CircleAlert,
  LockKeyhole,
} from "lucide-react";

import Link from "next/link";

import {
  getFlywheelReleaseSnapshot,
} from "@/lib/api";

import type {
  FlywheelReleaseSnapshotDetail,
} from "@/types/flywheel-release";

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

export default function FlywheelReleaseSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FlywheelReleaseSnapshotDetail |
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

    getFlywheelReleaseSnapshot(
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
                : "Unable to load immutable release evidence.",
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
        Loading release evidence...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-release"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital release
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Release snapshot not found."}
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
          `/flywheel-release/${snapshot.releaseBatchId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Release batch
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable release evidence
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {snapshot.releaseNumber}
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
            Release status
          </span>

          <strong>
            {readable(
              snapshot
                .releaseStatus,
            )}
          </strong>
        </article>

        <article>
          <span>
            Mandate authority
          </span>

          <strong>
            {money(
              snapshot
                .mandateAuthorizedAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Batch planned
          </span>

          <strong>
            {money(
              snapshot
                .batchPlannedReleaseAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Batch released
          </span>

          <strong>
            {money(
              snapshot
                .batchReleasedAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Cumulative released
          </span>

          <strong>
            {money(
              snapshot
                .cumulativeMandateReleasedAmount,
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
                .remainingMandateAmount,
              snapshot.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen execution evidence
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
                <th>Authorized</th>
                <th>Planned</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Evidence</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={
                      item
                        .allocationItemId
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
                          .mandateAuthorizedItemAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .plannedReleaseAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {readable(
                        item
                          .releaseItemStatus,
                      )}
                    </td>

                    <td>
                      {
                        item
                          .executionReference
                        ??
                        "—"
                      }
                    </td>

                    <td>
                      {
                        item
                          .executionNote
                        ??
                        item
                          .cancellationNote
                        ??
                        "—"
                      }
                    </td>
                  </tr>
                ),
              )}

              {detail.items.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="table-empty-state"
                  >
                    Snapshot contains no
                    release items.
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
            Execution evidence is append-only
          </strong>

          <p>
            Release snapshots preserve
            the recorded Step 69
            execution state and are
            protected against UPDATE
            and DELETE operations at the
            database layer.
          </p>
        </div>
      </section>
    </div>
  );
}
