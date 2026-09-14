"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  FileCheck2,
  Leaf,
  Play,
  Plus,
  ShieldCheck,
  Wrench,
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
  approveSustainabilityAssessment,
  cancelSustainabilityAction,
  completeSustainabilityAction,
  createSustainabilityAction,
  getSustainabilityAssessment,
  getSustainabilityContext,
  rejectSustainabilityAssessment,
  rejectSustainabilityDeclaration,
  startSustainabilityAction,
  submitSustainabilityAssessment,
  uploadSustainabilityDeclaration,
  verifySustainabilityDeclaration,
} from "@/lib/api";

import type {
  SustainabilityAction,
  SustainabilityActionType,
  SustainabilityAssessment,
  SustainabilityContext,
  SustainabilityDeclaration,
  SustainabilityDeclarationType,
} from "@/types/sustainability";

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

function defaultDueDate(): string {
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

export default function SustainabilityAssessmentPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    assessment,
    setAssessment,
  ] =
    useState<
      SustainabilityAssessment |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      SustainabilityContext |
      null
    >(null);

  const [
    declarationReferences,
    setDeclarationReferences,
  ] =
    useState<
      Partial<
        Record<
          SustainabilityDeclarationType,
          string
        >
      >
    >({});

  const [
    declarationExpiry,
    setDeclarationExpiry,
  ] =
    useState<
      Partial<
        Record<
          SustainabilityDeclarationType,
          string
        >
      >
    >({});

  const [
    declarationNotes,
    setDeclarationNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    actionType,
    setActionType,
  ] =
    useState<SustainabilityActionType>(
      "CARBON_REDUCTION",
    );

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
    actionOwner,
    setActionOwner,
  ] =
    useState("");

  const [
    actionDueDate,
    setActionDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    actionNotes,
    setActionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    decisionNote,
    setDecisionNote,
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
    savingAction,
    setSavingAction,
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

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getSustainabilityAssessment(
        params.id,
      ),
      getSustainabilityContext(),
    ])
      .then(
        ([
          assessmentResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setAssessment(
            assessmentResponse,
          );

          setContext(
            contextResponse,
          );

          setDeclarationReferences(
            Object.fromEntries(
              assessmentResponse.declarations.map(
                declaration => [
                  declaration.declarationType,
                  declaration.documentReference ??
                    "",
                ],
              ),
            ),
          );

          setDeclarationExpiry(
            Object.fromEntries(
              assessmentResponse.declarations.map(
                declaration => [
                  declaration.declarationType,
                  declaration.expiryDate ??
                    "",
                ],
              ),
            ),
          );

          setActionOwner(
            assessmentResponse.ownerUserId,
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
              : "Unable to load sustainability assessment.",
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
    setAssessment(
      await getSustainabilityAssessment(
        params.id,
      ),
    );
  }

  async function uploadDeclaration(
    declaration:
      SustainabilityDeclaration,
  ) {
    const reference =
      declarationReferences[
        declaration.declarationType
      ]
      ??
      "";

    if (!reference.trim()) {
      setError(
        "Declaration document reference is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await uploadSustainabilityDeclaration(
        params.id,
        declaration.declarationType,
        {
          documentReference:
            reference,
          expiryDate:
            declarationExpiry[
              declaration.declarationType
            ]
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
          : "Unable to save sustainability declaration.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function reviewDeclaration(
    declaration:
      SustainabilityDeclaration,
    action:
      "VERIFY"
      |
      "REJECT",
  ) {
    const note =
      declarationNotes[
        declaration.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A declaration review note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "VERIFY"
      ) {
        await verifySustainabilityDeclaration(
          declaration.id,
          note,
        );
      } else {
        await rejectSustainabilityDeclaration(
          declaration.id,
          note,
        );
      }

      setDeclarationNotes(
        current => ({
          ...current,
          [declaration.id]:
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
          : "Unable to review sustainability declaration.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitAssessment() {
    try {
      setRunning(true);
      setError(null);

      await submitSustainabilityAssessment(
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
          : "Unable to submit sustainability assessment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideAssessment(
    action:
      "APPROVE"
      |
      "REJECT",
  ) {
    if (!decisionNote.trim()) {
      setError(
        "A sustainability decision note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "APPROVE"
      ) {
        await approveSustainabilityAssessment(
          params.id,
          decisionNote,
        );
      } else {
        await rejectSustainabilityAssessment(
          params.id,
          decisionNote,
        );
      }

      setDecisionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record sustainability decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function createAction(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSavingAction(true);
      setError(null);

      await createSustainabilityAction(
        params.id,
        {
          actionType,
          title:
            actionTitle.trim(),
          description:
            actionDescription.trim()
            ||
            undefined,
          ownerUserId:
            actionOwner
            ||
            undefined,
          dueDate:
            actionDueDate,
        },
      );

      setActionTitle("");
      setActionDescription("");
      setActionDueDate(
        defaultDueDate(),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create sustainability action.",
      );
    } finally {
      setSavingAction(false);
    }
  }

  async function startAction(
    action:
      SustainabilityAction,
  ) {
    try {
      setRunning(true);
      setError(null);

      await startSustainabilityAction(
        action.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start sustainability action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function completeAction(
    action:
      SustainabilityAction,
  ) {
    const note =
      actionNotes[
        action.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A sustainability action completion note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await completeSustainabilityAction(
        action.id,
        note,
      );

      setActionNotes(
        current => ({
          ...current,
          [action.id]:
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
          : "Unable to complete sustainability action.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelAction(
    action:
      SustainabilityAction,
  ) {
    try {
      setRunning(true);
      setError(null);

      await cancelSustainabilityAction(
        action.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel sustainability action.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading sustainability assessment...
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="page-stack">
        <Link
          href="/sustainability"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Sustainability
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Sustainability assessment not found."}
        </div>
      </div>
    );
  }

  const editable =
    assessment.status ===
      "DRAFT"
    ||
    assessment.status ===
      "SUBMITTED";

  return (
    <div className="page-stack">
      <Link
        href="/sustainability"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Sustainability
      </Link>

      <section className="sustainability-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {assessment.assessmentNumber}
            </span>

            <span
              className={
                `sustainability-assessment-status sustainability-assessment-status--${assessment.status.toLowerCase()}`
              }
            >
              {readable(
                assessment.status,
              )}
            </span>

            <span
              className={
                `sustainability-rating sustainability-rating--${assessment.rating.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                assessment.rating,
              )}
            </span>
          </div>

          <h1>
            {assessment.supplierName}
          </h1>

          <p>
            {assessment.supplierCode}
            {" · "}
            {assessment.supplierCategory ??
              "Uncategorized"}
            {" · Owner: "}
            {assessment.ownerName}
          </p>
        </div>

        <div className="sustainability-detail-actions">
          {canManage &&
          assessment.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitAssessment()
              }
            >
              <FileCheck2
                size={16}
              />
              Submit assessment
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

      <section
        className={
          assessment.responsibleSourcingEligible
            ? "sustainability-eligibility sustainability-eligibility--pass"
            : "sustainability-eligibility"
        }
      >
        {assessment.responsibleSourcingEligible ? (
          <BadgeCheck
            size={20}
          />
        ) : (
          <AlertTriangle
            size={20}
          />
        )}

        <div>
          <strong>
            {assessment.responsibleSourcingEligible
              ? "Responsible-sourcing eligible"
              : "Responsible-sourcing eligibility blocked"}
          </strong>

          <p>
            ESG approval:
            {" "}
            {assessment.status ===
            "APPROVED"
              ? "Yes"
              : "No"}
            {" · Mandatory declarations: "}
            {assessment.verifiedMandatoryDeclarations}
            {" / "}
            {assessment.mandatoryDeclarations}
            {" · Onboarding clearance: "}
            {assessment.onboardingClearance
              ? "Yes"
              : "No"}
          </p>
        </div>
      </section>

      <section className="sustainability-score-grid">
        <article>
          <span>
            Environmental
          </span>

          <strong>
            {assessment.environmentalScore.toFixed(
              1,
            )}
          </strong>

          <small>
            40% weighting
          </small>
        </article>

        <article>
          <span>
            Social
          </span>

          <strong>
            {assessment.socialScore.toFixed(
              1,
            )}
          </strong>

          <small>
            35% weighting
          </small>
        </article>

        <article>
          <span>
            Governance
          </span>

          <strong>
            {assessment.governanceScore.toFixed(
              1,
            )}
          </strong>

          <small>
            25% weighting
          </small>
        </article>

        <article className="sustainability-overall-score">
          <span>
            Overall ESG
          </span>

          <strong>
            {assessment.overallScore.toFixed(
              1,
            )}
          </strong>

          <small>
            {readable(
              assessment.rating,
            )}
          </small>
        </article>
      </section>

      <section className="sustainability-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Responsible sourcing
              </span>

              <h2>
                Mandatory declarations
              </h2>
            </div>

            <ShieldCheck
              size={19}
            />
          </div>

          <div className="sustainability-declaration-list">
            {assessment.declarations.map(
              declaration => (
                <article
                  key={declaration.id}
                  className={
                    declaration.status ===
                      "REJECTED"
                    ||
                    declaration.status ===
                      "EXPIRED"
                      ? "sustainability-declaration sustainability-declaration--blocked"
                      : "sustainability-declaration"
                  }
                >
                  <div className="sustainability-declaration-heading">
                    <div>
                      <strong>
                        {readable(
                          declaration.declarationType,
                        )}
                      </strong>

                      <span>
                        {declaration.mandatory
                          ? "Mandatory"
                          : "Optional"}
                      </span>
                    </div>

                    <span
                      className={
                        `sustainability-declaration-status sustainability-declaration-status--${declaration.status.toLowerCase()}`
                      }
                    >
                      {readable(
                        declaration.status,
                      )}
                    </span>
                  </div>

                  <div className="sustainability-declaration-fields">
                    <label>
                      <span>
                        Document / declaration reference
                      </span>

                      <input
                        disabled={
                          !canManage
                          ||
                          !editable
                        }
                        value={
                          declarationReferences[
                            declaration.declarationType
                          ]
                          ??
                          ""
                        }
                        onChange={
                          event =>
                            setDeclarationReferences(
                              current => ({
                                ...current,
                                [declaration.declarationType]:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label>
                      <span>
                        Expiry date
                      </span>

                      <input
                        type="date"
                        disabled={
                          !canManage
                          ||
                          !editable
                        }
                        value={
                          declarationExpiry[
                            declaration.declarationType
                          ]
                          ??
                          ""
                        }
                        onChange={
                          event =>
                            setDeclarationExpiry(
                              current => ({
                                ...current,
                                [declaration.declarationType]:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>
                  </div>

                  {canManage &&
                  editable ? (
                    <div className="sustainability-declaration-controls">
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void uploadDeclaration(
                              declaration,
                            )
                        }
                      >
                        Save declaration
                      </button>

                      <input
                        value={
                          declarationNotes[
                            declaration.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Review note"
                        }
                        onChange={
                          event =>
                            setDeclarationNotes(
                              current => ({
                                ...current,
                                [declaration.id]:
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
                            declarationNotes[
                              declaration.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void reviewDeclaration(
                              declaration,
                              "VERIFY",
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Verify
                      </button>

                      <button
                        type="button"
                        className="sustainability-danger-button"
                        disabled={
                          running
                          ||
                          !(
                            declarationNotes[
                              declaration.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void reviewDeclaration(
                              declaration,
                              "REJECT",
                            )
                        }
                      >
                        <XCircle
                          size={14}
                        />
                        Reject
                      </button>
                    </div>
                  ) : null}

                  {declaration.reviewNote ? (
                    <div className="sustainability-review-note">
                      {declaration.reviewNote}
                      {declaration.reviewedByName
                        ? ` — ${declaration.reviewedByName}`
                        : ""}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance context
              </span>

              <h2>
                Assessment status
              </h2>
            </div>

            <Leaf
              size={19}
            />
          </div>

          <div className="sustainability-context-grid">
            <div>
              <span>
                Supplier risk
              </span>

              <strong>
                {assessment.supplierRiskLevel ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Country
              </span>

              <strong>
                {assessment.supplierCountry ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Assessment date
              </span>

              <strong>
                {new Date(
                  `${assessment.assessmentDate}T00:00:00`,
                )
                  .toLocaleDateString()}
              </strong>
            </div>

            <div>
              <span>
                Next review
              </span>

              <strong>
                {assessment.nextReviewDate
                  ? new Date(
                      `${assessment.nextReviewDate}T00:00:00`,
                    )
                      .toLocaleDateString()
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                Onboarding clearance
              </span>

              <strong>
                {assessment.onboardingClearance
                  ? "Cleared"
                  : "Not cleared"}
              </strong>
            </div>

            <div>
              <span>
                Open actions
              </span>

              <strong>
                {assessment.openActions}
              </strong>
            </div>
          </div>

          {assessment.notes ? (
            <div className="sustainability-notes">
              {assessment.notes}
            </div>
          ) : null}

          {assessment.reviewNote ? (
            <div className="sustainability-review-card">
              <strong>
                Governance decision
              </strong>

              <p>
                {assessment.reviewNote}
              </p>

              <span>
                {assessment.reviewedByName ??
                  "Procurement governance"}
                {assessment.reviewedAt
                  ? ` · ${new Date(
                      assessment.reviewedAt,
                    ).toLocaleString()}`
                  : ""}
              </span>
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Supplier improvement
            </span>

            <h2>
              ESG improvement plan
            </h2>
          </div>

          <Wrench
            size={19}
          />
        </div>

        {assessment.actions.length ===
        0 ? (
          <div className="sustainability-empty">
            No sustainability
            improvement actions are
            currently recorded.
          </div>
        ) : (
          <div className="sustainability-action-list">
            {assessment.actions.map(
              action => (
                <article
                  key={action.id}
                  className={
                    action.overdue
                      ? "sustainability-action sustainability-action--overdue"
                      : "sustainability-action"
                  }
                >
                  <div className="sustainability-action-heading">
                    <div>
                      <span
                        className={
                          `sustainability-action-status sustainability-action-status--${action.status.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          action.status,
                        )}
                      </span>

                      <strong>
                        {action.title}
                      </strong>

                      <small>
                        {readable(
                          action.actionType,
                        )}
                        {" · "}
                        {action.ownerName}
                      </small>
                    </div>

                    <div>
                      <span>
                        Due
                      </span>

                      <strong
                        className={
                          action.overdue
                            ? "sustainability-overdue"
                            : ""
                        }
                      >
                        {new Date(
                          `${action.dueDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {action.description ? (
                    <p>
                      {action.description}
                    </p>
                  ) : null}

                  {action.completionNote ? (
                    <div className="sustainability-review-note">
                      {action.completionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  (
                    action.status ===
                      "OPEN"
                    ||
                    action.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="sustainability-action-controls">
                      {action.status ===
                      "OPEN" ? (
                        <button
                          type="button"
                          disabled={running}
                          onClick={
                            () =>
                              void startAction(
                                action,
                              )
                          }
                        >
                          <Play
                            size={14}
                          />
                          Start
                        </button>
                      ) : null}

                      <input
                        value={
                          actionNotes[
                            action.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Completion evidence"
                        }
                        onChange={
                          event =>
                            setActionNotes(
                              current => ({
                                ...current,
                                [action.id]:
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
                            actionNotes[
                              action.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void completeAction(
                              action,
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Complete
                      </button>

                      {canApprove ? (
                        <button
                          type="button"
                          className="sustainability-danger-button"
                          disabled={running}
                          onClick={
                            () =>
                              void cancelAction(
                                action,
                              )
                          }
                        >
                          <XCircle
                            size={14}
                          />
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      assessment.status !==
        "REJECTED" ? (
        <form
          className="panel"
          onSubmit={createAction}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Improvement governance
              </span>

              <h2>
                Add ESG action
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="sustainability-form-grid">
            <label className="request-field">
              <span>
                Action type
              </span>

              <select
                value={actionType}
                onChange={
                  event =>
                    setActionType(
                      event.target.value as
                        SustainabilityActionType,
                    )
                }
              >
                <option value="CARBON_REDUCTION">
                  Carbon reduction
                </option>

                <option value="LABOR_PRACTICES">
                  Labor practices
                </option>

                <option value="GOVERNANCE_CONTROL">
                  Governance control
                </option>

                <option value="RESPONSIBLE_SOURCING">
                  Responsible sourcing
                </option>

                <option value="EVIDENCE_REMEDIATION">
                  Evidence remediation
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Due date
              </span>

              <input
                required
                type="date"
                value={actionDueDate}
                onChange={
                  event =>
                    setActionDueDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field sustainability-form-wide">
              <span>
                Action title
              </span>

              <input
                required
                maxLength={220}
                value={actionTitle}
                onChange={
                  event =>
                    setActionTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field sustainability-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={actionDescription}
                onChange={
                  event =>
                    setActionDescription(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field sustainability-form-wide">
              <span>
                Owner
              </span>

              <select
                value={actionOwner}
                onChange={
                  event =>
                    setActionOwner(
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
          </div>

          <div className="sustainability-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                savingAction
                ||
                !actionTitle.trim()
              }
            >
              <Plus
                size={16}
              />

              {savingAction
                ? "Adding..."
                : "Add ESG action"}
            </button>
          </div>
        </form>
      ) : null}

      {canApprove &&
      assessment.status ===
        "SUBMITTED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Sustainability governance
              </span>

              <h2>
                Assessment decision
              </h2>
            </div>

            <ShieldCheck
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Decision rationale
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="sustainability-form-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void decideAssessment(
                    "REJECT",
                  )
              }
            >
              <XCircle
                size={16}
              />
              Reject assessment
            </button>

            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !decisionNote.trim()
                ||
                assessment.verifiedMandatoryDeclarations <
                  assessment.mandatoryDeclarations
              }
              onClick={
                () =>
                  void decideAssessment(
                    "APPROVE",
                  )
              }
            >
              <BadgeCheck
                size={16}
              />
              Approve assessment
            </button>
          </div>

          {assessment.verifiedMandatoryDeclarations <
          assessment.mandatoryDeclarations ? (
            <div className="sustainability-decision-block">
              <AlertTriangle
                size={15}
              />

              <span>
                Approval remains blocked
                until every mandatory
                responsible-sourcing
                declaration is verified.
              </span>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
