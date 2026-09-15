"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  activateFundingCommitment,
  authorizeFundingTranche,
  captureFundingSnapshot,
  closeFundingCommitment,
  createFundingGate,
  createFundingTranche,
  decideFundingGate,
  getFundingCommitment,
  releaseFundingTranche,
  requestFundingAuthorization,
} from "@/lib/api";

import type {
  FundingAuthorizationDecision,
  FundingCommitmentDetail,
  FundingGateStatus,
} from "@/types/funding-execution";

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

function futureDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate()
      + 30,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function FundingCommitmentPage() {
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
      FundingCommitmentDetail |
      null
    >(null);

  const [
    trancheTitle,
    setTrancheTitle,
  ] =
    useState("");

  const [
    trancheAmount,
    setTrancheAmount,
  ] =
    useState(0);

  const [
    trancheDate,
    setTrancheDate,
  ] =
    useState(
      futureDate(),
    );

  const [
    selectedTrancheId,
    setSelectedTrancheId,
  ] =
    useState("");

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
    trancheNotes,
    setTrancheNotes,
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

  const canAuthorize =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getFundingCommitment(
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

          const remaining =
            response.commitment
              .committedCapitalAmount
            -
            response.commitment
              .plannedReleaseAmount;

          if (remaining > 0) {
            setTrancheAmount(
              remaining,
            );
          }

          if (
            response.tranches[0]
          ) {
            setSelectedTrancheId(
              response.tranches[0].id,
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
                : "Unable to load funding commitment.",
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
      Promise<FundingCommitmentDetail>,
  ) {
    setDetail(
      await promise,
    );
  }

  async function addTranche(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      const response =
        await createFundingTranche(
          params.id,
          {
            sequenceNo:
              detail.tranches.length
              + 1,
            title:
              trancheTitle.trim(),
            plannedReleaseAmount:
              trancheAmount,
            targetDate:
              trancheDate,
          },
        );

      setDetail(
        response,
      );

      setTrancheTitle("");

      const remaining =
        response.commitment
          .committedCapitalAmount
        -
        response.commitment
          .plannedReleaseAmount;

      setTrancheAmount(
        Math.max(
          0,
          remaining,
        ),
      );

      if (
        !selectedTrancheId
        &&
        response.tranches[0]
      ) {
        setSelectedTrancheId(
          response.tranches[0].id,
        );
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create funding tranche.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addGate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedTrancheId) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        createFundingGate(
          selectedTrancheId,
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
          : "Unable to create release gate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideGate(
    gateId: string,
    decision:
      FundingGateStatus,
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
        decideFundingGate(
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
          : "Unable to decide funding gate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function activate() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        activateFundingCommitment(
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
          : "Unable to activate funding commitment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function requestAuthorization(
    trancheId: string,
  ) {
    const note =
      trancheNotes[
        trancheId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Authorization request note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        requestFundingAuthorization(
          trancheId,
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
          : "Unable to request tranche authorization.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function authorize(
    trancheId: string,
    decision:
      FundingAuthorizationDecision,
  ) {
    const note =
      trancheNotes[
        trancheId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Authorization decision note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        authorizeFundingTranche(
          trancheId,
          {
            decision,
            note:
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
          : "Unable to authorize funding tranche.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function release(
    trancheId: string,
  ) {
    const note =
      trancheNotes[
        trancheId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Capital-release evidence note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        releaseFundingTranche(
          trancheId,
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
          : "Unable to record capital release.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureFundingSnapshot(
        params.id,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture funding snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeCommitment() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await apply(
        closeFundingCommitment(
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
          : "Unable to close funding commitment.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading funding commitment...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/funding-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Funding execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Funding commitment not found."}
        </div>
      </div>
    );
  }

  const commitment =
    detail.commitment;

  return (
    <div className="page-stack">
      <Link
        href="/funding-execution"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Funding execution
      </Link>

      <section className="funding-detail-heading">
        <div>
          <span className="eyebrow">
            Governed funding commitment
          </span>

          <h1>
            {commitment.initiativeTitle}
          </h1>

          <p>
            {commitment.commitmentNumber}
            {" · "}
            {commitment.allocationCycleNumber}
            {" · "}
            {commitment.caseNumber}
          </p>
        </div>

        <span
          className={
            `funding-status funding-status--${commitment.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            commitment.status,
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

      <section className="funding-detail-grid">
        <article>
          <span>
            Authorized ceiling
          </span>

          <strong>
            {money(
              commitment.authorizedCapitalAmount,
              commitment.currency,
            )}
          </strong>
        </article>

        <article className="funding-score-card">
          <span>
            Committed
          </span>

          <strong>
            {money(
              commitment.committedCapitalAmount,
              commitment.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Planned
          </span>

          <strong>
            {money(
              commitment.plannedReleaseAmount,
              commitment.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Released
          </span>

          <strong>
            {money(
              commitment.releasedAmount,
              commitment.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Release %
          </span>

          <strong>
            {commitment.releasePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Remaining
          </span>

          <strong>
            {money(
              commitment.remainingCommitmentAmount,
              commitment.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Funding authority
            </span>

            <h2>
              Commitment context
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

        <p className="funding-objective">
          {commitment.objective}
        </p>

        <div className="funding-context-grid">
          <div>
            <span>
              Funding owner
            </span>

            <strong>
              {commitment.fundingOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Plan coverage
            </span>

            <strong>
              {commitment.plannedCoveragePct.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Uncommitted authorization
            </span>

            <strong>
              {money(
                commitment.remainingAuthorizationAmount,
                commitment.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Pending gates
            </span>

            <strong>
              {commitment.pendingGateCount}
            </strong>
          </div>
        </div>
      </section>

      <div className="funding-source-link">
        <Link
          href={
            `/capital-allocation/${commitment.allocationCycleId}`
          }
          className="table-action"
        >
          Open authoritative Step 57 allocation decision
        </Link>
      </div>

      {canManage &&
      commitment.status ===
        "PLANNED" ? (
        <form
          className="panel"
          onSubmit={addTranche}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Capital-release plan
              </span>

              <h2>
                Add release tranche
              </h2>
            </div>
          </div>

          <div className="funding-tranche-form">
            <label className="request-field funding-form-wide">
              <span>
                Tranche title
              </span>

              <input
                required
                value={trancheTitle}
                onChange={
                  event =>
                    setTrancheTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Planned amount
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={trancheAmount}
                onChange={
                  event =>
                    setTrancheAmount(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Target date
              </span>

              <input
                type="date"
                value={trancheDate}
                onChange={
                  event =>
                    setTrancheDate(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="funding-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !trancheTitle.trim()
                ||
                trancheAmount <=
                  0
              }
            >
              Add release tranche
            </button>
          </div>
        </form>
      ) : null}

      {canManage &&
      (
        commitment.status ===
          "PLANNED"
        ||
        commitment.status ===
          "ACTIVE"
      )
      &&
      detail.tranches.some(
        tranche =>
          tranche.status ===
            "PLANNED",
      ) ? (
        <form
          className="panel"
          onSubmit={addGate}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Evidence gate design
              </span>

              <h2>
                Add tranche gate
              </h2>
            </div>
          </div>

          <div className="funding-gate-form">
            <label className="request-field">
              <span>
                Tranche
              </span>

              <select
                value={selectedTrancheId}
                onChange={
                  event =>
                    setSelectedTrancheId(
                      event.target.value,
                    )
                }
              >
                {detail.tranches
                  .filter(
                    tranche =>
                      tranche.status ===
                        "PLANNED",
                  )
                  .map(
                    tranche => (
                      <option
                        key={tranche.id}
                        value={tranche.id}
                      >
                        {tranche.trancheNumber}
                        {" — "}
                        {tranche.title}
                      </option>
                    ),
                  )}
              </select>
            </label>

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

            <label className="request-field funding-form-wide">
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

          <div className="funding-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !selectedTrancheId
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
              Capital-release governance
            </span>

            <h2>
              Funding tranches
            </h2>
          </div>
        </div>

        <div className="funding-tranche-list">
          {detail.tranches.map(
            tranche => (
              <article
                key={tranche.id}
              >
                <div className="funding-tranche-heading">
                  <div>
                    <span
                      className={
                        `funding-tranche-status funding-tranche-status--${tranche.status.toLowerCase().replaceAll("_", "-")}`
                      }
                    >
                      {readable(
                        tranche.status,
                      )}
                    </span>

                    <strong>
                      {tranche.sequenceNo}
                      {". "}
                      {tranche.title}
                    </strong>

                    <small>
                      {tranche.trancheNumber}
                      {" · Target "}
                      {tranche.targetDate}
                    </small>
                  </div>

                  <strong>
                    {money(
                      tranche.plannedReleaseAmount,
                      commitment.currency,
                    )}
                  </strong>
                </div>

                <div className="funding-tranche-signals">
                  <span>
                    Gates
                    <strong>
                      {tranche.resolvedGateCount}
                      {" / "}
                      {tranche.gateCount}
                    </strong>
                  </span>

                  <span>
                    Authorization records
                    <strong>
                      {tranche.authorizations.length}
                    </strong>
                  </span>

                  <span>
                    Released
                    <strong>
                      {tranche.release
                        ? money(
                            tranche.release.releasedAmount,
                            commitment.currency,
                          )
                        : "No"}
                    </strong>
                  </span>
                </div>

                <div className="funding-gate-list">
                  {tranche.gates.map(
                    gate => (
                      <div
                        key={gate.id}
                        className="funding-gate"
                      >
                        <div>
                          <strong>
                            {gate.title}
                          </strong>

                          <span>
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

                        {canAuthorize &&
                        gate.status ===
                          "PENDING"
                        &&
                        tranche.status ===
                          "PLANNED" ? (
                          <div className="funding-gate-decision">
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
                              className="funding-warning-button"
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
                      </div>
                    ),
                  )}
                </div>

                {commitment.status ===
                  "ACTIVE"
                &&
                tranche.status !==
                  "RELEASED" ? (
                  <div className="funding-tranche-actions">
                    <input
                      placeholder="Authorization / release evidence note"
                      value={
                        trancheNotes[
                          tranche.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setTrancheNotes(
                            current => ({
                              ...current,
                              [tranche.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    {canManage &&
                    tranche.status ===
                      "PLANNED" ? (
                      <button
                        type="button"
                        disabled={
                          running
                          ||
                          tranche.pendingGateCount >
                            0
                          ||
                          tranche.gateCount ===
                            0
                        }
                        onClick={
                          () =>
                            void requestAuthorization(
                              tranche.id,
                            )
                        }
                      >
                        Request authorization
                      </button>
                    ) : null}

                    {canAuthorize &&
                    tranche.status ===
                      "READY_FOR_AUTHORIZATION" ? (
                      <>
                        <button
                          type="button"
                          disabled={running}
                          onClick={
                            () =>
                              void authorize(
                                tranche.id,
                                "APPROVED",
                              )
                          }
                        >
                          Authorize
                        </button>

                        <button
                          type="button"
                          className="funding-danger-button"
                          disabled={running}
                          onClick={
                            () =>
                              void authorize(
                                tranche.id,
                                "REJECTED",
                              )
                          }
                        >
                          Reject
                        </button>
                      </>
                    ) : null}

                    {canAuthorize &&
                    tranche.status ===
                      "AUTHORIZED" ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void release(
                              tranche.id,
                            )
                        }
                      >
                        Record capital release
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {tranche.authorizations.length >
                0 ? (
                  <div className="funding-authorization-history">
                    {tranche.authorizations.map(
                      authorization => (
                        <div
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
                              commitment.currency,
                            )}
                            {" · "}
                            {authorization.authorizedByName}
                            {" · "}
                            {new Date(
                              authorization.authorizedAt,
                            )
                              .toLocaleString()}
                          </span>

                          <p>
                            {authorization.authorizationNote}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}

                {tranche.release ? (
                  <div className="funding-release-record">
                    <strong>
                      Immutable capital release
                    </strong>

                    <p>
                      {money(
                        tranche.release.releasedAmount,
                        commitment.currency,
                      )}
                      {" · "}
                      {tranche.release.releaseNote}
                    </p>

                    <small>
                      {tranche.release.releasedByName}
                      {" · "}
                      {new Date(
                        tranche.release.releasedAt,
                      )
                        .toLocaleString()}
                    </small>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.tranches.length ===
          0 ? (
            <div className="funding-empty">
              No release tranche has been
              defined.
            </div>
          ) : null}
        </div>
      </section>

      {canAuthorize &&
      commitment.status ===
        "PLANNED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Commitment activation
              </span>

              <h2>
                Activate controlled funding
              </h2>
            </div>
          </div>

          <p className="funding-governance-copy">
            Activation requires tranche
            amounts to exactly equal
            committed capital and every
            tranche to have at least one
            release gate.
          </p>

          <label className="request-field">
            <span>
              Activation note
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

          <div className="funding-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                commitment.plannedCoveragePct !==
                  100
                ||
                detail.tranches.length ===
                  0
                ||
                detail.tranches.some(
                  tranche =>
                    tranche.gateCount ===
                      0,
                )
                ||
                !governanceNote.trim()
              }
              onClick={
                () =>
                  void activate()
              }
            >
              Activate funding commitment
            </button>
          </div>
        </section>
      ) : null}

      {canAuthorize &&
      commitment.status ===
        "FULLY_RELEASED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Funding closure
              </span>

              <h2>
                Close funding commitment
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Closure note
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

          <div className="funding-form-actions">
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
                  void closeCommitment()
              }
            >
              Close funding commitment
            </button>
          </div>
        </section>
      ) : null}

      {commitment.activationNote ? (
        <section className="funding-approval-note">
          <strong>
            Funding commitment activated
          </strong>

          <p>
            {commitment.activationNote}
          </p>

          <small>
            {commitment.activatedByName}
          </small>
        </section>
      ) : null}

      <section className="funding-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Authorization evidence and release evidence are separate
          </strong>

          <p>
            A satisfied gate does not
            authorize capital. An approved
            authorization does not itself
            record a release. Each stage
            has its own immutable evidence
            boundary.
          </p>
        </div>
      </section>
    </div>
  );
}
