"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Flag,
  Layers3,
  Play,
  Plus,
  Target,
  XCircle,
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
  cancelCategoryInitiative,
  cancelCategoryMilestone,
  completeCategoryInitiative,
  completeCategoryMilestone,
  createCategoryInitiative,
  createCategoryMilestone,
  getCategoryManagementContext,
  getCategoryStrategy,
  readyCategoryInitiative,
  startCategoryInitiative,
  updateCategoryStrategyStatus,
} from "@/lib/api";

import type {
  CategoryContext,
  CategoryInitiative,
  CategoryInitiativePriority,
  CategoryInitiativeType,
  CategoryStrategyDetail,
  CategoryStrategyStatus,
} from "@/types/category-management";

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

function defaultEndDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 90,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

function defaultMilestoneDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 30,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function CategoryStrategyDetailPage() {
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
      CategoryStrategyDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      CategoryContext |
      null
    >(null);

  const [
    initiativeType,
    setInitiativeType,
  ] =
    useState<CategoryInitiativeType>(
      "SOURCING_WAVE",
    );

  const [
    initiativePriority,
    setInitiativePriority,
  ] =
    useState<CategoryInitiativePriority>(
      "HIGH",
    );

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
    initiativeOwner,
    setInitiativeOwner,
  ] =
    useState("");

  const [
    plannedStartDate,
    setPlannedStartDate,
  ] =
    useState(
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),
    );

  const [
    plannedEndDate,
    setPlannedEndDate,
  ] =
    useState(
      defaultEndDate(),
    );

  const [
    estimatedValue,
    setEstimatedValue,
  ] =
    useState(0);

  const [
    targetSavings,
    setTargetSavings,
  ] =
    useState(0);

  const [
    completionSavings,
    setCompletionSavings,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    milestoneTitles,
    setMilestoneTitles,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    milestoneDates,
    setMilestoneDates,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    milestoneNotes,
    setMilestoneNotes,
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

  const canCancel =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getCategoryStrategy(
      params.id,
    )
      .then(
        async response => {
          if (!active) {
            return;
          }

          const contextResponse =
            await getCategoryManagementContext(
              response.strategy.currency,
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

          const owner =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (owner) {
            setInitiativeOwner(
              owner.id,
            );
          }

          setEstimatedValue(
            response.currentInsight.totalSpend,
          );

          setTargetSavings(
            Math.min(
              response.strategy.savingsTargetAmount,
              response.currentInsight.modeledOpportunityAmount,
            ),
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
              : "Unable to load category strategy.",
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
    setDetail(
      await getCategoryStrategy(
        params.id,
      ),
    );
  }

  async function changeStrategyStatus(
    status:
      CategoryStrategyStatus,
  ) {
    try {
      setRunning(true);
      setError(null);

      await updateCategoryStrategyStatus(
        params.id,
        status,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update category strategy.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createInitiative(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createCategoryInitiative(
        params.id,
        {
          initiativeType,
          title:
            initiativeTitle.trim(),
          description:
            initiativeDescription.trim()
            ||
            undefined,
          priority:
            initiativePriority,
          ownerUserId:
            initiativeOwner
            ||
            undefined,
          plannedStartDate:
            plannedStartDate
            ||
            undefined,
          plannedEndDate:
            plannedEndDate
            ||
            undefined,
          estimatedValue,
          targetSavings,
        },
      );

      setInitiativeTitle("");
      setInitiativeDescription("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create category initiative.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function progressInitiative(
    initiative:
      CategoryInitiative,
    action:
      "READY"
      |
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
        "READY"
      ) {
        await readyCategoryInitiative(
          initiative.id,
        );
      } else if (
        action ===
        "START"
      ) {
        await startCategoryInitiative(
          initiative.id,
        );
      } else if (
        action ===
        "COMPLETE"
      ) {
        const value =
          Number(
            completionSavings[
              initiative.id
            ]
            ??
            "0",
          );

        await completeCategoryInitiative(
          initiative.id,
          value,
        );
      } else {
        await cancelCategoryInitiative(
          initiative.id,
        );
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update category initiative.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createMilestone(
    initiative:
      CategoryInitiative,
  ) {
    const title =
      milestoneTitles[
        initiative.id
      ]
      ??
      "";

    const dueDate =
      milestoneDates[
        initiative.id
      ]
      ??
      defaultMilestoneDate();

    if (!title.trim()) {
      setError(
        "Milestone title is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createCategoryMilestone(
        initiative.id,
        {
          title:
            title.trim(),
          dueDate,
        },
      );

      setMilestoneTitles(
        current => ({
          ...current,
          [initiative.id]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create category milestone.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function completeMilestone(
    milestoneId: string,
  ) {
    const note =
      milestoneNotes[
        milestoneId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Milestone completion note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await completeCategoryMilestone(
        milestoneId,
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
          : "Unable to complete category milestone.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelMilestone(
    milestoneId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await cancelCategoryMilestone(
        milestoneId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel category milestone.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading category strategy...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/category-management"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Category management
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Category strategy not found."}
        </div>
      </div>
    );
  }

  const {
    strategy,
    currentInsight,
    supplierLandscape,
    initiatives,
  } = detail;

  const editable =
    strategy.status !==
      "CLOSED"
    &&
    strategy.status !==
      "ARCHIVED";

  return (
    <div className="page-stack">
      <Link
        href="/category-management"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Category management
      </Link>

      <section className="category-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {strategy.strategyCode}
            </span>

            <span
              className={
                `category-strategy-status category-strategy-status--${strategy.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                strategy.status,
              )}
            </span>

            <span
              className={
                `category-matrix category-matrix--${strategy.matrixPosition.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                strategy.matrixPosition,
              )}
            </span>
          </div>

          <h1>
            {strategy.categoryName}
          </h1>

          <p>
            FY {strategy.fiscalYear}
            {" · "}
            {strategy.currency}
            {" · Owner: "}
            {strategy.ownerName}
          </p>
        </div>

        {canManage ? (
          <div className="category-status-actions">
            {strategy.status ===
            "DRAFT" ? (
              <button
                type="button"
                className="button button--primary"
                disabled={running}
                onClick={
                  () =>
                    void changeStrategyStatus(
                      "ACTIVE",
                    )
                }
              >
                Activate strategy
              </button>
            ) : null}

            {strategy.status ===
            "ACTIVE" ? (
              <>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={running}
                  onClick={
                    () =>
                      void changeStrategyStatus(
                        "ON_HOLD",
                      )
                  }
                >
                  Put on hold
                </button>

                <button
                  type="button"
                  className="button button--primary"
                  disabled={running}
                  onClick={
                    () =>
                      void changeStrategyStatus(
                        "CLOSED",
                      )
                  }
                >
                  Close strategy
                </button>
              </>
            ) : null}

            {strategy.status ===
            "ON_HOLD" ? (
              <button
                type="button"
                className="button button--primary"
                disabled={running}
                onClick={
                  () =>
                    void changeStrategyStatus(
                      "ACTIVE",
                    )
                }
              >
                Resume strategy
              </button>
            ) : null}

            {strategy.status ===
            "CLOSED" ? (
              <button
                type="button"
                className="button button--secondary"
                disabled={running}
                onClick={
                  () =>
                    void changeStrategyStatus(
                      "ARCHIVED",
                    )
                }
              >
                Archive
              </button>
            ) : null}
          </div>
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

      <section className="category-detail-kpis">
        <article>
          <span>
            Baseline spend
          </span>

          <strong>
            {money(
              strategy.spendBaseline,
              strategy.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Current spend
          </span>

          <strong>
            {money(
              strategy.currentSpend,
              strategy.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Savings target
          </span>

          <strong>
            {money(
              strategy.savingsTargetAmount,
              strategy.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Realized
          </span>

          <strong>
            {money(
              strategy.realizedSavings,
              strategy.currency,
            )}
            {" · "}
            {strategy.realizationPct.toFixed(
              0,
            )}
            %
          </strong>
        </article>
      </section>

      <section className="category-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Strategy thesis
              </span>

              <h2>
                Objectives
              </h2>
            </div>

            <Target
              size={19}
            />
          </div>

          <div className="category-objectives">
            {detail.objectives}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Current intelligence
              </span>

              <h2>
                Risk / value position
              </h2>
            </div>

            <Layers3
              size={19}
            />
          </div>

          <div className="category-current-intelligence">
            <div>
              <span>
                Value score
              </span>

              <strong>
                {currentInsight.strategicValueScore.toFixed(
                  0,
                )}
              </strong>
            </div>

            <div>
              <span>
                Risk score
              </span>

              <strong>
                {currentInsight.weightedSupplierRiskScore.toFixed(
                  0,
                )}
              </strong>
            </div>

            <div>
              <span>
                Suppliers
              </span>

              <strong>
                {currentInsight.supplierCount}
              </strong>
            </div>

            <div>
              <span>
                Top supplier
              </span>

              <strong>
                {currentInsight.topSupplierSpendShare.toFixed(
                  1,
                )}
                %
              </strong>
            </div>

            <div>
              <span>
                Modeled opportunity
              </span>

              <strong>
                {money(
                  currentInsight.modeledOpportunityAmount,
                  currentInsight.currency,
                )}
              </strong>
            </div>

            <div>
              <span>
                Matrix
              </span>

              <strong>
                {readable(
                  currentInsight.matrixPosition,
                )}
              </strong>
            </div>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Supply market
            </span>

            <h2>
              Supplier landscape
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Country</th>
                <th>Spend</th>
                <th>Share</th>
                <th>Risk score</th>
                <th>Risk band</th>
              </tr>
            </thead>

            <tbody>
              {supplierLandscape.map(
                supplier => (
                  <tr
                    key={supplier.supplierId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {supplier.supplierName}
                        </strong>

                        <span>
                          {supplier.supplierCode}
                        </span>
                      </div>
                    </td>

                    <td>
                      {supplier.country ??
                        "—"}
                    </td>

                    <td>
                      {money(
                        supplier.spend,
                        strategy.currency,
                      )}
                    </td>

                    <td>
                      {supplier.spendShare.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {supplier.continuousRiskScore !==
                      null
                        ? supplier.continuousRiskScore.toFixed(
                            1,
                          )
                        : "Not evaluated"}
                    </td>

                    <td>
                      {supplier.continuousRiskBand ??
                        "—"}
                    </td>
                  </tr>
                ),
              )}

              {supplierLandscape.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="table-empty-state"
                  >
                    No supplier landscape
                    records are available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Sourcing roadmap
            </span>

            <h2>
              Category initiatives
            </h2>
          </div>

          <Flag
            size={19}
          />
        </div>

        <div className="category-initiative-list">
          {initiatives.map(
            initiative => (
              <article
                key={initiative.id}
                className={
                  initiative.overdue
                    ? "category-initiative category-initiative--overdue"
                    : "category-initiative"
                }
              >
                <div className="category-initiative-heading">
                  <div>
                    <span
                      className={
                        `category-initiative-status category-initiative-status--${initiative.status.toLowerCase().replaceAll("_", "-")}`
                      }
                    >
                      {readable(
                        initiative.status,
                      )}
                    </span>

                    <strong>
                      {initiative.title}
                    </strong>

                    <small>
                      {initiative.initiativeNumber}
                      {" · "}
                      {readable(
                        initiative.initiativeType,
                      )}
                      {" · "}
                      {initiative.ownerName}
                    </small>
                  </div>

                  <div>
                    <span>
                      Target savings
                    </span>

                    <strong>
                      {money(
                        initiative.targetSavings,
                        strategy.currency,
                      )}
                    </strong>

                    <small>
                      Realized
                      {" "}
                      {initiative.realizationPct.toFixed(
                        0,
                      )}
                      %
                    </small>
                  </div>
                </div>

                {initiative.description ? (
                  <p>
                    {initiative.description}
                  </p>
                ) : null}

                <div className="category-initiative-meta">
                  <span>
                    Priority:
                    {" "}
                    <strong>
                      {initiative.priority}
                    </strong>
                  </span>

                  <span>
                    Start:
                    {" "}
                    <strong>
                      {initiative.plannedStartDate ??
                        "—"}
                    </strong>
                  </span>

                  <span
                    className={
                      initiative.overdue
                        ? "category-overdue"
                        : ""
                    }
                  >
                    End:
                    {" "}
                    <strong>
                      {initiative.plannedEndDate ??
                        "—"}
                    </strong>
                  </span>

                  <span>
                    Value:
                    {" "}
                    <strong>
                      {money(
                        initiative.estimatedValue,
                        strategy.currency,
                      )}
                    </strong>
                  </span>
                </div>

                {canManage &&
                editable &&
                initiative.status !==
                  "COMPLETED" &&
                initiative.status !==
                  "CANCELLED" ? (
                  <div className="category-initiative-controls">
                    {initiative.status ===
                    "PLANNED" ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void progressInitiative(
                              initiative,
                              "READY",
                            )
                        }
                      >
                        Ready
                      </button>
                    ) : null}

                    {initiative.status ===
                      "PLANNED"
                    ||
                    initiative.status ===
                      "READY" ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void progressInitiative(
                              initiative,
                              "START",
                            )
                        }
                      >
                        <Play
                          size={13}
                        />
                        Start
                      </button>
                    ) : null}

                    {initiative.status ===
                    "IN_PROGRESS" ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={
                            "Realized savings"
                          }
                          value={
                            completionSavings[
                              initiative.id
                            ]
                            ??
                            ""
                          }
                          onChange={
                            event =>
                              setCompletionSavings(
                                current => ({
                                  ...current,
                                  [initiative.id]:
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
                              void progressInitiative(
                                initiative,
                                "COMPLETE",
                              )
                          }
                        >
                          <BadgeCheck
                            size={13}
                          />
                          Complete
                        </button>
                      </>
                    ) : null}

                    {canCancel ? (
                      <button
                        type="button"
                        className="category-danger-button"
                        disabled={running}
                        onClick={
                          () =>
                            void progressInitiative(
                              initiative,
                              "CANCEL",
                            )
                        }
                      >
                        <XCircle
                          size={13}
                        />
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="category-milestone-section">
                  <strong>
                    Milestones
                  </strong>

                  <div className="category-milestone-list">
                    {initiative.milestones.map(
                      milestone => (
                        <div
                          key={milestone.id}
                          className={
                            milestone.overdue
                              ? "category-milestone category-milestone--overdue"
                              : "category-milestone"
                          }
                        >
                          <div>
                            <span>
                              {readable(
                                milestone.status,
                              )}
                            </span>

                            <strong>
                              {milestone.title}
                            </strong>

                            <small>
                              Due
                              {" "}
                              {milestone.dueDate}
                            </small>
                          </div>

                          {canManage &&
                          editable &&
                          milestone.status ===
                            "OPEN" ? (
                            <div className="category-milestone-controls">
                              <input
                                value={
                                  milestoneNotes[
                                    milestone.id
                                  ]
                                  ??
                                  ""
                                }
                                placeholder={
                                  "Completion note"
                                }
                                onChange={
                                  event =>
                                    setMilestoneNotes(
                                      current => ({
                                        ...current,
                                        [milestone.id]:
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
                                    milestoneNotes[
                                      milestone.id
                                    ]
                                    ??
                                    ""
                                  )
                                    .trim()
                                }
                                onClick={
                                  () =>
                                    void completeMilestone(
                                      milestone.id,
                                    )
                                }
                              >
                                <BadgeCheck
                                  size={12}
                                />
                              </button>

                              {canCancel ? (
                                <button
                                  type="button"
                                  className="category-danger-button"
                                  disabled={running}
                                  onClick={
                                    () =>
                                      void cancelMilestone(
                                        milestone.id,
                                      )
                                  }
                                >
                                  <XCircle
                                    size={12}
                                  />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ),
                    )}

                    {initiative.milestones.length ===
                    0 ? (
                      <div className="category-milestone-empty">
                        No milestones.
                      </div>
                    ) : null}
                  </div>

                  {canManage &&
                  editable &&
                  initiative.status !==
                    "COMPLETED" &&
                  initiative.status !==
                    "CANCELLED" ? (
                    <div className="category-new-milestone">
                      <input
                        value={
                          milestoneTitles[
                            initiative.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "New milestone"
                        }
                        onChange={
                          event =>
                            setMilestoneTitles(
                              current => ({
                                ...current,
                                [initiative.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <input
                        type="date"
                        value={
                          milestoneDates[
                            initiative.id
                          ]
                          ??
                          defaultMilestoneDate()
                        }
                        onChange={
                          event =>
                            setMilestoneDates(
                              current => ({
                                ...current,
                                [initiative.id]:
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
                            milestoneTitles[
                              initiative.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void createMilestone(
                              initiative,
                            )
                        }
                      >
                        <Plus
                          size={13}
                        />
                        Add
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ),
          )}

          {initiatives.length ===
          0 ? (
            <div className="category-empty">
              No sourcing or category
              initiatives have been
              created.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      editable ? (
        <form
          className="panel"
          onSubmit={createInitiative}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Pipeline development
              </span>

              <h2>
                Add category initiative
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="category-form-grid">
            <label className="request-field">
              <span>
                Initiative type
              </span>

              <select
                value={initiativeType}
                onChange={
                  event =>
                    setInitiativeType(
                      event.target.value as
                        CategoryInitiativeType,
                    )
                }
              >
                <option value="SOURCING_WAVE">
                  Sourcing wave
                </option>

                <option value="NEGOTIATION">
                  Negotiation
                </option>

                <option value="CONSOLIDATION">
                  Consolidation
                </option>

                <option value="SUPPLIER_DIVERSIFICATION">
                  Supplier diversification
                </option>

                <option value="DEMAND_MANAGEMENT">
                  Demand management
                </option>

                <option value="CONTRACT_RENEWAL">
                  Contract renewal
                </option>

                <option value="RISK_MITIGATION">
                  Risk mitigation
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Priority
              </span>

              <select
                value={initiativePriority}
                onChange={
                  event =>
                    setInitiativePriority(
                      event.target.value as
                        CategoryInitiativePriority,
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

            <label className="request-field category-form-wide">
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
                Owner
              </span>

              <select
                value={initiativeOwner}
                onChange={
                  event =>
                    setInitiativeOwner(
                      event.target.value,
                    )
                }
              >
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

            <label className="request-field">
              <span>
                Start date
              </span>

              <input
                type="date"
                value={plannedStartDate}
                onChange={
                  event =>
                    setPlannedStartDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                End date
              </span>

              <input
                type="date"
                value={plannedEndDate}
                onChange={
                  event =>
                    setPlannedEndDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Estimated value
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={estimatedValue}
                onChange={
                  event =>
                    setEstimatedValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Target savings
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={targetSavings}
                onChange={
                  event =>
                    setTargetSavings(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field category-form-wide">
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

          <div className="category-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !initiativeTitle.trim()
              }
            >
              <Plus
                size={16}
              />
              Add initiative
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
