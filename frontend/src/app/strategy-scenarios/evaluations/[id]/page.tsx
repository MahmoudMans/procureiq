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
  getStrategyScenarioEvaluation,
} from "@/lib/api";

import type {
  StrategyScenarioEvaluationDetail,
} from "@/types/strategy-scenario";

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

export default function StrategyScenarioEvaluationPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      StrategyScenarioEvaluationDetail |
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

    getStrategyScenarioEvaluation(
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
                : "Unable to load strategy scenario evaluation.",
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
        Loading scenario evaluation...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-scenarios"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategy scenarios
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Strategy scenario evaluation not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href={
          `/strategy-scenarios/${detail.evaluation.scenarioId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Scenario
      </Link>

      <section className="scenario-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable what-if evaluation
          </span>

          <h1>
            {detail.evaluation.evaluationNumber}
          </h1>

          <p>
            Evaluated by
            {" "}
            {detail.evaluation.evaluatedByName}
            {" · "}
            {new Date(
              detail.evaluation.evaluatedAt,
            )
              .toLocaleString()}
          </p>
        </div>

        <Goal
          size={24}
        />
      </section>

      <section className="scenario-comparison-hero">
        <article>
          <span>
            Baseline
          </span>

          <strong>
            {detail.evaluation.baselineOverallScore.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Simulated
          </span>

          <strong>
            {detail.evaluation.simulatedOverallScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.evaluation.simulatedHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Delta
          </span>

          <strong
            className={
              detail.evaluation.scoreDelta >
              0
                ? "scenario-positive"
                : detail.evaluation.scoreDelta <
                  0
                ? "scenario-negative"
                : ""
            }
          >
            {signed(
              detail.evaluation.scoreDelta,
            )}
          </strong>

          <small>
            {readable(
              detail.evaluation.movement,
            )}
          </small>
        </article>

        <article>
          <span>
            Improved dimensions
          </span>

          <strong>
            {detail.evaluation.improvedDimensionCount}
          </strong>
        </article>

        <article>
          <span>
            Deteriorated dimensions
          </span>

          <strong>
            {detail.evaluation.deterioratedDimensionCount}
          </strong>
        </article>
      </section>

      <section className="panel scenario-description">
        <p>
          {detail.generatedSummary}
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen simulation
            </span>

            <h2>
              Dimension trade-offs
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Weight</th>
                <th>Baseline</th>
                <th>Adjustment</th>
                <th>Simulated</th>
                <th>Contribution</th>
                <th>Health</th>
              </tr>
            </thead>

            <tbody>
              {detail.dimensions.map(
                dimension => (
                  <tr
                    key={dimension.dimensionKey}
                  >
                    <td>
                      <strong>
                        {dimension.dimensionLabel}
                      </strong>
                    </td>

                    <td>
                      {dimension.weightPct.toFixed(
                        0,
                      )}
                      %
                    </td>

                    <td>
                      {dimension.baselineScore.toFixed(
                        1,
                      )}
                    </td>

                    <td
                      className={
                        dimension.adjustmentPoints >
                        0
                          ? "scenario-positive"
                          : dimension.adjustmentPoints <
                            0
                          ? "scenario-negative"
                          : ""
                      }
                    >
                      {signed(
                        dimension.adjustmentPoints,
                      )}
                    </td>

                    <td>
                      {dimension.simulatedScore.toFixed(
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
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="scenario-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Frozen what-if evidence
          </strong>

          <p>
            This evaluation is immutable.
            Future scenario edits create a
            new evaluation instead of
            rewriting this result.
          </p>
        </div>
      </section>
    </div>
  );
}
