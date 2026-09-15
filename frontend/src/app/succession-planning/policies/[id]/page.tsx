"use client";

import {
  ArrowLeft,
  CircleAlert,
  ShieldAlert,
  UserPlus,
  UsersRound,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  declineSuccessionCandidate,
  getSuccessionPlanningDashboard,
  getSuccessionPolicy,
  markSuccessionCandidateReady,
  nominateSuccessionCandidate,
  startSuccessionCandidateDevelopment,
} from "@/lib/api";

import type {
  SuccessionPlanningDashboard,
  SuccessionPolicyDetail,
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

function defaultTargetDate(): string {
  const date =
    new Date();

  date.setUTCMonth(
    date.getUTCMonth()
      + 6,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function SuccessionPolicyPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      SuccessionPolicyDetail |
      null
    >(null);

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      SuccessionPlanningDashboard |
      null
    >(null);

  const [
    candidateUserId,
    setCandidateUserId,
  ] =
    useState("");

  const [
    rationale,
    setRationale,
  ] =
    useState("");

  const [
    targetDate,
    setTargetDate,
  ] =
    useState(
      defaultTargetDate(),
    );

  const [
    decisionNotes,
    setDecisionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    running,
    setRunning,
  ] =
    useState(false);

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

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  const canFinalize =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getSuccessionPolicy(
      params.id,
    )
      .then(
        async policyResponse => {
          const context =
            await getSuccessionPlanningDashboard(
              policyResponse.policy.currency,
              policyResponse.policy.fiscalYear,
            );

          if (!active) {
            return;
          }

          setDetail(
            policyResponse,
          );

          setDashboard(
            context,
          );

          const candidate =
            context.users.find(
              candidateUser =>
                !policyResponse.candidates.some(
                  existing =>
                    existing.userId ===
                      candidateUser.id,
                ),
            );

          if (candidate) {
            setCandidateUserId(
              candidate.id,
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
                : "Unable to load succession policy.",
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

  async function reload() {
    setDetail(
      await getSuccessionPolicy(
        params.id,
      ),
    );
  }

  async function nominate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !candidateUserId
      ||
      !rationale.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await nominateSuccessionCandidate(
        params.id,
        {
          userId:
            candidateUserId,
          rationale:
            rationale.trim(),
          targetDate:
            targetDate
            ||
            undefined,
        },
      );

      setRationale("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to nominate succession candidate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function candidateAction(
    candidateId: string,
    action:
      "DEVELOP"
      |
      "READY"
      |
      "DECLINE",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
          "DEVELOP"
      ) {
        await startSuccessionCandidateDevelopment(
          candidateId,
        );
      } else {
        const note =
          decisionNotes[
            candidateId
          ]
          ??
          "";

        if (!note.trim()) {
          setError(
            "A governed decision note is required.",
          );

          return;
        }

        if (
          action ===
            "READY"
        ) {
          await markSuccessionCandidateReady(
            candidateId,
            note,
          );
        } else {
          await declineSuccessionCandidate(
            candidateId,
            note,
          );
        }
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update succession candidate.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading succession policy...
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
            "Succession policy not found."}
        </div>
      </div>
    );
  }

  const availableCandidates =
    dashboard
      ?.users
      .filter(
        candidate =>
          !detail.candidates.some(
            existing =>
              existing.userId ===
                candidate.id,
          ),
      )
    ??
    [];

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
            Critical capability
          </span>

          <h1>
            {detail.policy.skillName}
          </h1>

          <p>
            {detail.policy.skillCode}
            {" · "}
            {detail.policy.skillCategory}
            {" · Required L"}
            {detail.policy.requiredProficiency}
          </p>
        </div>

        <span
          className={
            `succession-health succession-health--${detail.policy.health.toLowerCase()}`
          }
        >
          {readable(
            detail.policy.health,
          )}
        </span>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="succession-detail-grid">
        <article>
          <span>
            Target depth
          </span>

          <strong>
            {detail.policy.targetReadyPeople}
          </strong>
        </article>

        <article>
          <span>
            Ready people
          </span>

          <strong>
            {detail.policy.readyPeopleCount}
          </strong>
        </article>

        <article>
          <span>
            Ready bench
          </span>

          <strong>
            {detail.policy.readyBenchCount}
          </strong>
        </article>

        <article>
          <span>
            Strategic work
          </span>

          <strong>
            {detail.policy.strategicWorkCount}
          </strong>
        </article>

        <article>
          <span>
            Coverage
          </span>

          <strong>
            {detail.policy.coveragePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            SPOF
          </span>

          <strong className={
            detail.policy.singlePointFailure
              ? "succession-risk-text"
              : ""
          }>
            {detail.policy.singlePointFailure
              ? "YES"
              : "NO"}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Dependency context
            </span>

            <h2>
              Strategic work using this capability
            </h2>
          </div>

          <ShieldAlert
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Work item</th>
                <th>Type</th>
                <th>Assigned members</th>
                <th>Requirements</th>
                <th>Assigned fit</th>
                <th>Readiness</th>
              </tr>
            </thead>

            <tbody>
              {detail.impactedWorkItems.map(
                work => (
                  <tr
                    key={
                      `${work.sourceType}:${work.sourceEntityId}`
                    }
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {work.sourceTitle}
                        </strong>

                        <span>
                          {work.sourceReference}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        work.sourceType,
                      )}
                    </td>

                    <td>
                      {work.assignedMemberCount}
                    </td>

                    <td>
                      {work.requirementCount}
                    </td>

                    <td>
                      {work.assignedFitPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {readable(
                        work.readiness,
                      )}
                    </td>
                  </tr>
                ),
              )}

              {detail.impactedWorkItems.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="table-empty-state"
                  >
                    This critical
                    capability is not yet
                    linked to an active
                    strategic-work
                    requirement.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Succession pipeline
            </span>

            <h2>
              Governed candidates
            </h2>
          </div>

          <UserPlus
            size={19}
          />
        </div>

        <div className="succession-candidate-list">
          {detail.candidates.map(
            candidate => (
              <article
                key={candidate.id}
              >
                <div className="succession-candidate-main">
                  <div>
                    <span
                      className={
                        `succession-candidate-status succession-candidate-status--${candidate.status.toLowerCase()}`
                      }
                    >
                      {readable(
                        candidate.status,
                      )}
                    </span>

                    <strong>
                      {candidate.userName}
                    </strong>

                    <small>
                      {readable(
                        candidate.role,
                      )}
                      {" · "}
                      {readable(
                        candidate.readiness,
                      )}
                    </small>
                  </div>

                  <div className="succession-candidate-score">
                    <span>
                      Evidence score
                    </span>

                    <strong>
                      {candidate.evidenceScore.toFixed(
                        1,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="succession-candidate-metrics">
                  <span>
                    Proficiency
                    <strong>
                      L
                      {candidate.currentProficiency}
                    </strong>
                  </span>

                  <span>
                    Skill fit
                    <strong>
                      {candidate.proficiencyFitPct.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </span>

                  <span>
                    Utilization
                    <strong>
                      {candidate.capacityUtilizationPct.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </span>

                  <span>
                    Development
                    <strong>
                      {candidate.openDevelopmentActionCount}
                    </strong>
                  </span>
                </div>

                <p>
                  {candidate.rationale}
                </p>

                {canManage &&
                candidate.status ===
                  "IDENTIFIED" ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={running}
                    onClick={
                      () =>
                        void candidateAction(
                          candidate.id,
                          "DEVELOP",
                        )
                    }
                  >
                    Start development
                  </button>
                ) : null}

                {canFinalize &&
                (
                  candidate.status ===
                    "IDENTIFIED"
                  ||
                  candidate.status ===
                    "DEVELOPING"
                ) ? (
                  <div className="succession-decision-control">
                    <input
                      placeholder={
                        "Required governed decision note"
                      }
                      value={
                        decisionNotes[
                          candidate.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setDecisionNotes(
                            current => ({
                              ...current,
                              [candidate.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <button
                      type="button"
                      disabled={
                        running
                        ||
                        candidate.readiness !==
                          "READY"
                        ||
                        !(
                          decisionNotes[
                            candidate.id
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void candidateAction(
                            candidate.id,
                            "READY",
                          )
                      }
                    >
                      Mark ready
                    </button>

                    <button
                      type="button"
                      className="succession-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          decisionNotes[
                            candidate.id
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void candidateAction(
                            candidate.id,
                            "DECLINE",
                          )
                      }
                    >
                      Decline
                    </button>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.candidates.length ===
          0 ? (
            <div className="succession-empty">
              No governed succession
              candidates have been
              nominated.
            </div>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={nominate}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Evidence-based nomination
              </span>

              <h2>
                Nominate candidate
              </h2>
            </div>

            <UserPlus
              size={19}
            />
          </div>

          <div className="succession-nomination-form">
            <label className="request-field">
              <span>
                Team member
              </span>

              <select
                value={candidateUserId}
                onChange={
                  event =>
                    setCandidateUserId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select candidate
                </option>

                {availableCandidates.map(
                  candidate => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                    >
                      {candidate.fullName}
                      {" — "}
                      {candidate.role}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Target readiness date
              </span>

              <input
                type="date"
                value={targetDate}
                onChange={
                  event =>
                    setTargetDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field succession-nomination-wide">
              <span>
                Nomination rationale
              </span>

              <textarea
                required
                rows={5}
                value={rationale}
                onChange={
                  event =>
                    setRationale(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="succession-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !candidateUserId
                ||
                !rationale.trim()
              }
            >
              Nominate candidate
            </button>
          </div>
        </form>
      ) : null}

      <section className="succession-method-note">
        <UsersRound
          size={18}
        />

        <div>
          <strong>
            No automatic successor selection
          </strong>

          <p>
            Evidence score combines
            recorded Step 48 proficiency
            with current Step 47 capacity
            headroom only. It is advisory
            and never appoints a person or
            modifies assignments.
          </p>
        </div>
      </section>
    </div>
  );
}
