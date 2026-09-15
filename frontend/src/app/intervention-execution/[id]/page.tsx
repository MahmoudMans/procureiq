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
  acknowledgeInterventionExecution,
  closeInterventionExecutionCase,
  getInterventionExecutionCase,
  recordInterventionExecutionEvidence,
  startInterventionExecution,
  submitInterventionExecutionForVerification,
  verifyInterventionExecution,
} from "@/lib/api";

import type {
  InterventionExecutionCaseDetail,
  InterventionExecutionVerificationDecision,
} from "@/types/intervention-execution";

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

export default function InterventionExecutionCasePage() {
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
      InterventionExecutionCaseDetail |
      null
    >(null);

  const [
    acknowledgementNote,
    setAcknowledgementNote,
  ] =
    useState("");

  const [
    implementedOn,
    setImplementedOn,
  ] =
    useState(
      today(),
    );

  const [
    implementedAmount,
    setImplementedAmount,
  ] =
    useState(0);

  const [
    evidenceNote,
    setEvidenceNote,
  ] =
    useState("");

  const [
    referenceText,
    setReferenceText,
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

    getInterventionExecutionCase(
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
            response.executionCase.approvedAction ===
              "CONTINUE"
          ) {
            setImplementedAmount(0);
          } else {
            setImplementedAmount(
              response.executionCase.remainingImplementationAmount,
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
                : "Unable to load intervention-execution case.",
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
      Promise<InterventionExecutionCaseDetail>,
  ) {
    const response =
      await promise;

    setDetail(
      response,
    );

    if (
      response.executionCase.approvedAction ===
        "CONTINUE"
    ) {
      setImplementedAmount(0);
    } else {
      setImplementedAmount(
        response.executionCase.remainingImplementationAmount,
      );
    }
  }

  async function acknowledge() {
    if (!acknowledgementNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        acknowledgeInterventionExecution(
          params.id,
          acknowledgementNote.trim(),
        ),
      );

      setAcknowledgementNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to acknowledge execution authority.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function start() {
    try {
      setRunning(true);
      setError(null);

      await apply(
        startInterventionExecution(
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
          : "Unable to start intervention execution.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function recordEvidence(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await apply(
        recordInterventionExecutionEvidence(
          params.id,
          {
            implementedOn,
            implementedCapitalAmount:
              implementedAmount,
            evidenceNote:
              evidenceNote.trim(),
            referenceText:
              referenceText.trim(),
          },
        ),
      );

      setEvidenceNote("");
      setReferenceText("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record implementation evidence.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitForVerification() {
    try {
      setRunning(true);
      setError(null);

      await apply(
        submitInterventionExecutionForVerification(
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
          : "Unable to submit execution for verification.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function verify(
    decision:
      InterventionExecutionVerificationDecision,
  ) {
    if (!verificationNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        verifyInterventionExecution(
          params.id,
          {
            decision,
            verificationNote:
              verificationNote.trim(),
          },
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
          : "Unable to verify intervention execution.",
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
        closeInterventionExecutionCase(
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

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading intervention execution...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/intervention-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Intervention execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Intervention-execution case not found."}
        </div>
      </div>
    );
  }

  const executionCase =
    detail.executionCase;

  const canRecordEvidence =
    executionCase.status ===
      "ACTIVE"
    ||
    executionCase.status ===
      "REMEDIATION_REQUIRED";

  return (
    <div className="page-stack">
      <Link
        href="/intervention-execution"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Intervention execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <span className="eyebrow">
            Approved intervention implementation
          </span>

          <h1>
            {executionCase.initiativeTitle}
          </h1>

          <p>
            {executionCase.executionNumber}
            {" · "}
            {executionCase.interventionNumber}
            {" · "}
            {executionCase.fundingCommitmentNumber}
          </p>
        </div>

        <span
          className={
            `execution-status execution-status--${executionCase.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            executionCase.status,
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

      <section className="execution-detail-grid">
        <article>
          <span>
            Approved action
          </span>

          <strong>
            {readable(
              executionCase.approvedAction,
            )}
          </strong>
        </article>

        <article>
          <span>
            Approved affected
          </span>

          <strong>
            {money(
              executionCase.approvedAffectedCapitalAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article className="execution-score-card">
          <span>
            Implemented
          </span>

          <strong>
            {money(
              executionCase.implementedCapitalAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining implementation
          </span>

          <strong>
            {money(
              executionCase.remainingImplementationAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Completion
          </span>

          <strong>
            {executionCase.implementationPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Health
          </span>

          <strong>
            {readable(
              executionCase.executionHealth,
            )}
          </strong>
        </article>
      </section>

      <section className="execution-value-grid">
        <article>
          <span>
            Step 58 released
          </span>

          <strong>
            {money(
              executionCase.currentReleasedCapitalAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Step 58 remaining
          </span>

          <strong>
            {money(
              executionCase.currentRemainingCommitmentAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Implementation variance
          </span>

          <strong>
            {money(
              executionCase.implementationVarianceAmount,
              executionCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Execution owner
          </span>

          <strong>
            {executionCase.executionOwnerName}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Execution authority
            </span>

            <h2>
              Approved decision context
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p className="execution-objective">
          {executionCase.executionObjective}
        </p>

        <div className="execution-context-grid">
          <div>
            <span>
              Source released snapshot
            </span>

            <strong>
              {money(
                executionCase.sourceReleasedCapitalSnapshot,
                executionCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Source remaining snapshot
            </span>

            <strong>
              {money(
                executionCase.sourceRemainingCommitmentSnapshot,
                executionCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Evidence records
            </span>

            <strong>
              {executionCase.evidenceCount}
            </strong>
          </div>

          <div>
            <span>
              Verification records
            </span>

            <strong>
              {executionCase.verificationCount}
            </strong>
          </div>
        </div>

        {executionCase.approvedTargetValueCaseNumber ? (
          <div className="execution-target-note">
            <strong>
              Approved reallocation target
            </strong>

            <p>
              {executionCase.approvedTargetValueCaseNumber}
              {" — "}
              {executionCase.approvedTargetInitiativeTitle}
            </p>
          </div>
        ) : null}
      </section>

      <div className="execution-source-links">
        <Link
          href={
            `/investment-interventions/${executionCase.interventionCaseId}`
          }
          className="table-action"
        >
          Step 60 approved intervention
        </Link>

        <Link
          href={
            `/funding-execution/${executionCase.fundingCommitmentId}`
          }
          className="table-action"
        >
          Step 58 funding evidence
        </Link>
      </div>

      {canManage &&
      executionCase.status ===
        "PLANNED"
      &&
      !executionCase.acknowledged ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Authority acknowledgement
              </span>

              <h2>
                Acknowledge approved intervention
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Acknowledgement note
            </span>

            <textarea
              rows={5}
              value={acknowledgementNote}
              onChange={
                event =>
                  setAcknowledgementNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="execution-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !acknowledgementNote.trim()
              }
              onClick={
                () =>
                  void acknowledge()
              }
            >
              Record acknowledgement
            </button>
          </div>
        </section>
      ) : null}

      {detail.acknowledgement ? (
        <section className="execution-ack-record">
          <strong>
            Immutable execution acknowledgement
          </strong>

          <p>
            {detail.acknowledgement.acknowledgementNote}
          </p>

          <small>
            {detail.acknowledgement.acknowledgedByName}
            {" · "}
            {new Date(
              detail.acknowledgement.acknowledgedAt,
            )
              .toLocaleString()}
          </small>
        </section>
      ) : null}

      {canManage &&
      executionCase.status ===
        "PLANNED"
      &&
      executionCase.acknowledged ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Implementation start
              </span>

              <h2>
                Start execution
              </h2>
            </div>
          </div>

          <div className="execution-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void start()
              }
            >
              Start implementation
            </button>
          </div>
        </section>
      ) : null}

      {canManage &&
      canRecordEvidence ? (
        <form
          className="panel"
          onSubmit={recordEvidence}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Immutable implementation evidence
              </span>

              <h2>
                Record implementation
              </h2>
            </div>
          </div>

          <div className="execution-evidence-form">
            <label className="request-field">
              <span>
                Implemented on
              </span>

              <input
                type="date"
                value={implementedOn}
                onChange={
                  event =>
                    setImplementedOn(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Implemented capital
              </span>

              <input
                type="number"
                min="0"
                max={
                  executionCase.remainingImplementationAmount
                }
                step="0.01"
                disabled={
                  executionCase.approvedAction ===
                    "CONTINUE"
                }
                value={implementedAmount}
                onChange={
                  event =>
                    setImplementedAmount(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field execution-form-wide">
              <span>
                Evidence
              </span>

              <textarea
                required
                rows={5}
                value={evidenceNote}
                onChange={
                  event =>
                    setEvidenceNote(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field execution-form-wide">
              <span>
                Reference / implementation identifier
              </span>

              <input
                required
                value={referenceText}
                onChange={
                  event =>
                    setReferenceText(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="execution-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !evidenceNote.trim()
                ||
                !referenceText.trim()
                ||
                (
                  executionCase.approvedAction !==
                    "CONTINUE"
                  &&
                  implementedAmount <=
                    0
                )
              }
            >
              Record immutable evidence
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Implementation ledger
            </span>

            <h2>
              Evidence history
            </h2>
          </div>
        </div>

        <div className="execution-evidence-list">
          {detail.evidence.map(
            evidence => (
              <article
                key={evidence.id}
              >
                <div className="execution-evidence-heading">
                  <div>
                    <strong>
                      {money(
                        evidence.implementedCapitalAmount,
                        executionCase.currency,
                      )}
                    </strong>

                    <span>
                      {evidence.implementedOn}
                      {" · "}
                      {evidence.referenceText}
                    </span>
                  </div>

                  <small>
                    {evidence.recordedByName}
                  </small>
                </div>

                <p>
                  {evidence.evidenceNote}
                </p>
              </article>
            ),
          )}

          {detail.evidence.length ===
          0 ? (
            <div className="execution-empty">
              No implementation evidence
              has been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      canRecordEvidence &&
      detail.evidence.length >
        0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Verification gate
              </span>

              <h2>
                Submit implementation
              </h2>
            </div>
          </div>

          <p className="execution-governance-copy">
            Submission freezes the current
            reconciliation for independent
            manager verification. Partial
            implementation can be
            submitted, but it cannot be
            VERIFIED until implementation
            reaches 100%.
          </p>

          <div className="execution-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitForVerification()
              }
            >
              Submit for verification
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      executionCase.status ===
        "READY_FOR_VERIFICATION" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent verification
              </span>

              <h2>
                Verify implementation
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Verification note
            </span>

            <textarea
              rows={5}
              value={verificationNote}
              onChange={
                event =>
                  setVerificationNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="execution-decision-actions">
            <button
              type="button"
              disabled={
                running
                ||
                !verificationNote.trim()
                ||
                executionCase.implementationPct !==
                  100
              }
              onClick={
                () =>
                  void verify(
                    "VERIFIED",
                  )
              }
            >
              Verify execution
            </button>

            <button
              type="button"
              className="execution-danger-button"
              disabled={
                running
                ||
                !verificationNote.trim()
              }
              onClick={
                () =>
                  void verify(
                    "REMEDIATION_REQUIRED",
                  )
              }
            >
              Require remediation
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable verification history
            </span>

            <h2>
              Execution verification
            </h2>
          </div>
        </div>

        <div className="execution-verification-list">
          {detail.verifications.map(
            verification => (
              <article
                key={verification.id}
              >
                <div>
                  <strong>
                    {readable(
                      verification.decision,
                    )}
                  </strong>

                  <span>
                    {verification.implementationPct.toFixed(
                      1,
                    )}
                    {"% · "}
                    {money(
                      verification.implementedCapitalAmount,
                      executionCase.currency,
                    )}
                    {" implemented"}
                  </span>
                </div>

                <p>
                  {verification.verificationNote}
                </p>

                <small>
                  Remaining:
                  {" "}
                  {money(
                    verification.remainingImplementationAmount,
                    executionCase.currency,
                  )}
                  {" · "}
                  {verification.verifiedByName}
                  {" · "}
                  {new Date(
                    verification.verifiedAt,
                  )
                    .toLocaleString()}
                </small>
              </article>
            ),
          )}

          {detail.verifications.length ===
          0 ? (
            <div className="execution-empty">
              No verification decision has
              been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canFinalize &&
      executionCase.status ===
        "VERIFIED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance closure
              </span>

              <h2>
                Close execution case
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

          <div className="execution-form-actions">
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
              Close execution case
            </button>
          </div>
        </section>
      ) : null}

      <section className="execution-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Implemented capital is evidence, not a retroactive ledger edit
          </strong>

          <p>
            The implementation ledger
            reconciles approved Step 60
            intervention amounts with
            documented execution. It does
            not delete, rewrite or reverse
            Step 58 release records.
          </p>
        </div>
      </section>
    </div>
  );
}
