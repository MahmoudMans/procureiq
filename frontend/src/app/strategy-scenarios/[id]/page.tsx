"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Goal,
  Play,
  Trash2,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  approveStrategyScenario,
  archiveStrategyScenario,
  deleteStrategyScenarioAssumption,
  evaluateStrategyScenario,
  getStrategyScenario,
  upsertStrategyScenarioAssumption,
} from "@/lib/api";

import type {
  BoardDimensionKey,
} from "@/types/strategy-cockpit";

import type {
  StrategyScenarioDetail,
} from "@/types/strategy-scenario";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

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

function signed(
  value: number,
): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

const dimensions: Array<{
  key: BoardDimensionKey;
  label: string;
}> = [
  {
    key:
      "OBJECTIVE_EXECUTION",
    label:
      "Objective execution",
  },
  {
    key:
      "STRATEGIC_ALIGNMENT",
    label:
      "Strategic alignment",
  },
  {
    key:
      "CAPACITY_READINESS",
    label:
      "Capacity readiness",
  },
  {
    key:
      "CAPABILITY_READINESS",
    label:
      "Capability readiness",
  },
  {
    key:
      "SUCCESSION_RESILIENCE",
    label:
      "Succession resilience",
  },
];

export default function StrategyScenarioPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      StrategyScenarioDetail |
      null
    >(null);

  const [
    dimensionKey,
    setDimensionKey,
  ] =
    useState<BoardDimensionKey>(
      "OBJECTIVE_EXECUTION",
    );

  const [
    adjustmentPoints,
    setAdjustmentPoints,
  ] =
    useState(5);

  const [
    rationale,
    setRationale,
  ] =
    useState("");

  const [
    decisionNote,
    setDecisionNote,
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

  const canFinalize =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getStrategyScenario(
      params.id,
    )
      .then(
        response => {
          if (active) {
            setDetail(
              response,
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
                : "Unable to load strategy scenario.",
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
  }, [
    params.id,
  ]);

  async function reload() {
    setDetail(
      await getStrategyScenario(
        params.id,
      ),
    );
  }

  async function saveAssumption(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!rationale.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await upsertStrategyScenarioAssumption(
          params.id,
          {
            dimensionKey,
            adjustmentPoints,
            rationale:
              rationale.trim(),
          },
        ),
      );

      setRationale("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save strategy assumption.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function removeAssumption(
    assumptionId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await deleteStrategyScenarioAssumption(
        assumptionId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to remove strategy assumption.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function evaluate() {
    try {
      setRunning(true);
      setError(null);

      await evaluateStrategyScenario(
        params.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to evaluate strategy scenario.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function finalize(
    action:
      "APPROVE"
      |
      "ARCHIVE",
  ) {
    if (!decisionNote.trim()) {
      setError(
        "A governed decision note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
          "APPROVE"
      ) {
        setDetail(
          await approveStrategyScenario(
            params.id,
            decisionNote,
          ),
        );
      } else {
        setDetail(
          await archiveStrategyScenario(
            params.id,
            decisionNote,
          ),
        );
      }

      setDecisionNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to finalize strategy scenario.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading strategy scenario...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-scenarios"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategy scenarios
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Strategy scenario not found."}
        </div>
      </div>
    );
  }

  const editable =
    detail.scenario.status !==
      "APPROVED"
    &&
    detail.scenario.status !==
      "ARCHIVED";

  return (
    <div className="page-stack">
      <Link
        href="/strategy-scenarios"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategy scenarios
      </Link>

      <section className="scenario-detail-heading">
        <div>
          <span className="eyebrow">
            What-if scenario
          </span>

          <h1>
            {detail.scenario.name}
          </h1>

          <p>
            {detail.scenario.scenarioNumber}
            {" · FY "}
            {detail.scenario.fiscalYear}
            {" · "}
            {detail.scenario.currency}
          </p>
        </div>

        <span
          className={
            `scenario-status scenario-status--${detail.scenario.status.toLowerCase()}`
          }
        >
          {readable(
            detail.scenario.status,
          )}
        </span>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="scenario-comparison-hero">
        <article>
          <span>
            Frozen baseline
          </span>

          <strong>
            {detail.scenario.baselineOverallScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.scenario.baselineHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Latest simulation
          </span>

          <strong>
            {detail.scenario.latestSimulatedScore ===
            null
              ? "—"
              : detail.scenario.latestSimulatedScore.toFixed(
                  1,
                )}
          </strong>

          <small>
            {detail.scenario.latestSimulatedHealth
              ? readable(
                  detail.scenario.latestSimulatedHealth,
                )
              : "Not evaluated"}
          </small>
        </article>

        <article>
          <span>
            Score delta
          </span>

          <strong
            className={
              (
                detail.scenario.latestDelta ??
                0
              ) >
              0
                ? "scenario-positive"
                : (
                    detail.scenario.latestDelta ??
                    0
                  ) <
                  0
                ? "scenario-negative"
                : ""
            }
          >
            {detail.scenario.latestDelta ===
            null
              ? "—"
              : signed(
                  detail.scenario.latestDelta,
                )}
          </strong>

          <small>
            {detail.scenario.latestMovement
              ? readable(
                  detail.scenario.latestMovement,
                )
              : "—"}
          </small>
        </article>
      </section>

      {detail.scenario.description ? (
        <section className="panel scenario-description">
          <p>
            {detail.scenario.description}
          </p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Explicit planning assumptions
            </span>

            <h2>
              Dimension adjustments
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="scenario-assumption-list">
          {detail.assumptions.map(
            assumption => (
              <article
                key={assumption.id}
              >
                <div>
                  <strong>
                    {assumption.dimensionLabel}
                  </strong>

                  <span
                    className={
                      assumption.adjustmentPoints >
                      0
                        ? "scenario-positive"
                        : assumption.adjustmentPoints <
                          0
                        ? "scenario-negative"
                        : ""
                    }
                  >
                    {signed(
                      assumption.adjustmentPoints,
                    )}
                    {" pts"}
                  </span>
                </div>

                <p>
                  {assumption.rationale}
                </p>

                <small>
                  Updated by
                  {" "}
                  {assumption.updatedByName}
                </small>

                {canManage &&
                editable ? (
                  <button
                    type="button"
                    className="scenario-danger-button"
                    disabled={running}
                    onClick={
                      () =>
                        void removeAssumption(
                          assumption.id,
                        )
                    }
                  >
                    <Trash2
                      size={13}
                    />
                    Remove
                  </button>
                ) : null}
              </article>
            ),
          )}

          {detail.assumptions.length ===
          0 ? (
            <div className="scenario-empty">
              No assumptions have been
              defined.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      editable ? (
        <form
          className="panel"
          onSubmit={saveAssumption}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Scenario modeling
              </span>

              <h2>
                Add or update assumption
              </h2>
            </div>
          </div>

          <div className="scenario-assumption-form">
            <label className="request-field">
              <span>
                Dimension
              </span>

              <select
                value={dimensionKey}
                onChange={
                  event =>
                    setDimensionKey(
                      event.target.value as
                        BoardDimensionKey,
                    )
                }
              >
                {dimensions.map(
                  dimension => (
                    <option
                      key={dimension.key}
                      value={dimension.key}
                    >
                      {dimension.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Adjustment points
              </span>

              <input
                type="number"
                min="-100"
                max="100"
                step="0.1"
                value={adjustmentPoints}
                onChange={
                  event =>
                    setAdjustmentPoints(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field scenario-assumption-wide">
              <span>
                Rationale
              </span>

              <textarea
                required
                rows={5}
                maxLength={3000}
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

          <div className="scenario-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !rationale.trim()
              }
            >
              Save assumption
            </button>
          </div>
        </form>
      ) : null}

      {canManage &&
      editable ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Deterministic simulation
              </span>

              <h2>
                Evaluate scenario
              </h2>
            </div>

            <Play
              size={19}
            />
          </div>

          <p className="scenario-evaluation-copy">
            Evaluation applies every
            governed assumption to the
            frozen baseline, clamps each
            dimension to 0–100, applies
            the Step 50 board weights,
            and stores an immutable
            evaluation.
          </p>

          <div className="scenario-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                detail.assumptions.length ===
                  0
              }
              onClick={
                () =>
                  void evaluate()
              }
            >
              <Play
                size={15}
              />
              Evaluate scenario
            </button>
          </div>
        </section>
      ) : null}

      {detail.latestEvaluation ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Latest immutable evaluation
              </span>

              <h2>
                {detail.latestEvaluation.evaluation.evaluationNumber}
              </h2>
            </div>

            <Link
              href={
                `/strategy-scenarios/evaluations/${detail.latestEvaluation.evaluation.id}`
              }
              className="table-action"
            >
              Open frozen evaluation
            </Link>
          </div>

          <p className="scenario-evaluation-summary">
            {detail.latestEvaluation.generatedSummary}
          </p>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th>Weight</th>
                  <th>Baseline</th>
                  <th>Adjustment</th>
                  <th>Simulated</th>
                  <th>Health</th>
                </tr>
              </thead>

              <tbody>
                {detail
                  .latestEvaluation
                  .dimensions
                  .map(
                    dimension => (
                      <tr
                        key={dimension.dimensionKey}
                      >
                        <td>
                          <strong>
                            {dimension.dimensionLabel}
                          </strong>
                        </td>

                        <td>
                          {dimension.weightPct.toFixed(
                            0,
                          )}
                          %
                        </td>

                        <td>
                          {dimension.baselineScore.toFixed(
                            1,
                          )}
                        </td>

                        <td
                          className={
                            dimension.adjustmentPoints >
                            0
                              ? "scenario-positive"
                              : dimension.adjustmentPoints <
                                0
                              ? "scenario-negative"
                              : ""
                          }
                        >
                          {signed(
                            dimension.adjustmentPoints,
                          )}
                        </td>

                        <td>
                          {dimension.simulatedScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {readable(
                            dimension.health,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      (
        detail.scenario.status ===
          "EVALUATED"
        ||
        detail.scenario.status ===
          "APPROVED"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Planning governance
              </span>

              <h2>
                Decision
              </h2>
            </div>

            <BadgeCheck
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Governed decision note
            </span>

            <textarea
              rows={5}
              maxLength={4000}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="scenario-decision-actions">
            {detail.scenario.status ===
            "EVALUATED" ? (
              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !decisionNote.trim()
                }
                onClick={
                  () =>
                    void finalize(
                      "APPROVE",
                    )
                }
              >
                Approve planning scenario
              </button>
            ) : null}

            <button
              type="button"
              className="scenario-archive-button"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void finalize(
                    "ARCHIVE",
                  )
              }
            >
              Archive scenario
            </button>
          </div>
        </section>
      ) : null}

      {detail.scenario.approvalNote ? (
        <section className="scenario-governance-note">
          <strong>
            Approved planning scenario
          </strong>

          <p>
            {detail.scenario.approvalNote}
          </p>

          <small>
            Approved by
            {" "}
            {detail.scenario.approvedByName}
          </small>
        </section>
      ) : null}

      <section className="scenario-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Approval does not execute the scenario
          </strong>

          <p>
            Approved scenarios are
            governed planning records
            only. They do not alter Step
            50 board evidence, OKRs,
            capacity, assignments,
            capability assessments or
            succession decisions.
          </p>
        </div>
      </section>
    </div>
  );
}
