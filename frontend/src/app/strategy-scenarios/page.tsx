"use client";

import {
  CircleAlert,
  Goal,
  Plus,
} from "lucide-react";

import Link from "next/link";

import {
  getStrategyScenarioDashboard,
} from "@/lib/api";

import type {
  StrategyScenarioDashboard,
} from "@/types/strategy-scenario";

import {
  useEffect,
  useState,
} from "react";

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
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

export default function StrategyScenariosPage() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategyScenarioDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      new Date()
        .getUTCFullYear(),
    );

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

    getStrategyScenarioDashboard(
      currency,
      fiscalYear,
    )
      .then(
        response => {
          if (active) {
            setDashboard(
              response,
            );

            setError(null);
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
                : "Unable to load procurement strategy scenarios.",
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
    currency,
    fiscalYear,
  ]);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            What-if planning
          </span>

          <h1>
            Strategy scenarios
          </h1>

          <p>
            Explore explicit changes to
            procurement strategy without
            altering real objectives,
            alignment, resources,
            capabilities or succession
            authorities.
          </p>
        </div>

        <div className="scenario-heading-actions">
          <label className="scenario-filter">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event => {
                  setLoading(true);

                  setCurrency(
                    event.target.value,
                  );
                }
              }
            >
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          <label className="scenario-filter">
            <span>
              Fiscal year
            </span>

            <input
              type="number"
              min="2000"
              max="2200"
              value={fiscalYear}
              onChange={
                event => {
                  setLoading(true);

                  setFiscalYear(
                    Number(
                      event.target.value,
                    ),
                  );
                }
              }
            />
          </label>

          <Link
            href="/strategy-scenarios/new"
            className="button button--primary"
          >
            <Plus
              size={15}
            />
            New scenario
          </Link>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="scenario-baseline-hero">
        <article>
          <span>
            Live Step 50 baseline
          </span>

          <strong>
            {(
              dashboard
                ?.liveBoardBaseline
                .overallScore ??
                0
            ).toFixed(1)}
          </strong>

          <small>
            {dashboard
              ? readable(
                  dashboard
                    .liveBoardBaseline
                    .overallHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Scenario count
          </span>

          <strong>
            {dashboard
              ?.scenarios
              .length ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Approved scenarios
          </span>

          <strong>
            {dashboard
              ?.scenarios
              .filter(
                scenario =>
                  scenario.status ===
                    "APPROVED",
              )
              .length ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Best simulated score
          </span>

          <strong>
            {(
              dashboard
                ?.scenarios
                .filter(
                  scenario =>
                    scenario.latestSimulatedScore !==
                      null,
                )
                .map(
                  scenario =>
                    scenario.latestSimulatedScore ??
                    0,
                )
                .sort(
                  (
                    first,
                    second,
                  ) =>
                    second - first,
                )[0]
              ??
              0
            ).toFixed(1)}
          </strong>
        </article>
      </section>

      <section className="scenario-live-dimensions">
        <article>
          <span>
            Objective execution
          </span>

          <strong>
            {(
              dashboard
                ?.liveBoardBaseline
                .objectiveExecutionScore ??
                0
            ).toFixed(1)}
          </strong>
        </article>

        <article>
          <span>
            Strategic alignment
          </span>

          <strong>
            {(
              dashboard
                ?.liveBoardBaseline
                .strategicAlignmentScore ??
                0
            ).toFixed(1)}
          </strong>
        </article>

        <article>
          <span>
            Capacity
          </span>

          <strong>
            {(
              dashboard
                ?.liveBoardBaseline
                .capacityScore ??
                0
            ).toFixed(1)}
          </strong>
        </article>

        <article>
          <span>
            Capability
          </span>

          <strong>
            {(
              dashboard
                ?.liveBoardBaseline
                .capabilityScore ??
                0
            ).toFixed(1)}
          </strong>
        </article>

        <article>
          <span>
            Succession
          </span>

          <strong>
            {(
              dashboard
                ?.liveBoardBaseline
                .successionScore ??
                0
            ).toFixed(1)}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Scenario comparison
            </span>

            <h2>
              Ranked what-if alternatives
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
                <th>Rank</th>
                <th>Scenario</th>
                <th>Status</th>
                <th>Baseline</th>
                <th>Simulated</th>
                <th>Delta</th>
                <th>Movement</th>
                <th>Assumptions</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.scenarios
                  .map(
                    scenario => (
                      <tr
                        key={scenario.id}
                      >
                        <td>
                          {scenario.rank >
                          0
                            ? `#${scenario.rank}`
                            : "—"}
                        </td>

                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {scenario.name}
                            </strong>

                            <span>
                              {scenario.scenarioNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              `scenario-status scenario-status--${scenario.status.toLowerCase()}`
                            }
                          >
                            {readable(
                              scenario.status,
                            )}
                          </span>
                        </td>

                        <td>
                          {scenario.baselineOverallScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {scenario.latestSimulatedScore ===
                          null
                            ? "—"
                            : scenario.latestSimulatedScore.toFixed(
                                1,
                              )}
                        </td>

                        <td
                          className={
                            (
                              scenario.latestDelta ??
                              0
                            ) <
                            0
                              ? "scenario-negative"
                              : (
                                  scenario.latestDelta ??
                                  0
                                ) >
                                0
                              ? "scenario-positive"
                              : ""
                          }
                        >
                          {signed(
                            scenario.latestDelta,
                          )}
                        </td>

                        <td>
                          {scenario.latestMovement
                            ? readable(
                                scenario.latestMovement,
                              )
                            : "—"}
                        </td>

                        <td>
                          {scenario.assumptionCount}
                        </td>

                        <td>
                          <Link
                            href={
                              `/strategy-scenarios/${scenario.id}`
                            }
                            className="table-action"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.scenarios
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No strategy scenarios
                    exist for this scope.
                  </td>
                </tr>
              ) : null}
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
            Simulations are isolated from production authorities
          </strong>

          <p>
            Each scenario freezes the Step
            50 board baseline at creation.
            Assumptions are explicit
            percentage-point adjustments
            to the five board dimensions.
            Evaluations are immutable and
            never modify objectives,
            assignments, skills,
            succession policies or board
            scorecard authorities.
          </p>
        </div>
      </section>
    </div>
  );
}
