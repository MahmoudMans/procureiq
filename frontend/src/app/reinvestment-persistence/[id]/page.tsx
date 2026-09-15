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
  closeReinvestmentPersistenceCase,
  getReinvestmentPersistenceCase,
  recordReinvestmentPersistenceObservation,
  reviewReinvestmentPersistenceCase,
  submitReinvestmentPersistenceForReview,
  validateReinvestmentPersistenceObservation,
} from "@/lib/api";

import type {
  ReinvestmentPersistenceCaseDetail,
  ReinvestmentPersistenceReviewDecision,
  ReinvestmentPersistenceValidationDecision,
} from "@/types/reinvestment-persistence";

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

function money(
  value: number,
  currency: string,
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${currency}`;
}

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function ReinvestmentPersistenceCasePage() {
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
      ReinvestmentPersistenceCaseDetail |
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
    currentAnnualValue,
    setCurrentAnnualValue,
  ] =
    useState(0);

  const [
    evidence,
    setEvidence,
  ] =
    useState("");

  const [
    validationValues,
    setValidationValues,
  ] =
    useState<
      Record<
        string,
        number
      >
    >({});

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
    reviewDecision,
    setReviewDecision,
  ] =
    useState<ReinvestmentPersistenceReviewDecision>(
      "SUSTAINED",
    );

  const [
    reviewNote,
    setReviewNote,
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

  const canFinalize =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getReinvestmentPersistenceCase(
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

          setCurrentAnnualValue(
            response.persistenceCase.baselineValidatedAnnualizedValueAmount,
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
                : "Unable to load reinvestment-persistence case.",
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

  async function apply(
    promise:
      Promise<ReinvestmentPersistenceCaseDetail>,
  ) {
    setDetail(
      await promise,
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

      await apply(
        recordReinvestmentPersistenceObservation(
          params.id,
          {
            observedOn,
            reportedCurrentAnnualizedValueAmount:
              currentAnnualValue,
            evidenceNote:
              evidence.trim(),
          },
        ),
      );

      setEvidence("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record persistence evidence.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function validateObservation(
    observationId: string,
    decision:
      ReinvestmentPersistenceValidationDecision,
    reportedValue: number,
  ) {
    const note =
      validationNotes[
        observationId
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

      await apply(
        validateReinvestmentPersistenceObservation(
          observationId,
          {
            decision,

            validatedCurrentAnnualizedValueAmount:
              decision ===
                "VALIDATED"
                ? (
                    validationValues[
                      observationId
                    ]
                    ??
                    reportedValue
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
          : "Unable to validate persistence evidence.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitForReview() {
    try {
      setRunning(true);
      setError(null);

      await apply(
        submitReinvestmentPersistenceForReview(
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
          : "Unable to submit persistence case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function reviewCase() {
    if (!reviewNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        reviewReinvestmentPersistenceCase(
          params.id,
          {
            decision:
              reviewDecision,

            reviewNote:
              reviewNote.trim(),
          },
        ),
      );

      setReviewNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record persistence review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeCase() {
    if (!closeNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        closeReinvestmentPersistenceCase(
          params.id,
          closeNote.trim(),
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
          : "Unable to close persistence case.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading reinvestment persistence...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/reinvestment-persistence"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Reinvestment persistence
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Reinvestment-persistence case not found."}
        </div>
      </div>
    );
  }

  const persistenceCase =
    detail.persistenceCase;

  const mutable =
    persistenceCase.status ===
      "ACTIVE"
    ||
    persistenceCase.status ===
      "REMEDIATION_REQUIRED";

  return (
    <div className="page-stack">
      <Link
        href="/reinvestment-persistence"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Reinvestment persistence
      </Link>

      <section className="rpersist-detail-heading">
        <div>
          <span className="eyebrow">
            Durable recycled-capital value
          </span>

          <h1>
            {persistenceCase.targetInitiativeTitle}
          </h1>

          <p>
            {persistenceCase.persistenceCaseNumber}
            {" · "}
            {persistenceCase.sourcePerformanceCaseNumber}
            {" · "}
            {persistenceCase.redeploymentNumber}
          </p>
        </div>

        <span
          className={
            `rpersist-health rpersist-health--${persistenceCase.health.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            persistenceCase.health,
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

      <section className="rpersist-detail-grid">
        <article>
          <span>
            Value persistence
          </span>

          <strong>
            {persistenceCase.assessed
              ? `${persistenceCase.valuePersistencePct.toFixed(1)}%`
              : "Unassessed"}
          </strong>
        </article>

        <article>
          <span>
            Efficiency retention
          </span>

          <strong>
            {persistenceCase.assessed
              ? `${persistenceCase.efficiencyRetentionPct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article className="rpersist-score-card">
          <span>
            Projected ROI
          </span>

          <strong>
            {persistenceCase.assessed
              ? `${persistenceCase.currentProjectedRoiPct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            ROI variance
          </span>

          <strong>
            {persistenceCase.assessed
              ? `${persistenceCase.roiVariancePct.toFixed(1)} pts`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Compounding value
          </span>

          <strong>
            {persistenceCase.assessed
              ? money(
                  persistenceCase.compoundingValueAmount,
                  persistenceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Decayed value
          </span>

          <strong>
            {persistenceCase.assessed
              ? money(
                  persistenceCase.decayedValueAmount,
                  persistenceCase.currency,
                )
              : "—"}
          </strong>
        </article>
      </section>

      <section className="rpersist-value-grid">
        <article>
          <span>
            Baseline annual value
          </span>

          <strong>
            {money(
              persistenceCase.baselineValidatedAnnualizedValueAmount,
              persistenceCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current annual value
          </span>

          <strong>
            {persistenceCase.assessed
              ? money(
                  persistenceCase.currentValidatedAnnualizedValueAmount,
                  persistenceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Baseline horizon value
          </span>

          <strong>
            {money(
              persistenceCase.baselineRealizedHorizonValueAmount,
              persistenceCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current projected horizon
          </span>

          <strong>
            {persistenceCase.assessed
              ? money(
                  persistenceCase.currentProjectedHorizonValueAmount,
                  persistenceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Baseline net value
          </span>

          <strong>
            {money(
              persistenceCase.baselineRealizedNetValueAmount,
              persistenceCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current projected net
          </span>

          <strong>
            {persistenceCase.assessed
              ? money(
                  persistenceCase.currentProjectedNetValueAmount,
                  persistenceCase.currency,
                )
              : "—"}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Recycling-effectiveness baseline
            </span>

            <h2>
              Governance thresholds
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p className="rpersist-objective">
          {persistenceCase.persistenceObjective}
        </p>

        <div className="rpersist-context-grid">
          <div>
            <span>
              Owner
            </span>

            <strong>
              {persistenceCase.persistenceOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Observation window
            </span>

            <strong>
              {persistenceCase.persistenceObservationWindowMonths}
              {" months"}
            </strong>
          </div>

          <div>
            <span>
              Minimum persistence
            </span>

            <strong>
              {persistenceCase.minimumValuePersistencePct.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Minimum efficiency
            </span>

            <strong>
              {persistenceCase.minimumEfficiencyRetentionPct.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Baseline efficiency
            </span>

            <strong>
              {persistenceCase.baselineCapitalEfficiencyMultiple.toFixed(
                2,
              )}
              x
            </strong>
          </div>

          <div>
            <span>
              Current efficiency
            </span>

            <strong>
              {persistenceCase.assessed
                ? `${persistenceCase.currentCapitalEfficiencyMultiple.toFixed(2)}x`
                : "—"}
            </strong>
          </div>
        </div>
      </section>

      <div className="rpersist-source-links">
        <Link
          href={
            `/reinvestment-performance/${persistenceCase.sourcePerformanceCaseId}`
          }
          className="table-action"
        >
          Step 64 performance baseline
        </Link>

        <Link
          href={
            `/capital-redeployment/${persistenceCase.redeploymentCaseId}`
          }
          className="table-action"
        >
          Step 63 redeployment
        </Link>

        <Link
          href={
            `/strategic-value/${persistenceCase.targetValueCaseId}`
          }
          className="table-action"
        >
          Target value case
        </Link>
      </div>

      {canManage &&
      mutable ? (
        <form
          className="panel"
          onSubmit={recordObservation}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Longitudinal outcome evidence
              </span>

              <h2>
                Record persistence observation
              </h2>
            </div>
          </div>

          <div className="rpersist-observation-form">
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
                Current annualized value
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={currentAnnualValue}
                onChange={
                  event =>
                    setCurrentAnnualValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field rpersist-form-wide">
              <span>
                Evidence
              </span>

              <textarea
                required
                rows={5}
                value={evidence}
                onChange={
                  event =>
                    setEvidence(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="rpersist-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                currentAnnualValue <
                  0
                ||
                !evidence.trim()
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
              Immutable persistence evidence
            </span>

            <h2>
              Observation history
            </h2>
          </div>
        </div>

        <div className="rpersist-observation-list">
          {detail.observations.map(
            observation => (
              <article
                key={observation.id}
              >
                <div className="rpersist-observation-heading">
                  <div>
                    <strong>
                      {money(
                        observation.reportedCurrentAnnualizedValueAmount,
                        persistenceCase.currency,
                      )}
                    </strong>

                    <span>
                      {observation.observedOn}
                    </span>
                  </div>

                  <span>
                    {observation.validationDecision
                      ? readable(
                          observation.validationDecision,
                        )
                      : "Awaiting validation"}
                  </span>
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
                  <div className="rpersist-validation-note">
                    <strong>
                      Independent validation
                    </strong>

                    <p>
                      {observation.validationNote}
                    </p>

                    <small>
                      {observation.validatedByName}
                      {" · "}
                      {observation.validatedCurrentAnnualizedValueAmount !==
                      null
                        ? money(
                            observation.validatedCurrentAnnualizedValueAmount,
                            persistenceCase.currency,
                          )
                        : "Rejected"}
                    </small>
                  </div>
                ) : null}

                {canFinalize &&
                mutable &&
                observation.validationDecision ===
                  null ? (
                  <div className="rpersist-validation-control">
                    <label className="request-field">
                      <span>
                        Validated value
                      </span>

                      <input
                        type="number"
                        min="0"
                        max={observation.reportedCurrentAnnualizedValueAmount}
                        step="0.01"
                        value={
                          validationValues[
                            observation.id
                          ]
                          ??
                          observation.reportedCurrentAnnualizedValueAmount
                        }
                        onChange={
                          event =>
                            setValidationValues(
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
                      disabled={running}
                      onClick={
                        () =>
                          void validateObservation(
                            observation.id,
                            "VALIDATED",
                            observation.reportedCurrentAnnualizedValueAmount,
                          )
                      }
                    >
                      Validate
                    </button>

                    <button
                      type="button"
                      className="rpersist-danger-button"
                      disabled={running}
                      onClick={
                        () =>
                          void validateObservation(
                            observation.id,
                            "REJECTED",
                            observation.reportedCurrentAnnualizedValueAmount,
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
            <div className="rpersist-empty">
              No persistence observation
              has been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      mutable &&
      persistenceCase.assessed ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Sustainability gate
              </span>

              <h2>
                Submit persistence assessment
              </h2>
            </div>
          </div>

          <div className="rpersist-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitForReview()
              }
            >
              Submit for review
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      persistenceCase.status ===
        "READY_FOR_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent persistence review
              </span>

              <h2>
                Sustainability decision
              </h2>
            </div>
          </div>

          <div className="rpersist-review-form">
            <label className="request-field">
              <span>
                Decision
              </span>

              <select
                value={reviewDecision}
                onChange={
                  event =>
                    setReviewDecision(
                      event.target.value as
                        ReinvestmentPersistenceReviewDecision,
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

            <label className="request-field rpersist-form-wide">
              <span>
                Review rationale
              </span>

              <textarea
                rows={5}
                value={reviewNote}
                onChange={
                  event =>
                    setReviewNote(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="rpersist-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !reviewNote.trim()
              }
              onClick={
                () =>
                  void reviewCase()
              }
            >
              Record persistence decision
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable sustainability decisions
            </span>

            <h2>
              Review history
            </h2>
          </div>
        </div>

        <div className="rpersist-review-list">
          {detail.reviews.map(
            review => (
              <article
                key={review.id}
              >
                <div>
                  <strong>
                    {readable(
                      review.decision,
                    )}
                  </strong>

                  <span>
                    {readable(
                      review.health,
                    )}
                    {" · persistence "}
                    {review.valuePersistencePct.toFixed(
                      1,
                    )}
                    {"% · efficiency "}
                    {review.efficiencyRetentionPct.toFixed(
                      1,
                    )}
                    %
                  </span>
                </div>

                <p>
                  {review.reviewNote}
                </p>

                <small>
                  Projected ROI
                  {" "}
                  {review.currentProjectedRoiPct.toFixed(
                    1,
                  )}
                  {"% · ROI variance "}
                  {review.roiVariancePct.toFixed(
                    1,
                  )}
                  {" pts · "}
                  {review.reviewedByName}
                </small>
              </article>
            ),
          )}

          {detail.reviews.length ===
          0 ? (
            <div className="rpersist-empty">
              No persistence review has
              been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canFinalize &&
      persistenceCase.status ===
        "SUSTAINED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance closure
              </span>

              <h2>
                Close persistence case
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

          <div className="rpersist-form-actions">
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
                  void closeCase()
              }
            >
              Close persistence case
            </button>
          </div>
        </section>
      ) : null}

      <section className="rpersist-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Recycling effectiveness is measured through durable value, not repeated money movement
          </strong>

          <p>
            Compounding means the
            validated outcome now exceeds
            its Step 64 value baseline
            while retaining or improving
            recycled-capital efficiency.
            Regression creates remediation
            evidence rather than rewriting
            upstream history.
          </p>
        </div>
      </section>
    </div>
  );
}
