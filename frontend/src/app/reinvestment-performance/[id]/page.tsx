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
  closeReinvestmentPerformanceCase,
  getReinvestmentPerformanceCase,
  recordReinvestmentPerformanceObservation,
  reviewReinvestmentPerformanceCase,
  submitReinvestmentPerformanceForReview,
  validateReinvestmentPerformanceObservation,
} from "@/lib/api";

import type {
  ReinvestmentPerformanceCaseDetail,
  ReinvestmentPerformanceReviewDecision,
  ReinvestmentPerformanceValidationDecision,
} from "@/types/reinvestment-performance";

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

export default function ReinvestmentPerformanceCasePage() {
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
      ReinvestmentPerformanceCaseDetail |
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
    reportedAnnualValue,
    setReportedAnnualValue,
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
    useState<ReinvestmentPerformanceReviewDecision>(
      "CONFIRMED",
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

    getReinvestmentPerformanceCase(
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

          const horizonYears =
            response.performanceCase.measurementHorizonMonths /
            12;

          if (
            horizonYears >
            0
          ) {
            setReportedAnnualValue(
              response.performanceCase.expectedHorizonValueAmount /
                horizonYears,
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
                : "Unable to load reinvestment-performance case.",
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
      Promise<ReinvestmentPerformanceCaseDetail>,
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
        recordReinvestmentPerformanceObservation(
          params.id,
          {
            observedOn,
            reportedRealizedAnnualizedValueAmount:
              reportedAnnualValue,
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
          : "Unable to record realized-value observation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function validateObservation(
    observationId: string,
    decision:
      ReinvestmentPerformanceValidationDecision,
    reportedAmount: number,
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
        validateReinvestmentPerformanceObservation(
          observationId,
          {
            decision,
            validatedRealizedAnnualizedValueAmount:
              decision ===
                "VALIDATED"
                ? (
                    validationValues[
                      observationId
                    ]
                    ??
                    reportedAmount
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
          : "Unable to validate realized-value evidence.",
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
        submitReinvestmentPerformanceForReview(
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
          : "Unable to submit performance case.",
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
        reviewReinvestmentPerformanceCase(
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
          : "Unable to record performance review.",
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
        closeReinvestmentPerformanceCase(
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
          : "Unable to close performance case.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading reinvestment performance...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/reinvestment-performance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Reinvestment performance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Reinvestment-performance case not found."}
        </div>
      </div>
    );
  }

  const performanceCase =
    detail.performanceCase;

  const mutable =
    performanceCase.status ===
      "ACTIVE"
    ||
    performanceCase.status ===
      "REMEDIATION_REQUIRED";

  return (
    <div className="page-stack">
      <Link
        href="/reinvestment-performance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Reinvestment performance
      </Link>

      <section className="reinvestment-performance-detail-heading">
        <div>
          <span className="eyebrow">
            Post-redeployment value realization
          </span>

          <h1>
            {performanceCase.targetInitiativeTitle}
          </h1>

          <p>
            {performanceCase.performanceCaseNumber}
            {" · "}
            {performanceCase.redeploymentNumber}
            {" · "}
            {performanceCase.targetValueCaseNumber}
          </p>
        </div>

        <span
          className={
            `reinvestment-performance-health reinvestment-performance-health--${performanceCase.health.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            performanceCase.health,
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

      <section className="reinvestment-performance-detail-grid">
        <article>
          <span>
            Target ROI
          </span>

          <strong>
            {performanceCase.baselineTargetRoiPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article className="reinvestment-performance-score-card">
          <span>
            Realized ROI
          </span>

          <strong>
            {performanceCase.assessed
              ? `${performanceCase.realizedRoiPct.toFixed(1)}%`
              : "Unassessed"}
          </strong>
        </article>

        <article>
          <span>
            ROI variance
          </span>

          <strong>
            {performanceCase.assessed
              ? `${performanceCase.roiVariancePct.toFixed(1)} pts`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Realization
          </span>

          <strong>
            {performanceCase.assessed
              ? `${performanceCase.realizationPct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Value variance
          </span>

          <strong>
            {performanceCase.assessed
              ? money(
                  performanceCase.valueVarianceAmount,
                  performanceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Target health
          </span>

          <strong>
            {readable(
              performanceCase.currentTargetValueHealth,
            )}
          </strong>
        </article>
      </section>

      <section className="reinvestment-performance-value-grid">
        <article>
          <span>
            Redeployed capital
          </span>

          <strong>
            {money(
              performanceCase.redeployedCapitalAmount,
              performanceCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Total cost
          </span>

          <strong>
            {performanceCase.assessed
              ? money(
                  performanceCase.totalCostAmount,
                  performanceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Expected horizon value
          </span>

          <strong>
            {performanceCase.assessed
              ? money(
                  performanceCase.expectedHorizonValueAmount,
                  performanceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Realized horizon value
          </span>

          <strong>
            {performanceCase.assessed
              ? money(
                  performanceCase.realizedHorizonValueAmount,
                  performanceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Realized net value
          </span>

          <strong>
            {performanceCase.assessed
              ? money(
                  performanceCase.realizedNetValueAmount,
                  performanceCase.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Validated annual value
          </span>

          <strong>
            {performanceCase.assessed
              ? money(
                  performanceCase.validatedRealizedAnnualizedValueAmount,
                  performanceCase.currency,
                )
              : "—"}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Measurement methodology
            </span>

            <h2>
              Realization baseline
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p className="reinvestment-performance-objective">
          {performanceCase.performanceObjective}
        </p>

        <div className="reinvestment-performance-context-grid">
          <div>
            <span>
              Owner
            </span>

            <strong>
              {performanceCase.performanceOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Measurement horizon
            </span>

            <strong>
              {performanceCase.measurementHorizonMonths}
              {" months"}
            </strong>
          </div>

          <div>
            <span>
              Annual operating cost
            </span>

            <strong>
              {money(
                performanceCase.annualOperatingCostAmount,
                performanceCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Target persistence
            </span>

            <strong>
              {performanceCase.baselineTargetPersistencePct.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Frozen target net value
            </span>

            <strong>
              {money(
                performanceCase.baselineTargetNetValueAmount,
                performanceCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Operating-cost horizon
            </span>

            <strong>
              {performanceCase.assessed
                ? money(
                    performanceCase.operatingCostHorizonAmount,
                    performanceCase.currency,
                  )
                : "Pending assessment"}
            </strong>
          </div>
        </div>
      </section>

      <div className="reinvestment-performance-source-links">
        <Link
          href={
            `/capital-redeployment/${performanceCase.redeploymentCaseId}`
          }
          className="table-action"
        >
          Step 63 redeployment evidence
        </Link>

        <Link
          href={
            `/strategic-value/${performanceCase.targetValueCaseId}`
          }
          className="table-action"
        >
          Step 56 target authority
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
                Outcome evidence
              </span>

              <h2>
                Record realized value
              </h2>
            </div>
          </div>

          <div className="reinvestment-performance-observation-form">
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
                Reported attributable annualized value
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={reportedAnnualValue}
                onChange={
                  event =>
                    setReportedAnnualValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field reinvestment-performance-form-wide">
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

          <div className="reinvestment-performance-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                reportedAnnualValue <
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
              Immutable outcome evidence
            </span>

            <h2>
              Observations
            </h2>
          </div>
        </div>

        <div className="reinvestment-performance-observation-list">
          {detail.observations.map(
            observation => (
              <article
                key={observation.id}
              >
                <div className="reinvestment-performance-observation-heading">
                  <div>
                    <strong>
                      {money(
                        observation.reportedRealizedAnnualizedValueAmount,
                        performanceCase.currency,
                      )}
                      {" annualized"}
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
                  <div className="reinvestment-performance-validation-note">
                    <strong>
                      Independent validation
                    </strong>

                    <p>
                      {observation.validationNote}
                    </p>

                    <small>
                      {observation.validatedByName}
                      {" · "}
                      {observation.validatedRealizedAnnualizedValueAmount !==
                      null
                        ? money(
                            observation.validatedRealizedAnnualizedValueAmount,
                            performanceCase.currency,
                          )
                        : "Rejected"}
                    </small>
                  </div>
                ) : null}

                {canFinalize &&
                mutable &&
                observation.validationDecision ===
                  null ? (
                  <div className="reinvestment-performance-validation-control">
                    <label className="request-field">
                      <span>
                        Validated annualized value
                      </span>

                      <input
                        type="number"
                        min="0"
                        max={observation.reportedRealizedAnnualizedValueAmount}
                        step="0.01"
                        value={
                          validationValues[
                            observation.id
                          ]
                          ??
                          observation.reportedRealizedAnnualizedValueAmount
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
                            observation.reportedRealizedAnnualizedValueAmount,
                          )
                      }
                    >
                      Validate
                    </button>

                    <button
                      type="button"
                      className="reinvestment-performance-danger-button"
                      disabled={running}
                      onClick={
                        () =>
                          void validateObservation(
                            observation.id,
                            "REJECTED",
                            observation.reportedRealizedAnnualizedValueAmount,
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
            <div className="reinvestment-performance-empty">
              No post-redeployment value
              observation has been
              recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      mutable &&
      performanceCase.assessed ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Review gate
              </span>

              <h2>
                Submit performance assessment
              </h2>
            </div>
          </div>

          <div className="reinvestment-performance-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitForReview()
              }
            >
              Submit for independent review
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      performanceCase.status ===
        "READY_FOR_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent value review
              </span>

              <h2>
                Performance decision
              </h2>
            </div>
          </div>

          <div className="reinvestment-performance-review-form">
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
                        ReinvestmentPerformanceReviewDecision,
                    )
                }
              >
                <option value="CONFIRMED">
                  Confirm performance
                </option>

                <option value="REMEDIATION_REQUIRED">
                  Remediation required
                </option>
              </select>
            </label>

            <label className="request-field reinvestment-performance-form-wide">
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

          <div className="reinvestment-performance-form-actions">
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
              Record performance decision
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable performance reviews
            </span>

            <h2>
              Review history
            </h2>
          </div>
        </div>

        <div className="reinvestment-performance-review-list">
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
                    {" · ROI "}
                    {review.realizedRoiPct.toFixed(
                      1,
                    )}
                    {"% · realization "}
                    {review.realizationPct.toFixed(
                      1,
                    )}
                    %
                  </span>
                </div>

                <p>
                  {review.reviewNote}
                </p>

                <small>
                  ROI variance
                  {" "}
                  {review.roiVariancePct.toFixed(
                    1,
                  )}
                  {" pts · value variance "}
                  {money(
                    review.valueVarianceAmount,
                    performanceCase.currency,
                  )}
                  {" · "}
                  {review.reviewedByName}
                </small>
              </article>
            ),
          )}

          {detail.reviews.length ===
          0 ? (
            <div className="reinvestment-performance-empty">
              No performance review has
              been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canFinalize &&
      performanceCase.status ===
        "VERIFIED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance closure
              </span>

              <h2>
                Close performance case
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

          <div className="reinvestment-performance-form-actions">
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
              Close performance case
            </button>
          </div>
        </section>
      ) : null}

      <section className="reinvestment-performance-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Underperformance creates remediation evidence, not retroactive investment edits
          </strong>

          <p>
            Step 64 can identify weak
            post-redeployment value and
            require remediation, but it
            never changes Step 63 release
            history or Step 56 target
            economics.
          </p>
        </div>
      </section>
    </div>
  );
}
