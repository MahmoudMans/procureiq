"use client";

import {
  ArrowLeft,
  CircleAlert,
  Gauge,
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
  getCapacitySnapshot,
} from "@/lib/api";

import type {
  CapacitySnapshotDetail,
} from "@/types/capacity-planning";

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

export default function CapacitySnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      CapacitySnapshotDetail |
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

    getCapacitySnapshot(
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
                : "Unable to load capacity snapshot.",
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
        Loading capacity snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capacity-planning"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capacity planning
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capacity snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/capacity-planning"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capacity planning
      </Link>

      <section className="capacity-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable executive capacity record
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
          </p>
        </div>
      </section>

      <section className="capacity-score-grid">
        <article className="capacity-score-card">
          <span>
            Capacity score
          </span>

          <strong>
            {detail.summary.capacityScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.summary.portfolioHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Effective capacity
          </span>

          <strong>
            {detail.summary.effectiveCapacityHours.toFixed(
              0,
            )}
            h
          </strong>
        </article>

        <article>
          <span>
            Demand
          </span>

          <strong>
            {detail.summary.estimatedDemandHours.toFixed(
              0,
            )}
            h
          </strong>
        </article>

        <article>
          <span>
            Gap
          </span>

          <strong>
            {detail.summary.capacityGapHours.toFixed(
              0,
            )}
            h
          </strong>
        </article>

        <article>
          <span>
            Assignment coverage
          </span>

          <strong>
            {detail.summary.assignmentCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Deadline health
          </span>

          <strong>
            {detail.summary.deadlineHealthPct.toFixed(
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
              Frozen team load
            </span>

            <h2>
              Member capacity
            </h2>
          </div>

          <Gauge
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Capacity</th>
                <th>Assigned</th>
                <th>Remaining</th>
                <th>Utilization</th>
                <th>Health</th>
              </tr>
            </thead>

            <tbody>
              {detail.members.map(
                member => (
                  <tr
                    key={member.userId}
                  >
                    <td>
                      <strong>
                        {member.userName}
                      </strong>
                    </td>

                    <td>
                      {member.effectiveCapacityHours.toFixed(
                        0,
                      )}
                      h
                    </td>

                    <td>
                      {member.assignedEffortHours.toFixed(
                        0,
                      )}
                      h
                    </td>

                    <td>
                      {member.remainingCapacityHours.toFixed(
                        0,
                      )}
                      h
                    </td>

                    <td>
                      {member.utilizationPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      <span
                        className={
                          `capacity-health capacity-health--${member.health.toLowerCase()}`
                        }
                      >
                        {readable(
                          member.health,
                        )}
                      </span>
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
              Frozen strategic demand
            </span>

            <h2>
              Work allocation
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Work item</th>
                <th>Type</th>
                <th>Effort</th>
                <th>Allocation</th>
                <th>Unassigned</th>
                <th>Status</th>
                <th>Deadline pressure</th>
              </tr>
            </thead>

            <tbody>
              {detail.workItems.map(
                item => (
                  <tr
                    key={
                      `${item.sourceType}:${item.sourceEntityId}`
                    }
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.sourceTitle}
                        </strong>

                        <span>
                          {item.sourceReference}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item.sourceType,
                      )}
                    </td>

                    <td>
                      {item.estimatedEffortHours.toFixed(
                        0,
                      )}
                      h
                    </td>

                    <td>
                      {item.allocationPct.toFixed(
                        0,
                      )}
                      %
                    </td>

                    <td>
                      {item.unassignedEffortHours.toFixed(
                        0,
                      )}
                      h
                    </td>

                    <td>
                      {readable(
                        item.planningStatus,
                      )}
                    </td>

                    <td>
                      {item.deadlinePressure
                        ? "YES"
                        : "NO"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="capacity-method-note">
        <Gauge
          size={18}
        />

        <div>
          <strong>
            Immutable capacity evidence
          </strong>

          <p>
            This record preserves team
            capacity and strategic demand
            as they existed at capture
            time. Later profile,
            assignment or Step 46 changes
            do not rewrite it.
          </p>
        </div>
      </section>
    </div>
  );
}
