"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  ReceiptText,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addFlywheelSettlementItem,
  captureFlywheelSettlementSnapshot,
  closeFlywheelSettlementCase,
  getFlywheelSettlementCase,
  reconcileFlywheelSettlementCase,
  submitFlywheelSettlementForReview,
} from "@/lib/api";

import type {
  FlywheelSettlementCaseDetail,
} from "@/types/flywheel-settlement";

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

export default function FlywheelSettlementCasePage() {
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
      FlywheelSettlementCaseDetail |
      null
    >(null);

  const [
    releaseItemId,
    setReleaseItemId,
  ] =
    useState("");

  const [
    settledAmount,
    setSettledAmount,
  ] =
    useState(0);

  const [
    evidenceReference,
    setEvidenceReference,
  ] =
    useState("");

  const [
    evidenceDate,
    setEvidenceDate,
  ] =
    useState(
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),
    );

  const [
    evidenceNote,
    setEvidenceNote,
  ] =
    useState("");

  const [
    reconciliationNote,
    setReconciliationNote,
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
      FlywheelSettlementCaseDetail,
  ) {
    const candidate =
      response.candidates[0];

    if (candidate) {
      setReleaseItemId(
        candidate.releaseItemId,
      );

      setSettledAmount(
        candidate
          .sourceReleasedAmount,
      );

      setEvidenceReference(
        candidate
          .executionReference
          ??
          "",
      );
    } else {
      setReleaseItemId("");
      setSettledAmount(0);
      setEvidenceReference("");
    }
  }

  async function reload() {
    const response =
      await getFlywheelSettlementCase(
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

    getFlywheelSettlementCase(
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
            setReleaseItemId(
              candidate.releaseItemId,
            );

            setSettledAmount(
              candidate
                .sourceReleasedAmount,
            );

            setEvidenceReference(
              candidate
                .executionReference
              ??
              "",
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
                : "Unable to load settlement reconciliation case.",
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

  async function addEvidence(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const response =
        await addFlywheelSettlementItem(
          params.id,
          {
            releaseItemId,

            settledAmount,

            evidenceReference:
              evidenceReference.trim()
                ? evidenceReference.trim()
                : null,

            evidenceDate,

            evidenceNote:
              evidenceNote.trim(),
          },
        );

      setDetail(
        response,
      );

      setEvidenceNote("");

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
          : "Unable to add settlement evidence.",
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
        await submitFlywheelSettlementForReview(
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
          : "Unable to submit reconciliation for review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function reconcile() {
    if (
      !reconciliationNote.trim()
    ) {
      setError(
        "Reconciliation note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await reconcileFlywheelSettlementCase(
          params.id,
          reconciliationNote.trim(),
        ),
      );

      setReconciliationNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to finalize reconciliation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeCase() {
    if (
      !closeNote.trim()
    ) {
      setError(
        "Closure note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeFlywheelSettlementCase(
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
          : "Unable to close reconciliation case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureFlywheelSettlementSnapshot(
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
          : "Unable to capture settlement snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading settlement reconciliation...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-settlement"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Settlement evidence
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Settlement reconciliation case not found."}
        </div>
      </div>
    );
  }

  const settlementCase =
    detail.settlementCase;

  const release =
    detail.releaseAuthority;

  const evidenceComplete =
    settlementCase.itemCount ===
      release.releasedItemCount
    &&
    release.releasedItemCount > 0;

  return (
    <div className="page-stack">
      <Link
        href="/flywheel-settlement"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Settlement evidence
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Release settlement reconciliation
          </span>

          <h1>
            {settlementCase.title}
          </h1>

          <p>
            {
              settlementCase
                .reconciliationNumber
            }
            {" · "}
            {settlementCase.currency}
            {" · "}
            {
              settlementCase
                .releaseNumber
            }
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
              settlementCase.status,
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
            Released
          </span>

          <strong>
            {money(
              settlementCase
                .sourceReleasedAmount,
              settlementCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Settled
          </span>

          <strong>
            {money(
              settlementCase
                .settledAmount,
              settlementCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Variance
          </span>

          <strong>
            {money(
              settlementCase
                .varianceAmount,
              settlementCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Settlement
          </span>

          <strong>
            {
              settlementCase
                .settlementPct
                .toFixed(1)
            }
            %
          </strong>
        </article>

        <article>
          <span>
            Partial
          </span>

          <strong>
            {
              settlementCase
                .partialCount
            }
          </strong>
        </article>

        <article>
          <span>
            Unresolved
          </span>

          <strong>
            {
              settlementCase
                .unresolvedCount
            }
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Step 69/70 source authority
            </span>

            <h2>
              Finalized release
            </h2>
          </div>

          <ReceiptText
            size={19}
          />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>
              Release
            </span>

            <strong>
              {
                release
                  .releaseNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Mandate
            </span>

            <strong>
              {
                release
                  .allocationMandateNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Release owner
            </span>

            <strong>
              {
                release
                  .releaseOwnerName
              }
            </strong>
          </div>

          <div>
            <span>
              Reconciliation owner
            </span>

            <strong>
              {
                settlementCase
                  .reconciliationOwnerName
              }
            </strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>
              Reconciliation rationale
            </span>

            <p>
              {
                settlementCase
                  .reconciliationRationale
              }
            </p>
          </div>
        </div>
      </section>

      {settlementCase.status ===
        "DRAFT"
      &&
      canManage ? (
        <form
          className="panel"
          onSubmit={addEvidence}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manual external evidence
              </span>

              <h2>
                Record settlement evidence
              </h2>
            </div>
          </div>

          {detail.candidates.length >
          0 ? (
            <>
              <div className="fwstrategy-form-grid">
                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Released item
                  </span>

                  <select
                    value={
                      releaseItemId
                    }
                    onChange={
                      event => {
                        const id =
                          event.target.value;

                        setReleaseItemId(
                          id,
                        );

                        const candidate =
                          detail.candidates.find(
                            current =>
                              current
                                .releaseItemId ===
                              id,
                          );

                        if (candidate) {
                          setSettledAmount(
                            candidate
                              .sourceReleasedAmount,
                          );

                          setEvidenceReference(
                            candidate
                              .executionReference
                            ??
                            "",
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
                                .releaseItemId
                            }
                            value={
                              candidate
                                .releaseItemId
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
                                .sourceReleasedAmount,
                              settlementCase.currency,
                            )}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Settled amount
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      settledAmount
                    }
                    onChange={
                      event =>
                        setSettledAmount(
                          Number(
                            event.target
                              .value,
                          ),
                        )
                    }
                  />
                </label>

                <label className="request-field">
                  <span>
                    Evidence date
                  </span>

                  <input
                    type="date"
                    required
                    value={
                      evidenceDate
                    }
                    onChange={
                      event =>
                        setEvidenceDate(
                          event.target.value,
                        )
                    }
                  />
                </label>

                <label className="request-field fwstrategy-form-wide">
                  <span>
                    External evidence reference
                  </span>

                  <input
                    maxLength={300}
                    placeholder="Bank statement, ERP journal, treasury reference..."
                    value={
                      evidenceReference
                    }
                    onChange={
                      event =>
                        setEvidenceReference(
                          event.target.value,
                        )
                    }
                  />
                </label>

                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Evidence note
                  </span>

                  <textarea
                    required
                    rows={4}
                    maxLength={5000}
                    value={
                      evidenceNote
                    }
                    onChange={
                      event =>
                        setEvidenceNote(
                          event.target.value,
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
                    !releaseItemId
                    ||
                    settledAmount < 0
                    ||
                    !evidenceDate
                    ||
                    !evidenceNote.trim()
                    ||
                    (
                      settledAmount > 0
                      &&
                      !evidenceReference.trim()
                    )
                  }
                >
                  Record evidence
                </button>
              </div>
            </>
          ) : (
            <p>
              Every released item has
              settlement evidence.
            </p>
          )}
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Reconciliation evidence
            </span>

            <h2>
              Settlement items
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Released</th>
                <th>Settled</th>
                <th>Variance</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Date</th>
                <th>Evidence</th>
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
                          .sourceReleasedAmount,
                        settlementCase.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .settledAmount,
                        settlementCase.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .varianceAmount,
                        settlementCase.currency,
                      )}
                    </td>

                    <td>
                      {readable(
                        item
                          .reconciliationStatus,
                      )}
                    </td>

                    <td>
                      {
                        item
                          .evidenceReference
                        ??
                        "—"
                      }
                    </td>

                    <td>
                      {
                        item
                          .evidenceDate
                      }
                    </td>

                    <td>
                      {
                        item
                          .evidenceNote
                      }
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
                    No settlement evidence
                    has been recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {settlementCase.status ===
        "DRAFT"
      &&
      canManage ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Evidence completeness gate
              </span>

              <h2>
                Submit reconciliation for review
              </h2>
            </div>
          </div>

          <p>
            Every RELEASED source item
            must have a settlement
            evidence record before the
            case can enter review.
          </p>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !evidenceComplete
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

      {settlementCase.status ===
        "IN_REVIEW"
      &&
      canFinalize ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manager reconciliation authority
              </span>

              <h2>
                Finalize reconciliation
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Reconciliation conclusion
            </span>

            <textarea
              rows={5}
              maxLength={5000}
              value={
                reconciliationNote
              }
              onChange={
                event =>
                  setReconciliationNote(
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
                !reconciliationNote.trim()
              }
              onClick={
                () =>
                  void reconcile()
              }
            >
              Reconcile case
            </button>
          </div>
        </section>
      ) : null}

      {settlementCase.status ===
        "RECONCILED"
      &&
      canFinalize ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance lifecycle
              </span>

              <h2>
                Close reconciliation
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
              value={
                closeNote
              }
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
                  void closeCase()
              }
            >
              Close case
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable reconciliation evidence
            </span>

            <h2>
              Snapshots
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Status</th>
                <th>Settled</th>
                <th>Variance</th>
                <th>Settlement</th>
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
                          .caseStatus,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .settledAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .varianceAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {
                        snapshotItem
                          .settlementPct
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
                          `/flywheel-settlement/snapshots/${snapshotItem.id}`
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
