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
  activateCapitalRedeployment,
  authorizeCapitalRedeployment,
  closeCapitalRedeploymentCase,
  createCapitalRedeploymentGate,
  decideCapitalRedeploymentGate,
  getCapitalRedeploymentCase,
  recordCapitalRedeploymentRelease,
  submitCapitalRedeploymentForAuthorization,
  submitCapitalRedeploymentForVerification,
  verifyCapitalRedeployment,
} from "@/lib/api";

import type {
  CapitalRedeploymentAuthorizationDecision,
  CapitalRedeploymentCaseDetail,
  CapitalRedeploymentGateStatus,
  CapitalRedeploymentVerificationDecision,
} from "@/types/capital-redeployment";

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

export default function CapitalRedeploymentCasePage() {
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
      CapitalRedeploymentCaseDetail |
      null
    >(null);

  const [
    gateTitle,
    setGateTitle,
  ] =
    useState("");

  const [
    gateRequirement,
    setGateRequirement,
  ] =
    useState("");

  const [
    gateEvidence,
    setGateEvidence,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    gateNotes,
    setGateNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    authorizationNote,
    setAuthorizationNote,
  ] =
    useState("");

  const [
    releasedOn,
    setReleasedOn,
  ] =
    useState(
      today(),
    );

  const [
    releasedAmount,
    setReleasedAmount,
  ] =
    useState(0);

  const [
    releaseEvidence,
    setReleaseEvidence,
  ] =
    useState("");

  const [
    releaseReference,
    setReleaseReference,
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

    getCapitalRedeploymentCase(
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

          setReleasedAmount(
            response.redeploymentCase.remainingRedeploymentAmount,
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
                : "Unable to load capital-redeployment case.",
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
      Promise<CapitalRedeploymentCaseDetail>,
  ) {
    const response =
      await promise;

    setDetail(
      response,
    );

    setReleasedAmount(
      response.redeploymentCase.remainingRedeploymentAmount,
    );
  }

  async function createGate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await apply(
        createCapitalRedeploymentGate(
          params.id,
          {
            title:
              gateTitle.trim(),
            requirement:
              gateRequirement.trim(),
          },
        ),
      );

      setGateTitle("");
      setGateRequirement("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create redeployment gate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideGate(
    gateId: string,
    decision:
      CapitalRedeploymentGateStatus,
  ) {
    const evidence =
      gateEvidence[
        gateId
      ]
      ??
      "";

    const note =
      gateNotes[
        gateId
      ]
      ??
      "";

    if (
      !evidence.trim()
      ||
      !note.trim()
    ) {
      setError(
        "Gate evidence and decision note are required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        decideCapitalRedeploymentGate(
          gateId,
          {
            decision,
            evidenceNote:
              evidence.trim(),
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
          : "Unable to decide redeployment gate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitAuthorization() {
    try {
      setRunning(true);
      setError(null);

      await apply(
        submitCapitalRedeploymentForAuthorization(
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
          : "Unable to submit redeployment for authorization.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function authorize(
    decision:
      CapitalRedeploymentAuthorizationDecision,
  ) {
    if (!authorizationNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        authorizeCapitalRedeployment(
          params.id,
          {
            decision,
            authorizationNote:
              authorizationNote.trim(),
          },
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
          : "Unable to authorize redeployment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function activate() {
    try {
      setRunning(true);
      setError(null);

      await apply(
        activateCapitalRedeployment(
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
          : "Unable to activate redeployment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function recordRelease(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await apply(
        recordCapitalRedeploymentRelease(
          params.id,
          {
            releasedOn,
            releasedAmount,
            evidenceNote:
              releaseEvidence.trim(),
            referenceText:
              releaseReference.trim(),
          },
        ),
      );

      setReleaseEvidence("");
      setReleaseReference("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record redeployment release.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitVerification() {
    try {
      setRunning(true);
      setError(null);

      await apply(
        submitCapitalRedeploymentForVerification(
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
          : "Unable to submit redeployment for verification.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function verify(
    decision:
      CapitalRedeploymentVerificationDecision,
  ) {
    if (!verificationNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        verifyCapitalRedeployment(
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
          : "Unable to verify redeployment.",
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
        closeCapitalRedeploymentCase(
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
          : "Unable to close redeployment case.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading capital redeployment...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-redeployment"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital redeployment
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capital-redeployment case not found."}
        </div>
      </div>
    );
  }

  const redeploymentCase =
    detail.redeploymentCase;

  const canRelease =
    redeploymentCase.status ===
      "ACTIVE"
    ||
    redeploymentCase.status ===
      "REMEDIATION_REQUIRED";

  return (
    <div className="page-stack">
      <Link
        href="/capital-redeployment"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital redeployment
      </Link>

      <section className="redeployment-detail-heading">
        <div>
          <span className="eyebrow">
            Governed recycled-capital release
          </span>

          <h1>
            {redeploymentCase.targetInitiativeTitle}
          </h1>

          <p>
            {redeploymentCase.redeploymentNumber}
            {" · "}
            {redeploymentCase.recyclingSourceNumber}
            {" · "}
            {redeploymentCase.targetValueCaseNumber}
          </p>
        </div>

        <span
          className={
            `redeployment-status redeployment-status--${redeploymentCase.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            redeploymentCase.status,
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

      <section className="redeployment-detail-grid">
        <article>
          <span>
            Approved
          </span>

          <strong>
            {money(
              redeploymentCase.approvedRedeploymentAmount,
              redeploymentCase.currency,
            )}
          </strong>
        </article>

        <article className="redeployment-score-card">
          <span>
            Released
          </span>

          <strong>
            {money(
              redeploymentCase.releasedRedeploymentAmount,
              redeploymentCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining
          </span>

          <strong>
            {money(
              redeploymentCase.remainingRedeploymentAmount,
              redeploymentCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Completion
          </span>

          <strong>
            {redeploymentCase.redeploymentPct.toFixed(
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
              redeploymentCase.redeploymentHealth,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current source capital
          </span>

          <strong>
            {money(
              redeploymentCase.currentSourceFundingRemainingAmount,
              redeploymentCase.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen Step 62 authority
            </span>

            <h2>
              Target investment context
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p className="redeployment-objective">
          {redeploymentCase.redeploymentObjective}
        </p>

        <div className="redeployment-context-grid">
          <div>
            <span>
              Owner
            </span>

            <strong>
              {redeploymentCase.redeploymentOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Target ROI
            </span>

            <strong>
              {redeploymentCase.targetRoiPctSnapshot.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Persistence
            </span>

            <strong>
              {redeploymentCase.targetPersistencePctSnapshot.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Target health
            </span>

            <strong>
              {readable(
                redeploymentCase.targetValueHealthSnapshot,
              )}
            </strong>
          </div>

          <div>
            <span>
              Target net value
            </span>

            <strong>
              {money(
                redeploymentCase.targetNetValueSnapshot,
                redeploymentCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Source recyclable snapshot
            </span>

            <strong>
              {money(
                redeploymentCase.sourceRecyclableCapitalSnapshot,
                redeploymentCase.currency,
              )}
            </strong>
          </div>
        </div>
      </section>

      <div className="redeployment-source-links">
        <Link
          href={
            `/capital-recycling/${redeploymentCase.recyclingSourceId}`
          }
          className="table-action"
        >
          Step 62 reinvestment authority
        </Link>

        <Link
          href={
            `/funding-execution/${redeploymentCase.sourceFundingCommitmentId}`
          }
          className="table-action"
        >
          Step 58 source funding
        </Link>

        <Link
          href={
            `/strategic-value/${redeploymentCase.targetValueCaseId}`
          }
          className="table-action"
        >
          Step 56 target value case
        </Link>
      </div>

      {canManage &&
      redeploymentCase.status ===
        "PLANNED" ? (
        <form
          className="panel"
          onSubmit={createGate}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Release controls
              </span>

              <h2>
                Add redeployment gate
              </h2>
            </div>
          </div>

          <div className="redeployment-gate-form">
            <label className="request-field">
              <span>
                Gate title
              </span>

              <input
                required
                value={gateTitle}
                onChange={
                  event =>
                    setGateTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field redeployment-form-wide">
              <span>
                Evidence requirement
              </span>

              <textarea
                required
                rows={4}
                value={gateRequirement}
                onChange={
                  event =>
                    setGateRequirement(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="redeployment-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !gateTitle.trim()
                ||
                !gateRequirement.trim()
              }
            >
              Add evidence gate
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Evidence gates
            </span>

            <h2>
              Release readiness
            </h2>
          </div>
        </div>

        <div className="redeployment-gate-list">
          {detail.gates.map(
            gate => (
              <article
                key={gate.id}
              >
                <div>
                  <strong>
                    {gate.title}
                  </strong>

                  <span>
                    {gate.gateNumber}
                    {" · "}
                    {readable(
                      gate.status,
                    )}
                  </span>

                  <p>
                    {gate.requirement}
                  </p>

                  {gate.evidenceNote ? (
                    <small>
                      Evidence:
                      {" "}
                      {gate.evidenceNote}
                    </small>
                  ) : null}
                </div>

                {canFinalize &&
                redeploymentCase.status ===
                  "PLANNED"
                &&
                gate.status ===
                  "PENDING" ? (
                  <div className="redeployment-gate-decision">
                    <input
                      placeholder="Evidence"
                      value={
                        gateEvidence[
                          gate.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setGateEvidence(
                            current => ({
                              ...current,
                              [gate.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <input
                      placeholder="Decision note"
                      value={
                        gateNotes[
                          gate.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setGateNotes(
                            current => ({
                              ...current,
                              [gate.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <button
                      type="button"
                      disabled={running}
                      onClick={
                        () =>
                          void decideGate(
                            gate.id,
                            "SATISFIED",
                          )
                      }
                    >
                      Satisfy
                    </button>

                    <button
                      type="button"
                      className="redeployment-warning-button"
                      disabled={running}
                      onClick={
                        () =>
                          void decideGate(
                            gate.id,
                            "WAIVED",
                          )
                      }
                    >
                      Waive
                    </button>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.gates.length ===
          0 ? (
            <div className="redeployment-empty">
              No redeployment gate has
              been created.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      redeploymentCase.status ===
        "PLANNED"
      &&
      redeploymentCase.gateCount >
        0
      &&
      redeploymentCase.pendingGateCount ===
        0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Authorization gate
              </span>

              <h2>
                Submit for authorization
              </h2>
            </div>
          </div>

          <div className="redeployment-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitAuthorization()
              }
            >
              Submit for funding authorization
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      redeploymentCase.status ===
        "READY_FOR_AUTHORIZATION" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manager authorization
              </span>

              <h2>
                Authorize redeployment
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Authorization rationale
            </span>

            <textarea
              rows={5}
              value={authorizationNote}
              onChange={
                event =>
                  setAuthorizationNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="redeployment-decision-actions">
            <button
              type="button"
              disabled={
                running
                ||
                !authorizationNote.trim()
              }
              onClick={
                () =>
                  void authorize(
                    "APPROVED",
                  )
              }
            >
              Authorize capital
            </button>

            <button
              type="button"
              className="redeployment-danger-button"
              disabled={
                running
                ||
                !authorizationNote.trim()
              }
              onClick={
                () =>
                  void authorize(
                    "REJECTED",
                  )
              }
            >
              Reject
            </button>
          </div>
        </section>
      ) : null}

      {redeploymentCase.authorizationCount >
      0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Immutable authorization evidence
              </span>

              <h2>
                Authorization history
              </h2>
            </div>
          </div>

          <div className="redeployment-history-list">
            {detail.authorizations.map(
              authorization => (
                <article
                  key={authorization.id}
                >
                  <strong>
                    {readable(
                      authorization.decision,
                    )}
                  </strong>

                  <span>
                    {money(
                      authorization.authorizedAmount,
                      redeploymentCase.currency,
                    )}
                  </span>

                  <p>
                    {authorization.authorizationNote}
                  </p>

                  <small>
                    {authorization.authorizedByName}
                    {" · "}
                    {new Date(
                      authorization.authorizedAt,
                    )
                      .toLocaleString()}
                  </small>
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

      {canFinalize &&
      redeploymentCase.status ===
        "AUTHORIZED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Release activation
              </span>

              <h2>
                Activate redeployment
              </h2>
            </div>
          </div>

          <div className="redeployment-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void activate()
              }
            >
              Activate authorized redeployment
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      canRelease ? (
        <form
          className="panel"
          onSubmit={recordRelease}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Immutable release evidence
              </span>

              <h2>
                Record capital redeployment
              </h2>
            </div>
          </div>

          <div className="redeployment-release-form">
            <label className="request-field">
              <span>
                Released on
              </span>

              <input
                type="date"
                value={releasedOn}
                onChange={
                  event =>
                    setReleasedOn(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Released amount
              </span>

              <input
                type="number"
                min="0.01"
                max={redeploymentCase.remainingRedeploymentAmount}
                step="0.01"
                value={releasedAmount}
                onChange={
                  event =>
                    setReleasedAmount(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field redeployment-form-wide">
              <span>
                Release evidence
              </span>

              <textarea
                required
                rows={5}
                value={releaseEvidence}
                onChange={
                  event =>
                    setReleaseEvidence(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field redeployment-form-wide">
              <span>
                Release reference
              </span>

              <input
                required
                value={releaseReference}
                onChange={
                  event =>
                    setReleaseReference(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="redeployment-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                releasedAmount <=
                  0
                ||
                releasedAmount >
                  redeploymentCase.remainingRedeploymentAmount
                ||
                !releaseEvidence.trim()
                ||
                !releaseReference.trim()
              }
            >
              Record immutable release
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Redeployment ledger
            </span>

            <h2>
              Release history
            </h2>
          </div>
        </div>

        <div className="redeployment-history-list">
          {detail.releases.map(
            release => (
              <article
                key={release.id}
              >
                <strong>
                  {money(
                    release.releasedAmount,
                    redeploymentCase.currency,
                  )}
                </strong>

                <span>
                  {release.releasedOn}
                  {" · "}
                  {release.referenceText}
                </span>

                <p>
                  {release.evidenceNote}
                </p>

                <small>
                  {release.releasedByName}
                  {" · "}
                  {new Date(
                    release.releasedAt,
                  )
                    .toLocaleString()}
                </small>
              </article>
            ),
          )}

          {detail.releases.length ===
          0 ? (
            <div className="redeployment-empty">
              No redeployment release has
              been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      canRelease &&
      detail.releases.length >
        0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Verification gate
              </span>

              <h2>
                Submit redeployment
              </h2>
            </div>
          </div>

          <div className="redeployment-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitVerification()
              }
            >
              Submit for verification
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      redeploymentCase.status ===
        "READY_FOR_VERIFICATION" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent verification
              </span>

              <h2>
                Verify redeployment
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Verification rationale
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

          <div className="redeployment-decision-actions">
            <button
              type="button"
              disabled={
                running
                ||
                !verificationNote.trim()
                ||
                redeploymentCase.redeploymentPct !==
                  100
              }
              onClick={
                () =>
                  void verify(
                    "VERIFIED",
                  )
              }
            >
              Verify full redeployment
            </button>

            <button
              type="button"
              className="redeployment-danger-button"
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
              Redeployment verification
            </h2>
          </div>
        </div>

        <div className="redeployment-history-list">
          {detail.verifications.map(
            verification => (
              <article
                key={verification.id}
              >
                <strong>
                  {readable(
                    verification.decision,
                  )}
                </strong>

                <span>
                  {verification.redeploymentPct.toFixed(
                    1,
                  )}
                  {"% · "}
                  {money(
                    verification.releasedRedeploymentAmount,
                    redeploymentCase.currency,
                  )}
                  {" released"}
                </span>

                <p>
                  {verification.verificationNote}
                </p>

                <small>
                  Remaining:
                  {" "}
                  {money(
                    verification.remainingRedeploymentAmount,
                    redeploymentCase.currency,
                  )}
                  {" · "}
                  {verification.verifiedByName}
                </small>
              </article>
            ),
          )}

          {detail.verifications.length ===
          0 ? (
            <div className="redeployment-empty">
              No verification decision has
              been recorded.
            </div>
          ) : null}
        </div>
      </section>

      {canFinalize &&
      redeploymentCase.status ===
        "VERIFIED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance closure
              </span>

              <h2>
                Close redeployment case
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

          <div className="redeployment-form-actions">
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
              Close redeployment case
            </button>
          </div>
        </section>
      ) : null}

      <section className="redeployment-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Redeployment evidence is separate from the historical source-funding ledger
          </strong>

          <p>
            Step 63 proves that recycled
            capital was authorized and
            redeployed toward the approved
            Step 62 target. It never
            rewrites the original Step 58
            releases or Step 57 allocation
            decisions.
          </p>
        </div>
      </section>
    </div>
  );
}
