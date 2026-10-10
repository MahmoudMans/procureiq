"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  Database,
  GitCompare,
  RefreshCw,
  SearchCheck,
  Settings2,
  ShieldCheck,
  Wrench,
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
  getDataQualityDashboard,
  runDataQualityScan,
  updateDataQualityRule,
} from "@/lib/api";

import type {
  DataQualityDashboard,
  DataQualityDomain,
  DataQualityRule,
  DataQualitySeverity,
} from "@/types/data-quality";

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

export default function DataQualityPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      DataQualityDashboard |
      null
    >(null);

  const [
    domainFilter,
    setDomainFilter,
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
    query,
    setQuery,
  ] =
    useState("");

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
    useState<DataQualitySeverity>(
      "MEDIUM",
    );

  const [
    ruleWeight,
    setRuleWeight,
  ] =
    useState(10);

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

    getDataQualityDashboard()
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
              : "Unable to load data-quality governance.",
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
  }, []);

  async function reload() {
    setDashboard(
      await getDataQualityDashboard(),
    );
  }

  async function runScan() {
    try {
      setScanning(true);
      setError(null);
      setScanMessage(null);

      const result =
        await runDataQualityScan();

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
          : "Unable to run data-quality scan.",
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
      rule.severity,
    );

    setRuleWeight(
      rule.weight,
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

      await updateDataQualityRule(
        Number(
          selectedRuleId,
        ),
        {
          enabled:
            ruleEnabled,
          severity:
            ruleSeverity,
          weight:
            ruleWeight,
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
          : "Unable to update data-quality rule.",
      );
    } finally {
      setSavingRule(false);
    }
  }

  const filteredFindings =
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
                !domainFilter
                ||
                finding.domain ===
                  domainFilter,
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
                      "REMEDIATION_IN_PROGRESS"
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
        domainFilter,
        severityFilter,
        statusFilter,
        query,
      ],
    );

  const selectedRule:
    DataQualityRule |
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
            Master-data governance
          </span>

          <h1>
            Data quality
          </h1>

          <p>
            Detect duplicate suppliers,
            incomplete master data and
            cross-transaction
            inconsistencies without
            automatically rewriting
            authoritative business data.
          </p>
        </div>

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
            <RefreshCw
              size={16}
            />

            {scanning
              ? "Scanning..."
              : "Run quality scan"}
          </button>
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

      {scanMessage ? (
        <div className="data-quality-scan-banner">
          <SearchCheck
            size={16}
          />
          {scanMessage}
        </div>
      ) : null}

      <section className="data-quality-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <GaugeIcon />
            </div>
          </div>

          <span className="kpi-card__label">
            Overall quality score
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .overallScore
              .toFixed(1) ??
              "—"}
          </strong>

          <p>
            Weighted enabled-rule
            quality score.
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
            Active findings
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .openFindings ??
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
              <GitCompare
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Duplicate candidates
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .duplicateCandidates ??
              0}
          </strong>

          <p>
            Potential duplicate supplier
            pairs.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Wrench
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Remediation
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .activeRemediationTasks ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .overdueRemediationTasks ??
              0}
            {" overdue"}
          </p>
        </article>
      </section>

      <section className="data-quality-domain-grid">
        {dashboard
          ?.domainScores
          .map(
            domain => (
              <article
                key={domain.domain}
              >
                <div>
                  <span>
                    {readable(
                      domain.domain,
                    )}
                  </span>

                  <strong>
                    {domain.score.toFixed(1)}
                  </strong>
                </div>

                <div className="data-quality-score-bar">
                  <div
                    style={{
                      width:
                        `${Math.max(
                          0,
                          Math.min(
                            100,
                            domain.score,
                          ),
                        )}%`,
                    }}
                  />
                </div>

                <p>
                  {domain.affectedRules}
                  {" affected rules · "}
                  {domain.openFindings}
                  {" active findings"}
                </p>
              </article>
            ),
          )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Quality controls
            </span>

            <h2>
              Governance findings
            </h2>
          </div>

          <span className="data-quality-count">
            {filteredFindings.length}
            {" findings"}
          </span>
        </div>

        <div className="data-quality-toolbar">
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
            value={domainFilter}
            onChange={
              event =>
                setDomainFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All domains
            </option>

            <option value="SUPPLIER">
              Supplier
            </option>

            <option value="TRANSACTION">
              Transaction
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

            <option value="REMEDIATION_IN_PROGRESS">
              Remediation in progress
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="DISMISSED">
              Dismissed
            </option>

            <option value="ALL">
              All
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Entity</th>
                <th>Reference</th>
                <th>Domain</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Remediation</th>
                <th>Last detected</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredFindings.map(
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
                        {readable(
                          finding.entityType,
                        )}
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
                          finding.domain,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `data-quality-severity data-quality-severity--${finding.severity.toLowerCase()}`
                          }
                        >
                          {finding.severity}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `data-quality-status data-quality-status--${finding.status.toLowerCase().replaceAll("_", "-")}`
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
                            finding.overdueRemediationTasks >
                            0
                              ? "data-quality-overdue"
                              : ""
                          }
                        >
                          {finding.openRemediationTasks}
                          {" active"}
                          {finding.overdueRemediationTasks >
                          0
                            ? ` · ${finding.overdueRemediationTasks} overdue`
                            : ""}
                        </span>
                      </td>

                      <td>
                        {new Date(
                          finding.lastSeenAt,
                        )
                          .toLocaleString()}
                      </td>

                      <td>
                        <Link
                          href={
                            `/data-quality/${finding.id}`
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
              filteredFindings.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No data-quality
                    findings match the
                    selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      {canConfigure ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance configuration
              </span>

              <h2>
                Quality rules
              </h2>
            </div>

            <Settings2
              size={19}
            />
          </div>

          <form
            className="data-quality-rule-form"
            onSubmit={saveRule}
          >
            <label className="request-field data-quality-rule-wide">
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
                        DataQualitySeverity,
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

            <label className="data-quality-rule-enabled">
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
            <div className="data-quality-rule-description">
              <Database
                size={16}
              />

              <div>
                <strong>
                  {selectedRule.title}
                </strong>

                <p>
                  {selectedRule.description}
                </p>

                <span>
                  {readable(
                    selectedRule.domain,
                  )}
                  {" · "}
                  {selectedRule.activeFindings}
                  {" active findings"}
                </span>
              </div>
            </div>
          ) : null}

          <div className="data-quality-rule-list">
            {dashboard
              ?.rules
              .map(
                rule => (
                  <article
                    key={rule.id}
                  >
                    <div>
                      <strong>
                        {rule.ruleCode}
                      </strong>

                      <span>
                        {readable(
                          rule.domain,
                        )}
                      </span>
                    </div>

                    <span
                      className={
                        `data-quality-severity data-quality-severity--${rule.severity.toLowerCase()}`
                      }
                    >
                      {rule.severity}
                    </span>

                    <div>
                      <span>
                        Weight
                      </span>

                      <strong>
                        {rule.weight}
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

                    <span
                      className={
                        rule.enabled
                          ? "data-quality-rule-state data-quality-rule-state--enabled"
                          : "data-quality-rule-state"
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

      <section className="data-quality-integrity-note">
        <ShieldCheck
          size={18}
        />

        <div>
          <strong>
            Non-destructive governance
          </strong>

          <p>
            ProcureIQ detects and governs
            quality defects but does not
            automatically merge
            suppliers, rewrite master
            data or alter transactional
            records. Remediation remains
            an explicit governed action.
          </p>
        </div>
      </section>
    </div>
  );
}

function GaugeIcon() {
  return (
    <BadgeCheck
      size={20}
    />
  );
}
