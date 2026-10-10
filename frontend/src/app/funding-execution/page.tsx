"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Camera,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  captureFundingSnapshot,
  createFundingCommitment,
  getFundingExecutionDashboard,
} from "@/lib/api";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import type {
  FundingExecutionDashboard,
} from "@/types/funding-execution";

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

export default function FundingExecutionPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      FundingExecutionDashboard |
      null
    >(null);

  const [
    allocationItemId,
    setAllocationItemId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    committedCapital,
    setCommittedCapital,
  ] =
    useState(0);

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

    getFundingExecutionDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          const candidate =
            response.candidates[0];

          if (candidate) {
            setAllocationItemId(
              candidate.allocationItemId,
            );

            setCommittedCapital(
              candidate.authorizedCapitalAmount,
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
                : "Unable to load funding execution.",
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
      await getFundingExecutionDashboard(),
    );
  }

  function chooseCandidate(
    id: string,
  ) {
    setAllocationItemId(
      id,
    );

    const candidate =
      dashboard
        ?.candidates
        .find(
          item =>
            item.allocationItemId ===
              id,
        );

    if (candidate) {
      setCommittedCapital(
        candidate.authorizedCapitalAmount,
      );
    }
  }

  async function createCommitment(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createFundingCommitment(
        allocationItemId,
        {
          fundingOwnerUserId:
            ownerUserId,
          committedCapitalAmount:
            committedCapital,
          objective:
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
          : "Unable to create funding commitment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot(
    commitmentId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await captureFundingSnapshot(
        commitmentId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture funding snapshot.",
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
            Authorized capital execution
          </span>

          <h1>
            Funding execution
          </h1>

          <p>
            Convert approved Step 57 FUND
            decisions into governed
            funding commitments, evidence-
            gated release tranches and
            immutable capital
            authorization records.
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

      <section className="funding-score-grid">
        <article>
          <span>
            Funded candidates
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Commitments
          </span>

          <strong>
            {summary
              ?.commitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Active
          </span>

          <strong>
            {summary
              ?.activeCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Fully released
          </span>

          <strong>
            {summary
              ?.fullyReleasedCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Committed capital
          </span>

          <strong>
            {money(
              summary
                ?.totalCommittedCapitalAmount ??
                0,
            )}
          </strong>
        </article>

        <article className="funding-score-card">
          <span>
            Released capital
          </span>

          <strong>
            {money(
              summary
                ?.totalReleasedAmount ??
                0,
            )}
          </strong>
        </article>
      </section>

      <section className="funding-value-grid">
        <article>
          <span>
            Authorized ceiling
          </span>

          <strong>
            {money(
              summary
                ?.totalAuthorizedCapitalAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining committed
          </span>

          <strong>
            {money(
              summary
                ?.totalRemainingCommitmentAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Planned commitments
          </span>

          <strong>
            {summary
              ?.plannedCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Closed commitments
          </span>

          <strong>
            {summary
              ?.closedCommitmentCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Step 57 funding authority
            </span>

            <h2>
              Approved FUND decisions
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Cycle</th>
                <th>Capital ceiling</th>
                <th>Priority</th>
                <th>ROI</th>
                <th>Persistence</th>
                <th>Net value</th>
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
                        key={candidate.allocationItemId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.initiativeTitle}
                            </strong>

                            <span>
                              {candidate.caseNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {candidate.allocationCycleNumber}
                        </td>

                        <td>
                          {money(
                            candidate.authorizedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.priorityScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {candidate.roiPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.persistencePct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {money(
                            candidate.netValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/capital-allocation/${candidate.allocationCycleId}`
                            }
                            className="table-action"
                          >
                            Allocation evidence
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
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No approved Step 57
                    FUND decision is
                    waiting for funding
                    commitment governance.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
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
          onSubmit={createCommitment}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Funding commitment
              </span>

              <h2>
                Commit approved capital
              </h2>
            </div>
          </div>

          <div className="funding-commitment-form">
            <label className="request-field funding-form-wide">
              <span>
                Approved FUND decision
              </span>

              <select
                value={allocationItemId}
                onChange={
                  event =>
                    chooseCandidate(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.allocationItemId}
                        value={candidate.allocationItemId}
                      >
                        {candidate.allocationCycleNumber}
                        {" — "}
                        {candidate.initiativeTitle}
                        {" · "}
                        {money(
                          candidate.authorizedCapitalAmount,
                          candidate.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Funding owner
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
                Committed capital
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={committedCapital}
                onChange={
                  event =>
                    setCommittedCapital(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field funding-form-wide">
              <span>
                Funding objective
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

          <div className="funding-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !allocationItemId
                ||
                !ownerUserId
                ||
                committedCapital <=
                  0
                ||
                !objective.trim()
              }
            >
              Create funding commitment
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capital release portfolio
            </span>

            <h2>
              Funding commitments
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Commitment</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Authorized</th>
                <th>Committed</th>
                <th>Released</th>
                <th>Release %</th>
                <th>Remaining</th>
                <th>Gates</th>
                <th />
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.commitments
                .map(
                  commitment => (
                    <tr
                      key={commitment.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {commitment.initiativeTitle}
                          </strong>

                          <span>
                            {commitment.commitmentNumber}
                            {" · "}
                            {commitment.allocationCycleNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `funding-status funding-status--${commitment.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            commitment.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {commitment.fundingOwnerName}
                      </td>

                      <td>
                        {money(
                          commitment.authorizedCapitalAmount,
                          commitment.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          commitment.committedCapitalAmount,
                          commitment.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          commitment.releasedAmount,
                          commitment.currency,
                        )}
                      </td>

                      <td>
                        {commitment.releasePct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {money(
                          commitment.remainingCommitmentAmount,
                          commitment.currency,
                        )}
                      </td>

                      <td>
                        {commitment.pendingGateCount}
                        {" pending"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="table-action funding-link-button"
                          disabled={running}
                          onClick={
                            () =>
                              void snapshot(
                                commitment.id,
                              )
                          }
                        >
                          Snapshot
                        </button>
                      </td>

                      <td>
                        <Link
                          href={
                            `/funding-execution/${commitment.id}`
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
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable funding evidence
            </span>

            <h2>
              Funding snapshots
            </h2>
          </div>

          <Camera
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Commitment</th>
                <th>Status</th>
                <th>Committed</th>
                <th>Released</th>
                <th>Release %</th>
                <th>Remaining</th>
                <th>Pending gates</th>
                <th>Captured</th>
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
                        {snapshot.commitmentNumber}
                      </td>

                      <td>
                        {readable(
                          snapshot.commitmentStatus,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.committedCapitalAmount,
                          snapshot.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.releasedAmount,
                          snapshot.currency,
                        )}
                      </td>

                      <td>
                        {snapshot.releasePct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {money(
                          snapshot.remainingCommitmentAmount,
                          snapshot.currency,
                        )}
                      </td>

                      <td>
                        {snapshot.pendingGateCount}
                      </td>

                      <td>
                        {new Date(
                          snapshot.capturedAt,
                        )
                          .toLocaleString()}
                      </td>

                      <td>
                        <Link
                          href={
                            `/funding-execution/snapshots/${snapshot.id}`
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
          </SmartTable>
        </div>
      </section>

      <section className="funding-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            A FUND decision authorizes a ceiling; it does not release cash
          </strong>

          <p>
            Step 58 separates approved
            allocation, funding
            commitment, evidence-gated
            authorization and actual
            release. Capital is never
            released automatically from
            the Step 57 decision.
          </p>
        </div>
      </section>
    </div>
  );
}
