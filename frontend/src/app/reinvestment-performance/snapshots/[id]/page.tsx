"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getReinvestmentPerformanceSnapshot,
} from "@/lib/api";

import type {
  ReinvestmentPerformanceSnapshotDetail,
} from "@/types/reinvestment-performance";

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

export default function ReinvestmentPerformanceSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      ReinvestmentPerformanceSnapshotDetail |
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

    getReinvestmentPerformanceSnapshot(
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
                : "Unable to load reinvestment-performance snapshot.",
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
        Loading performance snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/reinvestment-performance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Reinvestment performance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Reinvestment-performance snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/reinvestment-performance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Reinvestment performance
      </Link>

      <section className="reinvestment-performance-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable value-realization portfolio
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

      <section className="reinvestment-performance-score-grid">
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
            Assessed
          </span>

          <strong>
            {detail.snapshot.assessedCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Underperforming
          </span>

          <strong>
            {detail.snapshot.underperformingCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Realized ROI
          </span>

          <strong>
            {detail.snapshot.averageRealizedRoiPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            ROI variance
          </span>

          <strong>
            {detail.snapshot.averageRoiVariancePct.toFixed(
              1,
            )}
            {" pts"}
          </strong>
        </article>

        <article className="reinvestment-performance-score-card">
          <span>
            Realization
          </span>

          <strong>
            {detail.snapshot.averageRealizationPct.toFixed(
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
              Frozen post-redeployment outcomes
            </span>

            <h2>
              Value realization at capture time
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
                <th>Capital</th>
                <th>Expected value</th>
                <th>Realized value</th>
                <th>Net value</th>
                <th>Target ROI</th>
                <th>Realized ROI</th>
                <th>ROI variance</th>
                <th>Realization</th>
                <th>Value variance</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.performanceCaseId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.targetInitiativeTitle}
                        </strong>

                        <span>
                          {item.performanceCaseNumber}
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
                        item.redeployedCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.expectedHorizonValueAmount,
                            item.currency,
                          )
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.realizedHorizonValueAmount,
                            item.currency,
                          )
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.realizedNetValueAmount,
                            item.currency,
                          )
                        : "—"}
                    </td>

                    <td>
                      {item.baselineTargetRoiPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.assessed
                        ? `${item.realizedRoiPct.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? `${item.roiVariancePct.toFixed(1)} pts`
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? `${item.realizationPct.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? money(
                            item.valueVarianceAmount,
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

      <section className="reinvestment-performance-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable post-redeployment performance evidence
          </strong>

          <p>
            The snapshot freezes realized
            ROI, realization percentage,
            value variance and
            underperformance status without
            changing Steps 56–63.
          </p>
        </div>
      </section>
    </div>
  );
}
