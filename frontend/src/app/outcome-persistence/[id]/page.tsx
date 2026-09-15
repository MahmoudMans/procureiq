"use client";

import {
  ArrowLeft,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  cancelOutcomePersistenceControl,
  closeOutcomePersistencePlan,
  completeOutcomePersistenceControl,
  createOutcomePersistenceControl,
  getOutcomePersistencePlan,
  recordOutcomePersistenceObservation,
  startOutcomePersistenceControl,
  submitOutcomePersistenceForReview,
  validateOutcomePersistenceObservation,
  verifyOutcomePersistence,
} from "@/lib/api";

import type {
  PersistencePlanDetail,
  PersistenceValidationDecision,
  PersistenceVerificationDecision,
} from "@/types/outcome-persistence";

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

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function OutcomePersistencePlanPage() {
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
      PersistencePlanDetail |
      null
    >(null);

  const [
    observedOn,
    setObservedOn,
  ] =
    useState(
      today(),
    );

  const [
    reportedPoints,
    setReportedPoints,
  ] =
    useState(0);

  const [
    observationEvidence,
    setObservationEvidence,
  ] =
    useState("");

  const [
    validationNotes,
    setValidationNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    validationPoints,
    setValidationPoints,
  ] =
    useState<
      Record<
        string,
        number
      >
    >({});

  const [
    controlTitle,
    setControlTitle,
  ] =
    useState("");

  const [
    controlDescription,
    setControlDescription,
  ] =
    useState("");

  const [
    controlOwnerId,
    setControlOwnerId,
  ] =
    useState("");

  const [
    controlDue,
    setControlDue,
  ] =
    useState(
      today(),
    );

  const [
    controlNotes,
    setControlNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    verificationDecision,
    setVerificationDecision,
  ] =
    useState<PersistenceVerificationDecision>(
      "SUSTAINED",
    );

  const [
    verificationNote,
    setVerificationNote,
  ] =
    useState("");

  const [
    closeNote,
    setCloseNote,
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

  const canValidate =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getOutcomePersistencePlan(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDetail(
            response,
          );

          setReportedPoints(
            response.plan.baselineValidatedContributionPoints,
          );

          if (
            response.users[0]
          ) {
            setControlOwnerId(
              response.users[0].id,
            );
          }

          setControlDue(
            response.plan.observationEndDate,
          );
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load persistence plan.",
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
      await getOutcomePersistencePlan(
        params.id,
      ),
    );
  }

  async function recordObservation(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await recordOutcomePersistenceObservation(
          params.id,
          {
            observedOn,
            reportedContributionPoints:
              reportedPoints,
            evidenceNote:
              observationEvidence.trim(),
          },
        ),
      );

      setObservationEvidence("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record persistence observation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function validateObservation(
    observationId: string,
    decision:
      PersistenceValidationDecision,
    reported: number,
  ) {
    const note =
      validationNotes[
        observationId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Observation validation note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await validateOutcomePersistenceObservation(
          observationId,
          {
            decision,
            validatedContributionPoints:
              decision ===
                "VALIDATED"
                ? (
                    validationPoints[
                      observationId
                    ]
                    ??
                    reported
                  )
                : undefined,
            validationNote:
              note,
          },
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to validate persistence observation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createControl(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await createOutcomePersistenceControl(
          params.id,
          {
            title:
              controlTitle.trim(),
            description:
              controlDescription.trim()
              ||
              undefined,
            ownerUserId:
              controlOwnerId,
            dueDate:
              controlDue,
          },
        ),
      );

      setControlTitle("");
      setControlDescription("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create sustainability control.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function controlAction(
    controlId: string,
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
          await startOutcomePersistenceControl(
            controlId,
          ),
        );

        return;
      }

      const note =
        controlNotes[
          controlId
        ]
        ??
        "";

      if (!note.trim()) {
        setError(
          "Control evidence is required.",
        );

        return;
      }

      if (
        action ===
          "COMPLETE"
      ) {
        setDetail(
          await completeOutcomePersistenceControl(
            controlId,
            note,
          ),
        );
      } else {
        setDetail(
          await cancelOutcomePersistenceControl(
            controlId,
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
          : "Unable to update sustainability control.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitForReview() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await submitOutcomePersistenceForReview(
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
          : "Unable to submit persistence plan for review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function verifyPersistence() {
    if (!verificationNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await verifyOutcomePersistence(
          params.id,
          {
            decision:
              verificationDecision,
            verificationNote:
              verificationNote.trim(),
          },
        ),
      );

      setVerificationNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to verify persistent outcome.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closePlan() {
    if (!closeNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeOutcomePersistencePlan(
          params.id,
          closeNote,
        ),
      );

      setCloseNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close persistence plan.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading persistence plan...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/outcome-persistence"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Outcome persistence
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Persistence plan not found."}
        </div>
      </div>
    );
  }

  const plan =
    detail.plan;

  const observationMutable =
    plan.status ===
      "ACTIVE"
    ||
    plan.status ===
      "IN_REMEDIATION";

  return (
    <div className="page-stack">
      <Link
        href="/outcome-persistence"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Outcome persistence
      </Link>

      <section className="persistence-detail-heading">
        <div>
          <span className="eyebrow">
            Post-implementation value observation
          </span>

          <h1>
            {plan.initiativeTitle}
          </h1>

          <p>
            {plan.planNumber}
            {" · "}
            {plan.commitmentNumber}
            {" · "}
            {plan.roadmapNumber}
          </p>
        </div>

        <span
          className={
            `persistence-status persistence-status--${plan.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            plan.status,
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

      <section className="persistence-comparison-grid">
        <article>
          <span>
            Step 53 baseline
          </span>

          <strong>
            {plan.baselineValidatedContributionPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current validated
          </span>

          <strong>
            {plan.assessed
              ? plan.currentValidatedContributionPoints.toFixed(
                  1,
                )
              : "—"}
          </strong>
        </article>

        <article className="persistence-score-card">
          <span>
            Persistence
          </span>

          <strong>
            {plan.assessed
              ? `${plan.persistencePct.toFixed(1)}%`
              : "—"}
          </strong>

          <small>
            {readable(
              plan.persistenceHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Benefit decay
          </span>

          <strong className="persistence-risk-text">
            {plan.decayPoints.toFixed(
              1,
            )}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Minimum required
          </span>

          <strong>
            {plan.minimumPersistencePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Verification eligible
          </span>

          <strong>
            {plan.verificationEligible
              ? "YES"
              : "NO"}
          </strong>
        </article>
      </section>

      <section className="panel persistence-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Persistence governance
            </span>

            <h2>
              Observation objective
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p>
          {plan.persistenceObjective}
        </p>

        <div className="persistence-context-grid">
          <div>
            <span>
              Persistence owner
            </span>

            <strong>
              {plan.persistenceOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Execution owner
            </span>

            <strong>
              {plan.executionOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Observation window
            </span>

            <strong>
              {plan.observationStartDate}
              {" → "}
              {plan.observationEndDate}
            </strong>
          </div>

          <div>
            <span>
              Observation due
            </span>

            <strong>
              {plan.observationDue
                ? "YES"
                : "NO"}
            </strong>
          </div>
        </div>
      </section>

      <div className="persistence-source-link">
        <Link
          href={
            `/strategy-execution/${plan.commitmentId}`
          }
          className="table-action"
        >
          Open authoritative Step 53 outcome evidence
        </Link>
      </div>

      {canManage &&
      observationMutable ? (
        <form
          className="panel"
          onSubmit={recordObservation}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Persistence evidence
              </span>

              <h2>
                Record observation
              </h2>
            </div>
          </div>

          <div className="persistence-observation-form">
            <label className="request-field">
              <span>
                Observed on
              </span>

              <input
                type="date"
                value={observedOn}
                onChange={
                  event =>
                    setObservedOn(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Reported contribution
              </span>

              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={reportedPoints}
                onChange={
                  event =>
                    setReportedPoints(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field persistence-form-wide">
              <span>
                Evidence
              </span>

              <textarea
                required
                rows={5}
                value={observationEvidence}
                onChange={
                  event =>
                    setObservationEvidence(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="persistence-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !observationEvidence.trim()
              }
            >
              Record immutable observation
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Post-implementation evidence
            </span>

            <h2>
              Observations
            </h2>
          </div>
        </div>

        <div className="persistence-observation-list">
          {detail.observations.map(
            observation => (
              <article
                key={observation.id}
              >
                <div className="persistence-observation-heading">
                  <div>
                    <strong>
                      {observation.reportedContributionPoints.toFixed(
                        1,
                      )}
                      {" pts reported"}
                    </strong>

                    <span>
                      {observation.observedOn}
                      {" · "}
                      {observation.validationDecision
                        ? readable(
                            observation.validationDecision,
                          )
                        : "Awaiting validation"}
                    </span>
                  </div>

                  {observation.validatedContributionPoints !==
                  null ? (
                    <div>
                      <span>
                        Validated
                      </span>

                      <strong>
                        {observation.validatedContributionPoints.toFixed(
                          1,
                        )}
                      </strong>
                    </div>
                  ) : null}
                </div>

                <p>
                  {observation.evidenceNote}
                </p>

                <small>
                  {observation.reportedByName}
                  {" · "}
                  {new Date(
                    observation.reportedAt,
                  )
                    .toLocaleString()}
                </small>

                {observation.validationNote ? (
                  <div className="persistence-validation-note">
                    <strong>
                      Validation
                    </strong>

                    <p>
                      {observation.validationNote}
                    </p>

                    <small>
                      {observation.validatedByName}
                    </small>
                  </div>
                ) : null}

                {canValidate &&
                observation.validationDecision ===
                  null
                &&
                observationMutable ? (
                  <div className="persistence-validation-control">
                    <label className="request-field">
                      <span>
                        Validated contribution
                      </span>

                      <input
                        type="number"
                        min="0"
                        max={observation.reportedContributionPoints}
                        step="0.1"
                        value={
                          validationPoints[
                            observation.id
                          ]
                          ??
                          observation.reportedContributionPoints
                        }
                        onChange={
                          event =>
                            setValidationPoints(
                              current => ({
                                ...current,
                                [observation.id]:
                                  Number(
                                    event.target.value,
                                  ),
                              }),
                            )
                        }
                      />
                    </label>

                    <label className="request-field">
                      <span>
                        Validation note
                      </span>

                      <input
                        value={
                          validationNotes[
                            observation.id
                          ]
                          ??
                          ""
                        }
                        onChange={
                          event =>
                            setValidationNotes(
                              current => ({
                                ...current,
                                [observation.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <button
                      type="button"
                      disabled={
                        running
                        ||
                        !(
                          validationNotes[
                            observation.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void validateObservation(
                            observation.id,
                            "VALIDATED",
                            observation.reportedContributionPoints,
                          )
                      }
                    >
                      Validate
                    </button>

                    <button
                      type="button"
                      className="persistence-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          validationNotes[
                            observation.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void validateObservation(
                            observation.id,
                            "REJECTED",
                            observation.reportedContributionPoints,
                          )
                      }
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.observations.length ===
          0 ? (
            <div className="persistence-empty">
              No persistence observation
              has been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      observationMutable ? (
        <form
          className="panel"
          onSubmit={createControl}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Value protection
              </span>

              <h2>
                Add sustainability control
              </h2>
            </div>
          </div>

          <div className="persistence-control-form">
            <label className="request-field persistence-form-wide">
              <span>
                Control title
              </span>

              <input
                required
                value={controlTitle}
                onChange={
                  event =>
                    setControlTitle(
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
                value={controlOwnerId}
                onChange={
                  event =>
                    setControlOwnerId(
                      event.target.value,
                    )
                }
              >
                {detail.users.map(
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
                value={controlDue}
                onChange={
                  event =>
                    setControlDue(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field persistence-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                value={controlDescription}
                onChange={
                  event =>
                    setControlDescription(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="persistence-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !controlTitle.trim()
                ||
                !controlOwnerId
              }
            >
              Add sustainability control
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Benefit protection
            </span>

            <h2>
              Sustainability controls
            </h2>
          </div>
        </div>

        <div className="persistence-control-list">
          {detail.controls.map(
            control => (
              <article
                key={control.id}
                className={
                  control.overdue
                    ? "persistence-control persistence-control--overdue"
                    : "persistence-control"
                }
              >
                <div>
                  <span
                    className={
                      `persistence-control-status persistence-control-status--${control.status.toLowerCase().replaceAll("_", "-")}`
                    }
                  >
                    {readable(
                      control.status,
                    )}
                  </span>

                  <strong>
                    {control.title}
                  </strong>

                  <small>
                    {control.ownerName}
                    {" · Due "}
                    {control.dueDate}
                  </small>
                </div>

                {control.description ? (
                  <p>
                    {control.description}
                  </p>
                ) : null}

                {control.completionEvidence ? (
                  <div className="persistence-control-evidence">
                    {control.completionEvidence}
                  </div>
                ) : null}

                {canManage &&
                observationMutable &&
                (
                  control.status ===
                    "PLANNED"
                  ||
                  control.status ===
                    "IN_PROGRESS"
                ) ? (
                  <div className="persistence-control-actions">
                    {control.status ===
                    "PLANNED" ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void controlAction(
                              control.id,
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
                        controlNotes[
                          control.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setControlNotes(
                            current => ({
                              ...current,
                              [control.id]:
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
                          controlNotes[
                            control.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void controlAction(
                            control.id,
                            "COMPLETE",
                          )
                      }
                    >
                      Complete
                    </button>

                    <button
                      type="button"
                      className="persistence-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          controlNotes[
                            control.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void controlAction(
                            control.id,
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

          {detail.controls.length ===
          0 ? (
            <div className="persistence-empty">
              No sustainability controls.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      (
        plan.status ===
          "ACTIVE"
        ||
        plan.status ===
          "IN_REMEDIATION"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Persistence review gate
              </span>

              <h2>
                Submit for independent review
              </h2>
            </div>
          </div>

          <p className="persistence-review-copy">
            Submission requires the
            observation window to have
            ended, a validated observation
            on or after the end date, and
            every sustainability control
            to be resolved.
          </p>

          <div className="persistence-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !plan.verificationEligible
              }
              onClick={
                () =>
                  void submitForReview()
              }
            >
              Submit for persistence review
            </button>
          </div>
        </section>
      ) : null}

      {canValidate &&
      plan.status ===
        "READY_FOR_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent value verification
              </span>

              <h2>
                Persistence decision
              </h2>
            </div>
          </div>

          <div className="persistence-verification-form">
            <label className="request-field">
              <span>
                Decision
              </span>

              <select
                value={verificationDecision}
                onChange={
                  event =>
                    setVerificationDecision(
                      event.target.value as
                        PersistenceVerificationDecision,
                    )
                }
              >
                <option value="SUSTAINED">
                  Sustained
                </option>

                <option value="REMEDIATION_REQUIRED">
                  Remediation required
                </option>
              </select>
            </label>

            <label className="request-field persistence-form-wide">
              <span>
                Verification note
              </span>

              <textarea
                rows={5}
                value={verificationNote}
                onChange={
                  event =>
                    setVerificationNote(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="persistence-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !verificationNote.trim()
              }
              onClick={
                () =>
                  void verifyPersistence()
              }
            >
              Record persistence decision
            </button>
          </div>
        </section>
      ) : null}

      {canValidate &&
      plan.status ===
        "SUSTAINED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance closure
              </span>

              <h2>
                Close persistence plan
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Closure note
            </span>

            <textarea
              rows={5}
              value={closeNote}
              onChange={
                event =>
                  setCloseNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="persistence-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !closeNote.trim()
              }
              onClick={
                () =>
                  void closePlan()
              }
            >
              Close sustained plan
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Independent governance history
            </span>

            <h2>
              Persistence verifications
            </h2>
          </div>
        </div>

        <div className="persistence-verification-list">
          {detail.verifications.map(
            verification => (
              <article
                key={verification.id}
              >
                <div>
                  <strong>
                    {readable(
                      verification.decision,
                    )}
                  </strong>

                  <span>
                    {verification.persistencePct.toFixed(
                      1,
                    )}
                    {"% persistence · "}
                    {verification.decayPoints.toFixed(
                      1,
                    )}
                    {" pts decay"}
                  </span>
                </div>

                <p>
                  {verification.verificationNote}
                </p>

                <small>
                  {verification.verifiedByName}
                  {" · "}
                  {new Date(
                    verification.verifiedAt,
                  )
                    .toLocaleString()}
                </small>
              </article>
            ),
          )}

          {detail.verifications.length ===
          0 ? (
            <div className="persistence-empty">
              No independent persistence
              verification yet.
            </div>
          ) : null}
        </div>
      </section>

      {plan.closeNote ? (
        <section className="persistence-closure-note">
          <strong>
            Persistence governance closed
          </strong>

          <p>
            {plan.closeNote}
          </p>

          <small>
            {plan.closedByName}
          </small>
        </section>
      ) : null}

      <section className="persistence-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Remediation never rewrites the historical Step 53 outcome
          </strong>

          <p>
            A decayed benefit can enter
            sustainability remediation and
            be observed again. Every
            observation and verification
            remains immutable, preserving
            the difference between initial
            validated delivery and durable
            post-implementation value.
          </p>
        </div>
      </section>
    </div>
  );
}
