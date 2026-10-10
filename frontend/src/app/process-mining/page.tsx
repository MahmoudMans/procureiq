"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CircleAlert,
  Clock3,
  Gauge,
  RefreshCw,
  Route,
  Settings2,
  Workflow,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getProcessMiningDashboard,
  upsertProcessStageTarget,
} from "@/lib/api";

import type {
  ProcessEntityType,
  ProcessMiningDashboard,
} from "@/types/process-mining";

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

function hoursText(
  hours: number,
): string {
  if (hours >= 48) {
    return `${(hours / 24).toFixed(1)}d`;
  }

  return `${hours.toFixed(1)}h`;
}

export default function ProcessMiningPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      ProcessMiningDashboard |
      null
    >(null);

  const [
    entityFilter,
    setEntityFilter,
  ] =
    useState("");

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState("");

  const [
    targetEntity,
    setTargetEntity,
  ] =
    useState<ProcessEntityType>(
      "PURCHASE_REQUEST",
    );

  const [
    targetStatus,
    setTargetStatus,
  ] =
    useState("*");

  const [
    targetHours,
    setTargetHours,
  ] =
    useState(48);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    savingTarget,
    setSavingTarget,
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

  const canConfigure =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getProcessMiningDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
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
              : "Unable to load process-mining intelligence.",
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
  }, []);

  async function reload() {
    setDashboard(
      await getProcessMiningDashboard(),
    );
  }

  async function saveTarget(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSavingTarget(true);
      setError(null);

      await upsertProcessStageTarget({
        entityType:
          targetEntity,
        status:
          targetStatus.trim(),
        targetHours,
      });

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update process SLA target.",
      );
    } finally {
      setSavingTarget(false);
    }
  }

  const filteredBottlenecks =
    useMemo(
      () =>
        dashboard
          ?.bottlenecks
          .filter(
            bottleneck =>
              !entityFilter
              ||
              bottleneck.entityType ===
                entityFilter,
          )
          .filter(
            bottleneck =>
              !severityFilter
              ||
              bottleneck.severity ===
                severityFilter,
          )
        ??
        [],
      [
        dashboard,
        entityFilter,
        severityFilter,
      ],
    );

  const maxStageHours =
    Math.max(
      ...(
        dashboard
          ?.stageMetrics
          .map(
            metric =>
              metric.averageHours,
          )
        ??
        [1]
      ),
      1,
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Operational intelligence
          </span>

          <h1>
            Process mining
          </h1>

          <p>
            Measure procurement
            cycle-time, identify stalled
            stages, detect process
            deviations and focus teams on
            the largest operational
            bottlenecks.
          </p>
        </div>

        <div className="process-live-badge">
          <Activity
            size={15}
          />

          <div>
            <span>
              Live transitions
            </span>

            <strong>
              {dashboard
                ?.summary
                .liveTransitions ??
                0}
            </strong>
          </div>
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

      <section className="process-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Workflow
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Tracked entities
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .trackedEntities ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .activeEntities ??
              0}
            {" currently active"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Bottlenecks
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .bottlenecks ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .criticalBottlenecks ??
              0}
            {" critical SLA breaches"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Clock3
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Observed cycle
          </span>

          <strong className="kpi-card__value process-cycle-value">
            {hoursText(
              dashboard
                ?.summary
                .averageObservedCycleHours ??
                0,
            )}
          </strong>

          <p>
            Average across entities with
            live transitions.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Route
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Process deviations
          </span>

          <strong className="kpi-card__value">
            {(dashboard
              ?.summary
              .cancelledFlows ??
              0)
              +
              (dashboard
                ?.summary
                .repeatedStages ??
                0)}
          </strong>

          <p>
            {dashboard
              ?.summary
              .repeatedStages ??
              0}
            {" repeated stages"}
          </p>
        </article>
      </section>

      <section className="process-grid-two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Cycle-time
              </span>

              <h2>
                Stage duration
              </h2>
            </div>

            <BarChart3
              size={19}
            />
          </div>

          {dashboard
            ?.stageMetrics
            .length ? (
            <div className="process-stage-list">
              {dashboard.stageMetrics
                .slice(
                  0,
                  14,
                )
                .map(
                  metric => (
                    <article
                      key={
                        `${metric.entityType}-${metric.status}`
                      }
                    >
                      <div className="process-stage-heading">
                        <div>
                          <strong>
                            {readable(
                              metric.entityType,
                            )}
                          </strong>

                          <span>
                            {readable(
                              metric.status,
                            )}
                          </span>
                        </div>

                        <div>
                          <strong>
                            {hoursText(
                              metric.averageHours,
                            )}
                          </strong>

                          <span>
                            P95
                            {" "}
                            {hoursText(
                              metric.p95Hours,
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="process-stage-bar">
                        <div
                          style={{
                            width:
                              `${Math.min(
                                100,
                                (
                                  metric.averageHours /
                                  maxStageHours
                                ) *
                                  100,
                              )}%`,
                          }}
                        />
                      </div>

                      <small>
                        {metric.completedTransitions}
                        {" completed transitions"}
                      </small>
                    </article>
                  ),
                )}
            </div>
          ) : (
            <div className="process-empty">
              Stage-duration analytics
              will populate as live
              status transitions occur.
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Improvement engine
              </span>

              <h2>
                Recommendations
              </h2>
            </div>

            <Gauge
              size={19}
            />
          </div>

          <div className="process-recommendation-list">
            {dashboard
              ?.recommendations
              .map(
                (
                  recommendation,
                  index,
                ) => (
                  <article
                    key={
                      `${recommendation.title}-${index}`
                    }
                    className={
                      `process-recommendation process-recommendation--${recommendation.priority.toLowerCase()}`
                    }
                  >
                    <span>
                      {recommendation.priority}
                    </span>

                    <strong>
                      {recommendation.title}
                    </strong>

                    <p>
                      {recommendation.details}
                    </p>
                  </article>
                ),
              )}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Work-in-process
            </span>

            <h2>
              Active bottlenecks
            </h2>
          </div>

          <span className="process-count">
            {filteredBottlenecks.length}
            {" items"}
          </span>
        </div>

        <div className="process-toolbar">
          <select
            value={entityFilter}
            onChange={
              event =>
                setEntityFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All entity types
            </option>

            <option value="PURCHASE_REQUEST">
              Purchase request
            </option>

            <option value="APPROVAL">
              Approval
            </option>

            <option value="RFQ">
              RFQ
            </option>

            <option value="AWARD">
              Award
            </option>

            <option value="PURCHASE_ORDER">
              Purchase order
            </option>

            <option value="GOODS_RECEIPT">
              Goods receipt
            </option>

            <option value="INVOICE">
              Invoice
            </option>
          </select>

          <select
            value={severityFilter}
            onChange={
              event =>
                setSeverityFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All severities
            </option>

            <option value="WARNING">
              Warning
            </option>

            <option value="CRITICAL">
              Critical
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Reference</th>
                <th>Stage</th>
                <th>Department</th>
                <th>Category</th>
                <th>Age</th>
                <th>Target</th>
                <th>Severity</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredBottlenecks.map(
                  bottleneck => (
                    <tr
                      key={
                        `${bottleneck.entityType}-${bottleneck.entityId}`
                      }
                    >
                      <td>
                        {readable(
                          bottleneck.entityType,
                        )}
                      </td>

                      <td>
                        <strong>
                          {bottleneck.entityReference ??
                            bottleneck.entityId.slice(
                              0,
                              10,
                            )}
                        </strong>
                      </td>

                      <td>
                        {readable(
                          bottleneck.status,
                        )}
                      </td>

                      <td>
                        {bottleneck.departmentName ??
                          "—"}
                      </td>

                      <td>
                        {bottleneck.category ??
                          "—"}
                      </td>

                      <td>
                        <strong className="process-age-value">
                          {hoursText(
                            bottleneck.ageHours,
                          )}
                        </strong>
                      </td>

                      <td>
                        {hoursText(
                          bottleneck.targetHours,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `process-severity process-severity--${bottleneck.severity.toLowerCase()}`
                          }
                        >
                          {bottleneck.severity}
                        </span>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              filteredBottlenecks.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No active process
                    bottlenecks match the
                    selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="process-grid-two">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Organizational flow
              </span>

              <h2>
                Department performance
              </h2>
            </div>
          </div>

          {dashboard
            ?.departmentMetrics
            .length ? (
            <div className="process-dimension-list">
              {dashboard.departmentMetrics.map(
                metric => (
                  <article
                    key={
                      metric.dimensionValue
                    }
                  >
                    <div>
                      <strong>
                        {metric.dimensionValue}
                      </strong>

                      <span>
                        {metric.activeItems}
                        {" active"}
                      </span>
                    </div>

                    <div>
                      <span>
                        Bottlenecks
                      </span>

                      <strong>
                        {metric.bottlenecks}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Avg age
                      </span>

                      <strong>
                        {hoursText(
                          metric.averageAgeHours,
                        )}
                      </strong>
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <div className="process-empty">
              Department attribution
              will appear where workflow
              records expose a department
              dimension.
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Category flow
              </span>

              <h2>
                Category performance
              </h2>
            </div>
          </div>

          {dashboard
            ?.categoryMetrics
            .length ? (
            <div className="process-dimension-list">
              {dashboard.categoryMetrics.map(
                metric => (
                  <article
                    key={
                      metric.dimensionValue
                    }
                  >
                    <div>
                      <strong>
                        {metric.dimensionValue}
                      </strong>

                      <span>
                        {metric.activeItems}
                        {" active"}
                      </span>
                    </div>

                    <div>
                      <span>
                        Bottlenecks
                      </span>

                      <strong>
                        {metric.bottlenecks}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Avg age
                      </span>

                      <strong>
                        {hoursText(
                          metric.averageAgeHours,
                        )}
                      </strong>
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <div className="process-empty">
              Category metrics will
              appear for workflow records
              carrying procurement
              category context.
            </div>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Process conformance
            </span>

            <h2>
              Deviations
            </h2>
          </div>

          <Route
            size={19}
          />
        </div>

        <div className="process-deviation-list">
          {dashboard
            ?.deviations
            .slice(
              0,
              30,
            )
            .map(
              (
                deviation,
                index,
              ) => (
                <article
                  key={
                    `${deviation.deviationType}-${deviation.entityId}-${index}`
                  }
                >
                  <span
                    className={
                      `process-deviation-type process-deviation-type--${deviation.deviationType.toLowerCase().replaceAll("_", "-")}`
                    }
                  >
                    {readable(
                      deviation.deviationType,
                    )}
                  </span>

                  <div>
                    <strong>
                      {readable(
                        deviation.entityType,
                      )}
                      {" · "}
                      {deviation.entityReference ??
                        deviation.entityId.slice(
                          0,
                          10,
                        )}
                    </strong>

                    <p>
                      {deviation.details}
                    </p>
                  </div>

                  <time>
                    {new Date(
                      deviation.detectedAt,
                    )
                      .toLocaleString()}
                  </time>
                </article>
              ),
            )}

          {dashboard
            ?.deviations
            .length ===
          0 ? (
            <div className="process-empty">
              No process deviations are
              currently detected.
            </div>
          ) : null}
        </div>
      </section>

      {canConfigure ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Process governance
              </span>

              <h2>
                Stage SLA targets
              </h2>
            </div>

            <Settings2
              size={19}
            />
          </div>

          <form
            className="process-target-form"
            onSubmit={saveTarget}
          >
            <label className="request-field">
              <span>
                Entity type
              </span>

              <select
                value={targetEntity}
                onChange={
                  event =>
                    setTargetEntity(
                      event.target.value as
                        ProcessEntityType,
                    )
                }
              >
                <option value="PURCHASE_REQUEST">
                  Purchase request
                </option>

                <option value="APPROVAL">
                  Approval
                </option>

                <option value="RFQ">
                  RFQ
                </option>

                <option value="AWARD">
                  Award
                </option>

                <option value="PURCHASE_ORDER">
                  Purchase order
                </option>

                <option value="GOODS_RECEIPT">
                  Goods receipt
                </option>

                <option value="INVOICE">
                  Invoice
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Status
              </span>

              <input
                required
                maxLength={80}
                value={targetStatus}
                onChange={
                  event =>
                    setTargetStatus(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Target hours
              </span>

              <input
                required
                type="number"
                min="1"
                max="8760"
                value={targetHours}
                onChange={
                  event =>
                    setTargetHours(
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
                savingTarget
                ||
                !targetStatus.trim()
              }
            >
              <Settings2
                size={16}
              />

              {savingTarget
                ? "Saving..."
                : "Save SLA target"}
            </button>
          </form>

          <div className="process-target-list">
            {dashboard
              ?.targets
              .map(
                target => (
                  <article
                    key={target.id}
                  >
                    <strong>
                      {readable(
                        target.entityType,
                      )}
                    </strong>

                    <span>
                      {target.status ===
                      "*"
                        ? "Default stage target"
                        : readable(
                            target.status,
                          )}
                    </span>

                    <strong>
                      {target.targetHours}
                      {"h"}
                    </strong>
                  </article>
                ),
              )}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Event ledger
            </span>

            <h2>
              Recent process events
            </h2>
          </div>

          <Activity
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Entity</th>
                <th>Reference</th>
                <th>Previous</th>
                <th>Current</th>
                <th>Source</th>
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.recentEvents
                .slice(
                  0,
                  40,
                )
                .map(
                  event => (
                    <tr
                      key={event.id}
                    >
                      <td>
                        {new Date(
                          event.eventAt,
                        )
                          .toLocaleString()}
                      </td>

                      <td>
                        {readable(
                          event.entityType,
                        )}
                      </td>

                      <td>
                        {event.entityReference ??
                          event.entityId.slice(
                            0,
                            10,
                          )}
                      </td>

                      <td>
                        {event.previousStatus
                          ? readable(
                              event.previousStatus,
                            )
                          : "—"}
                      </td>

                      <td>
                        <strong>
                          {readable(
                            event.status,
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            event.eventSource ===
                            "LIVE"
                              ? "process-source process-source--live"
                              : "process-source"
                          }
                        >
                          {event.eventSource}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </SmartTable>
        </div>
      </section>
    </div>
  );
}
