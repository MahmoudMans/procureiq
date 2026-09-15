"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  cancelStrategyRecoveryAction,
  captureStrategyRecoveryCheckpoint,
  closeStrategyRecoveryCase,
  completeStrategyRecoveryAction,
  createStrategyRecoveryAction,
  escalateStrategyRecoveryCase,
  getStrategyRecoveryCase,
  getStrategyRecoveryDashboard,
  markStrategyRecoveryReady,
  startStrategyRecoveryAction,
  startStrategyRecoveryCase,
  verifyStrategyRecoveryCase,
} from "@/lib/api";

import type {
  RecoveryCaseDetail,
  RecoveryEscalationLevel,
  RecoveryUserOption,
} from "@/types/strategy-recovery";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

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

export default function StrategyRecoveryCasePage() {
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
      RecoveryCaseDetail |
      null
    >(null);

  const [
    users,
    setUsers,
  ] =
    useState<
      RecoveryUserOption[]
    >([]);

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
    actionOwnerId,
    setActionOwnerId,
  ] =
    useState("");

  const [
    actionDueDate,
    setActionDueDate,
  ] =
    useState("");

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
    checkpointNote,
    setCheckpointNote,
  ] =
    useState("");

  const [
    escalationLevel,
    setEscalationLevel,
  ] =
    useState<RecoveryEscalationLevel>(
      "MANAGER",
    );

  const [
    escalationReason,
    setEscalationReason,
  ] =
    useState("");

  const [
    governanceNote,
    setGovernanceNote,
  ] =
    useState("");

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

    Promise.all([
      getStrategyRecoveryCase(
        params.id,
      ),
      getStrategyRecoveryDashboard(),
    ])
      .then(
        ([
          caseResponse,
          dashboardResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            caseResponse,
          );

          setUsers(
            dashboardResponse.users,
          );

          if (
            !actionOwnerId
            &&
            dashboardResponse.users[0]
          ) {
            setActionOwnerId(
              dashboardResponse.users[0].id,
            );
          }

          if (
            !actionDueDate
            &&
            caseResponse
              .recoveryCase
              .targetRecoveryDate
          ) {
            setActionDueDate(
              caseResponse
                .recoveryCase
                .targetRecoveryDate,
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
                : "Unable to load recovery case.",
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
    actionOwnerId,
    actionDueDate,
  ]);

  async function reload() {
    setDetail(
      await getStrategyRecoveryCase(
        params.id,
      ),
    );
  }

  async function startRecovery() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await startStrategyRecoveryCase(
          params.id,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start recovery.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addAction(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await createStrategyRecoveryAction(
          params.id,
          {
            title:
              actionTitle.trim(),
            description:
              actionDescription.trim()
              ||
              undefined,
            ownerUserId:
              actionOwnerId,
            dueDate:
              actionDueDate,
          },
        ),
      );

      setActionTitle("");
      setActionDescription("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create corrective action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function actionDecision(
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
        setDetail(
          await startStrategyRecoveryAction(
            actionId,
          ),
        );

        return;
      }

      const note =
        actionNotes[
          actionId
        ]
        ??
        "";

      if (!note.trim()) {
        setError(
          "Corrective-action evidence is required.",
        );

        return;
      }

      if (
        action ===
          "COMPLETE"
      ) {
        setDetail(
          await completeStrategyRecoveryAction(
            actionId,
            note,
          ),
        );
      } else {
        setDetail(
          await cancelStrategyRecoveryAction(
            actionId,
            note,
          ),
        );
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update corrective action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureCheckpoint() {
    if (!checkpointNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await captureStrategyRecoveryCheckpoint(
          params.id,
          checkpointNote,
        ),
      );

      setCheckpointNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture recovery checkpoint.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function escalate() {
    if (!escalationReason.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await escalateStrategyRecoveryCase(
          params.id,
          {
            escalationLevel,
            reason:
              escalationReason.trim(),
          },
        ),
      );

      setEscalationReason("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to escalate recovery case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitForVerification() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await markStrategyRecoveryReady(
          params.id,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to submit recovery for verification.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function verify() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await verifyStrategyRecoveryCase(
          params.id,
          governanceNote,
        ),
      );

      setGovernanceNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to verify recovery case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeCase() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeStrategyRecoveryCase(
          params.id,
          governanceNote,
        ),
      );

      setGovernanceNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close recovery case.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading recovery case...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-recovery"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Execution recovery
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Recovery case not found."}
        </div>
      </div>
    );
  }

  const recoveryCase =
    detail.recoveryCase;

  const mutable =
    recoveryCase.status !==
      "READY_FOR_VERIFICATION"
    &&
    recoveryCase.status !==
      "VERIFIED"
    &&
    recoveryCase.status !==
      "CLOSED";

  const allActionsResolved =
    detail.actions.length >
      0
    &&
    detail.actions.every(
      action =>
        action.status ===
          "COMPLETED"
        ||
        action.status ===
          "CANCELLED",
    );

  return (
    <div className="page-stack">
      <Link
        href="/strategy-recovery"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Execution recovery
      </Link>

      <section className="recovery-detail-heading">
        <div>
          <span className="eyebrow">
            Strategic recovery case
          </span>

          <h1>
            {recoveryCase.initiativeTitle}
          </h1>

          <p>
            {recoveryCase.recoveryNumber}
            {" · "}
            {recoveryCase.commitmentNumber}
            {" · "}
            {recoveryCase.roadmapNumber}
          </p>
        </div>

        <span
          className={
            `recovery-status recovery-status--${recoveryCase.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            recoveryCase.status,
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

      <section className="recovery-comparison-grid">
        <article>
          <span>
            Baseline risk
          </span>

          <strong>
            {recoveryCase.baselineRiskScore.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current risk
          </span>

          <strong>
            {recoveryCase.currentRiskScore.toFixed(
              1,
            )}
          </strong>
        </article>

        <article className="recovery-effectiveness-card">
          <span>
            Effectiveness
          </span>

          <strong>
            {recoveryCase.effectivenessPct.toFixed(
              1,
            )}
            %
          </strong>

          <small>
            {readable(
              recoveryCase.recoveryHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Recovery score
          </span>

          <strong>
            {recoveryCase.recoveryScore.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current VAR
          </span>

          <strong className="recovery-risk-text">
            {recoveryCase.currentValueAtRiskPoints.toFixed(
              1,
            )}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Verification eligible
          </span>

          <strong>
            {recoveryCase.verificationEligible
              ? "YES"
              : "NO"}
          </strong>
        </article>
      </section>

      <section className="panel recovery-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Recovery commitment
            </span>

            <h2>
              Objective
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p>
          {recoveryCase.recoveryObjective}
        </p>

        <div className="recovery-context-grid">
          <div>
            <span>
              Recovery owner
            </span>

            <strong>
              {recoveryCase.recoveryOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Execution owner
            </span>

            <strong>
              {recoveryCase.executionOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Severity
            </span>

            <strong>
              {readable(
                recoveryCase.severity,
              )}
            </strong>
          </div>

          <div>
            <span>
              Target date
            </span>

            <strong>
              {recoveryCase.targetRecoveryDate}
            </strong>
          </div>
        </div>
      </section>

      <section className="recovery-before-after-grid">
        <article>
          <h3>
            Baseline
          </h3>

          <dl>
            <div>
              <dt>Health</dt>
              <dd>
                {readable(
                  recoveryCase.baselineExecutionHealth,
                )}
              </dd>
            </div>

            <div>
              <dt>Progress</dt>
              <dd>
                {recoveryCase.baselineProgressPct.toFixed(
                  1,
                )}
                %
              </dd>
            </div>

            <div>
              <dt>Forecast</dt>
              <dd>
                {recoveryCase.baselineForecastEndDate}
              </dd>
            </div>

            <div>
              <dt>Blockers</dt>
              <dd>
                {recoveryCase.baselineBlockerCount}
              </dd>
            </div>

            <div>
              <dt>VAR</dt>
              <dd>
                {recoveryCase.baselineValueAtRiskPoints.toFixed(
                  1,
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article>
          <h3>
            Current Step 53 evidence
          </h3>

          <dl>
            <div>
              <dt>Health</dt>
              <dd>
                {readable(
                  recoveryCase.currentExecutionHealth,
                )}
              </dd>
            </div>

            <div>
              <dt>Progress</dt>
              <dd>
                {recoveryCase.currentProgressPct.toFixed(
                  1,
                )}
                %
              </dd>
            </div>

            <div>
              <dt>Forecast</dt>
              <dd>
                {recoveryCase.currentForecastEndDate}
              </dd>
            </div>

            <div>
              <dt>Blockers</dt>
              <dd>
                {recoveryCase.currentBlockerCount}
              </dd>
            </div>

            <div>
              <dt>VAR</dt>
              <dd>
                {recoveryCase.currentValueAtRiskPoints.toFixed(
                  1,
                )}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <div className="recovery-source-link">
        {recoveryCase.commitmentId ? (
          <Link
            href={
              `/strategy-execution/${recoveryCase.commitmentId}`
            }
            className="table-action"
          >
            Open authoritative Step 53 execution evidence
          </Link>
        ) : null}
      </div>

      {canManage &&
      recoveryCase.status ===
        "OPEN"
      &&
      detail.actions.length >
        0 ? (
        <section className="recovery-governance-actions">
          <button
            type="button"
            disabled={running}
            onClick={
              () =>
                void startRecovery()
            }
          >
            Start recovery
          </button>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Corrective execution
            </span>

            <h2>
              Recovery actions
            </h2>
          </div>
        </div>

        <div className="recovery-action-list">
          {detail.actions.map(
            action => (
              <article
                key={action.id}
                className={
                  action.overdue
                    ? "recovery-action recovery-action--overdue"
                    : "recovery-action"
                }
              >
                <div className="recovery-action-heading">
                  <div>
                    <span
                      className={
                        `recovery-action-status recovery-action-status--${action.status.toLowerCase().replaceAll("_", "-")}`
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
                      {action.ownerName}
                      {" · Due "}
                      {action.dueDate}
                    </small>
                  </div>
                </div>

                {action.description ? (
                  <p>
                    {action.description}
                  </p>
                ) : null}

                {action.completionEvidence ? (
                  <div className="recovery-action-evidence">
                    {action.completionEvidence}
                  </div>
                ) : null}

                {canManage &&
                mutable &&
                (
                  action.status ===
                    "PLANNED"
                  ||
                  action.status ===
                    "IN_PROGRESS"
                ) ? (
                  <div className="recovery-action-controls">
                    {action.status ===
                    "PLANNED" ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void actionDecision(
                              action.id,
                              "START",
                            )
                        }
                      >
                        Start
                      </button>
                    ) : null}

                    <input
                      placeholder="Completion / cancellation evidence"
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
                        ).trim()
                      }
                      onClick={
                        () =>
                          void actionDecision(
                            action.id,
                            "COMPLETE",
                          )
                      }
                    >
                      Complete
                    </button>

                    <button
                      type="button"
                      className="recovery-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          actionNotes[
                            action.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void actionDecision(
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

          {detail.actions.length ===
          0 ? (
            <div className="recovery-empty">
              No corrective actions have
              been created.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      mutable ? (
        <form
          className="panel"
          onSubmit={addAction}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Corrective action plan
              </span>

              <h2>
                Add action
              </h2>
            </div>
          </div>

          <div className="recovery-action-form">
            <label className="request-field recovery-form-wide">
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

            <label className="request-field">
              <span>
                Owner
              </span>

              <select
                value={actionOwnerId}
                onChange={
                  event =>
                    setActionOwnerId(
                      event.target.value,
                    )
                }
              >
                {users.map(
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

            <label className="request-field recovery-form-wide">
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

          <div className="recovery-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !actionTitle.trim()
                ||
                !actionOwnerId
              }
            >
              Add recovery action
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Before / after evidence
            </span>

            <h2>
              Recovery checkpoints
            </h2>
          </div>

          <Camera
            size={19}
          />
        </div>

        {canManage &&
        recoveryCase.status !==
          "CLOSED" ? (
          <div className="recovery-checkpoint-capture">
            <input
              placeholder="Checkpoint evidence note"
              value={checkpointNote}
              onChange={
                event =>
                  setCheckpointNote(
                    event.target.value,
                  )
              }
            />

            <button
              type="button"
              disabled={
                running
                ||
                !checkpointNote.trim()
              }
              onClick={
                () =>
                  void captureCheckpoint()
              }
            >
              Capture current Step 53 state
            </button>
          </div>
        ) : null}

        <div className="recovery-checkpoint-list">
          {detail.checkpoints.map(
            checkpoint => (
              <article
                key={checkpoint.id}
              >
                <div className="recovery-checkpoint-heading">
                  <strong>
                    {readable(
                      checkpoint.recoveryHealth,
                    )}
                  </strong>

                  <span>
                    Effectiveness
                    {" "}
                    {checkpoint.effectivenessPct.toFixed(
                      1,
                    )}
                    %
                  </span>
                </div>

                <div className="recovery-checkpoint-metrics">
                  <span>
                    Risk
                    <strong>
                      {checkpoint.currentRiskScore.toFixed(
                        1,
                      )}
                    </strong>
                  </span>

                  <span>
                    Recovery
                    <strong>
                      {checkpoint.recoveryScore.toFixed(
                        1,
                      )}
                    </strong>
                  </span>

                  <span>
                    Progress
                    <strong>
                      {checkpoint.progressPct.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </span>

                  <span>
                    Blockers
                    <strong>
                      {checkpoint.blockerCount}
                    </strong>
                  </span>

                  <span>
                    VAR
                    <strong>
                      {checkpoint.valueAtRiskPoints.toFixed(
                        1,
                      )}
                    </strong>
                  </span>
                </div>

                <p>
                  {checkpoint.checkpointNote}
                </p>

                <small>
                  {checkpoint.capturedByName}
                  {" · "}
                  {new Date(
                    checkpoint.capturedAt,
                  )
                    .toLocaleString()}
                </small>
              </article>
            ),
          )}
        </div>
      </section>

      {canFinalize &&
      recoveryCase.status !==
        "VERIFIED"
      &&
      recoveryCase.status !==
        "CLOSED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Escalation governance
              </span>

              <h2>
                Escalate unresolved risk
              </h2>
            </div>
          </div>

          <div className="recovery-escalation-form">
            <label className="request-field">
              <span>
                Level
              </span>

              <select
                value={escalationLevel}
                onChange={
                  event =>
                    setEscalationLevel(
                      event.target.value as
                        RecoveryEscalationLevel,
                    )
                }
              >
                <option value="MANAGER">
                  Manager
                </option>

                <option value="EXECUTIVE">
                  Executive
                </option>
              </select>
            </label>

            <label className="request-field recovery-form-wide">
              <span>
                Escalation reason
              </span>

              <textarea
                rows={4}
                value={escalationReason}
                onChange={
                  event =>
                    setEscalationReason(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="recovery-form-actions">
            <button
              type="button"
              className="recovery-danger-button"
              disabled={
                running
                ||
                !escalationReason.trim()
              }
              onClick={
                () =>
                  void escalate()
              }
            >
              Escalate
            </button>
          </div>
        </section>
      ) : null}

      {detail.escalations.length >
      0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance history
              </span>

              <h2>
                Escalations
              </h2>
            </div>
          </div>

          <div className="recovery-escalation-list">
            {detail.escalations.map(
              escalation => (
                <article
                  key={escalation.id}
                >
                  <strong>
                    {readable(
                      escalation.escalationLevel,
                    )}
                  </strong>

                  <p>
                    {escalation.reason}
                  </p>

                  <small>
                    {escalation.escalatedByName}
                    {" · "}
                    {new Date(
                      escalation.escalatedAt,
                    )
                      .toLocaleString()}
                  </small>
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

      {canManage &&
      recoveryCase.status ===
        "IN_RECOVERY" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Recovery verification
              </span>

              <h2>
                Submit recovery
              </h2>
            </div>
          </div>

          <p className="recovery-verification-copy">
            Submission is available only
            after all corrective actions
            are resolved and current Step
            53 evidence meets the
            deterministic recovery gate.
          </p>

          <div className="recovery-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !allActionsResolved
                ||
                !recoveryCase.verificationEligible
              }
              onClick={
                () =>
                  void submitForVerification()
              }
            >
              Submit for verification
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      (
        recoveryCase.status ===
          "READY_FOR_VERIFICATION"
        ||
        recoveryCase.status ===
          "VERIFIED"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent governance decision
              </span>

              <h2>
                {recoveryCase.status ===
                  "READY_FOR_VERIFICATION"
                  ? "Verify recovery"
                  : "Close verified recovery"}
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Governance note
            </span>

            <textarea
              rows={5}
              value={governanceNote}
              onChange={
                event =>
                  setGovernanceNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="recovery-form-actions">
            {recoveryCase.status ===
            "READY_FOR_VERIFICATION" ? (
              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !governanceNote.trim()
                  ||
                  !recoveryCase.verificationEligible
                }
                onClick={
                  () =>
                    void verify()
                }
              >
                Verify recovery
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !governanceNote.trim()
                }
                onClick={
                  () =>
                    void closeCase()
                }
              >
                Close recovery case
              </button>
            )}
          </div>
        </section>
      ) : null}

      {recoveryCase.verificationNote ? (
        <section className="recovery-verification-note">
          <strong>
            Verified recovery
          </strong>

          <p>
            {recoveryCase.verificationNote}
          </p>

          <small>
            {recoveryCase.verifiedByName}
            {" · "}
            {recoveryCase.verifiedAt
              ? new Date(
                  recoveryCase.verifiedAt,
                )
                  .toLocaleString()
              : ""}
          </small>
        </section>
      ) : null}

      <section className="recovery-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Recovery verification is evidence-gated
          </strong>

          <p>
            A case can reach verification
            only after corrective actions
            are resolved and Step 53 shows
            acceptable health, no active
            blockers, an acceptable
            forecast and limited remaining
            value at risk.
          </p>
        </div>
      </section>
    </div>
  );
}
