"use client";

import {
  Camera,
  CircleAlert,
  ShieldAlert,
  UsersRound,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureSuccessionSnapshot,
  createCriticalCapabilityPolicy,
  getSuccessionPlanningDashboard,
} from "@/lib/api";

import type {
  SuccessionCriticality,
  SuccessionPlanningDashboard,
} from "@/types/succession-planning";

import {
  type FormEvent,
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

export default function SuccessionPlanningPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      SuccessionPlanningDashboard |
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
    skillId,
    setSkillId,
  ] =
    useState("");

  const [
    criticality,
    setCriticality,
  ] =
    useState<SuccessionCriticality>(
      "CRITICAL",
    );

  const [
    requiredProficiency,
    setRequiredProficiency,
  ] =
    useState(4);

  const [
    targetReadyPeople,
    setTargetReadyPeople,
  ] =
    useState(2);

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
  ] =
    useState(false);

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

  useEffect(() => {
    let active = true;

    getSuccessionPlanningDashboard(
      currency,
      fiscalYear,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          if (
            !skillId
            &&
            response.skills[0]
          ) {
            setSkillId(
              response.skills[0].id,
            );
          }

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load succession planning.",
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
    skillId,
  ]);

  async function reload() {
    setDashboard(
      await getSuccessionPlanningDashboard(
        currency,
        fiscalYear,
      ),
    );
  }

  async function createPolicy(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!skillId) {
      setError(
        "Select a governed capability skill.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createCriticalCapabilityPolicy(
        currency,
        fiscalYear,
        {
          skillId,
          criticality,
          requiredProficiency,
          targetReadyPeople,
          notes:
            notes.trim()
            ||
            undefined,
        },
      );

      setNotes("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create critical capability policy.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function capture() {
    try {
      setRunning(true);
      setError(null);

      await captureSuccessionSnapshot(
        currency,
        fiscalYear,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture succession snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  const summary =
    dashboard?.summary;

  const availableSkills =
    dashboard
      ?.skills
      .filter(
        skill =>
          !dashboard.policies.some(
            policy =>
              policy.skillId ===
                skill.id,
          ),
      )
    ??
    [];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Workforce resilience
          </span>

          <h1>
            Succession planning
          </h1>

          <p>
            Govern critical procurement
            capabilities, expose
            single-person dependencies,
            measure backup depth and
            manage evidence-based
            succession candidates.
          </p>
        </div>

        <div className="succession-heading-actions">
          <label className="succession-filter">
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
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="TND">TND</option>
            </select>
          </label>

          <label className="succession-filter">
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

          {canManage ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void capture()
              }
            >
              <Camera
                size={15}
              />
              Capture snapshot
            </button>
          ) : null}
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

      <section className="succession-score-grid">
        <article className="succession-score-card">
          <span>
            Succession score
          </span>

          <strong>
            {(
              summary
                ?.successionScore ??
                0
            ).toFixed(1)}
          </strong>

          <small>
            {summary
              ? readable(
                  summary.successionHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Policy coverage
          </span>

          <strong>
            {(
              summary
                ?.policyCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Single points of failure
          </span>

          <strong className="succession-risk-text">
            {summary
              ?.singlePointFailureCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Critical exposures
          </span>

          <strong className="succession-risk-text">
            {summary
              ?.criticalExposureCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Ready candidates
          </span>

          <strong>
            {summary
              ?.readyCandidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Avg ready people
          </span>

          <strong>
            {(
              summary
                ?.averageReadyPeople ??
                0
            ).toFixed(1)}
          </strong>
        </article>
      </section>

      <section className="succession-signal-grid">
        <article>
          <span>
            Critical policies
          </span>

          <strong>
            {dashboard
              ?.policies
              .filter(
                policy =>
                  policy.criticality ===
                    "CRITICAL",
              )
              .length ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Covered policies
          </span>

          <strong>
            {summary
              ?.coveredPolicyCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Exposed policies
          </span>

          <strong className="succession-risk-text">
            {summary
              ?.exposedPolicyCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Candidates
          </span>

          <strong>
            {summary
              ?.nominatedCandidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Avg policy score
          </span>

          <strong>
            {(
              summary
                ?.averagePolicyScore ??
                0
            ).toFixed(1)}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Critical capability coverage
            </span>

            <h2>
              Workforce resilience
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
                <th>Capability</th>
                <th>Criticality</th>
                <th>Required</th>
                <th>Target depth</th>
                <th>Ready people</th>
                <th>Ready bench</th>
                <th>Strategic work</th>
                <th>Coverage</th>
                <th>Health</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.policies
                  .map(
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
                              {" · "}
                              {policy.skillCategory}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              `succession-criticality succession-criticality--${policy.criticality.toLowerCase()}`
                            }
                          >
                            {readable(
                              policy.criticality,
                            )}
                          </span>
                        </td>

                        <td>
                          L
                          {policy.requiredProficiency}
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
                          {policy.singlePointFailure
                            ? " · SPOF"
                            : ""}
                        </td>

                        <td>
                          {policy.coveragePct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          <span
                            className={
                              `succession-health succession-health--${policy.health.toLowerCase()}`
                            }
                          >
                            {readable(
                              policy.health,
                            )}
                          </span>
                        </td>

                        <td>
                          <Link
                            href={
                              `/succession-planning/policies/${policy.id}`
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
                  ?.policies
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="table-empty-state"
                  >
                    No critical-capability
                    succession policies
                    exist for this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={createPolicy}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Resilience policy
              </span>

              <h2>
                Define critical capability
              </h2>
            </div>

            <UsersRound
              size={19}
            />
          </div>

          <div className="succession-policy-form">
            <label className="request-field succession-policy-wide">
              <span>
                Capability skill
              </span>

              <select
                value={skillId}
                onChange={
                  event =>
                    setSkillId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select skill
                </option>

                {availableSkills.map(
                  skill => (
                    <option
                      key={skill.id}
                      value={skill.id}
                    >
                      {skill.code}
                      {" — "}
                      {skill.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Criticality
              </span>

              <select
                value={criticality}
                onChange={
                  event =>
                    setCriticality(
                      event.target.value as
                        SuccessionCriticality,
                    )
                }
              >
                <option value="HIGH">
                  High
                </option>

                <option value="CRITICAL">
                  Critical
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Required proficiency
              </span>

              <input
                type="number"
                min="1"
                max="5"
                value={requiredProficiency}
                onChange={
                  event =>
                    setRequiredProficiency(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Target ready people
              </span>

              <input
                type="number"
                min="1"
                max="20"
                value={targetReadyPeople}
                onChange={
                  event =>
                    setTargetReadyPeople(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field succession-policy-wide">
              <span>
                Governance notes
              </span>

              <textarea
                rows={4}
                value={notes}
                onChange={
                  event =>
                    setNotes(
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
                !skillId
              }
            >
              Create critical-capability policy
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Executive history
            </span>

            <h2>
              Immutable succession snapshots
            </h2>
          </div>

          <Camera
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Score</th>
                <th>Health</th>
                <th>SPOF</th>
                <th>Critical exposure</th>
                <th>Ready candidates</th>
                <th>Captured</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.snapshots
                  .map(
                    snapshot => (
                      <tr
                        key={snapshot.id}
                      >
                        <td>
                          <strong>
                            {snapshot.snapshotNumber}
                          </strong>
                        </td>

                        <td>
                          {snapshot.successionScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {readable(
                            snapshot.successionHealth,
                          )}
                        </td>

                        <td>
                          {snapshot.singlePointFailureCount}
                        </td>

                        <td>
                          {snapshot.criticalExposureCount}
                        </td>

                        <td>
                          {snapshot.readyCandidateCount}
                        </td>

                        <td>
                          {new Date(
                            snapshot.capturedAt,
                          )
                            .toLocaleString()}
                        </td>

                        <td>
                          <Link
                            href={
                              `/succession-planning/snapshots/${snapshot.id}`
                            }
                            className="table-action"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}
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
            Succession decisions remain governed
          </strong>

          <p>
            Candidate evidence uses only
            recorded Step 48 proficiency
            and current Step 47 capacity
            utilization. ProcureIQ does
            not infer skills, appoint
            successors, or reassign work.
          </p>
        </div>
      </section>
    </div>
  );
}
