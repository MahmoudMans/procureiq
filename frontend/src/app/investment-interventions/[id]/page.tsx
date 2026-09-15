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
  closeInvestmentInterventionCase,
  decideInvestmentIntervention,
  getInvestmentInterventionCase,
  proposeInvestmentInterventionAction,
  submitInvestmentInterventionForReview,
} from "@/lib/api";

import type {
  InvestmentInterventionAction,
  InvestmentInterventionCaseDetail,
  InvestmentInterventionDecision,
} from "@/types/investment-intervention";

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

export default function InvestmentInterventionCasePage() {
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
      InvestmentInterventionCaseDetail |
      null
    >(null);

  const [
    actionType,
    setActionType,
  ] =
    useState<InvestmentInterventionAction>(
      "CONTINUE",
    );

  const [
    affectedCapital,
    setAffectedCapital,
  ] =
    useState(0);

  const [
    targetValueCaseId,
    setTargetValueCaseId,
  ] =
    useState("");

  const [
    proposalRationale,
    setProposalRationale,
  ] =
    useState("");

  const [
    decisionNote,
    setDecisionNote,
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

    getInvestmentInterventionCase(
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

          setActionType(
            response.interventionCase.currentRecommendation,
          );

          setAffectedCapital(
            response.interventionCase.currentRecommendedAffectedCapitalAmount,
          );

          if (
            response.reallocationTargets[0]
          ) {
            setTargetValueCaseId(
              response.reallocationTargets[0].id,
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
                : "Unable to load intervention case.",
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
      Promise<InvestmentInterventionCaseDetail>,
  ) {
    setDetail(
      await promise,
    );
  }

  function changeAction(
    action:
      InvestmentInterventionAction,
  ) {
    setActionType(
      action,
    );

    if (
      action ===
        "CONTINUE"
    ) {
      setAffectedCapital(0);
    } else if (
      detail
    ) {
      setAffectedCapital(
        detail.interventionCase.currentRecommendedAffectedCapitalAmount >
          0
          ? detail.interventionCase.currentRecommendedAffectedCapitalAmount
          : detail.interventionCase.currentRemainingCommitmentAmount,
      );
    }
  }

  async function propose(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await apply(
        proposeInvestmentInterventionAction(
          params.id,
          {
            actionType,
            affectedCapitalAmount:
              affectedCapital,
            targetValueCaseId:
              actionType ===
                "REALLOCATE_UNRELEASED"
                ? targetValueCaseId
                : undefined,
            proposalRationale:
              proposalRationale.trim(),
          },
        ),
      );

      setProposalRationale("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create intervention proposal.",
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
        submitInvestmentInterventionForReview(
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
          : "Unable to submit intervention case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decide(
    decision:
      InvestmentInterventionDecision,
  ) {
    if (!decisionNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        decideInvestmentIntervention(
          params.id,
          {
            decision,
            decisionNote:
              decisionNote.trim(),
          },
        ),
      );

      setDecisionNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record intervention decision.",
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
        closeInvestmentInterventionCase(
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
          : "Unable to close intervention case.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading investment intervention...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/investment-interventions"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Investment intervention
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Investment-intervention case not found."}
        </div>
      </div>
    );
  }

  const interventionCase =
    detail.interventionCase;

  const latestProposal =
    detail.proposals[0];

  const hasPendingProposal =
    latestProposal
    &&
    latestProposal.decision ===
      null;

  return (
    <div className="page-stack">
      <Link
        href="/investment-interventions"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Investment intervention
      </Link>

      <section className="intervention-detail-heading">
        <div>
          <span className="eyebrow">
            Capital intervention governance
          </span>

          <h1>
            {interventionCase.initiativeTitle}
          </h1>

          <p>
            {interventionCase.interventionNumber}
            {" · "}
            {interventionCase.performanceCaseNumber}
            {" · "}
            {interventionCase.fundingCommitmentNumber}
          </p>
        </div>

        <span
          className={
            `intervention-status intervention-status--${interventionCase.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            interventionCase.status,
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

      <section className="intervention-detail-grid">
        <article>
          <span>
            Current health
          </span>

          <strong>
            {readable(
              interventionCase.currentPerformanceHealth,
            )}
          </strong>
        </article>

        <article>
          <span>
            Released capital
          </span>

          <strong>
            {money(
              interventionCase.currentReleasedCapitalAmount,
              interventionCase.currency,
            )}
          </strong>
        </article>

        <article className="intervention-score-card">
          <span>
            Unreleased capital
          </span>

          <strong>
            {money(
              interventionCase.currentRemainingCommitmentAmount,
              interventionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Realized ROI
          </span>

          <strong>
            {interventionCase.currentRealizedRoiPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            ROI variance
          </span>

          <strong>
            {interventionCase.currentRoiVariancePct.toFixed(
              1,
            )}
            {" pts"}
          </strong>
        </article>

        <article>
          <span>
            Efficiency
          </span>

          <strong>
            {interventionCase.currentCapitalEfficiencyMultiple.toFixed(
              2,
            )}
            x
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Intervention authority
            </span>

            <h2>
              Source snapshot vs current evidence
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p className="intervention-rationale">
          {interventionCase.interventionRationale}
        </p>

        <div className="intervention-comparison-grid">
          <div>
            <span>
              Source health
            </span>

            <strong>
              {readable(
                interventionCase.sourcePerformanceHealth,
              )}
            </strong>
          </div>

          <div>
            <span>
              Current health
            </span>

            <strong>
              {readable(
                interventionCase.currentPerformanceHealth,
              )}
            </strong>
          </div>

          <div>
            <span>
              Source remaining capital
            </span>

            <strong>
              {money(
                interventionCase.sourceRemainingCommitmentAmount,
                interventionCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Current remaining capital
            </span>

            <strong>
              {money(
                interventionCase.currentRemainingCommitmentAmount,
                interventionCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Source ROI variance
            </span>

            <strong>
              {interventionCase.sourceRoiVariancePct.toFixed(
                1,
              )}
              {" pts"}
            </strong>
          </div>

          <div>
            <span>
              Current ROI variance
            </span>

            <strong>
              {interventionCase.currentRoiVariancePct.toFixed(
                1,
              )}
              {" pts"}
            </strong>
          </div>
        </div>
      </section>

      <section className="intervention-recommendation">
        <strong>
          Current advisory recommendation
        </strong>

        <p>
          {readable(
            interventionCase.currentRecommendation,
          )}
          {" · "}
          {money(
            interventionCase.currentRecommendedAffectedCapitalAmount,
            interventionCase.currency,
          )}
          {" potentially affected"}
        </p>

        <small>
          Advisory only. A manager or
          administrator must approve a
          proposal before it becomes a
          governance decision.
        </small>
      </section>

      <div className="intervention-source-links">
        <Link
          href={
            `/investment-performance/${interventionCase.performanceCaseId}`
          }
          className="table-action"
        >
          Step 59 performance evidence
        </Link>

        <Link
          href={
            `/funding-execution/${interventionCase.fundingCommitmentId}`
          }
          className="table-action"
        >
          Step 58 funding evidence
        </Link>

        <Link
          href={
            `/strategic-value/${interventionCase.valueCaseId}`
          }
          className="table-action"
        >
          Step 56 value baseline
        </Link>
      </div>

      {canManage &&
      interventionCase.status ===
        "OPEN"
      &&
      !hasPendingProposal ? (
        <form
          className="panel"
          onSubmit={propose}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Immutable proposal
              </span>

              <h2>
                Propose capital intervention
              </h2>
            </div>
          </div>

          <div className="intervention-proposal-form">
            <label className="request-field">
              <span>
                Action
              </span>

              <select
                value={actionType}
                onChange={
                  event =>
                    changeAction(
                      event.target.value as
                        InvestmentInterventionAction,
                    )
                }
              >
                <option value="CONTINUE">
                  Continue
                </option>

                <option value="HOLD_FUTURE_RELEASES">
                  Hold future releases
                </option>

                <option value="REDUCE_UNRELEASED">
                  Reduce unreleased capital
                </option>

                <option value="REALLOCATE_UNRELEASED">
                  Reallocate unreleased capital
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Affected capital
              </span>

              <input
                type="number"
                min="0"
                max={
                  interventionCase.currentRemainingCommitmentAmount
                }
                step="0.01"
                disabled={
                  actionType ===
                    "CONTINUE"
                }
                value={affectedCapital}
                onChange={
                  event =>
                    setAffectedCapital(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            {actionType ===
            "REALLOCATE_UNRELEASED" ? (
              <label className="request-field intervention-form-wide">
                <span>
                  Governed Step 56 reallocation target
                </span>

                <select
                  value={targetValueCaseId}
                  onChange={
                    event =>
                      setTargetValueCaseId(
                        event.target.value,
                      )
                  }
                >
                  {detail.reallocationTargets.map(
                    target => (
                      <option
                        key={target.id}
                        value={target.id}
                      >
                        {target.caseNumber}
                        {" — "}
                        {target.initiativeTitle}
                        {" · ROI "}
                        {target.roiPct.toFixed(
                          1,
                        )}
                        %
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : null}

            <label className="request-field intervention-form-wide">
              <span>
                Proposal rationale
              </span>

              <textarea
                required
                rows={5}
                value={proposalRationale}
                onChange={
                  event =>
                    setProposalRationale(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="intervention-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !proposalRationale.trim()
                ||
                (
                  actionType !==
                    "CONTINUE"
                  &&
                  affectedCapital <=
                    0
                )
                ||
                (
                  actionType ===
                    "REALLOCATE_UNRELEASED"
                  &&
                  !targetValueCaseId
                )
              }
            >
              Create immutable proposal
            </button>
          </div>
        </form>
      ) : null}

      {canManage &&
      interventionCase.status ===
        "OPEN"
      &&
      hasPendingProposal ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance gate
              </span>

              <h2>
                Submit proposal for review
              </h2>
            </div>
          </div>

          <div className="intervention-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitForReview()
              }
            >
              Submit for manager review
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      interventionCase.status ===
        "IN_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent intervention decision
              </span>

              <h2>
                Approve or reject
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Decision rationale
            </span>

            <textarea
              rows={5}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="intervention-decision-actions">
            <button
              type="button"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void decide(
                    "APPROVED",
                  )
              }
            >
              Approve intervention
            </button>

            <button
              type="button"
              className="intervention-danger-button"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void decide(
                    "REJECTED",
                  )
              }
            >
              Reject proposal
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable governance history
            </span>

            <h2>
              Intervention proposals
            </h2>
          </div>
        </div>

        <div className="intervention-proposal-list">
          {detail.proposals.map(
            proposal => (
              <article
                key={proposal.id}
              >
                <div className="intervention-proposal-heading">
                  <div>
                    <strong>
                      {readable(
                        proposal.actionType,
                      )}
                    </strong>

                    <span>
                      {money(
                        proposal.affectedCapitalAmount,
                        interventionCase.currency,
                      )}
                      {" affected"}
                    </span>
                  </div>

                  <span>
                    {proposal.decision
                      ? readable(
                          proposal.decision.decision,
                        )
                      : "Awaiting decision"}
                  </span>
                </div>

                <p>
                  {proposal.proposalRationale}
                </p>

                {proposal.targetValueCaseNumber ? (
                  <small>
                    Reallocation target:
                    {" "}
                    {proposal.targetValueCaseNumber}
                    {" — "}
                    {proposal.targetInitiativeTitle}
                  </small>
                ) : null}

                <small>
                  Source remaining capital:
                  {" "}
                  {money(
                    proposal.sourceRemainingCapitalSnapshot,
                    interventionCase.currency,
                  )}
                  {" · "}
                  {proposal.proposedByName}
                </small>

                {proposal.decision ? (
                  <div className="intervention-decision-record">
                    <strong>
                      {readable(
                        proposal.decision.decision,
                      )}
                    </strong>

                    <p>
                      {proposal.decision.decisionNote}
                    </p>

                    <small>
                      {proposal.decision.decidedByName}
                      {" · "}
                      {new Date(
                        proposal.decision.decidedAt,
                      )
                        .toLocaleString()}
                    </small>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.proposals.length ===
          0 ? (
            <div className="intervention-empty">
              No intervention proposal
              has been created.
            </div>
          ) : null}
        </div>
      </section>

      {interventionCase.status ===
      "APPROVED" ? (
        <section className="intervention-approved-record">
          <strong>
            Approved governance action
          </strong>

          <p>
            {interventionCase.approvedAction
              ? readable(
                  interventionCase.approvedAction,
                )
              : "—"}
            {" · "}
            {money(
              interventionCase.approvedAffectedCapitalAmount,
              interventionCase.currency,
            )}
          </p>

          {interventionCase.approvedTargetValueCaseNumber ? (
            <small>
              Target:
              {" "}
              {interventionCase.approvedTargetValueCaseNumber}
            </small>
          ) : null}
        </section>
      ) : null}

      {canFinalize &&
      interventionCase.status ===
        "APPROVED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance closure
              </span>

              <h2>
                Close intervention case
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

          <div className="intervention-form-actions">
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
              Close governance case
            </button>
          </div>
        </section>
      ) : null}

      <section className="intervention-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Released capital can never be retroactively reallocated
          </strong>

          <p>
            Every intervention amount is
            bounded by current unreleased
            Step 58 committed capital.
            Approved intervention evidence
            does not alter the historical
            release ledger or execute a
            reallocation automatically.
          </p>
        </div>
      </section>
    </div>
  );
}
