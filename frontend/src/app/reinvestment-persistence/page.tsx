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
  captureReinvestmentPersistenceSnapshot,
  createReinvestmentPersistenceCase,
  getReinvestmentPersistenceDashboard,
} from "@/lib/api";

import type {
  ReinvestmentPersistenceDashboard,
} from "@/types/reinvestment-persistence";

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

export default function ReinvestmentPersistencePage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      ReinvestmentPersistenceDashboard |
      null
    >(null);

  const [
    performanceCaseId,
    setPerformanceCaseId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    observationWindowMonths,
    setObservationWindowMonths,
  ] =
    useState(0);

  const [
    minimumPersistence,
    setMinimumPersistence,
  ] =
    useState(90);

  const [
    minimumEfficiency,
    setMinimumEfficiency,
  ] =
    useState(90);

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

    getReinvestmentPersistenceDashboard()
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
            setPerformanceCaseId(
              response.candidates[0].sourcePerformanceCaseId,
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
                : "Unable to load reinvestment-persistence governance.",
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
      await getReinvestmentPersistenceDashboard(),
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

      await createReinvestmentPersistenceCase(
        performanceCaseId,
        {
          persistenceOwnerUserId:
            ownerUserId,

          persistenceObservationWindowMonths:
            observationWindowMonths,

          minimumValuePersistencePct:
            minimumPersistence,

          minimumEfficiencyRetentionPct:
            minimumEfficiency,

          persistenceObjective:
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
          : "Unable to create reinvestment-persistence case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureReinvestmentPersistenceSnapshot();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture reinvestment-persistence snapshot.",
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
            Longitudinal recycled-capital value
          </span>

          <h1>
            Reinvestment persistence
          </h1>

          <p>
            Determine whether value created
            by recycled capital persists,
            compounds or decays after the
            initial Step 64 performance
            assessment.
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

      <section className="rpersist-score-grid">
        <article>
          <span>
            Eligible cases
          </span>

          <strong>
            {summary?.candidateCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Persistence cases
          </span>

          <strong>
            {summary?.caseCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Compounding
          </span>

          <strong>
            {summary?.compoundingCaseCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Sustained
          </span>

          <strong>
            {summary?.sustainedCaseCount ?? 0}
          </strong>
        </article>

        <article>
          <span>
            Regessed / remediation
          </span>

          <strong className="rpersist-risk-text">
            {(summary?.regressedCaseCount ?? 0)
              +
              (summary?.remediationCaseCount ?? 0)}
          </strong>
        </article>

        <article className="rpersist-score-card">
          <span>
            Avg persistence
          </span>

          <strong>
            {(summary?.averageValuePersistencePct ?? 0).toFixed(
              1,
            )}
            %
          </strong>
        </article>
      </section>

      <section className="rpersist-value-grid">
        <article>
          <span>
            Efficiency retention
          </span>

          <strong>
            {(summary?.averageEfficiencyRetentionPct ?? 0).toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Projected ROI
          </span>

          <strong>
            {(summary?.averageProjectedRoiPct ?? 0).toFixed(
              1,
            )}
            %
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
              Verified Step 64 value creation
            </span>

            <h2>
              Persistence candidates
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
                <th>Step 64 health</th>
                <th>Capital</th>
                <th>Annualized value</th>
                <th>Horizon value</th>
                <th>Net value</th>
                <th>ROI</th>
                <th>Realization</th>
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
                        key={candidate.sourcePerformanceCaseId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.targetInitiativeTitle}
                            </strong>

                            <span>
                              {candidate.sourcePerformanceCaseNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            candidate.baselinePerformanceHealth,
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
                            candidate.baselineValidatedAnnualizedValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.baselineRealizedHorizonValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {money(
                            candidate.baselineRealizedNetValueAmount,
                            candidate.currency,
                          )}
                        </td>

                        <td>
                          {candidate.baselineRealizedRoiPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {candidate.baselineRealizationPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          <Link
                            href={
                              `/reinvestment-performance/${candidate.sourcePerformanceCaseId}`
                            }
                            className="table-action"
                          >
                            Step 64 evidence
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
                    No verified Step 64
                    reinvestment-performance
                    case is awaiting
                    persistence governance.
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
                Persistence baseline
              </span>

              <h2>
                Open persistence case
              </h2>
            </div>
          </div>

          <div className="rpersist-case-form">
            <label className="request-field rpersist-form-wide">
              <span>
                Step 64 performance case
              </span>

              <select
                value={performanceCaseId}
                onChange={
                  event =>
                    setPerformanceCaseId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.sourcePerformanceCaseId}
                        value={candidate.sourcePerformanceCaseId}
                      >
                        {candidate.sourcePerformanceCaseNumber}
                        {" — "}
                        {candidate.targetInitiativeTitle}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Persistence owner
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
                Observation window months
              </span>

              <input
                type="number"
                min="0"
                max="36"
                value={observationWindowMonths}
                onChange={
                  event =>
                    setObservationWindowMonths(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Minimum value persistence %
              </span>

              <input
                type="number"
                min="50"
                max="100"
                step="0.01"
                value={minimumPersistence}
                onChange={
                  event =>
                    setMinimumPersistence(
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
                max="100"
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

            <label className="request-field rpersist-form-wide">
              <span>
                Persistence objective
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

          <div className="rpersist-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !performanceCaseId
                ||
                !ownerUserId
                ||
                minimumPersistence <
                  50
                ||
                minimumPersistence >
                  100
                ||
                minimumEfficiency <
                  50
                ||
                minimumEfficiency >
                  100
                ||
                !objective.trim()
              }
            >
              Open persistence case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capital recycling effectiveness
            </span>

            <h2>
              Persistence cases
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Status</th>
                <th>Health</th>
                <th>Baseline ROI</th>
                <th>Projected ROI</th>
                <th>Persistence</th>
                <th>Efficiency retention</th>
                <th>Compounding</th>
                <th>Decay</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  persistenceCase => (
                    <tr
                      key={persistenceCase.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {persistenceCase.targetInitiativeTitle}
                          </strong>

                          <span>
                            {persistenceCase.persistenceCaseNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          persistenceCase.status,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `rpersist-health rpersist-health--${persistenceCase.health.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            persistenceCase.health,
                          )}
                        </span>
                      </td>

                      <td>
                        {persistenceCase.baselineRealizedRoiPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {persistenceCase.assessed
                          ? `${persistenceCase.currentProjectedRoiPct.toFixed(1)}%`
                          : "—"}
                      </td>

                      <td>
                        {persistenceCase.assessed
                          ? `${persistenceCase.valuePersistencePct.toFixed(1)}%`
                          : "—"}
                      </td>

                      <td>
                        {persistenceCase.assessed
                          ? `${persistenceCase.efficiencyRetentionPct.toFixed(1)}%`
                          : "—"}
                      </td>

                      <td>
                        {persistenceCase.assessed
                          ? money(
                              persistenceCase.compoundingValueAmount,
                              persistenceCase.currency,
                            )
                          : "—"}
                      </td>

                      <td>
                        {persistenceCase.assessed
                          ? money(
                              persistenceCase.decayedValueAmount,
                              persistenceCase.currency,
                            )
                          : "—"}
                      </td>

                      <td>
                        <Link
                          href={
                            `/reinvestment-persistence/${persistenceCase.id}`
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
              Immutable persistence portfolio
            </span>

            <h2>
              Persistence snapshots
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
                <th>Compounding</th>
                <th>Sustained</th>
                <th>Watch</th>
                <th>Decaying</th>
                <th>Regressed</th>
                <th>Persistence</th>
                <th>Efficiency</th>
                <th>Projected ROI</th>
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
                        {snapshot.compoundingCaseCount}
                      </td>

                      <td>
                        {snapshot.sustainedCaseCount}
                      </td>

                      <td>
                        {snapshot.watchCaseCount}
                      </td>

                      <td>
                        {snapshot.decayingCaseCount}
                      </td>

                      <td>
                        {snapshot.regressedCaseCount}
                      </td>

                      <td>
                        {snapshot.averageValuePersistencePct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {snapshot.averageEfficiencyRetentionPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {snapshot.averageProjectedRoiPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        <Link
                          href={
                            `/reinvestment-persistence/snapshots/${snapshot.id}`
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

      <section className="rpersist-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Persistence measures durable value, not another capital movement
          </strong>

          <p>
            Step 65 observes whether the
            value generated after
            redeployment remains durable,
            compounds or decays. It never
            creates another release,
            allocation or upstream value
            mutation.
          </p>
        </div>
      </section>
    </div>
  );
}
