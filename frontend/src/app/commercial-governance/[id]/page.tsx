"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  Coins,
  FileCheck2,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldAlert,
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
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  completeContractObligation,
  completeContractRenewal,
  createContractObligation,
  decideContractRenewal,
  deactivateCommercialGovernance,
  dismissCommercialLeakage,
  getCommercialGovernanceContext,
  getCommercialGovernanceDetail,
  resolveCommercialLeakage,
  startContractRenewalReview,
  waiveContractObligation,
} from "@/lib/api";

import type {
  CommercialGovernanceContext,
  CommercialGovernanceDetail,
  CommercialLeakageFinding,
  ContractObligation,
  ContractObligationType,
  ContractRenewalDecision,
} from "@/types/commercial-governance";

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
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function defaultDueDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 30,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function CommercialGovernanceDetailPage() {
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
      CommercialGovernanceDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      CommercialGovernanceContext |
      null
    >(null);

  const [
    renewalDecision,
    setRenewalDecision,
  ] =
    useState<ContractRenewalDecision>(
      "RENEW",
    );

  const [
    renewalNote,
    setRenewalNote,
  ] =
    useState("");

  const [
    obligationType,
    setObligationType,
  ] =
    useState<ContractObligationType>(
      "SERVICE_LEVEL",
    );

  const [
    obligationTitle,
    setObligationTitle,
  ] =
    useState("");

  const [
    obligationDescription,
    setObligationDescription,
  ] =
    useState("");

  const [
    obligationDueDate,
    setObligationDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    obligationCritical,
    setObligationCritical,
  ] =
    useState(false);

  const [
    obligationOwnerUserId,
    setObligationOwnerUserId,
  ] =
    useState("");

  const [
    obligationNotes,
    setObligationNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    leakageNotes,
    setLeakageNotes,
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
    savingObligation,
    setSavingObligation,
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

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getCommercialGovernanceDetail(
        params.id,
      ),
      getCommercialGovernanceContext(),
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

          setObligationOwnerUserId(
            detailResponse
              .governance
              .ownerUserId
            ||
            owner?.id
            ||
            "",
          );

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
              : "Unable to load commercial governance detail.",
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
    params.id,
  ]);

  async function reload() {
    setDetail(
      await getCommercialGovernanceDetail(
        params.id,
      ),
    );
  }

  async function startRenewal() {
    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await startContractRenewalReview(
        detail.governance.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start renewal review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideRenewal() {
    if (!detail) {
      return;
    }

    if (!renewalNote.trim()) {
      setError(
        "A renewal decision rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await decideContractRenewal(
        detail.governance.id,
        renewalDecision,
        renewalNote,
      );

      setRenewalNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record renewal decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function completeRenewal() {
    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await completeContractRenewal(
        detail.governance.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to complete renewal workflow.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function deactivateGovernance() {
    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await deactivateCommercialGovernance(
        detail.governance.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to deactivate commercial governance.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createObligation(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    try {
      setSavingObligation(true);
      setError(null);

      await createContractObligation(
        detail.governance.id,
        {
          obligationType,
          title:
            obligationTitle.trim(),
          description:
            obligationDescription.trim()
            ||
            undefined,
          dueDate:
            obligationDueDate,
          critical:
            obligationCritical,
          ownerUserId:
            obligationOwnerUserId
            ||
            undefined,
        },
      );

      setObligationTitle("");
      setObligationDescription("");
      setObligationCritical(false);
      setObligationDueDate(
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
          : "Unable to create contract obligation.",
      );
    } finally {
      setSavingObligation(false);
    }
  }

  async function closeObligation(
    obligation:
      ContractObligation,
    action:
      "COMPLETE"
      |
      "WAIVE",
  ) {
    const note =
      obligationNotes[
        obligation.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An obligation completion or waiver note is required.",
      );

      return;
    }

    try {
      setError(null);

      if (
        action ===
        "COMPLETE"
      ) {
        await completeContractObligation(
          obligation.id,
          note,
        );
      } else {
        await waiveContractObligation(
          obligation.id,
          note,
        );
      }

      setObligationNotes(
        current => ({
          ...current,
          [obligation.id]:
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
          : "Unable to update contract obligation.",
      );
    }
  }

  async function decideLeakage(
    finding:
      CommercialLeakageFinding,
    action:
      "RESOLVE"
      |
      "DISMISS",
  ) {
    const note =
      leakageNotes[
        finding.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A leakage resolution note is required.",
      );

      return;
    }

    try {
      setError(null);

      if (
        action ===
        "RESOLVE"
      ) {
        await resolveCommercialLeakage(
          finding.id,
          note,
        );
      } else {
        await dismissCommercialLeakage(
          finding.id,
          note,
        );
      }

      setLeakageNotes(
        current => ({
          ...current,
          [finding.id]:
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
          : "Unable to update commercial leakage finding.",
      );
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading commercial governance...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/commercial-governance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Commercial governance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Commercial governance record not found."}
        </div>
      </div>
    );
  }

  const {
    governance,
    obligations,
    leakageFindings,
  } = detail;

  return (
    <div className="page-stack">
      <Link
        href="/commercial-governance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Commercial governance
      </Link>

      <section className="commercial-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {governance.supplierCode}
            </span>

            <span
              className={
                `commercial-renewal commercial-renewal--${governance.renewalStatus.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                governance.renewalStatus,
              )}
            </span>

            <span
              className={
                governance.governanceStatus ===
                "ACTIVE"
                  ? "commercial-governance-status commercial-governance-status--active"
                  : "commercial-governance-status commercial-governance-status--inactive"
              }
            >
              {governance.governanceStatus}
            </span>
          </div>

          <h1>
            {governance.supplierName}
          </h1>

          <p>
            Contract
            {" "}
            {governance.contractId.slice(
              0,
              12,
            )}
            {" · ends "}
            {new Date(
              `${governance.contractEndDate}T00:00:00`,
            )
              .toLocaleDateString()}
            {" · Owner: "}
            {governance.ownerName}
          </p>
        </div>

        <div className="commercial-detail-actions">
          {canManage &&
          governance.renewalStatus ===
            "UPCOMING" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void startRenewal()
              }
            >
              <CalendarClock
                size={16}
              />
              Start renewal review
            </button>
          ) : null}

          {canManage &&
          (
            governance.renewalStatus ===
              "RENEW"
            ||
            governance.renewalStatus ===
              "RENEGOTIATE"
            ||
            governance.renewalStatus ===
              "TERMINATE"
          ) ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void completeRenewal()
              }
            >
              <BadgeCheck
                size={16}
              />
              Complete renewal workflow
            </button>
          ) : null}

          {canApprove &&
          governance.governanceStatus ===
            "ACTIVE" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void deactivateGovernance()
              }
            >
              <XCircle
                size={16}
              />
              Deactivate
            </button>
          ) : null}
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

      <section className="commercial-detail-kpis">
        <article className="request-detail-summary-card">
          <Coins
            size={18}
          />

          <div>
            <span>
              Commercial baseline
            </span>

            <strong>
              {money(
                governance.baselineContractValue,
                governance.currency,
              )}
            </strong>

            <small>
              Contract reference value
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <CalendarClock
            size={18}
          />

          <div>
            <span>
              Notice deadline
            </span>

            <strong>
              {new Date(
                `${governance.noticeDeadline}T00:00:00`,
              )
                .toLocaleDateString()}
            </strong>

            <small>
              {governance.noticePeriodDays}
              {" days before expiry"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <FileCheck2
            size={18}
          />

          <div>
            <span>
              Open obligations
            </span>

            <strong>
              {governance.openObligations}
            </strong>

            <small>
              {governance.overdueObligations}
              {" overdue"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <ShieldAlert
            size={18}
          />

          <div>
            <span>
              Leakage exposure
            </span>

            <strong>
              {money(
                governance.leakageExposure,
                governance.currency,
              )}
            </strong>

            <small>
              {governance.openLeakageFindings}
              {" open findings"}
            </small>
          </div>
        </article>
      </section>

      <section className="commercial-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Commercial controls
              </span>

              <h2>
                Contract economics
              </h2>
            </div>

            <Coins
              size={19}
            />
          </div>

          <div className="commercial-control-grid">
            <div>
              <span>
                Price escalation
              </span>

              <strong>
                {governance.priceEscalationPct.toFixed(1)}
                %
              </strong>
            </div>

            <div>
              <span>
                PO variance ceiling
              </span>

              <strong>
                {governance.maxPoVariancePct.toFixed(1)}
                %
              </strong>
            </div>

            <div>
              <span>
                Auto renewal
              </span>

              <strong>
                {governance.autoRenewal
                  ? "Yes"
                  : "No"}
              </strong>
            </div>

            <div>
              <span>
                Contract status
              </span>

              <strong>
                {governance.contractStatus}
              </strong>
            </div>
          </div>

          {governance.notes ? (
            <div className="commercial-notes">
              {governance.notes}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Renewal governance
              </span>

              <h2>
                Renewal decision
              </h2>
            </div>

            <RefreshCw
              size={19}
            />
          </div>

          {governance.renewalDecisionNote ? (
            <div className="commercial-renewal-decision">
              <span>
                {readable(
                  governance.renewalStatus,
                )}
              </span>

              <strong>
                {governance.renewalDecisionNote}
              </strong>

              <small>
                {governance.renewalDecidedByName ??
                  "Procurement management"}
                {governance.renewalDecidedAt
                  ? ` · ${new Date(
                      governance.renewalDecidedAt,
                    ).toLocaleString()}`
                  : ""}
              </small>
            </div>
          ) : (
            <div className="commercial-empty">
              No renewal decision has
              been recorded yet.
            </div>
          )}

          {canApprove &&
          (
            governance.renewalStatus ===
              "UPCOMING"
            ||
            governance.renewalStatus ===
              "UNDER_REVIEW"
          ) ? (
            <div className="commercial-renewal-form">
              <label className="request-field">
                <span>
                  Renewal strategy
                </span>

                <select
                  value={renewalDecision}
                  onChange={
                    event =>
                      setRenewalDecision(
                        event.target.value as
                          ContractRenewalDecision,
                      )
                  }
                >
                  <option value="RENEW">
                    Renew
                  </option>

                  <option value="RENEGOTIATE">
                    Renegotiate
                  </option>

                  <option value="TERMINATE">
                    Terminate
                  </option>
                </select>
              </label>

              <label className="request-field">
                <span>
                  Decision rationale
                </span>

                <textarea
                  rows={4}
                  maxLength={2000}
                  value={renewalNote}
                  onChange={
                    event =>
                      setRenewalNote(
                        event.target.value,
                      )
                  }
                />
              </label>

              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !renewalNote.trim()
                }
                onClick={
                  () =>
                    void decideRenewal()
                }
              >
                <BadgeCheck
                  size={16}
                />
                Record renewal decision
              </button>
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Contract execution
            </span>

            <h2>
              Obligations
            </h2>
          </div>

          <FileCheck2
            size={19}
          />
        </div>

        {obligations.length ===
        0 ? (
          <div className="commercial-empty">
            No contractual obligations
            are currently tracked.
          </div>
        ) : (
          <div className="commercial-obligation-list">
            {obligations.map(
              obligation => (
                <article
                  key={obligation.id}
                  className={
                    obligation.overdue
                      ? "commercial-obligation commercial-obligation--overdue"
                      : obligation.critical
                        ? "commercial-obligation commercial-obligation--critical"
                        : "commercial-obligation"
                  }
                >
                  <div className="commercial-obligation-heading">
                    <div>
                      <span
                        className={
                          `commercial-obligation-status commercial-obligation-status--${obligation.status.toLowerCase()}`
                        }
                      >
                        {readable(
                          obligation.status,
                        )}
                      </span>

                      <strong>
                        {obligation.title}
                      </strong>

                      <small>
                        {readable(
                          obligation.obligationType,
                        )}
                        {obligation.critical
                          ? " · Critical"
                          : ""}
                      </small>
                    </div>

                    <div>
                      <span>
                        Due
                      </span>

                      <strong
                        className={
                          obligation.overdue
                            ? "commercial-overdue"
                            : ""
                        }
                      >
                        {new Date(
                          `${obligation.dueDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {obligation.description ? (
                    <p>
                      {obligation.description}
                    </p>
                  ) : null}

                  <div className="commercial-obligation-meta">
                    Owner:
                    {" "}
                    {obligation.ownerName}
                  </div>

                  {obligation.completionNote ? (
                    <div className="commercial-completion-note">
                      {obligation.completionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  obligation.status ===
                    "OPEN" ? (
                    <div className="commercial-inline-controls">
                      <input
                        value={
                          obligationNotes[
                            obligation.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Completion / waiver evidence"
                        }
                        onChange={
                          event =>
                            setObligationNotes(
                              current => ({
                                ...current,
                                [obligation.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <button
                        type="button"
                        className="commercial-inline-button"
                        disabled={
                          !(
                            obligationNotes[
                              obligation.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void closeObligation(
                              obligation,
                              "COMPLETE",
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Complete
                      </button>

                      {canApprove ? (
                        <button
                          type="button"
                          className="commercial-inline-button commercial-inline-button--danger"
                          disabled={
                            !(
                              obligationNotes[
                                obligation.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void closeObligation(
                                obligation,
                                "WAIVE",
                              )
                          }
                        >
                          <XCircle
                            size={14}
                          />
                          Waive
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      governance.governanceStatus ===
        "ACTIVE" ? (
        <form
          className="panel"
          onSubmit={createObligation}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Obligation management
              </span>

              <h2>
                Add contract obligation
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="commercial-form-grid">
            <label className="request-field">
              <span>
                Obligation type
              </span>

              <select
                value={obligationType}
                onChange={
                  event =>
                    setObligationType(
                      event.target.value as
                        ContractObligationType,
                    )
                }
              >
                <option value="DELIVERY">
                  Delivery
                </option>

                <option value="SERVICE_LEVEL">
                  Service level
                </option>

                <option value="REPORTING">
                  Reporting
                </option>

                <option value="COMPLIANCE">
                  Compliance
                </option>

                <option value="PAYMENT">
                  Payment
                </option>

                <option value="RENEWAL">
                  Renewal
                </option>

                <option value="OTHER">
                  Other
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
                value={obligationDueDate}
                onChange={
                  event =>
                    setObligationDueDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field commercial-form-wide">
              <span>
                Obligation title
              </span>

              <input
                required
                maxLength={220}
                value={obligationTitle}
                onChange={
                  event =>
                    setObligationTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field commercial-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={
                  obligationDescription
                }
                onChange={
                  event =>
                    setObligationDescription(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field commercial-form-wide">
              <span>
                Owner
              </span>

              <select
                value={
                  obligationOwnerUserId
                }
                onChange={
                  event =>
                    setObligationOwnerUserId(
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
                        key={
                          candidate.id
                        }
                        value={
                          candidate.id
                        }
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="commercial-critical-option commercial-form-wide">
              <input
                type="checkbox"
                checked={
                  obligationCritical
                }
                onChange={
                  event =>
                    setObligationCritical(
                      event.target.checked,
                    )
                }
              />

              <span>
                Mark this contractual
                obligation as critical.
              </span>
            </label>
          </div>

          <div className="commercial-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                savingObligation
                ||
                !obligationTitle.trim()
              }
            >
              <Plus
                size={16}
              />

              {savingObligation
                ? "Adding..."
                : "Add obligation"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Commercial leakage
            </span>

            <h2>
              Contract & transaction findings
            </h2>
          </div>

          <ShieldAlert
            size={19}
          />
        </div>

        {leakageFindings.length ===
        0 ? (
          <div className="commercial-empty">
            No commercial leakage
            findings are linked to this
            governance record.
          </div>
        ) : (
          <div className="commercial-detail-finding-list">
            {leakageFindings.map(
              finding => (
                <article
                  key={finding.id}
                  className={
                    `commercial-detail-finding commercial-detail-finding--${finding.severity.toLowerCase()}`
                  }
                >
                  <div className="commercial-finding-heading">
                    <div>
                      <span
                        className={
                          `commercial-severity commercial-severity--${finding.severity.toLowerCase()}`
                        }
                      >
                        {finding.severity}
                      </span>

                      <strong>
                        {readable(
                          finding.findingType,
                        )}
                      </strong>

                      <small>
                        {finding.sourceReference ??
                          "Contract"}
                      </small>
                    </div>

                    <div>
                      <span>
                        Leakage
                      </span>

                      <strong>
                        {finding.currency
                          ? money(
                              finding.leakageAmount,
                              finding.currency,
                            )
                          : finding.leakageAmount.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  <p>
                    {finding.details}
                  </p>

                  {(finding.expectedValue !==
                    null
                  ||
                  finding.actualValue !==
                    null) ? (
                    <div className="commercial-finding-values">
                      <span>
                        Expected:
                        {" "}
                        {finding.expectedValue !==
                          null
                          &&
                          finding.currency
                          ? money(
                              finding.expectedValue,
                              finding.currency,
                            )
                          : finding.expectedValue ??
                            "—"}
                      </span>

                      <span>
                        Actual:
                        {" "}
                        {finding.actualValue !==
                          null
                          &&
                          finding.currency
                          ? money(
                              finding.actualValue,
                              finding.currency,
                            )
                          : finding.actualValue ??
                            "—"}
                      </span>
                    </div>
                  ) : null}

                  {finding.resolutionNote ? (
                    <div className="commercial-completion-note">
                      {finding.resolutionNote}
                      {finding.resolvedByName
                        ? ` — ${finding.resolvedByName}`
                        : ""}
                    </div>
                  ) : null}

                  {canManage &&
                  finding.status ===
                    "OPEN" ? (
                    <div className="commercial-inline-controls">
                      <input
                        value={
                          leakageNotes[
                            finding.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Resolution evidence / rationale"
                        }
                        onChange={
                          event =>
                            setLeakageNotes(
                              current => ({
                                ...current,
                                [finding.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <button
                        type="button"
                        className="commercial-inline-button"
                        disabled={
                          !(
                            leakageNotes[
                              finding.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void decideLeakage(
                              finding,
                              "RESOLVE",
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Resolve
                      </button>

                      {canApprove ? (
                        <button
                          type="button"
                          className="commercial-inline-button commercial-inline-button--danger"
                          disabled={
                            !(
                              leakageNotes[
                                finding.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void decideLeakage(
                                finding,
                                "DISMISS",
                              )
                          }
                        >
                          <XCircle
                            size={14}
                          />
                          Dismiss
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
