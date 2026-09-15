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
  cancelStrategyExecutionCommitment,
  completeStrategyExecutionCommitment,
  getStrategyExecutionCommitment,
  recordStrategyExecutionProgress,
  reportStrategyExecutionOutcome,
  startStrategyExecutionCommitment,
  validateStrategyExecutionOutcome,
} from "@/lib/api";

import type {
  ExecutionCommitmentDetail,
  ExecutionValidationDecision,
} from "@/types/strategy-execution";

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

export default function StrategyExecutionCommitmentPage() {
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
      ExecutionCommitmentDetail |
      null
    >(null);

  const [
    progress,
    setProgress,
  ] =
    useState(0);

  const [
    forecastEnd,
    setForecastEnd,
  ] =
    useState("");

  const [
    blockerCount,
    setBlockerCount,
  ] =
    useState(0);

  const [
    blockerSummary,
    setBlockerSummary,
  ] =
    useState("");

  const [
    updateNote,
    setUpdateNote,
  ] =
    useState("");

  const [
    reportedPoints,
    setReportedPoints,
  ] =
    useState(0);

  const [
    outcomeEvidence,
    setOutcomeEvidence,
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

    getStrategyExecutionCommitment(
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

          setProgress(
            response.commitment.progressPct,
          );

          setForecastEnd(
            response.commitment.forecastEndDate,
          );

          setReportedPoints(
            response.commitment.plannedContributionPoints,
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
                : "Unable to load execution commitment.",
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

  async function statusAction(
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
          await startStrategyExecutionCommitment(
            params.id,
          ),
        );
      } else if (
        action ===
          "COMPLETE"
      ) {
        setDetail(
          await completeStrategyExecutionCommitment(
            params.id,
          ),
        );
      } else {
        setDetail(
          await cancelStrategyExecutionCommitment(
            params.id,
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
          : "Unable to update execution commitment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitProgress(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const response =
        await recordStrategyExecutionProgress(
          params.id,
          {
            progressPct:
              progress,
            forecastEndDate:
              forecastEnd,
            blockerCount,
            blockerSummary:
              blockerSummary.trim()
              ||
              undefined,
            updateNote:
              updateNote.trim(),
          },
        );

      setDetail(
        response,
      );

      setUpdateNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record progress.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitOutcome(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await reportStrategyExecutionOutcome(
          params.id,
          {
            reportedContributionPoints:
              reportedPoints,
            evidenceNote:
              outcomeEvidence.trim(),
          },
        ),
      );

      setOutcomeEvidence("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to report outcome.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function validateOutcome(
    outcomeId: string,
    decision:
      ExecutionValidationDecision,
    reported: number,
  ) {
    const note =
      validationNotes[
        outcomeId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Validation note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await validateStrategyExecutionOutcome(
          outcomeId,
          {
            decision,
            validatedContributionPoints:
              decision ===
                "VALIDATED"
                ? (
                    validationPoints[
                      outcomeId
                    ]
                    ??
                    reported
                  )
                : undefined,
            validationNote:
              note.trim(),
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
          : "Unable to validate outcome.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading execution commitment...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategic execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Execution commitment not found."}
        </div>
      </div>
    );
  }

  const commitment =
    detail.commitment;

  const latestOutcome =
    detail.outcomes[0];

  const canReportOutcome =
    commitment.status ===
      "COMPLETED"
    &&
    (
      !latestOutcome
      ||
      latestOutcome.validationDecision ===
        "REJECTED"
    );

  return (
    <div className="page-stack">
      <Link
        href="/strategy-execution"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategic execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <span className="eyebrow">
            Governed execution commitment
          </span>

          <h1>
            {commitment.sourceInitiativeTitle}
          </h1>

          <p>
            {commitment.commitmentNumber}
            {" · "}
            {commitment.sourceInitiativeNumber}
            {" · "}
            {commitment.sourceRoadmapNumber}
          </p>
        </div>

        <span
          className={
            `execution-health execution-health--${commitment.health.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            commitment.health,
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

      <section className="execution-detail-grid">
        <article>
          <span>
            Progress
          </span>

          <strong>
            {commitment.progressPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Expected progress
          </span>

          <strong>
            {commitment.expectedProgressPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Schedule variance
          </span>

          <strong
            className={
              commitment.scheduleVariancePct <
              -10
                ? "execution-risk-text"
                : ""
            }
          >
            {commitment.scheduleVariancePct.toFixed(
              1,
            )}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Planned contribution
          </span>

          <strong>
            {commitment.plannedContributionPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Reported
          </span>

          <strong>
            {commitment.reportedContributionPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Validated
          </span>

          <strong>
            {commitment.validatedContributionPoints.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Value at risk
          </span>

          <strong className="execution-risk-text">
            {commitment.valueAtRiskPoints.toFixed(
              1,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Commitment authority
            </span>

            <h2>
              Delivery context
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="execution-context-grid">
          <div>
            <span>Owner</span>
            <strong>
              {commitment.ownerName}
            </strong>
          </div>

          <div>
            <span>Planned window</span>
            <strong>
              {commitment.plannedStartDate}
              {" → "}
              {commitment.plannedEndDate}
            </strong>
          </div>

          <div>
            <span>Forecast end</span>
            <strong>
              {commitment.forecastEndDate}
            </strong>
          </div>

          <div>
            <span>Active blockers</span>
            <strong>
              {commitment.blockerCount}
            </strong>
          </div>
        </div>

        {commitment.blockerSummary ? (
          <p className="execution-blocker-summary">
            {commitment.blockerSummary}
          </p>
        ) : null}
      </section>

      {canManage ? (
        <section className="execution-action-bar">
          {commitment.status ===
          "PLANNED" ? (
            <button
              type="button"
              disabled={running}
              onClick={
                () =>
                  void statusAction(
                    "START",
                  )
              }
            >
              Start commitment
            </button>
          ) : null}

          {commitment.status ===
            "IN_PROGRESS"
          &&
          commitment.progressPct >=
            100
          &&
          commitment.blockerCount ===
            0 ? (
            <button
              type="button"
              disabled={running}
              onClick={
                () =>
                  void statusAction(
                    "COMPLETE",
                  )
              }
            >
              Complete commitment
            </button>
          ) : null}

          {canValidate &&
          (
            commitment.status ===
              "PLANNED"
            ||
            commitment.status ===
              "IN_PROGRESS"
          ) ? (
            <button
              type="button"
              className="execution-danger-button"
              disabled={running}
              onClick={
                () =>
                  void statusAction(
                    "CANCEL",
                  )
              }
            >
              Cancel commitment
            </button>
          ) : null}
        </section>
      ) : null}

      {canManage &&
      commitment.status ===
        "IN_PROGRESS" ? (
        <form
          className="panel"
          onSubmit={submitProgress}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Immutable delivery evidence
              </span>

              <h2>
                Record progress
              </h2>
            </div>
          </div>

          <div className="execution-progress-form">
            <label className="request-field">
              <span>
                Progress %
              </span>

              <input
                type="number"
                min={commitment.progressPct}
                max="100"
                step="0.1"
                value={progress}
                onChange={
                  event =>
                    setProgress(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Forecast end
              </span>

              <input
                type="date"
                value={forecastEnd}
                onChange={
                  event =>
                    setForecastEnd(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Blocker count
              </span>

              <input
                type="number"
                min="0"
                step="1"
                value={blockerCount}
                onChange={
                  event =>
                    setBlockerCount(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field execution-form-wide">
              <span>
                Blocker summary
              </span>

              <textarea
                rows={4}
                value={blockerSummary}
                onChange={
                  event =>
                    setBlockerSummary(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field execution-form-wide">
              <span>
                Progress evidence / update note
              </span>

              <textarea
                required
                rows={5}
                value={updateNote}
                onChange={
                  event =>
                    setUpdateNote(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="execution-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !updateNote.trim()
                ||
                (
                  blockerCount >
                    0
                  &&
                  !blockerSummary.trim()
                )
              }
            >
              Record progress
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Delivery history
            </span>

            <h2>
              Immutable progress updates
            </h2>
          </div>
        </div>

        <div className="execution-evidence-list">
          {detail.progressUpdates.map(
            update => (
              <article
                key={update.id}
              >
                <div>
                  <strong>
                    {update.progressPct.toFixed(
                      1,
                    )}
                    %
                  </strong>

                  <span>
                    Forecast
                    {" "}
                    {update.forecastEndDate}
                    {" · "}
                    {update.blockerCount}
                    {" blocker(s)"}
                  </span>
                </div>

                <p>
                  {update.updateNote}
                </p>

                {update.blockerSummary ? (
                  <small>
                    Blockers:
                    {" "}
                    {update.blockerSummary}
                  </small>
                ) : null}

                <small>
                  Recorded by
                  {" "}
                  {update.createdByName}
                  {" · "}
                  {new Date(
                    update.createdAt,
                  )
                    .toLocaleString()}
                </small>
              </article>
            ),
          )}

          {detail.progressUpdates.length ===
          0 ? (
            <div className="execution-empty">
              No progress evidence has
              been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      canReportOutcome ? (
        <form
          className="panel"
          onSubmit={submitOutcome}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Outcome evidence
              </span>

              <h2>
                Report contribution
              </h2>
            </div>
          </div>

          <div className="execution-progress-form">
            <label className="request-field">
              <span>
                Reported contribution points
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

            <label className="request-field execution-form-wide">
              <span>
                Outcome evidence
              </span>

              <textarea
                required
                rows={6}
                value={outcomeEvidence}
                onChange={
                  event =>
                    setOutcomeEvidence(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="execution-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !outcomeEvidence.trim()
              }
            >
              Submit outcome report
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Value realization evidence
            </span>

            <h2>
              Outcome reports
            </h2>
          </div>
        </div>

        <div className="execution-outcome-list">
          {detail.outcomes.map(
            outcome => (
              <article
                key={outcome.id}
              >
                <div className="execution-outcome-heading">
                  <div>
                    <strong>
                      Reported
                      {" "}
                      {outcome.reportedContributionPoints.toFixed(
                        1,
                      )}
                      {" pts"}
                    </strong>

                    <span>
                      {outcome.validationDecision
                        ? readable(
                            outcome.validationDecision,
                          )
                        : "Awaiting validation"}
                    </span>
                  </div>

                  {outcome.validatedContributionPoints !==
                  null ? (
                    <div>
                      <span>
                        Validated
                      </span>

                      <strong>
                        {outcome.validatedContributionPoints.toFixed(
                          1,
                        )}
                        {" pts"}
                      </strong>
                    </div>
                  ) : null}
                </div>

                <p>
                  {outcome.evidenceNote}
                </p>

                <small>
                  Reported by
                  {" "}
                  {outcome.reportedByName}
                  {" · "}
                  {new Date(
                    outcome.reportedAt,
                  )
                    .toLocaleString()}
                </small>

                {outcome.validationNote ? (
                  <div className="execution-validation-note">
                    <strong>
                      Validation decision
                    </strong>

                    <p>
                      {outcome.validationNote}
                    </p>

                    <small>
                      {outcome.validatedByName}
                    </small>
                  </div>
                ) : null}

                {canValidate &&
                outcome.validationDecision ===
                  null ? (
                  <div className="execution-validation-control">
                    <label className="request-field">
                      <span>
                        Validated contribution
                      </span>

                      <input
                        type="number"
                        min="0"
                        max={outcome.reportedContributionPoints}
                        step="0.1"
                        value={
                          validationPoints[
                            outcome.id
                          ]
                          ??
                          outcome.reportedContributionPoints
                        }
                        onChange={
                          event =>
                            setValidationPoints(
                              current => ({
                                ...current,
                                [outcome.id]:
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
                            outcome.id
                          ]
                          ??
                          ""
                        }
                        onChange={
                          event =>
                            setValidationNotes(
                              current => ({
                                ...current,
                                [outcome.id]:
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
                            outcome.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void validateOutcome(
                            outcome.id,
                            "VALIDATED",
                            outcome.reportedContributionPoints,
                          )
                      }
                    >
                      Validate
                    </button>

                    <button
                      type="button"
                      className="execution-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          validationNotes[
                            outcome.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void validateOutcome(
                            outcome.id,
                            "REJECTED",
                            outcome.reportedContributionPoints,
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

          {detail.outcomes.length ===
          0 ? (
            <div className="execution-empty">
              No outcome report has been
              submitted.
            </div>
          ) : null}
        </div>
      </section>

      <section className="execution-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Planned ≠ reported ≠ validated
          </strong>

          <p>
            The roadmap contribution is
            the plan. An execution owner
            may later report an outcome,
            but only an explicit manager
            validation can create
            validated contribution.
          </p>
        </div>
      </section>
    </div>
  );
}
