"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  CircleAlert,
  Scale,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createFlywheelVariancePlan,
  getFlywheelVarianceDashboard,
} from "@/lib/api";

import type {
  FlywheelVarianceDashboard,
} from "@/types/flywheel-variance";

import {
  type FormEvent,
  useEffect,
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
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${currency}`;
}

export default function FlywheelVariancePage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FlywheelVarianceDashboard |
      null
    >(null);

  const [
    settlementCaseId,
    setSettlementCaseId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState(
      "Settlement variance resolution",
    );

  const [
    objective,
    setObjective,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
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

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  async function reload() {
    const response =
      await getFlywheelVarianceDashboard();

    setDashboard(
      response,
    );

    setSettlementCaseId(
      response.settlements[0]
        ?.settlementCaseId
      ??
      "",
    );

    if (
      !ownerUserId
      &&
      response.users[0]
    ) {
      setOwnerUserId(
        response.users[0].id,
      );
    }
  }

  useEffect(() => {
    let active = true;

    getFlywheelVarianceDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          setSettlementCaseId(
            response.settlements[0]
              ?.settlementCaseId
            ??
            "",
          );

          setOwnerUserId(
            response.users[0]
              ?.id
            ??
            "",
          );
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load variance governance.",
            );
          }
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

  async function createPlan(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createFlywheelVariancePlan({
        settlementCaseId,

        title:
          title.trim(),

        planOwnerUserId:
          ownerUserId,

        resolutionObjective:
          objective.trim(),
      });

      setObjective("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create variance-resolution plan.",
      );
    } finally {
      setRunning(false);
    }
  }

  const summary =
    dashboard?.summary;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Post-settlement variance governance
          </span>

          <h1>
            Variance resolution
          </h1>

          <p>
            Turn partial and unresolved
            settlement variance into an
            explicit recovery, write-off,
            or investigation decision.
            Approval here governs the
            treatment only; it does not
            execute collections or
            accounting entries.
          </p>
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

      <section className="fwstrategy-score-grid">
        <article>
          <span>
            Eligible settlements
          </span>

          <strong>
            {
              summary
                ?.eligibleSettlementCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Plans
          </span>

          <strong>
            {
              summary?.planCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            In review
          </span>

          <strong>
            {
              summary
                ?.reviewPlanCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Approved
          </span>

          <strong>
            {
              summary
                ?.approvedPlanCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Recovery authority
          </span>

          <strong>
            {(summary
              ?.recoverByCurrency
              ??
              []
            ).length === 0
              ? "—"
              : null}

            {(summary
              ?.recoverByCurrency
              ??
              []
            ).map(
              total => (
                <span
                  key={
                    total.currency
                  }
                  style={{
                    display: "block",
                  }}
                >
                  {money(
                    total.amount,
                    total.currency,
                  )}
                </span>
              ),
            )}
          </strong>
        </article>

        <article>
          <span>
            Write-off authority
          </span>

          <strong>
            {(summary
              ?.writeOffByCurrency
              ??
              []
            ).length === 0
              ? "—"
              : null}

            {(summary
              ?.writeOffByCurrency
              ??
              []
            ).map(
              total => (
                <span
                  key={
                    total.currency
                  }
                  style={{
                    display: "block",
                  }}
                >
                  {money(
                    total.amount,
                    total.currency,
                  )}
                </span>
              ),
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Reconciled settlement authority
            </span>

            <h2>
              Variance awaiting governance
            </h2>
          </div>

          <Scale
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Settlement</th>
                <th>Status</th>
                <th>Released</th>
                <th>Settled</th>
                <th>Variance</th>
                <th>Partial</th>
                <th>Unresolved</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.settlements
                .map(
                  settlement => (
                    <tr
                      key={
                        settlement
                          .settlementCaseId
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {
                              settlement.title
                            }
                          </strong>

                          <span>
                            {
                              settlement
                                .reconciliationNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          settlement.status,
                        )}
                      </td>

                      <td>
                        {money(
                          settlement
                            .sourceReleasedAmount,
                          settlement.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          settlement
                            .settledAmount,
                          settlement.currency,
                        )}
                      </td>

                      <td>
                        <strong>
                          {money(
                            settlement
                              .varianceAmount,
                            settlement.currency,
                          )}
                        </strong>
                      </td>

                      <td>
                        {
                          settlement
                            .partialCount
                        }
                      </td>

                      <td>
                        {
                          settlement
                            .unresolvedCount
                        }
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-settlement/${settlement.settlementCaseId}`
                          }
                          className="table-action"
                        >
                          Settlement
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading
              &&
              (
                dashboard
                  ?.settlements
                  .length
                ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No reconciled
                    settlement variance
                    currently requires a
                    new plan.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={createPlan}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Variance treatment governance
              </span>

              <h2>
                Create resolution plan
              </h2>
            </div>
          </div>

          <div className="fwstrategy-form-grid">
            <label className="request-field fwstrategy-form-wide">
              <span>
                Settlement case
              </span>

              <select
                required
                value={
                  settlementCaseId
                }
                onChange={
                  event =>
                    setSettlementCaseId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select settlement
                </option>

                {dashboard
                  ?.settlements
                  .map(
                    settlement => (
                      <option
                        key={
                          settlement
                            .settlementCaseId
                        }
                        value={
                          settlement
                            .settlementCaseId
                        }
                      >
                        {
                          settlement
                            .reconciliationNumber
                        }
                        {" — "}
                        {settlement.title}
                        {" — variance "}
                        {money(
                          settlement
                            .varianceAmount,
                          settlement.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field fwstrategy-form-wide">
              <span>
                Plan title
              </span>

              <input
                required
                maxLength={300}
                value={title}
                onChange={
                  event =>
                    setTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Plan owner
              </span>

              <select
                required
                value={ownerUserId}
                onChange={
                  event =>
                    setOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.users
                  .map(
                    option => (
                      <option
                        key={option.id}
                        value={option.id}
                      >
                        {option.fullName}
                        {" — "}
                        {option.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field fwstrategy-form-wide">
              <span>
                Resolution objective
              </span>

              <textarea
                required
                rows={5}
                maxLength={5000}
                value={objective}
                onChange={
                  event =>
                    setObjective(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="fwstrategy-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !settlementCaseId
                ||
                !ownerUserId
                ||
                !title.trim()
                ||
                !objective.trim()
              }
            >
              Create resolution plan
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Human treatment decisions
            </span>

            <h2>
              Variance plans
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Variance</th>
                <th>Recovery</th>
                <th>Write-off</th>
                <th>Investigation</th>
                <th>Coverage</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.plans
                .map(
                  plan => (
                    <tr
                      key={plan.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {plan.title}
                          </strong>

                          <span>
                            {
                              plan
                                .planNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          plan.status,
                        )}
                      </td>

                      <td>
                        {money(
                          plan
                            .sourceVarianceAmount,
                          plan.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          plan
                            .recoverAmount,
                          plan.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          plan
                            .writeOffAmount,
                          plan.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          plan
                            .investigationAmount,
                          plan.currency,
                        )}
                      </td>

                      <td>
                        {
                          plan
                            .coveragePct
                            .toFixed(1)
                        }
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-variance/${plan.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading
              &&
              (
                dashboard
                  ?.plans
                  .length
                ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No variance-resolution
                    plan exists yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="fwstrategy-method-note">
        <Scale
          size={18}
        />

        <div>
          <strong>
            Approval is governance, not execution
          </strong>

          <p>
            RECOVER authorizes later
            recovery work, WRITE_OFF
            authorizes later accounting
            treatment, and INVESTIGATE
            retains the variance as an
            open governed exposure.
            Step 73 itself performs none
            of those external actions.
          </p>
        </div>
      </section>
    </div>
  );
}
