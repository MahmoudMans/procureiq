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
  getOutcomePersistenceReview,
} from "@/lib/api";

import type {
  PersistenceReviewDetail,
} from "@/types/outcome-persistence";

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

export default function OutcomePersistenceReviewPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      PersistenceReviewDetail |
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

    getOutcomePersistenceReview(
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
                : "Unable to load persistence review.",
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
        Loading persistence review...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/outcome-persistence"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Outcome persistence
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Persistence review not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/outcome-persistence"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Outcome persistence
      </Link>

      <section className="persistence-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable persistence review
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

      <section className="persistence-score-grid">
        <article className="persistence-score-card">
          <span>
            Portfolio persistence
          </span>

          <strong>
            {detail.review.averagePersistencePct.toFixed(
              1,
            )}
            %
          </strong>

          <small>
            {readable(
              detail.review.portfolioHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Assessed baseline
          </span>

          <strong>
            {detail.review.assessedBaselinePoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current validated
          </span>

          <strong>
            {detail.review.currentValidatedPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Total decay
          </span>

          <strong>
            {detail.review.totalDecayPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Decayed plans
          </span>

          <strong>
            {detail.review.decayedPlanCount}
          </strong>
        </article>

        <article>
          <span>
            Overdue controls
          </span>

          <strong>
            {detail.review.overdueControlCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen value-persistence portfolio
            </span>

            <h2>
              Post-implementation state at review time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Baseline</th>
                <th>Current</th>
                <th>Persistence</th>
                <th>Health</th>
                <th>Decay</th>
                <th>Observation due</th>
                <th>Controls</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.planId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.planNumber}
                          {" · "}
                          {item.commitmentNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item.planStatus,
                      )}
                    </td>

                    <td>
                      {item.persistenceOwnerName}
                    </td>

                    <td>
                      {item.baselineValidatedPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {item.currentValidatedPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {item.persistencePct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {readable(
                        item.persistenceHealth,
                      )}
                    </td>

                    <td>
                      {item.decayPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {item.observationDue
                        ? "YES"
                        : "NO"}
                    </td>

                    <td>
                      {item.openControlCount}
                      {" open · "}
                      {item.overdueControlCount}
                      {" overdue"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="persistence-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable post-implementation evidence
          </strong>

          <p>
            This review freezes assessed
            baselines, current validated
            persistence, benefit decay,
            control exposure and
            verification readiness at
            capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
