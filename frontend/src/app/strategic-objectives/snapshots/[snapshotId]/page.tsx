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
  getOkrSnapshot,
} from "@/lib/api";

import type {
  KeyResultMetricType,
  OkrSnapshotDetail,
} from "@/types/strategic-okr";

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

function displayValue(
  value: number,
  metricType: KeyResultMetricType,
  currency: string,
): string {
  if (
    metricType ===
      "CURRENCY"
  ) {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 1,
      },
    ).format(
      value,
    );
  }

  if (
    metricType ===
      "PERCENTAGE"
  ) {
    return `${value.toFixed(1)}%`;
  }

  if (
    metricType ===
      "HOURS"
  ) {
    return `${value.toFixed(1)}h`;
  }

  return value.toFixed(
    1,
  );
}

export default function OkrSnapshotPage() {
  const params =
    useParams<{
      snapshotId: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      OkrSnapshotDetail |
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

    getOkrSnapshot(
      params.snapshotId,
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
                : "Unable to load OKR snapshot.",
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
    params.snapshotId,
  ]);

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading OKR snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategic-objectives"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategic objectives
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "OKR snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href={
          `/strategic-objectives/${detail.snapshot.objectiveId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Objective
      </Link>

      <section className="okr-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable executive OKR record
          </span>

          <h1>
            {detail.snapshot.snapshotNumber}
          </h1>

          <p>
            {detail.objectiveNumber}
            {" · "}
            {detail.objectiveTitle}
            {" · "}
            {detail.periodType ===
              "QUARTERLY"
              ? `Q${detail.quarter} ${detail.fiscalYear}`
              : `FY ${detail.fiscalYear}`}
          </p>
        </div>
      </section>

      <section className="okr-scorecard">
        <article>
          <span>
            Progress
          </span>

          <strong>
            {detail.snapshot.overallProgressPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Health
          </span>

          <strong>
            {readable(
              detail.snapshot.overallHealth,
            )}
          </strong>
        </article>

        <article>
          <span>
            Confidence
          </span>

          <strong>
            {detail.snapshot.overallConfidencePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Achieved KRs
          </span>

          <strong>
            {detail.snapshot.achievedKeyResultCount}
            /
            {detail.snapshot.keyResultCount}
          </strong>
        </article>

        <article>
          <span>
            Captured by
          </span>

          <strong>
            {detail.snapshot.capturedByName}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen key-result evidence
            </span>

            <h2>
              Snapshot scorecard
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
                <th>Key result</th>
                <th>Weight</th>
                <th>Baseline</th>
                <th>Actual</th>
                <th>Target</th>
                <th>Progress</th>
                <th>Health</th>
                <th>Confidence</th>
                <th>Contributions</th>
              </tr>
            </thead>

            <tbody>
              {detail.keyResults.map(
                keyResult => (
                  <tr
                    key={keyResult.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {keyResult.title}
                        </strong>

                        <span>
                          {readable(
                            keyResult.sourceType,
                          )}
                        </span>
                      </div>
                    </td>

                    <td>
                      {keyResult.weightPct.toFixed(
                        0,
                      )}
                      %
                    </td>

                    <td>
                      {displayValue(
                        keyResult.baselineValue,
                        keyResult.metricType,
                        detail.currency,
                      )}
                    </td>

                    <td>
                      {displayValue(
                        keyResult.actualValue,
                        keyResult.metricType,
                        detail.currency,
                      )}
                    </td>

                    <td>
                      {displayValue(
                        keyResult.targetValue,
                        keyResult.metricType,
                        detail.currency,
                      )}
                    </td>

                    <td>
                      {keyResult.progressPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      <span
                        className={
                          `okr-health okr-health--${keyResult.health.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          keyResult.health,
                        )}
                      </span>
                    </td>

                    <td>
                      {keyResult.confidencePct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {keyResult.contributionCount}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="okr-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Immutable executive evidence
          </strong>

          <p>
            This snapshot stores the
            objective score and every
            key-result actual, target,
            health and confidence value
            as they existed at capture
            time.
          </p>
        </div>
      </section>
    </div>
  );
}
