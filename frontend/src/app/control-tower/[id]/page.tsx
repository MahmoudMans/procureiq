"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Play,
  UserRoundSearch,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
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
  acknowledgeControlTowerItem,
  assignControlTowerOwner,
  dismissControlTowerItem,
  getControlTowerContext,
  getControlTowerItem,
  resolveControlTowerItem,
  startControlTowerItem,
} from "@/lib/api";

import type {
  ControlTowerContext,
  ControlTowerItem,
} from "@/types/control-tower";

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
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export default function ControlTowerItemPage() {
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
      ControlTowerItem |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      ControlTowerContext |
      null
    >(null);

  const [
    note,
    setNote,
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

  const canDismiss =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getControlTowerItem(
        params.id,
      ),
      getControlTowerContext(),
    ])
      .then(
        ([
          itemResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setItem(
            itemResponse,
          );

          setContext(
            contextResponse,
          );

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load control-tower item.",
          );
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
      await getControlTowerItem(
        params.id,
      ),
    );
  }

  async function assign(
    ownerUserId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await assignControlTowerOwner(
        params.id,
        ownerUserId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to assign control-tower owner.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function acknowledge() {
    if (!note.trim()) {
      setError(
        "An acknowledgement note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await acknowledgeControlTowerItem(
        params.id,
        note,
      );

      setNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to acknowledge control-tower item.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function start() {
    try {
      setRunning(true);
      setError(null);

      await startControlTowerItem(
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
          : "Unable to start control-tower item.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function resolve() {
    if (!note.trim()) {
      setError(
        "A resolution note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await resolveControlTowerItem(
        params.id,
        note,
      );

      setNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to resolve control-tower item.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function dismiss() {
    if (!note.trim()) {
      setError(
        "A dismissal rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await dismissControlTowerItem(
        params.id,
        note,
      );

      setNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to dismiss control-tower item.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading control-tower item...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-stack">
        <Link
          href="/control-tower"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Control tower
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Control-tower item not found."}
        </div>
      </div>
    );
  }

  const active =
    item.status ===
      "OPEN"
    ||
    item.status ===
      "ACKNOWLEDGED"
    ||
    item.status ===
      "IN_PROGRESS";

  return (
    <div className="page-stack">
      <Link
        href="/control-tower"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Control tower
      </Link>

      <section className="control-tower-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span
              className={
                `control-tower-severity control-tower-severity--${item.severity.toLowerCase()}`
              }
            >
              {item.severity}
            </span>

            <span
              className={
                `control-tower-status control-tower-status--${item.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                item.status,
              )}
            </span>

            <span>
              Priority
              {" "}
              {item.priorityScore.toFixed(
                0,
              )}
            </span>
          </div>

          <h1>
            {item.title}
          </h1>

          <p>
            {readable(
              item.exceptionType,
            )}
            {" · "}
            {item.sourceReference}
            {" · "}
            {item.currency}
          </p>
        </div>

        <div
          className={
            item.slaOverdue
              ? "control-tower-sla-card control-tower-sla-card--overdue"
              : "control-tower-sla-card"
          }
        >
          <span>
            SLA due
          </span>

          <strong>
            {new Date(
              item.slaDueAt,
            )
              .toLocaleString()}
          </strong>

          <small>
            {item.slaOverdue
              ? "OVERDUE"
              : "Within SLA"}
          </small>
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

      <section className="control-tower-detail-kpis">
        <article>
          <span>
            Priority score
          </span>

          <strong>
            {item.priorityScore.toFixed(
              1,
            )}
          </strong>
        </article>

        <article>
          <span>
            Exposure
          </span>

          <strong>
            {item.monetaryExposure >
            0
              ? money(
                  item.monetaryExposure,
                  item.currency,
                )
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Age
          </span>

          <strong>
            {item.ageDays}
            {" days"}
          </strong>
        </article>

        <article>
          <span>
            Source due date
          </span>

          <strong>
            {item.sourceDueDate ??
              "—"}
          </strong>
        </article>
      </section>

      <section className="control-tower-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Exception context
              </span>

              <h2>
                Source condition
              </h2>
            </div>

            <AlertTriangle
              size={19}
            />
          </div>

          <div className="control-tower-details">
            {item.details}
          </div>

          <div className="control-tower-source-grid">
            <div>
              <span>
                Source entity
              </span>

              <strong>
                {readable(
                  item.sourceEntityType,
                )}
              </strong>
            </div>

            <div>
              <span>
                Source reference
              </span>

              <strong>
                {item.sourceReference}
              </strong>
            </div>

            <div>
              <span>
                First seen
              </span>

              <strong>
                {new Date(
                  item.firstSeenAt,
                )
                  .toLocaleString()}
              </strong>
            </div>

            <div>
              <span>
                Last seen
              </span>

              <strong>
                {new Date(
                  item.lastSeenAt,
                )
                  .toLocaleString()}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Accountability
              </span>

              <h2>
                Ownership
              </h2>
            </div>

            <UserRoundSearch
              size={19}
            />
          </div>

          <div className="control-tower-owner-card">
            <span>
              Current owner
            </span>

            <strong>
              {item.ownerName ??
                "Unassigned"}
            </strong>
          </div>

          {canManage &&
          active ? (
            <label className="request-field">
              <span>
                Assign owner
              </span>

              <select
                value={
                  item.ownerUserId ??
                  ""
                }
                disabled={running}
                onChange={
                  event =>
                    void assign(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select owner
                </option>

                {context
                  ?.users
                  .filter(
                    candidate =>
                      candidate.role !==
                      "REQUESTER",
                  )
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
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Exception workflow
            </span>

            <h2>
              Management disposition
            </h2>
          </div>

          <BadgeCheck
            size={19}
          />
        </div>

        {item.acknowledgementNote ? (
          <div className="control-tower-history-note">
            <strong>
              Acknowledgement
            </strong>

            <span>
              {item.acknowledgementNote}
              {item.acknowledgedByName
                ? ` — ${item.acknowledgedByName}`
                : ""}
            </span>
          </div>
        ) : null}

        {item.resolutionNote ? (
          <div className="control-tower-history-note">
            <strong>
              Resolution / disposition
            </strong>

            <span>
              {item.resolutionNote}
              {item.resolvedByName
                ? ` — ${item.resolvedByName}`
                : ""}
            </span>
          </div>
        ) : null}

        {canManage &&
        active ? (
          <>
            <label className="request-field">
              <span>
                Workflow note
              </span>

              <textarea
                rows={5}
                value={note}
                placeholder={
                  "Add acknowledgement, resolution or dismissal rationale"
                }
                onChange={
                  event =>
                    setNote(
                      event.target.value,
                    )
                }
              />
            </label>

            <div className="control-tower-workflow-actions">
              {item.status ===
              "OPEN" ? (
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={
                    running
                    ||
                    !note.trim()
                  }
                  onClick={
                    () =>
                      void acknowledge()
                  }
                >
                  <BadgeCheck
                    size={14}
                  />
                  Acknowledge
                </button>
              ) : null}

              {item.status ===
                "OPEN"
              ||
              item.status ===
                "ACKNOWLEDGED" ? (
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={running}
                  onClick={
                    () =>
                      void start()
                  }
                >
                  <Play
                    size={14}
                  />
                  Start work
                </button>
              ) : null}

              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !note.trim()
                }
                onClick={
                  () =>
                    void resolve()
                }
              >
                <BadgeCheck
                  size={14}
                />
                Resolve
              </button>

              {canDismiss ? (
                <button
                  type="button"
                  className="control-tower-dismiss-button"
                  disabled={
                    running
                    ||
                    !note.trim()
                  }
                  onClick={
                    () =>
                      void dismiss()
                  }
                >
                  <XCircle
                    size={14}
                  />
                  Dismiss
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="control-tower-terminal-state">
            This exception is no longer
            active.
          </div>
        )}
      </section>

      <section className="control-tower-method-note">
        <AlertTriangle
          size={18}
        />

        <div>
          <strong>
            Queue disposition does not rewrite the source
          </strong>

          <p>
            Resolving or dismissing this
            control-tower item changes
            only the management queue.
            The supplier, sourcing,
            benefits, leakage or
            governance source record
            remains authoritative and
            unchanged.
          </p>
        </div>
      </section>
    </div>
  );
}
