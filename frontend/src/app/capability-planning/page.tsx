"use client";

import {
  BrainCircuit,
  Camera,
  CircleAlert,
  Plus,
  Target,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  assessUserCapability,
  cancelCapabilityDevelopmentAction,
  captureCapabilitySnapshot,
  completeCapabilityDevelopmentAction,
  createCapabilityDevelopmentAction,
  createCapabilitySkill,
  getCapabilityPlanningDashboard,
  startCapabilityDevelopmentAction,
} from "@/lib/api";

import type {
  CapabilityActionType,
  CapabilityPlanningDashboard,
} from "@/types/capability-planning";

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

function defaultDueDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate()
      + 60,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function CapabilityPlanningPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapabilityPlanningDashboard |
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
    skillCode,
    setSkillCode,
  ] =
    useState("");

  const [
    skillName,
    setSkillName,
  ] =
    useState("");

  const [
    skillCategory,
    setSkillCategory,
  ] =
    useState("");

  const [
    skillDescription,
    setSkillDescription,
  ] =
    useState("");

  const [
    assessmentUserId,
    setAssessmentUserId,
  ] =
    useState("");

  const [
    assessmentSkillId,
    setAssessmentSkillId,
  ] =
    useState("");

  const [
    proficiency,
    setProficiency,
  ] =
    useState(3);

  const [
    evidence,
    setEvidence,
  ] =
    useState("");

  const [
    actionUserId,
    setActionUserId,
  ] =
    useState("");

  const [
    actionSkillId,
    setActionSkillId,
  ] =
    useState("");

  const [
    actionType,
    setActionType,
  ] =
    useState<CapabilityActionType>(
      "TRAINING",
    );

  const [
    actionTitle,
    setActionTitle,
  ] =
    useState("");

  const [
    actionDescription,
    setActionDescription,
  ] =
    useState("");

  const [
    targetProficiency,
    setTargetProficiency,
  ] =
    useState(4);

  const [
    actionDueDate,
    setActionDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    actionNotes,
    setActionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

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

    getCapabilityPlanningDashboard(
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
            !assessmentUserId
            &&
            response.users[0]
          ) {
            setAssessmentUserId(
              response.users[0].id,
            );

            setActionUserId(
              response.users[0].id,
            );
          }

          if (
            !assessmentSkillId
            &&
            response.skills[0]
          ) {
            setAssessmentSkillId(
              response.skills[0].id,
            );

            setActionSkillId(
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
                : "Unable to load capability planning.",
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
    assessmentUserId,
    assessmentSkillId,
  ]);

  async function reload() {
    setDashboard(
      await getCapabilityPlanningDashboard(
        currency,
        fiscalYear,
      ),
    );
  }

  async function addSkill(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const skill =
        await createCapabilitySkill({
          code:
            skillCode.trim(),
          name:
            skillName.trim(),
          category:
            skillCategory.trim(),
          description:
            skillDescription.trim()
            ||
            undefined,
        });

      setSkillCode("");
      setSkillName("");
      setSkillCategory("");
      setSkillDescription("");

      setAssessmentSkillId(
        skill.id,
      );

      setActionSkillId(
        skill.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create capability skill.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function assess(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !assessmentUserId
      ||
      !assessmentSkillId
      ||
      !evidence.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await assessUserCapability(
        assessmentUserId,
        assessmentSkillId,
        {
          proficiencyLevel:
            proficiency,
          evidenceNote:
            evidence.trim(),
        },
      );

      setEvidence("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save capability assessment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addDevelopmentAction(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !actionUserId
      ||
      !actionSkillId
      ||
      !actionTitle.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createCapabilityDevelopmentAction(
        fiscalYear,
        {
          userId:
            actionUserId,
          skillId:
            actionSkillId,
          actionType,
          title:
            actionTitle.trim(),
          description:
            actionDescription.trim()
            ||
            undefined,
          targetProficiency,
          dueDate:
            actionDueDate,
        },
      );

      setActionTitle("");
      setActionDescription("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create development action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function progressAction(
    actionId: string,
    action:
      "START"
      |
      "COMPLETE"
      |
      "CANCEL",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
          "START"
      ) {
        await startCapabilityDevelopmentAction(
          actionId,
        );
      } else {
        const note =
          actionNotes[
            actionId
          ]
          ??
          "";

        if (!note.trim()) {
          setError(
            "Completion or cancellation evidence is required.",
          );

          return;
        }

        if (
          action ===
            "COMPLETE"
        ) {
          await completeCapabilityDevelopmentAction(
            actionId,
            note,
          );
        } else {
          await cancelCapabilityDevelopmentAction(
            actionId,
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
          : "Unable to update development action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function capture() {
    try {
      setRunning(true);
      setError(null);

      await captureCapabilitySnapshot(
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
          : "Unable to capture capability snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  const summary =
    dashboard?.summary;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategic workforce capability
          </span>

          <h1>
            Capability planning
          </h1>

          <p>
            Add suitability evidence to
            Step 47 capacity planning with
            governed skills, proficiency
            assessments, work
            requirements, bench depth and
            development actions.
          </p>
        </div>

        <div className="capability-heading-actions">
          <label className="capability-filter">
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

          <label className="capability-filter">
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

      <section className="capability-score-grid">
        <article className="capability-score-card">
          <span>
            Capability score
          </span>

          <strong>
            {(
              summary
                ?.capabilityScore ??
                0
            ).toFixed(1)}
          </strong>

          <small>
            {summary
              ? readable(
                  summary.capabilityHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Requirement coverage
          </span>

          <strong>
            {(
              summary
                ?.requirementCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Assigned-team fit
          </span>

          <strong>
            {(
              summary
                ?.averageAssignedFitPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Bench fit
          </span>

          <strong>
            {(
              summary
                ?.averageBenchFitPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Critical gaps
          </span>

          <strong className="capability-risk-text">
            {summary
              ?.criticalGapCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Development actions
          </span>

          <strong>
            {summary
              ?.openDevelopmentActionCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="capability-signal-grid">
        <article>
          <span>
            Ready work
          </span>

          <strong>
            {summary
              ?.readyWorkCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Watch
          </span>

          <strong>
            {summary
              ?.watchWorkCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Gap
          </span>

          <strong className="capability-risk-text">
            {summary
              ?.gapWorkCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Critical work
          </span>

          <strong className="capability-risk-text">
            {summary
              ?.criticalWorkCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Assessed members
          </span>

          <strong>
            {summary
              ?.assessedMemberCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capability exposure
            </span>

            <h2>
              Strategic work readiness
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
                <th>Work item</th>
                <th>Type</th>
                <th>Assigned</th>
                <th>Requirements</th>
                <th>Assigned fit</th>
                <th>Bench fit</th>
                <th>Bench depth</th>
                <th>Readiness</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.workItems
                  .map(
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
                          {item.assignedMemberCount}
                        </td>

                        <td>
                          {item.requirementCount}
                          {item.criticalGapCount >
                          0
                            ? ` · ${item.criticalGapCount} critical gap(s)`
                            : ""}
                        </td>

                        <td>
                          {item.requirementCount >
                          0
                            ? `${item.assignedFitPct.toFixed(1)}%`
                            : "—"}
                        </td>

                        <td>
                          {item.requirementCount >
                          0
                            ? `${item.benchFitPct.toFixed(1)}%`
                            : "—"}
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

                        <td>
                          <Link
                            href={
                              `/capability-planning/work/${item.sourceType}/${item.sourceEntityId}?currency=${currency}&fiscalYear=${fiscalYear}`
                            }
                            className="table-action"
                          >
                            Requirements
                          </Link>
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
              Workforce capability
            </span>

            <h2>
              Team skills coverage
            </h2>
          </div>
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
              {!loading &&
                dashboard
                  ?.members
                  .map(
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
                          {member.assessedSkillCount >
                          0
                            ? `${member.averageProficiency.toFixed(2)}/5`
                            : "—"}
                        </td>

                        <td>
                          {member.assignedWorkItemCount}
                        </td>

                        <td>
                          <span
                            className={
                              member.capabilityGapCount >
                              0
                                ? "capability-risk-text"
                                : ""
                            }
                          >
                            {member.capabilityGapCount}
                          </span>
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

      {canManage ? (
        <section className="capability-form-grid">
          <form
            className="panel"
            onSubmit={addSkill}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Capability taxonomy
                </span>

                <h2>
                  Add skill
                </h2>
              </div>

              <Plus
                size={19}
              />
            </div>

            <div className="capability-form-fields">
              <label className="request-field">
                <span>
                  Code
                </span>

                <input
                  required
                  value={skillCode}
                  onChange={
                    event =>
                      setSkillCode(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Skill name
                </span>

                <input
                  required
                  value={skillName}
                  onChange={
                    event =>
                      setSkillName(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Category
                </span>

                <input
                  required
                  value={skillCategory}
                  onChange={
                    event =>
                      setSkillCategory(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Description
                </span>

                <textarea
                  rows={4}
                  value={skillDescription}
                  onChange={
                    event =>
                      setSkillDescription(
                        event.target.value,
                      )
                  }
                />
              </label>

              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !skillCode.trim()
                  ||
                  !skillName.trim()
                  ||
                  !skillCategory.trim()
                }
              >
                Add skill
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={assess}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Evidence-backed assessment
                </span>

                <h2>
                  Assess proficiency
                </h2>
              </div>

              <Target
                size={19}
              />
            </div>

            <div className="capability-form-fields">
              <label className="request-field">
                <span>
                  Team member
                </span>

                <select
                  value={assessmentUserId}
                  onChange={
                    event =>
                      setAssessmentUserId(
                        event.target.value,
                      )
                  }
                >
                  {dashboard
                    ?.users
                    .map(
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
                  Skill
                </span>

                <select
                  value={assessmentSkillId}
                  onChange={
                    event =>
                      setAssessmentSkillId(
                        event.target.value,
                      )
                  }
                >
                  {dashboard
                    ?.skills
                    .map(
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
                  Proficiency 1–5
                </span>

                <input
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  value={proficiency}
                  onChange={
                    event =>
                      setProficiency(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Assessment evidence
                </span>

                <textarea
                  required
                  rows={4}
                  value={evidence}
                  onChange={
                    event =>
                      setEvidence(
                        event.target.value,
                      )
                  }
                />
              </label>

              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !assessmentUserId
                  ||
                  !assessmentSkillId
                  ||
                  !evidence.trim()
                }
              >
                Save assessment
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <form
          className="panel"
          onSubmit={addDevelopmentAction}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Capability development
              </span>

              <h2>
                Add development action
              </h2>
            </div>
          </div>

          <div className="capability-development-form">
            <label className="request-field">
              <span>
                Team member
              </span>

              <select
                value={actionUserId}
                onChange={
                  event =>
                    setActionUserId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.users
                  .map(
                    candidate => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.fullName}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Skill
              </span>

              <select
                value={actionSkillId}
                onChange={
                  event =>
                    setActionSkillId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.skills
                  .map(
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
                Action type
              </span>

              <select
                value={actionType}
                onChange={
                  event =>
                    setActionType(
                      event.target.value as
                        CapabilityActionType,
                    )
                }
              >
                <option value="TRAINING">
                  Training
                </option>

                <option value="COACHING">
                  Coaching
                </option>

                <option value="SHADOWING">
                  Shadowing
                </option>

                <option value="SELF_STUDY">
                  Self study
                </option>

                <option value="CERTIFICATION">
                  Certification
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Target level
              </span>

              <input
                type="number"
                min="1"
                max="5"
                value={targetProficiency}
                onChange={
                  event =>
                    setTargetProficiency(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Due date
              </span>

              <input
                type="date"
                value={actionDueDate}
                onChange={
                  event =>
                    setActionDueDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field capability-development-wide">
              <span>
                Action title
              </span>

              <input
                required
                value={actionTitle}
                onChange={
                  event =>
                    setActionTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field capability-development-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                value={actionDescription}
                onChange={
                  event =>
                    setActionDescription(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="capability-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !actionUserId
                ||
                !actionSkillId
                ||
                !actionTitle.trim()
              }
            >
              Add development action
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Development governance
            </span>

            <h2>
              Skills development actions
            </h2>
          </div>
        </div>

        <div className="capability-action-list">
          {dashboard
            ?.developmentActions
            .map(
              action => (
                <article
                  key={action.id}
                  className={
                    action.overdue
                      ? "capability-action capability-action--overdue"
                      : "capability-action"
                  }
                >
                  <div>
                    <span
                      className={
                        `capability-action-status capability-action-status--${action.status.toLowerCase().replaceAll("_", "-")}`
                      }
                    >
                      {readable(
                        action.status,
                      )}
                    </span>

                    <strong>
                      {action.title}
                    </strong>

                    <small>
                      {action.userName}
                      {" · "}
                      {action.skillCode}
                      {" · Target L"}
                      {action.targetProficiency}
                      {" · Due "}
                      {action.dueDate}
                    </small>
                  </div>

                  {action.description ? (
                    <p>
                      {action.description}
                    </p>
                  ) : null}

                  {canManage &&
                  (
                    action.status ===
                      "PLANNED"
                    ||
                    action.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="capability-action-controls">
                      {action.status ===
                      "PLANNED" ? (
                        <button
                          type="button"
                          disabled={running}
                          onClick={
                            () =>
                              void progressAction(
                                action.id,
                                "START",
                              )
                          }
                        >
                          Start
                        </button>
                      ) : null}

                      <input
                        placeholder={
                          "Completion / cancellation evidence"
                        }
                        value={
                          actionNotes[
                            action.id
                          ]
                          ??
                          ""
                        }
                        onChange={
                          event =>
                            setActionNotes(
                              current => ({
                                ...current,
                                [action.id]:
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
                          !(
                            actionNotes[
                              action.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void progressAction(
                              action.id,
                              "COMPLETE",
                            )
                        }
                      >
                        Complete
                      </button>

                      <button
                        type="button"
                        className="capability-danger-button"
                        disabled={
                          running
                          ||
                          !(
                            actionNotes[
                              action.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void progressAction(
                              action.id,
                              "CANCEL",
                            )
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </article>
              ),
            )}

          {(
            dashboard
              ?.developmentActions
              .length ??
            0
          ) ===
            0 ? (
            <div className="capability-empty">
              No capability-development
              actions have been created.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Executive history
            </span>

            <h2>
              Immutable capability snapshots
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
                <th>Critical gaps</th>
                <th>Development actions</th>
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
                          {snapshot.capabilityScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {readable(
                            snapshot.capabilityHealth,
                          )}
                        </td>

                        <td>
                          {snapshot.criticalGapCount}
                        </td>

                        <td>
                          {snapshot.openDevelopmentActionCount}
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
                              `/capability-planning/snapshots/${snapshot.id}`
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

      <section className="capability-method-note">
        <BrainCircuit
          size={18}
        />

        <div>
          <strong>
            No inferred skills or automatic reassignment
          </strong>

          <p>
            Proficiency exists only when a
            governed assessment is
            recorded. Bench-fit results
            are decision support and never
            move work between people or
            override Step 47 assignments.
          </p>
        </div>
      </section>
    </div>
  );
}
