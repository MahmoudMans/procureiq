"use client";

import {
  CircleAlert,
  Goal,
  Plus,
} from "lucide-react";

import Link from "next/link";

import {
  getStrategyRoadmapDashboard,
} from "@/lib/api";

import type {
  StrategyRoadmapDashboard,
} from "@/types/strategy-roadmap";

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
  value: number,
): string {
  return value > 0
    ? `+${value.toFixed(1)}`
    : value.toFixed(1);
}

export default function StrategyRoadmapsPage() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategyRoadmapDashboard |
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

    getStrategyRoadmapDashboard()
      .then(
        response => {
          if (active) {
            setDashboard(
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
                : "Unable to load strategy roadmaps.",
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
  }, []);

  const roadmaps =
    dashboard?.roadmaps
    ??
    [];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Scenario-to-execution planning
          </span>

          <h1>
            Strategy roadmaps
          </h1>

          <p>
            Convert an approved Step 51
            planning scenario into a
            governed initiative roadmap
            with owners, dependencies,
            milestones, gates and
            immutable readiness evidence.
          </p>
        </div>

        <Link
          href="/strategy-roadmaps/new"
          className="button button--primary"
        >
          <Plus
            size={15}
          />
          New roadmap
        </Link>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="roadmap-summary-grid">
        <article>
          <span>
            Roadmaps
          </span>

          <strong>
            {roadmaps.length}
          </strong>
        </article>

        <article>
          <span>
            Active
          </span>

          <strong>
            {roadmaps.filter(
              roadmap =>
                roadmap.status ===
                  "ACTIVE",
            ).length}
          </strong>
        </article>

        <article>
          <span>
            Blocked initiatives
          </span>

          <strong className="roadmap-risk-text">
            {roadmaps.reduce(
              (
                total,
                roadmap,
              ) =>
                total
                +
                roadmap.blockedInitiativeCount,
              0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Overdue milestones
          </span>

          <strong className="roadmap-risk-text">
            {roadmaps.reduce(
              (
                total,
                roadmap,
              ) =>
                total
                +
                roadmap.overdueMilestoneCount,
              0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Rejected gates
          </span>

          <strong className="roadmap-risk-text">
            {roadmaps.reduce(
              (
                total,
                roadmap,
              ) =>
                total
                +
                roadmap.rejectedGateCount,
              0,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Implementation portfolio
            </span>

            <h2>
              Governed roadmaps
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
                <th>Roadmap</th>
                <th>Status</th>
                <th>Scenario</th>
                <th>Scenario delta</th>
                <th>Initiatives</th>
                <th>Blocked</th>
                <th>Readiness</th>
                <th>Health</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                roadmaps.map(
                  roadmap => (
                    <tr
                      key={roadmap.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {roadmap.title}
                          </strong>

                          <span>
                            {roadmap.roadmapNumber}
                            {" · FY "}
                            {roadmap.fiscalYear}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `roadmap-status roadmap-status--${roadmap.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            roadmap.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {roadmap.sourceScenarioNumber}
                      </td>

                      <td
                        className={
                          roadmap.scenarioDelta >
                          0
                            ? "roadmap-positive"
                            : roadmap.scenarioDelta <
                              0
                            ? "roadmap-negative"
                            : ""
                        }
                      >
                        {signed(
                          roadmap.scenarioDelta,
                        )}
                      </td>

                      <td>
                        {roadmap.completedInitiativeCount}
                        {" / "}
                        {roadmap.initiativeCount}
                      </td>

                      <td>
                        <span
                          className={
                            roadmap.blockedInitiativeCount >
                            0
                              ? "roadmap-risk-text"
                              : ""
                          }
                        >
                          {roadmap.blockedInitiativeCount}
                        </span>
                      </td>

                      <td>
                        {roadmap.readinessScore.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `roadmap-health roadmap-health--${roadmap.readinessHealth.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            roadmap.readinessHealth,
                          )}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/strategy-roadmaps/${roadmap.id}`
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
              roadmaps.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No strategy roadmaps
                    have been created.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="roadmap-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Roadmaps remain a governed planning layer
          </strong>

          <p>
            Roadmap initiatives do not
            automatically create sourcing,
            supplier, benefit, capacity,
            OKR or other operational
            records. They coordinate the
            approved scenario&apos;s
            proposed implementation only.
          </p>
        </div>
      </section>
    </div>
  );
}
