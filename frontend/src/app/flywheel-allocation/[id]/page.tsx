"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Landmark,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addFlywheelAllocationItem,
  authorizeFlywheelAllocationMandate,
  captureFlywheelAllocationSnapshot,
  closeFlywheelAllocationMandate,
  getFlywheelAllocationMandate,
  submitFlywheelAllocationForReview,
} from "@/lib/api";

import type {
  FlywheelAllocationMandateDetail,
} from "@/types/flywheel-allocation";

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

export default function FlywheelAllocationMandatePage() {
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
      FlywheelAllocationMandateDetail |
      null
    >(null);

  const [
    strategyItemId,
    setStrategyItemId,
  ] =
    useState("");

  const [
    requestedAmount,
    setRequestedAmount,
  ] =
    useState(0);

  const [
    authorizationNote,
    setAuthorizationNote,
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

  const canAuthorize =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  function syncCandidate(
    response:
      FlywheelAllocationMandateDetail,
  ) {
    const candidate =
      response.candidates[0];

    if (candidate) {
      setStrategyItemId(
        candidate.strategyItemId,
      );

      setRequestedAmount(
        candidate
          .strategyProposedCapacityAmount,
      );
    } else {
      setStrategyItemId("");
      setRequestedAmount(0);
    }
  }

  async function reload() {
    const response =
      await getFlywheelAllocationMandate(
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

    getFlywheelAllocationMandate(
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
            setStrategyItemId(
              candidate.strategyItemId,
            );

            setRequestedAmount(
              candidate
                .strategyProposedCapacityAmount,
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
                : "Unable to load allocation mandate.",
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
        await addFlywheelAllocationItem(
          params.id,
          {
            strategyItemId,

            requestedAllocationAmount:
              requestedAmount,
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
          : "Unable to add allocation item.",
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
        await submitFlywheelAllocationForReview(
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
          : "Unable to submit mandate for review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function authorize() {
    if (!authorizationNote.trim()) {
      setError(
        "Authorization note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await authorizeFlywheelAllocationMandate(
          params.id,
          authorizationNote.trim(),
        ),
      );

      setAuthorizationNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to authorize mandate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeMandate() {
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
        await closeFlywheelAllocationMandate(
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
          : "Unable to close mandate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureFlywheelAllocationSnapshot(
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
          : "Unable to capture mandate snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading allocation mandate...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-allocation"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital mandates
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Allocation mandate not found."}
        </div>
      </div>
    );
  }

  const mandate =
    detail.mandate;

  const strategy =
    detail.strategyAuthority;

  return (
    <div className="page-stack">
      <Link
        href="/flywheel-allocation"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital mandates
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Governed capital authorization
          </span>

          <h1>
            {mandate.title}
          </h1>

          <p>
            {mandate.mandateNumber}
            {" · "}
            {mandate.currency}
            {" · FY "}
            {mandate.fiscalYear}
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
              mandate.status,
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
            Step 67 prioritized
          </span>

          <strong>
            {money(
              mandate
                .strategyPrioritizedCapacityAmount,
              mandate.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Requested allocation
          </span>

          <strong>
            {money(
              mandate
                .requestedAllocationAmount,
              mandate.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining capacity
          </span>

          <strong>
            {money(
              mandate
                .remainingStrategyCapacityAmount,
              mandate.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {
              mandate
                .allocationUtilizationPct
                .toFixed(1)
            }
            %
          </strong>
        </article>

        <article>
          <span>
            Allocation items
          </span>

          <strong>
            {mandate.itemCount}
          </strong>
        </article>

        <article>
          <span>
            Strategy priority avg
          </span>

          <strong>
            {
              strategy
                .averagePriorityScore
                .toFixed(1)
            }
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Step 67 source authority
            </span>

            <h2>
              Approved strategy
            </h2>
          </div>

          <Landmark
            size={19}
          />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>
              Portfolio
            </span>

            <strong>
              {
                strategy
                  .strategyPortfolioNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Strategy owner
            </span>

            <strong>
              {
                strategy
                  .strategyOwnerName
              }
            </strong>
          </div>

          <div>
            <span>
              Mandate owner
            </span>

            <strong>
              {
                mandate
                  .mandateOwnerName
              }
            </strong>
          </div>

          <div>
            <span>
              Strategy status
            </span>

            <strong>
              {readable(
                strategy.status,
              )}
            </strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>
              Mandate rationale
            </span>

            <p>
              {
                mandate
                  .mandateRationale
              }
            </p>
          </div>
        </div>
      </section>

      {mandate.status ===
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
                PRIORITIZE decisions only
              </span>

              <h2>
                Add allocation item
              </h2>
            </div>
          </div>

          {detail.candidates.length >
          0 ? (
            <>
              <div className="fwstrategy-form-grid">
                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Strategy lineage
                  </span>

                  <select
                    value={
                      strategyItemId
                    }
                    onChange={
                      event => {
                        const id =
                          event.target.value;

                        setStrategyItemId(
                          id,
                        );

                        const candidate =
                          detail.candidates.find(
                            current =>
                              current
                                .strategyItemId ===
                              id,
                          );

                        if (candidate) {
                          setRequestedAmount(
                            candidate
                              .strategyProposedCapacityAmount,
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
                                .strategyItemId
                            }
                            value={
                              candidate
                                .strategyItemId
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
                            {" — "}
                            {money(
                              candidate
                                .strategyProposedCapacityAmount,
                              mandate.currency,
                            )}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Requested allocation
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      requestedAmount
                    }
                    onChange={
                      event =>
                        setRequestedAmount(
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
                    !strategyItemId
                    ||
                    requestedAmount <=
                      0
                  }
                >
                  Add allocation
                </button>
              </div>
            </>
          ) : (
            <p>
              Every available Step 67
              prioritized lineage has
              already been added to
              this mandate.
            </p>
          )}
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen strategy allocation inputs
            </span>

            <h2>
              Mandate items
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Step 67 proposed</th>
                <th>Requested</th>
                <th>Priority</th>
                <th>Advisory</th>
                <th>Added by</th>
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
                          .strategyProposedCapacityAmount,
                        mandate.currency,
                      )}
                    </td>

                    <td>
                      <strong>
                        {money(
                          item
                            .requestedAllocationAmount,
                          mandate.currency,
                        )}
                      </strong>
                    </td>

                    <td>
                      {
                        item
                          .strategyPriorityScore
                          .toFixed(1)
                      }
                    </td>

                    <td>
                      {readable(
                        item
                          .strategyAdvisoryRecommendation,
                      )}
                    </td>

                    <td>
                      {item.addedByName}
                    </td>
                  </tr>
                ),
              )}

              {detail.items.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="table-empty-state"
                  >
                    No allocation item
                    has been added.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {mandate.status ===
        "DRAFT"
      &&
      canManage ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Revalidate Step 67 authority
              </span>

              <h2>
                Submit for authorization review
              </h2>
            </div>
          </div>

          <p>
            Submission freezes the
            current allocation plan for
            manager review and rechecks
            the source Step 67 portfolio
            and every prioritized item.
          </p>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                mandate.itemCount ===
                  0
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

      {mandate.status ===
        "IN_REVIEW"
      &&
      canAuthorize ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manager capital authority
              </span>

              <h2>
                Authorize mandate
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Authorization rationale
            </span>

            <textarea
              rows={4}
              maxLength={5000}
              value={
                authorizationNote
              }
              onChange={
                event =>
                  setAuthorizationNote(
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
                !authorizationNote.trim()
              }
              onClick={
                () =>
                  void authorize()
              }
            >
              Authorize mandate
            </button>
          </div>
        </section>
      ) : null}

      {mandate.status ===
        "AUTHORIZED"
      &&
      canAuthorize ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Authorization lifecycle
              </span>

              <h2>
                Close mandate
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
                  void closeMandate()
              }
            >
              Close mandate
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable evidence
            </span>

            <h2>
              Mandate snapshots
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Remaining</th>
                <th>Utilization</th>
                <th>Captured by</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.snapshots.map(
                snapshotItem => (
                  <tr
                    key={
                      snapshotItem.id
                    }
                  >
                    <td>
                      {
                        snapshotItem
                          .snapshotNumber
                      }
                    </td>

                    <td>
                      {readable(
                        snapshotItem
                          .mandateStatus,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .requestedAllocationAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .remainingStrategyCapacityAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {
                        snapshotItem
                          .allocationUtilizationPct
                          .toFixed(1)
                      }
                      %
                    </td>

                    <td>
                      {
                        snapshotItem
                          .capturedByName
                      }
                    </td>

                    <td>
                      <Link
                        href={
                          `/flywheel-allocation/snapshots/${snapshotItem.id}`
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
