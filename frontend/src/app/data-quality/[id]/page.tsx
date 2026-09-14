"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Database,
  GitCompare,
  Play,
  Plus,
  SearchCheck,
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
  cancelDataQualityRemediation,
  completeDataQualityRemediation,
  createDataQualityRemediation,
  dismissDataQualityFinding,
  getDataQualityContext,
  getDataQualityFinding,
  resolveDataQualityFinding,
  startDataQualityRemediation,
} from "@/lib/api";

import type {
  DataQualityContext,
  DataQualityFindingDetail,
  DataQualityRemediation,
} from "@/types/data-quality";

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
    date.getUTCDate() + 14,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function DataQualityFindingPage() {
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
      DataQualityFindingDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      DataQualityContext |
      null
    >(null);

  const [
    remediationTitle,
    setRemediationTitle,
  ] =
    useState("");

  const [
    remediationOwner,
    setRemediationOwner,
  ] =
    useState("");

  const [
    remediationDueDate,
    setRemediationDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    taskNotes,
    setTaskNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    resolutionNote,
    setResolutionNote,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

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

  const canDismiss =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getDataQualityFinding(
        params.id,
      ),
      getDataQualityContext(),
    ])
      .then(
        ([
          findingResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            findingResponse,
          );

          setContext(
            contextResponse,
          );

          const owner =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (owner) {
            setRemediationOwner(
              owner.id,
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
              : "Unable to load data-quality finding.",
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
      await getDataQualityFinding(
        params.id,
      ),
    );
  }

  async function createRemediation(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      await createDataQualityRemediation(
        params.id,
        {
          title:
            remediationTitle.trim(),
          ownerUserId:
            remediationOwner
            ||
            undefined,
          dueDate:
            remediationDueDate,
        },
      );

      setRemediationTitle("");
      setRemediationDueDate(
        defaultDueDate(),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create remediation task.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function startTask(
    task:
      DataQualityRemediation,
  ) {
    try {
      setRunning(true);
      setError(null);

      await startDataQualityRemediation(
        task.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start remediation task.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function completeTask(
    task:
      DataQualityRemediation,
  ) {
    const note =
      taskNotes[
        task.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A remediation completion note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await completeDataQualityRemediation(
        task.id,
        note,
      );

      setTaskNotes(
        current => ({
          ...current,
          [task.id]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to complete remediation task.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelTask(
    task:
      DataQualityRemediation,
  ) {
    try {
      setRunning(true);
      setError(null);

      await cancelDataQualityRemediation(
        task.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel remediation task.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function resolveFinding() {
    if (!resolutionNote.trim()) {
      setError(
        "A finding resolution note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await resolveDataQualityFinding(
        params.id,
        resolutionNote,
      );

      setResolutionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to resolve finding.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function dismissFinding() {
    if (!resolutionNote.trim()) {
      setError(
        "A dismissal rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await dismissDataQualityFinding(
        params.id,
        resolutionNote,
      );

      setResolutionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to dismiss finding.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading data-quality finding...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/data-quality"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Data quality
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Data-quality finding not found."}
        </div>
      </div>
    );
  }

  const {
    finding,
    remediationTasks,
  } = detail;

  const activeFinding =
    finding.status ===
      "OPEN"
    ||
    finding.status ===
      "REMEDIATION_IN_PROGRESS";

  return (
    <div className="page-stack">
      <Link
        href="/data-quality"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Data quality
      </Link>

      <section className="data-quality-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {finding.ruleCode}
            </span>

            <span
              className={
                `data-quality-severity data-quality-severity--${finding.severity.toLowerCase()}`
              }
            >
              {finding.severity}
            </span>

            <span
              className={
                `data-quality-status data-quality-status--${finding.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                finding.status,
              )}
            </span>
          </div>

          <h1>
            {finding.ruleTitle}
          </h1>

          <p>
            {readable(
              finding.domain,
            )}
            {" · "}
            {readable(
              finding.entityType,
            )}
            {" · "}
            {finding.entityReference ??
              finding.entityId}
          </p>
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

      <section className="data-quality-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Quality defect
              </span>

              <h2>
                Finding evidence
              </h2>
            </div>

            <SearchCheck
              size={19}
            />
          </div>

          <div className="data-quality-evidence-grid">
            <div>
              <span>
                Entity
              </span>

              <strong>
                {readable(
                  finding.entityType,
                )}
              </strong>
            </div>

            <div>
              <span>
                Entity ID
              </span>

              <strong className="data-quality-long-id">
                {finding.entityId}
              </strong>
            </div>

            <div>
              <span>
                Related entity
              </span>

              <strong className="data-quality-long-id">
                {finding.relatedEntityId ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                First detected
              </span>

              <strong>
                {new Date(
                  finding.detectedAt,
                )
                  .toLocaleString()}
              </strong>
            </div>

            <div>
              <span>
                Last detected
              </span>

              <strong>
                {new Date(
                  finding.lastSeenAt,
                )
                  .toLocaleString()}
              </strong>
            </div>

            <div>
              <span>
                Remediation
              </span>

              <strong>
                {finding.openRemediationTasks}
                {" active"}
              </strong>
            </div>
          </div>

          <div className="data-quality-finding-details">
            {finding.details}
          </div>

          {finding.ruleCode ===
          "SUPPLIER_DUPLICATE_NAME" ? (
            <div className="data-quality-duplicate-note">
              <GitCompare
                size={16}
              />

              <span>
                This is a duplicate
                candidate only. ProcureIQ
                does not automatically
                merge or delete either
                supplier record.
              </span>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance state
              </span>

              <h2>
                Finding status
              </h2>
            </div>

            <Database
              size={19}
            />
          </div>

          <div className="data-quality-state-card">
            <span>
              {readable(
                finding.status,
              )}
            </span>

            {finding.resolutionNote ? (
              <>
                <strong>
                  {finding.resolutionNote}
                </strong>

                <small>
                  {finding.resolvedByName ??
                    "Automated quality scan"}
                  {finding.resolvedAt
                    ? ` · ${new Date(
                        finding.resolvedAt,
                      ).toLocaleString()}`
                    : ""}
                </small>
              </>
            ) : (
              <p>
                This finding remains
                active until corrected,
                explicitly resolved or
                dismissed by governance.
              </p>
            )}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Remediation execution
            </span>

            <h2>
              Remediation tasks
            </h2>
          </div>

          <Wrench
            size={19}
          />
        </div>

        {remediationTasks.length ===
        0 ? (
          <div className="data-quality-empty">
            No remediation tasks are
            currently recorded.
          </div>
        ) : (
          <div className="data-quality-task-list">
            {remediationTasks.map(
              task => (
                <article
                  key={task.id}
                  className={
                    task.overdue
                      ? "data-quality-task data-quality-task--overdue"
                      : "data-quality-task"
                  }
                >
                  <div className="data-quality-task-heading">
                    <div>
                      <span
                        className={
                          `data-quality-task-status data-quality-task-status--${task.status.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          task.status,
                        )}
                      </span>

                      <strong>
                        {task.title}
                      </strong>

                      <small>
                        Owner:
                        {" "}
                        {task.ownerName}
                      </small>
                    </div>

                    <div>
                      <span>
                        Due
                      </span>

                      <strong
                        className={
                          task.overdue
                            ? "data-quality-overdue"
                            : ""
                        }
                      >
                        {new Date(
                          `${task.dueDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {task.completionNote ? (
                    <div className="data-quality-completion-note">
                      {task.completionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  (
                    task.status ===
                      "OPEN"
                    ||
                    task.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="data-quality-inline-controls">
                      {task.status ===
                      "OPEN" ? (
                        <button
                          type="button"
                          disabled={running}
                          onClick={
                            () =>
                              void startTask(
                                task,
                              )
                          }
                        >
                          <Play
                            size={14}
                          />
                          Start
                        </button>
                      ) : null}

                      <input
                        value={
                          taskNotes[
                            task.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Completion evidence"
                        }
                        onChange={
                          event =>
                            setTaskNotes(
                              current => ({
                                ...current,
                                [task.id]:
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
                            taskNotes[
                              task.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void completeTask(
                              task,
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Complete
                      </button>

                      {canDismiss ? (
                        <button
                          type="button"
                          className="data-quality-inline-danger"
                          disabled={running}
                          onClick={
                            () =>
                              void cancelTask(
                                task,
                              )
                          }
                        >
                          <XCircle
                            size={14}
                          />
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      activeFinding ? (
        <form
          className="panel"
          onSubmit={createRemediation}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Corrective action
              </span>

              <h2>
                Add remediation task
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="data-quality-form-grid">
            <label className="request-field data-quality-form-wide">
              <span>
                Task title
              </span>

              <input
                required
                maxLength={220}
                value={
                  remediationTitle
                }
                onChange={
                  event =>
                    setRemediationTitle(
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
                value={
                  remediationOwner
                }
                onChange={
                  event =>
                    setRemediationOwner(
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
                        key={
                          candidate.id
                        }
                        value={
                          candidate.id
                        }
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
                required
                type="date"
                value={
                  remediationDueDate
                }
                onChange={
                  event =>
                    setRemediationDueDate(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="data-quality-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                saving
                ||
                !remediationTitle.trim()
              }
            >
              <Plus
                size={16}
              />

              {saving
                ? "Creating..."
                : "Add remediation"}
            </button>
          </div>
        </form>
      ) : null}

      {activeFinding &&
      (
        canManage
        ||
        canDismiss
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Finding governance
              </span>

              <h2>
                Resolve or dismiss
              </h2>
            </div>

            <AlertTriangle
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Governance evidence / rationale
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              value={resolutionNote}
              onChange={
                event =>
                  setResolutionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="data-quality-form-actions">
            {canDismiss ? (
              <button
                type="button"
                className="button button--secondary"
                disabled={
                  running
                  ||
                  !resolutionNote.trim()
                }
                onClick={
                  () =>
                    void dismissFinding()
                }
              >
                <XCircle
                  size={16}
                />
                Dismiss exception
              </button>
            ) : null}

            {canManage ? (
              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !resolutionNote.trim()
                }
                onClick={
                  () =>
                    void resolveFinding()
                }
              >
                <BadgeCheck
                  size={16}
                />
                Resolve finding
              </button>
            ) : null}
          </div>

          <div className="data-quality-rescan-note">
            <SearchCheck
              size={15}
            />

            <span>
              Completing a remediation
              task does not automatically
              declare the underlying
              master data correct. Rerun
              the quality scan after the
              source record has been
              corrected; ProcureIQ will
              then auto-resolve defects
              that are no longer present.
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
