"use client";

import {
  AlertTriangle,
  Banknote,
  CircleAlert,
  FileCheck2,
  Plus,
  Search,
  ShieldCheck,
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
  getContractAlerts,
  getContracts,
  getContractSummary,
} from "@/lib/api";

import type {
  ContractAlert,
  ContractStatus,
  ContractSummary,
  SupplierContract,
} from "@/types/contract";

function money(
  value: number,
): string {
  return new Intl
    .NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: "EUR",
        notation:
          Math.abs(value) >=
          100000
            ? "compact"
            : "standard",
        maximumFractionDigits: 1,
      },
    )
    .format(value);
}

export default function ContractsPage() {
  const {
    user,
  } = useAuth();

  const [
    contracts,
    setContracts,
  ] =
    useState<
      SupplierContract[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      ContractSummary |
      null
    >(null);

  const [
    alerts,
    setAlerts,
  ] =
    useState<
      ContractAlert[]
    >([]);

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
    loading,
    setLoading,
  ] =
    useState(true);

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
            getContracts(
              query ||
                undefined,
              (
                status as
                  ContractStatus
              ) ||
                undefined,
            ),
            getContractSummary(),
            getContractAlerts(),
          ])
            .then(
              ([
                contractResponse,
                summaryResponse,
                alertResponse,
              ]) => {
                if (!active) {
                  return;
                }

                setContracts(
                  contractResponse,
                );

                setSummary(
                  summaryResponse,
                );

                setAlerts(
                  alertResponse,
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
                    ? caughtError
                        .message
                    : "Unable to load contracts and compliance.",
                );
              },
            )
            .finally(
              () => {
                if (active) {
                  setLoading(
                    false,
                  );
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
  ]);

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
            Supplier governance
          </span>

          <h1>
            Contracts & compliance
          </h1>

          <p>
            Control supplier contracts,
            renewals, expiry exposure,
            compliance documentation and
            governance risk.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/contracts/new"
            className={
              "button button--primary"
            }
          >
            <Plus size={16} />
            New contract
          </Link>
        ) : null}
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

      <section
        className={
          "contract-kpi-grid"
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
              <FileCheck2
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Active contracts
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.activeContracts ??
              "—"}
          </strong>

          <p>
            {
              summary
                ?.totalContracts ??
              0
            }
            {" total contracts"}
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
              <Banknote
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Active value
          </span>

          <strong
            className={
              "kpi-card__value contract-value-kpi"
            }
          >
            {summary
              ? money(
                  summary
                    .activeContractValue,
                )
              : "—"}
          </strong>

          <p>
            Current active
            contract exposure.
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
            Expiring soon
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.expiringSoonContracts ??
              "—"}
          </strong>

          <p>
            Contracts ending
            within 30 days.
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
              <ShieldCheck
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Compliance issues
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.suppliersWithComplianceIssues ??
              "—"}
          </strong>

          <p>
            {
              summary
                ?.expiredComplianceDocuments ??
              0
            }
            {" expired documents"}
          </p>
        </article>
      </section>

      {alerts.length > 0 ? (
        <section
          className={
            "panel"
          }
        >
          <div
            className={
              "panel__header"
            }
          >
            <div>
              <span
                className={
                  "eyebrow"
                }
              >
                Governance alerts
              </span>

              <h2>
                Attention required
              </h2>
            </div>

            <AlertTriangle
              size={19}
            />
          </div>

          <div
            className={
              "contract-alert-list"
            }
          >
            {alerts
              .slice(
                0,
                8,
              )
              .map(
                (
                  alert,
                  index,
                ) => (
                  <Link
                    key={
                      `${alert.alertType}-${alert.supplierId}-${index}`
                    }
                    href={
                      alert.href
                    }
                    className={
                      `contract-alert contract-alert--${
                        alert.severity
                          .toLowerCase()
                      }`
                    }
                  >
                    <div>
                      <strong>
                        {
                          alert.title
                        }
                      </strong>

                      <span>
                        {
                          alert.supplierName
                        }
                        {alert.contractNumber
                          ? ` · ${alert.contractNumber}`
                          : ""}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {alert.daysRemaining <
                        0
                          ? `${Math.abs(
                              alert.daysRemaining,
                            )}d overdue`
                          : `${alert.daysRemaining}d`}
                      </strong>

                      <span>
                        {
                          alert.dueDate ??
                          "No date"
                        }
                      </span>
                    </div>
                  </Link>
                ),
              )}
          </div>
        </section>
      ) : null}

      <section
        className={
          "contract-toolbar"
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
              "Search contract, supplier or title"
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

            <option value="DRAFT">
              Draft
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="EXPIRED">
              Expired
            </option>

            <option value="TERMINATED">
              Terminated
            </option>
          </select>
        </div>
      </section>

      <section
        className={
          "panel contract-list-panel"
        }
      >
        <div
          className={
            "supplier-panel__summary"
          }
        >
          <div>
            <FileCheck2
              size={18}
            />

            <span>
              {loading
                ? "Loading contracts..."
                : `${contracts.length} contracts found`}
            </span>
          </div>

          <span>
            Supplier governance
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
                <th>Contract</th>
                <th>Supplier</th>
                <th>Type</th>
                <th>End date</th>
                <th>Status</th>
                <th>Value</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                contracts.map(
                  contract => (
                    <tr
                      key={
                        contract.id
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
                              contract
                                .contractNumber
                            }
                          </strong>

                          <span>
                            {
                              contract.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <Link
                          href={
                            `/suppliers/${contract.supplierId}`
                          }
                          className={
                            "contract-table-link"
                          }
                        >
                          {
                            contract
                              .supplierName
                          }
                        </Link>
                      </td>

                      <td>
                        {
                          contract
                            .contractType
                        }
                      </td>

                      <td>
                        <div
                          className={
                            "contract-expiry-cell"
                          }
                        >
                          <span>
                            {
                              new Date(
                                `${contract.endDate}T00:00:00`,
                              )
                                .toLocaleDateString()
                            }
                          </span>

                          {contract
                            .expiringSoon ? (
                            <small>
                              Expiring soon
                            </small>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `contract-status contract-status--${
                              contract.status
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            contract.status
                          }
                        </span>
                      </td>

                      <td>
                        <strong>
                          {
                            new Intl
                              .NumberFormat(
                                "en-US",
                                {
                                  style:
                                    "currency",
                                  currency:
                                    contract
                                      .currency,
                                  maximumFractionDigits:
                                    0,
                                },
                              )
                              .format(
                                contract
                                  .contractValue,
                              )
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          contract
                            .ownerName
                        }
                      </td>

                      <td>
                        <Link
                          href={
                            `/contracts/${contract.id}`
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
              contracts.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className={
                      "table-empty-state"
                    }
                  >
                    No contracts
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
