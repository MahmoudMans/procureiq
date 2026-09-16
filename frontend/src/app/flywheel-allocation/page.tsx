"use client";

import {
  CircleAlert,
  Landmark,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createFlywheelAllocationMandate,
  getFlywheelAllocationDashboard,
} from "@/lib/api";

import type {
  FlywheelAllocationDashboard,
} from "@/types/flywheel-allocation";

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
  currency = "",
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}${currency ? ` ${currency}` : ""}`;
}

export default function FlywheelAllocationPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FlywheelAllocationDashboard |
      null
    >(null);

  const [
    strategyPortfolioId,
    setStrategyPortfolioId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState(
      "Authorized flywheel capital mandate",
    );

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    rationale,
    setRationale,
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
      await getFlywheelAllocationDashboard();

    setDashboard(
      response,
    );

    setStrategyPortfolioId(
      response.strategies[0]
        ?.strategyPortfolioId
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

    getFlywheelAllocationDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          setStrategyPortfolioId(
            response.strategies[0]
              ?.strategyPortfolioId
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
                : "Unable to load flywheel allocation governance.",
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

  async function createMandate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createFlywheelAllocationMandate({
        strategyPortfolioId,

        title:
          title.trim(),

        mandateOwnerUserId:
          ownerUserId,

        mandateRationale:
          rationale.trim(),
      });

      setRationale("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create capital allocation mandate.",
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
            Authorized capital planning
          </span>

          <h1>
            Capital mandates
          </h1>

          <p>
            Convert approved Step 67
            portfolio priorities into
            explicit allocation mandates.
            This stage authorizes capital
            capacity but does not release
            or move funds.
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
            Eligible strategies
          </span>

          <strong>
            {
              summary
                ?.eligibleStrategyCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Mandates
          </span>

          <strong>
            {
              summary
                ?.mandateCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Draft
          </span>

          <strong>
            {
              summary
                ?.draftMandateCount
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
                ?.reviewMandateCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Authorized
          </span>

          <strong>
            {
              summary
                ?.authorizedMandateCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Authorized capacity
          </span>

          <strong>
            {money(
              summary
                ?.authorizedAllocationAmount
              ??
              0,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Approved Step 67 authority
            </span>

            <h2>
              Eligible strategies
            </h2>
          </div>

          <Landmark
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Currency</th>
                <th>FY</th>
                <th>Prioritized capacity</th>
                <th>Prioritized items</th>
                <th>Avg priority</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.strategies
                .map(
                  strategy => (
                    <tr
                      key={
                        strategy
                          .strategyPortfolioId
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {
                              strategy.title
                            }
                          </strong>

                          <span>
                            {
                              strategy
                                .strategyPortfolioNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {strategy.currency}
                      </td>

                      <td>
                        {
                          strategy
                            .fiscalYear
                        }
                      </td>

                      <td>
                        {money(
                          strategy
                            .prioritizedCapacityAmount,
                          strategy.currency,
                        )}
                      </td>

                      <td>
                        {
                          strategy
                            .prioritizedItemCount
                        }
                      </td>

                      <td>
                        {
                          strategy
                            .averagePriorityScore
                            .toFixed(1)
                        }
                      </td>

                      <td>
                        {
                          strategy
                            .strategyOwnerName
                        }
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-strategy/${strategy.strategyPortfolioId}`
                          }
                          className="table-action"
                        >
                          Strategy
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              (
                dashboard
                  ?.strategies
                  .length
                ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No approved Step 67
                    strategy without an
                    open mandate is
                    currently eligible.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={createMandate}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governed allocation authority
              </span>

              <h2>
                Create allocation mandate
              </h2>
            </div>
          </div>

          <div className="fwstrategy-form-grid">
            <label className="request-field fwstrategy-form-wide">
              <span>
                Approved strategy
              </span>

              <select
                required
                value={
                  strategyPortfolioId
                }
                onChange={
                  event =>
                    setStrategyPortfolioId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select strategy
                </option>

                {dashboard
                  ?.strategies
                  .map(
                    strategy => (
                      <option
                        key={
                          strategy
                            .strategyPortfolioId
                        }
                        value={
                          strategy
                            .strategyPortfolioId
                        }
                      >
                        {
                          strategy
                            .strategyPortfolioNumber
                        }
                        {" — "}
                        {strategy.title}
                        {" — "}
                        {money(
                          strategy
                            .prioritizedCapacityAmount,
                          strategy.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field fwstrategy-form-wide">
              <span>
                Mandate title
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
                Mandate owner
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
                Mandate rationale
              </span>

              <textarea
                required
                rows={5}
                maxLength={5000}
                value={rationale}
                onChange={
                  event =>
                    setRationale(
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
                !strategyPortfolioId
                ||
                !title.trim()
                ||
                !ownerUserId
                ||
                !rationale.trim()
              }
            >
              Create mandate
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capital authorization lifecycle
            </span>

            <h2>
              Allocation mandates
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mandate</th>
                <th>Status</th>
                <th>Strategy</th>
                <th>Requested</th>
                <th>Available</th>
                <th>Utilization</th>
                <th>Items</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.mandates
                .map(
                  mandate => (
                    <tr
                      key={mandate.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {mandate.title}
                          </strong>

                          <span>
                            {
                              mandate
                                .mandateNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          mandate.status,
                        )}
                      </td>

                      <td>
                        {
                          mandate
                            .strategyPortfolioNumber
                        }
                      </td>

                      <td>
                        {money(
                          mandate
                            .requestedAllocationAmount,
                          mandate.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          mandate
                            .strategyPrioritizedCapacityAmount,
                          mandate.currency,
                        )}
                      </td>

                      <td>
                        {
                          mandate
                            .allocationUtilizationPct
                            .toFixed(1)
                        }
                        %
                      </td>

                      <td>
                        {mandate.itemCount}
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-allocation/${mandate.id}`
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
              (
                dashboard
                  ?.mandates
                  .length
                ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No capital allocation
                    mandate exists yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fwstrategy-method-note">
        <Landmark
          size={18}
        />

        <div>
          <strong>
            Authorization is not execution
          </strong>

          <p>
            Step 68 freezes an explicit
            allocation mandate against
            approved Step 67 priorities.
            Authorization creates
            governance authority only.
            No cash movement, funding
            release, purchase order,
            payment, or new flywheel
            cycle is created here.
          </p>
        </div>
      </section>
    </div>
  );
}
