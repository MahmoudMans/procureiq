"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Pause,
  Play,
  Plus,
  Target,
  TrendingDown,
  Wrench,
  XCircle,
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
  cancelImprovementAction,
  cancelImprovementInitiative,
  completeImprovementAction,
  completeImprovementInitiative,
  createImprovementAction,
  createImprovementCheckpoint,
  getContinuousImprovementContext,
  getImprovementInitiative,
  holdImprovementInitiative,
  resumeImprovementInitiative,
  startImprovementAction,
  startImprovementInitiative,
} from "@/lib/api";

import type {
  ImprovementContext,
  ImprovementInitiativeDetail,
} from "@/types/continuous-improvement";

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

function money(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function defaultDueDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate()
      + 14,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function ImprovementInitiativePage() {
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
      ImprovementInitiativeDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      ImprovementContext |
      null
    >(null);

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
    actionOwner,
    setActionOwner,
  ] =
    useState("");

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
    checkpointSnapshotId,
    setCheckpointSnapshotId,
  ] =
    useState("");

  const [
    cancellationNote,
    setCancellationNote,
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

    getImprovementInitiative(
      params.id,
    )
      .then(
        async initiativeResponse => {
          const contextResponse =
            await getContinuousImprovementContext(
              initiativeResponse.initiative.currency,
            );

          if (!active) {
            return;
          }

          setDetail(
            initiativeResponse,
          );

          setContext(
            contextResponse,
          );

          setActionOwner(
            initiativeResponse.initiative.ownerUserId,
          );

          const availableSnapshot =
            contextResponse.snapshots.find(
              snapshot =>
                new Date(
                  snapshot.capturedAt,
                )
                  .getTime()
                >
                new Date(
                  initiativeResponse.initiative.createdAt,
                )
                  .getTime()
                &&
                snapshot.id !==
                  initiativeResponse.initiative.sourceSnapshotId,
            )
            ??
            contextResponse.snapshots.find(
              snapshot =>
                snapshot.id !==
                  initiativeResponse.initiative.sourceSnapshotId,
            );

          if (availableSnapshot) {
            setCheckpointSnapshotId(
              availableSnapshot.id,
            );
          }

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load improvement initiative.",
          );
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
      await getImprovementInitiative(
        params.id,
      ),
    );
  }

  async function transition(
    action:
      "START"
      |
      "HOLD"
      |
      "RESUME"
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
        await startImprovementInitiative(
          params.id,
        );
      } else if (
        action ===
        "HOLD"
      ) {
        await holdImprovementInitiative(
          params.id,
        );
      } else if (
        action ===
        "RESUME"
      ) {
        await resumeImprovementInitiative(
          params.id,
        );
      } else if (
        action ===
        "COMPLETE"
      ) {
        await completeImprovementInitiative(
          params.id,
        );
      } else {
        if (!cancellationNote.trim()) {
          setError(
            "A cancellation rationale is required.",
          );

          return;
        }

        await cancelImprovementInitiative(
          params.id,
          cancellationNote,
        );

        setCancellationNote("");
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update improvement initiative.",
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

      await createImprovementAction(
        params.id,
        {
          title:
            actionTitle.trim(),
          description:
            actionDescription.trim()
            ||
            undefined,
          ownerUserId:
            actionOwner
            ||
            undefined,
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
          : "Unable to create improvement action.",
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
        await startImprovementAction(
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
            "A completion or cancellation note is required.",
          );

          return;
        }

        if (
          action ===
          "COMPLETE"
        ) {
          await completeImprovementAction(
            actionId,
            note,
          );
        } else {
          await cancelImprovementAction(
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
          : "Unable to update improvement action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function checkpoint() {
    if (!checkpointSnapshotId) {
      setError(
        "Select a later operating-rhythm snapshot.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createImprovementCheckpoint(
        params.id,
        checkpointSnapshotId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture improvement checkpoint.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading continuous-improvement initiative...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/continuous-improvement"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Continuous improvement
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Improvement initiative not found."}
        </div>
      </div>
    );
  }

  const {
    initiative,
    baseline,
  } = detail;

  const mutable =
    initiative.status !==
      "COMPLETED"
    &&
    initiative.status !==
      "CANCELLED";

  const latestCheckpoint =
    detail.checkpoints[0];

  return (
    <div className="page-stack">
      <Link
        href="/continuous-improvement"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Continuous improvement
      </Link>

      <section className="improvement-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {initiative.initiativeNumber}
            </span>

            <span
              className={
                `improvement-priority improvement-priority--${initiative.priority.toLowerCase()}`
              }
            >
              {initiative.priority}
            </span>

            <span
              className={
                `improvement-status improvement-status--${initiative.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                initiative.status,
              )}
            </span>
          </div>

          <h1>
            {initiative.title}
          </h1>

          <p>
            {initiative.scopeLabel}
            {" · "}
            {readable(
              initiative.scopeType,
            )}
            {" · Baseline "}
            {initiative.sourceSnapshotNumber}
            {" · Owner "}
            {initiative.ownerName}
          </p>
        </div>

        <div className="improvement-detail-actions">
          {canManage &&
          initiative.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "START",
                  )
              }
            >
              <Play
                size={15}
              />
              Start
            </button>
          ) : null}

          {canManage &&
          initiative.status ===
            "ACTIVE" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "HOLD",
                  )
              }
            >
              <Pause
                size={15}
              />
              Hold
            </button>
          ) : null}

          {canManage &&
          initiative.status ===
            "ON_HOLD" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "RESUME",
                  )
              }
            >
              <Play
                size={15}
              />
              Resume
            </button>
          ) : null}

          {canFinalize &&
          (
            initiative.status ===
              "ACTIVE"
            ||
            initiative.status ===
              "ON_HOLD"
          ) ? (
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                initiative.openActions >
                  0
                ||
                !latestCheckpoint
                ||
                (
                  latestCheckpoint.outcome !==
                    "IMPROVED"
                  &&
                  latestCheckpoint.outcome !==
                    "MIXED"
                )
              }
              onClick={
                () =>
                  void transition(
                    "COMPLETE",
                  )
              }
            >
              <BadgeCheck
                size={15}
              />
              Complete
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

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Improvement hypothesis
            </span>

            <h2>
              Problem definition
            </h2>
          </div>

          <Target
            size={19}
          />
        </div>

        <div className="improvement-description">
          {detail.description}
        </div>
      </section>

      <section className="improvement-baseline-grid">
        <article>
          <span>
            Baseline active
          </span>

          <strong>
            {baseline.activeCount}
          </strong>
        </article>

        <article>
          <span>
            SLA overdue
          </span>

          <strong>
            {baseline.slaOverdueCount}
          </strong>
        </article>

        <article>
          <span>
            Persistent
          </span>

          <strong>
            {baseline.persistentCount}
          </strong>
        </article>

        <article>
          <span>
            SLA attainment
          </span>

          <strong>
            {baseline.resolvedCount >
            0
              ? `${baseline.slaAttainmentPct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Avg resolution
          </span>

          <strong>
            {baseline.avgResolutionHours.toFixed(
              1,
            )}
            h
          </strong>
        </article>

        <article>
          <span>
            Exposure
          </span>

          <strong>
            {money(
              baseline.activeExposure,
              initiative.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Objective targets
            </span>

            <h2>
              Success criteria
            </h2>
          </div>
        </div>

        <div className="improvement-target-grid">
          <article>
            <span>
              SLA attainment
            </span>

            <strong>
              ≥
              {" "}
              {detail.targetSlaAttainmentPct.toFixed(
                1,
              )}
              %
            </strong>
          </article>

          <article>
            <span>
              SLA overdue reduction
            </span>

            <strong>
              ≥
              {" "}
              {detail.targetSlaOverdueReductionPct.toFixed(
                1,
              )}
              %
            </strong>
          </article>

          <article>
            <span>
              Persistent reduction
            </span>

            <strong>
              ≥
              {" "}
              {detail.targetPersistentReductionPct.toFixed(
                1,
              )}
              %
            </strong>
          </article>

          <article>
            <span>
              Resolution-time reduction
            </span>

            <strong>
              ≥
              {" "}
              {detail.targetResolutionHoursReductionPct.toFixed(
                1,
              )}
              %
            </strong>
          </article>

          <article>
            <span>
              Exposure reduction
            </span>

            <strong>
              ≥
              {" "}
              {detail.targetExposureReductionPct.toFixed(
                1,
              )}
              %
            </strong>
          </article>

          <article>
            <span>
              Target date
            </span>

            <strong
              className={
                initiative.targetOverdue
                  ? "improvement-risk-text"
                  : ""
              }
            >
              {initiative.targetDate}
            </strong>
          </article>
        </div>
      </section>

      <section className="improvement-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Corrective work
              </span>

              <h2>
                Improvement actions
              </h2>
            </div>

            <Wrench
              size={19}
            />
          </div>

          <div className="improvement-action-list">
            {detail.actions.map(
              action => (
                <article
                  key={action.id}
                  className={
                    action.overdue
                      ? "improvement-action improvement-action--overdue"
                      : "improvement-action"
                  }
                >
                  <div>
                    <span
                      className={
                        `improvement-action-status improvement-action-status--${action.status.toLowerCase().replaceAll("_", "-")}`
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

                  {action.description ? (
                    <p>
                      {action.description}
                    </p>
                  ) : null}

                  {action.completionNote ? (
                    <div className="improvement-resolution-note">
                      {action.completionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  mutable &&
                  action.status ===
                    "PLANNED" ? (
                    <button
                      type="button"
                      className="improvement-small-button"
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

                  {canManage &&
                  mutable &&
                  (
                    action.status ===
                      "PLANNED"
                    ||
                    action.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="improvement-action-controls">
                      <input
                        value={
                          actionNotes[
                            action.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Completion / cancellation evidence"
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
                        className="improvement-danger-button"
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

            {detail.actions.length ===
            0 ? (
              <div className="improvement-empty">
                No corrective actions yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Objective evidence
              </span>

              <h2>
                Performance checkpoints
              </h2>
            </div>

            <TrendingDown
              size={19}
            />
          </div>

          <div className="improvement-checkpoint-list">
            {detail.checkpoints.map(
              checkpointItem => (
                <article
                  key={checkpointItem.id}
                >
                  <div className="improvement-checkpoint-heading">
                    <div>
                      <span
                        className={
                          `improvement-outcome improvement-outcome--${checkpointItem.outcome.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          checkpointItem.outcome,
                        )}
                      </span>

                      <strong>
                        {checkpointItem.snapshotNumber}
                      </strong>

                      <small>
                        Score
                        {" "}
                        {checkpointItem.achievementScore.toFixed(
                          1,
                        )}
                        {" · "}
                        {checkpointItem.targetsMetCount}
                        /5 targets met
                      </small>
                    </div>
                  </div>

                  <div className="improvement-checkpoint-metrics">
                    <span>
                      SLA Δ
                      <strong>
                        {checkpointItem.slaAttainmentDelta.toFixed(
                          1,
                        )}
                        pp
                      </strong>
                    </span>

                    <span>
                      Overdue ↓
                      <strong>
                        {checkpointItem.slaOverdueReductionPct.toFixed(
                          1,
                        )}
                        %
                      </strong>
                    </span>

                    <span>
                      Persistent ↓
                      <strong>
                        {checkpointItem.persistentReductionPct.toFixed(
                          1,
                        )}
                        %
                      </strong>
                    </span>

                    <span>
                      Resolution ↓
                      <strong>
                        {checkpointItem.resolutionHoursReductionPct.toFixed(
                          1,
                        )}
                        %
                      </strong>
                    </span>

                    <span>
                      Exposure ↓
                      <strong>
                        {checkpointItem.exposureReductionPct.toFixed(
                          1,
                        )}
                        %
                      </strong>
                    </span>
                  </div>

                  <small className="improvement-checkpoint-author">
                    {checkpointItem.capturedByName}
                    {" · "}
                    {new Date(
                      checkpointItem.capturedAt,
                    )
                      .toLocaleString()}
                  </small>
                </article>
              ),
            )}

            {detail.checkpoints.length ===
            0 ? (
              <div className="improvement-empty">
                No checkpoints have been
                evaluated yet.
              </div>
            ) : null}
          </div>

          {canManage &&
          (
            initiative.status ===
              "ACTIVE"
            ||
            initiative.status ===
              "ON_HOLD"
          ) ? (
            <div className="improvement-checkpoint-control">
              <select
                value={checkpointSnapshotId}
                onChange={
                  event =>
                    setCheckpointSnapshotId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select later operating snapshot
                </option>

                {context
                  ?.snapshots
                  .filter(
                    snapshot =>
                      snapshot.id !==
                        initiative.sourceSnapshotId
                      &&
                      !detail.checkpoints.some(
                        existing =>
                          existing.snapshotId ===
                            snapshot.id,
                      ),
                  )
                  .map(
                    snapshot => (
                      <option
                        key={snapshot.id}
                        value={snapshot.id}
                      >
                        {snapshot.snapshotNumber}
                        {" · "}
                        {snapshot.periodStart}
                        {" → "}
                        {snapshot.periodEnd}
                      </option>
                    ),
                  )}
              </select>

              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !checkpointSnapshotId
                }
                onClick={
                  () =>
                    void checkpoint()
                }
              >
                Evaluate checkpoint
              </button>
            </div>
          ) : null}
        </section>
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
                Corrective experiment
              </span>

              <h2>
                Add improvement action
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="improvement-form-grid">
            <label className="request-field improvement-form-wide">
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
                value={actionOwner}
                onChange={
                  event =>
                    setActionOwner(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.users
                  .filter(
                    candidate =>
                      candidate.role !==
                      "REQUESTER",
                  )
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
                Due date
              </span>

              <input
                required
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

            <label className="request-field improvement-form-wide">
              <span>
                Description / experiment
              </span>

              <textarea
                rows={5}
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

          <div className="improvement-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !actionTitle.trim()
              }
            >
              Add action
            </button>
          </div>
        </form>
      ) : null}

      {canFinalize &&
      mutable ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance
              </span>

              <h2>
                Cancellation
              </h2>
            </div>

            <XCircle
              size={19}
            />
          </div>

          <div className="improvement-cancel-control">
            <input
              value={cancellationNote}
              placeholder={
                "Required cancellation rationale"
              }
              onChange={
                event =>
                  setCancellationNote(
                    event.target.value,
                  )
              }
            />

            <button
              type="button"
              className="improvement-danger-button"
              disabled={
                running
                ||
                !cancellationNote.trim()
              }
              onClick={
                () =>
                  void transition(
                    "CANCEL",
                  )
              }
            >
              Cancel initiative
            </button>
          </div>
        </section>
      ) : null}

      <section className="improvement-method-note">
        <Target
          size={18}
        />

        <div>
          <strong>
            Before/after authority
          </strong>

          <p>
            Baseline and checkpoint
            evidence comes only from
            immutable Step 43
            operating-rhythm snapshots.
            Completing an initiative does
            not rewrite historical
            snapshots or Step 42
            control-tower records.
          </p>
        </div>
      </section>
    </div>
  );
}
