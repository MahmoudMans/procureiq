"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getCapitalFlywheelSnapshot,
} from "@/lib/api";

import type {
  CapitalFlywheelSnapshotDetail,
} from "@/types/capital-flywheel";

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
  currency = "",
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}${currency ? ` ${currency}` : ""}`;
}

export default function CapitalFlywheelSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      CapitalFlywheelSnapshotDetail |
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

    getCapitalFlywheelSnapshot(
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
                : "Unable to load capital-flywheel snapshot.",
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
        Loading capital-flywheel snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-flywheel"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital flywheel
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capital-flywheel snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/capital-flywheel"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital flywheel
      </Link>

      <section className="flywheel-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable capital-flywheel portfolio
          </span>

          <h1>
            {detail.snapshot.snapshotNumber}
          </h1>

          <p>
            Captured by
            {" "}
            {detail.snapshot.capturedByName}
            {" · "}
            {new Date(
              detail.snapshot.capturedAt,
            )
              .toLocaleString()}
          </p>
        </div>

        <Camera
          size={24}
        />
      </section>

      <section className="flywheel-score-grid">
        <article>
          <span>
            Lineages
          </span>

          <strong>
            {detail.snapshot.lineageCount}
          </strong>
        </article>

        <article>
          <span>
            Cycles
          </span>

          <strong>
            {detail.snapshot.totalCycleCount}
          </strong>
        </article>

        <article>
          <span>
            Review queue
          </span>

          <strong>
            {detail.snapshot.reviewPendingLineageCount}
          </strong>
        </article>

        <article>
          <span>
            Diminishing
          </span>

          <strong>
            {detail.snapshot.diminishingReturnLineageCount}
          </strong>
        </article>

        <article>
          <span>
            Marginal multiple
          </span>

          <strong>
            {detail.snapshot.averageLatestMarginalValueMultiple.toFixed(
              2,
            )}
            x
          </strong>
        </article>

        <article className="flywheel-score-card">
          <span>
            Cumulative value multiple
          </span>

          <strong>
            {detail.snapshot.averageCumulativeValueMultiple.toFixed(
              2,
            )}
            x
          </strong>
        </article>
      </section>

      <section className="flywheel-value-grid">
        <article>
          <span>
            Original capital
          </span>

          <strong>
            {money(
              detail.snapshot.totalOriginalCapitalAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Cumulative projected net
          </span>

          <strong>
            {money(
              detail.snapshot.totalCumulativeProjectedNetValueAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Compounding
          </span>

          <strong>
            {money(
              detail.snapshot.totalCompoundingValueAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Decay
          </span>

          <strong>
            {money(
              detail.snapshot.totalDecayedValueAmount,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen multi-cycle economics
            </span>

            <h2>
              Capital lineages at capture time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Status</th>
                <th>Health</th>
                <th>Cycles</th>
                <th>Original capital</th>
                <th>Cumulative net</th>
                <th>Compounding</th>
                <th>Decay</th>
                <th>Value multiple</th>
                <th>Marginal multiple</th>
                <th>Marginal retention</th>
                <th>Diminishing</th>
                <th>Recommendation</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.lineageId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.rootTargetInitiativeTitle}
                        </strong>

                        <span>
                          {item.lineageNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item.lineageStatus,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.flywheelHealth,
                      )}
                    </td>

                    <td>
                      {item.cycleCount}
                    </td>

                    <td>
                      {money(
                        item.originalCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.cumulativeProjectedNetValueAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.cumulativeCompoundingValueAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.cumulativeDecayedValueAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.cumulativeValueMultiple.toFixed(
                        2,
                      )}
                      x
                    </td>

                    <td>
                      {item.latestMarginalValueMultiple.toFixed(
                        2,
                      )}
                      x
                    </td>

                    <td>
                      {item.latestMarginalNetValueRetentionPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.diminishingReturns
                        ? "Yes"
                        : "No"}
                    </td>

                    <td>
                      {readable(
                        item.recommendation,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flywheel-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable multi-cycle compounding evidence
          </strong>

          <p>
            This snapshot freezes
            cumulative value per original
            capital unit, marginal returns,
            diminishing-return signals and
            continuation recommendations
            without changing Steps 56–65.
          </p>
        </div>
      </section>
    </div>
  );
}
