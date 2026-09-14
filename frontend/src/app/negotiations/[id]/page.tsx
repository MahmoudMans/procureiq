"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  ExternalLink,
  Flag,
  Handshake,
  History,
  Plus,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  activateNegotiationWorkspace,
  addNegotiationRound,
  addNegotiationScenario,
  agreeNegotiationScenario,
  cancelNegotiationWorkspace,
  closeNegotiationWorkspace,
  getNegotiationWorkspace,
} from "@/lib/api";

import type {
  NegotiationRoundSide,
  NegotiationScenario,
  NegotiationScenarioType,
  NegotiationWorkspace,
} from "@/types/negotiation";

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
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export default function NegotiationDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    workspace,
    setWorkspace,
  ] =
    useState<
      NegotiationWorkspace |
      null
    >(null);

  const [
    scenarioName,
    setScenarioName,
  ] =
    useState(
      "Target scenario",
    );

  const [
    scenarioType,
    setScenarioType,
  ] =
    useState<NegotiationScenarioType>(
      "TARGET",
    );

  const [
    scenarioValue,
    setScenarioValue,
  ] =
    useState(0);

  const [
    scenarioPaymentDays,
    setScenarioPaymentDays,
  ] =
    useState(30);

  const [
    scenarioLeadDays,
    setScenarioLeadDays,
  ] =
    useState(30);

  const [
    scenarioWarrantyMonths,
    setScenarioWarrantyMonths,
  ] =
    useState(12);

  const [
    scenarioVolume,
    setScenarioVolume,
  ] =
    useState(0);

  const [
    scenarioPreferred,
    setScenarioPreferred,
  ] =
    useState(false);

  const [
    scenarioNotes,
    setScenarioNotes,
  ] =
    useState("");

  const [
    roundSide,
    setRoundSide,
  ] =
    useState<NegotiationRoundSide>(
      "SUPPLIER",
    );

  const [
    roundValue,
    setRoundValue,
  ] =
    useState(0);

  const [
    roundPaymentDays,
    setRoundPaymentDays,
  ] =
    useState(30);

  const [
    roundLeadDays,
    setRoundLeadDays,
  ] =
    useState(30);

  const [
    roundWarrantyMonths,
    setRoundWarrantyMonths,
  ] =
    useState(12);

  const [
    roundVolume,
    setRoundVolume,
  ] =
    useState(0);

  const [
    roundNotes,
    setRoundNotes,
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
    scenarioSaving,
    setScenarioSaving,
  ] =
    useState(false);

  const [
    roundSaving,
    setRoundSaving,
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

  const canAgree =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getNegotiationWorkspace(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setWorkspace(
            response,
          );

          const targetGuess =
            response.targetValue
            ??
            Math.max(
              0,
              response.baselineValue *
                0.9,
            );

          setScenarioValue(
            targetGuess,
          );

          setRoundValue(
            response.baselineValue,
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
              : "Unable to load negotiation workspace.",
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
    setWorkspace(
      await getNegotiationWorkspace(
        params.id,
      ),
    );
  }

  async function activate() {
    if (!workspace) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await activateNegotiationWorkspace(
        workspace.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to activate negotiation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeWorkspace() {
    if (!workspace) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await closeNegotiationWorkspace(
        workspace.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close negotiation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelWorkspace() {
    if (!workspace) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await cancelNegotiationWorkspace(
        workspace.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel negotiation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createScenario(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!workspace) {
      return;
    }

    try {
      setScenarioSaving(true);
      setError(null);

      await addNegotiationScenario(
        workspace.id,
        {
          name:
            scenarioName.trim(),
          scenarioType,
          totalValue:
            scenarioValue,
          paymentTermsDays:
            scenarioPaymentDays,
          leadTimeDays:
            scenarioLeadDays,
          warrantyMonths:
            scenarioWarrantyMonths,
          volumeCommitment:
            scenarioVolume > 0
              ? scenarioVolume
              : undefined,
          preferred:
            scenarioPreferred,
          notes:
            scenarioNotes.trim()
            ||
            undefined,
        },
      );

      setScenarioNotes("");
      setScenarioPreferred(false);

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create negotiation scenario.",
      );
    } finally {
      setScenarioSaving(false);
    }
  }

  async function createRound(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!workspace) {
      return;
    }

    try {
      setRoundSaving(true);
      setError(null);

      await addNegotiationRound(
        workspace.id,
        {
          actorSide:
            roundSide,
          offerValue:
            roundValue,
          paymentTermsDays:
            roundPaymentDays,
          leadTimeDays:
            roundLeadDays,
          warrantyMonths:
            roundWarrantyMonths,
          volumeCommitment:
            roundVolume > 0
              ? roundVolume
              : undefined,
          notes:
            roundNotes.trim()
            ||
            undefined,
        },
      );

      setRoundNotes("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record negotiation round.",
      );
    } finally {
      setRoundSaving(false);
    }
  }

  async function agreeScenario(
    scenario:
      NegotiationScenario,
  ) {
    if (!workspace) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await agreeNegotiationScenario(
        workspace.id,
        scenario.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to finalize negotiated agreement.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading negotiation workspace...
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="page-stack">
        <Link
          href="/negotiations"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Negotiations
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Negotiation workspace not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/negotiations"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Negotiations
      </Link>

      <section className="negotiation-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {workspace.negotiationNumber}
            </span>

            <span
              className={
                `negotiation-status negotiation-status--${workspace.status.toLowerCase()}`
              }
            >
              {readable(
                workspace.status,
              )}
            </span>
          </div>

          <h1>
            {workspace.supplierName}
          </h1>

          <p>
            {workspace.rfqNumber}
            {" · "}
            {workspace.rfqTitle}
            {" · Owner: "}
            {workspace.ownerName}
          </p>
        </div>

        <div className="negotiation-detail-actions">
          {canManage &&
          workspace.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void activate()
              }
            >
              <Handshake
                size={16}
              />
              Activate
            </button>
          ) : null}

          {canManage &&
          workspace.status ===
            "AGREED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void closeWorkspace()
              }
            >
              <BadgeCheck
                size={16}
              />
              Close negotiation
            </button>
          ) : null}

          {canAgree &&
          (
            workspace.status ===
              "DRAFT"
            ||
            workspace.status ===
              "ACTIVE"
          ) ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void cancelWorkspace()
              }
            >
              <XCircle
                size={16}
              />
              Cancel
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

      <section className="negotiation-detail-kpis">
        <article className="request-detail-summary-card">
          <Coins
            size={18}
          />

          <div>
            <span>
              Baseline
            </span>

            <strong>
              {money(
                workspace.baselineValue,
                workspace.currency,
              )}
            </strong>

            <small>
              Submitted supplier quotation
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Target
            size={18}
          />

          <div>
            <span>
              Target
            </span>

            <strong>
              {workspace.targetValue !==
              null
                ? money(
                    workspace.targetValue,
                    workspace.currency,
                  )
                : "—"}
            </strong>

            <small>
              {money(
                workspace.targetSavings,
                workspace.currency,
              )}
              {" target savings"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Flag
            size={18}
          />

          <div>
            <span>
              Walk-away
            </span>

            <strong>
              {workspace.walkAwayValue !==
              null
                ? money(
                    workspace.walkAwayValue,
                    workspace.currency,
                  )
                : "—"}
            </strong>

            <small>
              Maximum acceptable commercial value
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Handshake
            size={18}
          />

          <div>
            <span>
              Agreed value
            </span>

            <strong>
              {workspace.agreedValue !==
              null
                ? money(
                    workspace.agreedValue,
                    workspace.currency,
                  )
                : "—"}
            </strong>

            <small>
              {workspace.agreedSavingsPct.toFixed(1)}
              %
              {" savings"}
            </small>
          </div>
        </article>
      </section>

      {workspace.supplierRiskLevel ===
        "HIGH"
      ||
      workspace.supplierRiskLevel ===
        "CRITICAL" ? (
        <section className="negotiation-risk-banner">
          <ShieldAlert
            size={18}
          />

          <div>
            <strong>
              Elevated supplier risk
            </strong>

            <span>
              Supplier risk is currently
              {" "}
              {workspace.supplierRiskLevel}.
              Commercial concessions
              should be assessed together
              with risk mitigation.
            </span>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Scenario modeling
            </span>

            <h2>
              Commercial scenarios
            </h2>
          </div>

          <Target
            size={19}
          />
        </div>

        {workspace.scenarios.length ===
        0 ? (
          <div className="negotiation-empty">
            No scenarios have been
            modeled yet.
          </div>
        ) : (
          <div className="negotiation-scenario-grid">
            {workspace.scenarios.map(
              scenario => (
                <article
                  key={scenario.id}
                  className={
                    scenario.preferred
                      ? "negotiation-scenario-card negotiation-scenario-card--preferred"
                      : "negotiation-scenario-card"
                  }
                >
                  <div className="negotiation-scenario-heading">
                    <div>
                      <span>
                        {readable(
                          scenario.scenarioType,
                        )}
                      </span>

                      <strong>
                        {scenario.name}
                      </strong>
                    </div>

                    <div>
                      {scenario.preferred ? (
                        <span className="negotiation-preferred-chip">
                          Preferred
                        </span>
                      ) : null}

                      <strong className="negotiation-score">
                        {scenario.scenarioScore.toFixed(1)}
                      </strong>
                    </div>
                  </div>

                  <div className="negotiation-scenario-value">
                    <strong>
                      {money(
                        scenario.totalValue,
                        workspace.currency,
                      )}
                    </strong>

                    <span>
                      {money(
                        scenario.priceSavings,
                        workspace.currency,
                      )}
                      {" savings · "}
                      {scenario.savingsPct.toFixed(1)}
                      %
                    </span>
                  </div>

                  <div className="negotiation-term-grid">
                    <div>
                      <span>
                        Payment
                      </span>

                      <strong>
                        {scenario.paymentTermsDays}
                        {" days"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Lead time
                      </span>

                      <strong>
                        {scenario.leadTimeDays}
                        {" days"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Warranty
                      </span>

                      <strong>
                        {scenario.warrantyMonths}
                        {" months"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Volume
                      </span>

                      <strong>
                        {scenario.volumeCommitment ??
                          "—"}
                      </strong>
                    </div>
                  </div>

                  {scenario.notes ? (
                    <p>
                      {scenario.notes}
                    </p>
                  ) : null}

                  {canAgree &&
                  workspace.status ===
                    "ACTIVE" ? (
                    <button
                      type="button"
                      className="negotiation-agree-button"
                      disabled={running}
                      onClick={
                        () =>
                          void agreeScenario(
                            scenario,
                          )
                      }
                    >
                      <Handshake
                        size={14}
                      />
                      Finalize this scenario
                    </button>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      (
        workspace.status ===
          "DRAFT"
        ||
        workspace.status ===
          "ACTIVE"
      ) ? (
        <form
          className="panel"
          onSubmit={createScenario}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Scenario builder
              </span>

              <h2>
                Model negotiation position
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="negotiation-form-grid">
            <label className="request-field negotiation-form-wide">
              <span>
                Scenario name
              </span>

              <input
                required
                maxLength={220}
                value={scenarioName}
                onChange={
                  event =>
                    setScenarioName(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Scenario type
              </span>

              <select
                value={scenarioType}
                onChange={
                  event =>
                    setScenarioType(
                      event.target.value as
                        NegotiationScenarioType,
                    )
                }
              >
                <option value="TARGET">
                  Target
                </option>

                <option value="WALK_AWAY">
                  Walk-away
                </option>

                <option value="OPTION">
                  Option
                </option>

                <option value="FINAL">
                  Final
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Total value
              </span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={scenarioValue}
                onChange={
                  event =>
                    setScenarioValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Payment terms days
              </span>

              <input
                required
                type="number"
                min="0"
                value={
                  scenarioPaymentDays
                }
                onChange={
                  event =>
                    setScenarioPaymentDays(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Lead time days
              </span>

              <input
                required
                type="number"
                min="0"
                value={
                  scenarioLeadDays
                }
                onChange={
                  event =>
                    setScenarioLeadDays(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Warranty months
              </span>

              <input
                required
                type="number"
                min="0"
                value={
                  scenarioWarrantyMonths
                }
                onChange={
                  event =>
                    setScenarioWarrantyMonths(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Volume commitment
              </span>

              <input
                type="number"
                min="0"
                value={scenarioVolume}
                onChange={
                  event =>
                    setScenarioVolume(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="negotiation-preferred-option negotiation-form-wide">
              <input
                type="checkbox"
                checked={
                  scenarioPreferred
                }
                onChange={
                  event =>
                    setScenarioPreferred(
                      event.target.checked,
                    )
                }
              />

              <span>
                Mark as preferred
                negotiation scenario
              </span>
            </label>

            <label className="request-field negotiation-form-wide">
              <span>
                Scenario notes
              </span>

              <textarea
                rows={4}
                maxLength={3000}
                value={scenarioNotes}
                onChange={
                  event =>
                    setScenarioNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="negotiation-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                scenarioSaving
                ||
                !scenarioName.trim()
              }
            >
              <Plus
                size={16}
              />

              {scenarioSaving
                ? "Modeling..."
                : "Add scenario"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Negotiation history
            </span>

            <h2>
              Commercial rounds
            </h2>
          </div>

          <History
            size={19}
          />
        </div>

        {workspace.rounds.length ===
        0 ? (
          <div className="negotiation-empty">
            No negotiation rounds have
            been recorded.
          </div>
        ) : (
          <div className="negotiation-round-list">
            {workspace.rounds.map(
              round => (
                <article
                  key={round.id}
                  className={
                    `negotiation-round negotiation-round--${round.actorSide.toLowerCase()}`
                  }
                >
                  <div className="negotiation-round-number">
                    {round.roundNumber}
                  </div>

                  <div>
                    <div className="negotiation-round-heading">
                      <strong>
                        {readable(
                          round.actorSide,
                        )}
                        {" offer"}
                      </strong>

                      <span>
                        {new Date(
                          round.roundAt,
                        )
                          .toLocaleString()}
                      </span>
                    </div>

                    <strong className="negotiation-round-value">
                      {money(
                        round.offerValue,
                        workspace.currency,
                      )}
                    </strong>

                    <div className="negotiation-round-terms">
                      <span>
                        Payment
                        {" "}
                        {round.paymentTermsDays}
                        {"d"}
                      </span>

                      <span>
                        Lead
                        {" "}
                        {round.leadTimeDays}
                        {"d"}
                      </span>

                      <span>
                        Warranty
                        {" "}
                        {round.warrantyMonths}
                        {"m"}
                      </span>

                      {round.volumeCommitment !==
                      null ? (
                        <span>
                          Volume
                          {" "}
                          {round.volumeCommitment}
                        </span>
                      ) : null}
                    </div>

                    {round.notes ? (
                      <p>
                        {round.notes}
                      </p>
                    ) : null}

                    <small>
                      Recorded by
                      {" "}
                      {round.createdByName}
                    </small>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      workspace.status ===
        "ACTIVE" ? (
        <form
          className="panel"
          onSubmit={createRound}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Negotiation log
              </span>

              <h2>
                Record commercial round
              </h2>
            </div>

            <History
              size={19}
            />
          </div>

          <div className="negotiation-form-grid">
            <label className="request-field">
              <span>
                Offer side
              </span>

              <select
                value={roundSide}
                onChange={
                  event =>
                    setRoundSide(
                      event.target.value as
                        NegotiationRoundSide,
                    )
                }
              >
                <option value="SUPPLIER">
                  Supplier
                </option>

                <option value="BUYER">
                  Buyer
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Offer value
              </span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={roundValue}
                onChange={
                  event =>
                    setRoundValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Payment terms days
              </span>

              <input
                required
                type="number"
                min="0"
                value={
                  roundPaymentDays
                }
                onChange={
                  event =>
                    setRoundPaymentDays(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Lead time days
              </span>

              <input
                required
                type="number"
                min="0"
                value={roundLeadDays}
                onChange={
                  event =>
                    setRoundLeadDays(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Warranty months
              </span>

              <input
                required
                type="number"
                min="0"
                value={
                  roundWarrantyMonths
                }
                onChange={
                  event =>
                    setRoundWarrantyMonths(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Volume commitment
              </span>

              <input
                type="number"
                min="0"
                value={roundVolume}
                onChange={
                  event =>
                    setRoundVolume(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field negotiation-form-wide">
              <span>
                Round notes
              </span>

              <textarea
                rows={4}
                maxLength={3000}
                value={roundNotes}
                onChange={
                  event =>
                    setRoundNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="negotiation-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={roundSaving}
            >
              <Plus
                size={16}
              />

              {roundSaving
                ? "Recording..."
                : "Record round"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="negotiation-comparison-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Award comparison
              </span>

              <h2>
                Negotiated vs awarded
              </h2>
            </div>

            <Coins
              size={19}
            />
          </div>

          {workspace.awardedValue ===
          null ? (
            <div className="negotiation-empty">
              No award outcome exists for
              this RFQ yet.
            </div>
          ) : (
            <div className="negotiation-award-grid">
              <div>
                <span>
                  Awarded supplier
                </span>

                <strong>
                  {workspace.awardedSupplierName}
                </strong>
              </div>

              <div>
                <span>
                  Award value
                </span>

                <strong>
                  {money(
                    workspace.awardedValue,
                    workspace.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Award savings
                </span>

                <strong>
                  {money(
                    workspace.awardSavingsFromBaseline ??
                      0,
                    workspace.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Agreement → award delta
                </span>

                <strong>
                  {workspace.agreementToAwardDelta !==
                  null
                    ? money(
                        workspace.agreementToAwardDelta,
                        workspace.currency,
                      )
                    : "—"}
                </strong>
              </div>

              <div className="negotiation-award-wide">
                <span>
                  Supplier match
                </span>

                <strong>
                  {workspace.agreementSupplierMatchesAward ===
                  null
                    ? "—"
                    : workspace.agreementSupplierMatchesAward
                      ? "Negotiated supplier won the award"
                      : "Award was made to another supplier"}
                </strong>
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Sourcing context
              </span>

              <h2>
                RFQ & supplier
              </h2>
            </div>

            <Handshake
              size={19}
            />
          </div>

          <div className="negotiation-context-grid">
            <div>
              <span>
                RFQ
              </span>

              <strong>
                {workspace.rfqNumber}
              </strong>

              <Link
                href={
                  `/rfqs/${workspace.rfqId}`
                }
                className="table-action"
              >
                Open RFQ
                <ExternalLink
                  size={12}
                />
              </Link>
            </div>

            <div>
              <span>
                Supplier
              </span>

              <strong>
                {workspace.supplierName}
              </strong>

              <Link
                href={
                  `/suppliers/${workspace.supplierId}`
                }
                className="table-action"
              >
                Supplier 360
                <ExternalLink
                  size={12}
                />
              </Link>
            </div>

            <div>
              <span>
                Supplier risk
              </span>

              <strong>
                {workspace.supplierRiskLevel ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Scenarios / rounds
              </span>

              <strong>
                {workspace.scenarios.length}
                {" / "}
                {workspace.rounds.length}
              </strong>
            </div>
          </div>

          {workspace.notes ? (
            <div className="negotiation-notes">
              {workspace.notes}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
