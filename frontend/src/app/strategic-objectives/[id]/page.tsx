"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  Goal,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Target,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  achieveStrategicObjective,
  cancelStrategicObjective,
  captureOkrSnapshot,
  closeStrategicObjective,
  createOkrContribution,
  createStrategicKeyResult,
  getStrategicObjective,
  getStrategicOkrContext,
  holdStrategicObjective,
  refreshStrategicObjective,
  resumeStrategicObjective,
  startStrategicObjective,
  updateManualKeyResultActual,
} from "@/lib/api";

import type {
  KeyResultDirection,
  KeyResultMetricType,
  KeyResultSourceType,
  OkrContext,
  OkrSourceScopeType,
  StrategicObjectiveDetail,
} from "@/types/strategic-okr";

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

function displayValue(
  value: number,
  metricType: KeyResultMetricType,
  currency: string,
): string {
  if (
    metricType ===
      "CURRENCY"
  ) {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 1,
      },
    ).format(
      value,
    );
  }

  if (
    metricType ===
      "PERCENTAGE"
  ) {
    return `${value.toFixed(1)}%`;
  }

  if (
    metricType ===
      "HOURS"
  ) {
    return `${value.toFixed(1)}h`;
  }

  return value.toFixed(
    1,
  );
}

export default function StrategicObjectivePage() {
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
      StrategicObjectiveDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      OkrContext |
      null
    >(null);

  const [
    krTitle,
    setKrTitle,
  ] =
    useState("");

  const [
    krDescription,
    setKrDescription,
  ] =
    useState("");

  const [
    metricType,
    setMetricType,
  ] =
    useState<KeyResultMetricType>(
      "PERCENTAGE",
    );

  const [
    direction,
    setDirection,
  ] =
    useState<KeyResultDirection>(
      "INCREASE",
    );

  const [
    sourceType,
    setSourceType,
  ] =
    useState<KeyResultSourceType>(
      "MANUAL",
    );

  const [
    scopeType,
    setScopeType,
  ] =
    useState<OkrSourceScopeType>(
      "OVERALL",
    );

  const [
    scopeKey,
    setScopeKey,
  ] =
    useState("");

  const [
    baseline,
    setBaseline,
  ] =
    useState(0);

  const [
    target,
    setTarget,
  ] =
    useState(100);

  const [
    weight,
    setWeight,
  ] =
    useState(25);

  const [
    manualActuals,
    setManualActuals,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    manualNotes,
    setManualNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    contributionKrId,
    setContributionKrId,
  ] =
    useState("");

  const [
    improvementId,
    setImprovementId,
  ] =
    useState("");

  const [
    contributionWeight,
    setContributionWeight,
  ] =
    useState(25);

  const [
    contributionRationale,
    setContributionRationale,
  ] =
    useState("");

  const [
    cancellationNote,
    setCancellationNote,
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

    getStrategicObjective(
      params.id,
    )
      .then(
        async response => {
          const contextResponse =
            await getStrategicOkrContext(
              response.objective.currency,
            );

          if (!active) {
            return;
          }

          setDetail(
            response,
          );

          setContext(
            contextResponse,
          );

          if (
            response.keyResults[0]
          ) {
            setContributionKrId(
              response.keyResults[0].id,
            );
          }

          if (
            contextResponse.improvementInitiatives[0]
          ) {
            setImprovementId(
              contextResponse.improvementInitiatives[0].id,
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
                : "Unable to load strategic objective.",
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
      await getStrategicObjective(
        params.id,
      ),
    );
  }

  async function transition(
    action:
      "START"
      |
      "HOLD"
      |
      "RESUME"
      |
      "ACHIEVE"
      |
      "CLOSE"
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
        await startStrategicObjective(
          params.id,
        );
      } else if (
        action ===
        "HOLD"
      ) {
        await holdStrategicObjective(
          params.id,
        );
      } else if (
        action ===
        "RESUME"
      ) {
        await resumeStrategicObjective(
          params.id,
        );
      } else if (
        action ===
        "ACHIEVE"
      ) {
        await achieveStrategicObjective(
          params.id,
        );
      } else if (
        action ===
        "CLOSE"
      ) {
        await closeStrategicObjective(
          params.id,
        );
      } else {
        if (!cancellationNote.trim()) {
          setError(
            "A cancellation rationale is required.",
          );

          return;
        }

        await cancelStrategicObjective(
          params.id,
          cancellationNote,
        );

        setCancellationNote("");
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update strategic objective.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function refresh() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await refreshStrategicObjective(
          params.id,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to refresh authority-backed actuals.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureOkrSnapshot(
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
          : "Unable to capture executive OKR snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addKeyResult(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const operating =
        sourceType.startsWith(
          "OPERATING_RHYTHM_",
        );

      await createStrategicKeyResult(
        params.id,
        {
          title:
            krTitle.trim(),
          description:
            krDescription.trim()
            ||
            undefined,
          metricType,
          direction,
          sourceType,
          sourceScopeType:
            operating
              ? scopeType
              : undefined,
          sourceScopeKey:
            operating &&
            scopeType !==
              "OVERALL"
              ? scopeKey
              : undefined,
          baselineValue:
            baseline,
          targetValue:
            target,
          weightPct:
            weight,
        },
      );

      setKrTitle("");
      setKrDescription("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create key result.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function updateManual(
    keyResultId: string,
  ) {
    const rawActual =
      manualActuals[
        keyResultId
      ];

    const note =
      manualNotes[
        keyResultId
      ]
      ??
      "";

    if (
      rawActual ===
        undefined
      ||
      rawActual ===
        ""
      ||
      !note.trim()
    ) {
      setError(
        "Manual actual and evidence note are required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await updateManualKeyResultActual(
        keyResultId,
        Number(
          rawActual,
        ),
        note,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update manual key-result actual.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addContribution(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !contributionKrId
      ||
      !improvementId
      ||
      !contributionRationale.trim()
    ) {
      setError(
        "Select a key result, improvement initiative and rationale.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createOkrContribution(
        contributionKrId,
        {
          improvementInitiativeId:
            improvementId,
          contributionWeightPct:
            contributionWeight,
          rationale:
            contributionRationale.trim(),
        },
      );

      setContributionRationale("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to map improvement contribution.",
      );
    } finally {
      setRunning(false);
    }
  }

  const operatingScopes =
    useMemo(
      () =>
        context
          ?.operatingScopes
          .filter(
            scope =>
              scope.scopeType ===
                scopeType,
          )
        ??
        [],
      [
        context,
        scopeType,
      ],
    );

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading strategic objective...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategic-objectives"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategic objectives
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Strategic objective not found."}
        </div>
      </div>
    );
  }

  const {
    objective,
  } = detail;

  const mutable =
    objective.status !==
      "ACHIEVED"
    &&
    objective.status !==
      "CLOSED"
    &&
    objective.status !==
      "CANCELLED";

  return (
    <div className="page-stack">
      <Link
        href="/strategic-objectives"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategic objectives
      </Link>

      <section className="okr-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {objective.objectiveNumber}
            </span>

            <span
              className={
                `okr-status okr-status--${objective.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                objective.status,
              )}
            </span>

            <span
              className={
                `okr-health okr-health--${objective.health.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                objective.health,
              )}
            </span>
          </div>

          <h1>
            {objective.title}
          </h1>

          <p>
            {objective.periodType ===
              "QUARTERLY"
              ? `Q${objective.quarter} ${objective.fiscalYear}`
              : `FY ${objective.fiscalYear}`}
            {" · "}
            {objective.startDate}
            {" → "}
            {objective.endDate}
            {" · Owner "}
            {objective.ownerName}
          </p>
        </div>

        <div className="okr-detail-actions">
          {canManage &&
          mutable ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void refresh()
              }
            >
              <RefreshCcw
                size={15}
              />
              Refresh actuals
            </button>
          ) : null}

          {canManage &&
          objective.status !==
            "DRAFT"
          &&
          objective.status !==
            "CANCELLED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void snapshot()
              }
            >
              <Camera
                size={15}
              />
              Capture snapshot
            </button>
          ) : null}

          {canManage &&
          objective.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                objective.weightCoveragePct !==
                  100
                ||
                objective.keyResultCount ===
                  0
              }
              onClick={
                () =>
                  void transition(
                    "START",
                  )
              }
            >
              <Play
                size={15}
              />
              Start
            </button>
          ) : null}

          {canManage &&
          objective.status ===
            "ACTIVE" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "HOLD",
                  )
              }
            >
              <Pause
                size={15}
              />
              Hold
            </button>
          ) : null}

          {canManage &&
          objective.status ===
            "ON_HOLD" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "RESUME",
                  )
              }
            >
              <Play
                size={15}
              />
              Resume
            </button>
          ) : null}

          {canFinalize &&
          (
            objective.status ===
              "ACTIVE"
            ||
            objective.status ===
              "ON_HOLD"
          ) ? (
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                objective.progressPct <
                  100
              }
              onClick={
                () =>
                  void transition(
                    "ACHIEVE",
                  )
              }
            >
              <BadgeCheck
                size={15}
              />
              Mark achieved
            </button>
          ) : null}

          {canFinalize &&
          objective.status ===
            "ACHIEVED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void transition(
                    "CLOSE",
                  )
              }
            >
              Close
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

      <section className="okr-scorecard">
        <article>
          <span>
            Progress
          </span>

          <strong>
            {objective.progressPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Confidence
          </span>

          <strong>
            {objective.confidencePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            KR coverage
          </span>

          <strong>
            {objective.weightCoveragePct.toFixed(
              0,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Key results achieved
          </span>

          <strong>
            {objective.achievedKeyResultCount}
            /
            {objective.keyResultCount}
          </strong>
        </article>

        <article>
          <span>
            Snapshots
          </span>

          <strong>
            {objective.snapshotCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Strategic outcome
            </span>

            <h2>
              Objective definition
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="okr-description">
          {detail.description}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Measurable execution
            </span>

            <h2>
              Key results
            </h2>
          </div>

          <Target
            size={19}
          />
        </div>

        <div className="okr-key-result-list">
          {detail.keyResults.map(
            keyResult => (
              <article
                key={keyResult.id}
              >
                <div className="okr-kr-heading">
                  <div>
                    <span
                      className={
                        `okr-health okr-health--${keyResult.health.toLowerCase().replaceAll("_", "-")}`
                      }
                    >
                      {readable(
                        keyResult.health,
                      )}
                    </span>

                    <strong>
                      {keyResult.title}
                    </strong>

                    <small>
                      {readable(
                        keyResult.sourceType,
                      )}
                      {" · Weight "}
                      {keyResult.weightPct.toFixed(
                        0,
                      )}
                      %
                    </small>
                  </div>

                  <div>
                    <span>
                      Progress
                    </span>

                    <strong>
                      {keyResult.progressPct.toFixed(
                        1,
                      )}
                      %
                    </strong>

                    <small>
                      Confidence
                      {" "}
                      {keyResult.confidencePct.toFixed(
                        0,
                      )}
                      %
                    </small>
                  </div>
                </div>

                <div className="okr-kr-values">
                  <span>
                    Baseline
                    <strong>
                      {displayValue(
                        keyResult.baselineValue,
                        keyResult.metricType,
                        objective.currency,
                      )}
                    </strong>
                  </span>

                  <span>
                    Actual
                    <strong>
                      {displayValue(
                        keyResult.actualValue,
                        keyResult.metricType,
                        objective.currency,
                      )}
                    </strong>
                  </span>

                  <span>
                    Target
                    <strong>
                      {displayValue(
                        keyResult.targetValue,
                        keyResult.metricType,
                        objective.currency,
                      )}
                    </strong>
                  </span>
                </div>

                {keyResult.description ? (
                  <p>
                    {keyResult.description}
                  </p>
                ) : null}

                {keyResult.contributions.length >
                0 ? (
                  <div className="okr-contribution-list">
                    {keyResult.contributions.map(
                      contribution => (
                        <span
                          key={contribution.id}
                        >
                          {contribution.initiativeNumber}
                          {" · "}
                          {contribution.initiativeTitle}
                          {" · "}
                          {contribution.contributionWeightPct.toFixed(
                            0,
                          )}
                          %
                        </span>
                      ),
                    )}
                  </div>
                ) : null}

                {canManage &&
                mutable &&
                keyResult.sourceType ===
                  "MANUAL" ? (
                  <div className="okr-manual-control">
                    <input
                      type="number"
                      step="0.01"
                      placeholder={
                        "Actual value"
                      }
                      value={
                        manualActuals[
                          keyResult.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setManualActuals(
                            current => ({
                              ...current,
                              [keyResult.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <input
                      placeholder={
                        "Evidence note"
                      }
                      value={
                        manualNotes[
                          keyResult.id
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setManualNotes(
                            current => ({
                              ...current,
                              [keyResult.id]:
                                event.target.value,
                            }),
                          )
                      }
                    />

                    <button
                      type="button"
                      disabled={running}
                      onClick={
                        () =>
                          void updateManual(
                            keyResult.id,
                          )
                      }
                    >
                      Update
                    </button>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {detail.keyResults.length ===
          0 ? (
            <div className="okr-empty">
              No key results defined.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      mutable ? (
        <section className="okr-detail-grid">
          <form
            className="panel"
            onSubmit={addKeyResult}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Measurement
                </span>

                <h2>
                  Add key result
                </h2>
              </div>

              <Plus
                size={19}
              />
            </div>

            <div className="okr-form-grid">
              <label className="request-field okr-form-wide">
                <span>
                  Title
                </span>

                <input
                  required
                  value={krTitle}
                  onChange={
                    event =>
                      setKrTitle(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Metric
                </span>

                <select
                  value={metricType}
                  onChange={
                    event =>
                      setMetricType(
                        event.target.value as
                          KeyResultMetricType,
                      )
                  }
                >
                  <option value="PERCENTAGE">
                    Percentage
                  </option>

                  <option value="COUNT">
                    Count
                  </option>

                  <option value="CURRENCY">
                    Currency
                  </option>

                  <option value="HOURS">
                    Hours
                  </option>

                  <option value="NUMBER">
                    Number
                  </option>
                </select>
              </label>

              <label className="request-field">
                <span>
                  Direction
                </span>

                <select
                  value={direction}
                  onChange={
                    event =>
                      setDirection(
                        event.target.value as
                          KeyResultDirection,
                      )
                  }
                >
                  <option value="INCREASE">
                    Increase
                  </option>

                  <option value="DECREASE">
                    Decrease
                  </option>
                </select>
              </label>

              <label className="request-field okr-form-wide">
                <span>
                  Actual-value authority
                </span>

                <select
                  value={sourceType}
                  onChange={
                    event => {
                      setSourceType(
                        event.target.value as
                          KeyResultSourceType,
                      );

                      setScopeKey("");
                    }
                  }
                >
                  <option value="MANUAL">
                    Controlled manual
                  </option>

                  <option value="OPERATING_RHYTHM_SLA_ATTAINMENT">
                    Operating rhythm — SLA attainment
                  </option>

                  <option value="OPERATING_RHYTHM_ACTIVE_BACKLOG">
                    Operating rhythm — active backlog
                  </option>

                  <option value="OPERATING_RHYTHM_SLA_OVERDUE">
                    Operating rhythm — SLA overdue
                  </option>

                  <option value="OPERATING_RHYTHM_PERSISTENT_BACKLOG">
                    Operating rhythm — persistent backlog
                  </option>

                  <option value="OPERATING_RHYTHM_AVG_RESOLUTION_HOURS">
                    Operating rhythm — avg resolution hours
                  </option>

                  <option value="OPERATING_RHYTHM_ACTIVE_EXPOSURE">
                    Operating rhythm — active exposure
                  </option>

                  <option value="CONTINUOUS_IMPROVEMENT_ACTIVE_INITIATIVES">
                    Improvement — active initiatives
                  </option>

                  <option value="CONTINUOUS_IMPROVEMENT_COMPLETED_INITIATIVES">
                    Improvement — completed initiatives
                  </option>

                  <option value="CONTINUOUS_IMPROVEMENT_IMPROVED_INITIATIVES">
                    Improvement — improved initiatives
                  </option>

                  <option value="CONTINUOUS_IMPROVEMENT_COMPLETION_RATE">
                    Improvement — completion rate
                  </option>
                </select>
              </label>

              {sourceType.startsWith(
                "OPERATING_RHYTHM_",
              ) ? (
                <>
                  <label className="request-field">
                    <span>
                      Scope
                    </span>

                    <select
                      value={scopeType}
                      onChange={
                        event => {
                          setScopeType(
                            event.target.value as
                              OkrSourceScopeType,
                          );

                          setScopeKey("");
                        }
                      }
                    >
                      <option value="OVERALL">
                        Overall
                      </option>

                      <option value="DOMAIN">
                        Domain
                      </option>

                      <option value="OWNER">
                        Owner
                      </option>

                      <option value="SEVERITY">
                        Severity
                      </option>

                      <option value="EXCEPTION_TYPE">
                        Exception type
                      </option>
                    </select>
                  </label>

                  {scopeType !==
                  "OVERALL" ? (
                    <label className="request-field">
                      <span>
                        Scope value
                      </span>

                      <select
                        required
                        value={scopeKey}
                        onChange={
                          event =>
                            setScopeKey(
                              event.target.value,
                            )
                        }
                      >
                        <option value="">
                          Select scope
                        </option>

                        {operatingScopes.map(
                          scope => (
                            <option
                              key={scope.scopeKey}
                              value={scope.scopeKey}
                            >
                              {scope.scopeLabel}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}

              <label className="request-field">
                <span>
                  Baseline
                </span>

                <input
                  type="number"
                  step="0.01"
                  value={baseline}
                  onChange={
                    event =>
                      setBaseline(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Target
                </span>

                <input
                  type="number"
                  step="0.01"
                  value={target}
                  onChange={
                    event =>
                      setTarget(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Weight %
                </span>

                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={weight}
                  onChange={
                    event =>
                      setWeight(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field okr-form-wide">
                <span>
                  Description
                </span>

                <textarea
                  rows={4}
                  value={krDescription}
                  onChange={
                    event =>
                      setKrDescription(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="okr-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !krTitle.trim()
                }
              >
                Add key result
              </button>
            </div>
          </form>

          <form
            className="panel"
            onSubmit={addContribution}
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Strategy contribution
                </span>

                <h2>
                  Map improvement initiative
                </h2>
              </div>

              <Target
                size={19}
              />
            </div>

            <div className="okr-form-grid">
              <label className="request-field okr-form-wide">
                <span>
                  Key result
                </span>

                <select
                  value={contributionKrId}
                  onChange={
                    event =>
                      setContributionKrId(
                        event.target.value,
                      )
                  }
                >
                  <option value="">
                    Select key result
                  </option>

                  {detail.keyResults.map(
                    keyResult => (
                      <option
                        key={keyResult.id}
                        value={keyResult.id}
                      >
                        {keyResult.title}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field okr-form-wide">
                <span>
                  Improvement initiative
                </span>

                <select
                  value={improvementId}
                  onChange={
                    event =>
                      setImprovementId(
                        event.target.value,
                      )
                  }
                >
                  <option value="">
                    Select initiative
                  </option>

                  {context
                    ?.improvementInitiatives
                    .map(
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
                  Contribution %
                </span>

                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={contributionWeight}
                  onChange={
                    event =>
                      setContributionWeight(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field okr-form-wide">
                <span>
                  Contribution rationale
                </span>

                <textarea
                  rows={5}
                  required
                  value={contributionRationale}
                  onChange={
                    event =>
                      setContributionRationale(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="okr-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !contributionKrId
                  ||
                  !improvementId
                  ||
                  !contributionRationale.trim()
                }
              >
                Map contribution
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Executive progress record
            </span>

            <h2>
              Immutable OKR snapshots
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
                <th>Progress</th>
                <th>Health</th>
                <th>Confidence</th>
                <th>Key results</th>
                <th>Captured</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.snapshots.map(
                snapshotItem => (
                  <tr
                    key={snapshotItem.id}
                  >
                    <td>
                      <strong>
                        {snapshotItem.snapshotNumber}
                      </strong>
                    </td>

                    <td>
                      {snapshotItem.overallProgressPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      <span
                        className={
                          `okr-health okr-health--${snapshotItem.overallHealth.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          snapshotItem.overallHealth,
                        )}
                      </span>
                    </td>

                    <td>
                      {snapshotItem.overallConfidencePct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {snapshotItem.achievedKeyResultCount}
                      /
                      {snapshotItem.keyResultCount}
                    </td>

                    <td>
                      {new Date(
                        snapshotItem.capturedAt,
                      )
                        .toLocaleString()}
                    </td>

                    <td>
                      <Link
                        href={
                          `/strategic-objectives/snapshots/${snapshotItem.id}`
                        }
                        className="table-action"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ),
              )}

              {detail.snapshots.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No executive OKR
                    snapshots captured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canFinalize &&
      mutable ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance
              </span>

              <h2>
                Cancel objective
              </h2>
            </div>

            <XCircle
              size={19}
            />
          </div>

          <div className="okr-cancel-control">
            <input
              value={cancellationNote}
              placeholder={
                "Required cancellation rationale"
              }
              onChange={
                event =>
                  setCancellationNote(
                    event.target.value,
                  )
              }
            />

            <button
              type="button"
              className="okr-danger-button"
              disabled={
                running
                ||
                !cancellationNote.trim()
              }
              onClick={
                () =>
                  void transition(
                    "CANCEL",
                  )
              }
            >
              Cancel objective
            </button>
          </div>
        </section>
      ) : null}

      <section className="okr-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Authority-preserving strategy execution
          </strong>

          <p>
            Strategic objectives read
            operational evidence from
            Steps 43 and 44 but never
            rewrite those authorities.
            Executive OKR snapshots are
            immutable once captured.
          </p>
        </div>
      </section>
    </div>
  );
}
