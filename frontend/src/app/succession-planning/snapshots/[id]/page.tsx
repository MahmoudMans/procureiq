"use client";

import {
  ArrowLeft,
  CircleAlert,
  UsersRound,
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
  getSuccessionSnapshot,
} from "@/lib/api";

import type {
  SuccessionSnapshotDetail,
} from "@/types/succession-planning";

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

export default function SuccessionSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      SuccessionSnapshotDetail |
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

    getSuccessionSnapshot(
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
                : "Unable to load succession snapshot.",
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
        Loading succession snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/succession-planning"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Succession planning
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Succession snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/succession-planning"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Succession planning
      </Link>

      <section className="succession-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable workforce-resilience record
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

      <section className="succession-score-grid">
        <article className="succession-score-card">
          <span>
            Succession score
          </span>

          <strong>
            {detail.summary.successionScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.summary.successionHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Policy coverage
          </span>

          <strong>
            {detail.summary.policyCoveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            SPOF
          </span>

          <strong>
            {detail.summary.singlePointFailureCount}
          </strong>
        </article>

        <article>
          <span>
            Critical exposure
          </span>

          <strong>
            {detail.summary.criticalExposureCount}
          </strong>
        </article>

        <article>
          <span>
            Candidates
          </span>

          <strong>
            {detail.summary.nominatedCandidateCount}
          </strong>
        </article>

        <article>
          <span>
            Ready candidates
          </span>

          <strong>
            {detail.summary.readyCandidateCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen capability resilience
            </span>

            <h2>
              Critical capabilities
            </h2>
          </div>

          <UsersRound
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Criticality</th>
                <th>Target</th>
                <th>Ready</th>
                <th>Bench</th>
                <th>Strategic work</th>
                <th>SPOF</th>
                <th>Score</th>
                <th>Health</th>
              </tr>
            </thead>

            <tbody>
              {detail.policies.map(
                policy => (
                  <tr
                    key={policy.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {policy.skillName}
                        </strong>

                        <span>
                          {policy.skillCode}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        policy.criticality,
                      )}
                    </td>

                    <td>
                      {policy.targetReadyPeople}
                    </td>

                    <td>
                      {policy.readyPeopleCount}
                    </td>

                    <td>
                      {policy.readyBenchCount}
                    </td>

                    <td>
                      {policy.strategicWorkCount}
                    </td>

                    <td>
                      {policy.singlePointFailure
                        ? "YES"
                        : "NO"}
                    </td>

                    <td>
                      {policy.policyScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {readable(
                        policy.health,
                      )}
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
              Frozen succession pipeline
            </span>

            <h2>
              Candidate evidence
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Status</th>
                <th>Readiness</th>
                <th>Proficiency</th>
                <th>Skill fit</th>
                <th>Utilization</th>
                <th>Evidence score</th>
                <th>Development</th>
              </tr>
            </thead>

            <tbody>
              {detail.candidates.map(
                candidate => (
                  <tr
                    key={candidate.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {candidate.userName}
                        </strong>

                        <span>
                          {readable(
                            candidate.role,
                          )}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        candidate.status,
                      )}
                    </td>

                    <td>
                      {readable(
                        candidate.readiness,
                      )}
                    </td>

                    <td>
                      L
                      {candidate.currentProficiency}
                    </td>

                    <td>
                      {candidate.proficiencyFitPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {candidate.capacityUtilizationPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {candidate.evidenceScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {candidate.openDevelopmentActionCount}
                    </td>
                  </tr>
                ),
              )}

              {detail.candidates.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No succession
                    candidates were
                    captured in this
                    snapshot.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="succession-method-note">
        <UsersRound
          size={18}
        />

        <div>
          <strong>
            Immutable workforce resilience evidence
          </strong>

          <p>
            This snapshot preserves
            critical-capability coverage,
            key-person exposure and
            candidate evidence exactly as
            they existed at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
