"use client";

import {
  AlertTriangle,
  CircleAlert,
  Coins,
  FileWarning,
  SearchCheck,
  Settings2,
  ShieldAlert,
} from "lucide-react";

import Link from "next/link";

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
  getAnomalyControlDashboard,
  runAnomalyControlScan,
  updateAnomalyRule,
} from "@/lib/api";

import type {
  AnomalyControlDashboard,
  AnomalyRule,
  AnomalySeverity,
} from "@/types/anomaly-control";

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

export default function AnomalyControlPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      AnomalyControlDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    query,
    setQuery,
  ] =
    useState("");

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
    statusFilter,
    setStatusFilter,
  ] =
    useState("ACTIVE");

  const [
    scanMessage,
    setScanMessage,
  ] =
    useState<
      string |
      null
    >(null);

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
    ruleSeverity,
    setRuleSeverity,
  ] =
    useState<AnomalySeverity>(
      "MEDIUM",
    );

  const [
    ruleWeight,
    setRuleWeight,
  ] =
    useState(10);

  const [
    ruleThreshold,
    setRuleThreshold,
  ] =
    useState(0);

  const [
    ruleLookback,
    setRuleLookback,
  ] =
    useState(90);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    scanning,
    setScanning,
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

  const canScan =
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

    getAnomalyControlDashboard(
      currency,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
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
              : "Unable to load anomaly-control intelligence.",
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
    setDashboard(
      await getAnomalyControlDashboard(
        currency,
      ),
    );
  }

  async function runScan() {
    try {
      setScanning(true);
      setError(null);
      setScanMessage(null);

      const result =
        await runAnomalyControlScan(
          currency,
        );

      await reload();

      setScanMessage(
        `${result.candidatesDetected} detected · ${result.createdFindings} new · ${result.refreshedFindings} refreshed · ${result.autoResolvedFindings} auto-resolved`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to run anomaly scan.",
      );
    } finally {
      setScanning(false);
    }
  }

  function selectRule(
    value: string,
  ) {
    setSelectedRuleId(
      value,
    );

    const rule =
      dashboard
        ?.rules
        .find(
          candidate =>
            String(
              candidate.id,
            ) ===
            value,
        );

    if (!rule) {
      return;
    }

    setRuleEnabled(
      rule.enabled,
    );

    setRuleSeverity(
      rule.defaultSeverity,
    );

    setRuleWeight(
      rule.scoreWeight,
    );

    setRuleThreshold(
      rule.thresholdValue,
    );

    setRuleLookback(
      rule.lookbackDays,
    );
  }

  async function saveRule(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedRuleId) {
      return;
    }

    try {
      setSavingRule(true);
      setError(null);

      await updateAnomalyRule(
        Number(
          selectedRuleId,
        ),
        {
          enabled:
            ruleEnabled,
          defaultSeverity:
            ruleSeverity,
          scoreWeight:
            ruleWeight,
          thresholdValue:
            ruleThreshold,
          lookbackDays:
            ruleLookback,
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
          : "Unable to update anomaly rule.",
      );
    } finally {
      setSavingRule(false);
    }
  }

  const filtered =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return (
          dashboard
            ?.findings
            .filter(
              finding =>
                !signalFilter
                ||
                finding.signalType ===
                  signalFilter,
            )
            .filter(
              finding =>
                !severityFilter
                ||
                finding.severity ===
                  severityFilter,
            )
            .filter(
              finding =>
                statusFilter ===
                  "ALL"
                ||
                (
                  statusFilter ===
                    "ACTIVE"
                  &&
                  (
                    finding.status ===
                      "OPEN"
                    ||
                    finding.status ===
                      "UNDER_INVESTIGATION"
                  )
                )
                ||
                finding.status ===
                  statusFilter,
            )
            .filter(
              finding => {
                if (!normalized) {
                  return true;
                }

                return [
                  finding.ruleCode,
                  finding.ruleTitle,
                  finding.entityType,
                  finding.entityReference ??
                    "",
                  finding.details,
                ]
                  .join(
                    " ",
                  )
                  .toLowerCase()
                  .includes(
                    normalized,
                  );
              },
            )
          ??
          []
        );
      },
      [
        dashboard,
        query,
        signalFilter,
        severityFilter,
        statusFilter,
      ],
    );

  const selectedRule:
    AnomalyRule |
    null =
      dashboard
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
            Procurement controls
          </span>

          <h1>
            Anomaly control
          </h1>

          <p>
            Detect explainable
            procurement-control
            indicators, prioritize
            material anomalies and manage
            investigation evidence and
            disposition.
          </p>
        </div>

        <div className="anomaly-heading-actions">
          <label className="anomaly-currency-control">
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

          {canScan ? (
            <button
              type="button"
              className="button button--primary"
              disabled={scanning}
              onClick={
                () =>
                  void runScan()
              }
            >
              <SearchCheck
                size={16}
              />

              {scanning
                ? "Scanning..."
                : "Run anomaly scan"}
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

      {scanMessage ? (
        <div className="anomaly-scan-banner">
          <SearchCheck
            size={16}
          />
          {scanMessage}
        </div>
      ) : null}

      <section className="anomaly-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ShieldAlert
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Active anomalies
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .activeFindings ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .criticalFindings ??
              0}
            {" critical"}
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
            Active exposure
          </span>

          <strong className="kpi-card__value anomaly-money-kpi">
            {money(
              dashboard
                ?.summary
                .activeExposure ??
                0,
              currency,
            )}
          </strong>

          <p>
            Currency-scoped control
            exposure.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <FileWarning
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Investigations
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .activeInvestigations ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .overdueInvestigations ??
              0}
            {" overdue"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Confirmed findings
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .confirmedFindings ??
              0}
          </strong>

          <p>
            Historical confirmed control
            exceptions.
          </p>
        </article>
      </section>

      <section className="anomaly-pattern-grid">
        <article>
          <span>
            Duplicate references
          </span>

          <strong>
            {dashboard
              ?.summary
              .duplicateInvoiceSignals ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Repeated values
          </span>

          <strong>
            {dashboard
              ?.summary
              .repeatedValueSignals ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Split purchase
          </span>

          <strong>
            {dashboard
              ?.summary
              .splitPurchaseSignals ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Concentration
          </span>

          <strong>
            {dashboard
              ?.summary
              .concentrationSignals ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Off-contract
          </span>

          <strong>
            {dashboard
              ?.summary
              .offContractSignals ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Control portfolio
            </span>

            <h2>
              Signal distribution
            </h2>
          </div>
        </div>

        <div className="anomaly-signal-grid">
          {dashboard
            ?.signalSummaries
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
                    {signal.activeFindings}
                  </strong>

                  <div>
                    <span>
                      Critical
                    </span>

                    <strong>
                      {signal.criticalFindings}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Exposure
                    </span>

                    <strong>
                      {money(
                        signal.exposure,
                        currency,
                      )}
                    </strong>
                  </div>
                </article>
              ),
            )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Control indicators
            </span>

            <h2>
              Anomaly findings
            </h2>
          </div>

          <span className="anomaly-count">
            {filtered.length}
            {" findings"}
          </span>
        </div>

        <div className="anomaly-toolbar">
          <input
            value={query}
            placeholder={
              "Search rule, entity or finding"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

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

            <option value="INVOICE">
              Invoice
            </option>

            <option value="SPEND">
              Spend
            </option>

            <option value="COMMERCIAL">
              Commercial
            </option>

            <option value="PROCESS">
              Process
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
          </select>

          <select
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value,
                )
            }
          >
            <option value="ACTIVE">
              Active
            </option>

            <option value="OPEN">
              Open
            </option>

            <option value="UNDER_INVESTIGATION">
              Under investigation
            </option>

            <option value="CONFIRMED">
              Confirmed
            </option>

            <option value="DISMISSED">
              Dismissed
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="ALL">
              All
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Reference</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Score</th>
                <th>Exposure</th>
                <th>Status</th>
                <th>Investigation</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  finding => (
                    <tr
                      key={finding.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {finding.ruleTitle}
                          </strong>

                          <span>
                            {finding.ruleCode}
                          </span>
                        </div>
                      </td>

                      <td>
                        {finding.entityReference ??
                          finding.entityId.slice(
                            0,
                            10,
                          )}
                      </td>

                      <td>
                        {readable(
                          finding.signalType,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `anomaly-severity anomaly-severity--${finding.severity.toLowerCase()}`
                          }
                        >
                          {finding.severity}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {finding.anomalyScore.toFixed(
                            0,
                          )}
                        </strong>
                      </td>

                      <td>
                        {finding.exposureValue !==
                        null
                          ? finding.currency
                            ? money(
                                finding.exposureValue,
                                finding.currency,
                              )
                            : finding.exposureValue.toFixed(
                                2,
                              )
                          : "—"}
                      </td>

                      <td>
                        <span
                          className={
                            `anomaly-status anomaly-status--${finding.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            finding.status,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            finding.overdueInvestigations >
                            0
                              ? "anomaly-overdue"
                              : ""
                          }
                        >
                          {finding.activeInvestigations}
                          {" active"}
                          {finding.overdueInvestigations >
                          0
                            ? ` · ${finding.overdueInvestigations} overdue`
                            : ""}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/anomaly-control/${finding.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              filtered.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No anomaly findings
                    match the selected
                    controls.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canConfigure ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Detection governance
              </span>

              <h2>
                Anomaly rules
              </h2>
            </div>

            <Settings2
              size={19}
            />
          </div>

          <form
            className="anomaly-rule-form"
            onSubmit={saveRule}
          >
            <label className="request-field anomaly-rule-wide">
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

                {dashboard
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
                Severity
              </span>

              <select
                value={ruleSeverity}
                disabled={!selectedRule}
                onChange={
                  event =>
                    setRuleSeverity(
                      event.target.value as
                        AnomalySeverity,
                    )
                }
              >
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

            <label className="request-field">
              <span>
                Score weight
              </span>

              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={ruleWeight}
                disabled={!selectedRule}
                onChange={
                  event =>
                    setRuleWeight(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
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
                Lookback days
              </span>

              <input
                type="number"
                min="1"
                max="3650"
                value={ruleLookback}
                disabled={!selectedRule}
                onChange={
                  event =>
                    setRuleLookback(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="anomaly-rule-enabled">
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
            <div className="anomaly-rule-description">
              <strong>
                {selectedRule.title}
              </strong>

              <p>
                {selectedRule.description}
              </p>

              <span>
                {readable(
                  selectedRule.signalType,
                )}
                {" · "}
                {selectedRule.activeFindings}
                {" active findings"}
              </span>
            </div>
          ) : null}

          <div className="anomaly-rule-list">
            {dashboard
              ?.rules
              .map(
                (
                  rule:
                    AnomalyRule,
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
                      </span>
                    </div>

                    <span
                      className={
                        `anomaly-severity anomaly-severity--${rule.defaultSeverity.toLowerCase()}`
                      }
                    >
                      {rule.defaultSeverity}
                    </span>

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
                        Lookback
                      </span>

                      <strong>
                        {rule.lookbackDays}
                        {"d"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Findings
                      </span>

                      <strong>
                        {rule.activeFindings}
                      </strong>
                    </div>
                  </article>
                ),
              )}
          </div>
        </section>
      ) : null}

      <section className="anomaly-control-note">
        <ShieldAlert
          size={18}
        />

        <div>
          <strong>
            Anomaly indicators are not proof of fraud
          </strong>

          <p>
            ProcureIQ surfaces
            deterministic control
            indicators for investigation.
            A signal becomes a confirmed
            finding only through an
            explicit governed
            investigation and
            disposition.
          </p>
        </div>
      </section>
    </div>
  );
}
