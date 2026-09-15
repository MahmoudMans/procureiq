"use client";

import {
  Camera,
  CircleAlert,
  Goal,
  RefreshCcw,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureCapitalFlywheelSnapshot,
  createCapitalFlywheelLineage,
  getCapitalFlywheelDashboard,
} from "@/lib/api";

import type {
  CapitalFlywheelDashboard,
} from "@/types/capital-flywheel";

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

export default function CapitalFlywheelPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapitalFlywheelDashboard |
      null
    >(null);

  const [
    persistenceCaseId,
    setPersistenceCaseId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    maximumCycles,
    setMaximumCycles,
  ] =
    useState(5);

  const [
    minimumMarginalMultiple,
    setMinimumMarginalMultiple,
  ] =
    useState(0.2);

  const [
    minimumEfficiency,
    setMinimumEfficiency,
  ] =
    useState(90);

  const [
    diminishingTolerance,
    setDiminishingTolerance,
  ] =
    useState(80);

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

    getCapitalFlywheelDashboard()
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
            setPersistenceCaseId(
              response.candidates[0].persistenceCaseId,
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
                : "Unable to load capital-flywheel governance.",
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
      await getCapitalFlywheelDashboard(),
    );
  }

  async function createLineage(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createCapitalFlywheelLineage(
        persistenceCaseId,
        {
          lineageOwnerUserId:
            ownerUserId,

          maximumCycleCount:
            maximumCycles,

          minimumMarginalValueMultiple:
            minimumMarginalMultiple,

          minimumCycleEfficiencyRetentionPct:
            minimumEfficiency,

          diminishingReturnTolerancePct:
            diminishingTolerance,

          lineageObjective:
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
          : "Unable to create capital lineage.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureCapitalFlywheelSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture capital-flywheel snapshot.",
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
            Multi-cycle capital compounding
          </span>

          <h1>
            Capital flywheel
          </h1>

          <p>
            Link sustained recycling cycles
            into immutable capital
            lineages, measure cumulative
            value per original capital
            unit, detect diminishing
            returns and govern whether the
            enterprise should recycle
            capital again.
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

      <section className="flywheel-score-grid">
        <article>
          <span>
            Eligible Step 65 cases
          </span>

          <strong>
            {summary?.candidateCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Capital lineages
          </span>

          <strong>
            {summary?.lineageCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Total cycles
          </span>

          <strong>
            {summary?.totalCycleCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Awaiting review
          </span>

          <strong>
            {summary?.reviewPendingLineageCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Diminishing returns
          </span>

          <strong className="flywheel-risk-text">
            {summary?.diminishingReturnLineageCount ?? 0}
          </strong>
        </article>

        <article className="flywheel-score-card">
          <span>
            Avg cumulative value / original capital
          </span>

          <strong>
            {(summary?.averageCumulativeValueMultiple ?? 0).toFixed(
              2,
            )}
            x
          </strong>
        </article>
      </section>

      <section className="flywheel-value-grid">
        <article>
          <span>
            Original capital
          </span>

          <strong>
            {money(
              summary?.totalOriginalCapitalAmount ?? 0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Cumulative projected net value
          </span>

          <strong>
            {money(
              summary?.totalCumulativeProjectedNetValueAmount ?? 0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Compounding value
          </span>

          <strong>
            {money(
              summary?.totalCompoundingValueAmount ?? 0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Decayed value
          </span>

          <strong>
            {money(
              summary?.totalDecayedValueAmount ?? 0,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Sustained Step 65 authorities
            </span>

            <h2>
              Flywheel candidates
            </h2>
          </div>

          <RefreshCcw
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Health</th>
                <th>Capital</th>
                <th>Projected net value</th>
                <th>Projected ROI</th>
                <th>Persistence</th>
                <th>Efficiency</th>
                <th>Compounding</th>
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
                        key={candidate.persistenceCaseId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.targetInitiativeTitle}
                            </strong>

                            <span>
                              {candidate.persistenceCaseNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            candidate.persistenceHealth,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.redeployedCapitalAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.projectedNetValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.projectedRoiPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.valuePersistencePct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.efficiencyRetentionPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {money(
                            candidate.compoundingValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              `/reinvestment-persistence/${candidate.persistenceCaseId}`
                            }
                            className="table-action"
                          >
                            Step 65 evidence
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
                    No unused sustained
                    Step 65 outcome is
                    currently eligible for
                    a capital lineage.
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
          onSubmit={createLineage}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Original-capital lineage
              </span>

              <h2>
                Create flywheel lineage
              </h2>
            </div>
          </div>

          <div className="flywheel-lineage-form">
            <label className="request-field flywheel-form-wide">
              <span>
                Root Step 65 outcome
              </span>

              <select
                value={persistenceCaseId}
                onChange={
                  event =>
                    setPersistenceCaseId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.persistenceCaseId}
                        value={candidate.persistenceCaseId}
                      >
                        {candidate.persistenceCaseNumber}
                        {" — "}
                        {candidate.targetInitiativeTitle}
                        {" · "}
                        {money(
                          candidate.redeployedCapitalAmount,
                          candidate.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Lineage owner
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

            <label className="request-field">
              <span>
                Maximum cycles
              </span>

              <input
                type="number"
                min="1"
                max="20"
                value={maximumCycles}
                onChange={
                  event =>
                    setMaximumCycles(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Minimum marginal value multiple
              </span>

              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={minimumMarginalMultiple}
                onChange={
                  event =>
                    setMinimumMarginalMultiple(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Minimum efficiency retention %
              </span>

              <input
                type="number"
                min="50"
                max="200"
                step="0.01"
                value={minimumEfficiency}
                onChange={
                  event =>
                    setMinimumEfficiency(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Diminishing-return tolerance %
              </span>

              <input
                type="number"
                min="10"
                max="100"
                step="0.01"
                value={diminishingTolerance}
                onChange={
                  event =>
                    setDiminishingTolerance(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field flywheel-form-wide">
              <span>
                Lineage objective
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

          <div className="flywheel-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !persistenceCaseId
                ||
                !ownerUserId
                ||
                maximumCycles <
                  1
                ||
                maximumCycles >
                  20
                ||
                !objective.trim()
              }
            >
              Create capital lineage
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Enterprise capital lineages
            </span>

            <h2>
              Multi-cycle flywheel
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
                <th>Lineage</th>
                <th>Status</th>
                <th>Health</th>
                <th>Cycles</th>
                <th>Original capital</th>
                <th>Cumulative net value</th>
                <th>Value multiple</th>
                <th>Marginal multiple</th>
                <th>Marginal retention</th>
                <th>Recommendation</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.lineages
                .map(
                  lineage => (
                    <tr
                      key={lineage.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {lineage.rootTargetInitiativeTitle}
                          </strong>

                          <span>
                            {lineage.lineageNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          lineage.status,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `flywheel-health flywheel-health--${lineage.flywheelHealth.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            lineage.flywheelHealth,
                          )}
                        </span>
                      </td>

                      <td>
                        {lineage.cycleCount}
                        {" / "}
                        {lineage.maximumCycleCount}
                      </td>

                      <td>
                        {money(
                          lineage.originalCapitalAmount,
                          lineage.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          lineage.cumulativeProjectedNetValueAmount,
                          lineage.currency,
                        )}
                      </td>

                      <td>
                        {lineage.cumulativeValueMultiple.toFixed(
                          2,
                        )}
                        x
                      </td>

                      <td>
                        {lineage.latestMarginalValueMultiple.toFixed(
                          2,
                        )}
                        x
                      </td>

                      <td>
                        {lineage.latestMarginalNetValueRetentionPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {readable(
                          lineage.recommendation,
                        )}
                      </td>

                      <td>
                        <Link
                          href={
                            `/capital-flywheel/${lineage.id}`
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
              Immutable flywheel portfolio
            </span>

            <h2>
              Portfolio snapshots
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
                <th>Lineages</th>
                <th>Cycles</th>
                <th>Review queue</th>
                <th>Next-cycle approvals</th>
                <th>Stopped</th>
                <th>Diminishing</th>
                <th>Value multiple</th>
                <th>Marginal multiple</th>
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
                        {snapshot.lineageCount}
                      </td>

                      <td>
                        {snapshot.totalCycleCount}
                      </td>

                      <td>
                        {snapshot.reviewPendingLineageCount}
                      </td>

                      <td>
                        {snapshot.approvedNextCycleLineageCount}
                      </td>

                      <td>
                        {snapshot.stoppedLineageCount}
                      </td>

                      <td>
                        {snapshot.diminishingReturnLineageCount}
                      </td>

                      <td>
                        {snapshot.averageCumulativeValueMultiple.toFixed(
                          2,
                        )}
                        x
                      </td>

                      <td>
                        {snapshot.averageLatestMarginalValueMultiple.toFixed(
                          2,
                        )}
                        x
                      </td>

                      <td>
                        <Link
                          href={
                            `/capital-flywheel/snapshots/${snapshot.id}`
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

      <section className="flywheel-method-note">
        <RefreshCcw
          size={18}
        />

        <div>
          <strong>
            A flywheel lineage measures compounding; it does not move capital
          </strong>

          <p>
            Each cycle is an immutable
            snapshot of a sustained Step 65
            outcome. Step 66 only governs
            whether another cycle is
            economically justified; actual
            allocation and release remain
            downstream governed actions.
          </p>
        </div>
      </section>
    </div>
  );
}
