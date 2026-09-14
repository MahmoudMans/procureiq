"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BadgeDollarSign,
  CircleAlert,
  Gauge,
  Plus,
  TrendingDown,
} from "lucide-react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  authorizeExecutionPortfolio,
  getBenefitsGovernanceContext,
  getBenefitsGovernanceDashboard,
} from "@/lib/api";

import type {
  BenefitsGovernanceContext,
  BenefitsGovernanceDashboard,
} from "@/types/benefits-governance";

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

export default function BenefitsGovernancePage() {
  const router =
    useRouter();

  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      BenefitsGovernanceDashboard |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      BenefitsGovernanceContext |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  const canAuthorize =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getBenefitsGovernanceDashboard(
        currency,
      ),
      getBenefitsGovernanceContext(),
    ])
      .then(
        ([
          dashboardResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDashboard(
            dashboardResponse,
          );

          setContext(
            contextResponse,
          );

          const owner =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (
            owner
            &&
            !ownerUserId
          ) {
            setOwnerUserId(
              owner.id,
            );
          }

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
              : "Unable to load benefits governance.",
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
    ownerUserId,
  ]);

  async function reload() {
    const [
      dashboardResponse,
      contextResponse,
    ] =
      await Promise.all([
        getBenefitsGovernanceDashboard(
          currency,
        ),
        getBenefitsGovernanceContext(),
      ]);

    setDashboard(
      dashboardResponse,
    );

    setContext(
      contextResponse,
    );
  }

  async function authorize(
    scenarioId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      const result =
        await authorizeExecutionPortfolio(
          scenarioId,
          {
            ownerUserId:
              ownerUserId
              ||
              undefined,
            notes:
              notes.trim()
              ||
              undefined,
          },
        );

      setNotes("");

      await reload();

      router.push(
        `/benefits-governance/${result.portfolio.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to authorize execution portfolio.",
      );
    } finally {
      setRunning(false);
    }
  }

  const portfolios =
    useMemo(
      () =>
        dashboard
          ?.portfolios
          .filter(
            portfolio =>
              !statusFilter
              ||
              portfolio.status ===
                statusFilter,
          )
        ??
        [],
      [
        dashboard,
        statusFilter,
      ],
    );

  const approvedScenarios =
    context
      ?.approvedScenarios
      .filter(
        scenario =>
          scenario.currency ===
            currency,
      )
    ??
    [];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Value realization
          </span>

          <h1>
            Benefits governance
          </h1>

          <p>
            Preserve the approved
            procurement decision baseline,
            govern execution ownership and
            separate target, forecast,
            operationally reported and
            formally validated value.
          </p>
        </div>

        <label className="benefit-currency">
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
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="benefit-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Baseline target
          </span>

          <strong className="kpi-card__value benefit-money-kpi">
            {money(
              dashboard
                ?.summary
                .baselineTargetSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            Frozen approved target.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Current forecast
          </span>

          <strong className="kpi-card__value benefit-money-kpi">
            {money(
              dashboard
                ?.summary
                .forecastSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            {(
              dashboard
                ?.summary
                .forecastCoveragePct ??
                0
            ).toFixed(0)}
            % coverage
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Validated value
          </span>

          <strong className="kpi-card__value benefit-money-kpi">
            {money(
              dashboard
                ?.summary
                .validatedSavings ??
                0,
              currency,
            )}
          </strong>

          <p>
            {(
              dashboard
                ?.summary
                .validationCoveragePct ??
                0
            ).toFixed(0)}
            % formally validated
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Value at risk
          </span>

          <strong className="kpi-card__value benefit-money-kpi">
            {money(
              dashboard
                ?.summary
                .atRiskAmount ??
                0,
              currency,
            )}
          </strong>

          <p>
            Forecast shortfall plus active
            leakage.
          </p>
        </article>
      </section>

      <section className="benefit-signal-grid">
        <article>
          <Gauge
            size={17}
          />

          <div>
            <span>
              Operationally reported
            </span>

            <strong>
              {money(
                dashboard
                  ?.summary
                  .operationalReportedSavings ??
                  0,
                currency,
              )}
            </strong>
          </div>
        </article>

        <article>
          <BadgeCheck
            size={17}
          />

          <div>
            <span>
              Validation pending
            </span>

            <strong>
              {dashboard
                ?.summary
                .validationPendingItems ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <TrendingDown
            size={17}
          />

          <div>
            <span>
              Active leakage
            </span>

            <strong>
              {money(
                dashboard
                  ?.summary
                  .activeLeakageAmount ??
                  0,
                currency,
              )}
            </strong>
          </div>
        </article>

        <article>
          <BadgeDollarSign
            size={17}
          />

          <div>
            <span>
              Active portfolios
            </span>

            <strong>
              {dashboard
                ?.summary
                .activePortfolios ??
                0}
            </strong>
          </div>
        </article>
      </section>

      {canAuthorize &&
      approvedScenarios.length >
        0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Decision authorization
              </span>

              <h2>
                Approved scenarios awaiting execution
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="benefit-authorization-controls">
            <label className="request-field">
              <span>
                Execution portfolio owner
              </span>

              <select
                value={ownerUserId}
                onChange={
                  event =>
                    setOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.users
                  .filter(
                    candidate =>
                      candidate.role !==
                      "REQUESTER",
                  )
                  .map(
                    candidate => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Authorization notes
              </span>

              <input
                value={notes}
                placeholder={
                  "Optional decision context"
                }
                onChange={
                  event =>
                    setNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="benefit-approved-scenario-grid">
            {approvedScenarios.map(
              scenario => (
                <article
                  key={scenario.id}
                >
                  <div>
                    <span>
                      Approved scenario
                    </span>

                    <strong>
                      {scenario.name}
                    </strong>

                    <small>
                      {scenario.scenarioCode}
                      {" · "}
                      {scenario.ownerName}
                    </small>
                  </div>

                  <div className="benefit-approved-scenario-metrics">
                    <span>
                      <strong>
                        {scenario.selectedInitiatives}
                      </strong>
                      {" initiatives"}
                    </span>

                    <span>
                      <strong>
                        {money(
                          scenario.selectedBudget,
                          scenario.currency,
                        )}
                      </strong>
                      {" managed value"}
                    </span>

                    <span>
                      <strong>
                        {money(
                          scenario.targetSavings,
                          scenario.currency,
                        )}
                      </strong>
                      {" target"}
                    </span>

                    <span>
                      <strong>
                        {scenario.averageRisk.toFixed(
                          1,
                        )}
                      </strong>
                      {" avg risk"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="button button--primary"
                    disabled={running}
                    onClick={
                      () =>
                        void authorize(
                          scenario.id,
                        )
                    }
                  >
                    Authorize execution
                  </button>
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Execution portfolio
            </span>

            <h2>
              Benefits realization portfolios
            </h2>
          </div>

          <select
            className="benefit-status-filter"
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

            <option value="AUTHORIZED">
              Authorized
            </option>

            <option value="IN_EXECUTION">
              In execution
            </option>

            <option value="CLOSED">
              Closed
            </option>

            <option value="ARCHIVED">
              Archived
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Portfolio</th>
                <th>Status</th>
                <th>Target</th>
                <th>Forecast</th>
                <th>Operational</th>
                <th>Validated</th>
                <th>At risk</th>
                <th>Governance</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                portfolios.map(
                  portfolio => (
                    <tr
                      key={portfolio.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {portfolio.sourceScenarioName}
                          </strong>

                          <span>
                            {portfolio.portfolioNumber}
                            {" · "}
                            {portfolio.ownerName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `benefit-portfolio-status benefit-portfolio-status--${portfolio.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            portfolio.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          portfolio.baselineTargetSavings,
                          portfolio.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          portfolio.currentForecastSavings,
                          portfolio.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          portfolio.operationalReportedSavings,
                          portfolio.currency,
                        )}
                      </td>

                      <td>
                        <strong>
                          {money(
                            portfolio.validatedSavings,
                            portfolio.currency,
                          )}
                        </strong>

                        <span className="benefit-table-sub">
                          {portfolio.validationCoveragePct.toFixed(
                            0,
                          )}
                          %
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            portfolio.atRiskAmount >
                            0
                              ? "benefit-risk-value"
                              : ""
                          }
                        >
                          {money(
                            portfolio.atRiskAmount,
                            portfolio.currency,
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="benefit-governance-tags">
                          {portfolio.validationPendingItems >
                          0 ? (
                            <span>
                              {portfolio.validationPendingItems}
                              {" pending"}
                            </span>
                          ) : null}

                          {portfolio.activeLeakageCases >
                          0 ? (
                            <span>
                              {portfolio.activeLeakageCases}
                              {" leakage"}
                            </span>
                          ) : null}

                          {portfolio.invalidatedAssumptions >
                          0 ? (
                            <span>
                              {portfolio.invalidatedAssumptions}
                              {" invalid assumptions"}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <Link
                          href={
                            `/benefits-governance/${portfolio.id}`
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
              portfolios.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No execution portfolios
                    are available for this
                    currency.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="benefit-integrity-note">
        <AlertTriangle
          size={18}
        />

        <div>
          <strong>
            Validated value is intentionally separate
          </strong>

          <p>
            Category initiatives may
            report operational savings,
            but those values are not
            automatically treated as
            formally validated benefits.
            Validation requires a
            dedicated governance decision
            in this module.
          </p>
        </div>
      </section>
    </div>
  );
}
