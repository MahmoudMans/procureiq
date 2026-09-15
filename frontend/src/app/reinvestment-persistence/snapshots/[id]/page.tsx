"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getReinvestmentPersistenceSnapshot,
} from "@/lib/api";

import type {
  ReinvestmentPersistenceSnapshotDetail,
} from "@/types/reinvestment-persistence";

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

export default function ReinvestmentPersistenceSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      ReinvestmentPersistenceSnapshotDetail |
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

    getReinvestmentPersistenceSnapshot(
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
                : "Unable to load persistence snapshot.",
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
        Loading persistence snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/reinvestment-persistence"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Reinvestment persistence
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Reinvestment-persistence snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/reinvestment-persistence"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Reinvestment persistence
      </Link>

      <section className="rpersist-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable persistence portfolio
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

      <section className="rpersist-score-grid">
        <article>
          <span>
            Cases
          </span>

          <strong>
            {detail.snapshot.caseCount}
          </strong>
        </article>

        <article>
          <span>
            Compounding
          </span>

          <strong>
            {detail.snapshot.compoundingCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Sustained
          </span>

          <strong>
            {detail.snapshot.sustainedCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Regressed
          </span>

          <strong>
            {detail.snapshot.regressedCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Efficiency
          </span>

          <strong>
            {detail.snapshot.averageEfficiencyRetentionPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article className="rpersist-score-card">
          <span>
            Persistence
          </span>

          <strong>
            {detail.snapshot.averageValuePersistencePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen recycling effectiveness
            </span>

            <h2>
              Durable value at capture time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Status</th>
                <th>Health</th>
                <th>Baseline annual</th>
                <th>Current annual</th>
                <th>Baseline net</th>
                <th>Projected net</th>
                <th>Baseline ROI</th>
                <th>Projected ROI</th>
                <th>Persistence</th>
                <th>Efficiency</th>
                <th>Compounding</th>
                <th>Decay</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.persistenceCaseId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.targetInitiativeTitle}
                        </strong>

                        <span>
                          {item.persistenceCaseNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item.caseStatus,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.health,
                      )}
                    </td>

                    <td>
                      {money(
                        item.baselineAnnualizedValueAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.currentAnnualizedValueAmount,
                            item.currency,
                          )
                        : "—"}
                    </td>

                    <td>
                      {money(
                        item.baselineNetValueAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.currentProjectedNetValueAmount,
                            item.currency,
                          )
                        : "—"}
                    </td>

                    <td>
                      {item.baselineRoiPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.assessed
                        ? `${item.currentProjectedRoiPct.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? `${item.valuePersistencePct.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? `${item.efficiencyRetentionPct.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.compoundingValueAmount,
                            item.currency,
                          )
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.decayedValueAmount,
                            item.currency,
                          )
                        : "—"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rpersist-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable recycling-effectiveness evidence
          </strong>

          <p>
            This snapshot freezes durable
            value, efficiency retention,
            projected ROI, compounding and
            decay without modifying any
            Step 56–64 authority.
          </p>
        </div>
      </section>
    </div>
  );
}
