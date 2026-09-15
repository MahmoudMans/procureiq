"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  getStrategyExecutionReview,
} from "@/lib/api";

import type {
  ExecutionReviewDetail,
} from "@/types/strategy-execution";

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

export default function StrategyExecutionReviewPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      ExecutionReviewDetail |
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

    getStrategyExecutionReview(
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
                : "Unable to load execution review.",
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
        Loading execution review...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategic execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Execution review not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategy-execution"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategic execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable execution review
          </span>

          <h1>
            {detail.review.reviewNumber}
          </h1>

          <p>
            {detail.review.roadmapNumber}
            {" · "}
            {detail.review.roadmapTitle}
            {" · Captured by "}
            {detail.review.capturedByName}
          </p>
        </div>

        <Camera
          size={24}
        />
      </section>

      <section className="execution-score-grid">
        <article className="execution-score-card">
          <span>
            Execution score
          </span>

          <strong>
            {detail.summary.executionScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.summary.executionHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Average progress
          </span>

          <strong>
            {detail.summary.averageProgressPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Schedule health
          </span>

          <strong>
            {detail.summary.scheduleHealthPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Outcome validation
          </span>

          <strong>
            {detail.summary.outcomeValidationPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Validated contribution
          </span>

          <strong>
            {detail.summary.validatedContributionPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Value at risk
          </span>

          <strong>
            {detail.summary.valueAtRiskPoints.toFixed(
              1,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen execution portfolio
            </span>

            <h2>
              Commitments at review time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Commitment</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Health</th>
                <th>Progress</th>
                <th>Forecast</th>
                <th>Blockers</th>
                <th>Planned</th>
                <th>Reported</th>
                <th>Validated</th>
                <th>VAR</th>
              </tr>
            </thead>

            <tbody>
              {detail.commitments.map(
                commitment => (
                  <tr
                    key={commitment.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {commitment.sourceInitiativeTitle}
                        </strong>

                        <span>
                          {commitment.commitmentNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {commitment.ownerName}
                    </td>

                    <td>
                      {readable(
                        commitment.status,
                      )}
                    </td>

                    <td>
                      {readable(
                        commitment.health,
                      )}
                    </td>

                    <td>
                      {commitment.progressPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {commitment.forecastEndDate}
                    </td>

                    <td>
                      {commitment.blockerCount}
                    </td>

                    <td>
                      {commitment.plannedContributionPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {commitment.reportedContributionPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {commitment.validatedContributionPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {commitment.valueAtRiskPoints.toFixed(
                        1,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="execution-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable execution evidence
          </strong>

          <p>
            This review freezes commitment
            health, schedule position,
            blockers and value realization
            as they existed when the
            review was captured.
          </p>
        </div>
      </section>
    </div>
  );
}
