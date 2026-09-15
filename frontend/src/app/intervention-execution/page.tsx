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
  captureInterventionExecutionSnapshot,
  createInterventionExecutionCase,
  getInterventionExecutionDashboard,
} from "@/lib/api";

import type {
  InterventionExecutionDashboard,
} from "@/types/intervention-execution";

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

export default function InterventionExecutionPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      InterventionExecutionDashboard |
      null
    >(null);

  const [
    interventionCaseId,
    setInterventionCaseId,
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

    getInterventionExecutionDashboard()
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
            setInterventionCaseId(
              response.candidates[0].interventionCaseId,
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
                : "Unable to load intervention execution.",
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
      await getInterventionExecutionDashboard(),
    );
  }

  async function createCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !interventionCaseId
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

      await createInterventionExecutionCase(
        interventionCaseId,
        {
          executionOwnerUserId:
            ownerUserId,
          executionObjective:
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
          : "Unable to create intervention-execution case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureInterventionExecutionSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture intervention-execution snapshot.",
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
            Approved intervention implementation
          </span>

          <h1>
            Intervention execution
          </h1>

          <p>
            Track implementation of
            approved Step 60 continue,
            hold, reduction and
            reallocation decisions without
            rewriting historical Step 57
            allocations or Step 58
            releases.
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

      <section className="execution-score-grid">
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
            Execution cases
          </span>

          <strong>
            {summary
              ?.caseCount ??
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
            Awaiting verification
          </span>

          <strong>
            {summary
              ?.readyCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Remediation
          </span>

          <strong className="execution-risk-text">
            {summary
              ?.remediationCaseCount ??
              0}
          </strong>
        </article>

        <article className="execution-score-card">
          <span>
            Average implementation
          </span>

          <strong>
            {(
              summary
                ?.averageImplementationPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>
      </section>

      <section className="execution-value-grid">
        <article>
          <span>
            Approved affected capital
          </span>

          <strong>
            {money(
              summary
                ?.totalApprovedAffectedCapitalAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Implemented capital
          </span>

          <strong>
            {money(
              summary
                ?.totalImplementedCapitalAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining implementation
          </span>

          <strong>
            {money(
              summary
                ?.totalRemainingImplementationAmount ??
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
              Approved Step 60 authority
            </span>

            <h2>
              Execution candidates
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
                <th>Intervention</th>
                <th>Action</th>
                <th>Approved affected</th>
                <th>Released capital</th>
                <th>Current remaining</th>
                <th>Target</th>
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
                        key={candidate.interventionCaseId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.initiativeTitle}
                            </strong>

                            <span>
                              {candidate.interventionNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            candidate.approvedAction,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.approvedAffectedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.currentReleasedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.currentRemainingCommitmentAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.approvedTargetValueCaseNumber ??
                            "—"}
                        </td>

                        <td>
                          <Link
                            href={
                              `/investment-interventions/${candidate.interventionCaseId}`
                            }
                            className="table-action"
                          >
                            Step 60 evidence
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
                    No approved Step 60
                    intervention is waiting
                    for execution tracking.
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
                Controlled implementation
              </span>

              <h2>
                Open execution case
              </h2>
            </div>
          </div>

          <div className="execution-case-form">
            <label className="request-field execution-form-wide">
              <span>
                Approved intervention
              </span>

              <select
                value={interventionCaseId}
                onChange={
                  event =>
                    setInterventionCaseId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.interventionCaseId}
                        value={candidate.interventionCaseId}
                      >
                        {candidate.interventionNumber}
                        {" — "}
                        {candidate.initiativeTitle}
                        {" · "}
                        {readable(
                          candidate.approvedAction,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Execution owner
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

            <label className="request-field execution-form-wide">
              <span>
                Execution objective
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

          <div className="execution-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !interventionCaseId
                ||
                !ownerUserId
                ||
                !objective.trim()
              }
            >
              Open execution case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Implementation reconciliation
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
                <th>Action</th>
                <th>Approved</th>
                <th>Implemented</th>
                <th>Remaining</th>
                <th>Implementation</th>
                <th>Variance</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  executionCase => (
                    <tr
                      key={executionCase.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {executionCase.initiativeTitle}
                          </strong>

                          <span>
                            {executionCase.executionNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          executionCase.status,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `execution-health execution-health--${executionCase.executionHealth.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            executionCase.executionHealth,
                          )}
                        </span>
                      </td>

                      <td>
                        {readable(
                          executionCase.approvedAction,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase.approvedAffectedCapitalAmount,
                          executionCase.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase.implementedCapitalAmount,
                          executionCase.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          executionCase.remainingImplementationAmount,
                          executionCase.currency,
                        )}
                      </td>

                      <td>
                        {executionCase.implementationPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {money(
                          executionCase.implementationVarianceAmount,
                          executionCase.currency,
                        )}
                      </td>

                      <td>
                        <Link
                          href={
                            `/intervention-execution/${executionCase.id}`
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
              Immutable implementation portfolio
            </span>

            <h2>
              Execution snapshots
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
                <th>Active</th>
                <th>Ready</th>
                <th>Verified</th>
                <th>Remediation</th>
                <th>Approved</th>
                <th>Implemented</th>
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
                          snapshot.totalApprovedAffectedCapitalAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalImplementedCapitalAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          snapshot.totalRemainingImplementationAmount,
                        )}
                      </td>

                      <td>
                        {snapshot.averageImplementationPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/intervention-execution/snapshots/${snapshot.id}`
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

      <section className="execution-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Tracking implementation does not rewrite historical funding
          </strong>

          <p>
            Step 61 records how much of an
            approved Step 60 intervention
            was actually implemented.
            Step 57 allocation decisions
            and Step 58 capital releases
            remain unchanged historical
            authorities.
          </p>
        </div>
      </section>
    </div>
  );
}
