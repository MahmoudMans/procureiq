"use client";

import {
  ArrowLeft,
  CircleAlert,
  Goal,
  Recycle,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  closeCapitalRecyclingSource,
  createCapitalReinvestmentProposal,
  decideCapitalReinvestmentProposal,
  getCapitalRecyclingSource,
} from "@/lib/api";

import type {
  CapitalRecyclingSourceDetail,
  CapitalReinvestmentDecision,
} from "@/types/capital-recycling";

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

export default function CapitalRecyclingSourcePage() {
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
      CapitalRecyclingSourceDetail |
      null
    >(null);

  const [
    targetValueCaseId,
    setTargetValueCaseId,
  ] =
    useState("");

  const [
    requestedAmount,
    setRequestedAmount,
  ] =
    useState(0);

  const [
    proposalRationale,
    setProposalRationale,
  ] =
    useState("");

  const [
    decisionNotes,
    setDecisionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

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

    getCapitalRecyclingSource(
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
            response.targets[0]
          ) {
            setTargetValueCaseId(
              response.targets[0].valueCaseId,
            );
          }

          setRequestedAmount(
            response.source.availableCapitalAmount,
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
                : "Unable to load capital-recycling source.",
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
      Promise<CapitalRecyclingSourceDetail>,
  ) {
    const response =
      await promise;

    setDetail(
      response,
    );

    if (
      response.targets[0]
    ) {
      setTargetValueCaseId(
        response.targets[0].valueCaseId,
      );
    }

    setRequestedAmount(
      response.source.availableCapitalAmount,
    );
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
        createCapitalReinvestmentProposal(
          params.id,
          {
            targetValueCaseId,
            requestedReinvestmentAmount:
              requestedAmount,
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
          : "Unable to create reinvestment proposal.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decide(
    proposalId: string,
    decision:
      CapitalReinvestmentDecision,
  ) {
    const note =
      decisionNotes[
        proposalId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Governance decision note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        decideCapitalReinvestmentProposal(
          proposalId,
          {
            decision,
            decisionNote:
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
          : "Unable to decide reinvestment proposal.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeSource() {
    if (!closeNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        closeCapitalRecyclingSource(
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
          : "Unable to close recycling source.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading capital-recycling source...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-recycling"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital recycling
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capital-recycling source not found."}
        </div>
      </div>
    );
  }

  const source =
    detail.source;

  const hasPendingProposal =
    detail.proposals.some(
      proposal =>
        proposal.decision ===
          null,
    );

  return (
    <div className="page-stack">
      <Link
        href="/capital-recycling"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital recycling
      </Link>

      <section className="recycling-detail-heading">
        <div>
          <span className="eyebrow">
            Governed recyclable capital
          </span>

          <h1>
            {source.sourceInitiativeTitle}
          </h1>

          <p>
            {source.sourceNumber}
            {" · "}
            {source.executionNumber}
            {" · "}
            {source.fundingCommitmentNumber}
          </p>
        </div>

        <span
          className={
            `recycling-status recycling-status--${source.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            source.status,
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

      <section className="recycling-detail-grid">
        <article>
          <span>
            Verified implementation
          </span>

          <strong>
            {money(
              source.verifiedImplementedCapitalAmount,
              source.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Recyclable
          </span>

          <strong>
            {money(
              source.recyclableCapitalAmount,
              source.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Approved reinvestment
          </span>

          <strong>
            {money(
              source.approvedReinvestmentAmount,
              source.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Pending
          </span>

          <strong>
            {money(
              source.pendingReinvestmentAmount,
              source.currency,
            )}
          </strong>
        </article>

        <article className="recycling-score-card">
          <span>
            Available
          </span>

          <strong>
            {money(
              source.availableCapitalAmount,
              source.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {source.utilizationPct.toFixed(
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
              Capital safety bridge
            </span>

            <h2>
              Recycling authority
            </h2>
          </div>

          <Recycle
            size={19}
          />
        </div>

        <p className="recycling-objective">
          {source.recyclingObjective}
        </p>

        <div className="recycling-context-grid">
          <div>
            <span>
              Source action
            </span>

            <strong>
              {readable(
                source.sourceAction,
              )}
            </strong>
          </div>

          <div>
            <span>
              Funding snapshot
            </span>

            <strong>
              {money(
                source.fundingRemainingSnapshot,
                source.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Current funding remaining
            </span>

            <strong>
              {money(
                source.currentFundingRemainingAmount,
                source.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Owner
            </span>

            <strong>
              {source.sourceOwnerName}
            </strong>
          </div>
        </div>

        {source.preferredTargetValueCaseNumber ? (
          <div className="recycling-target-note">
            <strong>
              Step 60 approved reallocation target
            </strong>

            <p>
              {source.preferredTargetValueCaseNumber}
              {" — "}
              {source.preferredTargetInitiativeTitle}
            </p>
          </div>
        ) : null}
      </section>

      <div className="recycling-source-links">
        <Link
          href={
            `/intervention-execution/${source.executionCaseId}`
          }
          className="table-action"
        >
          Step 61 execution evidence
        </Link>

        <Link
          href={
            `/funding-execution/${source.fundingCommitmentId}`
          }
          className="table-action"
        >
          Step 58 funding evidence
        </Link>

        <Link
          href={
            `/strategic-value/${source.sourceValueCaseId}`
          }
          className="table-action"
        >
          Source Step 56 value case
        </Link>
      </div>

      {canManage &&
      source.status ===
        "OPEN"
      &&
      !hasPendingProposal
      &&
      source.availableCapitalAmount >
        0
      &&
      detail.targets.length >
        0 ? (
        <form
          className="panel"
          onSubmit={propose}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Reinvestment proposal
              </span>

              <h2>
                Allocate recyclable capital
              </h2>
            </div>
          </div>

          <div className="recycling-proposal-form">
            <label className="request-field recycling-form-wide">
              <span>
                Governed Step 56 target
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
                {detail.targets.map(
                  target => (
                    <option
                      key={target.valueCaseId}
                      value={target.valueCaseId}
                    >
                      {target.preferredTarget
                        ? "Preferred · "
                        : ""}
                      {target.valueCaseNumber}
                      {" — "}
                      {target.initiativeTitle}
                      {" · ROI "}
                      {target.roiPct.toFixed(
                        1,
                      )}
                      {"%"}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Reinvestment amount
              </span>

              <input
                type="number"
                min="0.01"
                max={source.availableCapitalAmount}
                step="0.01"
                value={requestedAmount}
                onChange={
                  event =>
                    setRequestedAmount(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field recycling-form-wide">
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

          <div className="recycling-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !targetValueCaseId
                ||
                requestedAmount <=
                  0
                ||
                requestedAmount >
                  source.availableCapitalAmount
                ||
                !proposalRationale.trim()
              }
            >
              Create immutable proposal
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Target opportunities
            </span>

            <h2>
              Eligible reinvestment targets
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Health</th>
                <th>ROI</th>
                <th>Persistence</th>
                <th>Net value</th>
                <th>Preferred</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.targets.map(
                target => (
                  <tr
                    key={target.valueCaseId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {target.initiativeTitle}
                        </strong>

                        <span>
                          {target.valueCaseNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        target.valueHealth,
                      )}
                    </td>

                    <td>
                      {target.roiPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {target.persistencePct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        target.netValueAmount,
                        target.currency,
                      )}
                    </td>

                    <td>
                      {target.preferredTarget
                        ? "Yes"
                        : "No"}
                    </td>

                    <td>
                      <Link
                        href={
                          `/strategic-value/${target.valueCaseId}`
                        }
                        className="table-action"
                      >
                        Value case
                      </Link>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable governance history
            </span>

            <h2>
              Reinvestment proposals
            </h2>
          </div>
        </div>

        <div className="recycling-proposal-list">
          {detail.proposals.map(
            proposal => (
              <article
                key={proposal.id}
              >
                <div className="recycling-proposal-heading">
                  <div>
                    <strong>
                      {proposal.targetInitiativeTitle}
                    </strong>

                    <span>
                      {proposal.targetValueCaseNumber}
                      {" · "}
                      {money(
                        proposal.requestedReinvestmentAmount,
                        source.currency,
                      )}
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

                <div className="recycling-target-metrics">
                  <span>
                    ROI
                    <strong>
                      {proposal.targetRoiPctSnapshot.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </span>

                  <span>
                    Persistence
                    <strong>
                      {proposal.targetPersistencePctSnapshot.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </span>

                  <span>
                    Health
                    <strong>
                      {readable(
                        proposal.targetValueHealthSnapshot,
                      )}
                    </strong>
                  </span>

                  <span>
                    Net value
                    <strong>
                      {money(
                        proposal.targetNetValueSnapshot,
                        source.currency,
                      )}
                    </strong>
                  </span>
                </div>

                <p>
                  {proposal.proposalRationale}
                </p>

                <small>
                  Available at proposal:
                  {" "}
                  {money(
                    proposal.sourceAvailableCapitalSnapshot,
                    source.currency,
                  )}
                  {" · "}
                  {proposal.proposedByName}
                </small>

                {proposal.decision ? (
                  <div className="recycling-decision-record">
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
                ) : canFinalize ? (
                  <div className="recycling-decision-control">
                    <input
                      placeholder="Governance decision note"
                      value={
                        decisionNotes[
                          proposal.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setDecisionNotes(
                            current => ({
                              ...current,
                              [proposal.id]:
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
                          decisionNotes[
                            proposal.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void decide(
                            proposal.id,
                            "APPROVED",
                          )
                      }
                    >
                      Approve reinvestment
                    </button>

                    <button
                      type="button"
                      className="recycling-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          decisionNotes[
                            proposal.id
                          ]
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void decide(
                            proposal.id,
                            "REJECTED",
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

          {detail.proposals.length ===
          0 ? (
            <div className="recycling-empty">
              No reinvestment proposal has
              been created.
            </div>
          ) : null}
        </div>
      </section>

      {canFinalize &&
      source.status ===
        "FULLY_ALLOCATED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Source closure
              </span>

              <h2>
                Close recycling source
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

          <div className="recycling-form-actions">
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
                  void closeSource()
              }
            >
              Close recycling source
            </button>
          </div>
        </section>
      ) : null}

      <section className="recycling-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Approved reinvestment does not create a new funding release
          </strong>

          <p>
            Step 62 reserves verified
            recyclable capital against a
            governed Step 56 target.
            Separate downstream funding
            authority is still required
            before capital can be released.
          </p>
        </div>
      </section>
    </div>
  );
}
