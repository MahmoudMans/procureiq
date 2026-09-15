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
  closeInvestmentPerformanceCase,
  getInvestmentPerformanceCase,
  recordInvestmentPerformanceObservation,
  reviewInvestmentPerformanceCase,
  submitInvestmentPerformanceForReview,
  validateInvestmentPerformanceObservation,
} from "@/lib/api";

import type {
  InvestmentPerformanceCaseDetail,
  InvestmentPerformanceReviewDecision,
  InvestmentPerformanceValidationDecision,
} from "@/types/investment-performance";

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

export default function InvestmentPerformanceCasePage() {
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
      InvestmentPerformanceCaseDetail |
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
    useState<InvestmentPerformanceReviewDecision>(
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

    getInvestmentPerformanceCase(
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

          setReportedAnnualValue(
            response.performanceCase.baselineDurableAnnualValueAmount,
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
                : "Unable to load investment-performance case.",
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
      Promise<InvestmentPerformanceCaseDetail>,
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
        recordInvestmentPerformanceObservation(
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
      InvestmentPerformanceValidationDecision,
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
        validateInvestmentPerformanceObservation(
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
          : "Unable to validate realized-value observation.",
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
        submitInvestmentPerformanceForReview(
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
          : "Unable to submit investment-performance case.",
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
        reviewInvestmentPerformanceCase(
          params.id,
          {
            decision:
              reviewDecision,
            decisionNote:
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
          : "Unable to record investment-performance review.",
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
        closeInvestmentPerformanceCase(
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
          : "Unable to close investment-performance case.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading investment-performance case...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/investment-performance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Investment performance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Investment-performance case not found."}
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
      "IN_REMEDIATION";

  return (
    <div className="page-stack">
      <Link
        href="/investment-performance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Investment performance
      </Link>

      <section className="investment-performance-detail-heading">
        <div>
          <span className="eyebrow">
            Realized investment economics
          </span>

          <h1>
            {performanceCase.initiativeTitle}
          </h1>

          <p>
            {performanceCase.performanceCaseNumber}
            {" · "}
            {performanceCase.fundingCommitmentNumber}
            {" · "}
            {performanceCase.valueCaseNumber}
          </p>
        </div>

        <span
          className={
            `investment-performance-health investment-performance-health--${performanceCase.health.toLowerCase().replaceAll("_", "-")}`
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

      <section className="investment-performance-detail-grid">
        <article>
          <span>
            Step 56 baseline ROI
          </span>

          <strong>
            {performanceCase.baselineRoiPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article className="investment-performance-score-card">
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
            Funding variance
          </span>

          <strong>
            {performanceCase.assessed
              ? `${performanceCase.fundingVariancePct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Capital efficiency
          </span>

          <strong>
            {performanceCase.assessed
              ? `${performanceCase.capitalEfficiencyMultiple.toFixed(2)}x`
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
      </section>

      <section className="investment-performance-value-grid">
        <article>
          <span>
            Step 58 current released
          </span>

          <strong>
            {money(
              performanceCase.currentReleasedCapitalAmount,
              performanceCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Assessed released capital
          </span>

          <strong>
            {money(
              performanceCase.assessedReleasedCapitalAmount,
              performanceCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Baseline durable value
          </span>

          <strong>
            {money(
              performanceCase.baselineDurableHorizonValueAmount,
              performanceCase.currency,
            )}
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
            Release %
          </span>

          <strong>
            {performanceCase.currentReleasePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Baseline vs realized
            </span>

            <h2>
              Investment authority bridge
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p className="investment-performance-objective">
          {performanceCase.performanceObjective}
        </p>

        <div className="investment-performance-context-grid">
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
              Baseline investment
            </span>

            <strong>
              {money(
                performanceCase.baselineInvestmentCostAmount,
                performanceCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Annual operating cost
            </span>

            <strong>
              {money(
                performanceCase.baselineAnnualOperatingCostAmount,
                performanceCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Value horizon
            </span>

            <strong>
              {performanceCase.valueHorizonMonths}
              {" months"}
            </strong>
          </div>

          <div>
            <span>
              Baseline annual value
            </span>

            <strong>
              {money(
                performanceCase.baselineAnnualizedValueAmount,
                performanceCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Validated realized annual value
            </span>

            <strong>
              {performanceCase.assessed
                ? money(
                    performanceCase.validatedRealizedAnnualizedValueAmount,
                    performanceCase.currency,
                  )
                : "—"}
            </strong>
          </div>
        </div>
      </section>

      <div className="investment-performance-source-links">
        <Link
          href={
            `/funding-execution/${performanceCase.fundingCommitmentId}`
          }
          className="table-action"
        >
          Step 58 funding evidence
        </Link>

        <Link
          href={
            `/strategic-value/${performanceCase.valueCaseId}`
          }
          className="table-action"
        >
          Step 56 ROI baseline
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
                Post-funding evidence
              </span>

              <h2>
                Record realized-value observation
              </h2>
            </div>
          </div>

          <div className="investment-performance-observation-form">
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
                Reported realized annualized value
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

            <label className="request-field investment-performance-form-wide">
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

          <div className="investment-performance-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
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
              Realized-value evidence
            </span>

            <h2>
              Observations
            </h2>
          </div>
        </div>

        <div className="investment-performance-observation-list">
          {detail.observations.map(
            observation => (
              <article
                key={observation.id}
              >
                <div className="investment-performance-observation-heading">
                  <div>
                    <strong>
                      {money(
                        observation.reportedRealizedAnnualizedValueAmount,
                        performanceCase.currency,
                      )}
                      {" reported"}
                    </strong>

                    <span>
                      {observation.observedOn}
                      {" · "}
                      {observation.releasePctSnapshot.toFixed(
                        1,
                      )}
                      {"% funding released"}
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
                  Capital snapshot:
                  {" "}
                  {money(
                    observation.releasedCapitalSnapshot,
                    performanceCase.currency,
                  )}
                  {" · "}
                  {observation.reportedByName}
                </small>

                {observation.validationNote ? (
                  <div className="investment-performance-validation-note">
                    <strong>
                      Validation
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
                  <div className="investment-performance-validation-control">
                    <label className="request-field">
                      <span>
                        Validated realized annual value
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
                      className="investment-performance-danger-button"
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
            <div className="investment-performance-empty">
              No realized-value observation
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
                Governance gate
              </span>

              <h2>
                Submit performance review
              </h2>
            </div>
          </div>

          <div className="investment-performance-form-actions">
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
                Independent investment review
              </span>

              <h2>
                Performance decision
              </h2>
            </div>
          </div>

          <div className="investment-performance-review-form">
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
                        InvestmentPerformanceReviewDecision,
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

            <label className="request-field investment-performance-form-wide">
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

          <div className="investment-performance-form-actions">
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
              Immutable governance decisions
            </span>

            <h2>
              Performance review history
            </h2>
          </div>
        </div>

        <div className="investment-performance-decision-list">
          {detail.decisions.map(
            decision => (
              <article
                key={decision.id}
              >
                <div>
                  <strong>
                    {readable(
                      decision.decision,
                    )}
                  </strong>

                  <span>
                    {readable(
                      decision.health,
                    )}
                    {" · ROI "}
                    {decision.realizedRoiPct.toFixed(
                      1,
                    )}
                    {"% · variance "}
                    {decision.roiVariancePct.toFixed(
                      1,
                    )}
                    {" pts"}
                  </span>
                </div>

                <p>
                  {decision.decisionNote}
                </p>

                <small>
                  Efficiency
                  {" "}
                  {decision.capitalEfficiencyMultiple.toFixed(
                    2,
                  )}
                  {"x · "}
                  {decision.decidedByName}
                  {" · "}
                  {new Date(
                    decision.decidedAt,
                  )
                    .toLocaleString()}
                </small>
              </article>
            ),
          )}

          {detail.decisions.length ===
          0 ? (
            <div className="investment-performance-empty">
              No performance review
              decision recorded.
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

          <div className="investment-performance-form-actions">
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

      <section className="investment-performance-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Underperformance never rewrites approved ROI assumptions
          </strong>

          <p>
            Step 56 remains the approved
            investment case and Step 58
            remains the funding-release
            authority. Step 59 records
            separate realized economics
            and immutable review decisions.
          </p>
        </div>
      </section>
    </div>
  );
}
