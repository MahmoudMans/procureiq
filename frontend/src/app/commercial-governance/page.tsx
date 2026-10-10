"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  AlertTriangle,
  CalendarClock,
  CircleAlert,
  Coins,
  FileCheck2,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldAlert,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  discoverCommercialLeakage,
  getCommercialGovernanceRecords,
  getCommercialGovernanceSummary,
  getCommercialLeakageFindings,
} from "@/lib/api";

import type {
  CommercialGovernanceRecord,
  CommercialGovernanceSummary,
  CommercialLeakageFinding,
} from "@/types/commercial-governance";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

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

export default function CommercialGovernancePage() {
  const {
    user,
  } = useAuth();

  const [
    records,
    setRecords,
  ] =
    useState<
      CommercialGovernanceRecord[]
    >([]);

  const [
    findings,
    setFindings,
  ] =
    useState<
      CommercialLeakageFinding[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      CommercialGovernanceSummary |
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
    renewalFilter,
    setRenewalFilter,
  ] =
    useState("");

  const [
    leakageFilter,
    setLeakageFilter,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    discovering,
    setDiscovering,
  ] =
    useState(false);

  const [
    discoveryMessage,
    setDiscoveryMessage,
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

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getCommercialGovernanceRecords(
        currency,
      ),
      getCommercialLeakageFindings(
        currency,
      ),
      getCommercialGovernanceSummary(
        currency,
      ),
    ])
      .then(
        ([
          recordResponse,
          findingResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setRecords(
            recordResponse,
          );

          setFindings(
            findingResponse,
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
              : "Unable to load commercial governance.",
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
    const [
      recordResponse,
      findingResponse,
      summaryResponse,
    ] =
      await Promise.all([
        getCommercialGovernanceRecords(
          currency,
        ),
        getCommercialLeakageFindings(
          currency,
        ),
        getCommercialGovernanceSummary(
          currency,
        ),
      ]);

    setRecords(
      recordResponse,
    );

    setFindings(
      findingResponse,
    );

    setSummary(
      summaryResponse,
    );
  }

  async function runLeakageDiscovery() {
    try {
      setDiscovering(true);
      setError(null);
      setDiscoveryMessage(null);

      const result =
        await discoverCommercialLeakage(
          currency,
        );

      await reload();

      setDiscoveryMessage(
        `${result.candidatesDetected} candidates · ${result.createdFindings} new findings · ${result.refreshedFindings} refreshed`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to run commercial leakage checks.",
      );
    } finally {
      setDiscovering(false);
    }
  }

  const filteredRecords =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return records
          .filter(
            record =>
              !renewalFilter
              ||
              record.renewalStatus ===
                renewalFilter,
          )
          .filter(
            record => {
              if (!normalized) {
                return true;
              }

              return [
                record.supplierCode,
                record.supplierName,
                record.ownerName,
                record.contractId,
              ]
                .join(
                  " ",
                )
                .toLowerCase()
                .includes(
                  normalized,
                );
            },
          );
      },
      [
        records,
        query,
        renewalFilter,
      ],
    );

  const filteredFindings =
    useMemo(
      () =>
        findings.filter(
          finding =>
            !leakageFilter
            ||
            finding.status ===
              leakageFilter,
        ),
      [
        findings,
        leakageFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Contract economics
          </span>

          <h1>
            Commercial governance
          </h1>

          <p>
            Govern contract renewals,
            notice deadlines,
            obligations and commercial
            leakage across contracts,
            negotiations and purchase
            orders.
          </p>
        </div>

        <div className="commercial-heading-actions">
          <label className="commercial-currency-control">
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

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={discovering}
              onClick={
                () =>
                  void runLeakageDiscovery()
              }
            >
              <RefreshCw
                size={16}
              />

              {discovering
                ? "Checking..."
                : "Run leakage checks"}
            </button>
          ) : null}

          {canManage ? (
            <Link
              href="/commercial-governance/new"
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              Govern contract
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

      {discoveryMessage ? (
        <div className="commercial-discovery-banner">
          <RefreshCw
            size={16}
          />
          {discoveryMessage}
        </div>
      ) : null}

      <section className="commercial-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ScrollText
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Governed contracts
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.activeGovernanceRecords ??
              0}
          </strong>

          <p>
            {money(
              summary
                ?.governedContractValue ??
                0,
              currency,
            )}
            {" commercial baseline"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <CalendarClock
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Renewal attention
          </span>

          <strong className="kpi-card__value">
            {(summary
              ?.renewalReviews ??
              0)
              +
              (summary
                ?.noticesDueWithin30Days ??
                0)}
          </strong>

          <p>
            {summary
              ?.noticesDueWithin30Days ??
              0}
            {" notice deadlines in 30 days"}
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
            Obligations
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.openObligations ??
              0}
          </strong>

          <p>
            {summary
              ?.overdueObligations ??
              0}
            {" overdue"}
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
            Leakage exposure
          </span>

          <strong className="kpi-card__value commercial-money-kpi">
            {money(
              summary
                ?.leakageExposure ??
                0,
              currency,
            )}
          </strong>

          <p>
            {summary
              ?.criticalLeakageFindings ??
              0}
            {" critical · "}
            {summary
              ?.openLeakageFindings ??
              0}
            {" open"}
          </p>
        </article>
      </section>

      <section className="commercial-signal-grid">
        <article>
          <AlertTriangle
            size={17}
          />

          <div>
            <span>
              Expired / inactive contracts
            </span>

            <strong>
              {summary
                ?.expiredContracts ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <CalendarClock
            size={17}
          />

          <div>
            <span>
              Renewal reviews
            </span>

            <strong>
              {summary
                ?.renewalReviews ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <ShieldAlert
            size={17}
          />

          <div>
            <span>
              Open leakage findings
            </span>

            <strong>
              {summary
                ?.openLeakageFindings ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <FileCheck2
            size={17}
          />

          <div>
            <span>
              Overdue obligations
            </span>

            <strong>
              {summary
                ?.overdueObligations ??
                0}
            </strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Renewal portfolio
            </span>

            <h2>
              Contract governance
            </h2>
          </div>

          <span className="commercial-count">
            {filteredRecords.length}
            {" contracts"}
          </span>
        </div>

        <div className="commercial-toolbar">
          <input
            value={query}
            placeholder={
              "Search supplier, contract or owner"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={renewalFilter}
            onChange={
              event =>
                setRenewalFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All renewal statuses
            </option>

            <option value="UPCOMING">
              Upcoming
            </option>

            <option value="UNDER_REVIEW">
              Under review
            </option>

            <option value="RENEW">
              Renew
            </option>

            <option value="RENEGOTIATE">
              Renegotiate
            </option>

            <option value="TERMINATE">
              Terminate
            </option>

            <option value="COMPLETED">
              Completed
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contract end</th>
                <th>Notice deadline</th>
                <th>Baseline</th>
                <th>Renewal</th>
                <th>Obligations</th>
                <th>Leakage</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredRecords.map(
                  record => (
                    <tr
                      key={record.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {record.supplierName}
                          </strong>

                          <span>
                            {record.supplierCode}
                            {" · "}
                            {record.contractStatus}
                          </span>
                        </div>
                      </td>

                      <td>
                        {new Date(
                          `${record.contractEndDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </td>

                      <td>
                        {new Date(
                          `${record.noticeDeadline}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </td>

                      <td>
                        {money(
                          record.baselineContractValue,
                          record.currency,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `commercial-renewal commercial-renewal--${record.renewalStatus.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            record.renewalStatus,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            record.overdueObligations >
                            0
                              ? "commercial-overdue"
                              : ""
                          }
                        >
                          {record.openObligations}
                          {" open"}
                          {record.overdueObligations >
                          0
                            ? ` · ${record.overdueObligations} overdue`
                            : ""}
                        </span>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong className="commercial-leakage-value">
                            {money(
                              record.leakageExposure,
                              record.currency,
                            )}
                          </strong>

                          <span>
                            {record.openLeakageFindings}
                            {" findings"}
                          </span>
                        </div>
                      </td>

                      <td>
                        {record.ownerName}
                      </td>

                      <td>
                        <Link
                          href={
                            `/commercial-governance/${record.id}`
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
              filteredRecords.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No governed contracts
                    match the selected
                    filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Commercial controls
            </span>

            <h2>
              Leakage findings
            </h2>
          </div>

          <select
            className="commercial-status-filter"
            value={leakageFilter}
            onChange={
              event =>
                setLeakageFilter(
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

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="DISMISSED">
              Dismissed
            </option>
          </select>
        </div>

        <div className="commercial-finding-list">
          {filteredFindings
            .slice(
              0,
              20,
            )
            .map(
              finding => (
                <article
                  key={finding.id}
                  className={
                    `commercial-finding commercial-finding--${finding.severity.toLowerCase()}`
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
                        {finding.supplierName}
                        {finding.purchaseOrderNumber
                          ? ` · ${finding.purchaseOrderNumber}`
                          : ""}
                      </small>
                    </div>

                    <div>
                      <span>
                        Exposure
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

                  <div className="commercial-finding-footer">
                    <span>
                      {readable(
                        finding.status,
                      )}
                      {" · Detected "}
                      {new Date(
                        finding.detectedAt,
                      )
                        .toLocaleDateString()}
                    </span>

                    {finding.governanceId ? (
                      <Link
                        href={
                          `/commercial-governance/${finding.governanceId}`
                        }
                        className="table-action"
                      >
                        Open governance
                      </Link>
                    ) : null}
                  </div>
                </article>
              ),
            )}

          {!loading &&
          filteredFindings.length ===
            0 ? (
            <div className="commercial-empty">
              No commercial leakage
              findings match the current
              filter.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
