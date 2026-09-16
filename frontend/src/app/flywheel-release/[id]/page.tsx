"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  WalletCards,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addFlywheelReleaseItem,
  cancelFlywheelReleaseItem,
  captureFlywheelReleaseSnapshot,
  closeFlywheelReleaseBatch,
  executeFlywheelReleaseItem,
  finalizeFlywheelReleaseBatch,
  getFlywheelReleaseBatch,
  submitFlywheelReleaseForExecution,
} from "@/lib/api";

import type {
  FlywheelReleaseBatchDetail,
} from "@/types/flywheel-release";

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

export default function FlywheelReleaseBatchPage() {
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
      FlywheelReleaseBatchDetail |
      null
    >(null);

  const [
    allocationItemId,
    setAllocationItemId,
  ] =
    useState("");

  const [
    plannedReleaseAmount,
    setPlannedReleaseAmount,
  ] =
    useState(0);

  const [
    executionReferences,
    setExecutionReferences,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    executionNotes,
    setExecutionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    cancellationNotes,
    setCancellationNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    finalizationNote,
    setFinalizationNote,
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

  const canExecute =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  function syncCandidate(
    response:
      FlywheelReleaseBatchDetail,
  ) {
    const candidate =
      response.candidates[0];

    if (candidate) {
      setAllocationItemId(
        candidate.allocationItemId,
      );

      setPlannedReleaseAmount(
        candidate
          .remainingReleaseAuthorityAmount,
      );
    } else {
      setAllocationItemId("");
      setPlannedReleaseAmount(0);
    }
  }

  async function reload() {
    const response =
      await getFlywheelReleaseBatch(
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

    getFlywheelReleaseBatch(
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
            setAllocationItemId(
              candidate
                .allocationItemId,
            );

            setPlannedReleaseAmount(
              candidate
                .remainingReleaseAuthorityAmount,
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
                : "Unable to load release batch.",
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
        await addFlywheelReleaseItem(
          params.id,
          {
            allocationItemId,

            plannedReleaseAmount,
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
          : "Unable to add release item.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitExecution() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await submitFlywheelReleaseForExecution(
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
          : "Unable to submit release batch for execution.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function executeItem(
    itemId: string,
  ) {
    const reference =
      executionReferences[
        itemId
      ]
      ??
      "";

    const note =
      executionNotes[
        itemId
      ]
      ??
      "";

    if (
      !reference.trim()
      ||
      !note.trim()
    ) {
      setError(
        "Execution reference and execution note are required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await executeFlywheelReleaseItem(
          itemId,
          {
            executionReference:
              reference.trim(),

            executionNote:
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
          : "Unable to record release execution.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelItem(
    itemId: string,
  ) {
    const note =
      cancellationNotes[
        itemId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Cancellation rationale is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await cancelFlywheelReleaseItem(
          itemId,
          note.trim(),
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel release item.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function finalizeBatch() {
    if (!finalizationNote.trim()) {
      setError(
        "Batch execution note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await finalizeFlywheelReleaseBatch(
          params.id,
          finalizationNote.trim(),
        ),
      );

      setFinalizationNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to finalize release batch.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeBatch() {
    if (!closeNote.trim()) {
      setError(
        "Closure rationale is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeFlywheelReleaseBatch(
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
          : "Unable to close release batch.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureFlywheelReleaseSnapshot(
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
          : "Unable to capture release snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading release batch...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-release"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital release
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Release batch not found."}
        </div>
      </div>
    );
  }

  const batch =
    detail.batch;

  const authority =
    detail.mandateAuthority;

  const allFinal =
    batch.itemCount > 0
    &&
    batch.pendingCount === 0;

  const hasReleased =
    batch.releasedCount > 0;

  return (
    <div className="page-stack">
      <Link
        href="/flywheel-release"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital release
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Controlled release execution
          </span>

          <h1>
            {batch.title}
          </h1>

          <p>
            {batch.releaseNumber}
            {" · "}
            {batch.currency}
            {" · FY "}
            {batch.fiscalYear}
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
              batch.status,
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
            Mandate authority
          </span>

          <strong>
            {money(
              batch
                .mandateAuthorizedAmount,
              batch.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Batch planned
          </span>

          <strong>
            {money(
              batch
                .batchPlannedReleaseAmount,
              batch.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Batch released
          </span>

          <strong>
            {money(
              batch
                .batchReleasedAmount,
              batch.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Cumulative released
          </span>

          <strong>
            {money(
              batch
                .cumulativeMandateReleasedAmount,
              batch.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining mandate
          </span>

          <strong>
            {money(
              batch
                .remainingMandateAmount,
              batch.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {
              batch
                .cumulativeReleaseUtilizationPct
                .toFixed(1)
            }
            %
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Step 68 execution authority
            </span>

            <h2>
              Authorized mandate
            </h2>
          </div>

          <WalletCards
            size={19}
          />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>
              Mandate
            </span>

            <strong>
              {
                authority
                  .allocationMandateNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Strategy
            </span>

            <strong>
              {
                authority
                  .strategyPortfolioNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Mandate owner
            </span>

            <strong>
              {
                authority
                  .mandateOwnerName
              }
            </strong>
          </div>

          <div>
            <span>
              Release owner
            </span>

            <strong>
              {
                batch
                  .releaseOwnerName
              }
            </strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>
              Release rationale
            </span>

            <p>
              {
                batch
                  .releaseRationale
              }
            </p>
          </div>
        </div>
      </section>

      {batch.status ===
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
                Authorized allocation items
              </span>

              <h2>
                Add release item
              </h2>
            </div>
          </div>

          {detail.candidates.length >
          0 ? (
            <>
              <div className="fwstrategy-form-grid">
                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Allocation item
                  </span>

                  <select
                    value={
                      allocationItemId
                    }
                    onChange={
                      event => {
                        const id =
                          event.target.value;

                        setAllocationItemId(
                          id,
                        );

                        const candidate =
                          detail.candidates.find(
                            current =>
                              current
                                .allocationItemId ===
                              id,
                          );

                        if (candidate) {
                          setPlannedReleaseAmount(
                            candidate
                              .remainingReleaseAuthorityAmount,
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
                                .allocationItemId
                            }
                            value={
                              candidate
                                .allocationItemId
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
                            {" — remaining "}
                            {money(
                              candidate
                                .remainingReleaseAuthorityAmount,
                              batch.currency,
                            )}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Planned release
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      plannedReleaseAmount
                    }
                    onChange={
                      event =>
                        setPlannedReleaseAmount(
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
                    !allocationItemId
                    ||
                    plannedReleaseAmount <=
                      0
                  }
                >
                  Add release item
                </button>
              </div>
            </>
          ) : (
            <p>
              No additional Step 68
              allocation item has
              remaining release
              authority for this batch.
            </p>
          )}
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Execution evidence
            </span>

            <h2>
              Release items
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Authorized</th>
                <th>Planned</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Execution</th>
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
                          .mandateAuthorizedItemAmount,
                        batch.currency,
                      )}
                    </td>

                    <td>
                      <strong>
                        {money(
                          item
                            .plannedReleaseAmount,
                          batch.currency,
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
                        item.status,
                      )}
                    </td>

                    <td>
                      {batch.status ===
                        "IN_EXECUTION"
                      &&
                      item.status ===
                        "PENDING"
                      &&
                      canExecute ? (
                        <div className="fwstrategy-decision-box">
                          <input
                            placeholder="Execution reference"
                            value={
                              executionReferences[
                                item.id
                              ]
                              ??
                              ""
                            }
                            onChange={
                              event =>
                                setExecutionReferences(
                                  current => ({
                                    ...current,
                                    [item.id]:
                                      event.target
                                        .value,
                                  }),
                                )
                            }
                          />

                          <textarea
                            rows={3}
                            placeholder="Execution evidence note"
                            value={
                              executionNotes[
                                item.id
                              ]
                              ??
                              ""
                            }
                            onChange={
                              event =>
                                setExecutionNotes(
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
                                  void executeItem(
                                    item.id,
                                  )
                              }
                            >
                              Record release
                            </button>
                          </div>

                          <textarea
                            rows={2}
                            placeholder="Cancellation rationale"
                            value={
                              cancellationNotes[
                                item.id
                              ]
                              ??
                              ""
                            }
                            onChange={
                              event =>
                                setCancellationNotes(
                                  current => ({
                                    ...current,
                                    [item.id]:
                                      event.target
                                        .value,
                                  }),
                                )
                            }
                          />

                          <button
                            type="button"
                            className="button"
                            disabled={running}
                            onClick={
                              () =>
                                void cancelItem(
                                  item.id,
                                )
                            }
                          >
                            Cancel item
                          </button>
                        </div>
                      ) : (
                        <div className="request-primary-cell">
                          {item.executionReference ? (
                            <strong>
                              {
                                item
                                  .executionReference
                              }
                            </strong>
                          ) : null}

                          <span>
                            {
                              item.executionNote
                              ??
                              item.cancellationNote
                              ??
                              "Awaiting execution"
                            }
                          </span>

                          {item.releasedByName ? (
                            <small>
                              Released by{" "}
                              {
                                item
                                  .releasedByName
                              }
                            </small>
                          ) : null}

                          {item.cancelledByName ? (
                            <small>
                              Cancelled by{" "}
                              {
                                item
                                  .cancelledByName
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
                    colSpan={6}
                    className="table-empty-state"
                  >
                    No release item has
                    been added.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {batch.status ===
        "DRAFT"
      &&
      canManage ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Revalidate Step 68 authority
              </span>

              <h2>
                Submit for execution
              </h2>
            </div>
          </div>

          <p>
            Submission checks the
            authorized Step 68 mandate,
            every source allocation item
            and cumulative historical
            release usage.
          </p>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                batch.itemCount ===
                  0
              }
              onClick={
                () =>
                  void submitExecution()
              }
            >
              Submit for execution
            </button>
          </div>
        </section>
      ) : null}

      {batch.status ===
        "IN_EXECUTION"
      &&
      canExecute ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manager execution confirmation
              </span>

              <h2>
                Finalize release batch
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Batch execution note
            </span>

            <textarea
              rows={4}
              maxLength={5000}
              value={
                finalizationNote
              }
              onChange={
                event =>
                  setFinalizationNote(
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
                !allFinal
                ||
                !hasReleased
                ||
                !finalizationNote.trim()
              }
              onClick={
                () =>
                  void finalizeBatch()
              }
            >
              Mark batch executed
            </button>
          </div>
        </section>
      ) : null}

      {batch.status ===
        "EXECUTED"
      &&
      canExecute ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Release lifecycle
              </span>

              <h2>
                Close release batch
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
                  void closeBatch()
              }
            >
              Close release batch
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable execution evidence
            </span>

            <h2>
              Release snapshots
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Status</th>
                <th>Released</th>
                <th>Cumulative</th>
                <th>Remaining</th>
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
                          .releaseStatus,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .batchReleasedAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .cumulativeMandateReleasedAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .remainingMandateAmount,
                        snapshotItem
                          .currency,
                      )}
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
                          `/flywheel-release/snapshots/${snapshotItem.id}`
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
