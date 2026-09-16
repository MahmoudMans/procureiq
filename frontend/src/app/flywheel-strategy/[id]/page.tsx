"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Scale,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addFlywheelStrategyItem,
  approveFlywheelStrategyPortfolio,
  captureFlywheelStrategySnapshot,
  closeFlywheelStrategyPortfolio,
  decideFlywheelStrategyItem,
  getFlywheelStrategyPortfolio,
  submitFlywheelStrategyForReview,
} from "@/lib/api";

import type {
  FlywheelStrategyDecision,
  FlywheelStrategyPortfolioDetail,
} from "@/types/flywheel-strategy";

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

export default function FlywheelStrategyPortfolioPage() {
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
      FlywheelStrategyPortfolioDetail |
      null
    >(null);

  const [
    lineageId,
    setLineageId,
  ] =
    useState("");

  const [
    proposedCapacity,
    setProposedCapacity,
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
    approvalNote,
    setApprovalNote,
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

  function syncCandidate(
    response:
      FlywheelStrategyPortfolioDetail,
  ) {
    const candidate =
      response.candidates[0];

    if (candidate) {
      setLineageId(
        candidate.flywheelLineageId,
      );

      setProposedCapacity(
        candidate
          .referenceNextCycleCapitalAmount,
      );
    } else {
      setLineageId("");
      setProposedCapacity(0);
    }
  }

  async function reload() {
    const response =
      await getFlywheelStrategyPortfolio(
        params.id,
      );

    setDetail(
      response,
    );

    syncCandidate(
      response,
    );
  }

  useEffect(() => {
    let active = true;

    getFlywheelStrategyPortfolio(
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

          const candidate =
            response.candidates[0];

          if (candidate) {
            setLineageId(
              candidate
                .flywheelLineageId,
            );

            setProposedCapacity(
              candidate
                .referenceNextCycleCapitalAmount,
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
                : "Unable to load flywheel strategy portfolio.",
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

  async function addItem(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const response =
        await addFlywheelStrategyItem(
          params.id,
          {
            flywheelLineageId:
              lineageId,

            proposedCapacityAmount:
              proposedCapacity,
          },
        );

      setDetail(
        response,
      );

      syncCandidate(
        response,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add flywheel lineage.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitReview() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await submitFlywheelStrategyForReview(
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
          : "Unable to submit portfolio for review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decide(
    itemId: string,
    decision:
      FlywheelStrategyDecision,
  ) {
    const note =
      decisionNotes[itemId]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A decision note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await decideFlywheelStrategyItem(
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
          : "Unable to record portfolio decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function approve() {
    if (!approvalNote.trim()) {
      setError(
        "Approval note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await approveFlywheelStrategyPortfolio(
          params.id,
          approvalNote.trim(),
        ),
      );

      setApprovalNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to approve portfolio.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closePortfolio() {
    if (!closeNote.trim()) {
      setError(
        "Closure note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeFlywheelStrategyPortfolio(
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
          : "Unable to close portfolio.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureFlywheelStrategySnapshot(
        params.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture portfolio snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading flywheel strategy portfolio...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-strategy"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Flywheel strategy
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Flywheel strategy portfolio not found."}
        </div>
      </div>
    );
  }

  const portfolio =
    detail.portfolio;

  const allDecided =
    portfolio.itemCount > 0
    &&
    portfolio.pendingCount === 0;

  const hasPrioritized =
    portfolio.prioritizeCount > 0;

  return (
    <div className="page-stack">
      <Link
        href="/flywheel-strategy"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Flywheel strategy
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Constrained capital portfolio
          </span>

          <h1>
            {portfolio.title}
          </h1>

          <p>
            {portfolio.portfolioNumber}
            {" · "}
            {portfolio.currency}
            {" · FY "}
            {portfolio.fiscalYear}
          </p>
        </div>

        <div className="fwstrategy-heading-actions">
          {canManage ? (
            <button
              type="button"
              className="button"
              disabled={running}
              onClick={
                () =>
                  void snapshot()
              }
            >
              <Camera
                size={14}
              />
              Snapshot
            </button>
          ) : null}

          <span className="fwstrategy-status-chip">
            {readable(
              portfolio.status,
            )}
          </span>
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

      <section className="fwstrategy-detail-grid">
        <article>
          <span>
            Capacity envelope
          </span>

          <strong>
            {money(
              portfolio
                .capitalCapacityAmount,
              portfolio.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Prioritized
          </span>

          <strong>
            {money(
              portfolio
                .prioritizedCapacityAmount,
              portfolio.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining
          </span>

          <strong>
            {money(
              portfolio
                .remainingCapacityAmount,
              portfolio.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {
              portfolio
                .capacityUtilizationPct
                .toFixed(1)
            }
            %
          </strong>
        </article>

        <article>
          <span>
            Average priority
          </span>

          <strong>
            {
              portfolio
                .averagePriorityScore
                .toFixed(1)
            }
          </strong>
        </article>

        <article>
          <span>
            Lineages
          </span>

          <strong>
            {portfolio.itemCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Portfolio authority
            </span>

            <h2>
              Governance context
            </h2>
          </div>
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>
              Owner
            </span>

            <strong>
              {
                portfolio
                  .portfolioOwnerName
              }
            </strong>
          </div>

          <div>
            <span>
              Fiscal year
            </span>

            <strong>
              {portfolio.fiscalYear}
            </strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>
              Strategic objective
            </span>

            <p>
              {
                portfolio
                  .strategicObjective
              }
            </p>
          </div>
        </div>
      </section>

      {portfolio.status ===
        "DRAFT"
      &&
      canManage ? (
        <form
          className="panel"
          onSubmit={addItem}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Approved Step 66 authority
              </span>

              <h2>
                Add competing lineage
              </h2>
            </div>
          </div>

          {detail.candidates.length >
          0 ? (
            <>
              <div className="fwstrategy-form-grid">
                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Eligible lineage
                  </span>

                  <select
                    value={lineageId}
                    onChange={
                      event => {
                        const id =
                          event.target.value;

                        setLineageId(
                          id,
                        );

                        const candidate =
                          detail.candidates.find(
                            current =>
                              current
                                .flywheelLineageId ===
                              id,
                          );

                        if (candidate) {
                          setProposedCapacity(
                            candidate
                              .referenceNextCycleCapitalAmount,
                          );
                        }
                      }
                    }
                  >
                    {detail
                      .candidates
                      .map(
                        candidate => (
                          <option
                            key={
                              candidate
                                .flywheelLineageId
                            }
                            value={
                              candidate
                                .flywheelLineageId
                            }
                          >
                            {
                              candidate
                                .rootTargetInitiativeTitle
                            }
                            {" — "}
                            {
                              candidate
                                .lineageNumber
                            }
                            {" — score "}
                            {
                              candidate
                                .priorityScore
                                .toFixed(1)
                            }
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Proposed capacity
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      proposedCapacity
                    }
                    onChange={
                      event =>
                        setProposedCapacity(
                          Number(
                            event.target
                              .value,
                          ),
                        )
                    }
                  />
                </label>
              </div>

              <div className="fwstrategy-form-actions">
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={
                    running
                    ||
                    !lineageId
                    ||
                    proposedCapacity <=
                      0
                  }
                >
                  Add lineage
                </button>
              </div>
            </>
          ) : (
            <p>
              No additional compatible
              Step 66 lineage is
              available for this
              portfolio.
            </p>
          )}
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Human allocation authority
            </span>

            <h2>
              Portfolio lineages
            </h2>
          </div>

          <Scale
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Proposed</th>
                <th>Cumulative</th>
                <th>Marginal</th>
                <th>Priority</th>
                <th>Advisory</th>
                <th>Decision</th>
                <th>Governance</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {
                            item
                              .rootTargetInitiativeTitle
                          }
                        </strong>

                        <span>
                          {
                            item
                              .lineageNumber
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      {money(
                        item
                          .proposedCapacityAmount,
                        portfolio.currency,
                      )}
                    </td>

                    <td>
                      {
                        item
                          .cumulativeValueMultiple
                          .toFixed(2)
                      }
                      x
                    </td>

                    <td>
                      {
                        item
                          .latestMarginalValueMultiple
                          .toFixed(2)
                      }
                      x
                    </td>

                    <td>
                      <strong>
                        {
                          item
                            .priorityScore
                            .toFixed(1)
                        }
                      </strong>
                    </td>

                    <td>
                      {readable(
                        item
                          .advisoryRecommendation,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.decision,
                      )}
                    </td>

                    <td>
                      {portfolio.status ===
                        "IN_REVIEW"
                      &&
                      item.decision ===
                        "PENDING"
                      &&
                      canFinalize ? (
                        <div className="fwstrategy-decision-box">
                          <textarea
                            rows={3}
                            placeholder="Governance rationale"
                            value={
                              decisionNotes[
                                item.id
                              ] ??
                              ""
                            }
                            onChange={
                              event =>
                                setDecisionNotes(
                                  current => ({
                                    ...current,
                                    [item.id]:
                                      event.target
                                        .value,
                                  }),
                                )
                            }
                          />

                          <div className="fwstrategy-decision-actions">
                            <button
                              type="button"
                              className="button button--primary"
                              disabled={running}
                              onClick={
                                () =>
                                  void decide(
                                    item.id,
                                    "PRIORITIZE",
                                  )
                              }
                            >
                              Prioritize
                            </button>

                            <button
                              type="button"
                              className="button"
                              disabled={running}
                              onClick={
                                () =>
                                  void decide(
                                    item.id,
                                    "HOLD",
                                  )
                              }
                            >
                              Hold
                            </button>

                            <button
                              type="button"
                              className="button"
                              disabled={running}
                              onClick={
                                () =>
                                  void decide(
                                    item.id,
                                    "EXIT",
                                  )
                              }
                            >
                              Exit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="request-primary-cell">
                          <span>
                            {item.decisionNote ??
                              "No final decision yet"}
                          </span>

                          {item.decidedByName ? (
                            <small>
                              By{" "}
                              {
                                item
                                  .decidedByName
                              }
                            </small>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ),
              )}

              {detail.items.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No Step 66 lineage
                    has been added to
                    this portfolio.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {portfolio.status ===
        "DRAFT"
      &&
      canManage ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Freeze candidate set
              </span>

              <h2>
                Submit for governance review
              </h2>
            </div>
          </div>

          <p>
            At least two competing
            lineages are required.
            Current Step 66 authority
            is revalidated before the
            portfolio enters review.
          </p>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                portfolio.itemCount < 2
              }
              onClick={
                () =>
                  void submitReview()
              }
            >
              Submit for review
            </button>
          </div>
        </section>
      ) : null}

      {portfolio.status ===
        "IN_REVIEW"
      &&
      canFinalize ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manager approval
              </span>

              <h2>
                Approve allocation strategy
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Approval rationale
            </span>

            <textarea
              rows={4}
              maxLength={5000}
              value={approvalNote}
              onChange={
                event =>
                  setApprovalNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !allDecided
                ||
                !hasPrioritized
                ||
                !approvalNote.trim()
              }
              onClick={
                () =>
                  void approve()
              }
            >
              Approve portfolio
            </button>
          </div>
        </section>
      ) : null}

      {portfolio.status ===
        "APPROVED"
      &&
      canFinalize ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance lifecycle
              </span>

              <h2>
                Close portfolio
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Closure rationale
            </span>

            <textarea
              rows={4}
              maxLength={5000}
              value={closeNote}
              onChange={
                event =>
                  setCloseNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button"
              disabled={
                running
                ||
                !closeNote.trim()
              }
              onClick={
                () =>
                  void closePortfolio()
              }
            >
              Close portfolio
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable evidence trail
            </span>

            <h2>
              Portfolio snapshots
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Status</th>
                <th>Prioritized</th>
                <th>Remaining</th>
                <th>Utilization</th>
                <th>Captured by</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.snapshots.map(
                current => (
                  <tr
                    key={current.id}
                  >
                    <td>
                      {
                        current
                          .snapshotNumber
                      }
                    </td>

                    <td>
                      {readable(
                        current
                          .portfolioStatus,
                      )}
                    </td>

                    <td>
                      {money(
                        current
                          .prioritizedCapacityAmount,
                        current.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        current
                          .remainingCapacityAmount,
                        current.currency,
                      )}
                    </td>

                    <td>
                      {
                        current
                          .capacityUtilizationPct
                          .toFixed(1)
                      }
                      %
                    </td>

                    <td>
                      {
                        current
                          .capturedByName
                      }
                    </td>

                    <td>
                      <Link
                        href={
                          `/flywheel-strategy/snapshots/${current.id}`
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
    </div>
  );
}
