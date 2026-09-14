"use client";

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  RefreshCcw,
  UserRoundSearch,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getControlTowerDashboard,
  scanControlTower,
} from "@/lib/api";

import type {
  ControlTowerDashboard,
  ControlTowerExceptionType,
  ControlTowerItemStatus,
  ControlTowerSeverity,
} from "@/types/control-tower";

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

export default function ControlTowerPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      ControlTowerDashboard |
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
    typeFilter,
    setTypeFilter,
  ] =
    useState<
      ControlTowerExceptionType |
      ""
    >("");

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState<
      ControlTowerSeverity |
      ""
    >("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      ControlTowerItemStatus |
      ""
    >("");

  const [
    onlyOverdue,
    setOnlyOverdue,
  ] =
    useState(false);

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
    scanMessage,
    setScanMessage,
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

  const canScan =
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

    getControlTowerDashboard(
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
              : "Unable to load procurement control tower.",
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
      await getControlTowerDashboard(
        currency,
      ),
    );
  }

  async function scan() {
    try {
      setScanning(true);
      setError(null);
      setScanMessage(null);

      const result =
        await scanControlTower(
          currency,
        );

      await reload();

      setScanMessage(
        `${result.sourceExceptions} source exceptions · ${result.discoveredCount} discovered · ${result.refreshedCount} refreshed · ${result.autoResolvedCount} auto-resolved`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to run control-tower scan.",
      );
    } finally {
      setScanning(false);
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
            ?.items
            .filter(
              item =>
                !typeFilter
                ||
                item.exceptionType ===
                  typeFilter,
            )
            .filter(
              item =>
                !severityFilter
                ||
                item.severity ===
                  severityFilter,
            )
            .filter(
              item =>
                !statusFilter
                ||
                item.status ===
                  statusFilter,
            )
            .filter(
              item =>
                !onlyOverdue
                ||
                item.slaOverdue,
            )
            .filter(
              item => {
                if (!normalized) {
                  return true;
                }

                return [
                  item.title,
                  item.details,
                  item.sourceReference,
                  item.ownerName ??
                    "",
                  item.exceptionType,
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
        typeFilter,
        severityFilter,
        statusFilter,
        onlyOverdue,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Management by exception
          </span>

          <h1>
            Procurement control tower
          </h1>

          <p>
            Consolidate material
            procurement exceptions into
            one explainable operating
            queue with priority, ownership,
            SLA and resolution governance.
          </p>
        </div>

        <div className="control-tower-heading-actions">
          <label className="control-tower-currency">
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
                  void scan()
              }
            >
              <RefreshCcw
                size={16}
              />

              {scanning
                ? "Scanning..."
                : "Refresh exceptions"}
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
        <div className="control-tower-run-banner">
          <Activity
            size={16}
          />
          {scanMessage}
        </div>
      ) : null}

      <section className="control-tower-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Active exceptions
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .activeItems ??
              0}
          </strong>

          <p>
            Management queue.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Critical / high
          </span>

          <strong className="kpi-card__value">
            {(
              dashboard
                ?.summary
                .criticalItems ??
                0
            )
            +
            (
              dashboard
                ?.summary
                .highItems ??
                0
            )}
          </strong>

          <p>
            {dashboard
              ?.summary
              .criticalItems ??
              0}
            {" critical"}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            SLA overdue
          </span>

          <strong className="kpi-card__value control-tower-risk-text">
            {dashboard
              ?.summary
              .slaOverdueItems ??
              0}
          </strong>

          <p>
            Requires immediate attention.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Active exposure
          </span>

          <strong className="kpi-card__value control-tower-money-kpi">
            {money(
              dashboard
                ?.summary
                .activeMonetaryExposure ??
                0,
              currency,
            )}
          </strong>

          <p>
            Monetary exposure / value at
            stake.
          </p>
        </article>
      </section>

      <section className="control-tower-signal-grid">
        <article>
          <span>
            Supplier risk
          </span>

          <strong>
            {dashboard
              ?.summary
              .supplierRiskItems ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Compliance
          </span>

          <strong>
            {dashboard
              ?.summary
              .complianceItems ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Sourcing
          </span>

          <strong>
            {dashboard
              ?.summary
              .sourcingItems ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Benefits / leakage
          </span>

          <strong>
            {dashboard
              ?.summary
              .benefitsItems ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Governance
          </span>

          <strong>
            {dashboard
              ?.summary
              .governanceItems ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Unassigned
          </span>

          <strong>
            {dashboard
              ?.summary
              .unassignedItems ??
              0}
          </strong>
        </article>
      </section>

      {dashboard?.latestRun ? (
        <section className="control-tower-last-run">
          <BadgeCheck
            size={15}
          />

          <span>
            Last scan:
            {" "}
            {new Date(
              dashboard.latestRun.startedAt,
            )
              .toLocaleString()}
            {" · "}
            {dashboard.latestRun.discoveredCount}
            {" discovered · "}
            {dashboard.latestRun.refreshedCount}
            {" refreshed · "}
            {dashboard.latestRun.autoResolvedCount}
            {" auto-resolved"}
          </span>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Prioritized queue
            </span>

            <h2>
              Management exceptions
            </h2>
          </div>

          <UserRoundSearch
            size={19}
          />
        </div>

        <div className="control-tower-toolbar">
          <input
            value={query}
            placeholder={
              "Search title, source, owner or details"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={typeFilter}
            onChange={
              event =>
                setTypeFilter(
                  event.target.value as
                    ControlTowerExceptionType |
                    "",
                )
            }
          >
            <option value="">
              All exception types
            </option>

            <option value="SUPPLIER_RISK_ALERT">
              Supplier risk alert
            </option>

            <option value="RISK_ESCALATION_OVERDUE">
              Risk escalation overdue
            </option>

            <option value="DOCUMENT_COMPLIANCE_GAP">
              Document compliance gap
            </option>

            <option value="SOURCING_INITIATIVE_OVERDUE">
              Sourcing initiative overdue
            </option>

            <option value="BENEFIT_VALIDATION_PENDING">
              Benefit validation pending
            </option>

            <option value="BENEFIT_LEAKAGE">
              Benefit leakage
            </option>

            <option value="COMMERCIAL_LEAKAGE">
              Commercial leakage
            </option>

            <option value="GOVERNANCE_DECISION_OVERDUE">
              Governance decision overdue
            </option>

            <option value="GOVERNANCE_ACTION_OVERDUE">
              Governance action overdue
            </option>
          </select>

          <select
            value={severityFilter}
            onChange={
              event =>
                setSeverityFilter(
                  event.target.value as
                    ControlTowerSeverity |
                    "",
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
                  event.target.value as
                    ControlTowerItemStatus |
                    "",
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="OPEN">
              Open
            </option>

            <option value="ACKNOWLEDGED">
              Acknowledged
            </option>

            <option value="IN_PROGRESS">
              In progress
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="DISMISSED">
              Dismissed
            </option>
          </select>

          <label className="control-tower-checkbox">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={
                event =>
                  setOnlyOverdue(
                    event.target.checked,
                  )
              }
            />

            SLA overdue only
          </label>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Exception</th>
                <th>Severity</th>
                <th>Type</th>
                <th>Exposure</th>
                <th>SLA</th>
                <th>Owner</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  item => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        <strong
                          className={
                            item.priorityScore >=
                            80
                              ? "control-tower-risk-text"
                              : ""
                          }
                        >
                          {item.priorityScore.toFixed(
                            0,
                          )}
                        </strong>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {item.title}
                          </strong>

                          <span>
                            {item.sourceReference}
                            {" · "}
                            {item.ageDays}
                            {"d in queue"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `control-tower-severity control-tower-severity--${item.severity.toLowerCase()}`
                          }
                        >
                          {item.severity}
                        </span>
                      </td>

                      <td>
                        {readable(
                          item.exceptionType,
                        )}
                      </td>

                      <td>
                        {item.monetaryExposure >
                        0
                          ? money(
                              item.monetaryExposure,
                              item.currency,
                            )
                          : "—"}
                      </td>

                      <td>
                        <span
                          className={
                            item.slaOverdue
                              ? "control-tower-risk-text"
                              : ""
                          }
                        >
                          {new Date(
                            item.slaDueAt,
                          )
                            .toLocaleDateString()}
                        </span>
                      </td>

                      <td>
                        {item.ownerName ??
                          "Unassigned"}
                      </td>

                      <td>
                        <span
                          className={
                            `control-tower-status control-tower-status--${item.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            item.status,
                          )}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/control-tower/${item.id}`
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
                    No control-tower items
                    match the selected
                    filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="control-tower-method-note">
        <AlertTriangle
          size={18}
        />

        <div>
          <strong>
            Deterministic exception priority
          </strong>

          <p>
            Priority combines source
            severity, exception type,
            overdue urgency and monetary
            exposure. Stable exception
            keys prevent duplicate queue
            items. Rescans refresh active
            issues and automatically
            resolve queue items when the
            underlying source condition
            disappears.
          </p>
        </div>
      </section>
    </div>
  );
}
