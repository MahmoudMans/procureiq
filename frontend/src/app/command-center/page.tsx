"use client";

import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  FileWarning,
  Gauge,
  PackageSearch,
  PanelsTopLeft,
  RefreshCw,
  Search,
  ShieldAlert,
  TimerReset,
  WalletCards,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getProcurementCommandCenter,
} from "@/lib/api";

import type {
  CommandCenter,
  CommandCenterAction,
  CommandCenterActionType,
} from "@/types/command-center";

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

interface ActionTypeIconProps {
  type: CommandCenterActionType;
  size: number;
}

function ActionTypeIcon({
  type,
  size,
}: ActionTypeIconProps) {
  switch (type) {
    case "PENDING_REQUEST":
      return (
        <ClipboardCheck
          size={size}
        />
      );

    case "RFQ_DEADLINE":
      return (
        <TimerReset
          size={size}
        />
      );

    case "OVERDUE_PURCHASE_ORDER":
      return (
        <PackageSearch
          size={size}
        />
      );

    case "CONTRACT_EXPIRY":
    case "COMPLIANCE_EXPIRY":
      return (
        <FileWarning
          size={size}
        />
      );

    case "PROCUREMENT_RISK":
      return (
        <ShieldAlert
          size={size}
        />
      );

    case "BUDGET_EXCEPTION":
      return (
        <WalletCards
          size={size}
        />
      );

    case "PLANNING_DEMAND":
      return (
        <CalendarClock
          size={size}
        />
      );

    case "SAVINGS_VALIDATION":
    case "SAVINGS_REALIZATION":
      return (
        <BadgeDollarSign
          size={size}
        />
      );
  }
}

export default function CommandCenterPage() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CommandCenter |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    horizon,
    setHorizon,
  ] =
    useState(60);

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState("");

  const [
    typeFilter,
    setTypeFilter,
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
    refreshing,
    setRefreshing,
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

  useEffect(() => {
    let active = true;

    getProcurementCommandCenter(
      horizon,
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
              : "Unable to load procurement command center.",
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
    horizon,
    currency,
  ]);

  async function refreshDashboard() {
    try {
      setRefreshing(true);
      setError(null);

      const response =
        await getProcurementCommandCenter(
          horizon,
          currency,
        );

      setDashboard(
        response,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to refresh procurement command center.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const filteredActions =
    useMemo(
      () => {
        if (!dashboard) {
          return [];
        }

        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        return dashboard.actions
          .filter(
            action =>
              !severityFilter ||
              action.severity ===
                severityFilter,
          )
          .filter(
            action =>
              !typeFilter ||
              action.type ===
                typeFilter,
          )
          .filter(
            action => {
              if (
                !normalizedQuery
              ) {
                return true;
              }

              return [
                action.title,
                action.description,
                action.reference ??
                  "",
                action.ownerName ??
                  "",
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
        dashboard,
        severityFilter,
        typeFilter,
        query,
      ],
    );

  const summary =
    dashboard?.summary;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement operations
          </span>

          <h1>
            Command center
          </h1>

          <p>
            One prioritized operational
            cockpit for approvals,
            sourcing deadlines,
            deliveries, contracts,
            compliance, risk, budgets,
            planned demand and savings.
          </p>
        </div>

        <button
          type="button"
          className="button button--secondary"
          disabled={refreshing}
          onClick={
            () =>
              void refreshDashboard()
          }
        >
          <RefreshCw
            size={16}
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="command-center-controls">
        <label>
          <span>
            Action horizon
          </span>

          <select
            value={horizon}
            onChange={
              event => {
                setLoading(true);

                setHorizon(
                  Number(
                    event.target.value,
                  ),
                );
              }
            }
          >
            <option value={30}>
              30 days
            </option>

            <option value={60}>
              60 days
            </option>

            <option value={90}>
              90 days
            </option>

            <option value={180}>
              180 days
            </option>
          </select>
        </label>

        <label>
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

        <div className="command-center-generated">
          <PanelsTopLeft
            size={16}
          />

          <div>
            <span>
              Last generated
            </span>

            <strong>
              {dashboard
                ? new Date(
                    dashboard.generatedAt,
                  )
                    .toLocaleString()
                : "—"}
            </strong>
          </div>
        </div>
      </section>

      <section className="command-center-kpis">
        <Kpi
          icon={PanelsTopLeft}
          label="Open actions"
          value={
            summary
              ?.totalActions ??
            0
          }
          note={
            `${summary?.criticalActions ?? 0} critical · ${summary?.highActions ?? 0} high`
          }
        />

        <Kpi
          icon={AlertTriangle}
          label="Overdue"
          value={
            summary
              ?.overdueActions ??
            0
          }
          note={
            "Actions already past their operational due date"
          }
        />

        <Kpi
          icon={ShieldAlert}
          label="Critical risks"
          value={
            summary
              ?.criticalRisks ??
            0
          }
          note={
            `${summary?.budgetExceptions ?? 0} budget exceptions`
          }
        />

        <Kpi
          icon={
            BadgeDollarSign
          }
          label="Realized savings"
          value={
            summary
              ? money(
                  summary.realizedSavings,
                  summary.currency,
                )
              : "—"
          }
          note={
            `${summary?.savingsActions ?? 0} savings actions remain`
          }
        />
      </section>

      <section className="command-center-domain-grid">
        <DomainMetric
          icon={
            ClipboardCheck
          }
          label="Approvals"
          value={
            summary
              ?.pendingRequests ??
            0
          }
        />

        <DomainMetric
          icon={TimerReset}
          label="RFQ deadlines"
          value={
            summary
              ?.rfqDeadlines ??
            0
          }
        />

        <DomainMetric
          icon={
            PackageSearch
          }
          label="Overdue POs"
          value={
            summary
              ?.overduePurchaseOrders ??
            0
          }
        />

        <DomainMetric
          icon={FileWarning}
          label="Contract / compliance"
          value={
            summary
              ?.contractComplianceIssues ??
            0
          }
        />

        <DomainMetric
          icon={WalletCards}
          label="Budget exceptions"
          value={
            summary
              ?.budgetExceptions ??
            0
          }
        />

        <DomainMetric
          icon={
            CalendarClock
          }
          label="Upcoming demand"
          value={
            summary
              ?.upcomingDemand ??
            0
          }
        />
      </section>

      <section className="command-center-main-grid">
        <section className="panel command-center-breakdown-panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Operations map
              </span>

              <h2>
                Action distribution
              </h2>
            </div>

            <Gauge
              size={19}
            />
          </div>

          <div className="command-center-breakdown">
            {dashboard
              ?.breakdown
              .map(
                item => (
                  <article
                    key={
                      item.type
                    }
                  >
                    <div className="command-center-breakdown-icon">
                      <ActionTypeIcon
                        type={
                          item.type
                        }
                        size={17}
                      />
                    </div>

                    <div>
                      <strong>
                        {readable(
                          item.type,
                        )}
                      </strong>

                      <span>
                        {item.critical}
                        {" critical · "}
                        {item.high}
                        {" high · "}
                        {item.overdue}
                        {" overdue"}
                      </span>
                    </div>

                    <strong>
                      {item.total}
                    </strong>
                  </article>
                ),
              )}

            {!loading &&
            (
              dashboard
                ?.breakdown
                .length ??
              0
            ) === 0 ? (
              <div className="command-center-empty">
                No operational actions
                are currently open.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Priority pulse
              </span>

              <h2>
                Immediate attention
              </h2>
            </div>

            <AlertTriangle
              size={19}
            />
          </div>

          <div className="command-center-priority-list">
            {dashboard
              ?.actions
              .filter(
                action =>
                  action.severity ===
                    "CRITICAL" ||
                  action.severity ===
                    "HIGH",
              )
              .slice(
                0,
                6,
              )
              .map(
                action => (
                  <ActionMiniCard
                    key={
                      `${action.type}-${action.id}`
                    }
                    action={
                      action
                    }
                  />
                ),
              )}

            {!loading &&
            (
              dashboard
                ?.actions
                .filter(
                  action =>
                    action.severity ===
                      "CRITICAL" ||
                    action.severity ===
                      "HIGH",
                )
                .length ??
              0
            ) === 0 ? (
              <div className="command-center-empty">
                No critical or
                high-priority actions.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Prioritized execution
            </span>

            <h2>
              Operational action queue
            </h2>
          </div>

          <span className="command-center-action-count">
            {filteredActions.length}
            {" actions"}
          </span>
        </div>

        <div className="command-center-toolbar">
          <div className="command-center-search">
            <Search
              size={17}
            />

            <input
              value={query}
              placeholder={
                "Search action, reference or owner"
              }
              onChange={
                event =>
                  setQuery(
                    event.target.value,
                  )
              }
            />
          </div>

          <select
            value={
              severityFilter
            }
            onChange={
              event =>
                setSeverityFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All priorities
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

            <option value="INFO">
              Informational
            </option>
          </select>

          <select
            value={typeFilter}
            onChange={
              event =>
                setTypeFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All workstreams
            </option>

            {[
              "PENDING_REQUEST",
              "RFQ_DEADLINE",
              "OVERDUE_PURCHASE_ORDER",
              "CONTRACT_EXPIRY",
              "COMPLIANCE_EXPIRY",
              "PROCUREMENT_RISK",
              "BUDGET_EXCEPTION",
              "PLANNING_DEMAND",
              "SAVINGS_VALIDATION",
              "SAVINGS_REALIZATION",
            ].map(
              type => (
                <option
                  key={type}
                  value={type}
                >
                  {readable(
                    type,
                  )}
                </option>
              ),
            )}
          </select>
        </div>

        {loading ? (
          <div className="command-center-empty">
            Loading operational
            priorities...
          </div>
        ) : filteredActions.length ===
          0 ? (
          <div className="command-center-empty">
            No actions match the
            selected filters.
          </div>
        ) : (
          <div className="command-center-action-list">
            {filteredActions.map(
              action => (
                <ActionCard
                  key={
                    `${action.type}-${action.id}`
                  }
                  action={
                    action
                  }
                />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

interface KpiProps {
  icon:
    typeof PanelsTopLeft;

  label: string;

  value:
    string |
    number;

  note: string;
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
}: KpiProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-card__topline">
        <div className="kpi-card__icon">
          <Icon
            size={20}
          />
        </div>
      </div>

      <span className="kpi-card__label">
        {label}
      </span>

      <strong className="kpi-card__value command-center-kpi-value">
        {value}
      </strong>

      <p>
        {note}
      </p>
    </article>
  );
}

interface DomainMetricProps {
  icon:
    typeof PanelsTopLeft;

  label: string;

  value: number;
}

function DomainMetric({
  icon: Icon,
  label,
  value,
}: DomainMetricProps) {
  return (
    <article className="command-center-domain-card">
      <div>
        <Icon
          size={17}
        />
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </article>
  );
}

function ActionMiniCard({
  action,
}: {
  action:
    CommandCenterAction;
}) {
  return (
    <Link
      href={action.href}
      className={
        `command-center-mini-action command-center-mini-action--${action.severity.toLowerCase()}`
      }
    >
      <div>
        <ActionTypeIcon
          type={
            action.type
          }
          size={16}
        />
      </div>

      <section>
        <strong>
          {action.title}
        </strong>

        <span>
          {action.reference ??
            readable(
              action.type,
            )}
        </span>
      </section>

      <span
        className={
          `command-severity command-severity--${action.severity.toLowerCase()}`
        }
      >
        {action.severity}
      </span>
    </Link>
  );
}

function ActionCard({
  action,
}: {
  action:
    CommandCenterAction;
}) {
  return (
    <Link
      href={action.href}
      className={
        `command-center-action command-center-action--${action.severity.toLowerCase()}`
      }
    >
      <div className="command-center-action-icon">
        <ActionTypeIcon
          type={
            action.type
          }
          size={18}
        />
      </div>

      <div className="command-center-action-content">
        <div className="command-center-action-heading">
          <div>
            <span>
              {readable(
                action.type,
              )}
            </span>

            <strong>
              {action.title}
            </strong>
          </div>

          <span
            className={
              `command-severity command-severity--${action.severity.toLowerCase()}`
            }
          >
            {action.severity}
          </span>
        </div>

        <p>
          {action.description}
        </p>

        <div className="command-center-action-meta">
          {action.reference ? (
            <span>
              Ref:
              {" "}
              {action.reference}
            </span>
          ) : null}

          {action.dueDate ? (
            <span
              className={
                action.overdue
                  ? "command-meta-overdue"
                  : ""
              }
            >
              {action.overdue
                ? "Overdue"
                : "Due"}
              {": "}
              {new Date(
                `${action.dueDate}T00:00:00`,
              )
                .toLocaleDateString()}
            </span>
          ) : null}

          {action.amount !==
          null ? (
            <span>
              {action.currency
                ? money(
                    action.amount,
                    action.currency,
                  )
                : action.amount}
            </span>
          ) : null}

          {action.ownerName ? (
            <span>
              Owner:
              {" "}
              {action.ownerName}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
