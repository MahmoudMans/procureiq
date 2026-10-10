"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  CircleAlert,
  ReceiptText,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createFlywheelSettlementCase,
  getFlywheelSettlementDashboard,
} from "@/lib/api";

import type {
  FlywheelSettlementDashboard,
} from "@/types/flywheel-settlement";

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

export default function FlywheelSettlementPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FlywheelSettlementDashboard |
      null
    >(null);

  const [
    releaseBatchId,
    setReleaseBatchId,
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
      "Release settlement reconciliation",
    );

  const [
    rationale,
    setRationale,
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
      await getFlywheelSettlementDashboard();

    setDashboard(
      response,
    );

    setReleaseBatchId(
      response.releases[0]
        ?.releaseBatchId
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

    getFlywheelSettlementDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          setReleaseBatchId(
            response.releases[0]
              ?.releaseBatchId
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
                : "Unable to load settlement reconciliation.",
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

      await createFlywheelSettlementCase({
        releaseBatchId,

        title:
          title.trim(),

        reconciliationOwnerUserId:
          ownerUserId,

        reconciliationRationale:
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
          : "Unable to create settlement reconciliation case.",
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
            Post-release financial evidence
          </span>

          <h1>
            Settlement evidence
          </h1>

          <p>
            Reconcile finalized internal
            capital-release records
            against external settlement
            evidence. Evidence is entered
            manually; this module does
            not connect to a bank or
            payment provider.
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
            Eligible releases
          </span>

          <strong>
            {
              summary
                ?.eligibleReleaseCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Reconciliation cases
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
              summary?.reviewCaseCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Reconciled
          </span>

          <strong>
            {
              summary
                ?.reconciledCaseCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Settled evidence
          </span>

          <strong>
            {(summary
              ?.reconciledSettledByCurrency
              ??
              []
            ).length === 0
              ? "—"
              : null}

            {(summary
              ?.reconciledSettledByCurrency
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
            Unsettled variance
          </span>

          <strong>
            {(summary
              ?.reconciledVarianceByCurrency
              ??
              []
            ).length === 0
              ? "—"
              : null}

            {(summary
              ?.reconciledVarianceByCurrency
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
              Finalized Step 69/70 authority
            </span>

            <h2>
              Releases awaiting reconciliation
            </h2>
          </div>

          <ReceiptText
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Release</th>
                <th>Status</th>
                <th>Currency</th>
                <th>Released amount</th>
                <th>Released items</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.releases
                .map(
                  release => (
                    <tr
                      key={
                        release
                          .releaseBatchId
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {
                              release.title
                            }
                          </strong>

                          <span>
                            {
                              release
                                .releaseNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          release.status,
                        )}
                      </td>

                      <td>
                        {release.currency}
                      </td>

                      <td>
                        {money(
                          release
                            .releasedAmount,
                          release.currency,
                        )}
                      </td>

                      <td>
                        {
                          release
                            .releasedItemCount
                        }
                      </td>

                      <td>
                        {
                          release
                            .releaseOwnerName
                        }
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-release/${release.releaseBatchId}`
                          }
                          className="table-action"
                        >
                          Release
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading
              &&
              (
                dashboard
                  ?.releases
                  .length
                ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No finalized release
                    currently requires a
                    new reconciliation
                    case.
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
                Manual evidence governance
              </span>

              <h2>
                Create reconciliation case
              </h2>
            </div>
          </div>

          <div className="fwstrategy-form-grid">
            <label className="request-field fwstrategy-form-wide">
              <span>
                Finalized release
              </span>

              <select
                required
                value={releaseBatchId}
                onChange={
                  event =>
                    setReleaseBatchId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select release
                </option>

                {dashboard
                  ?.releases
                  .map(
                    release => (
                      <option
                        key={
                          release
                            .releaseBatchId
                        }
                        value={
                          release
                            .releaseBatchId
                        }
                      >
                        {
                          release
                            .releaseNumber
                        }
                        {" — "}
                        {release.title}
                        {" — "}
                        {money(
                          release
                            .releasedAmount,
                          release.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field fwstrategy-form-wide">
              <span>
                Case title
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
                Reconciliation owner
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
                Reconciliation rationale
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
                !releaseBatchId
                ||
                !ownerUserId
                ||
                !title.trim()
                ||
                !rationale.trim()
              }
            >
              Create reconciliation case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Settlement governance lifecycle
            </span>

            <h2>
              Reconciliation cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Release</th>
                <th>Released</th>
                <th>Settled</th>
                <th>Variance</th>
                <th>Settlement</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  settlementCase => (
                    <tr
                      key={
                        settlementCase.id
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {
                              settlementCase
                                .title
                            }
                          </strong>

                          <span>
                            {
                              settlementCase
                                .reconciliationNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          settlementCase
                            .status,
                        )}
                      </td>

                      <td>
                        {
                          settlementCase
                            .releaseNumber
                        }
                      </td>

                      <td>
                        {money(
                          settlementCase
                            .sourceReleasedAmount,
                          settlementCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {money(
                          settlementCase
                            .settledAmount,
                          settlementCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {money(
                          settlementCase
                            .varianceAmount,
                          settlementCase
                            .currency,
                        )}
                      </td>

                      <td>
                        {
                          settlementCase
                            .settlementPct
                            .toFixed(1)
                        }
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-settlement/${settlementCase.id}`
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
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No settlement
                    reconciliation case
                    exists yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="fwstrategy-method-note">
        <ReceiptText
          size={18}
        />

        <div>
          <strong>
            Evidence is manually recorded
          </strong>

          <p>
            A settlement reference can
            point to a bank statement,
            treasury record, ERP entry,
            accounting journal or other
            external evidence. ProcureIQ
            stores the reference and
            governance evidence only; it
            does not retrieve or execute
            the financial transaction.
          </p>
        </div>
      </section>
    </div>
  );
}
