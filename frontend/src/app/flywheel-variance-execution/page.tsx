"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  CircleAlert,
  ClipboardCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createFlywheelVarianceExecutionCase,
  getFlywheelVarianceExecutionDashboard,
} from "@/lib/api";

import type {
  FlywheelVarianceExecutionDashboard,
} from "@/types/flywheel-variance-execution";

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

export default function FlywheelVarianceExecutionPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FlywheelVarianceExecutionDashboard |
      null
    >(null);

  const [
    variancePlanId,
    setVariancePlanId,
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
      "Variance treatment execution",
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
      await getFlywheelVarianceExecutionDashboard();

    setDashboard(
      response,
    );

    setVariancePlanId(
      response.plans[0]
        ?.variancePlanId
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

    getFlywheelVarianceExecutionDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          setVariancePlanId(
            response.plans[0]
              ?.variancePlanId
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
                : "Unable to load variance treatment execution.",
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

  async function createCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createFlywheelVarianceExecutionCase({
        variancePlanId,

        title:
          title.trim(),

        executionOwnerUserId:
          ownerUserId,

        executionObjective:
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
          : "Unable to create treatment-execution case.",
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
            Approved variance treatment evidence
          </span>

          <h1>
            Treatment execution
          </h1>

          <p>
            Record auditable evidence
            that approved Step 73
            recovery, write-off, or
            investigation decisions were
            carried out externally.
            ProcureIQ records and verifies
            the evidence; it does not
            perform the financial action.
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
            Eligible plans
          </span>

          <strong>
            {
              summary
                ?.eligiblePlanCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Execution cases
          </span>

          <strong>
            {
              summary?.caseCount
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
                ?.reviewCaseCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Verified
          </span>

          <strong>
            {
              summary
                ?.verifiedCaseCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Recorded recovery
          </span>

          <strong>
            {(summary
              ?.recoveredByCurrency
              ??
              []
            ).length === 0
              ? "—"
              : null}

            {(summary
              ?.recoveredByCurrency
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
            Verified-case financial residual
          </span>

          <strong>
            {(summary
              ?.financialResidualByCurrency
              ??
              []
            ).length === 0
              ? "—"
              : null}

            {(summary
              ?.financialResidualByCurrency
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
              Step 73 approved authority
            </span>

            <h2>
              Plans awaiting execution evidence
            </h2>
          </div>

          <ClipboardCheck
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Variance</th>
                <th>Recover</th>
                <th>Write-off</th>
                <th>Investigate</th>
                <th>Items</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.plans
                .map(
                  plan => (
                    <tr
                      key={
                        plan.variancePlanId
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {plan.title}
                          </strong>

                          <span>
                            {
                              plan
                                .variancePlanNumber
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
                        {plan.itemCount}
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-variance/${plan.variancePlanId}`
                          }
                          className="table-action"
                        >
                          Plan
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
                    No approved Step 73
                    plan currently needs
                    a new execution case.
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
          onSubmit={createCase}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Treatment execution evidence
              </span>

              <h2>
                Create execution case
              </h2>
            </div>
          </div>

          <div className="fwstrategy-form-grid">
            <label className="request-field fwstrategy-form-wide">
              <span>
                Approved variance plan
              </span>

              <select
                required
                value={variancePlanId}
                onChange={
                  event =>
                    setVariancePlanId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select plan
                </option>

                {dashboard
                  ?.plans
                  .map(
                    plan => (
                      <option
                        key={
                          plan
                            .variancePlanId
                        }
                        value={
                          plan
                            .variancePlanId
                        }
                      >
                        {
                          plan
                            .variancePlanNumber
                        }
                        {" — "}
                        {plan.title}
                        {" — "}
                        {money(
                          plan
                            .sourceVarianceAmount,
                          plan.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field fwstrategy-form-wide">
              <span>
                Execution case title
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
                Execution owner
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
                Execution objective
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
                !variancePlanId
                ||
                !ownerUserId
                ||
                !title.trim()
                ||
                !objective.trim()
              }
            >
              Create execution case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Recorded external execution
            </span>

            <h2>
              Treatment execution cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Variance</th>
                <th>Recovered</th>
                <th>Written off</th>
                <th>Investigation complete</th>
                <th>Financial residual</th>
                <th>Treatment completion</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  executionCase => (
                    <tr
                      key={
                        executionCase.id
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {
                              executionCase
                                .title
                            }
                          </strong>

                          <span>
                            {
                              executionCase
                                .executionNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          executionCase
                            .status,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase
                            .sourceVarianceAmount,
                          executionCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase
                            .recoveredAmount,
                          executionCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase
                            .writtenOffAmount,
                          executionCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase
                            .completedInvestigationAmount,
                          executionCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase.exposure.financialResidualAmount,
                          executionCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {
                          executionCase
                            .completionPct
                            .toFixed(1)
                        }
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-variance-execution/${executionCase.id}`
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
                  ?.cases
                  .length
                ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No treatment execution
                    case exists yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="fwstrategy-method-note">
        <ClipboardCheck
          size={18}
        />

        <div>
          <strong>
            Evidence only — no external action
          </strong>

          <p>
            ProcureIQ records references,
            dates, outcomes and amounts
            supplied by authorized users.
            It does not initiate a
            collection, journal entry,
            refund, bank transfer, or
            accounting write-off.
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>Financial residual and evidence coverage</h2>
        <p>
          Financial residual equals approved variance minus recorded recoveries
          and recorded write-offs. Completing an investigation does not reduce
          that residual. Treatment completion measures workflow progress, not
          cash recovered or accounting entries posted by ProcureIQ.
        </p>

          <p>Dashboard residual totals include VERIFIED and CLOSED cases only.
          The table below the totals includes individual cases in all states.</p>
      </section>
    </div>
  );
}
