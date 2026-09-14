"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Gauge,
  Play,
  Plus,
  ShieldCheck,
  TrendingDown,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  archiveExecutionPortfolio,
  cancelBenefitItem,
  closeExecutionPortfolio,
  confirmBenefitAssumption,
  createBenefitAssumption,
  createBenefitLeakage,
  getBenefitsGovernanceContext,
  getExecutionPortfolio,
  invalidateBenefitAssumption,
  requestBenefitValidation,
  resolveBenefitLeakage,
  startBenefitItem,
  startExecutionPortfolio,
  updateBenefitForecast,
  updateBenefitOwner,
  validateBenefitItem,
} from "@/lib/api";

import type {
  BenefitAssumptionType,
  BenefitLeakageStatus,
  BenefitLeakageType,
  BenefitsGovernanceContext,
  ExecutionPortfolioDetail,
} from "@/types/benefits-governance";

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

function defaultDate(
  days: number,
): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function BenefitsGovernanceDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      ExecutionPortfolioDetail |
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
    forecasts,
    setForecasts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    forecastDates,
    setForecastDates,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    validationAmounts,
    setValidationAmounts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    validationNotes,
    setValidationNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    assumptionType,
    setAssumptionType,
  ] =
    useState<BenefitAssumptionType>(
      "DEMAND",
    );

  const [
    assumptionDescription,
    setAssumptionDescription,
  ] =
    useState("");

  const [
    assumptionImpact,
    setAssumptionImpact,
  ] =
    useState(0);

  const [
    assumptionOwner,
    setAssumptionOwner,
  ] =
    useState("");

  const [
    assumptionReviewDate,
    setAssumptionReviewDate,
  ] =
    useState(
      defaultDate(
        30,
      ),
    );

  const [
    assumptionResolutionNotes,
    setAssumptionResolutionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    leakageItemId,
    setLeakageItemId,
  ] =
    useState("");

  const [
    leakageType,
    setLeakageType,
  ] =
    useState<BenefitLeakageType>(
      "DEMAND_EROSION",
    );

  const [
    leakageAmount,
    setLeakageAmount,
  ] =
    useState(0);

  const [
    leakageDescription,
    setLeakageDescription,
  ] =
    useState("");

  const [
    leakageOwner,
    setLeakageOwner,
  ] =
    useState("");

  const [
    leakageDueDate,
    setLeakageDueDate,
  ] =
    useState(
      defaultDate(
        14,
      ),
    );

  const [
    leakageResolutionNotes,
    setLeakageResolutionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    leakageResolutionStatuses,
    setLeakageResolutionStatuses,
  ] =
    useState<
      Record<
        string,
        BenefitLeakageStatus
      >
    >({});

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

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  const canValidate =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getExecutionPortfolio(
        params.id,
      ),
      getBenefitsGovernanceContext(),
    ])
      .then(
        ([
          detailResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            detailResponse,
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

          if (owner) {
            setAssumptionOwner(
              owner.id,
            );

            setLeakageOwner(
              owner.id,
            );
          }

          if (
            detailResponse.benefitItems[0]
          ) {
            setLeakageItemId(
              detailResponse.benefitItems[0].id,
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
              : "Unable to load benefits-governance portfolio.",
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
    params.id,
  ]);

  async function reload() {
    setDetail(
      await getExecutionPortfolio(
        params.id,
      ),
    );
  }

  async function changePortfolio(
    action:
      "START"
      |
      "CLOSE"
      |
      "ARCHIVE",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "START"
      ) {
        await startExecutionPortfolio(
          params.id,
        );
      } else if (
        action ===
        "CLOSE"
      ) {
        await closeExecutionPortfolio(
          params.id,
        );
      } else {
        await archiveExecutionPortfolio(
          params.id,
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
          : "Unable to update execution portfolio.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function reassignOwner(
    itemId: string,
    ownerUserId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await updateBenefitOwner(
        itemId,
        ownerUserId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to reassign benefit owner.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function startItem(
    itemId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await startBenefitItem(
        itemId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start benefit item.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function saveForecast(
    itemId: string,
    currentForecast: number,
  ) {
    try {
      setRunning(true);
      setError(null);

      await updateBenefitForecast(
        itemId,
        {
          forecastSavings:
            Number(
              forecasts[
                itemId
              ]
              ??
              currentForecast,
            ),
          expectedRealizationDate:
            forecastDates[
              itemId
            ]
            ||
            undefined,
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
          : "Unable to update benefit forecast.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitValidation(
    itemId: string,
    fallbackAmount: number,
  ) {
    const note =
      validationNotes[
        itemId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A validation-request note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await requestBenefitValidation(
        itemId,
        {
          proposedValidatedSavings:
            Number(
              validationAmounts[
                itemId
              ]
              ??
              fallbackAmount,
            ),
          note,
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
          : "Unable to submit benefit validation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function validateItem(
    itemId: string,
    fallbackAmount: number,
  ) {
    const note =
      validationNotes[
        itemId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A formal validation note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await validateBenefitItem(
        itemId,
        {
          validatedSavings:
            Number(
              validationAmounts[
                itemId
              ]
              ??
              fallbackAmount,
            ),
          note,
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
          : "Unable to validate benefit.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelItem(
    itemId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await cancelBenefitItem(
        itemId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel benefit item.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addAssumption(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createBenefitAssumption(
        params.id,
        {
          assumptionType,
          description:
            assumptionDescription.trim(),
          financialImpact:
            assumptionImpact,
          ownerUserId:
            assumptionOwner
            ||
            undefined,
          reviewDate:
            assumptionReviewDate
            ||
            undefined,
        },
      );

      setAssumptionDescription("");
      setAssumptionImpact(0);

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create benefit assumption.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function resolveAssumption(
    assumptionId: string,
    action:
      "CONFIRM"
      |
      "INVALIDATE",
  ) {
    const note =
      assumptionResolutionNotes[
        assumptionId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An assumption resolution note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "CONFIRM"
      ) {
        await confirmBenefitAssumption(
          assumptionId,
          note,
        );
      } else {
        await invalidateBenefitAssumption(
          assumptionId,
          note,
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
          : "Unable to resolve benefit assumption.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addLeakage(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!leakageItemId) {
      setError(
        "Select a benefit item for the leakage finding.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createBenefitLeakage(
        leakageItemId,
        {
          leakageType,
          amount:
            leakageAmount,
          description:
            leakageDescription.trim(),
          ownerUserId:
            leakageOwner
            ||
            undefined,
          dueDate:
            leakageDueDate
            ||
            undefined,
        },
      );

      setLeakageDescription("");
      setLeakageAmount(0);

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record benefit leakage.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function resolveLeakage(
    leakageId: string,
  ) {
    const note =
      leakageResolutionNotes[
        leakageId
      ]
      ??
      "";

    const status =
      leakageResolutionStatuses[
        leakageId
      ]
      ??
      "MITIGATED";

    if (!note.trim()) {
      setError(
        "A leakage resolution note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await resolveBenefitLeakage(
        leakageId,
        status,
        note,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to resolve benefit leakage.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading benefits governance...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/benefits-governance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Benefits governance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Execution portfolio not found."}
        </div>
      </div>
    );
  }

  const {
    portfolio,
  } = detail;

  const mutable =
    portfolio.status !==
      "CLOSED"
    &&
    portfolio.status !==
      "ARCHIVED";

  return (
    <div className="page-stack">
      <Link
        href="/benefits-governance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Benefits governance
      </Link>

      <section className="benefit-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {portfolio.portfolioNumber}
            </span>

            <span
              className={
                `benefit-portfolio-status benefit-portfolio-status--${portfolio.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                portfolio.status,
              )}
            </span>
          </div>

          <h1>
            {portfolio.sourceScenarioName}
          </h1>

          <p>
            Decision baseline:
            {" "}
            {portfolio.sourceScenarioCode}
            {" · "}
            {portfolio.currency}
            {" · Owner: "}
            {portfolio.ownerName}
          </p>
        </div>

        <div className="benefit-detail-actions">
          {canManage &&
          portfolio.status ===
            "AUTHORIZED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void changePortfolio(
                    "START",
                  )
              }
            >
              <Play
                size={16}
              />
              Start execution
            </button>
          ) : null}

          {canValidate &&
          (
            portfolio.status ===
              "AUTHORIZED"
            ||
            portfolio.status ===
              "IN_EXECUTION"
          ) ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                portfolio.activeBenefitItems >
                  0
              }
              onClick={
                () =>
                  void changePortfolio(
                    "CLOSE",
                  )
              }
            >
              Close portfolio
            </button>
          ) : null}

          {canValidate &&
          portfolio.status ===
            "CLOSED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void changePortfolio(
                    "ARCHIVE",
                  )
              }
            >
              Archive
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

      <section className="benefit-detail-kpis">
        <article>
          <span>
            Decision target
          </span>

          <strong>
            {money(
              portfolio.baselineTargetSavings,
              portfolio.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Forecast
          </span>

          <strong>
            {money(
              portfolio.currentForecastSavings,
              portfolio.currency,
            )}
          </strong>

          <small>
            {portfolio.forecastCoveragePct.toFixed(
              0,
            )}
            %
          </small>
        </article>

        <article>
          <span>
            Operationally reported
          </span>

          <strong>
            {money(
              portfolio.operationalReportedSavings,
              portfolio.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Formally validated
          </span>

          <strong>
            {money(
              portfolio.validatedSavings,
              portfolio.currency,
            )}
          </strong>

          <small>
            {portfolio.validationCoveragePct.toFixed(
              0,
            )}
            %
          </small>
        </article>

        <article>
          <span>
            Leakage
          </span>

          <strong
            className={
              portfolio.activeLeakageAmount >
              0
                ? "benefit-risk-value"
                : ""
            }
          >
            {money(
              portfolio.activeLeakageAmount,
              portfolio.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Value at risk
          </span>

          <strong
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
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Value-realization bridge
            </span>

            <h2>
              Decision → forecast → validation
            </h2>
          </div>

          <Gauge
            size={19}
          />
        </div>

        <div className="benefit-bridge">
          <article>
            <span>
              1. Approved target
            </span>

            <strong>
              {money(
                portfolio.baselineTargetSavings,
                portfolio.currency,
              )}
            </strong>

            <div>
              Frozen decision baseline
            </div>
          </article>

          <article>
            <span>
              2. Current forecast
            </span>

            <strong>
              {money(
                portfolio.currentForecastSavings,
                portfolio.currency,
              )}
            </strong>

            <div>
              Execution expectation
            </div>
          </article>

          <article>
            <span>
              3. Operational report
            </span>

            <strong>
              {money(
                portfolio.operationalReportedSavings,
                portfolio.currency,
              )}
            </strong>

            <div>
              Category initiative reporting
            </div>
          </article>

          <article>
            <span>
              4. Validated value
            </span>

            <strong>
              {money(
                portfolio.validatedSavings,
                portfolio.currency,
              )}
            </strong>

            <div>
              Governance-approved benefit
            </div>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Benefit ownership
            </span>

            <h2>
              Selected initiative benefits
            </h2>
          </div>

          <BadgeCheck
            size={19}
          />
        </div>

        <div className="benefit-item-list">
          {detail.benefitItems.map(
            item => (
              <article
                key={item.id}
                className={
                  item.atRiskAmount >
                  0
                    ? "benefit-item benefit-item--risk"
                    : "benefit-item"
                }
              >
                <div className="benefit-item-heading">
                  <div>
                    <span
                      className={
                        `benefit-item-status benefit-item-status--${item.status.toLowerCase().replaceAll("_", "-")}`
                      }
                    >
                      {readable(
                        item.status,
                      )}
                    </span>

                    <strong>
                      {item.initiativeTitle}
                    </strong>

                    <small>
                      {item.initiativeNumber}
                      {" · "}
                      {item.categoryName}
                    </small>
                  </div>

                  <div>
                    <span>
                      Benefit owner
                    </span>

                    {canManage &&
                    mutable ? (
                      <select
                        value={item.benefitOwnerUserId}
                        disabled={running}
                        onChange={
                          event =>
                            void reassignOwner(
                              item.id,
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
                              </option>
                            ),
                          )}
                      </select>
                    ) : (
                      <strong>
                        {item.benefitOwnerName}
                      </strong>
                    )}
                  </div>
                </div>

                <div className="benefit-item-values">
                  <div>
                    <span>
                      Target
                    </span>

                    <strong>
                      {money(
                        item.baselineTargetSavings,
                        portfolio.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Forecast
                    </span>

                    <strong>
                      {money(
                        item.forecastSavings,
                        portfolio.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Operational
                    </span>

                    <strong>
                      {money(
                        item.operationalReportedSavings,
                        portfolio.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Validated
                    </span>

                    <strong>
                      {money(
                        item.validatedSavings,
                        portfolio.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Leakage
                    </span>

                    <strong>
                      {money(
                        item.activeLeakageAmount,
                        portfolio.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      At risk
                    </span>

                    <strong
                      className={
                        item.atRiskAmount >
                        0
                          ? "benefit-risk-value"
                          : ""
                      }
                    >
                      {money(
                        item.atRiskAmount,
                        portfolio.currency,
                      )}
                    </strong>
                  </div>
                </div>

                {canManage &&
                mutable &&
                (
                  item.status ===
                    "PLANNED"
                  ||
                  item.status ===
                    "IN_PROGRESS"
                ) ? (
                  <div className="benefit-forecast-controls">
                    {item.status ===
                    "PLANNED" ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void startItem(
                              item.id,
                            )
                        }
                      >
                        <Play
                          size={13}
                        />
                        Start
                      </button>
                    ) : null}

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        forecasts[
                          item.id
                        ]
                        ??
                        item.forecastSavings
                      }
                      onChange={
                        event =>
                          setForecasts(
                            current => ({
                              ...current,
                              [item.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <input
                      type="date"
                      value={
                        forecastDates[
                          item.id
                        ]
                        ??
                        item.expectedRealizationDate
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setForecastDates(
                            current => ({
                              ...current,
                              [item.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <button
                      type="button"
                      disabled={running}
                      onClick={
                        () =>
                          void saveForecast(
                            item.id,
                            item.forecastSavings,
                          )
                      }
                    >
                      Save forecast
                    </button>
                  </div>
                ) : null}

                {canManage &&
                mutable &&
                item.status ===
                  "IN_PROGRESS" ? (
                  <div className="benefit-validation-controls">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        validationAmounts[
                          item.id
                        ]
                        ??
                        item.forecastSavings
                      }
                      onChange={
                        event =>
                          setValidationAmounts(
                            current => ({
                              ...current,
                              [item.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <input
                      value={
                        validationNotes[
                          item.id
                        ]
                        ??
                        ""
                      }
                      placeholder={
                        "Validation request evidence / rationale"
                      }
                      onChange={
                        event =>
                          setValidationNotes(
                            current => ({
                              ...current,
                              [item.id]:
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
                          validationNotes[
                            item.id
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void submitValidation(
                            item.id,
                            item.forecastSavings,
                          )
                      }
                    >
                      Submit validation
                    </button>
                  </div>
                ) : null}

                {canValidate &&
                mutable &&
                item.status ===
                  "VALIDATION_PENDING" ? (
                  <div className="benefit-validation-panel">
                    <div>
                      <span>
                        Requested validation
                      </span>

                      <strong>
                        {money(
                          item.validationRequestedAmount ??
                            0,
                          portfolio.currency,
                        )}
                      </strong>

                      <p>
                        {item.validationRequestNote}
                      </p>
                    </div>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        validationAmounts[
                          item.id
                        ]
                        ??
                        item.validationRequestedAmount
                        ??
                        0
                      }
                      onChange={
                        event =>
                          setValidationAmounts(
                            current => ({
                              ...current,
                              [item.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <input
                      value={
                        validationNotes[
                          item.id
                        ]
                        ??
                        ""
                      }
                      placeholder={
                        "Formal validation note"
                      }
                      onChange={
                        event =>
                          setValidationNotes(
                            current => ({
                              ...current,
                              [item.id]:
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
                          validationNotes[
                            item.id
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void validateItem(
                            item.id,
                            item.validationRequestedAmount ??
                              0,
                          )
                      }
                    >
                      <BadgeCheck
                        size={13}
                      />
                      Validate
                    </button>
                  </div>
                ) : null}

                {item.validationNote ? (
                  <div className="benefit-validation-note">
                    <ShieldCheck
                      size={14}
                    />

                    <span>
                      {item.validationNote}
                      {item.validatedByName
                        ? ` — ${item.validatedByName}`
                        : ""}
                    </span>
                  </div>
                ) : null}

                {canValidate &&
                mutable &&
                item.status !==
                  "VALIDATED" &&
                item.status !==
                  "CANCELLED" ? (
                  <button
                    type="button"
                    className="benefit-cancel-item"
                    disabled={running}
                    onClick={
                      () =>
                        void cancelItem(
                          item.id,
                        )
                    }
                  >
                    <XCircle
                      size={13}
                    />
                    Cancel benefit item
                  </button>
                ) : null}
              </article>
            ),
          )}
        </div>
      </section>

      <section className="benefit-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Decision assumptions
              </span>

              <h2>
                Benefit assumptions
              </h2>
            </div>

            <Gauge
              size={19}
            />
          </div>

          <div className="benefit-assumption-list">
            {detail.assumptions.map(
              assumption => (
                <article
                  key={assumption.id}
                  className={
                    assumption.reviewOverdue
                      ? "benefit-assumption benefit-assumption--overdue"
                      : "benefit-assumption"
                  }
                >
                  <div>
                    <span
                      className={
                        `benefit-assumption-status benefit-assumption-status--${assumption.status.toLowerCase()}`
                      }
                    >
                      {assumption.status}
                    </span>

                    <strong>
                      {readable(
                        assumption.assumptionType,
                      )}
                    </strong>

                    <small>
                      Owner:
                      {" "}
                      {assumption.ownerName}
                    </small>
                  </div>

                  <p>
                    {assumption.description}
                  </p>

                  <div className="benefit-assumption-meta">
                    <span>
                      Financial impact:
                      {" "}
                      <strong>
                        {money(
                          assumption.financialImpact,
                          portfolio.currency,
                        )}
                      </strong>
                    </span>

                    <span
                      className={
                        assumption.reviewOverdue
                          ? "benefit-risk-value"
                          : ""
                      }
                    >
                      Review:
                      {" "}
                      <strong>
                        {assumption.reviewDate ??
                          "—"}
                      </strong>
                    </span>
                  </div>

                  {assumption.resolutionNote ? (
                    <div className="benefit-resolution-note">
                      {assumption.resolutionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  mutable &&
                  assumption.status ===
                    "ACTIVE" ? (
                    <div className="benefit-assumption-controls">
                      <input
                        value={
                          assumptionResolutionNotes[
                            assumption.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Resolution note"
                        }
                        onChange={
                          event =>
                            setAssumptionResolutionNotes(
                              current => ({
                                ...current,
                                [assumption.id]:
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
                            assumptionResolutionNotes[
                              assumption.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void resolveAssumption(
                              assumption.id,
                              "CONFIRM",
                            )
                        }
                      >
                        Confirm
                      </button>

                      <button
                        type="button"
                        className="benefit-danger-button"
                        disabled={
                          running
                          ||
                          !(
                            assumptionResolutionNotes[
                              assumption.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void resolveAssumption(
                              assumption.id,
                              "INVALIDATE",
                            )
                        }
                      >
                        Invalidate
                      </button>
                    </div>
                  ) : null}
                </article>
              ),
            )}

            {detail.assumptions.length ===
            0 ? (
              <div className="benefit-empty">
                No benefit assumptions.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Value protection
              </span>

              <h2>
                Benefit leakage
              </h2>
            </div>

            <TrendingDown
              size={19}
            />
          </div>

          <div className="benefit-leakage-list">
            {detail.leakage.map(
              leakage => (
                <article
                  key={leakage.id}
                  className={
                    leakage.overdue
                      ? "benefit-leakage benefit-leakage--overdue"
                      : "benefit-leakage"
                  }
                >
                  <div>
                    <span
                      className={
                        `benefit-leakage-status benefit-leakage-status--${leakage.status.toLowerCase()}`
                      }
                    >
                      {leakage.status}
                    </span>

                    <strong>
                      {readable(
                        leakage.leakageType,
                      )}
                    </strong>

                    <small>
                      {leakage.initiativeNumber}
                      {" · "}
                      {leakage.initiativeTitle}
                    </small>
                  </div>

                  <p>
                    {leakage.description}
                  </p>

                  <div className="benefit-leakage-meta">
                    <span>
                      Amount:
                      {" "}
                      <strong>
                        {money(
                          leakage.amount,
                          portfolio.currency,
                        )}
                      </strong>
                    </span>

                    <span>
                      Owner:
                      {" "}
                      <strong>
                        {leakage.ownerName}
                      </strong>
                    </span>

                    <span
                      className={
                        leakage.overdue
                          ? "benefit-risk-value"
                          : ""
                      }
                    >
                      Due:
                      {" "}
                      <strong>
                        {leakage.dueDate ??
                          "—"}
                      </strong>
                    </span>
                  </div>

                  {leakage.resolutionNote ? (
                    <div className="benefit-resolution-note">
                      {leakage.resolutionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  mutable &&
                  (
                    leakage.status ===
                      "OPEN"
                    ||
                    leakage.status ===
                      "ACCEPTED"
                  ) ? (
                    <div className="benefit-leakage-controls">
                      <select
                        value={
                          leakageResolutionStatuses[
                            leakage.id
                          ]
                          ??
                          "MITIGATED"
                        }
                        onChange={
                          event =>
                            setLeakageResolutionStatuses(
                              current => ({
                                ...current,
                                [leakage.id]:
                                  event.target.value as
                                    BenefitLeakageStatus,
                              }),
                            )
                        }
                      >
                        <option value="MITIGATED">
                          Mitigated
                        </option>

                        <option value="ACCEPTED">
                          Accepted
                        </option>

                        <option value="RESOLVED">
                          Resolved
                        </option>
                      </select>

                      <input
                        value={
                          leakageResolutionNotes[
                            leakage.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Resolution note"
                        }
                        onChange={
                          event =>
                            setLeakageResolutionNotes(
                              current => ({
                                ...current,
                                [leakage.id]:
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
                            leakageResolutionNotes[
                              leakage.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void resolveLeakage(
                              leakage.id,
                            )
                        }
                      >
                        Resolve
                      </button>
                    </div>
                  ) : null}
                </article>
              ),
            )}

            {detail.leakage.length ===
            0 ? (
              <div className="benefit-empty">
                No benefit leakage has
                been recorded.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      {canManage &&
      mutable ? (
        <section className="benefit-detail-grid">
          <form
            className="panel"
            onSubmit={addAssumption}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Assumption register
                </span>

                <h2>
                  Add assumption
                </h2>
              </div>

              <Plus
                size={19}
              />
            </div>

            <div className="benefit-form-grid">
              <label className="request-field">
                <span>
                  Type
                </span>

                <select
                  value={assumptionType}
                  onChange={
                    event =>
                      setAssumptionType(
                        event.target.value as
                          BenefitAssumptionType,
                      )
                  }
                >
                  <option value="DEMAND">
                    Demand
                  </option>

                  <option value="PRICE">
                    Price
                  </option>

                  <option value="VOLUME">
                    Volume
                  </option>

                  <option value="TIMING">
                    Timing
                  </option>

                  <option value="FX">
                    FX
                  </option>

                  <option value="SCOPE">
                    Scope
                  </option>

                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </label>

              <label className="request-field">
                <span>
                  Financial impact
                </span>

                <input
                  type="number"
                  step="0.01"
                  value={assumptionImpact}
                  onChange={
                    event =>
                      setAssumptionImpact(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Owner
                </span>

                <select
                  value={assumptionOwner}
                  onChange={
                    event =>
                      setAssumptionOwner(
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
                        </option>
                      ),
                    )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Review date
                </span>

                <input
                  type="date"
                  value={assumptionReviewDate}
                  onChange={
                    event =>
                      setAssumptionReviewDate(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field benefit-form-wide">
                <span>
                  Assumption
                </span>

                <textarea
                  required
                  rows={4}
                  value={assumptionDescription}
                  onChange={
                    event =>
                      setAssumptionDescription(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="benefit-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !assumptionDescription.trim()
                }
              >
                Add assumption
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={addLeakage}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Value protection
                </span>

                <h2>
                  Record benefit leakage
                </h2>
              </div>

              <AlertTriangle
                size={19}
              />
            </div>

            <div className="benefit-form-grid">
              <label className="request-field benefit-form-wide">
                <span>
                  Benefit item
                </span>

                <select
                  value={leakageItemId}
                  onChange={
                    event =>
                      setLeakageItemId(
                        event.target.value,
                      )
                  }
                >
                  {detail.benefitItems
                    .filter(
                      item =>
                        item.status !==
                        "CANCELLED",
                    )
                    .map(
                      item => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.initiativeNumber}
                          {" — "}
                          {item.initiativeTitle}
                        </option>
                      ),
                    )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Leakage type
                </span>

                <select
                  value={leakageType}
                  onChange={
                    event =>
                      setLeakageType(
                        event.target.value as
                          BenefitLeakageType,
                      )
                  }
                >
                  <option value="DEMAND_EROSION">
                    Demand erosion
                  </option>

                  <option value="PRICE_VARIANCE">
                    Price variance
                  </option>

                  <option value="SCOPE_CHANGE">
                    Scope change
                  </option>

                  <option value="TIMING_SLIPPAGE">
                    Timing slippage
                  </option>

                  <option value="FX_IMPACT">
                    FX impact
                  </option>

                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </label>

              <label className="request-field">
                <span>
                  Amount
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={leakageAmount}
                  onChange={
                    event =>
                      setLeakageAmount(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Owner
                </span>

                <select
                  value={leakageOwner}
                  onChange={
                    event =>
                      setLeakageOwner(
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
                        </option>
                      ),
                    )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Due date
                </span>

                <input
                  type="date"
                  value={leakageDueDate}
                  onChange={
                    event =>
                      setLeakageDueDate(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field benefit-form-wide">
                <span>
                  Description
                </span>

                <textarea
                  required
                  rows={4}
                  value={leakageDescription}
                  onChange={
                    event =>
                      setLeakageDescription(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="benefit-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !leakageItemId
                  ||
                  !leakageDescription.trim()
                }
              >
                Record leakage
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="benefit-integrity-note">
        <ShieldCheck
          size={18}
        />

        <div>
          <strong>
            Approved decision baseline remains immutable
          </strong>

          <p>
            This module references the
            approved Step 39 scenario and
            selected category initiatives.
            It does not rewrite the source
            scenario, its selection
            decisions, category-strategy
            baselines or initiative target
            savings.
          </p>
        </div>
      </section>
    </div>
  );
}
