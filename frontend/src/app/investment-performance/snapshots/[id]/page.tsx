"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getInvestmentPerformanceSnapshot,
} from "@/lib/api";

import type {
  InvestmentPerformanceSnapshotDetail,
} from "@/types/investment-performance";

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

export default function InvestmentPerformanceSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      InvestmentPerformanceSnapshotDetail |
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

    getInvestmentPerformanceSnapshot(
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
                : "Unable to load investment-performance snapshot.",
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
          href="/investment-performance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Investment performance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Investment-performance snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/investment-performance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Investment performance
      </Link>

      <section className="investment-performance-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable investment-performance snapshot
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

      <section className="investment-performance-score-grid">
        <article className="investment-performance-score-card">
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

        <article>
          <span>
            Funding variance
          </span>

          <strong>
            {detail.snapshot.averageFundingVariancePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Capital efficiency
          </span>

          <strong>
            {detail.snapshot.averageCapitalEfficiencyMultiple.toFixed(
              2,
            )}
            x
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
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen realized economics
            </span>

            <h2>
              Investment portfolio at capture time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Health</th>
                <th>Released</th>
                <th>Baseline investment</th>
                <th>Baseline ROI</th>
                <th>Realized ROI</th>
                <th>ROI variance</th>
                <th>Funding variance</th>
                <th>Efficiency</th>
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
                          {item.initiativeTitle}
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
                        item.releasedCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.baselineInvestmentCostAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.baselineRoiPct.toFixed(
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
                        ? `${item.fundingVariancePct.toFixed(1)}%`
                        : "—"}
                    </td>

                    <td>
                      {item.assessed
                        ? `${item.capitalEfficiencyMultiple.toFixed(2)}x`
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

      <section className="investment-performance-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable post-funding performance evidence
          </strong>

          <p>
            The snapshot freezes realized
            ROI, funding variance, capital
            efficiency, value variance and
            health without modifying the
            Step 56 investment case or
            Step 58 funding evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
