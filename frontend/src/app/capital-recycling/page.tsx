"use client";

import {
  Camera,
  CircleAlert,
  Goal,
  Recycle,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureCapitalRecyclingSnapshot,
  createCapitalRecyclingSource,
  getCapitalRecyclingDashboard,
} from "@/lib/api";

import type {
  CapitalRecyclingDashboard,
} from "@/types/capital-recycling";

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

export default function CapitalRecyclingPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapitalRecyclingDashboard |
      null
    >(null);

  const [
    executionCaseId,
    setExecutionCaseId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    objective,
    setObjective,
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

  useEffect(() => {
    let active = true;

    getCapitalRecyclingDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          if (
            response.candidates[0]
          ) {
            setExecutionCaseId(
              response.candidates[0].executionCaseId,
            );
          }

          if (
            response.users[0]
          ) {
            setOwnerUserId(
              response.users[0].id,
            );
          }
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load capital-recycling governance.",
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

  async function reload() {
    setDashboard(
      await getCapitalRecyclingDashboard(),
    );
  }

  async function createSource(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !executionCaseId
      ||
      !ownerUserId
      ||
      !objective.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createCapitalRecyclingSource(
        executionCaseId,
        {
          sourceOwnerUserId:
            ownerUserId,
          recyclingObjective:
            objective.trim(),
        },
      );

      setObjective("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create capital-recycling source.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureCapitalRecyclingSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture capital-recycling snapshot.",
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
            Verified capital reuse
          </span>

          <h1>
            Capital recycling
          </h1>

          <p>
            Convert verified Step 61
            reductions and reallocations
            into governed recyclable
            capital, then approve new
            Step 56 reinvestment targets
            without rewriting historical
            allocation or funding records.
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            className="button button--primary"
            disabled={running}
            onClick={
              () =>
                void captureSnapshot()
            }
          >
            <Camera
              size={15}
            />
            Capture snapshot
          </button>
        ) : null}
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="recycling-score-grid">
        <article>
          <span>
            Verified candidates
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Recycling sources
          </span>

          <strong>
            {summary
              ?.sourceCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Open
          </span>

          <strong>
            {summary
              ?.openSourceCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Fully allocated
          </span>

          <strong>
            {summary
              ?.fullyAllocatedSourceCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {(
              summary
                ?.averageUtilizationPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article className="recycling-score-card">
          <span>
            Available capital
          </span>

          <strong>
            {money(
              summary
                ?.totalAvailableCapitalAmount ??
                0,
            )}
          </strong>
        </article>
      </section>

      <section className="recycling-value-grid">
        <article>
          <span>
            Recyclable capital
          </span>

          <strong>
            {money(
              summary
                ?.totalRecyclableCapitalAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Approved reinvestment
          </span>

          <strong>
            {money(
              summary
                ?.totalApprovedReinvestmentAmount ??
                0,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Verified Step 61 execution
            </span>

            <h2>
              Recycling candidates
            </h2>
          </div>

          <Recycle
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Action</th>
                <th>Verified implemented</th>
                <th>Step 58 remaining</th>
                <th>Recyclable</th>
                <th>Preferred target</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <tr
                        key={candidate.executionCaseId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.sourceInitiativeTitle}
                            </strong>

                            <span>
                              {candidate.executionNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            candidate.sourceAction,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.verifiedImplementedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.currentFundingRemainingAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          <strong>
                            {money(
                              candidate.recyclableCapitalAmount,
                              candidate.currency,
                            )}
                          </strong>
                        </td>

                        <td>
                          {candidate.preferredTargetValueCaseNumber ??
                            "Open target selection"}
                        </td>

                        <td>
                          <Link
                            href={
                              `/intervention-execution/${candidate.executionCaseId}`
                            }
                            className="table-action"
                          >
                            Execution evidence
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.candidates
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No verified Step 61
                    reduction or
                    reallocation execution
                    is currently eligible
                    for capital recycling.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage &&
      (
        dashboard
          ?.candidates
          .length ??
        0
      ) >
        0 ? (
        <form
          className="panel"
          onSubmit={createSource}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Recycling authority
              </span>

              <h2>
                Create recyclable-capital source
              </h2>
            </div>
          </div>

          <div className="recycling-source-form">
            <label className="request-field recycling-form-wide">
              <span>
                Verified execution
              </span>

              <select
                value={executionCaseId}
                onChange={
                  event =>
                    setExecutionCaseId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.executionCaseId}
                        value={candidate.executionCaseId}
                      >
                        {candidate.executionNumber}
                        {" — "}
                        {candidate.sourceInitiativeTitle}
                        {" · "}
                        {money(
                          candidate.recyclableCapitalAmount,
                          candidate.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Recycling owner
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

            <label className="request-field recycling-form-wide">
              <span>
                Recycling objective
              </span>

              <textarea
                required
                rows={5}
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

          <div className="recycling-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !executionCaseId
                ||
                !ownerUserId
                ||
                !objective.trim()
              }
            >
              Create recycling source
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Governed reusable capital
            </span>

            <h2>
              Recycling sources
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Action</th>
                <th>Recyclable</th>
                <th>Approved</th>
                <th>Pending</th>
                <th>Available</th>
                <th>Utilization</th>
                <th>Current funding remaining</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.sources
                .map(
                  source => (
                    <tr
                      key={source.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {source.sourceInitiativeTitle}
                          </strong>

                          <span>
                            {source.sourceNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `recycling-status recycling-status--${source.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            source.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {readable(
                          source.sourceAction,
                        )}
                      </td>

                      <td>
                        {money(
                          source.recyclableCapitalAmount,
                          source.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          source.approvedReinvestmentAmount,
                          source.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          source.pendingReinvestmentAmount,
                          source.currency,
                        )}
                      </td>

                      <td>
                        <strong>
                          {money(
                            source.availableCapitalAmount,
                            source.currency,
                          )}
                        </strong>
                      </td>

                      <td>
                        {source.utilizationPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {money(
                          source.currentFundingRemainingAmount,
                          source.currency,
                        )}
                      </td>

                      <td>
                        <Link
                          href={
                            `/capital-recycling/${source.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable recycling portfolio
            </span>

            <h2>
              Recycling snapshots
            </h2>
          </div>

          <Camera
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Sources</th>
                <th>Open</th>
                <th>Allocated</th>
                <th>Recyclable</th>
                <th>Approved</th>
                <th>Available</th>
                <th>Utilization</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.snapshots
                .map(
                  snapshot => (
                    <tr
                      key={snapshot.id}
                    >
                      <td>
                        <strong>
                          {snapshot.snapshotNumber}
                        </strong>
                      </td>

                      <td>
                        {snapshot.sourceCount}
                      </td>

                      <td>
                        {snapshot.openSourceCount}
                      </td>

                      <td>
                        {snapshot.fullyAllocatedSourceCount}
                      </td>

                      <td>
                        {money(
                          snapshot.totalRecyclableCapitalAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalApprovedReinvestmentAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalAvailableCapitalAmount,
                        )}
                      </td>

                      <td>
                        {snapshot.averageUtilizationPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/capital-recycling/snapshots/${snapshot.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="recycling-method-note">
        <Recycle
          size={18}
        />

        <div>
          <strong>
            Recycled capital is a governed reinvestment authority, not a rewritten funding ledger
          </strong>

          <p>
            Step 62 caps reusable capital
            by both verified Step 61
            implementation and current
            Step 58 unreleased funding.
            Approval of a reinvestment
            proposal never creates or
            releases funding automatically.
          </p>
        </div>
      </section>
    </div>
  );
}
