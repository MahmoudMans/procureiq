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
  getStrategyCockpitSnapshot,
} from "@/lib/api";

import type {
  BoardSnapshotDetail,
} from "@/types/strategy-cockpit";

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

function signed(
  value: number,
): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

export default function StrategyCockpitSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      BoardSnapshotDetail |
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

    getStrategyCockpitSnapshot(
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
                : "Unable to load procurement board pack.",
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
        Loading procurement board pack...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-cockpit"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategy cockpit
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Procurement board pack not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategy-cockpit"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategy cockpit
      </Link>

      <section className="strategy-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable procurement board pack
          </span>

          <h1>
            {detail.snapshot.snapshotNumber}
          </h1>

          <p>
            FY
            {" "}
            {detail.snapshot.fiscalYear}
            {" · "}
            {detail.snapshot.currency}
            {" · Captured by "}
            {detail.snapshot.capturedByName}
            {" · "}
            {new Date(
              detail.snapshot.capturedAt,
            )
              .toLocaleString()}
          </p>
        </div>

        <span
          className={
            `strategy-health strategy-health--${detail.snapshot.overallHealth.toLowerCase()}`
          }
        >
          {readable(
            detail.snapshot.overallHealth,
          )}
        </span>
      </section>

      <section className="strategy-board-hero">
        <div className="strategy-board-score">
          <span>
            Board score
          </span>

          <strong>
            {detail.summary.overallScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.summary.overallHealth,
            )}
          </small>
        </div>

        <div className="strategy-board-movement">
          <span>
            Movement
          </span>

          <strong>
            {readable(
              detail.summary.movement,
            )}
          </strong>

          <small>
            {signed(
              detail.summary.scoreDelta,
            )}
            {" pts"}
          </small>
        </div>

        <div className="strategy-board-exception">
          <span>
            Exceptions
          </span>

          <strong>
            {detail.summary.exceptionCount}
          </strong>

          <small>
            {detail.summary.criticalExceptionCount}
            {" critical"}
          </small>
        </div>
      </section>

      <section className="panel strategy-executive-summary">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen executive narrative
            </span>

            <h2>
              Board summary
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p>
          {detail.summary.generatedSummary}
        </p>
      </section>

      {detail.snapshot.boardCommentary ? (
        <section className="panel strategy-board-commentary">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governed commentary
              </span>

              <h2>
                Board note
              </h2>
            </div>
          </div>

          <p>
            {detail.snapshot.boardCommentary}
          </p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen strategic dimensions
            </span>

            <h2>
              Scorecard composition
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Weight</th>
                <th>Score</th>
                <th>Contribution</th>
                <th>Health</th>
                <th>Previous</th>
                <th>Delta</th>
                <th>Evidence</th>
              </tr>
            </thead>

            <tbody>
              {detail.dimensions.map(
                dimension => (
                  <tr
                    key={dimension.key}
                  >
                    <td>
                      <strong>
                        {dimension.label}
                      </strong>
                    </td>

                    <td>
                      {dimension.weightPct.toFixed(
                        0,
                      )}
                      %
                    </td>

                    <td>
                      {dimension.score.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {dimension.weightedContribution.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {readable(
                        dimension.health,
                      )}
                    </td>

                    <td>
                      {dimension.previousScore ===
                      null
                        ? "—"
                        : dimension.previousScore.toFixed(
                            1,
                          )}
                    </td>

                    <td>
                      {signed(
                        dimension.scoreDelta,
                      )}
                    </td>

                    <td>
                      {dimension.sourceDetail}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen strategic exceptions
            </span>

            <h2>
              Board attention items
            </h2>
          </div>

          <CircleAlert
            size={19}
          />
        </div>

        <div className="strategy-exception-list">
          {detail.exceptions.map(
            exception => (
              <article
                key={exception.stableKey}
              >
                <div className="strategy-exception-heading">
                  <span
                    className={
                      `strategy-exception-severity strategy-exception-severity--${exception.severity.toLowerCase()}`
                    }
                  >
                    {readable(
                      exception.severity,
                    )}
                  </span>

                  <strong>
                    {exception.title}
                  </strong>
                </div>

                <p>
                  {exception.detail}
                </p>

                <div className="strategy-exception-footer">
                  <span>
                    Count:
                    {" "}
                    {exception.occurrenceCount}
                  </span>

                  <span>
                    {readable(
                      exception.type,
                    )}
                  </span>
                </div>
              </article>
            ),
          )}

          {detail.exceptions.length ===
          0 ? (
            <div className="strategy-empty">
              No strategic exceptions were
              captured in this board pack.
            </div>
          ) : null}
        </div>
      </section>

      <section className="strategy-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Immutable executive evidence
          </strong>

          <p>
            This pack freezes dimension
            scores, strategic exceptions,
            deterministic narrative,
            governed commentary and
            period movement at capture
            time. Later changes to source
            authorities do not rewrite
            this record.
          </p>
        </div>
      </section>
    </div>
  );
}
