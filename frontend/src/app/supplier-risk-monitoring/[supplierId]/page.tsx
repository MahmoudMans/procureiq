"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  Play,
  ShieldAlert,
  UserRoundSearch,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useSearchParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  acknowledgeSupplierRiskAlert,
  addSupplierToRiskWatchlist,
  cancelSupplierRiskEscalation,
  closeSupplierRiskEscalation,
  createSupplierRiskEscalation,
  getSupplierRiskContext,
  getSupplierRiskDetail,
  releaseSupplierFromRiskWatchlist,
  startSupplierRiskEscalation,
} from "@/lib/api";

import type {
  SupplierRiskContext,
  SupplierRiskDetail,
  SupplierRiskEscalation,
  SupplierRiskEscalationPriority,
} from "@/types/supplier-risk-monitoring";

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

function defaultDueDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 14,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function SupplierRiskDetailPage() {
  const params =
    useParams<{
      supplierId: string;
    }>();

  const searchParams =
    useSearchParams();

  const currency =
    searchParams.get(
      "currency",
    )
    ??
    "EUR";

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      SupplierRiskDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      SupplierRiskContext |
      null
    >(null);

  const [
    watchlistReason,
    setWatchlistReason,
  ] =
    useState("");

  const [
    alertNotes,
    setAlertNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    escalationAlertId,
    setEscalationAlertId,
  ] =
    useState("");

  const [
    escalationOwnerId,
    setEscalationOwnerId,
  ] =
    useState("");

  const [
    escalationPriority,
    setEscalationPriority,
  ] =
    useState<SupplierRiskEscalationPriority>(
      "HIGH",
    );

  const [
    escalationDueDate,
    setEscalationDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    escalationRationale,
    setEscalationRationale,
  ] =
    useState("");

  const [
    closeNotes,
    setCloseNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

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

  const canClose =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getSupplierRiskDetail(
        params.supplierId,
        currency,
      ),
      getSupplierRiskContext(),
    ])
      .then(
        ([
          detailResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            detailResponse,
          );

          setContext(
            contextResponse,
          );

          const owner =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (owner) {
            setEscalationOwnerId(
              owner.id,
            );
          }

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load supplier-risk detail.",
          );
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
    params.supplierId,
    currency,
  ]);

  async function reload() {
    setDetail(
      await getSupplierRiskDetail(
        params.supplierId,
        currency,
      ),
    );
  }

  async function updateWatchlist(
    action:
      "ADD"
      |
      "RELEASE",
  ) {
    if (!watchlistReason.trim()) {
      setError(
        "A watchlist rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "ADD"
      ) {
        await addSupplierToRiskWatchlist(
          params.supplierId,
          watchlistReason,
        );
      } else {
        await releaseSupplierFromRiskWatchlist(
          params.supplierId,
          watchlistReason,
        );
      }

      setWatchlistReason("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update supplier-risk watchlist.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function acknowledge(
    alertId: string,
  ) {
    const note =
      alertNotes[
        alertId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An alert acknowledgement note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await acknowledgeSupplierRiskAlert(
        alertId,
        note,
      );

      setAlertNotes(
        current => ({
          ...current,
          [alertId]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to acknowledge supplier-risk alert.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createEscalation(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createSupplierRiskEscalation(
        params.supplierId,
        {
          alertId:
            escalationAlertId
            ||
            undefined,
          ownerUserId:
            escalationOwnerId
            ||
            undefined,
          priority:
            escalationPriority,
          dueDate:
            escalationDueDate,
          rationale:
            escalationRationale.trim(),
        },
      );

      setEscalationAlertId("");
      setEscalationRationale("");
      setEscalationDueDate(
        defaultDueDate(),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to open supplier-risk escalation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function startEscalation(
    escalation:
      SupplierRiskEscalation,
  ) {
    try {
      setRunning(true);
      setError(null);

      await startSupplierRiskEscalation(
        escalation.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start supplier-risk escalation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function finishEscalation(
    escalation:
      SupplierRiskEscalation,
    action:
      "CLOSE"
      |
      "CANCEL",
  ) {
    const note =
      closeNotes[
        escalation.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A case resolution note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "CLOSE"
      ) {
        await closeSupplierRiskEscalation(
          escalation.id,
          note,
        );
      } else {
        await cancelSupplierRiskEscalation(
          escalation.id,
          note,
        );
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update supplier-risk escalation.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading continuous supplier risk...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/supplier-risk-monitoring"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Supplier risk monitoring
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Supplier risk detail is unavailable."}
        </div>
      </div>
    );
  }

  const latest =
    detail.latestEvaluation;

  return (
    <div className="page-stack">
      <Link
        href="/supplier-risk-monitoring"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier risk monitoring
      </Link>

      <section className="supplier-risk-detail-heading">
        <div>
          <span className="eyebrow">
            Continuous supplier assurance
          </span>

          <h1>
            {detail.supplierName}
          </h1>

          <p>
            {detail.supplierCode}
            {" · "}
            {detail.supplierCategory ??
              "Uncategorized"}
            {" · "}
            {detail.supplierCountry ??
              "Unknown country"}
          </p>
        </div>

        {latest ? (
          <div
            className={
              `supplier-risk-score-card supplier-risk-score-card--${latest.riskBand.toLowerCase()}`
            }
          >
            <span>
              Continuous risk
            </span>

            <strong>
              {latest.overallScore.toFixed(
                1,
              )}
            </strong>

            <small>
              {latest.riskBand}
            </small>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      {!latest ? (
        <section className="panel">
          <div className="supplier-risk-empty">
            No risk evaluation exists
            for this supplier and
            currency. Run the portfolio
            evaluation first.
          </div>
        </section>
      ) : (
        <>
          <section className="supplier-risk-detail-kpis">
            <article>
              <span>
                Recommendation
              </span>

              <strong>
                {readable(
                  latest.recommendation,
                )}
              </strong>
            </article>

            <article>
              <span>
                Score change
              </span>

              <strong
                className={
                  latest.deterioration
                    ? "supplier-risk-deterioration"
                    : ""
                }
              >
                {latest.deltaScore ===
                null
                  ? "First evaluation"
                  : `${
                      latest.deltaScore >
                      0
                        ? "+"
                        : ""
                    }${latest.deltaScore.toFixed(1)}`}
              </strong>
            </article>

            <article>
              <span>
                Category dependency
              </span>

              <strong>
                {latest.categorySpendShare.toFixed(
                  1,
                )}
                %
              </strong>
            </article>

            <article>
              <span>
                Currency
              </span>

              <strong>
                {latest.currency}
              </strong>
            </article>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Explainable scoring
                </span>

                <h2>
                  Risk factor decomposition
                </h2>
              </div>

              <UserRoundSearch
                size={19}
              />
            </div>

            <div className="supplier-risk-factor-list">
              {latest.factors.map(
                factor => (
                  <article
                    key={factor.factorCode}
                  >
                    <div className="supplier-risk-factor-heading">
                      <div>
                        <strong>
                          {readable(
                            factor.factorCode,
                          )}
                        </strong>

                        <span>
                          {factor.weightPct.toFixed(
                            0,
                          )}
                          % weight
                        </span>
                      </div>

                      <div>
                        <strong>
                          {factor.factorScore.toFixed(
                            1,
                          )}
                        </strong>

                        <span>
                          {factor.contribution.toFixed(
                            1,
                          )}
                          {" points"}
                        </span>
                      </div>
                    </div>

                    <div className="supplier-risk-factor-bar">
                      <div
                        style={{
                          width:
                            `${Math.min(
                              100,
                              Math.max(
                                0,
                                factor.factorScore,
                              ),
                            )}%`,
                        }}
                      />
                    </div>

                    <p>
                      {factor.details}
                    </p>
                  </article>
                ),
              )}
            </div>
          </section>
        </>
      )}

      <section className="supplier-risk-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Early warning
              </span>

              <h2>
                Risk alerts
              </h2>
            </div>

            <ShieldAlert
              size={19}
            />
          </div>

          <div className="supplier-risk-alert-detail-list">
            {detail.alerts.map(
              alert => (
                <article
                  key={alert.id}
                >
                  <div className="supplier-risk-alert-detail-heading">
                    <div>
                      <span
                        className={
                          `supplier-risk-alert-severity supplier-risk-alert-severity--${alert.severity.toLowerCase()}`
                        }
                      >
                        {alert.severity}
                      </span>

                      <strong>
                        {alert.title}
                      </strong>

                      <small>
                        {readable(
                          alert.alertType,
                        )}
                        {" · "}
                        {readable(
                          alert.status,
                        )}
                      </small>
                    </div>
                  </div>

                  <p>
                    {alert.details}
                  </p>

                  {alert.acknowledgementNote ? (
                    <div className="supplier-risk-ack-note">
                      {alert.acknowledgementNote}
                      {alert.acknowledgedByName
                        ? ` — ${alert.acknowledgedByName}`
                        : ""}
                    </div>
                  ) : null}

                  {canManage &&
                  alert.status ===
                    "OPEN" ? (
                    <div className="supplier-risk-alert-controls">
                      <input
                        value={
                          alertNotes[
                            alert.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Acknowledgement note"
                        }
                        onChange={
                          event =>
                            setAlertNotes(
                              current => ({
                                ...current,
                                [alert.id]:
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
                            alertNotes[
                              alert.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void acknowledge(
                              alert.id,
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Acknowledge
                      </button>
                    </div>
                  ) : null}
                </article>
              ),
            )}

            {detail.alerts.length ===
            0 ? (
              <div className="supplier-risk-empty">
                No supplier-risk alerts.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance
              </span>

              <h2>
                Risk watchlist
              </h2>
            </div>

            <AlertTriangle
              size={19}
            />
          </div>

          {detail.watchlist ? (
            <div className="supplier-risk-watchlist-card">
              <span>
                ACTIVE WATCHLIST
              </span>

              <strong>
                {detail.watchlist.reason}
              </strong>

              <small>
                Added by
                {" "}
                {detail.watchlist.addedByName}
                {" · "}
                {new Date(
                  detail.watchlist.addedAt,
                )
                  .toLocaleString()}
              </small>
            </div>
          ) : (
            <div className="supplier-risk-watchlist-card supplier-risk-watchlist-card--clear">
              <BadgeCheck
                size={18}
              />

              <strong>
                Supplier is not manually
                watchlisted.
              </strong>
            </div>
          )}

          {canManage ? (
            <div className="supplier-risk-watchlist-form">
              <textarea
                rows={4}
                value={watchlistReason}
                placeholder={
                  detail.watchlist
                    ? "Reason for releasing supplier from watchlist"
                    : "Reason for adding supplier to watchlist"
                }
                onChange={
                  event =>
                    setWatchlistReason(
                      event.target.value,
                    )
                }
              />

              <button
                type="button"
                className={
                  detail.watchlist
                    ? "button button--secondary"
                    : "button button--primary"
                }
                disabled={
                  running
                  ||
                  !watchlistReason.trim()
                }
                onClick={
                  () =>
                    void updateWatchlist(
                      detail.watchlist
                        ? "RELEASE"
                        : "ADD",
                    )
                }
              >
                {detail.watchlist
                  ? "Release watchlist"
                  : "Add to watchlist"}
              </button>
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Escalation governance
            </span>

            <h2>
              Risk escalation cases
            </h2>
          </div>

          <ClipboardCheck
            size={19}
          />
        </div>

        <div className="supplier-risk-case-list">
          {detail.escalationCases.map(
            escalation => (
              <article
                key={escalation.id}
                className={
                  escalation.overdue
                    ? "supplier-risk-case supplier-risk-case--overdue"
                    : "supplier-risk-case"
                }
              >
                <div className="supplier-risk-case-heading">
                  <div>
                    <span>
                      {readable(
                        escalation.status,
                      )}
                    </span>

                    <strong>
                      {escalation.caseNumber}
                    </strong>

                    <small>
                      {escalation.priority}
                      {" · Owner: "}
                      {escalation.ownerName}
                    </small>
                  </div>

                  <div>
                    <span>
                      Due
                    </span>

                    <strong
                      className={
                        escalation.overdue
                          ? "supplier-risk-deterioration"
                          : ""
                      }
                    >
                      {new Date(
                        `${escalation.dueDate}T00:00:00`,
                      )
                        .toLocaleDateString()}
                    </strong>
                  </div>
                </div>

                <p>
                  {escalation.rationale}
                </p>

                {escalation.resolutionNote ? (
                  <div className="supplier-risk-case-resolution">
                    {escalation.resolutionNote}
                  </div>
                ) : null}

                {canManage &&
                escalation.status ===
                  "OPEN" ? (
                  <button
                    type="button"
                    disabled={running}
                    onClick={
                      () =>
                        void startEscalation(
                          escalation,
                        )
                    }
                  >
                    <Play
                      size={14}
                    />
                    Start case
                  </button>
                ) : null}

                {canClose &&
                (
                  escalation.status ===
                    "OPEN"
                  ||
                  escalation.status ===
                    "IN_PROGRESS"
                ) ? (
                  <div className="supplier-risk-case-controls">
                    <textarea
                      rows={3}
                      value={
                        closeNotes[
                          escalation.id
                        ]
                        ??
                        ""
                      }
                      placeholder={
                        "Resolution / cancellation note"
                      }
                      onChange={
                        event =>
                          setCloseNotes(
                            current => ({
                              ...current,
                              [escalation.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <div>
                      <button
                        type="button"
                        className="button button--secondary"
                        disabled={
                          running
                          ||
                          !(
                            closeNotes[
                              escalation.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void finishEscalation(
                              escalation,
                              "CANCEL",
                            )
                        }
                      >
                        <XCircle
                          size={14}
                        />
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="button button--primary"
                        disabled={
                          running
                          ||
                          !(
                            closeNotes[
                              escalation.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void finishEscalation(
                              escalation,
                              "CLOSE",
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.escalationCases.length ===
          0 ? (
            <div className="supplier-risk-empty">
              No escalation cases have
              been opened.
            </div>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={createEscalation}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                New governance case
              </span>

              <h2>
                Open risk escalation
              </h2>
            </div>

            <AlertTriangle
              size={19}
            />
          </div>

          <div className="supplier-risk-escalation-form">
            <label className="request-field">
              <span>
                Related alert
              </span>

              <select
                value={escalationAlertId}
                onChange={
                  event =>
                    setEscalationAlertId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  No direct alert link
                </option>

                {detail.alerts
                  .filter(
                    alert =>
                      alert.status !==
                      "RESOLVED",
                  )
                  .map(
                    alert => (
                      <option
                        key={alert.id}
                        value={alert.id}
                      >
                        {alert.alertType}
                        {" — "}
                        {alert.title}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Owner
              </span>

              <select
                value={escalationOwnerId}
                onChange={
                  event =>
                    setEscalationOwnerId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.users
                  .filter(
                    candidate =>
                      candidate.role !==
                      "REQUESTER",
                  )
                  .map(
                    candidate => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Priority
              </span>

              <select
                value={escalationPriority}
                onChange={
                  event =>
                    setEscalationPriority(
                      event.target.value as
                        SupplierRiskEscalationPriority,
                    )
                }
              >
                <option value="MEDIUM">
                  Medium
                </option>

                <option value="HIGH">
                  High
                </option>

                <option value="CRITICAL">
                  Critical
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Due date
              </span>

              <input
                required
                type="date"
                value={escalationDueDate}
                onChange={
                  event =>
                    setEscalationDueDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field supplier-risk-form-wide">
              <span>
                Escalation rationale
              </span>

              <textarea
                required
                rows={5}
                value={escalationRationale}
                onChange={
                  event =>
                    setEscalationRationale(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="supplier-risk-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !escalationRationale.trim()
              }
            >
              <AlertTriangle
                size={16}
              />
              Open escalation case
            </button>
          </div>
        </form>
      ) : null}

      {detail.history.length >
      0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Risk trajectory
              </span>

              <h2>
                Evaluation history
              </h2>
            </div>
          </div>

          <div className="supplier-risk-history">
            {detail.history.map(
              evaluation => (
                <article
                  key={evaluation.id}
                >
                  <span>
                    {new Date(
                      evaluation.evaluatedAt,
                    )
                      .toLocaleString()}
                  </span>

                  <strong>
                    {evaluation.overallScore.toFixed(
                      1,
                    )}
                  </strong>

                  <span
                    className={
                      `supplier-risk-band supplier-risk-band--${evaluation.riskBand.toLowerCase()}`
                    }
                  >
                    {evaluation.riskBand}
                  </span>

                  <span>
                    {readable(
                      evaluation.recommendation,
                    )}
                  </span>
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
