"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Goal,
  Plus,
  Trash2,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  activateStrategyRoadmap,
  archiveStrategyRoadmap,
  cancelRoadmapInitiative,
  cancelRoadmapMilestone,
  captureStrategyRoadmapSnapshot,
  completeRoadmapInitiative,
  completeRoadmapMilestone,
  completeStrategyRoadmap,
  createRoadmapDependency,
  createRoadmapGate,
  createRoadmapInitiative,
  createRoadmapMilestone,
  decideRoadmapGate,
  deleteRoadmapDependency,
  getStrategyRoadmap,
  holdStrategyRoadmap,
  startRoadmapInitiative,
} from "@/lib/api";

import type {
  BoardDimensionKey,
} from "@/types/strategy-cockpit";

import type {
  RoadmapDependencyType,
  RoadmapGateStatus,
  RoadmapPriority,
  StrategyRoadmapDetail,
} from "@/types/strategy-roadmap";

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
  return value > 0
    ? `+${value.toFixed(1)}`
    : value.toFixed(1);
}

const dimensionOptions: Array<{
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

export default function StrategyRoadmapPage() {
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
      StrategyRoadmapDetail |
      null
    >(null);

  const [
    initiativeTitle,
    setInitiativeTitle,
  ] =
    useState("");

  const [
    initiativeDescription,
    setInitiativeDescription,
  ] =
    useState("");

  const [
    dimensionKey,
    setDimensionKey,
  ] =
    useState<BoardDimensionKey>(
      "OBJECTIVE_EXECUTION",
    );

  const [
    priority,
    setPriority,
  ] =
    useState<RoadmapPriority>(
      "HIGH",
    );

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    initiativeStart,
    setInitiativeStart,
  ] =
    useState("");

  const [
    initiativeEnd,
    setInitiativeEnd,
  ] =
    useState("");

  const [
    contribution,
    setContribution,
  ] =
    useState(5);

  const [
    predecessorId,
    setPredecessorId,
  ] =
    useState("");

  const [
    successorId,
    setSuccessorId,
  ] =
    useState("");

  const [
    dependencyType,
    setDependencyType,
  ] =
    useState<RoadmapDependencyType>(
      "FINISH_TO_START",
    );

  const [
    dependencyRationale,
    setDependencyRationale,
  ] =
    useState("");

  const [
    selectedInitiativeId,
    setSelectedInitiativeId,
  ] =
    useState("");

  const [
    milestoneTitle,
    setMilestoneTitle,
  ] =
    useState("");

  const [
    milestoneDue,
    setMilestoneDue,
  ] =
    useState("");

  const [
    gateName,
    setGateName,
  ] =
    useState("");

  const [
    gateDue,
    setGateDue,
  ] =
    useState("");

  const [
    gateNotes,
    setGateNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

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

    getStrategyRoadmap(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDetail(
            response,
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

          if (
            !initiativeStart
          ) {
            setInitiativeStart(
              response.roadmap.startDate,
            );
          }

          if (
            !initiativeEnd
          ) {
            setInitiativeEnd(
              response.roadmap.targetEndDate,
            );
          }

          if (
            !milestoneDue
          ) {
            setMilestoneDue(
              response.roadmap.targetEndDate,
            );
          }

          if (
            !gateDue
          ) {
            setGateDue(
              response.roadmap.targetEndDate,
            );
          }

          if (
            !selectedInitiativeId
            &&
            response.initiatives[0]
          ) {
            setSelectedInitiativeId(
              response.initiatives[0].id,
            );
          }

          if (
            !predecessorId
            &&
            response.initiatives[0]
          ) {
            setPredecessorId(
              response.initiatives[0].id,
            );
          }

          if (
            !successorId
            &&
            response.initiatives[1]
          ) {
            setSuccessorId(
              response.initiatives[1].id,
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
                : "Unable to load strategy roadmap.",
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
    ownerUserId,
    initiativeStart,
    initiativeEnd,
    milestoneDue,
    gateDue,
    selectedInitiativeId,
    predecessorId,
    successorId,
  ]);

  async function reload() {
    setDetail(
      await getStrategyRoadmap(
        params.id,
      ),
    );
  }

  async function roadmapAction(
    action:
      "ACTIVATE"
      |
      "HOLD"
      |
      "COMPLETE"
      |
      "ARCHIVE",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
          "ACTIVATE"
      ) {
        setDetail(
          await activateStrategyRoadmap(
            params.id,
          ),
        );
      } else if (
        action ===
          "HOLD"
      ) {
        setDetail(
          await holdStrategyRoadmap(
            params.id,
          ),
        );
      } else if (
        action ===
          "COMPLETE"
      ) {
        setDetail(
          await completeStrategyRoadmap(
            params.id,
          ),
        );
      } else {
        setDetail(
          await archiveStrategyRoadmap(
            params.id,
          ),
        );
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update roadmap status.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addInitiative(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await createRoadmapInitiative(
          params.id,
          {
            title:
              initiativeTitle.trim(),
            description:
              initiativeDescription.trim()
              ||
              undefined,
            dimensionKey,
            priority,
            ownerUserId,
            plannedStartDate:
              initiativeStart,
            plannedEndDate:
              initiativeEnd,
            plannedContributionPoints:
              contribution,
          },
        ),
      );

      setInitiativeTitle("");
      setInitiativeDescription("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add roadmap initiative.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function initiativeAction(
    initiativeId: string,
    action:
      "START"
      |
      "COMPLETE"
      |
      "CANCEL",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
          "START"
      ) {
        setDetail(
          await startRoadmapInitiative(
            initiativeId,
          ),
        );
      } else if (
        action ===
          "COMPLETE"
      ) {
        setDetail(
          await completeRoadmapInitiative(
            initiativeId,
          ),
        );
      } else {
        setDetail(
          await cancelRoadmapInitiative(
            initiativeId,
          ),
        );
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update roadmap initiative.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addDependency(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !predecessorId
      ||
      !successorId
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await createRoadmapDependency(
          params.id,
          {
            predecessorInitiativeId:
              predecessorId,
            successorInitiativeId:
              successorId,
            dependencyType,
            rationale:
              dependencyRationale.trim()
              ||
              undefined,
          },
        ),
      );

      setDependencyRationale("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create roadmap dependency.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function removeDependency(
    dependencyId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await deleteRoadmapDependency(
        dependencyId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to remove roadmap dependency.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addMilestone(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedInitiativeId
      ||
      !milestoneTitle.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await createRoadmapMilestone(
          selectedInitiativeId,
          {
            title:
              milestoneTitle.trim(),
            dueDate:
              milestoneDue,
          },
        ),
      );

      setMilestoneTitle("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create roadmap milestone.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function milestoneAction(
    milestoneId: string,
    action:
      "COMPLETE"
      |
      "CANCEL",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
          "COMPLETE"
      ) {
        setDetail(
          await completeRoadmapMilestone(
            milestoneId,
          ),
        );
      } else {
        setDetail(
          await cancelRoadmapMilestone(
            milestoneId,
          ),
        );
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update roadmap milestone.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addGate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedInitiativeId
      ||
      !gateName.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await createRoadmapGate(
          selectedInitiativeId,
          {
            gateName:
              gateName.trim(),
            dueDate:
              gateDue,
          },
        ),
      );

      setGateName("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create roadmap gate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function gateDecision(
    gateId: string,
    decision:
      Exclude<
        RoadmapGateStatus,
        "PENDING"
      >,
  ) {
    const note =
      gateNotes[
        gateId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Decision-gate note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await decideRoadmapGate(
          gateId,
          decision,
          note,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to decide roadmap gate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureSnapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureStrategyRoadmapSnapshot(
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
          : "Unable to capture roadmap snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading strategy roadmap...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategy-roadmaps"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategy roadmaps
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Strategy roadmap not found."}
        </div>
      </div>
    );
  }

  const mutable =
    detail.roadmap.status !==
      "COMPLETED"
    &&
    detail.roadmap.status !==
      "ARCHIVED";

  return (
    <div className="page-stack">
      <Link
        href="/strategy-roadmaps"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategy roadmaps
      </Link>

      <section className="roadmap-detail-heading">
        <div>
          <span className="eyebrow">
            Governed strategy implementation
          </span>

          <h1>
            {detail.roadmap.title}
          </h1>

          <p>
            {detail.roadmap.roadmapNumber}
            {" · "}
            {detail.roadmap.sourceScenarioNumber}
            {" · FY "}
            {detail.roadmap.fiscalYear}
          </p>
        </div>

        <span
          className={
            `roadmap-status roadmap-status--${detail.roadmap.status.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            detail.roadmap.status,
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

      <section className="roadmap-score-grid">
        <article className="roadmap-score-card">
          <span>
            Readiness score
          </span>

          <strong>
            {detail.roadmap.readinessScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              detail.roadmap.readinessHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Dependency health
          </span>

          <strong>
            {detail.roadmap.dependencyHealthPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Milestone health
          </span>

          <strong>
            {detail.roadmap.milestoneHealthPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Gate health
          </span>

          <strong>
            {detail.roadmap.gateHealthPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Blocked initiatives
          </span>

          <strong className="roadmap-risk-text">
            {detail.roadmap.blockedInitiativeCount}
          </strong>
        </article>

        <article>
          <span>
            Scenario uplift
          </span>

          <strong
            className={
              detail.roadmap.scenarioDelta >
              0
                ? "roadmap-positive"
                : detail.roadmap.scenarioDelta <
                  0
                ? "roadmap-negative"
                : ""
            }
          >
            {signed(
              detail.roadmap.scenarioDelta,
            )}
          </strong>
        </article>
      </section>

      <section className="panel roadmap-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Implementation objective
            </span>

            <h2>
              Scenario commitment
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p>
          {detail.roadmap.objective}
        </p>
      </section>

      {canManage ? (
        <section className="roadmap-governance-actions">
          {detail.roadmap.status ===
            "DRAFT"
          ||
          detail.roadmap.status ===
            "ON_HOLD" ? (
            <button
              type="button"
              disabled={running}
              onClick={
                () =>
                  void roadmapAction(
                    "ACTIVATE",
                  )
              }
            >
              Activate
            </button>
          ) : null}

          {detail.roadmap.status ===
          "ACTIVE" ? (
            <button
              type="button"
              disabled={running}
              onClick={
                () =>
                  void roadmapAction(
                    "HOLD",
                  )
              }
            >
              Put on hold
            </button>
          ) : null}

          <button
            type="button"
            disabled={running}
            onClick={
              () =>
                void captureSnapshot()
            }
          >
            <Camera
              size={13}
            />
            Capture snapshot
          </button>

          {canFinalize &&
          (
            detail.roadmap.status ===
              "ACTIVE"
            ||
            detail.roadmap.status ===
              "ON_HOLD"
          ) ? (
            <button
              type="button"
              disabled={running}
              onClick={
                () =>
                  void roadmapAction(
                    "COMPLETE",
                  )
              }
            >
              Complete roadmap
            </button>
          ) : null}

          {canFinalize &&
          detail.roadmap.status !==
            "ARCHIVED" ? (
            <button
              type="button"
              className="roadmap-danger-button"
              disabled={running}
              onClick={
                () =>
                  void roadmapAction(
                    "ARCHIVE",
                  )
              }
            >
              Archive
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Initiative sequencing
            </span>

            <h2>
              Proposed roadmap initiatives
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Dimension</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Contribution</th>
                <th>Dependencies</th>
                <th>Milestones</th>
                <th>Gates</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {detail.initiatives.map(
                initiative => (
                  <tr
                    key={initiative.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {initiative.title}
                        </strong>

                        <span>
                          {initiative.initiativeNumber}
                          {" · "}
                          {initiative.plannedStartDate}
                          {" → "}
                          {initiative.plannedEndDate}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        initiative.dimensionKey,
                      )}
                    </td>

                    <td>
                      {readable(
                        initiative.priority,
                      )}
                    </td>

                    <td>
                      {initiative.ownerName}
                    </td>

                    <td>
                      <span
                        className={
                          initiative.blocked
                            ? "roadmap-blocked"
                            : ""
                        }
                      >
                        {readable(
                          initiative.status,
                        )}
                      </span>
                    </td>

                    <td>
                      {initiative.plannedContributionPoints.toFixed(
                        1,
                      )}
                      {" pts"}
                    </td>

                    <td>
                      {initiative.blockedDependencyCount}
                      {" blocking"}
                    </td>

                    <td>
                      {initiative.overdueMilestoneCount}
                      {" overdue"}
                    </td>

                    <td>
                      {initiative.pendingGateCount}
                      {" pending · "}
                      {initiative.rejectedGateCount}
                      {" rejected"}
                    </td>

                    <td>
                      {canManage ? (
                        <div className="roadmap-inline-actions">
                          {detail.roadmap.status ===
                            "ACTIVE"
                          &&
                          initiative.status ===
                            "PLANNED" ? (
                            <button
                              type="button"
                              disabled={running}
                              onClick={
                                () =>
                                  void initiativeAction(
                                    initiative.id,
                                    "START",
                                  )
                              }
                            >
                              Start
                            </button>
                          ) : null}

                          {initiative.status ===
                          "IN_PROGRESS" ? (
                            <button
                              type="button"
                              disabled={running}
                              onClick={
                                () =>
                                  void initiativeAction(
                                    initiative.id,
                                    "COMPLETE",
                                  )
                              }
                            >
                              Complete
                            </button>
                          ) : null}

                          {initiative.status !==
                            "COMPLETED"
                          &&
                          initiative.status !==
                            "CANCELLED" ? (
                            <button
                              type="button"
                              className="roadmap-danger-button"
                              disabled={running}
                              onClick={
                                () =>
                                  void initiativeAction(
                                    initiative.id,
                                    "CANCEL",
                                  )
                              }
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ),
              )}

              {detail.initiatives.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="table-empty-state"
                  >
                    No proposed roadmap
                    initiatives exist yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage &&
      mutable ? (
        <form
          className="panel"
          onSubmit={addInitiative}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Proposed execution
              </span>

              <h2>
                Add roadmap initiative
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="roadmap-initiative-form">
            <label className="request-field roadmap-form-wide">
              <span>
                Initiative title
              </span>

              <input
                required
                value={initiativeTitle}
                onChange={
                  event =>
                    setInitiativeTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Board dimension
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
                {dimensionOptions.map(
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
                Priority
              </span>

              <select
                value={priority}
                onChange={
                  event =>
                    setPriority(
                      event.target.value as
                        RoadmapPriority,
                    )
                }
              >
                <option value="LOW">
                  Low
                </option>

                <option value="MEDIUM">
                  Medium
                </option>

                <option value="HIGH">
                  High
                </option>

                <option value="CRITICAL">
                  Critical
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Owner
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
                {detail.users.map(
                  owner => (
                    <option
                      key={owner.id}
                      value={owner.id}
                    >
                      {owner.fullName}
                      {" — "}
                      {owner.role}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Planned contribution
              </span>

              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={contribution}
                onChange={
                  event =>
                    setContribution(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Start
              </span>

              <input
                type="date"
                value={initiativeStart}
                onChange={
                  event =>
                    setInitiativeStart(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                End
              </span>

              <input
                type="date"
                value={initiativeEnd}
                onChange={
                  event =>
                    setInitiativeEnd(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field roadmap-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={5}
                value={initiativeDescription}
                onChange={
                  event =>
                    setInitiativeDescription(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="roadmap-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !initiativeTitle.trim()
                ||
                !ownerUserId
              }
            >
              Add initiative
            </button>
          </div>
        </form>
      ) : null}

      {canManage &&
      mutable &&
      detail.initiatives.length >=
        2 ? (
        <form
          className="panel"
          onSubmit={addDependency}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Dependency governance
              </span>

              <h2>
                Add sequencing dependency
              </h2>
            </div>
          </div>

          <div className="roadmap-dependency-form">
            <label className="request-field">
              <span>
                Predecessor
              </span>

              <select
                value={predecessorId}
                onChange={
                  event =>
                    setPredecessorId(
                      event.target.value,
                    )
                }
              >
                {detail.initiatives.map(
                  initiative => (
                    <option
                      key={initiative.id}
                      value={initiative.id}
                    >
                      {initiative.initiativeNumber}
                      {" — "}
                      {initiative.title}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Successor
              </span>

              <select
                value={successorId}
                onChange={
                  event =>
                    setSuccessorId(
                      event.target.value,
                    )
                }
              >
                {detail.initiatives.map(
                  initiative => (
                    <option
                      key={initiative.id}
                      value={initiative.id}
                    >
                      {initiative.initiativeNumber}
                      {" — "}
                      {initiative.title}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Dependency type
              </span>

              <select
                value={dependencyType}
                onChange={
                  event =>
                    setDependencyType(
                      event.target.value as
                        RoadmapDependencyType,
                    )
                }
              >
                <option value="FINISH_TO_START">
                  Finish to start
                </option>

                <option value="START_TO_START">
                  Start to start
                </option>

                <option value="FINISH_TO_FINISH">
                  Finish to finish
                </option>
              </select>
            </label>

            <label className="request-field roadmap-form-wide">
              <span>
                Rationale
              </span>

              <textarea
                rows={4}
                value={dependencyRationale}
                onChange={
                  event =>
                    setDependencyRationale(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="roadmap-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !predecessorId
                ||
                !successorId
                ||
                predecessorId ===
                  successorId
              }
            >
              Add dependency
            </button>
          </div>
        </form>
      ) : null}

      {detail.dependencies.length >
      0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Sequence
              </span>

              <h2>
                Dependencies
              </h2>
            </div>
          </div>

          <div className="roadmap-dependency-list">
            {detail.dependencies.map(
              dependency => (
                <article
                  key={dependency.id}
                >
                  <div>
                    <strong>
                      {dependency.predecessorNumber}
                      {" → "}
                      {dependency.successorNumber}
                    </strong>

                    <span>
                      {readable(
                        dependency.dependencyType,
                      )}
                      {" · "}
                      {dependency.satisfied
                        ? "Satisfied"
                        : "Blocking"}
                    </span>
                  </div>

                  {dependency.rationale ? (
                    <p>
                      {dependency.rationale}
                    </p>
                  ) : null}

                  {canManage &&
                  mutable ? (
                    <button
                      type="button"
                      className="roadmap-danger-button"
                      disabled={running}
                      onClick={
                        () =>
                          void removeDependency(
                            dependency.id,
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
          </div>
        </section>
      ) : null}

      {canManage &&
      mutable &&
      detail.initiatives.length >
        0 ? (
        <section className="roadmap-form-grid">
          <form
            className="panel"
            onSubmit={addMilestone}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Delivery checkpoints
                </span>

                <h2>
                  Add milestone
                </h2>
              </div>
            </div>

            <div className="roadmap-form-stack">
              <label className="request-field">
                <span>
                  Initiative
                </span>

                <select
                  value={selectedInitiativeId}
                  onChange={
                    event =>
                      setSelectedInitiativeId(
                        event.target.value,
                      )
                  }
                >
                  {detail.initiatives.map(
                    initiative => (
                      <option
                        key={initiative.id}
                        value={initiative.id}
                      >
                        {initiative.initiativeNumber}
                        {" — "}
                        {initiative.title}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Milestone
                </span>

                <input
                  required
                  value={milestoneTitle}
                  onChange={
                    event =>
                      setMilestoneTitle(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Due date
                </span>

                <input
                  type="date"
                  value={milestoneDue}
                  onChange={
                    event =>
                      setMilestoneDue(
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
                  !selectedInitiativeId
                  ||
                  !milestoneTitle.trim()
                }
              >
                Add milestone
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={addGate}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Decision governance
                </span>

                <h2>
                  Add decision gate
                </h2>
              </div>
            </div>

            <div className="roadmap-form-stack">
              <label className="request-field">
                <span>
                  Initiative
                </span>

                <select
                  value={selectedInitiativeId}
                  onChange={
                    event =>
                      setSelectedInitiativeId(
                        event.target.value,
                      )
                  }
                >
                  {detail.initiatives.map(
                    initiative => (
                      <option
                        key={initiative.id}
                        value={initiative.id}
                      >
                        {initiative.initiativeNumber}
                        {" — "}
                        {initiative.title}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Gate name
                </span>

                <input
                  required
                  value={gateName}
                  onChange={
                    event =>
                      setGateName(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Due date
                </span>

                <input
                  type="date"
                  value={gateDue}
                  onChange={
                    event =>
                      setGateDue(
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
                  !selectedInitiativeId
                  ||
                  !gateName.trim()
                }
              >
                Add gate
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="roadmap-form-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Schedule evidence
              </span>

              <h2>
                Milestones
              </h2>
            </div>
          </div>

          <div className="roadmap-checkpoint-list">
            {detail.milestones.map(
              milestone => (
                <article
                  key={milestone.id}
                  className={
                    milestone.overdue
                      ? "roadmap-checkpoint roadmap-checkpoint--risk"
                      : "roadmap-checkpoint"
                  }
                >
                  <div>
                    <strong>
                      {milestone.title}
                    </strong>

                    <span>
                      {milestone.dueDate}
                      {" · "}
                      {readable(
                        milestone.status,
                      )}
                    </span>
                  </div>

                  {canManage &&
                  milestone.status ===
                    "PLANNED" ? (
                    <div className="roadmap-inline-actions">
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void milestoneAction(
                              milestone.id,
                              "COMPLETE",
                            )
                        }
                      >
                        Complete
                      </button>

                      <button
                        type="button"
                        className="roadmap-danger-button"
                        disabled={running}
                        onClick={
                          () =>
                            void milestoneAction(
                              milestone.id,
                              "CANCEL",
                            )
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </article>
              ),
            )}

            {detail.milestones.length ===
            0 ? (
              <div className="roadmap-empty">
                No milestones.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Decision evidence
              </span>

              <h2>
                Gates
              </h2>
            </div>
          </div>

          <div className="roadmap-checkpoint-list">
            {detail.gates.map(
              gate => (
                <article
                  key={gate.id}
                  className={
                    gate.status ===
                      "REJECTED"
                    ||
                    gate.overdue
                      ? "roadmap-checkpoint roadmap-checkpoint--risk"
                      : "roadmap-checkpoint"
                  }
                >
                  <div>
                    <strong>
                      {gate.gateName}
                    </strong>

                    <span>
                      {gate.dueDate}
                      {" · "}
                      {readable(
                        gate.status,
                      )}
                    </span>
                  </div>

                  {canFinalize &&
                  gate.status ===
                    "PENDING" ? (
                    <div className="roadmap-gate-control">
                      <input
                        placeholder="Required decision note"
                        value={
                          gateNotes[
                            gate.id
                          ]
                          ??
                          ""
                        }
                        onChange={
                          event =>
                            setGateNotes(
                              current => ({
                                ...current,
                                [gate.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <button
                        type="button"
                        disabled={
                          running
                          ||
                          !(
                            gateNotes[
                              gate.id
                            ]
                            ??
                            ""
                          ).trim()
                        }
                        onClick={
                          () =>
                            void gateDecision(
                              gate.id,
                              "APPROVED",
                            )
                        }
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={
                          running
                          ||
                          !(
                            gateNotes[
                              gate.id
                            ]
                            ??
                            ""
                          ).trim()
                        }
                        onClick={
                          () =>
                            void gateDecision(
                              gate.id,
                              "WAIVED",
                            )
                        }
                      >
                        Waive
                      </button>

                      <button
                        type="button"
                        className="roadmap-danger-button"
                        disabled={
                          running
                          ||
                          !(
                            gateNotes[
                              gate.id
                            ]
                            ??
                            ""
                          ).trim()
                        }
                        onClick={
                          () =>
                            void gateDecision(
                              gate.id,
                              "REJECTED",
                            )
                        }
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </article>
              ),
            )}

            {detail.gates.length ===
            0 ? (
              <div className="roadmap-empty">
                No decision gates.
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Executive evidence
            </span>

            <h2>
              Immutable roadmap snapshots
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
                <th>Roadmap status</th>
                <th>Readiness</th>
                <th>Health</th>
                <th>Initiatives</th>
                <th>Blocked</th>
                <th>Overdue</th>
                <th>Captured</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.snapshots.map(
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
                      {readable(
                        snapshot.roadmapStatus,
                      )}
                    </td>

                    <td>
                      {snapshot.readinessScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {readable(
                        snapshot.readinessHealth,
                      )}
                    </td>

                    <td>
                      {snapshot.initiativeCount}
                    </td>

                    <td>
                      {snapshot.blockedInitiativeCount}
                    </td>

                    <td>
                      {snapshot.overdueMilestoneCount}
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
                          `/strategy-roadmaps/snapshots/${snapshot.id}`
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

      <section className="roadmap-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Dependencies are cycle-protected
          </strong>

          <p>
            ProcureIQ rejects sequencing
            edges that would create a
            dependency cycle. Starting an
            initiative also requires its
            incoming sequencing
            dependencies to be satisfied,
            while rejected decision gates
            block execution.
          </p>
        </div>
      </section>
    </div>
  );
}
