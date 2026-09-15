"use client";

import {
  ArrowLeft,
  CircleAlert,
  Goal,
  RefreshCcw,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  appendCapitalFlywheelCycle,
  closeCapitalFlywheelLineage,
  getCapitalFlywheelLineage,
  reviewCapitalFlywheelLineage,
} from "@/lib/api";

import type {
  CapitalFlywheelLineageDetail,
  CapitalFlywheelReviewDecision,
} from "@/types/capital-flywheel";

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

export default function CapitalFlywheelLineagePage() {
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
      CapitalFlywheelLineageDetail |
      null
    >(null);

  const [
    candidateId,
    setCandidateId,
  ] =
    useState("");

  const [
    relationshipRationale,
    setRelationshipRationale,
  ] =
    useState("");

  const [
    reviewDecision,
    setReviewDecision,
  ] =
    useState<CapitalFlywheelReviewDecision>(
      "CONTINUE_APPROVED",
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

    getCapitalFlywheelLineage(
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

          if (
            response.availableCandidates[0]
          ) {
            setCandidateId(
              response.availableCandidates[0].persistenceCaseId,
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
                : "Unable to load capital-flywheel lineage.",
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
      Promise<CapitalFlywheelLineageDetail>,
  ) {
    const response =
      await promise;

    setDetail(
      response,
    );

    if (
      response.availableCandidates[0]
    ) {
      setCandidateId(
        response.availableCandidates[0].persistenceCaseId,
      );
    }
  }

  async function appendCycle(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await apply(
        appendCapitalFlywheelCycle(
          params.id,
          {
            persistenceCaseId:
              candidateId,

            relationshipRationale:
              relationshipRationale.trim(),
          },
        ),
      );

      setRelationshipRationale("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to append flywheel cycle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function reviewLineage() {
    if (!reviewNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        reviewCapitalFlywheelLineage(
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
          : "Unable to record flywheel review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeLineage() {
    if (!closeNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        closeCapitalFlywheelLineage(
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
          : "Unable to close capital lineage.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading capital flywheel...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-flywheel"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital flywheel
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capital-flywheel lineage not found."}
        </div>
      </div>
    );
  }

  const lineage =
    detail.lineage;

  return (
    <div className="page-stack">
      <Link
        href="/capital-flywheel"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital flywheel
      </Link>

      <section className="flywheel-detail-heading">
        <div>
          <span className="eyebrow">
            Multi-cycle capital lineage
          </span>

          <h1>
            {lineage.rootTargetInitiativeTitle}
          </h1>

          <p>
            {lineage.lineageNumber}
            {" · original capital "}
            {money(
              lineage.originalCapitalAmount,
              lineage.currency,
            )}
          </p>
        </div>

        <span
          className={
            `flywheel-health flywheel-health--${lineage.flywheelHealth.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            lineage.flywheelHealth,
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

      <section className="flywheel-detail-grid">
        <article className="flywheel-score-card">
          <span>
            Cumulative value multiple
          </span>

          <strong>
            {lineage.cumulativeValueMultiple.toFixed(
              2,
            )}
            x
          </strong>
        </article>

        <article>
          <span>
            Latest marginal multiple
          </span>

          <strong>
            {lineage.latestMarginalValueMultiple.toFixed(
              2,
            )}
            x
          </strong>
        </article>

        <article>
          <span>
            Marginal retention
          </span>

          <strong>
            {lineage.latestMarginalNetValueRetentionPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Cycles
          </span>

          <strong>
            {lineage.cycleCount}
            {" / "}
            {lineage.maximumCycleCount}
          </strong>
        </article>

        <article>
          <span>
            Recommendation
          </span>

          <strong>
            {readable(
              lineage.recommendation,
            )}
          </strong>
        </article>

        <article>
          <span>
            Diminishing returns
          </span>

          <strong>
            {lineage.diminishingReturns
              ? "Detected"
              : "No"}
          </strong>
        </article>
      </section>

      <section className="flywheel-value-grid">
        <article>
          <span>
            Cumulative projected net value
          </span>

          <strong>
            {money(
              lineage.cumulativeProjectedNetValueAmount,
              lineage.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Cumulative compounding
          </span>

          <strong>
            {money(
              lineage.cumulativeCompoundingValueAmount,
              lineage.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Cumulative decay
          </span>

          <strong>
            {money(
              lineage.cumulativeDecayedValueAmount,
              lineage.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Status
          </span>

          <strong>
            {readable(
              lineage.status,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Flywheel policy
            </span>

            <h2>
              Economic continuation thresholds
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p className="flywheel-objective">
          {lineage.lineageObjective}
        </p>

        <div className="flywheel-context-grid">
          <div>
            <span>
              Owner
            </span>

            <strong>
              {lineage.lineageOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Minimum marginal multiple
            </span>

            <strong>
              {lineage.minimumMarginalValueMultiple.toFixed(
                2,
              )}
              x
            </strong>
          </div>

          <div>
            <span>
              Minimum efficiency retention
            </span>

            <strong>
              {lineage.minimumCycleEfficiencyRetentionPct.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Diminishing tolerance
            </span>

            <strong>
              {lineage.diminishingReturnTolerancePct.toFixed(
                1,
              )}
              %
            </strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable lineage evidence
            </span>

            <h2>
              Capital cycles
            </h2>
          </div>

          <RefreshCcw
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Initiative</th>
                <th>Fiscal year</th>
                <th>Capital</th>
                <th>Projected net</th>
                <th>ROI</th>
                <th>Persistence</th>
                <th>Efficiency</th>
                <th>Compounding</th>
                <th>Decay</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.cycles.map(
                cycle => (
                  <tr
                    key={cycle.id}
                  >
                    <td>
                      <strong>
                        #{cycle.cycleIndex}
                      </strong>
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {cycle.targetInitiativeTitle}
                        </strong>

                        <span>
                          {cycle.persistenceCaseNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {cycle.fiscalYear}
                    </td>

                    <td>
                      {money(
                        cycle.redeployedCapitalAmount,
                        lineage.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        cycle.projectedNetValueAmount,
                        lineage.currency,
                      )}
                    </td>

                    <td>
                      {cycle.projectedRoiPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {cycle.valuePersistencePct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {cycle.efficiencyRetentionPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        cycle.compoundingValueAmount,
                        lineage.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        cycle.decayedValueAmount,
                        lineage.currency,
                      )}
                    </td>

                    <td>
                      <Link
                        href={
                          `/reinvestment-persistence/${cycle.persistenceCaseId}`
                        }
                        className="table-action"
                      >
                        Evidence
                      </Link>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage &&
      lineage.status ===
        "APPROVED_FOR_NEXT_CYCLE"
      &&
      lineage.cycleCount <
        lineage.maximumCycleCount
      &&
      detail.availableCandidates.length >
        0 ? (
        <form
          className="panel"
          onSubmit={appendCycle}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Approved next-cycle authority
              </span>

              <h2>
                Append recycling cycle
              </h2>
            </div>
          </div>

          <div className="flywheel-cycle-form">
            <label className="request-field flywheel-form-wide">
              <span>
                Sustained Step 65 outcome
              </span>

              <select
                value={candidateId}
                onChange={
                  event =>
                    setCandidateId(
                      event.target.value,
                    )
                }
              >
                {detail.availableCandidates.map(
                  candidate => (
                    <option
                      key={candidate.persistenceCaseId}
                      value={candidate.persistenceCaseId}
                    >
                      {candidate.persistenceCaseNumber}
                      {" — "}
                      {candidate.targetInitiativeTitle}
                      {" · net "}
                      {money(
                        candidate.projectedNetValueAmount,
                        candidate.currency,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field flywheel-form-wide">
              <span>
                Capital-lineage relationship rationale
              </span>

              <textarea
                required
                rows={5}
                value={relationshipRationale}
                onChange={
                  event =>
                    setRelationshipRationale(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="flywheel-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !candidateId
                ||
                !relationshipRationale.trim()
              }
            >
              Append immutable cycle
            </button>
          </div>
        </form>
      ) : null}

      {canFinalize &&
      lineage.status ===
        "READY_FOR_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Economic continuation review
              </span>

              <h2>
                Govern next recycling cycle
              </h2>
            </div>
          </div>

          <div className="flywheel-review-callout">
            <span>
              Deterministic recommendation
            </span>

            <strong>
              {readable(
                lineage.recommendation,
              )}
            </strong>

            <p>
              Health:
              {" "}
              {readable(
                lineage.flywheelHealth,
              )}
              {" · cumulative value "}
              {lineage.cumulativeValueMultiple.toFixed(
                2,
              )}
              {"x · marginal value "}
              {lineage.latestMarginalValueMultiple.toFixed(
                2,
              )}
              x
            </p>
          </div>

          <div className="flywheel-review-form">
            <label className="request-field">
              <span>
                Governance decision
              </span>

              <select
                value={reviewDecision}
                onChange={
                  event =>
                    setReviewDecision(
                      event.target.value as
                        CapitalFlywheelReviewDecision,
                    )
                }
              >
                <option value="CONTINUE_APPROVED">
                  Approve next cycle
                </option>

                <option value="STOPPED">
                  Stop lineage
                </option>
              </select>
            </label>

            <label className="request-field flywheel-form-wide">
              <span>
                Decision rationale
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

          <div className="flywheel-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !reviewNote.trim()
                ||
                (
                  reviewDecision ===
                    "CONTINUE_APPROVED"
                  &&
                  lineage.recommendation ===
                    "STOP"
                )
              }
              onClick={
                () =>
                  void reviewLineage()
              }
            >
              Record flywheel decision
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable continuation decisions
            </span>

            <h2>
              Review history
            </h2>
          </div>
        </div>

        <div className="flywheel-review-list">
          {detail.reviews.map(
            review => (
              <article
                key={review.id}
              >
                <div className="flywheel-review-heading">
                  <div>
                    <strong>
                      {readable(
                        review.decision,
                      )}
                    </strong>

                    <span>
                      Recommendation:
                      {" "}
                      {readable(
                        review.recommendation,
                      )}
                      {" · cycle "}
                      {review.cycleCount}
                    </span>
                  </div>

                  <span>
                    {readable(
                      review.flywheelHealth,
                    )}
                  </span>
                </div>

                <div className="flywheel-review-metrics">
                  <span>
                    Value multiple
                    <strong>
                      {review.cumulativeValueMultiple.toFixed(
                        2,
                      )}
                      x
                    </strong>
                  </span>

                  <span>
                    Marginal multiple
                    <strong>
                      {review.latestMarginalValueMultiple.toFixed(
                        2,
                      )}
                      x
                    </strong>
                  </span>

                  <span>
                    Marginal retention
                    <strong>
                      {review.latestMarginalNetValueRetentionPct.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </span>

                  <span>
                    Efficiency
                    <strong>
                      {review.latestCycleEfficiencyRetentionPct.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </span>
                </div>

                <p>
                  {review.decisionNote}
                </p>

                <small>
                  {review.overrideFlag
                    ? "HOLD recommendation explicitly overridden · "
                    : ""}
                  {review.reviewedByName}
                  {" · "}
                  {new Date(
                    review.reviewedAt,
                  )
                    .toLocaleString()}
                </small>
              </article>
            ),
          )}

          {detail.reviews.length ===
          0 ? (
            <div className="flywheel-empty">
              No capital-flywheel review
              has been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canFinalize &&
      lineage.status ===
        "STOPPED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Lineage closure
              </span>

              <h2>
                Close capital lineage
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

          <div className="flywheel-form-actions">
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
                  void closeLineage()
              }
            >
              Close lineage
            </button>
          </div>
        </section>
      ) : null}

      <section className="flywheel-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Another cycle requires explicit economic governance
          </strong>

          <p>
            CONTINUE is deterministic when
            marginal value and efficiency
            remain strong. HOLD can be
            explicitly overridden by a
            manager and that override is
            permanently recorded. STOP
            cannot be overridden.
          </p>
        </div>
      </section>
    </div>
  );
}
