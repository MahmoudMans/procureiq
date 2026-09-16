"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  ClipboardCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addFlywheelVarianceExecutionItem,
  captureFlywheelVarianceExecutionSnapshot,
  closeFlywheelVarianceExecutionCase,
  getFlywheelVarianceExecutionCase,
  submitFlywheelVarianceExecutionForReview,
  verifyFlywheelVarianceExecutionCase,
} from "@/lib/api";

import type {
  FlywheelVarianceExecutionCaseDetail,
  FlywheelVarianceExecutionOutcome,
} from "@/types/flywheel-variance-execution";

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

export default function FlywheelVarianceExecutionCasePage() {
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
      FlywheelVarianceExecutionCaseDetail |
      null
    >(null);

  const [
    varianceItemId,
    setVarianceItemId,
  ] =
    useState("");

  const [
    executedAmount,
    setExecutedAmount,
  ] =
    useState(0);

  const [
    outcome,
    setOutcome,
  ] =
    useState<FlywheelVarianceExecutionOutcome>(
      "COMPLETED",
    );

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
    verificationNote,
    setVerificationNote,
  ] =
    useState("");

  const [
    closeNote,
    setCloseNote,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
  ] =
    useState(false);

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

  const canVerify =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  function applyCandidateDefaults(
    response:
      FlywheelVarianceExecutionCaseDetail,
  ) {
    const candidate =
      response.candidates[0];

    if (!candidate) {
      setVarianceItemId("");
      setExecutedAmount(0);
      setOutcome(
        "COMPLETED",
      );
      setEvidenceReference("");
      return;
    }

    setVarianceItemId(
      candidate.varianceItemId,
    );

    if (
      candidate.sourceDecision ===
      "INVESTIGATE"
    ) {
      setExecutedAmount(0);
      setOutcome(
        "COMPLETED",
      );
      setEvidenceReference("");
    } else {
      setExecutedAmount(
        candidate.sourceVarianceAmount,
      );

      setOutcome(
        "COMPLETED",
      );
    }
  }

  async function reload() {
    const response =
      await getFlywheelVarianceExecutionCase(
        params.id,
      );

    setDetail(
      response,
    );

    applyCandidateDefaults(
      response,
    );
  }

  useEffect(() => {
    let active = true;

    getFlywheelVarianceExecutionCase(
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
            setVarianceItemId(
              candidate.varianceItemId,
            );

            if (
              candidate.sourceDecision ===
              "INVESTIGATE"
            ) {
              setExecutedAmount(0);
              setOutcome(
                "COMPLETED",
              );
            } else {
              setExecutedAmount(
                candidate
                  .sourceVarianceAmount,
              );

              setOutcome(
                "COMPLETED",
              );
            }
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
                : "Unable to load treatment execution case.",
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
        await addFlywheelVarianceExecutionItem(
          params.id,
          {
            varianceItemId,

            executedAmount,

            outcome,

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

      setEvidenceReference("");
      setEvidenceNote("");

      applyCandidateDefaults(
        response,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record treatment execution evidence.",
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
        await submitFlywheelVarianceExecutionForReview(
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
          : "Unable to submit execution evidence for review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function verify() {
    if (
      !verificationNote.trim()
    ) {
      setError(
        "Verification note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await verifyFlywheelVarianceExecutionCase(
          params.id,
          verificationNote.trim(),
        ),
      );

      setVerificationNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to verify execution evidence.",
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
        await closeFlywheelVarianceExecutionCase(
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
          : "Unable to close execution case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureFlywheelVarianceExecutionSnapshot(
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
          : "Unable to capture execution snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading treatment execution...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-variance-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Treatment execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Treatment execution case not found."}
        </div>
      </div>
    );
  }

  const executionCase =
    detail.executionCase;

  const source =
    detail.sourceAuthority;

  const selectedCandidate =
    detail.candidates.find(
      candidate =>
        candidate.varianceItemId ===
        varianceItemId,
    );

  const isInvestigation =
    selectedCandidate
      ?.sourceDecision ===
    "INVESTIGATE";

  const completeEvidence =
    executionCase.itemCount ===
      source.itemCount
    &&
    source.itemCount > 0
    &&
    detail.candidates.length === 0;

  return (
    <div className="page-stack">
      <Link
        href="/flywheel-variance-execution"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Treatment execution
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Step 73 treatment evidence
          </span>

          <h1>
            {executionCase.title}
          </h1>

          <p>
            {
              executionCase
                .executionNumber
            }
            {" · "}
            {executionCase.currency}
            {" · "}
            {
              executionCase
                .variancePlanNumber
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
              executionCase.status,
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
            Source variance
          </span>

          <strong>
            {money(
              executionCase
                .sourceVarianceAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Recovered
          </span>

          <strong>
            {money(
              executionCase
                .recoveredAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Written off
          </span>

          <strong>
            {money(
              executionCase
                .writtenOffAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Investigation completed
          </span>

          <strong>
            {money(
              executionCase
                .completedInvestigationAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Financial residual
          </span>

          <strong>
            {money(
              executionCase.exposure.financialResidualAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Treatment completion
          </span>

          <strong>
            {
              executionCase
                .completionPct
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
              Step 73 authority
            </span>

            <h2>
              Approved variance plan
            </h2>
          </div>

          <ClipboardCheck
            size={19}
          />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>
              Variance plan
            </span>

            <strong>
              {
                source
                  .variancePlanNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Reconciliation
            </span>

            <strong>
              {
                source
                  .reconciliationNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Step 73 owner
            </span>

            <strong>
              {
                source
                  .planOwnerName
              }
            </strong>
          </div>

          <div>
            <span>
              Execution owner
            </span>

            <strong>
              {
                executionCase
                  .executionOwnerName
              }
            </strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>
              Execution objective
            </span>

            <p>
              {
                executionCase
                  .executionObjective
              }
            </p>
          </div>
        </div>
      </section>

      {executionCase.status ===
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
                External action evidence
              </span>

              <h2>
                Record treatment execution
              </h2>
            </div>
          </div>

          {detail.candidates.length >
          0 ? (
            <>
              <div className="fwstrategy-form-grid">
                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Step 73 treatment
                  </span>

                  <select
                    required
                    value={
                      varianceItemId
                    }
                    onChange={
                      event => {
                        const id =
                          event.target.value;

                        setVarianceItemId(
                          id,
                        );

                        const candidate =
                          detail.candidates.find(
                            current =>
                              current
                                .varianceItemId ===
                              id,
                          );

                        if (
                          candidate
                            ?.sourceDecision ===
                          "INVESTIGATE"
                        ) {
                          setExecutedAmount(0);
                          setOutcome(
                            "COMPLETED",
                          );
                          setEvidenceReference("");
                        } else if (
                          candidate
                        ) {
                          setExecutedAmount(
                            candidate
                              .sourceVarianceAmount,
                          );

                          setOutcome(
                            "COMPLETED",
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
                                .varianceItemId
                            }
                            value={
                              candidate
                                .varianceItemId
                            }
                          >
                            {
                              candidate
                                .rootTargetInitiativeTitle
                            }
                            {" — "}
                            {
                              candidate
                                .sourceDecision
                            }
                            {" — "}
                            {money(
                              candidate
                                .sourceVarianceAmount,
                              executionCase.currency,
                            )}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Outcome
                  </span>

                  <select
                    value={outcome}
                    onChange={
                      event =>
                        setOutcome(
                          event.target
                            .value as
                            FlywheelVarianceExecutionOutcome,
                        )
                    }
                  >
                    <option value="COMPLETED">
                      Completed
                    </option>

                    {!isInvestigation ? (
                      <option value="PARTIAL">
                        Partial
                      </option>
                    ) : null}

                    <option value="UNRESOLVED">
                      Unresolved
                    </option>
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Executed financial amount
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={
                      isInvestigation
                    }
                    value={
                      executedAmount
                    }
                    onChange={
                      event =>
                        setExecutedAmount(
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
                    placeholder="Bank reference, ERP journal, accounting record, investigation file..."
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
                    rows={5}
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
                    !varianceItemId
                    ||
                    executedAmount < 0
                    ||
                    !evidenceDate
                    ||
                    !evidenceNote.trim()
                    ||
                    (
                      executedAmount > 0
                      &&
                      !evidenceReference.trim()
                    )
                  }
                >
                  Record execution evidence
                </button>
              </div>
            </>
          ) : (
            <p>
              Every Step 73 treatment
              decision has execution
              evidence.
            </p>
          )}
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Recorded evidence
            </span>

            <h2>
              Treatment executions
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Decision</th>
                <th>Variance</th>
                <th>Executed</th>
                <th>Financial residual</th>
                <th>Outcome</th>
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
                      {readable(
                        item
                          .sourceDecision,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .sourceVarianceAmount,
                        executionCase.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .executedAmount,
                        executionCase.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.financialResidualAmount,
                        executionCase.currency,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.outcome,
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
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No treatment
                    execution evidence
                    has been recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {executionCase.status ===
        "DRAFT"
      &&
      canManage ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Evidence completeness
              </span>

              <h2>
                Submit for verification
              </h2>
            </div>
          </div>

          <p>
            Every Step 73 treatment
            decision requires one
            immutable execution-evidence
            record before review.
          </p>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !completeEvidence
              }
              onClick={
                () =>
                  void submitReview()
              }
            >
              Submit for verification
            </button>
          </div>
        </section>
      ) : null}

      {executionCase.status ===
        "IN_REVIEW"
      &&
      canVerify ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manager evidence verification
              </span>

              <h2>
                Verify treatment execution
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Verification conclusion
            </span>

            <textarea
              rows={5}
              maxLength={5000}
              value={
                verificationNote
              }
              onChange={
                event =>
                  setVerificationNote(
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
                !verificationNote.trim()
              }
              onClick={
                () =>
                  void verify()
              }
            >
              Verify execution evidence
            </button>
          </div>
        </section>
      ) : null}

      {executionCase.status ===
        "VERIFIED"
      &&
      canVerify ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Evidence lifecycle
              </span>

              <h2>
                Close execution case
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
                  void closeCase()
              }
            >
              Close execution case
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
                <th>Recovered</th>
                <th>Written off</th>
                <th>Investigation</th>
                <th>Financial residual</th>
                <th>Treatment completion</th>
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
                          .recoveredAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .writtenOffAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .completedInvestigationAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem.exposure.financialResidualAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {
                        snapshotItem
                          .completionPct
                          .toFixed(1)
                      }
                      %
                    </td>

                    <td>
                      <Link
                        href={
                          `/flywheel-variance-execution/snapshots/${snapshotItem.id}`
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

      <section className="panel">
        <h2>Financial residual and evidence coverage</h2>
        <p>
          Financial residual equals approved variance minus recorded recoveries
          and recorded write-offs. Completing an investigation does not reduce
          that residual. Treatment completion measures workflow progress, not
          cash recovered or accounting entries posted by ProcureIQ.
        </p>

          <p>
            Variance without recorded evidence: {money(
              executionCase.exposure.unrecordedVarianceAmount, executionCase.currency,
            )}. Evidence coverage: {executionCase.exposure.evidenceCoveragePct.toFixed(2)}%.
          </p>
      </section>
    </div>
  );
}
