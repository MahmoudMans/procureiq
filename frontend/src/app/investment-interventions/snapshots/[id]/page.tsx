"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getInvestmentInterventionSnapshot,
} from "@/lib/api";

import type {
  InvestmentInterventionSnapshotDetail,
} from "@/types/investment-intervention";

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

export default function InvestmentInterventionSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      InvestmentInterventionSnapshotDetail |
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

    getInvestmentInterventionSnapshot(
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
                : "Unable to load intervention snapshot.",
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
        Loading intervention snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/investment-interventions"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Investment intervention
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Intervention snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/investment-interventions"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Investment intervention
      </Link>

      <section className="intervention-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable intervention portfolio
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

      <section className="intervention-score-grid">
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
            In review
          </span>

          <strong>
            {detail.snapshot.inReviewCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Approved
          </span>

          <strong>
            {detail.snapshot.approvedCaseCount}
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
            Affected capital
          </span>

          <strong>
            {money(
              detail.snapshot.totalApprovedAffectedCapitalAmount,
            )}
          </strong>
        </article>

        <article className="intervention-score-card">
          <span>
            Approved reallocation
          </span>

          <strong>
            {money(
              detail.snapshot.totalApprovedReallocationAmount,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen intervention portfolio
            </span>

            <h2>
              Governance state at capture time
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
                <th>Remaining</th>
                <th>Realized ROI</th>
                <th>ROI variance</th>
                <th>Efficiency</th>
                <th>Recommendation</th>
                <th>Approved action</th>
                <th>Affected</th>
                <th>Target</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.interventionCaseId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.interventionNumber}
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
                        item.currentPerformanceHealth,
                      )}
                    </td>

                    <td>
                      {money(
                        item.currentReleasedCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.currentRemainingCommitmentAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.currentRealizedRoiPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.currentRoiVariancePct.toFixed(
                        1,
                      )}
                      {" pts"}
                    </td>

                    <td>
                      {item.currentCapitalEfficiencyMultiple.toFixed(
                        2,
                      )}
                      x
                    </td>

                    <td>
                      {readable(
                        item.recommendedAction,
                      )}
                    </td>

                    <td>
                      {item.approvedAction
                        ? readable(
                            item.approvedAction,
                          )
                        : "—"}
                    </td>

                    <td>
                      {money(
                        item.approvedAffectedCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.approvedTargetValueCaseNumber ??
                        "—"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="intervention-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable intervention evidence
          </strong>

          <p>
            This snapshot freezes current
            performance, remaining
            unreleased capital, advisory
            recommendations and approved
            intervention decisions without
            altering any upstream funding
            or performance record.
          </p>
        </div>
      </section>
    </div>
  );
}
