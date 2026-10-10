"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Camera,
  CircleAlert,
  Gauge,
  Plus,
  UsersRound,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureCapacitySnapshot,
  createCapacityWorkEstimate,
  getCapacityPlanningDashboard,
  saveCapacityProfile,
} from "@/lib/api";

import type {
  CapacityPlanningDashboard,
  CapacitySourceType,
} from "@/types/capacity-planning";

import {
  type FormEvent,
  useEffect,
  useMemo,
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
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function CapacityPlanningPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapacityPlanningDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      new Date()
        .getUTCFullYear(),
    );

  const [
    profileUserId,
    setProfileUserId,
  ] =
    useState("");

  const [
    capacityHours,
    setCapacityHours,
  ] =
    useState(1800);

  const [
    reservedPct,
    setReservedPct,
  ] =
    useState(20);

  const [
    profileNotes,
    setProfileNotes,
  ] =
    useState("");

  const [
    sourceType,
    setSourceType,
  ] =
    useState<CapacitySourceType>(
      "CATEGORY_INITIATIVE",
    );

  const [
    sourceEntityId,
    setSourceEntityId,
  ] =
    useState("");

  const [
    effortHours,
    setEffortHours,
  ] =
    useState(80);

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

  useEffect(() => {
    let active = true;

    getCapacityPlanningDashboard(
      currency,
      fiscalYear,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          if (
            !profileUserId
            &&
            response.users[0]
          ) {
            setProfileUserId(
              response.users[0].id,
            );
          }

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load strategic capacity planning.",
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
    currency,
    fiscalYear,
    profileUserId,
  ]);

  async function reload() {
    setDashboard(
      await getCapacityPlanningDashboard(
        currency,
        fiscalYear,
      ),
    );
  }

  const estimateCandidates =
    useMemo(
      () =>
        dashboard
          ?.workItems
          .filter(
            item =>
              item.sourceType ===
                sourceType
              &&
              !item.estimateId,
          )
        ??
        [],
      [
        dashboard,
        sourceType,
      ],
    );

  async function saveProfile(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!profileUserId) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await saveCapacityProfile(
        profileUserId,
        fiscalYear,
        {
          annualCapacityHours:
            capacityHours,
          reservedOperationalPct:
            reservedPct,
          notes:
            profileNotes.trim()
            ||
            undefined,
        },
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save capacity profile.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createEstimate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!sourceEntityId) {
      setError(
        "Select a strategic work item.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createCapacityWorkEstimate({
        currency,
        fiscalYear,
        sourceType,
        sourceEntityId,
        estimatedEffortHours:
          effortHours,
      });

      setSourceEntityId("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create effort estimate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function capture() {
    try {
      setRunning(true);
      setError(null);

      await captureCapacitySnapshot(
        currency,
        fiscalYear,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture capacity snapshot.",
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
            Strategic resource planning
          </span>

          <h1>
            Capacity planning
          </h1>

          <p>
            Compare procurement-team
            capacity with aligned strategic
            demand, expose overload,
            assignment gaps and deadline
            pressure, and preserve
            executive capacity snapshots.
          </p>
        </div>

        <div className="capacity-heading-actions">
          <label className="capacity-filter">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event => {
                  setLoading(true);

                  setCurrency(
                    event.target.value,
                  );
                }
              }
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="TND">TND</option>
            </select>
          </label>

          <label className="capacity-filter">
            <span>
              Fiscal year
            </span>

            <input
              type="number"
              min="2000"
              max="2200"
              value={fiscalYear}
              onChange={
                event => {
                  setLoading(true);

                  setFiscalYear(
                    Number(
                      event.target.value,
                    ),
                  );
                }
              }
            />
          </label>

          {canManage ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void capture()
              }
            >
              <Camera
                size={15}
              />
              Capture snapshot
            </button>
          ) : null}
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

      <section className="capacity-score-grid">
        <article className="capacity-score-card">
          <span>
            Capacity score
          </span>

          <strong>
            {(
              summary
                ?.capacityScore ??
                0
            ).toFixed(1)}
          </strong>

          <small>
            {summary
              ? readable(
                  summary.portfolioHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Effective capacity
          </span>

          <strong>
            {(
              summary
                ?.effectiveCapacityHours ??
                0
            ).toFixed(0)}
            h
          </strong>
        </article>

        <article>
          <span>
            Estimated demand
          </span>

          <strong>
            {(
              summary
                ?.estimatedDemandHours ??
                0
            ).toFixed(0)}
            h
          </strong>
        </article>

        <article>
          <span>
            Capacity gap
          </span>

          <strong className="capacity-risk-text">
            {(
              summary
                ?.capacityGapHours ??
                0
            ).toFixed(0)}
            h
          </strong>
        </article>

        <article>
          <span>
            Assignment coverage
          </span>

          <strong>
            {(
              summary
                ?.assignmentCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Estimation coverage
          </span>

          <strong>
            {(
              summary
                ?.estimationCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>
      </section>

      <section className="capacity-signal-grid">
        <article>
          <span>
            Overloaded members
          </span>

          <strong className="capacity-risk-text">
            {summary
              ?.overloadedMemberCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Critical members
          </span>

          <strong className="capacity-risk-text">
            {summary
              ?.criticalMemberCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Deadline pressure
          </span>

          <strong className="capacity-risk-text">
            {summary
              ?.deadlinePressureCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Unassigned demand
          </span>

          <strong>
            {(
              summary
                ?.unassignedDemandHours ??
                0
            ).toFixed(0)}
            h
          </strong>
        </article>

        <article>
          <span>
            Capacity coverage
          </span>

          <strong>
            {(
              summary
                ?.capacityCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Team load
            </span>

            <h2>
              Capacity by owner
            </h2>
          </div>

          <UsersRound
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Effective capacity</th>
                <th>Assigned</th>
                <th>Remaining</th>
                <th>Overload</th>
                <th>Utilization</th>
                <th>Health</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.members
                  .map(
                    member => (
                      <tr
                        key={member.userId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {member.userName}
                            </strong>

                            <span>
                              {readable(
                                member.role,
                              )}
                              {" · "}
                              {member.reservedOperationalPct.toFixed(
                                0,
                              )}
                              % reserved
                            </span>
                          </div>
                        </td>

                        <td>
                          {member.effectiveCapacityHours.toFixed(
                            0,
                          )}
                          h
                        </td>

                        <td>
                          {member.assignedEffortHours.toFixed(
                            0,
                          )}
                          h
                        </td>

                        <td>
                          {member.remainingCapacityHours.toFixed(
                            0,
                          )}
                          h
                        </td>

                        <td>
                          <span
                            className={
                              member.overloadHours >
                              0
                                ? "capacity-risk-text"
                                : ""
                            }
                          >
                            {member.overloadHours.toFixed(
                              0,
                            )}
                            h
                          </span>
                        </td>

                        <td>
                          {member.utilizationPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          <span
                            className={
                              `capacity-health capacity-health--${member.health.toLowerCase()}`
                            }
                          >
                            {readable(
                              member.health,
                            )}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.members
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No capacity profiles
                    have been configured
                    for this fiscal year.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Strategic demand
            </span>

            <h2>
              Work capacity plan
            </h2>
          </div>

          <Gauge
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Work item</th>
                <th>Type</th>
                <th>Effort</th>
                <th>Allocation</th>
                <th>Unassigned</th>
                <th>Status</th>
                <th>Due</th>
                <th>Risk</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.workItems
                  .map(
                    item => (
                      <tr
                        key={
                          `${item.sourceType}:${item.sourceEntityId}`
                        }
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {item.sourceTitle}
                            </strong>

                            <span>
                              {item.sourceReference}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            item.sourceType,
                          )}
                        </td>

                        <td>
                          {item.estimateId
                            ? `${item.estimatedEffortHours.toFixed(0)}h`
                            : "—"}
                        </td>

                        <td>
                          {item.estimateId
                            ? `${item.allocationPct.toFixed(0)}%`
                            : "—"}
                        </td>

                        <td>
                          {item.estimateId
                            ? `${item.unassignedEffortHours.toFixed(0)}h`
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={
                              `capacity-work-status capacity-work-status--${item.planningStatus.toLowerCase()}`
                            }
                          >
                            {readable(
                              item.planningStatus,
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              item.deadlinePressure
                                ? "capacity-risk-text"
                                : ""
                            }
                          >
                            {item.dueDate ??
                              "—"}
                          </span>
                        </td>

                        <td>
                          {item.riskScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {item.estimateId ? (
                            <Link
                              href={
                                `/capacity-planning/work/${item.estimateId}`
                              }
                              className="table-action"
                            >
                              Plan
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ),
                  )}
            </tbody>
          </SmartTable>
        </div>
      </section>

      {canManage ? (
        <section className="capacity-form-grid">
          <form
            className="panel"
            onSubmit={saveProfile}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Supply
                </span>

                <h2>
                  Capacity profile
                </h2>
              </div>

              <UsersRound
                size={19}
              />
            </div>

            <div className="capacity-form-fields">
              <label className="request-field">
                <span>
                  Team member
                </span>

                <select
                  value={profileUserId}
                  onChange={
                    event =>
                      setProfileUserId(
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
                  Annual capacity hours
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={capacityHours}
                  onChange={
                    event =>
                      setCapacityHours(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Operational reserve %
                </span>

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={reservedPct}
                  onChange={
                    event =>
                      setReservedPct(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Notes
                </span>

                <textarea
                  rows={4}
                  value={profileNotes}
                  onChange={
                    event =>
                      setProfileNotes(
                        event.target.value,
                      )
                  }
                />
              </label>

              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !profileUserId
                }
              >
                Save profile
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={createEstimate}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Demand
                </span>

                <h2>
                  Estimate strategic work
                </h2>
              </div>

              <Plus
                size={19}
              />
            </div>

            <div className="capacity-form-fields">
              <label className="request-field">
                <span>
                  Work type
                </span>

                <select
                  value={sourceType}
                  onChange={
                    event => {
                      setSourceType(
                        event.target.value as
                          CapacitySourceType,
                      );

                      setSourceEntityId("");
                    }
                  }
                >
                  <option value="CATEGORY_INITIATIVE">
                    Category initiative
                  </option>

                  <option value="IMPROVEMENT_INITIATIVE">
                    Improvement initiative
                  </option>

                  <option value="EXECUTION_PORTFOLIO">
                    Execution portfolio
                  </option>

                  <option value="RISK_ESCALATION">
                    Risk escalation
                  </option>
                </select>
              </label>

              <label className="request-field">
                <span>
                  Strategic work item
                </span>

                <select
                  value={sourceEntityId}
                  onChange={
                    event =>
                      setSourceEntityId(
                        event.target.value,
                      )
                  }
                >
                  <option value="">
                    Select work item
                  </option>

                  {estimateCandidates.map(
                    item => (
                      <option
                        key={item.sourceEntityId}
                        value={item.sourceEntityId}
                      >
                        {item.sourceReference}
                        {" — "}
                        {item.sourceTitle}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Estimated effort hours
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="1"
                  value={effortHours}
                  onChange={
                    event =>
                      setEffortHours(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !sourceEntityId
                }
              >
                Create estimate
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capacity-only scenario
            </span>

            <h2>
              Rebalancing opportunities
            </h2>
          </div>
        </div>

        <div className="capacity-rebalance-list">
          {dashboard
            ?.rebalancingSuggestions
            .map(
              (
                suggestion,
                index,
              ) => (
                <article
                  key={
                    `${suggestion.fromUserId}:${suggestion.toUserId}:${index}`
                  }
                >
                  <strong>
                    {suggestion.fromUserName}
                    {" → "}
                    {suggestion.toUserName}
                  </strong>

                  <span>
                    Up to
                    {" "}
                    {suggestion.suggestedHours.toFixed(
                      0,
                    )}
                    h
                  </span>

                  <p>
                    {suggestion.rationale}
                  </p>
                </article>
              ),
            )}

          {(
            dashboard
              ?.rebalancingSuggestions
              .length ??
            0
          ) ===
            0 ? (
            <div className="capacity-empty">
              No capacity-only
              rebalancing opportunity is
              currently detected.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Executive history
            </span>

            <h2>
              Immutable capacity snapshots
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
                <th>Score</th>
                <th>Health</th>
                <th>Capacity</th>
                <th>Demand</th>
                <th>Gap</th>
                <th>Overloaded</th>
                <th>Captured</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
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
                          {snapshot.capacityScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {readable(
                            snapshot.portfolioHealth,
                          )}
                        </td>

                        <td>
                          {snapshot.effectiveCapacityHours.toFixed(
                            0,
                          )}
                          h
                        </td>

                        <td>
                          {snapshot.estimatedDemandHours.toFixed(
                            0,
                          )}
                          h
                        </td>

                        <td>
                          {snapshot.capacityGapHours.toFixed(
                            0,
                          )}
                          h
                        </td>

                        <td>
                          {snapshot.overloadedMemberCount}
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
                              `/capacity-planning/snapshots/${snapshot.id}`
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

      <section className="capacity-method-note">
        <Gauge
          size={18}
        />

        <div>
          <strong>
            Capacity scenarios are advisory
          </strong>

          <p>
            Rebalancing suggestions use
            available hours only. They do
            not infer skills, authority,
            continuity or domain
            suitability and never perform
            automatic reassignment.
          </p>
        </div>
      </section>
    </div>
  );
}
