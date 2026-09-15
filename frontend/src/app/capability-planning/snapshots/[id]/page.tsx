"use client";

import {
  ArrowLeft,
  BrainCircuit,
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
  getCapabilitySnapshot,
} from "@/lib/api";

import type {
  CapabilitySnapshotDetail,
} from "@/types/capability-planning";

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

export default function CapabilitySnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      CapabilitySnapshotDetail |
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

    getCapabilitySnapshot(
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
                : "Unable to load capability snapshot.",
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
        Loading capability snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capability-planning"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capability planning
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capability snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/capability-planning"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capability planning
      </Link>

      <section className="capability-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable executive capability record
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

      <section className="capability-score-grid">
        <article className="capability-score-card">
          <span>
            Capability score
          </span>

          <strong>
            {detail.summary.capabilityScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.summary.capabilityHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Requirement coverage
          </span>

          <strong>
            {detail.summary.requirementCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Assigned fit
          </span>

          <strong>
            {detail.summary.averageAssignedFitPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Bench fit
          </span>

          <strong>
            {detail.summary.averageBenchFitPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Critical gaps
          </span>

          <strong>
            {detail.summary.criticalGapCount}
          </strong>
        </article>

        <article>
          <span>
            Open development
          </span>

          <strong>
            {detail.summary.openDevelopmentActionCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen workforce evidence
            </span>

            <h2>
              Member capability
            </h2>
          </div>

          <BrainCircuit
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Assessed skills</th>
                <th>Avg proficiency</th>
                <th>Assigned work</th>
                <th>Capability gaps</th>
                <th>Open development</th>
              </tr>
            </thead>

            <tbody>
              {detail.members.map(
                member => (
                  <tr
                    key={member.userId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {member.userName}
                        </strong>

                        <span>
                          {readable(
                            member.role,
                          )}
                        </span>
                      </div>
                    </td>

                    <td>
                      {member.assessedSkillCount}
                    </td>

                    <td>
                      {member.averageProficiency.toFixed(
                        2,
                      )}
                    </td>

                    <td>
                      {member.assignedWorkItemCount}
                    </td>

                    <td>
                      {member.capabilityGapCount}
                    </td>

                    <td>
                      {member.openDevelopmentActionCount}
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
              Frozen strategic suitability
            </span>

            <h2>
              Work readiness
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Work item</th>
                <th>Assigned</th>
                <th>Requirements</th>
                <th>Critical gaps</th>
                <th>Assigned fit</th>
                <th>Bench fit</th>
                <th>Bench depth</th>
                <th>Readiness</th>
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
                      {item.assignedMemberCount}
                    </td>

                    <td>
                      {item.requirementCount}
                    </td>

                    <td>
                      {item.criticalGapCount}
                    </td>

                    <td>
                      {item.assignedFitPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.benchFitPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.benchReadyMemberCount}
                    </td>

                    <td>
                      <span
                        className={
                          `capability-readiness capability-readiness--${item.readiness.toLowerCase()}`
                        }
                      >
                        {readable(
                          item.readiness,
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

      <section className="capability-method-note">
        <BrainCircuit
          size={18}
        />

        <div>
          <strong>
            Immutable capability evidence
          </strong>

          <p>
            This snapshot freezes
            strategic-work readiness and
            workforce gap metrics at
            capture time. Later
            assessments, assignments,
            requirements and development
            actions do not rewrite it.
          </p>
        </div>
      </section>
    </div>
  );
}
