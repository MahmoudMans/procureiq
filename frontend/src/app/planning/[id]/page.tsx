"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CalendarRange,
  Check,
  CircleAlert,
  Link2,
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
  activateProcurementPlan,
  addProcurementPlanItem,
  cancelPlanningItem,
  closeProcurementPlan,
  completePlanningItem,
  getPlanningContextOptions,
  getProcurementPlan,
  linkPlanningItemRequest,
  markPlanningItemReady,
} from "@/lib/api";

import type {
  PlanningContextOptions,
  ProcurementPlanDetail,
  ProcurementPlanItem,
  ProcurementPlanPriority,
} from "@/types/planning";

function money(
  value: number,
  currency: string,
): string {
  return new Intl
    .NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      },
    )
    .format(value);
}

function fiscalDate(
  year: number,
): string {
  return `${year}-06-01`;
}

export default function PlanDetailPage() {
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
      ProcurementPlanDetail |
      null
    >(null);

  const [
    options,
    setOptions,
  ] =
    useState<
      PlanningContextOptions |
      null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    departmentId,
    setDepartmentId,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState("");

  const [
    plannedValue,
    setPlannedValue,
  ] =
    useState(10000);

  const [
    targetDate,
    setTargetDate,
  ] =
    useState("");

  const [
    priority,
    setPriority,
  ] =
    useState<
      ProcurementPlanPriority
    >(
      "MEDIUM",
    );

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    linkSelections,
    setLinkSelections,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    lifecycleRunning,
    setLifecycleRunning,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const canManage =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER";

  async function load() {
    const [
      detailResponse,
      contextResponse,
    ] =
      await Promise.all([
        getProcurementPlan(
          params.id,
        ),
        getPlanningContextOptions(),
      ]);

    setDetail(
      detailResponse,
    );

    setOptions(
      contextResponse,
    );

    if (
      !departmentId &&
      contextResponse
        .departments
        .length > 0
    ) {
      setDepartmentId(
        contextResponse
          .departments[0]
          .id,
      );
    }

    if (
      !category &&
      contextResponse
        .categories
        .length > 0
    ) {
      setCategory(
        contextResponse
          .categories[0],
      );
    }

    if (!targetDate) {
      setTargetDate(
        fiscalDate(
          detailResponse
            .plan
            .fiscalYear,
        ),
      );
    }
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      getProcurementPlan(
        params.id,
      ),
      getPlanningContextOptions(),
    ])
      .then(
        ([
          detailResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            detailResponse,
          );

          setOptions(
            contextResponse,
          );

          if (
            contextResponse
              .departments
              .length > 0
          ) {
            setDepartmentId(
              contextResponse
                .departments[0]
                .id,
            );
          }

          if (
            contextResponse
              .categories
              .length > 0
          ) {
            setCategory(
              contextResponse
                .categories[0],
            );
          }

          setTargetDate(
            fiscalDate(
              detailResponse
                .plan
                .fiscalYear,
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
              : "Unable to load procurement plan.",
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

  async function addItem(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await addProcurementPlanItem(
        detail.plan.id,
        {
          title:
            title.trim(),
          description:
            description
              .trim() ||
            undefined,
          departmentId,
          category:
            category.trim(),
          plannedValue,
          targetSourcingDate:
            targetDate,
          priority,
          notes:
            notes.trim() ||
            undefined,
        },
      );

      setTitle("");
      setDescription("");
      setPlannedValue(
        10000,
      );
      setNotes("");

      await load();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add planning initiative.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function runPlanLifecycle(
    action:
      "ACTIVATE" |
      "CLOSE",
  ) {
    if (!detail) {
      return;
    }

    try {
      setLifecycleRunning(
        true,
      );

      setError(null);

      if (
        action ===
        "ACTIVATE"
      ) {
        await activateProcurementPlan(
          detail.plan.id,
        );
      } else {
        await closeProcurementPlan(
          detail.plan.id,
        );
      }

      await load();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update procurement plan.",
      );
    } finally {
      setLifecycleRunning(
        false,
      );
    }
  }

  async function markReady(
    itemId: string,
  ) {
    try {
      await markPlanningItemReady(
        itemId,
      );

      await load();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to mark initiative ready.",
      );
    }
  }

  async function linkRequest(
    item:
      ProcurementPlanItem,
  ) {
    const requestId =
      linkSelections[
        item.id
      ];

    if (!requestId) {
      setError(
        "Select a purchase request to link.",
      );

      return;
    }

    try {
      setError(null);

      await linkPlanningItemRequest(
        item.id,
        requestId,
      );

      await load();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to link purchase request.",
      );
    }
  }

  async function complete(
    itemId: string,
  ) {
    try {
      await completePlanningItem(
        itemId,
      );

      await load();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to complete initiative.",
      );
    }
  }

  async function cancel(
    itemId: string,
  ) {
    try {
      await cancelPlanningItem(
        itemId,
      );

      await load();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel initiative.",
      );
    }
  }

  if (loading) {
    return (
      <div
        className={
          "request-detail-loading"
        }
      >
        Loading procurement plan...
      </div>
    );
  }

  if (!detail) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href="/planning"
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />

          Procurement planning
        </Link>

        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error ??
            "Procurement plan not found."}
        </div>
      </div>
    );
  }

  const {
    plan,
    items,
  } = detail;

  return (
    <div
      className={
        "page-stack"
      }
    >
      <Link
        href="/planning"
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Procurement planning
      </Link>

      <section
        className={
          "planning-detail-heading"
        }
      >
        <div>
          <div
            className={
              "request-detail-heading__meta"
            }
          >
            <span>
              {
                plan.planNumber
              }
            </span>

            <span
              className={
                `planning-status planning-status--${
                  plan.status
                    .toLowerCase()
                }`
              }
            >
              {
                plan.status
              }
            </span>
          </div>

          <h1>
            {plan.name}
          </h1>

          <p>
            {
              plan.fiscalYear
            }
            {" · "}
            {
              plan.currency
            }
            {" · Owner: "}
            {
              plan.ownerName
            }
          </p>
        </div>

        {canManage ? (
          <div
            className={
              "planning-detail-actions"
            }
          >
            {plan.status ===
            "DRAFT" ? (
              <button
                type="button"
                className={
                  "button button--primary"
                }
                disabled={
                  lifecycleRunning
                }
                onClick={
                  () =>
                    void runPlanLifecycle(
                      "ACTIVATE",
                    )
                }
              >
                <CalendarCheck
                  size={16}
                />
                Activate
              </button>
            ) : null}

            {(
              plan.status ===
              "ACTIVE" ||
              plan.status ===
              "DRAFT"
            ) ? (
              <button
                type="button"
                className={
                  "button button--secondary"
                }
                disabled={
                  lifecycleRunning
                }
                onClick={
                  () =>
                    void runPlanLifecycle(
                      "CLOSE",
                    )
                }
              >
                <XCircle
                  size={16}
                />
                Close plan
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section
        className={
          "planning-detail-kpis"
        }
      >
        <article
          className={
            "request-detail-summary-card"
          }
        >
          <CalendarRange
            size={18}
          />

          <div>
            <span>
              Planned value
            </span>

            <strong>
              {
                money(
                  plan.plannedValue,
                  plan.currency,
                )
              }
            </strong>

            <small>
              {
                plan.totalItems
              }
              {" initiatives"}
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <Link2 size={18} />

          <div>
            <span>
              Linked actual
            </span>

            <strong>
              {
                money(
                  plan.linkedActualValue,
                  plan.currency,
                )
              }
            </strong>

            <small>
              {
                plan.convertedItems
              }
              {" linked"}
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <Target size={18} />

          <div>
            <span>
              Conversion
            </span>

            <strong>
              {
                plan.conversionRate
                  .toFixed(1)
              }
              %
            </strong>

            <small>
              {
                plan.completedItems
              }
              {" completed"}
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <CalendarCheck
            size={18}
          />

          <div>
            <span>
              Variance
            </span>

            <strong>
              {
                money(
                  plan.variance,
                  plan.currency,
                )
              }
            </strong>

            <small>
              Actual minus plan
            </small>
          </div>
        </article>
      </section>

      <section
        className={
          "panel"
        }
      >
        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Annual demand
            </span>

            <h2>
              Planned initiatives
            </h2>
          </div>
        </div>

        <div
          className={
            "planning-item-list"
          }
        >
          {items.map(
            item => (
              <article
                key={
                  item.id
                }
                className={
                  `planning-item-card ${
                    item.overdue
                      ? "planning-item-card--overdue"
                      : ""
                  }`
                }
              >
                <div
                  className={
                    "planning-item-card__heading"
                  }
                >
                  <div>
                    <div
                      className={
                        "planning-item-tags"
                      }
                    >
                      <span
                        className={
                          `planning-priority planning-priority--${
                            item.priority
                              .toLowerCase()
                          }`
                        }
                      >
                        {
                          item.priority
                        }
                      </span>

                      <span
                        className={
                          `planning-status planning-status--${
                            item.status
                              .toLowerCase()
                          }`
                        }
                      >
                        {
                          item.status
                        }
                      </span>
                    </div>

                    <strong>
                      {
                        item.title
                      }
                    </strong>

                    <span>
                      {
                        item.departmentName
                      }
                      {" · "}
                      {
                        item.category
                      }
                    </span>
                  </div>

                  <strong>
                    {
                      money(
                        item
                          .plannedValue,
                        plan.currency,
                      )
                    }
                  </strong>
                </div>

                <div
                  className={
                    "planning-item-metrics"
                  }
                >
                  <div>
                    <span>Target</span>
                    <strong>
                      {
                        new Date(
                          `${item.targetSourcingDate}T00:00:00`,
                        )
                          .toLocaleDateString()
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Linked request
                    </span>
                    <strong>
                      {
                        item
                          .linkedRequestNumber ??
                        "Not linked"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Actual value
                    </span>
                    <strong>
                      {item
                        .linkedRequestValue !==
                      null
                        ? money(
                            item
                              .linkedRequestValue,
                            plan.currency,
                          )
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Variance
                    </span>
                    <strong>
                      {item
                        .linkedPurchaseRequestId
                        ? money(
                            item.variance,
                            plan.currency,
                          )
                        : "—"}
                    </strong>
                  </div>
                </div>

                {canManage &&
                (
                  item.status ===
                  "PLANNED" ||
                  item.status ===
                  "READY"
                ) ? (
                  <div
                    className={
                      "planning-item-actions"
                    }
                  >
                    {item.status ===
                    "PLANNED" ? (
                      <button
                        type="button"
                        className={
                          "planning-inline-action"
                        }
                        onClick={
                          () =>
                            void markReady(
                              item.id,
                            )
                        }
                      >
                        <Check
                          size={14}
                        />
                        Mark ready
                      </button>
                    ) : null}

                    <select
                      value={
                        linkSelections[
                          item.id
                        ] ??
                        ""
                      }
                      onChange={
                        event =>
                          setLinkSelections(
                            current => ({
                              ...current,
                              [
                                item.id
                              ]:
                                event
                                  .target
                                  .value,
                            }),
                          )
                      }
                    >
                      <option value="">
                        Select matching request
                      </option>

                      {options
                        ?.purchaseRequests
                        .filter(
                          request =>
                            request.departmentId ===
                              item.departmentId
                            &&
                            request.currency ===
                              plan.currency,
                        )
                        .map(
                          request => (
                            <option
                              key={
                                request.id
                              }
                              value={
                                request.id
                              }
                            >
                              {
                                request
                                  .requestNumber
                              }
                              {" — "}
                              {
                                request.title
                              }
                            </option>
                          ),
                        )}
                    </select>

                    <button
                      type="button"
                      className={
                        "planning-inline-action"
                      }
                      onClick={
                        () =>
                          void linkRequest(
                            item,
                          )
                      }
                    >
                      <Link2
                        size={14}
                      />
                      Link request
                    </button>

                    <button
                      type="button"
                      className={
                        "planning-inline-action planning-inline-action--danger"
                      }
                      onClick={
                        () =>
                          void cancel(
                            item.id,
                          )
                      }
                    >
                      <XCircle
                        size={14}
                      />
                      Cancel
                    </button>
                  </div>
                ) : null}

                {canManage &&
                item.status ===
                  "CONVERTED" ? (
                  <div
                    className={
                      "planning-item-actions"
                    }
                  >
                    <button
                      type="button"
                      className={
                        "planning-inline-action"
                      }
                      onClick={
                        () =>
                          void complete(
                            item.id,
                          )
                      }
                    >
                      <Check
                        size={14}
                      />
                      Complete initiative
                    </button>
                  </div>
                ) : null}
              </article>
            ),
          )}

          {items.length === 0 ? (
            <div
              className={
                "planning-empty"
              }
            >
              No procurement
              initiatives have been
              added to this plan.
            </div>
          ) : null}
        </div>
      </section>

      {canManage &&
      (
        plan.status ===
        "DRAFT" ||
        plan.status ===
        "ACTIVE"
      ) ? (
        <form
          className={
            "panel"
          }
          onSubmit={
            addItem
          }
        >
          <div
            className={
              "panel__header"
            }
          >
            <div>
              <span
                className={
                  "eyebrow"
                }
              >
                Demand intake
              </span>

              <h2>
                Add planned initiative
              </h2>
            </div>

            <Plus size={19} />
          </div>

          <div
            className={
              "planning-form-grid"
            }
          >
            <label
              className={
                "request-field planning-form-wide"
              }
            >
              <span>Title</span>

              <input
                required
                maxLength={220}
                value={title}
                placeholder={
                  "Network infrastructure refresh"
                }
                onChange={
                  event =>
                    setTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field planning-form-wide"
              }
            >
              <span>Description</span>

              <textarea
                rows={4}
                maxLength={2000}
                value={
                  description
                }
                onChange={
                  event =>
                    setDescription(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Department
              </span>

              <select
                required
                value={
                  departmentId
                }
                onChange={
                  event =>
                    setDepartmentId(
                      event.target.value,
                    )
                }
              >
                {options
                  ?.departments
                  .map(
                    department => (
                      <option
                        key={
                          department.id
                        }
                        value={
                          department.id
                        }
                      >
                        {
                          department.name
                        }
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Category</span>

              <input
                required
                list={
                  "planning-category-options"
                }
                maxLength={120}
                value={category}
                onChange={
                  event =>
                    setCategory(
                      event.target.value,
                    )
                }
              />

              <datalist
                id={
                  "planning-category-options"
                }
              >
                {options
                  ?.categories
                  .map(
                    option => (
                      <option
                        key={
                          option
                        }
                        value={
                          option
                        }
                      />
                    ),
                  )}
              </datalist>
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Planned value
              </span>

              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={
                  plannedValue
                }
                onChange={
                  event =>
                    setPlannedValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Target sourcing date
              </span>

              <input
                required
                type="date"
                min={
                  `${plan.fiscalYear}-01-01`
                }
                max={
                  `${plan.fiscalYear}-12-31`
                }
                value={
                  targetDate
                }
                onChange={
                  event =>
                    setTargetDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Priority</span>

              <select
                value={priority}
                onChange={
                  event =>
                    setPriority(
                      event.target
                        .value as
                        ProcurementPlanPriority,
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

            <div />

            <label
              className={
                "request-field planning-form-wide"
              }
            >
              <span>Notes</span>

              <textarea
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={
                  event =>
                    setNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "planning-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={saving}
            >
              <Plus size={16} />

              {saving
                ? "Adding..."
                : "Add initiative"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
