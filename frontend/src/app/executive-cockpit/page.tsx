"use client";

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  Coins,
  FileWarning,
  Gauge,
  Lightbulb,
  Radar,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Target,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  acknowledgeExecutiveWarning,
  getExecutiveCockpit,
  unacknowledgeExecutiveWarning,
  updateExecutiveWarningRule,
} from "@/lib/api";

import type {
  ExecutiveCockpit,
  ExecutiveRule,
  ExecutiveSignalType,
  ExecutiveWarning,
  ExecutiveWarningSeverity,
} from "@/types/executive-cockpit";

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
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function ExecutiveCockpitPage() {
  const {
    user,
  } = useAuth();

  const [
    cockpit,
    setCockpit,
  ] =
    useState<
      ExecutiveCockpit |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    signalFilter,
    setSignalFilter,
  ] =
    useState("");

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState("");

  const [
    acknowledgementFilter,
    setAcknowledgementFilter,
  ] =
    useState("OPEN");

  const [
    warningNotes,
    setWarningNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    selectedRuleId,
    setSelectedRuleId,
  ] =
    useState("");

  const [
    ruleEnabled,
    setRuleEnabled,
  ] =
    useState(true);

  const [
    ruleThreshold,
    setRuleThreshold,
  ] =
    useState(0);

  const [
    ruleLookahead,
    setRuleLookahead,
  ] =
    useState(0);

  const [
    ruleSeverity,
    setRuleSeverity,
  ] =
    useState<ExecutiveWarningSeverity>(
      "HIGH",
    );

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
    savingRule,
    setSavingRule,
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

  const canAcknowledge =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  const canConfigure =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getExecutiveCockpit(
      currency,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setCockpit(
            response,
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
              : "Unable to load executive procurement cockpit.",
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
    currency,
  ]);

  async function reload() {
    setCockpit(
      await getExecutiveCockpit(
        currency,
      ),
    );
  }

  async function acknowledge(
    warning:
      ExecutiveWarning,
  ) {
    const note =
      warningNotes[
        warning.warningKey
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An acknowledgement note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await acknowledgeExecutiveWarning(
        warning.warningKey,
        currency,
        note,
      );

      setWarningNotes(
        current => ({
          ...current,
          [warning.warningKey]:
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
          : "Unable to acknowledge executive warning.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function unacknowledge(
    warning:
      ExecutiveWarning,
  ) {
    try {
      setRunning(true);
      setError(null);

      await unacknowledgeExecutiveWarning(
        warning.warningKey,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to reopen executive warning.",
      );
    } finally {
      setRunning(false);
    }
  }

  function selectRule(
    ruleId: string,
  ) {
    setSelectedRuleId(
      ruleId,
    );

    const rule =
      cockpit
        ?.rules
        .find(
          candidate =>
            String(
              candidate.id,
            ) ===
            ruleId,
        );

    if (!rule) {
      return;
    }

    setRuleEnabled(
      rule.enabled,
    );

    setRuleThreshold(
      rule.thresholdValue,
    );

    setRuleLookahead(
      rule.lookaheadDays,
    );

    setRuleSeverity(
      rule.defaultSeverity,
    );
  }

  async function saveRule(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedRuleId) {
      setError(
        "Select an early-warning rule first.",
      );

      return;
    }

    try {
      setSavingRule(true);
      setError(null);

      await updateExecutiveWarningRule(
        Number(
          selectedRuleId,
        ),
        {
          enabled:
            ruleEnabled,
          thresholdValue:
            ruleThreshold,
          lookaheadDays:
            ruleLookahead,
          defaultSeverity:
            ruleSeverity,
        },
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update executive warning rule.",
      );
    } finally {
      setSavingRule(false);
    }
  }

  const filteredWarnings =
    useMemo(
      () =>
        cockpit
          ?.warnings
          .filter(
            warning =>
              !signalFilter
              ||
              warning.signalType ===
                signalFilter,
          )
          .filter(
            warning =>
              !severityFilter
              ||
              warning.severity ===
                severityFilter,
          )
          .filter(
            warning =>
              acknowledgementFilter ===
                "ALL"
              ||
              (
                acknowledgementFilter ===
                  "ACKNOWLEDGED"
                &&
                warning.acknowledged
              )
              ||
              (
                acknowledgementFilter ===
                  "OPEN"
                &&
                !warning.acknowledged
              ),
          )
        ??
        [],
      [
        cockpit,
        signalFilter,
        severityFilter,
        acknowledgementFilter,
      ],
    );

  const selectedRule =
    cockpit
      ?.rules
      .find(
        rule =>
          String(
            rule.id,
          ) ===
          selectedRuleId,
      )
    ??
    null;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Executive intelligence
          </span>

          <h1>
            Procurement cockpit
          </h1>

          <p>
            Prioritize cross-functional
            procurement risks and value
            opportunities using
            explainable early-warning
            signals from operations,
            suppliers, contracts,
            invoices, negotiations and
            sourcing demand.
          </p>
        </div>

        <div className="executive-heading-actions">
          <label className="executive-currency-control">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event => {
                  setLoading(true);

                  setCurrency(
                    event.target.value,
                  );
                }
              }
            >
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          <div className="executive-generated">
            <RefreshCw
              size={15}
            />

            <div>
              <span>
                Snapshot
              </span>

              <strong>
                {cockpit
                  ? new Date(
                      cockpit.generatedAt,
                    )
                      .toLocaleTimeString()
                  : "—"}
              </strong>
            </div>
          </div>
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

      <section className="executive-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ShieldAlert
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Critical warnings
          </span>

          <strong className="kpi-card__value">
            {cockpit
              ?.summary
              .criticalWarnings ??
              0}
          </strong>

          <p>
            {cockpit
              ?.summary
              .unacknowledgedWarnings ??
              0}
            {" unacknowledged signals"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Coins
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Risk exposure
          </span>

          <strong className="kpi-card__value executive-money-kpi">
            {money(
              cockpit
                ?.summary
                .riskExposure ??
                0,
              currency,
            )}
          </strong>

          <p>
            Distinct active warning
            exposure.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Target
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Value opportunity
          </span>

          <strong className="kpi-card__value executive-money-kpi">
            {money(
              cockpit
                ?.summary
                .opportunityValue ??
                0,
              currency,
            )}
          </strong>

          <p>
            Open consolidation savings
            signals.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Gauge
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Process bottlenecks
          </span>

          <strong className="kpi-card__value">
            {cockpit
              ?.summary
              .processBottlenecks ??
              0}
          </strong>

          <p>
            {cockpit
              ?.summary
              .criticalSupplierSignals ??
              0}
            {" critical supplier signals"}
          </p>
        </article>
      </section>

      <section className="executive-exposure-grid">
        <article>
          <span>
            Overdue invoices
          </span>

          <strong>
            {money(
              cockpit
                ?.summary
                .overdueInvoiceExposure ??
                0,
              currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Payment holds
          </span>

          <strong>
            {money(
              cockpit
                ?.summary
                .paymentHoldExposure ??
                0,
              currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Commercial leakage
          </span>

          <strong>
            {money(
              cockpit
                ?.summary
                .commercialLeakageExposure ??
                0,
              currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Demand savings
          </span>

          <strong>
            {money(
              cockpit
                ?.summary
                .demandSavingsOpportunity ??
                0,
              currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Portfolio radar
            </span>

            <h2>
              Cross-module signals
            </h2>
          </div>

          <Radar
            size={19}
          />
        </div>

        <div className="executive-portfolio-grid">
          {cockpit
            ?.portfolioSignals
            .map(
              signal => (
                <article
                  key={
                    signal.signalType
                  }
                >
                  <span>
                    {readable(
                      signal.signalType,
                    )}
                  </span>

                  <strong>
                    {signal.warningCount}
                    {" signals"}
                  </strong>

                  <div>
                    <span>
                      Critical
                    </span>

                    <strong>
                      {signal.criticalCount}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Risk
                    </span>

                    <strong>
                      {money(
                        signal.riskExposure,
                        currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Opportunity
                    </span>

                    <strong>
                      {money(
                        signal.opportunityValue,
                        currency,
                      )}
                    </strong>
                  </div>
                </article>
              ),
            )}
        </div>
      </section>

      <section className="executive-grid-two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Management focus
              </span>

              <h2>
                Recommended actions
              </h2>
            </div>

            <Lightbulb
              size={19}
            />
          </div>

          <div className="executive-action-list">
            {cockpit
              ?.managementActions
              .map(
                (
                  action,
                  index,
                ) => (
                  <article
                    key={
                      `${action.title}-${index}`
                    }
                    className={
                      `executive-action executive-action--${action.priority.toLowerCase()}`
                    }
                  >
                    <span>
                      {action.priority}
                    </span>

                    <div>
                      <strong>
                        {action.title}
                      </strong>

                      <p>
                        {action.details}
                      </p>
                    </div>

                    <strong>
                      {action.warningCount}
                    </strong>
                  </article>
                ),
              )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Signal distribution
              </span>

              <h2>
                Executive status
              </h2>
            </div>

            <Activity
              size={19}
            />
          </div>

          <div className="executive-status-grid">
            <article>
              <span>
                Generated
              </span>

              <strong>
                {cockpit
                  ?.summary
                  .generatedWarnings ??
                  0}
              </strong>
            </article>

            <article>
              <span>
                Open
              </span>

              <strong>
                {cockpit
                  ?.summary
                  .unacknowledgedWarnings ??
                  0}
              </strong>
            </article>

            <article>
              <span>
                Critical
              </span>

              <strong>
                {cockpit
                  ?.summary
                  .criticalWarnings ??
                  0}
              </strong>
            </article>

            <article>
              <span>
                High
              </span>

              <strong>
                {cockpit
                  ?.summary
                  .highWarnings ??
                  0}
              </strong>
            </article>
          </div>

          <div className="executive-model-note">
            <FileWarning
              size={17}
            />

            <p>
              Early-warning signals are
              deterministic and
              explainable. They use
              current ProcureIQ
              transaction, workflow and
              governance data rather
              than an opaque external
              model.
            </p>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Early-warning queue
            </span>

            <h2>
              Management warnings
            </h2>
          </div>

          <span className="executive-count">
            {filteredWarnings.length}
            {" signals"}
          </span>
        </div>

        <div className="executive-toolbar">
          <select
            value={signalFilter}
            onChange={
              event =>
                setSignalFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All signal types
            </option>

            <option value="PROCESS">
              Process
            </option>

            <option value="INVOICE">
              Invoice
            </option>

            <option value="CONTRACT">
              Contract
            </option>

            <option value="SUPPLIER">
              Supplier
            </option>

            <option value="NEGOTIATION">
              Negotiation
            </option>

            <option value="DEMAND">
              Demand
            </option>
          </select>

          <select
            value={severityFilter}
            onChange={
              event =>
                setSeverityFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All severities
            </option>

            <option value="CRITICAL">
              Critical
            </option>

            <option value="HIGH">
              High
            </option>

            <option value="MEDIUM">
              Medium
            </option>

            <option value="LOW">
              Low
            </option>

            <option value="INFO">
              Info
            </option>
          </select>

          <select
            value={
              acknowledgementFilter
            }
            onChange={
              event =>
                setAcknowledgementFilter(
                  event.target.value,
                )
            }
          >
            <option value="OPEN">
              Open only
            </option>

            <option value="ACKNOWLEDGED">
              Acknowledged
            </option>

            <option value="ALL">
              All
            </option>
          </select>
        </div>

        <div className="executive-warning-list">
          {filteredWarnings.map(
            warning => (
              <article
                key={
                  warning.warningKey
                }
                className={
                  warning.acknowledged
                    ? `executive-warning executive-warning--${warning.severity.toLowerCase()} executive-warning--acknowledged`
                    : `executive-warning executive-warning--${warning.severity.toLowerCase()}`
                }
              >
                <div className="executive-warning-heading">
                  <div>
                    <div className="executive-warning-tags">
                      <span
                        className={
                          `executive-severity executive-severity--${warning.severity.toLowerCase()}`
                        }
                      >
                        {warning.severity}
                      </span>

                      <span className="executive-signal-chip">
                        {readable(
                          warning.signalType,
                        )}
                      </span>

                      <span
                        className={
                          warning.nature ===
                          "OPPORTUNITY"
                            ? "executive-nature executive-nature--opportunity"
                            : "executive-nature"
                        }
                      >
                        {warning.nature}
                      </span>
                    </div>

                    <strong>
                      {warning.title}
                    </strong>

                    <small>
                      {warning.referenceType}
                      {" · "}
                      {warning.referenceLabel ??
                        warning.referenceId.slice(
                          0,
                          10,
                        )}
                    </small>
                  </div>

                  <div className="executive-priority-score">
                    <span>
                      Priority
                    </span>

                    <strong>
                      {warning.priorityScore.toFixed(0)}
                    </strong>
                  </div>
                </div>

                <p>
                  {warning.details}
                </p>

                <div className="executive-warning-meta">
                  {warning.exposureValue !==
                  null ? (
                    <span>
                      Exposure:
                      {" "}
                      <strong>
                        {warning.currency
                          ? money(
                              warning.exposureValue,
                              warning.currency,
                            )
                          : warning.exposureValue.toFixed(2)}
                      </strong>
                    </span>
                  ) : null}

                  {warning.metricValue !==
                  null ? (
                    <span>
                      Metric:
                      {" "}
                      <strong>
                        {warning.metricValue.toFixed(2)}
                      </strong>
                    </span>
                  ) : null}

                  {warning.dueAt ? (
                    <span>
                      Date:
                      {" "}
                      <strong>
                        {new Date(
                          warning.dueAt,
                        )
                          .toLocaleDateString()}
                      </strong>
                    </span>
                  ) : null}
                </div>

                <div className="executive-warning-recommendation">
                  <Lightbulb
                    size={14}
                  />

                  <span>
                    {warning.recommendation}
                  </span>
                </div>

                {warning.acknowledged ? (
                  <div className="executive-acknowledged">
                    <BadgeCheck
                      size={15}
                    />

                    <div>
                      <strong>
                        Acknowledged
                      </strong>

                      <span>
                        {warning.acknowledgementNote}
                        {warning.acknowledgedByName
                          ? ` — ${warning.acknowledgedByName}`
                          : ""}
                      </span>
                    </div>

                    {canAcknowledge ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void unacknowledge(
                              warning,
                            )
                        }
                      >
                        Reopen
                      </button>
                    ) : null}
                  </div>
                ) : canAcknowledge ? (
                  <div className="executive-warning-controls">
                    <input
                      value={
                        warningNotes[
                          warning.warningKey
                        ]
                        ??
                        ""
                      }
                      placeholder={
                        "Management acknowledgement / owner action"
                      }
                      onChange={
                        event =>
                          setWarningNotes(
                            current => ({
                              ...current,
                              [warning.warningKey]:
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
                          warningNotes[
                            warning.warningKey
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void acknowledge(
                            warning,
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

          {!loading &&
          filteredWarnings.length ===
            0 ? (
            <div className="executive-empty">
              No executive warnings
              match the current filters.
            </div>
          ) : null}
        </div>
      </section>

      {canConfigure ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Early-warning governance
              </span>

              <h2>
                Rule configuration
              </h2>
            </div>

            <Settings2
              size={19}
            />
          </div>

          <form
            className="executive-rule-form"
            onSubmit={saveRule}
          >
            <label className="request-field executive-rule-wide">
              <span>
                Rule
              </span>

              <select
                value={selectedRuleId}
                onChange={
                  event =>
                    selectRule(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select rule
                </option>

                {cockpit
                  ?.rules
                  .map(
                    rule => (
                      <option
                        key={rule.id}
                        value={rule.id}
                      >
                        {rule.ruleCode}
                        {" — "}
                        {rule.title}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Threshold
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={ruleThreshold}
                disabled={!selectedRule}
                onChange={
                  event =>
                    setRuleThreshold(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Lookahead days
              </span>

              <input
                type="number"
                min="0"
                max="1095"
                value={ruleLookahead}
                disabled={!selectedRule}
                onChange={
                  event =>
                    setRuleLookahead(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Default severity
              </span>

              <select
                value={ruleSeverity}
                disabled={!selectedRule}
                onChange={
                  event =>
                    setRuleSeverity(
                      event.target.value as
                        ExecutiveWarningSeverity,
                    )
                }
              >
                <option value="INFO">
                  Info
                </option>

                <option value="LOW">
                  Low
                </option>

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

            <label className="executive-rule-enabled">
              <input
                type="checkbox"
                checked={ruleEnabled}
                disabled={!selectedRule}
                onChange={
                  event =>
                    setRuleEnabled(
                      event.target.checked,
                    )
                }
              />

              <span>
                Enabled
              </span>
            </label>

            <button
              type="submit"
              className="button button--primary"
              disabled={
                savingRule
                ||
                !selectedRule
              }
            >
              <Settings2
                size={16}
              />

              {savingRule
                ? "Saving..."
                : "Save rule"}
            </button>
          </form>

          {selectedRule ? (
            <div className="executive-rule-description">
              <strong>
                {selectedRule.title}
              </strong>

              <p>
                {selectedRule.description}
              </p>

              <span>
                Signal:
                {" "}
                {readable(
                  selectedRule.signalType,
                )}
                {" · Nature: "}
                {selectedRule.nature}
                {" · Priority: "}
                {selectedRule.priority}
              </span>
            </div>
          ) : null}

          <div className="executive-rule-list">
            {cockpit
              ?.rules
              .map(
                (
                  rule:
                    ExecutiveRule,
                ) => (
                  <article
                    key={rule.id}
                  >
                    <div>
                      <strong>
                        {rule.ruleCode}
                      </strong>

                      <span>
                        {readable(
                          rule.signalType,
                        )}
                        {" · "}
                        {rule.defaultSeverity}
                      </span>
                    </div>

                    <div>
                      <span>
                        Threshold
                      </span>

                      <strong>
                        {rule.thresholdValue}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Lookahead
                      </span>

                      <strong>
                        {rule.lookaheadDays}
                        {"d"}
                      </strong>
                    </div>

                    <span
                      className={
                        rule.enabled
                          ? "executive-rule-state executive-rule-state--enabled"
                          : "executive-rule-state"
                      }
                    >
                      {rule.enabled
                        ? "Enabled"
                        : "Disabled"}
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
