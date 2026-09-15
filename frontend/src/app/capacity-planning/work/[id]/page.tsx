"use client";

import {
  ArrowLeft,
  CircleAlert,
  Gauge,
  Plus,
  Trash2,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createCapacityAssignment,
  deleteCapacityAssignment,
  getCapacityPlanningDashboard,
  getCapacityWorkEstimate,
  updateCapacityWorkEstimate,
} from "@/lib/api";

import type {
  CapacityPlanningDashboard,
  CapacityWorkItem,
} from "@/types/capacity-planning";

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

export default function CapacityWorkPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    item,
    setItem,
  ] =
    useState<
      CapacityWorkItem |
      null
    >(null);

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapacityPlanningDashboard |
      null
    >(null);

  const [
    effort,
    setEffort,
  ] =
    useState(0);

  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState("");

  const [
    allocation,
    setAllocation,
  ] =
    useState(25);

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

    getCapacityWorkEstimate(
      params.id,
    )
      .then(
        async response => {
          const context =
            await getCapacityPlanningDashboard();

          if (!active) {
            return;
          }

          setItem(
            response,
          );

          setEffort(
            response.estimatedEffortHours,
          );

          setDashboard(
            context,
          );

          const candidate =
            context.users.find(
              candidateUser =>
                !response.assignments.some(
                  assignment =>
                    assignment.userId ===
                      candidateUser.id,
                ),
            );

          if (candidate) {
            setSelectedUserId(
              candidate.id,
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
                : "Unable to load capacity work item.",
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
    setItem(
      await getCapacityWorkEstimate(
        params.id,
      ),
    );
  }

  async function updateEstimate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      setItem(
        await updateCapacityWorkEstimate(
          params.id,
          effort,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update effort estimate.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addAssignment(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedUserId) {
      setError(
        "Select a team member.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createCapacityAssignment(
        params.id,
        {
          userId:
            selectedUserId,
          allocationPct:
            allocation,
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
          : "Unable to create capacity assignment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function removeAssignment(
    assignmentId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await deleteCapacityAssignment(
        assignmentId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to remove capacity assignment.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading capacity work item...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-stack">
        <Link
          href="/capacity-planning"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capacity planning
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capacity work item not found."}
        </div>
      </div>
    );
  }

  const remainingAllocation =
    Math.max(
      0,
      100 - item.allocationPct,
    );

  const availableUsers =
    dashboard
      ?.users
      .filter(
        candidate =>
          dashboard.profiles.some(
            profile =>
              profile.userId ===
                candidate.id,
          )
          &&
          !item.assignments.some(
            assignment =>
              assignment.userId ===
                candidate.id,
          ),
      )
    ??
    [];

  return (
    <div className="page-stack">
      <Link
        href="/capacity-planning"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capacity planning
      </Link>

      <section className="capacity-detail-heading">
        <div>
          <span className="eyebrow">
            Strategic work capacity
          </span>

          <h1>
            {item.sourceTitle}
          </h1>

          <p>
            {item.sourceReference}
            {" · "}
            {readable(
              item.sourceType,
            )}
            {" · "}
            {readable(
              item.sourceStatus,
            )}
          </p>
        </div>

        <span
          className={
            `capacity-work-status capacity-work-status--${item.planningStatus.toLowerCase()}`
          }
        >
          {readable(
            item.planningStatus,
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

      <section className="capacity-detail-grid">
        <article>
          <span>
            Estimated effort
          </span>

          <strong>
            {item.estimatedEffortHours.toFixed(
              0,
            )}
            h
          </strong>
        </article>

        <article>
          <span>
            Allocated
          </span>

          <strong>
            {item.allocationPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Assigned effort
          </span>

          <strong>
            {item.assignedEffortHours.toFixed(
              0,
            )}
            h
          </strong>
        </article>

        <article>
          <span>
            Unassigned effort
          </span>

          <strong>
            {item.unassignedEffortHours.toFixed(
              0,
            )}
            h
          </strong>
        </article>

        <article>
          <span>
            Risk score
          </span>

          <strong>
            {item.riskScore.toFixed(
              1,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Resource ownership
            </span>

            <h2>
              Assignments
            </h2>
          </div>

          <Gauge
            size={19}
          />
        </div>

        <div className="capacity-assignment-list">
          {item.assignments.map(
            assignment => (
              <article
                key={assignment.id}
              >
                <div>
                  <strong>
                    {assignment.userName}
                  </strong>

                  <span>
                    {readable(
                      assignment.role,
                    )}
                  </span>
                </div>

                <div>
                  <strong>
                    {assignment.allocationPct.toFixed(
                      1,
                    )}
                    %
                  </strong>

                  <span>
                    {assignment.assignedEffortHours.toFixed(
                      0,
                    )}
                    h
                  </span>
                </div>

                {canManage ? (
                  <button
                    type="button"
                    className="capacity-danger-button"
                    disabled={running}
                    onClick={
                      () =>
                        void removeAssignment(
                          assignment.id,
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

          {item.assignments.length ===
          0 ? (
            <div className="capacity-empty">
              This strategic work item has
              no team allocation yet.
            </div>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <section className="capacity-form-grid">
          <form
            className="panel"
            onSubmit={updateEstimate}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Demand estimate
                </span>

                <h2>
                  Effort
                </h2>
              </div>
            </div>

            <label className="request-field">
              <span>
                Estimated effort hours
              </span>

              <input
                type="number"
                min="0.01"
                step="1"
                value={effort}
                onChange={
                  event =>
                    setEffort(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <div className="capacity-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={running}
              >
                Update estimate
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={addAssignment}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Resource allocation
                </span>

                <h2>
                  Add assignment
                </h2>
              </div>

              <Plus
                size={19}
              />
            </div>

            <div className="capacity-form-fields">
              <label className="request-field">
                <span>
                  Team member
                </span>

                <select
                  value={selectedUserId}
                  onChange={
                    event =>
                      setSelectedUserId(
                        event.target.value,
                      )
                  }
                >
                  <option value="">
                    Select member
                  </option>

                  {availableUsers.map(
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
                  Allocation %
                </span>

                <input
                  type="number"
                  min="0.01"
                  max={remainingAllocation}
                  step="0.01"
                  value={allocation}
                  onChange={
                    event =>
                      setAllocation(
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
                  !selectedUserId
                  ||
                  remainingAllocation <=
                    0
                }
              >
                Assign
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="capacity-method-note">
        <Gauge
          size={18}
        />

        <div>
          <strong>
            Allocation authority
          </strong>

          <p>
            Assignment percentages cannot
            exceed 100% for a work item.
            Team members must have a
            fiscal-year capacity profile
            before receiving strategic
            work.
          </p>
        </div>
      </section>
    </div>
  );
}
