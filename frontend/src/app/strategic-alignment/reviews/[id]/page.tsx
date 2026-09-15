"use client";

import {
  ArrowLeft,
  CircleAlert,
  Goal,
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
  getStrategicAlignmentReview,
} from "@/lib/api";

import type {
  AlignmentReviewDetail,
} from "@/types/strategic-alignment";

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
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function AlignmentReviewPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      AlignmentReviewDetail |
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

    getStrategicAlignmentReview(
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
                : "Unable to load strategic alignment review.",
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
        Loading strategic alignment review...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategic-alignment"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategic alignment
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Strategic alignment review not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategic-alignment"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategic alignment
      </Link>

      <section className="alignment-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable executive review
          </span>

          <h1>
            {detail.review.reviewNumber}
          </h1>

          <p>
            FY
            {" "}
            {detail.review.fiscalYear}
            {" · "}
            {detail.review.currency}
            {" · Captured by "}
            {detail.review.capturedByName}
          </p>
        </div>
      </section>

      <section className="alignment-score-grid">
        <article className="alignment-score-card">
          <span>
            Alignment score
          </span>

          <strong>
            {detail.summary.alignmentScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.summary.alignmentHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Source coverage
          </span>

          <strong>
            {detail.summary.sourceCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Objective coverage
          </span>

          <strong>
            {detail.summary.objectiveCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Value coverage
          </span>

          <strong>
            {detail.summary.valueCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Risk coverage
          </span>

          <strong>
            {detail.summary.riskCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Schedule alignment
          </span>

          <strong>
            {detail.summary.scheduleAlignmentPct.toFixed(
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
              Frozen execution evidence
            </span>

            <h2>
              Portfolio alignment
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Work item</th>
                <th>Type</th>
                <th>Allocation</th>
                <th>Objectives</th>
                <th>Value</th>
                <th>Risk</th>
                <th>Risk score</th>
                <th>Conflicts</th>
              </tr>
            </thead>

            <tbody>
              {detail.sources.map(
                source => (
                  <tr
                    key={
                      `${source.sourceType}:${source.sourceEntityId}`
                    }
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {source.sourceTitle}
                        </strong>

                        <span>
                          {source.sourceReference}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        source.sourceType,
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          `alignment-status alignment-status--${source.alignmentStatus.toLowerCase()}`
                        }
                      >
                        {source.directAllocationPct.toFixed(
                          0,
                        )}
                        %
                      </span>
                    </td>

                    <td>
                      {source.linkedObjectiveCount}
                    </td>

                    <td>
                      {money(
                        source.strategicValue,
                        detail.review.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        source.riskExposure,
                        detail.review.currency,
                      )}
                    </td>

                    <td>
                      {source.riskScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {source.deadlineConflictCount}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="alignment-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Immutable strategic evidence
          </strong>

          <p>
            This review preserves the
            alignment state as it existed
            when captured, even if source
            initiatives, objectives or
            future mappings later change.
          </p>
        </div>
      </section>
    </div>
  );
}
