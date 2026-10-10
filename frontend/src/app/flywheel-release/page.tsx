"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  CircleAlert,
  WalletCards,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createFlywheelReleaseBatch,
  getFlywheelReleaseDashboard,
} from "@/lib/api";

import type {
  FlywheelReleaseDashboard,
} from "@/types/flywheel-release";

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

export default function FlywheelReleasePage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FlywheelReleaseDashboard |
      null
    >(null);

  const [
    mandateId,
    setMandateId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState(
      "Governed flywheel capital release",
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
      await getFlywheelReleaseDashboard();

    setDashboard(
      response,
    );

    setMandateId(
      response.mandates[0]
        ?.allocationMandateId
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

    getFlywheelReleaseDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          setMandateId(
            response.mandates[0]
              ?.allocationMandateId
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
                : "Unable to load capital-release governance.",
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

  async function createBatch(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createFlywheelReleaseBatch({
        allocationMandateId:
          mandateId,

        title:
          title.trim(),

        releaseOwnerUserId:
          ownerUserId,

        releaseRationale:
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
          : "Unable to create release batch.",
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
            Governed capital execution
          </span>

          <h1>
            Capital release
          </h1>

          <p>
            Execute authorized Step 68
            mandate capacity through
            explicit release records,
            evidence references and
            manager confirmation.
            ProcureIQ does not connect
            to a bank or move cash in
            this step.
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
            Eligible mandates
          </span>

          <strong>
            {
              summary
                ?.eligibleMandateCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Release batches
          </span>

          <strong>
            {
              summary
                ?.batchCount
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
                ?.draftBatchCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            In execution
          </span>

          <strong>
            {
              summary
                ?.executionBatchCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Executed
          </span>

          <strong>
            {
              summary
                ?.executedBatchCount
              ??
              0
            }
          </strong>
        </article>

        <article>
          <span>
            Recorded releases
          </span>

          <strong>
            {(summary?.cumulativeReleasedByCurrency ?? []).length === 0 ? "No recorded amounts" :
              (summary?.cumulativeReleasedByCurrency ?? []).map(total => (
                <span key={total.currency} style={{ display: "block" }}>
                  {money(total.amount, total.currency)}
                </span>
              ))}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Authorized Step 68 authority
            </span>

            <h2>
              Eligible mandates
            </h2>
          </div>

          <WalletCards
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Mandate</th>
                <th>Currency</th>
                <th>Authorized</th>
                <th>Released</th>
                <th>Remaining</th>
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
                      key={
                        mandate
                          .allocationMandateId
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {
                              mandate.title
                            }
                          </strong>

                          <span>
                            {
                              mandate
                                .allocationMandateNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {mandate.currency}
                      </td>

                      <td>
                        {money(
                          mandate
                            .authorizedAllocationAmount,
                          mandate.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          mandate
                            .cumulativeReleasedAmount,
                          mandate.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          mandate
                            .remainingReleaseAuthorityAmount,
                          mandate.currency,
                        )}
                      </td>

                      <td>
                        {
                          mandate
                            .authorizedItemCount
                        }
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-allocation/${mandate.allocationMandateId}`
                          }
                          className="table-action"
                        >
                          Mandate
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
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No authorized Step 68
                    mandate with remaining
                    release authority is
                    currently eligible.
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
          onSubmit={createBatch}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Controlled execution batch
              </span>

              <h2>
                Create release batch
              </h2>
            </div>
          </div>

          <div className="fwstrategy-form-grid">
            <label className="request-field fwstrategy-form-wide">
              <span>
                Authorized mandate
              </span>

              <select
                required
                value={mandateId}
                onChange={
                  event =>
                    setMandateId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select mandate
                </option>

                {dashboard
                  ?.mandates
                  .map(
                    mandate => (
                      <option
                        key={
                          mandate
                            .allocationMandateId
                        }
                        value={
                          mandate
                            .allocationMandateId
                        }
                      >
                        {
                          mandate
                            .allocationMandateNumber
                        }
                        {" — "}
                        {mandate.title}
                        {" — remaining "}
                        {money(
                          mandate
                            .remainingReleaseAuthorityAmount,
                          mandate.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field fwstrategy-form-wide">
              <span>
                Release title
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
                Release owner
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
                Release rationale
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
                !mandateId
                ||
                !title.trim()
                ||
                !ownerUserId
                ||
                !rationale.trim()
              }
            >
              Create release batch
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Release execution lifecycle
            </span>

            <h2>
              Release batches
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Release</th>
                <th>Status</th>
                <th>Mandate</th>
                <th>Planned</th>
                <th>Released</th>
                <th>Remaining mandate</th>
                <th>Items</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.batches
                .map(
                  batch => (
                    <tr
                      key={batch.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {batch.title}
                          </strong>

                          <span>
                            {
                              batch
                                .releaseNumber
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          batch.status,
                        )}
                      </td>

                      <td>
                        {
                          batch
                            .allocationMandateNumber
                        }
                      </td>

                      <td>
                        {money(
                          batch
                            .batchPlannedReleaseAmount,
                          batch.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          batch
                            .batchReleasedAmount,
                          batch.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          batch
                            .remainingMandateAmount,
                          batch.currency,
                        )}
                      </td>

                      <td>
                        {batch.itemCount}
                      </td>

                      <td>
                        <Link
                          href={
                            `/flywheel-release/${batch.id}`
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
                  ?.batches
                  .length
                ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No release batch
                    exists yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="fwstrategy-method-note">
        <WalletCards
          size={18}
        />

        <div>
          <strong>
            RELEASED is an internal execution record
          </strong>

          <p>
            Step 69 does not connect to
            a bank, PSP, treasury API or
            payment processor. Managers
            record controlled execution
            evidence against the
            authorized Step 68 mandate.
            The evidence reference can
            identify the corresponding
            transaction in the
            organization&apos;s external
            financial system.
          </p>
        </div>
      </section>
    </div>
  );
}
