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
  captureStrategyCockpitSnapshot,
  getStrategyCockpitDashboard,
} from "@/lib/api";

import type {
  StrategyCockpitDashboard,
} from "@/types/strategy-cockpit";

import {
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

function signed(
  value: number,
): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

export default function StrategyCockpitPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategyCockpitDashboard |
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
    boardCommentary,
    setBoardCommentary,
  ] =
    useState("");

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

  const canCapture =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getStrategyCockpitDashboard(
      currency,
      fiscalYear,
    )
      .then(
        response => {
          if (active) {
            setDashboard(
              response,
            );

            setError(null);
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
                : "Unable to load enterprise procurement strategy cockpit.",
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
  ]);

  async function reload() {
    setDashboard(
      await getStrategyCockpitDashboard(
        currency,
        fiscalYear,
      ),
    );
  }

  async function capture() {
    try {
      setRunning(true);
      setError(null);

      await captureStrategyCockpitSnapshot(
        currency,
        fiscalYear,
        boardCommentary,
      );

      setBoardCommentary("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture board scorecard.",
      );
    } finally {
      setRunning(false);
    }
  }

  const current =
    dashboard?.current;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Enterprise procurement strategy
          </span>

          <h1>
            Strategy cockpit
          </h1>

          <p>
            One board-level view of
            procurement objectives,
            strategic alignment, resource
            capacity, capability readiness
            and succession resilience.
          </p>
        </div>

        <div className="strategy-cockpit-heading-actions">
          <label className="strategy-cockpit-filter">
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
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          <label className="strategy-cockpit-filter">
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

      <section className="strategy-board-hero">
        <div className="strategy-board-score">
          <span>
            Enterprise procurement score
          </span>

          <strong>
            {(
              current
                ?.overallScore ??
                0
            ).toFixed(1)}
          </strong>

          <small>
            {current
              ? readable(
                  current.overallHealth,
                )
              : "—"}
          </small>
        </div>

        <div className="strategy-board-movement">
          <span>
            Movement
          </span>

          <strong>
            {current
              ? readable(
                  current.movement,
                )
              : "—"}
          </strong>

          <small>
            {current
              ? `${signed(current.scoreDelta)} pts vs latest pack`
              : "No baseline"}
          </small>
        </div>

        <div className="strategy-board-exception">
          <span>
            Strategic exceptions
          </span>

          <strong>
            {current
              ?.exceptionCount ??
              0}
          </strong>

          <small>
            {current
              ?.criticalExceptionCount ??
              0}
            {" critical"}
          </small>
        </div>
      </section>

      <section className="strategy-dimension-grid">
        {dashboard
          ?.dimensions
          .map(
            dimension => (
              <article
                key={dimension.key}
              >
                <div className="strategy-dimension-title">
                  <span>
                    {dimension.label}
                  </span>

                  <small>
                    {dimension.weightPct.toFixed(
                      0,
                    )}
                    % weight
                  </small>
                </div>

                <strong>
                  {dimension.score.toFixed(
                    1,
                  )}
                </strong>

                <span
                  className={
                    `strategy-health strategy-health--${dimension.health.toLowerCase()}`
                  }
                >
                  {readable(
                    dimension.health,
                  )}
                </span>

                <div className="strategy-dimension-delta">
                  {signed(
                    dimension.scoreDelta,
                  )}
                  {" pts"}
                </div>

                <p>
                  {dimension.sourceDetail}
                </p>
              </article>
            ),
          )}
      </section>

      <section className="strategy-signal-grid">
        <article>
          <span>
            Strategic objectives
          </span>

          <strong>
            {current
              ?.strategicObjectiveCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Off-track objectives
          </span>

          <strong className="strategy-risk-text">
            {current
              ?.offTrackObjectiveCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Unaligned work
          </span>

          <strong className="strategy-risk-text">
            {current
              ?.unalignedWorkCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Overloaded members
          </span>

          <strong className="strategy-risk-text">
            {current
              ?.overloadedMemberCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Critical capability gaps
          </span>

          <strong className="strategy-risk-text">
            {current
              ?.criticalCapabilityGapCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Succession SPOF
          </span>

          <strong className="strategy-risk-text">
            {current
              ?.successionSpofCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel strategy-executive-summary">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Deterministic executive narrative
            </span>

            <h2>
              Board summary
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <p>
          {current
            ?.generatedSummary ??
            "Loading procurement strategy evidence..."}
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Management by exception
            </span>

            <h2>
              Strategic exceptions
            </h2>
          </div>

          <CircleAlert
            size={19}
          />
        </div>

        <div className="strategy-exception-list">
          {dashboard
            ?.exceptions
            .map(
              exception => (
                <article
                  key={exception.stableKey}
                >
                  <div className="strategy-exception-heading">
                    <span
                      className={
                        `strategy-exception-severity strategy-exception-severity--${exception.severity.toLowerCase()}`
                      }
                    >
                      {readable(
                        exception.severity,
                      )}
                    </span>

                    <strong>
                      {exception.title}
                    </strong>
                  </div>

                  <p>
                    {exception.detail}
                  </p>

                  <div className="strategy-exception-footer">
                    <span>
                      Count:
                      {" "}
                      {exception.occurrenceCount}
                    </span>

                    <Link
                      href={exception.sourceRoute}
                      className="table-action"
                    >
                      Open source authority
                    </Link>
                  </div>
                </article>
              ),
            )}

          {(
            dashboard
              ?.exceptions
              .length ??
            0
          ) ===
            0 ? (
            <div className="strategy-empty">
              No governed strategic
              exceptions are active.
            </div>
          ) : null}
        </div>
      </section>

      {canCapture ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Executive governance
              </span>

              <h2>
                Capture board pack
              </h2>
            </div>

            <Camera
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Board commentary
            </span>

            <textarea
              rows={5}
              maxLength={4000}
              placeholder={
                "Optional governed commentary to preserve with the immutable board pack."
              }
              value={boardCommentary}
              onChange={
                event =>
                  setBoardCommentary(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="strategy-cockpit-capture-actions">
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
              {running
                ? "Capturing..."
                : "Capture immutable board pack"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Period-over-period evidence
            </span>

            <h2>
              Board scorecard history
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Board pack</th>
                <th>Score</th>
                <th>Health</th>
                <th>Movement</th>
                <th>Delta</th>
                <th>Exceptions</th>
                <th>Critical</th>
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
                          {snapshot.overallScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {readable(
                            snapshot.overallHealth,
                          )}
                        </td>

                        <td>
                          {readable(
                            snapshot.movement,
                          )}
                        </td>

                        <td>
                          {signed(
                            snapshot.scoreDelta,
                          )}
                        </td>

                        <td>
                          {snapshot.exceptionCount}
                        </td>

                        <td>
                          {snapshot.criticalExceptionCount}
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
                              `/strategy-cockpit/snapshots/${snapshot.id}`
                            }
                            className="table-action"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.snapshots
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No board scorecard
                    pack has been captured
                    yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="strategy-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Explainable board-level scoring
          </strong>

          <p>
            Overall score = 25% objective
            execution + 20% strategic
            alignment + 20% capacity +
            20% capability + 15%
            succession resilience. Every
            component comes from an
            existing governed ProcureIQ
            authority; this cockpit does
            not rewrite source records.
          </p>
        </div>
      </section>
    </div>
  );
}
