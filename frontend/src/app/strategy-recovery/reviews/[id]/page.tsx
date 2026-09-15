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
  getStrategyRecoveryReview,
} from "@/lib/api";

import type {
  RecoveryReviewDetail,
} from "@/types/strategy-recovery";

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

export default function StrategyRecoveryReviewPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      RecoveryReviewDetail |
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

    getStrategyRecoveryReview(
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
                : "Unable to load recovery review.",
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
        Loading recovery review...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-recovery"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Execution recovery
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Recovery review not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategy-recovery"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Execution recovery
      </Link>

      <section className="recovery-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable strategic recovery review
          </span>

          <h1>
            {detail.review.reviewNumber}
          </h1>

          <p>
            Captured by
            {" "}
            {detail.review.capturedByName}
            {" · "}
            {new Date(
              detail.review.capturedAt,
            )
              .toLocaleString()}
          </p>
        </div>

        <Camera
          size={24}
        />
      </section>

      <section className="recovery-score-grid">
        <article className="recovery-score-card">
          <span>
            Portfolio health
          </span>

          <strong>
            {readable(
              detail.review.portfolioHealth,
            )}
          </strong>

          <small>
            {detail.review.averageRecoveryScore.toFixed(
              1,
            )}
            {" / 100"}
          </small>
        </article>

        <article>
          <span>
            Avg effectiveness
          </span>

          <strong>
            {detail.review.averageEffectivenessPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Baseline VAR
          </span>

          <strong>
            {detail.review.totalBaselineValueAtRiskPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current VAR
          </span>

          <strong>
            {detail.review.totalCurrentValueAtRiskPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Critical cases
          </span>

          <strong>
            {detail.review.criticalCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Escalations
          </span>

          <strong>
            {detail.review.escalationCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen recovery portfolio
            </span>

            <h2>
              Recovery state at review time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Recovery</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Baseline risk</th>
                <th>Current risk</th>
                <th>Effectiveness</th>
                <th>Recovery score</th>
                <th>VAR</th>
                <th>Actions</th>
                <th>Escalations</th>
              </tr>
            </thead>

            <tbody>
              {detail.cases.map(
                recoveryCase => (
                  <tr
                    key={recoveryCase.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {recoveryCase.initiativeTitle}
                        </strong>

                        <span>
                          {recoveryCase.recoveryNumber}
                          {" · "}
                          {recoveryCase.commitmentNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        recoveryCase.severity,
                      )}
                    </td>

                    <td>
                      {readable(
                        recoveryCase.status,
                      )}
                    </td>

                    <td>
                      {recoveryCase.recoveryOwnerName}
                    </td>

                    <td>
                      {recoveryCase.baselineRiskScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {recoveryCase.currentRiskScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {recoveryCase.effectivenessPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {recoveryCase.recoveryScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {recoveryCase.currentValueAtRiskPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {recoveryCase.openActionCount}
                      {" open · "}
                      {recoveryCase.overdueActionCount}
                      {" overdue"}
                    </td>

                    <td>
                      {recoveryCase.escalationCount}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="recovery-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable recovery evidence
          </strong>

          <p>
            This review freezes recovery
            risk, effectiveness, current
            value at risk, corrective
            action exposure and escalation
            counts at the review capture
            time.
          </p>
        </div>
      </section>
    </div>
  );
}
