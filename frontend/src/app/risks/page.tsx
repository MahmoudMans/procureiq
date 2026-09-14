"use client";

import {
  AlertTriangle,
  CircleAlert,
  Gauge,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getRiskCases,
  getRiskSummary,
  refreshSystemRiskExceptions,
} from "@/lib/api";

import type {
  RiskCase,
  RiskCaseStatus,
  RiskCategory,
  RiskSeverity,
  RiskSummary,
} from "@/types/risk";

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

export default function RiskRegisterPage() {
  const {
    user,
  } = useAuth();

  const [
    cases,
    setCases,
  ] =
    useState<RiskCase[]>(
      [],
    );

  const [
    summary,
    setSummary,
  ] =
    useState<
      RiskSummary |
      null
    >(null);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    status,
    setStatus,
  ] =
    useState("");

  const [
    severity,
    setSeverity,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    refreshMessage,
    setRefreshMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const canManage =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    const timer =
      window.setTimeout(
        () => {
          Promise.all([
            getRiskCases(
              query ||
                undefined,
              (
                status as
                  RiskCaseStatus
              ) ||
                undefined,
              (
                severity as
                  RiskSeverity
              ) ||
                undefined,
              (
                category as
                  RiskCategory
              ) ||
                undefined,
            ),
            getRiskSummary(),
          ])
            .then(
              ([
                riskResponse,
                summaryResponse,
              ]) => {
                if (!active) {
                  return;
                }

                setCases(
                  riskResponse,
                );

                setSummary(
                  summaryResponse,
                );

                setError(
                  null,
                );
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
                    : "Unable to load procurement risks.",
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
        },
        180,
      );

    return () => {
      active = false;

      window.clearTimeout(
        timer,
      );
    };
  }, [
    query,
    status,
    severity,
    category,
  ]);

  async function refreshExceptions() {
    try {
      setRefreshing(true);
      setError(null);
      setRefreshMessage(null);

      const result =
        await refreshSystemRiskExceptions();

      const [
        riskResponse,
        summaryResponse,
      ] =
        await Promise.all([
          getRiskCases(
            query ||
              undefined,
            (
              status as
                RiskCaseStatus
            ) ||
              undefined,
            (
              severity as
                RiskSeverity
            ) ||
              undefined,
            (
              category as
                RiskCategory
            ) ||
              undefined,
          ),
          getRiskSummary(),
        ]);

      setCases(
        riskResponse,
      );

      setSummary(
        summaryResponse,
      );

      setRefreshMessage(
        `${result.discoveredConditions} conditions checked · ${result.createdCases} created · ${result.reopenedCases} reopened · ${result.updatedCases} updated`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to refresh system exceptions.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Procurement governance
          </span>

          <h1>
            Risk register
          </h1>

          <p>
            Centralize procurement
            exceptions, score exposure,
            assign ownership, track
            mitigation and control
            resolution.
          </p>
        </div>

        <div
          className={
            "risk-heading-actions"
          }
        >
          {canManage ? (
            <>
              <button
                type="button"
                className={
                  "button button--secondary"
                }
                disabled={
                  refreshing
                }
                onClick={
                  () =>
                    void refreshExceptions()
                }
              >
                <RefreshCw
                  size={16}
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh exceptions"}
              </button>

              <Link
                href="/risks/new"
                className={
                  "button button--primary"
                }
              >
                <Plus size={16} />
                New risk
              </Link>
            </>
          ) : null}
        </div>
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      {refreshMessage ? (
        <div
          className={
            "risk-refresh-banner"
          }
        >
          <RefreshCw
            size={16}
          />
          {refreshMessage}
        </div>
      ) : null}

      <section
        className={
          "risk-kpi-grid"
        }
      >
        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <ShieldAlert
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Open risks
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.openCases ??
              "—"}
          </strong>

          <p>
            {
              summary
                ?.totalCases ??
              0
            }
            {" total risk cases"}
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Siren size={20} />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Critical
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.criticalCases ??
              "—"}
          </strong>

          <p>
            {
              summary
                ?.highCases ??
              0
            }
            {" additional high risks"}
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Overdue
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.overdueCases ??
              "—"}
          </strong>

          <p>
            Risk actions past
            target resolution date.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Gauge size={20} />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Average score
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.averageOpenRiskScore
              .toFixed(1) ??
              "—"}
          </strong>

          <p>
            Average open
            exposure out of 25.
          </p>
        </article>
      </section>

      <section
        className={
          "risk-toolbar"
        }
      >
        <div
          className={
            "supplier-toolbar__search"
          }
        >
          <Search size={18} />

          <input
            value={query}
            placeholder={
              "Search risk, supplier or description"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />
        </div>

        <div
          className={
            "select-wrapper"
          }
        >
          <select
            value={status}
            onChange={
              event =>
                setStatus(
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

            <option value="IN_MITIGATION">
              In mitigation
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="ACCEPTED">
              Accepted
            </option>
          </select>
        </div>

        <div
          className={
            "select-wrapper"
          }
        >
          <select
            value={severity}
            onChange={
              event =>
                setSeverity(
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
        </div>

        <div
          className={
            "select-wrapper"
          }
        >
          <select
            value={category}
            onChange={
              event =>
                setCategory(
                  event.target.value,
                )
            }
          >
            <option value="">
              All categories
            </option>

            <option value="SUPPLIER">
              Supplier
            </option>

            <option value="CONTRACT">
              Contract
            </option>

            <option value="PURCHASE_ORDER">
              Purchase order
            </option>

            <option value="DELIVERY">
              Delivery
            </option>

            <option value="SOURCING">
              Sourcing
            </option>

            <option value="COMPLIANCE">
              Compliance
            </option>

            <option value="OTHER">
              Other
            </option>
          </select>
        </div>
      </section>

      <section
        className={
          "panel risk-list-panel"
        }
      >
        <div
          className={
            "supplier-panel__summary"
          }
        >
          <div>
            <ShieldAlert
              size={18}
            />

            <span>
              {loading
                ? "Loading risk register..."
                : `${cases.length} risks found`}
            </span>
          </div>

          <span>
            Enterprise exception
            register
          </span>
        </div>

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table"
            }
          >
            <thead>
              <tr>
                <th>Risk</th>
                <th>Context</th>
                <th>Category</th>
                <th>Score</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                cases.map(
                  risk => (
                    <tr
                      key={
                        risk.id
                      }
                    >
                      <td>
                        <div
                          className={
                            "request-primary-cell"
                          }
                        >
                          <strong>
                            {
                              risk
                                .riskNumber
                            }
                          </strong>

                          <span>
                            {
                              risk.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <div
                          className={
                            "risk-context-cell"
                          }
                        >
                          <strong>
                            {
                              risk.supplierName ??
                              risk.purchaseOrderNumber ??
                              risk.contractNumber ??
                              risk.rfqNumber ??
                              "General"
                            }
                          </strong>

                          <span>
                            {
                              risk.origin ===
                              "SYSTEM"
                                ? "System detected"
                                : "Manual"
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          readable(
                            risk.category,
                          )
                        }
                      </td>

                      <td>
                        <span
                          className={
                            "risk-score"
                          }
                        >
                          {
                            risk.riskScore
                          }
                          /25
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `risk-severity risk-severity--${
                              risk.severity
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            risk.severity
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `risk-status risk-status--${
                              risk.status
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            readable(
                              risk.status,
                            )
                          }
                        </span>
                      </td>

                      <td>
                        {
                          risk.ownerName
                        }
                      </td>

                      <td>
                        <div
                          className={
                            "risk-due-cell"
                          }
                        >
                          <span>
                            {risk.dueDate
                              ? new Date(
                                  `${risk.dueDate}T00:00:00`,
                                )
                                  .toLocaleDateString()
                              : "—"}
                          </span>

                          {risk.overdue ? (
                            <small>
                              Overdue
                            </small>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <Link
                          href={
                            `/risks/${risk.id}`
                          }
                          className={
                            "table-action"
                          }
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              cases.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className={
                      "table-empty-state"
                    }
                  >
                    No risk cases
                    match the current
                    filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
