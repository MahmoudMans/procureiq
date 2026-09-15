"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Goal,
  Trash2,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addCapitalAllocationItem,
  approveCapitalAllocationCycle,
  captureCapitalAllocationSnapshot,
  closeCapitalAllocationCycle,
  decideCapitalAllocationItem,
  getCapitalAllocationCycle,
  removeCapitalAllocationItem,
  submitCapitalAllocationCycle,
} from "@/lib/api";

import type {
  CapitalAllocationCycleDetail,
  CapitalAllocationDecision,
} from "@/types/capital-allocation";

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

export default function CapitalAllocationCyclePage() {
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
      CapitalAllocationCycleDetail |
      null
    >(null);

  const [
    candidateId,
    setCandidateId,
  ] =
    useState("");

  const [
    requestedCapital,
    setRequestedCapital,
  ] =
    useState(0);

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
    governanceNote,
    setGovernanceNote,
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

  const canDecide =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getCapitalAllocationCycle(
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

          const first =
            response.candidates[0];

          if (first) {
            setCandidateId(
              first.valueCaseId,
            );

            setRequestedCapital(
              first.investmentCostAmount,
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
                : "Unable to load allocation cycle.",
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

  function applyCandidate(
    valueCaseId: string,
  ) {
    setCandidateId(
      valueCaseId,
    );

    const candidate =
      detail
        ?.candidates
        .find(
          item =>
            item.valueCaseId ===
              valueCaseId,
        );

    if (candidate) {
      setRequestedCapital(
        candidate.investmentCostAmount,
      );
    }
  }

  async function addItem(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const response =
        await addCapitalAllocationItem(
          params.id,
          {
            valueCaseId:
              candidateId,
            requestedCapitalAmount:
              requestedCapital,
          },
        );

      setDetail(
        response,
      );

      const first =
        response.candidates[0];

      if (first) {
        setCandidateId(
          first.valueCaseId,
        );

        setRequestedCapital(
          first.investmentCostAmount,
        );
      } else {
        setCandidateId("");
        setRequestedCapital(0);
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add investment candidate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function removeItem(
    itemId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await removeCapitalAllocationItem(
          itemId,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to remove investment candidate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitCycle() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await submitCapitalAllocationCycle(
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
          : "Unable to submit allocation cycle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decide(
    itemId: string,
    decision:
      CapitalAllocationDecision,
  ) {
    const note =
      decisionNotes[
        itemId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Investment decision note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await decideCapitalAllocationItem(
          itemId,
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
          : "Unable to record investment decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function approveCycle() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await approveCapitalAllocationCycle(
          params.id,
          governanceNote,
        ),
      );

      setGovernanceNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to approve allocation cycle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeCycle() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeCapitalAllocationCycle(
          params.id,
          governanceNote,
        ),
      );

      setGovernanceNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close allocation cycle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureCapitalAllocationSnapshot(
        params.id,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture investment-committee snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading allocation cycle...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-allocation"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital allocation
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Allocation cycle not found."}
        </div>
      </div>
    );
  }

  const cycle =
    detail.cycle;

  return (
    <div className="page-stack">
      <Link
        href="/capital-allocation"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital allocation
      </Link>

      <section className="allocation-detail-heading">
        <div>
          <span className="eyebrow">
            Governed capital-allocation cycle
          </span>

          <h1>
            {cycle.title}
          </h1>

          <p>
            {cycle.cycleNumber}
            {" · "}
            {cycle.currency}
            {" · FY "}
            {cycle.fiscalYear}
          </p>
        </div>

        <span
          className={
            `allocation-status allocation-status--${cycle.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            cycle.status,
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

      <section className="allocation-detail-grid">
        <article className="allocation-budget-card">
          <span>
            Budget
          </span>

          <strong>
            {money(
              cycle.budgetAmount,
              cycle.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Funded
          </span>

          <strong>
            {money(
              cycle.fundedAmount,
              cycle.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining
          </span>

          <strong>
            {money(
              cycle.remainingBudgetAmount,
              cycle.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {cycle.budgetUtilizationPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Funded net value
          </span>

          <strong>
            {money(
              cycle.fundedNetValueAmount,
              cycle.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Opportunity cost
          </span>

          <strong className="allocation-risk-text">
            {money(
              cycle.opportunityCostAmount,
              cycle.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel allocation-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Allocation authority
            </span>

            <h2>
              Investment objective
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p>
          {cycle.objective}
        </p>

        <div className="allocation-cycle-signals">
          <div>
            <span>Average priority</span>
            <strong>
              {cycle.averagePriorityScore.toFixed(
                1,
              )}
            </strong>
          </div>

          <div>
            <span>Funded</span>
            <strong>
              {cycle.fundedItemCount}
            </strong>
          </div>

          <div>
            <span>Deferred</span>
            <strong>
              {cycle.deferredItemCount}
            </strong>
          </div>

          <div>
            <span>Rejected</span>
            <strong>
              {cycle.rejectedItemCount}
            </strong>
          </div>

          <div>
            <span>Pending</span>
            <strong>
              {cycle.pendingItemCount}
            </strong>
          </div>
        </div>
      </section>

      {canManage &&
      cycle.status ===
        "DRAFT"
      &&
      detail.candidates.length >
        0 ? (
        <form
          className="panel"
          onSubmit={addItem}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Candidate import
              </span>

              <h2>
                Add verified value case
              </h2>
            </div>
          </div>

          <div className="allocation-add-form">
            <label className="request-field allocation-form-wide">
              <span>
                Verified Step 56 value case
              </span>

              <select
                value={candidateId}
                onChange={
                  event =>
                    applyCandidate(
                      event.target.value,
                    )
                }
              >
                {detail.candidates.map(
                  candidate => (
                    <option
                      key={candidate.valueCaseId}
                      value={candidate.valueCaseId}
                    >
                      {candidate.caseNumber}
                      {" — "}
                      {candidate.initiativeTitle}
                      {" · Priority "}
                      {candidate.priorityScore.toFixed(
                        1,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Requested capital
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={requestedCapital}
                onChange={
                  event =>
                    setRequestedCapital(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>
          </div>

          <div className="allocation-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !candidateId
                ||
                requestedCapital <=
                  0
              }
            >
              Add candidate
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Priority ranking
            </span>

            <h2>
              Investment candidates
            </h2>
          </div>

          <button
            type="button"
            className="button button--secondary"
            disabled={running}
            onClick={
              () =>
                void snapshot()
            }
          >
            <Camera
              size={15}
            />
            Capture snapshot
          </button>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Request</th>
                <th>Priority</th>
                <th>Advisory</th>
                <th>ROI</th>
                <th>Persistence</th>
                <th>Net value</th>
                <th>Decision</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                (
                  item,
                  index,
                ) => (
                  <tr
                    key={item.id}
                  >
                    <td>
                      <strong>
                        {index + 1}
                      </strong>
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.caseNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {money(
                        item.requestedCapitalAmount,
                        cycle.currency,
                      )}
                    </td>

                    <td>
                      {item.priorityScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          `allocation-decision allocation-decision--${item.recommendation.toLowerCase()}`
                        }
                      >
                        {readable(
                          item.recommendation,
                        )}
                      </span>
                    </td>

                    <td>
                      {item.roiPctSnapshot.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.persistencePctSnapshot.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        item.netValueSnapshot,
                        cycle.currency,
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          `allocation-decision allocation-decision--${item.decision.toLowerCase()}`
                        }
                      >
                        {readable(
                          item.decision,
                        )}
                      </span>

                      {item.decisionNote ? (
                        <small className="allocation-decision-note">
                          {item.decisionNote}
                        </small>
                      ) : null}
                    </td>

                    <td>
                      {canManage &&
                      cycle.status ===
                        "DRAFT" ? (
                        <button
                          type="button"
                          className="allocation-icon-button"
                          disabled={running}
                          onClick={
                            () =>
                              void removeItem(
                                item.id,
                              )
                          }
                        >
                          <Trash2
                            size={14}
                          />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}

              {detail.items.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="table-empty-state"
                  >
                    No verified value case
                    has been added to this
                    allocation cycle.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canDecide &&
      cycle.status ===
        "IN_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Investment committee
              </span>

              <h2>
                Manual allocation decisions
              </h2>
            </div>
          </div>

          <div className="allocation-decision-list">
            {detail.items.map(
              item => (
                <article
                  key={item.id}
                >
                  <div className="allocation-decision-heading">
                    <div>
                      <strong>
                        {item.initiativeTitle}
                      </strong>

                      <span>
                        Advisory:
                        {" "}
                        {readable(
                          item.recommendation,
                        )}
                        {" · Priority "}
                        {item.priorityScore.toFixed(
                          1,
                        )}
                      </span>
                    </div>

                    <strong>
                      {money(
                        item.requestedCapitalAmount,
                        cycle.currency,
                      )}
                    </strong>
                  </div>

                  <label className="request-field">
                    <span>
                      Investment committee rationale
                    </span>

                    <textarea
                      rows={3}
                      value={
                        decisionNotes[
                          item.id
                        ]
                        ??
                        item.decisionNote
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setDecisionNotes(
                            current => ({
                              ...current,
                              [item.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />
                  </label>

                  <div className="allocation-decision-actions">
                    <button
                      type="button"
                      disabled={
                        running
                        ||
                        !(
                          decisionNotes[
                            item.id
                          ]
                          ??
                          item.decisionNote
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void decide(
                            item.id,
                            "FUND",
                          )
                      }
                    >
                      Fund
                    </button>

                    <button
                      type="button"
                      disabled={
                        running
                        ||
                        !(
                          decisionNotes[
                            item.id
                          ]
                          ??
                          item.decisionNote
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void decide(
                            item.id,
                            "DEFER",
                          )
                      }
                    >
                      Defer
                    </button>

                    <button
                      type="button"
                      className="allocation-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          decisionNotes[
                            item.id
                          ]
                          ??
                          item.decisionNote
                          ??
                          ""
                        ).trim()
                      }
                      onClick={
                        () =>
                          void decide(
                            item.id,
                            "REJECT",
                          )
                      }
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

      {canManage &&
      cycle.status ===
        "DRAFT" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance gate
              </span>

              <h2>
                Submit allocation cycle
              </h2>
            </div>
          </div>

          <p className="allocation-governance-copy">
            Submission freezes candidate
            membership and passes the cycle
            to managers for explicit
            investment decisions.
          </p>

          <div className="allocation-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                detail.items.length ===
                  0
              }
              onClick={
                () =>
                  void submitCycle()
              }
            >
              Submit for committee review
            </button>
          </div>
        </section>
      ) : null}

      {canDecide &&
      (
        cycle.status ===
          "IN_REVIEW"
        ||
        cycle.status ===
          "APPROVED"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Committee governance
              </span>

              <h2>
                {cycle.status ===
                  "IN_REVIEW"
                  ? "Approve allocation"
                  : "Close allocation cycle"}
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Governance note
            </span>

            <textarea
              rows={5}
              value={governanceNote}
              onChange={
                event =>
                  setGovernanceNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="allocation-form-actions">
            {cycle.status ===
            "IN_REVIEW" ? (
              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  cycle.pendingItemCount >
                    0
                  ||
                  !governanceNote.trim()
                }
                onClick={
                  () =>
                    void approveCycle()
                }
              >
                Approve allocation
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !governanceNote.trim()
                }
                onClick={
                  () =>
                    void closeCycle()
                }
              >
                Close allocation cycle
              </button>
            )}
          </div>
        </section>
      ) : null}

      {cycle.approvalNote ? (
        <section className="allocation-approval-note">
          <strong>
            Approved investment allocation
          </strong>

          <p>
            {cycle.approvalNote}
          </p>

          <small>
            {cycle.approvedByName}
            {" · "}
            {cycle.approvedAt
              ? new Date(
                  cycle.approvedAt,
                )
                  .toLocaleString()
              : ""}
          </small>
        </section>
      ) : null}

      <section className="allocation-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Budget enforcement is deterministic; allocation authority is human
          </strong>

          <p>
            A FUND decision is rejected
            when it would breach the
            governed cycle budget.
            Advisory ranking never creates
            funding automatically and
            never modifies Step 56 value
            evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
