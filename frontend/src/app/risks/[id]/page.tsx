"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Plus,
  ShieldAlert,
  Siren,
  Target,
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
  acceptRiskCase,
  addRiskMitigationAction,
  completeRiskMitigationAction,
  escalateRiskCase,
  getRiskCase,
  getRiskContextOptions,
  resolveRiskCase,
  startRiskMitigation,
  updateRiskCase,
} from "@/lib/api";

import type {
  RiskCase,
  RiskCategory,
  RiskContextOptions,
} from "@/types/risk";

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

export default function RiskDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    risk,
    setRisk,
  ] =
    useState<
      RiskCase |
      null
    >(null);

  const [
    options,
    setOptions,
  ] =
    useState<
      RiskContextOptions |
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
    category,
    setCategory,
  ] =
    useState<RiskCategory>(
      "OTHER",
    );

  const [
    likelihood,
    setLikelihood,
  ] =
    useState(1);

  const [
    impact,
    setImpact,
  ] =
    useState(1);

  const [
    dueDate,
    setDueDate,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    actionTitle,
    setActionTitle,
  ] =
    useState("");

  const [
    actionDescription,
    setActionDescription,
  ] =
    useState("");

  const [
    actionDueDate,
    setActionDueDate,
  ] =
    useState("");

  const [
    actionOwnerId,
    setActionOwnerId,
  ] =
    useState("");

  const [
    resolutionNote,
    setResolutionNote,
  ] =
    useState("");

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
    actionSaving,
    setActionSaving,
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

  const canClose =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  const isClosed =
    risk?.status ===
      "RESOLVED" ||
    risk?.status ===
      "ACCEPTED";

  useEffect(() => {
    let active = true;

    Promise.all([
      getRiskCase(
        params.id,
      ),
      getRiskContextOptions(),
    ])
      .then(
        ([
          riskResponse,
          optionsResponse,
        ]) => {
          if (!active) {
            return;
          }

          setRisk(
            riskResponse,
          );

          setOptions(
            optionsResponse,
          );

          setTitle(
            riskResponse.title,
          );

          setDescription(
            riskResponse.description,
          );

          setCategory(
            riskResponse.category,
          );

          setLikelihood(
            riskResponse.likelihood,
          );

          setImpact(
            riskResponse.impact,
          );

          setDueDate(
            riskResponse.dueDate ??
            "",
          );

          setOwnerUserId(
            riskResponse.ownerUserId,
          );

          setActionOwnerId(
            riskResponse.ownerUserId,
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
              : "Unable to load risk case.",
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
    const response =
      await getRiskCase(
        params.id,
      );

    setRisk(
      response,
    );
  }

  async function handleSave(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!risk) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const updated =
        await updateRiskCase(
          risk.id,
          {
            title:
              title.trim(),
            description:
              description.trim(),
            category,
            likelihood,
            impact,
            dueDate:
              dueDate ||
              undefined,
            ownerUserId:
              ownerUserId ||
              undefined,
          },
        );

      setRisk(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update risk case.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addAction(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!risk) {
      return;
    }

    try {
      setActionSaving(true);
      setError(null);

      await addRiskMitigationAction(
        risk.id,
        {
          title:
            actionTitle.trim(),
          description:
            actionDescription
              .trim() ||
            undefined,
          dueDate:
            actionDueDate ||
            undefined,
          ownerUserId:
            actionOwnerId ||
            undefined,
        },
      );

      setActionTitle("");
      setActionDescription("");
      setActionDueDate("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add mitigation action.",
      );
    } finally {
      setActionSaving(false);
    }
  }

  async function runLifecycle(
    action:
      "MITIGATE" |
      "ESCALATE" |
      "RESOLVE" |
      "ACCEPT",
  ) {
    if (!risk) {
      return;
    }

    try {
      setLifecycleRunning(true);
      setError(null);

      let updated:
        RiskCase;

      if (
        action ===
        "MITIGATE"
      ) {
        updated =
          await startRiskMitigation(
            risk.id,
          );
      } else if (
        action ===
        "ESCALATE"
      ) {
        updated =
          await escalateRiskCase(
            risk.id,
          );
      } else if (
        action ===
        "RESOLVE"
      ) {
        updated =
          await resolveRiskCase(
            risk.id,
            resolutionNote,
          );
      } else {
        updated =
          await acceptRiskCase(
            risk.id,
            resolutionNote,
          );
      }

      setRisk(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update risk lifecycle.",
      );
    } finally {
      setLifecycleRunning(false);
    }
  }

  async function completeAction(
    actionId: string,
  ) {
    try {
      setActionSaving(true);
      setError(null);

      await completeRiskMitigationAction(
        actionId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to complete mitigation action.",
      );
    } finally {
      setActionSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className={
          "request-detail-loading"
        }
      >
        Loading risk case...
      </div>
    );
  }

  if (!risk) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href="/risks"
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />

          Risk register
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
            "Risk case not found."}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <Link
        href="/risks"
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Risk register
      </Link>

      <section
        className={
          "risk-detail-heading"
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
                risk.riskNumber
              }
            </span>

            <span
              className={
                `risk-severity risk-severity--${
                  risk.severity
                    .toLowerCase()
                }`
              }
            >
              {
                risk.severity
              }
            </span>

            <span
              className={
                `risk-status risk-status--${
                  risk.status
                    .toLowerCase()
                }`
              }
            >
              {
                readable(
                  risk.status,
                )
              }
            </span>
          </div>

          <h1>
            {risk.title}
          </h1>

          <p>
            {
              readable(
                risk.category,
              )
            }
            {" · Owner: "}
            {
              risk.ownerName
            }
          </p>
        </div>

        {!isClosed ? (
          <div
            className={
              "risk-detail-actions"
            }
          >
            {canManage &&
            risk.status ===
              "OPEN" ? (
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
                    void runLifecycle(
                      "MITIGATE",
                    )
                }
              >
                <Target
                  size={16}
                />
                Start mitigation
              </button>
            ) : null}

            {canClose &&
            !risk.escalated ? (
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
                    void runLifecycle(
                      "ESCALATE",
                    )
                }
              >
                <Siren
                  size={16}
                />
                Escalate
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

      {risk.escalated ? (
        <div
          className={
            "risk-escalated-banner"
          }
        >
          <Siren size={17} />

          <div>
            <strong>
              Escalated risk
            </strong>

            <span>
              Escalated by
              {" "}
              {
                risk.escalatedByName ??
                "management"
              }
              {risk.escalatedAt
                ? ` on ${new Date(
                    risk.escalatedAt,
                  ).toLocaleString()}`
                : ""}
            </span>
          </div>
        </div>
      ) : null}

      <section
        className={
          "risk-detail-kpis"
        }
      >
        <article
          className={
            "request-detail-summary-card"
          }
        >
          <ShieldAlert
            size={18}
          />

          <div>
            <span>Risk score</span>

            <strong>
              {
                risk.riskScore
              }
              /25
            </strong>

            <small>
              L
              {
                risk.likelihood
              }
              {" × I"}
              {
                risk.impact
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <Clock3
            size={18}
          />

          <div>
            <span>Due date</span>

            <strong>
              {risk.dueDate
                ? new Date(
                    `${risk.dueDate}T00:00:00`,
                  )
                    .toLocaleDateString()
                : "No due date"}
            </strong>

            <small>
              {risk.overdue
                ? "Overdue"
                : "Current"}
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <Target
            size={18}
          />

          <div>
            <span>
              Mitigation
            </span>

            <strong>
              {
                risk
                  .openMitigationActions
              }
            </strong>

            <small>
              {"open · "}
              {
                risk
                  .completedMitigationActions
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
          <AlertTriangle
            size={18}
          />

          <div>
            <span>Origin</span>

            <strong>
              {
                readable(
                  risk.origin,
                )
              }
            </strong>

            <small>
              {
                readable(
                  risk.category,
                )
              }
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
              Risk context
            </span>

            <h2>
              Linked procurement
              records
            </h2>
          </div>
        </div>

        <div
          className={
            "risk-context-grid"
          }
        >
          <div>
            <span>Supplier</span>

            {risk.supplierId ? (
              <Link
                href={
                  `/suppliers/${risk.supplierId}`
                }
              >
                {
                  risk.supplierName
                }
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>Contract</span>

            {risk.contractId ? (
              <Link
                href={
                  `/contracts/${risk.contractId}`
                }
              >
                {
                  risk.contractNumber
                }
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>
              Purchase order
            </span>

            {risk.purchaseOrderId ? (
              <Link
                href={
                  `/purchase-orders/${risk.purchaseOrderId}`
                }
              >
                {
                  risk.purchaseOrderNumber
                }
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>RFQ</span>

            {risk.rfqId ? (
              <Link
                href={
                  `/rfqs/${risk.rfqId}`
                }
              >
                {
                  risk.rfqNumber
                }
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>
        </div>
      </section>

      {canManage &&
      !isClosed ? (
        <form
          className={
            "panel"
          }
          onSubmit={
            handleSave
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
                Risk administration
              </span>

              <h2>
                Risk assessment
              </h2>
            </div>
          </div>

          <div
            className={
              "risk-form-grid"
            }
          >
            <label
              className={
                "request-field risk-form-wide"
              }
            >
              <span>Title</span>

              <input
                required
                maxLength={220}
                value={title}
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
                "request-field risk-form-wide"
              }
            >
              <span>
                Description
              </span>

              <textarea
                required
                rows={5}
                maxLength={3000}
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
              <span>Category</span>

              <select
                value={category}
                onChange={
                  event =>
                    setCategory(
                      event.target
                        .value as
                        RiskCategory,
                    )
                }
              >
                <option value="SUPPLIER">
                  Supplier
                </option>

                <option value="CONTRACT">
                  Contract
                </option>

                <option value="PURCHASE_ORDER">
                  Purchase order
                </option>

                <option value="DELIVERY">
                  Delivery
                </option>

                <option value="SOURCING">
                  Sourcing
                </option>

                <option value="COMPLIANCE">
                  Compliance
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Owner</span>

              <select
                value={
                  ownerUserId
                }
                onChange={
                  event =>
                    setOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {options
                  ?.users
                  .map(
                    option => (
                      <option
                        key={
                          option.id
                        }
                        value={
                          option.id
                        }
                      >
                        {
                          option.fullName
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
              <span>Likelihood</span>

              <input
                type="number"
                min="1"
                max="5"
                value={
                  likelihood
                }
                onChange={
                  event =>
                    setLikelihood(
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
              <span>Impact</span>

              <input
                type="number"
                min="1"
                max="5"
                value={impact}
                onChange={
                  event =>
                    setImpact(
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
              <span>Due date</span>

              <input
                type="date"
                value={dueDate}
                onChange={
                  event =>
                    setDueDate(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "risk-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save assessment"}
            </button>
          </div>
        </form>
      ) : null}

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
              Mitigation plan
            </span>

            <h2>
              Mitigation actions
            </h2>
          </div>

          <Target size={19} />
        </div>

        {risk
          .mitigationActions
          .length === 0 ? (
          <div
            className={
              "risk-empty"
            }
          >
            No mitigation actions
            have been created.
          </div>
        ) : (
          <div
            className={
              "risk-action-list"
            }
          >
            {risk
              .mitigationActions
              .map(
                action => (
                  <article
                    key={
                      action.id
                    }
                    className={
                      `risk-action-card ${
                        action.overdue
                          ? "risk-action-card--overdue"
                          : ""
                      }`
                    }
                  >
                    <div
                      className={
                        "risk-action-card__status"
                      }
                    >
                      {action.status ===
                      "COMPLETED" ? (
                        <CheckCircle2
                          size={17}
                        />
                      ) : (
                        <Target
                          size={17}
                        />
                      )}
                    </div>

                    <div
                      className={
                        "risk-action-card__content"
                      }
                    >
                      <strong>
                        {
                          action.title
                        }
                      </strong>

                      <span>
                        {
                          action.description ??
                          "No description"
                        }
                      </span>

                      <small>
                        Owner:
                        {" "}
                        {
                          action.ownerName
                        }
                        {action.dueDate
                          ? ` · Due ${new Date(
                              `${action.dueDate}T00:00:00`,
                            ).toLocaleDateString()}`
                          : ""}
                      </small>
                    </div>

                    <span
                      className={
                        `risk-action-status risk-action-status--${
                          action.status
                            .toLowerCase()
                        }`
                      }
                    >
                      {
                        readable(
                          action.status,
                        )
                      }
                    </span>

                    {canManage &&
                    action.status ===
                      "OPEN" ? (
                      <button
                        type="button"
                        className={
                          "risk-complete-action"
                        }
                        disabled={
                          actionSaving
                        }
                        onClick={
                          () =>
                            void completeAction(
                              action.id,
                            )
                        }
                      >
                        <Check
                          size={15}
                        />
                        Complete
                      </button>
                    ) : null}
                  </article>
                ),
              )}
          </div>
        )}
      </section>

      {canManage &&
      !isClosed ? (
        <form
          className={
            "panel"
          }
          onSubmit={
            addAction
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
                Treatment plan
              </span>

              <h2>
                Add mitigation action
              </h2>
            </div>

            <Plus size={19} />
          </div>

          <div
            className={
              "risk-form-grid"
            }
          >
            <label
              className={
                "request-field risk-form-wide"
              }
            >
              <span>Action title</span>

              <input
                required
                maxLength={220}
                value={
                  actionTitle
                }
                onChange={
                  event =>
                    setActionTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field risk-form-wide"
              }
            >
              <span>Description</span>

              <textarea
                rows={4}
                maxLength={2000}
                value={
                  actionDescription
                }
                onChange={
                  event =>
                    setActionDescription(
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
              <span>Owner</span>

              <select
                value={
                  actionOwnerId
                }
                onChange={
                  event =>
                    setActionOwnerId(
                      event.target.value,
                    )
                }
              >
                {options
                  ?.users
                  .map(
                    option => (
                      <option
                        key={
                          option.id
                        }
                        value={
                          option.id
                        }
                      >
                        {
                          option.fullName
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
              <span>Due date</span>

              <input
                type="date"
                value={
                  actionDueDate
                }
                onChange={
                  event =>
                    setActionDueDate(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "risk-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={
                actionSaving
              }
            >
              <Plus size={16} />

              {actionSaving
                ? "Adding..."
                : "Add mitigation action"}
            </button>
          </div>
        </form>
      ) : null}

      {canClose &&
      !isClosed ? (
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
                Management decision
              </span>

              <h2>
                Close risk case
              </h2>
            </div>
          </div>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Resolution / acceptance
              rationale
            </span>

            <textarea
              rows={5}
              maxLength={3000}
              value={
                resolutionNote
              }
              onChange={
                event =>
                  setResolutionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div
            className={
              "risk-close-actions"
            }
          >
            <button
              type="button"
              className={
                "button button--secondary"
              }
              disabled={
                lifecycleRunning ||
                !resolutionNote.trim()
              }
              onClick={
                () =>
                  void runLifecycle(
                    "ACCEPT",
                  )
              }
            >
              <AlertTriangle
                size={16}
              />
              Accept risk
            </button>

            <button
              type="button"
              className={
                "button button--primary"
              }
              disabled={
                lifecycleRunning ||
                !resolutionNote.trim() ||
                risk.openMitigationActions >
                  0
              }
              onClick={
                () =>
                  void runLifecycle(
                    "RESOLVE",
                  )
              }
            >
              <CheckCircle2
                size={16}
              />
              Resolve risk
            </button>
          </div>
        </section>
      ) : null}

      {isClosed &&
      risk.resolutionNote ? (
        <section
          className={
            "risk-resolution-card"
          }
        >
          <CheckCircle2
            size={21}
          />

          <div>
            <span>
              {
                risk.status ===
                "ACCEPTED"
                  ? "Risk accepted"
                  : "Risk resolved"
              }
            </span>

            <strong>
              {
                risk.resolutionNote
              }
            </strong>

            <small>
              {
                risk.resolvedByName ??
                "Management"
              }
              {risk.resolvedAt
                ? ` · ${new Date(
                    risk.resolvedAt,
                  ).toLocaleString()}`
                : ""}
            </small>
          </div>
        </section>
      ) : null}
    </div>
  );
}
