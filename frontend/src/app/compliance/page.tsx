"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  AlertTriangle,
  CircleAlert,
  FileCheck2,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Scale,
  TicketCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  activateCompliancePolicy,
  deactivateCompliancePolicy,
  evaluateCompliancePolicies,
  getCompliancePolicies,
  getPolicyComplianceSummary,
  getPolicyViolations,
} from "@/lib/api";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import type {
  PolicyComplianceSummary,
  PolicyViolation,
  ProcurementPolicy,
} from "@/types/policy-compliance";

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
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export default function CompliancePage() {
  const {
    user,
  } = useAuth();

  const [
    policies,
    setPolicies,
  ] =
    useState<
      ProcurementPolicy[]
    >([]);

  const [
    violations,
    setViolations,
  ] =
    useState<
      PolicyViolation[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      PolicyComplianceSummary |
      null
    >(null);

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("");

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    evaluating,
    setEvaluating,
  ] =
    useState(false);

  const [
    evaluationMessage,
    setEvaluationMessage,
  ] =
    useState<
      string |
      null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  const canAdmin =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  const canEvaluate =
    canAdmin
    ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getCompliancePolicies(),
      getPolicyViolations(),
      getPolicyComplianceSummary(),
    ])
      .then(
        ([
          policiesResponse,
          violationsResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setPolicies(
            policiesResponse,
          );

          setViolations(
            violationsResponse,
          );

          setSummary(
            summaryResponse,
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
              : "Unable to load procurement compliance.",
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
    const [
      policiesResponse,
      violationsResponse,
      summaryResponse,
    ] =
      await Promise.all([
        getCompliancePolicies(),
        getPolicyViolations(),
        getPolicyComplianceSummary(),
      ]);

    setPolicies(
      policiesResponse,
    );

    setViolations(
      violationsResponse,
    );

    setSummary(
      summaryResponse,
    );
  }

  async function evaluatePolicies() {
    try {
      setEvaluating(true);
      setError(null);
      setEvaluationMessage(null);

      const result =
        await evaluateCompliancePolicies();

      await reload();

      setEvaluationMessage(
        `${result.policiesEvaluated} active policies · ${result.candidatesEvaluated} candidates · ${result.createdViolations} new violations · ${result.refreshedViolations} refreshed`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to evaluate procurement policies.",
      );
    } finally {
      setEvaluating(false);
    }
  }

  async function togglePolicy(
    policy:
      ProcurementPolicy,
  ) {
    try {
      setError(null);

      if (
        policy.status ===
        "ACTIVE"
      ) {
        await deactivateCompliancePolicy(
          policy.id,
        );
      } else {
        await activateCompliancePolicy(
          policy.id,
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
          : "Unable to update procurement policy.",
      );
    }
  }

  const filteredViolations =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        return violations
          .filter(
            violation =>
              !severityFilter
              ||
              violation.severity ===
                severityFilter,
          )
          .filter(
            violation =>
              !statusFilter
              ||
              violation.status ===
                statusFilter,
          )
          .filter(
            violation => {
              if (
                !normalizedQuery
              ) {
                return true;
              }

              return [
                violation.policyCode,
                violation.policyName,
                violation.sourceReference ??
                  "",
                violation.details,
              ]
                .join(
                  " ",
                )
                .toLowerCase()
                .includes(
                  normalizedQuery,
                );
            },
          );
      },
      [
        violations,
        severityFilter,
        statusFilter,
        query,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement governance
          </span>

          <h1>
            Policy & compliance
          </h1>

          <p>
            Configure procurement
            controls, detect policy
            violations automatically,
            govern waivers and maintain
            remediation evidence.
          </p>
        </div>

        <div className="compliance-heading-actions">
          {canEvaluate ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={evaluating}
              onClick={
                () =>
                  void evaluatePolicies()
              }
            >
              <RefreshCw
                size={16}
              />

              {evaluating
                ? "Evaluating..."
                : "Run policy checks"}
            </button>
          ) : null}

          {canAdmin ? (
            <Link
              href="/compliance/policies/new"
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New policy
            </Link>
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

      {evaluationMessage ? (
        <div className="compliance-evaluation-banner">
          <ShieldCheck
            size={16}
          />
          {evaluationMessage}
        </div>
      ) : null}

      <section className="compliance-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Scale
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Active policies
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.activePolicies ??
              0}
          </strong>

          <p>
            {summary
              ?.totalPolicies ??
              0}
            {" total configured policies"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ShieldAlert
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Open violations
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.openViolations ??
              0}
          </strong>

          <p>
            {summary
              ?.criticalViolations ??
              0}
            {" critical · "}
            {summary
              ?.highViolations ??
              0}
            {" high"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <TicketCheck
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Pending waivers
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.pendingWaivers ??
              0}
          </strong>

          <p>
            {summary
              ?.waivedViolations ??
              0}
            {" approved waivers"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <FileCheck2
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Resolution rate
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.resolutionRate
              .toFixed(1) ??
              "—"}
            %
          </strong>

          <p>
            {summary
              ?.resolvedViolations ??
              0}
            {" resolved violations"}
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Policy authority
            </span>

            <h2>
              Procurement controls
            </h2>
          </div>

          <ShieldCheck
            size={19}
          />
        </div>

        <div className="compliance-policy-grid">
          {policies.map(
            policy => (
              <article
                key={policy.id}
                className={
                  `compliance-policy-card compliance-policy-card--${policy.status.toLowerCase()}`
                }
              >
                <div className="compliance-policy-heading">
                  <div>
                    <span>
                      {policy.policyCode}
                    </span>

                    <strong>
                      {policy.name}
                    </strong>
                  </div>

                  <span
                    className={
                      `compliance-policy-status compliance-policy-status--${policy.status.toLowerCase()}`
                    }
                  >
                    {policy.status}
                  </span>
                </div>

                <p>
                  {policy.description ??
                    readable(
                      policy.policyType,
                    )}
                </p>

                <div className="compliance-policy-meta">
                  <span>
                    {readable(
                      policy.policyType,
                    )}
                  </span>

                  <span
                    className={
                      `compliance-severity compliance-severity--${policy.severity.toLowerCase()}`
                    }
                  >
                    {policy.severity}
                  </span>

                  {policy.thresholdAmount !==
                  null ? (
                    <span>
                      Threshold:
                      {" "}
                      {policy.currency
                        ? money(
                            policy.thresholdAmount,
                            policy.currency,
                          )
                        : policy.thresholdAmount}
                    </span>
                  ) : null}

                  <span>
                    {policy.openViolations}
                    {" open"}
                  </span>
                </div>

                <div className="compliance-policy-footer">
                  <span>
                    Owner:
                    {" "}
                    {policy.ownerName}
                  </span>

                  {canAdmin ? (
                    <button
                      type="button"
                      className="compliance-inline-button"
                      onClick={
                        () =>
                          void togglePolicy(
                            policy,
                          )
                      }
                    >
                      {policy.status ===
                      "ACTIVE"
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  ) : null}
                </div>
              </article>
            ),
          )}

          {!loading &&
          policies.length === 0 ? (
            <div className="compliance-empty compliance-empty--wide">
              No procurement policies
              are configured yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Compliance execution
            </span>

            <h2>
              Policy violations
            </h2>
          </div>

          <span className="compliance-count">
            {filteredViolations.length}
            {" violations"}
          </span>
        </div>

        <div className="compliance-toolbar">
          <input
            value={query}
            placeholder={
              "Search policy, reference or violation"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

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
            <option value="">
              All statuses
            </option>

            <option value="OPEN">
              Open
            </option>

            <option value="WAIVER_REQUESTED">
              Waiver requested
            </option>

            <option value="WAIVED">
              Waived
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="DISMISSED">
              Dismissed
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Detected</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredViolations.map(
                  violation => (
                    <tr
                      key={violation.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {violation.policyCode}
                          </strong>

                          <span>
                            {violation.policyName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {violation.sourceReference ??
                              "—"}
                          </strong>

                          <span>
                            {readable(
                              violation.sourceType,
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        {violation.sourceAmount !==
                        null
                          ? (
                              violation.currency
                                ? money(
                                    violation.sourceAmount,
                                    violation.currency,
                                  )
                                : violation.sourceAmount
                            )
                          : "—"}
                      </td>

                      <td>
                        <span
                          className={
                            `compliance-severity compliance-severity--${violation.severity.toLowerCase()}`
                          }
                        >
                          {violation.severity}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `compliance-violation-status compliance-violation-status--${violation.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            violation.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {violation.policyOwnerName}
                      </td>

                      <td>
                        {new Date(
                          violation.detectedAt,
                        )
                          .toLocaleDateString()}
                      </td>

                      <td>
                        <Link
                          href={
                            `/compliance/violations/${violation.id}`
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
              filteredViolations.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No policy violations
                    match the selected
                    filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>
    </div>
  );
}
