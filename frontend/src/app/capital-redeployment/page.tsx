"use client";

import {
  Camera,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureCapitalRedeploymentSnapshot,
  createCapitalRedeploymentCase,
  getCapitalRedeploymentDashboard,
} from "@/lib/api";

import type {
  CapitalRedeploymentDashboard,
} from "@/types/capital-redeployment";

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

export default function CapitalRedeploymentPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapitalRedeploymentDashboard |
      null
    >(null);

  const [
    proposalId,
    setProposalId,
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

    getCapitalRedeploymentDashboard()
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
            setProposalId(
              response.candidates[0].reinvestmentProposalId,
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
                : "Unable to load capital-redeployment governance.",
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
      await getCapitalRedeploymentDashboard(),
    );
  }

  async function createCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createCapitalRedeploymentCase(
        proposalId,
        {
          redeploymentOwnerUserId:
            ownerUserId,
          redeploymentObjective:
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
          : "Unable to create capital-redeployment case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureCapitalRedeploymentSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture capital-redeployment snapshot.",
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
            Recycled-capital execution
          </span>

          <h1>
            Capital redeployment
          </h1>

          <p>
            Convert approved Step 62
            reinvestment decisions into
            evidence-gated, explicitly
            authorized capital
            redeployment while preserving
            every historical upstream
            authority.
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

      <section className="redeployment-score-grid">
        <article>
          <span>
            Approved candidates
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Cases
          </span>

          <strong>
            {summary
              ?.caseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Authorization queue
          </span>

          <strong>
            {summary
              ?.authorizationPendingCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Active
          </span>

          <strong>
            {summary
              ?.activeCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Remediation
          </span>

          <strong className="redeployment-risk-text">
            {summary
              ?.remediationCaseCount ??
              0}
          </strong>
        </article>

        <article className="redeployment-score-card">
          <span>
            Average redeployment
          </span>

          <strong>
            {(
              summary
                ?.averageRedeploymentPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>
      </section>

      <section className="redeployment-value-grid">
        <article>
          <span>
            Approved redeployment
          </span>

          <strong>
            {money(
              summary
                ?.totalApprovedRedeploymentAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Released redeployment
          </span>

          <strong>
            {money(
              summary
                ?.totalReleasedRedeploymentAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining redeployment
          </span>

          <strong>
            {money(
              summary
                ?.totalRemainingRedeploymentAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Verified cases
          </span>

          <strong>
            {summary
              ?.verifiedCaseCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Approved Step 62 reinvestment
            </span>

            <h2>
              Redeployment candidates
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
                <th>Target</th>
                <th>Source</th>
                <th>Approved</th>
                <th>Source recyclable</th>
                <th>Funding remaining</th>
                <th>ROI</th>
                <th>Persistence</th>
                <th>Health</th>
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
                        key={candidate.reinvestmentProposalId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.targetInitiativeTitle}
                            </strong>

                            <span>
                              {candidate.targetValueCaseNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {candidate.recyclingSourceNumber}
                        </td>

                        <td>
                          {money(
                            candidate.approvedRedeploymentAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.sourceRecyclableCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.currentSourceFundingRemainingAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.targetRoiPctSnapshot.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.targetPersistencePctSnapshot.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {readable(
                            candidate.targetValueHealthSnapshot,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/capital-recycling/${candidate.recyclingSourceId}`
                            }
                            className="table-action"
                          >
                            Step 62 evidence
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
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No approved Step 62
                    reinvestment proposal is
                    waiting for redeployment
                    execution.
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
          onSubmit={createCase}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Redeployment case
              </span>

              <h2>
                Open capital redeployment
              </h2>
            </div>
          </div>

          <div className="redeployment-case-form">
            <label className="request-field redeployment-form-wide">
              <span>
                Approved reinvestment
              </span>

              <select
                value={proposalId}
                onChange={
                  event =>
                    setProposalId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.reinvestmentProposalId}
                        value={candidate.reinvestmentProposalId}
                      >
                        {candidate.recyclingSourceNumber}
                        {" → "}
                        {candidate.targetInitiativeTitle}
                        {" · "}
                        {money(
                          candidate.approvedRedeploymentAmount,
                          candidate.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Redeployment owner
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

            <label className="request-field redeployment-form-wide">
              <span>
                Redeployment objective
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

          <div className="redeployment-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !proposalId
                ||
                !ownerUserId
                ||
                !objective.trim()
              }
            >
              Open redeployment case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capital redeployment portfolio
            </span>

            <h2>
              Execution cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Health</th>
                <th>Approved</th>
                <th>Released</th>
                <th>Remaining</th>
                <th>%</th>
                <th>Pending gates</th>
                <th>Target</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  redeploymentCase => (
                    <tr
                      key={redeploymentCase.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {redeploymentCase.targetInitiativeTitle}
                          </strong>

                          <span>
                            {redeploymentCase.redeploymentNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          redeploymentCase.status,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `redeployment-health redeployment-health--${redeploymentCase.redeploymentHealth.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            redeploymentCase.redeploymentHealth,
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          redeploymentCase.approvedRedeploymentAmount,
                          redeploymentCase.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          redeploymentCase.releasedRedeploymentAmount,
                          redeploymentCase.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          redeploymentCase.remainingRedeploymentAmount,
                          redeploymentCase.currency,
                        )}
                      </td>

                      <td>
                        {redeploymentCase.redeploymentPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {redeploymentCase.pendingGateCount}
                      </td>

                      <td>
                        {redeploymentCase.targetValueCaseNumber}
                      </td>

                      <td>
                        <Link
                          href={
                            `/capital-redeployment/${redeploymentCase.id}`
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
              Immutable redeployment portfolio
            </span>

            <h2>
              Redeployment snapshots
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
                <th>Cases</th>
                <th>Authorization queue</th>
                <th>Active</th>
                <th>Ready</th>
                <th>Verified</th>
                <th>Remediation</th>
                <th>Approved</th>
                <th>Released</th>
                <th>Remaining</th>
                <th>Avg %</th>
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
                        {snapshot.caseCount}
                      </td>

                      <td>
                        {snapshot.authorizationPendingCaseCount}
                      </td>

                      <td>
                        {snapshot.activeCaseCount}
                      </td>

                      <td>
                        {snapshot.readyCaseCount}
                      </td>

                      <td>
                        {snapshot.verifiedCaseCount}
                      </td>

                      <td>
                        {snapshot.remediationCaseCount}
                      </td>

                      <td>
                        {money(
                          snapshot.totalApprovedRedeploymentAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalReleasedRedeploymentAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalRemainingRedeploymentAmount,
                        )}
                      </td>

                      <td>
                        {snapshot.averageRedeploymentPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/capital-redeployment/snapshots/${snapshot.id}`
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

      <section className="redeployment-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Step 62 approval reserves authority; Step 63 governs actual redeployment
          </strong>

          <p>
            Recycled capital is not
            released automatically.
            Redeployment requires evidence
            gates, explicit manager
            authorization and immutable
            release evidence before final
            verification.
          </p>
        </div>
      </section>
    </div>
  );
}
