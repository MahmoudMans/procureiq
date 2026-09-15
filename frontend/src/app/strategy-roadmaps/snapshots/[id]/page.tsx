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
  getStrategyRoadmapSnapshot,
} from "@/lib/api";

import type {
  StrategyRoadmapSnapshotDetail,
} from "@/types/strategy-roadmap";

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

export default function StrategyRoadmapSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      StrategyRoadmapSnapshotDetail |
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

    getStrategyRoadmapSnapshot(
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
                : "Unable to load roadmap snapshot.",
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
        Loading roadmap snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-roadmaps"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategy roadmaps
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Roadmap snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href={
          `/strategy-roadmaps/${detail.snapshot.roadmapId}`
        }
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Roadmap
      </Link>

      <section className="roadmap-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable roadmap evidence
          </span>

          <h1>
            {detail.snapshot.snapshotNumber}
          </h1>

          <p>
            {detail.snapshot.roadmapNumber}
            {" · "}
            {detail.snapshot.roadmapTitle}
            {" · Captured by "}
            {detail.snapshot.capturedByName}
          </p>
        </div>

        <Goal
          size={24}
        />
      </section>

      <section className="roadmap-score-grid">
        <article className="roadmap-score-card">
          <span>
            Readiness
          </span>

          <strong>
            {detail.roadmap.readinessScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.roadmap.readinessHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Owner coverage
          </span>

          <strong>
            {detail.roadmap.ownerCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Dependency health
          </span>

          <strong>
            {detail.roadmap.dependencyHealthPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Milestone health
          </span>

          <strong>
            {detail.roadmap.milestoneHealthPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Gate health
          </span>

          <strong>
            {detail.roadmap.gateHealthPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Blocked initiatives
          </span>

          <strong>
            {detail.roadmap.blockedInitiativeCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen initiative portfolio
            </span>

            <h2>
              Roadmap execution state
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Dimension</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Contribution</th>
                <th>Dependency blockers</th>
                <th>Overdue milestones</th>
                <th>Rejected gates</th>
              </tr>
            </thead>

            <tbody>
              {detail.initiatives.map(
                initiative => (
                  <tr
                    key={initiative.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {initiative.title}
                        </strong>

                        <span>
                          {initiative.initiativeNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        initiative.dimensionKey,
                      )}
                    </td>

                    <td>
                      {readable(
                        initiative.priority,
                      )}
                    </td>

                    <td>
                      {initiative.ownerName}
                    </td>

                    <td>
                      {readable(
                        initiative.status,
                      )}
                    </td>

                    <td>
                      {initiative.plannedContributionPoints.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {initiative.blockedDependencyCount}
                    </td>

                    <td>
                      {initiative.overdueMilestoneCount}
                    </td>

                    <td>
                      {initiative.rejectedGateCount}
                    </td>
                  </tr>
                ),
              )}
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
            Immutable roadmap evidence
          </strong>

          <p>
            This snapshot freezes roadmap
            readiness, initiative status,
            blockers, schedule pressure
            and gate exposure at capture
            time. Later roadmap changes do
            not rewrite this record.
          </p>
        </div>
      </section>
    </div>
  );
}
