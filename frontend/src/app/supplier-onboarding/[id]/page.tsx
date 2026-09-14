"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock3,
  FileCheck2,
  Send,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  answerSupplierQualificationQuestion,
  approveSupplierOnboarding,
  cancelSupplierOnboardingCase,
  finalizeSupplierOnboardingCase,
  getSupplierOnboardingCase,
  rejectSupplierOnboardingApproval,
  rejectSupplierOnboardingCase,
  rejectSupplierOnboardingEvidence,
  submitSupplierOnboardingCase,
  uploadSupplierOnboardingEvidence,
  validateSupplierOnboardingEvidence,
} from "@/lib/api";

import type {
  OnboardingApproval,
  OnboardingEvidence,
  OnboardingEvidenceType,
  QualificationComplianceStatus,
  QualificationQuestion,
  SupplierOnboardingCase,
} from "@/types/supplier-onboarding";

import {
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

export default function SupplierOnboardingDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    onboardingCase,
    setOnboardingCase,
  ] =
    useState<
      SupplierOnboardingCase |
      null
    >(null);

  const [
    answers,
    setAnswers,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    answerCompliance,
    setAnswerCompliance,
  ] =
    useState<
      Record<
        string,
        QualificationComplianceStatus
      >
    >({});

  const [
    evidenceReferences,
    setEvidenceReferences,
  ] =
    useState<
      Partial<
        Record<
          OnboardingEvidenceType,
          string
        >
      >
    >({});

  const [
    evidenceExpiry,
    setEvidenceExpiry,
  ] =
    useState<
      Partial<
        Record<
          OnboardingEvidenceType,
          string
        >
      >
    >({});

  const [
    evidenceNotes,
    setEvidenceNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    approvalNotes,
    setApprovalNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    finalNote,
    setFinalNote,
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

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  const canProcurementApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "APPROVER";

  const canGovern =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getSupplierOnboardingCase(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setOnboardingCase(
            response,
          );

          setAnswers(
            Object.fromEntries(
              response.questions.map(
                question => [
                  question.questionCode,
                  question.answerValue ??
                    "",
                ],
              ),
            ),
          );

          setAnswerCompliance(
            Object.fromEntries(
              response.questions.map(
                question => [
                  question.questionCode,
                  question.complianceStatus,
                ],
              ),
            ),
          );

          setEvidenceReferences(
            Object.fromEntries(
              response.evidence.map(
                evidence => [
                  evidence.evidenceType,
                  evidence.documentReference ??
                    "",
                ],
              ),
            ),
          );

          setEvidenceExpiry(
            Object.fromEntries(
              response.evidence.map(
                evidence => [
                  evidence.evidenceType,
                  evidence.expiryDate ??
                    "",
                ],
              ),
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
              : "Unable to load supplier onboarding case.",
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
    setOnboardingCase(
      await getSupplierOnboardingCase(
        params.id,
      ),
    );
  }

  async function saveQuestion(
    question:
      QualificationQuestion,
  ) {
    const answer =
      answers[
        question.questionCode
      ]
      ??
      "";

    const compliance =
      answerCompliance[
        question.questionCode
      ]
      ??
      "PENDING";

    if (
      !answer.trim()
      ||
      compliance ===
        "PENDING"
    ) {
      setError(
        "Enter an answer and select its compliance assessment.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await answerSupplierQualificationQuestion(
        params.id,
        question.questionCode,
        {
          answerValue:
            answer,
          complianceStatus:
            compliance,
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
          : "Unable to save qualification answer.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function uploadEvidence(
    evidence:
      OnboardingEvidence,
  ) {
    const reference =
      evidenceReferences[
        evidence.evidenceType
      ]
      ??
      "";

    if (!reference.trim()) {
      setError(
        "Evidence reference is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await uploadSupplierOnboardingEvidence(
        params.id,
        evidence.evidenceType,
        {
          documentReference:
            reference,
          expiryDate:
            evidenceExpiry[
              evidence.evidenceType
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
          : "Unable to upload onboarding evidence reference.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function reviewEvidence(
    evidence:
      OnboardingEvidence,
    action:
      "VALIDATE"
      |
      "REJECT",
  ) {
    const note =
      evidenceNotes[
        evidence.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An evidence review note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "VALIDATE"
      ) {
        await validateSupplierOnboardingEvidence(
          evidence.id,
          note,
        );
      } else {
        await rejectSupplierOnboardingEvidence(
          evidence.id,
          note,
        );
      }

      setEvidenceNotes(
        current => ({
          ...current,
          [evidence.id]:
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
          : "Unable to review onboarding evidence.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitCase() {
    try {
      setRunning(true);
      setError(null);

      await submitSupplierOnboardingCase(
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
          : "Unable to submit onboarding case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideApproval(
    approval:
      OnboardingApproval,
    action:
      "APPROVE"
      |
      "REJECT",
  ) {
    const note =
      approvalNotes[
        approval.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "An approval decision note is required.",
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
        await approveSupplierOnboarding(
          approval.id,
          note,
        );
      } else {
        await rejectSupplierOnboardingApproval(
          approval.id,
          note,
        );
      }

      setApprovalNotes(
        current => ({
          ...current,
          [approval.id]:
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
          : "Unable to record onboarding approval decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function finalizeCase() {
    if (!finalNote.trim()) {
      setError(
        "A final activation-clearance note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await finalizeSupplierOnboardingCase(
        params.id,
        finalNote,
      );

      setFinalNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to finalize supplier onboarding.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function rejectCase() {
    if (!finalNote.trim()) {
      setError(
        "A rejection rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await rejectSupplierOnboardingCase(
        params.id,
        finalNote,
      );

      setFinalNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to reject supplier onboarding.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelCase() {
    if (!finalNote.trim()) {
      setError(
        "A cancellation rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await cancelSupplierOnboardingCase(
        params.id,
        finalNote,
      );

      setFinalNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel supplier onboarding.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading supplier onboarding...
      </div>
    );
  }

  if (!onboardingCase) {
    return (
      <div className="page-stack">
        <Link
          href="/supplier-onboarding"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Supplier onboarding
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Supplier onboarding case not found."}
        </div>
      </div>
    );
  }

  const editable =
    onboardingCase.status ===
      "DRAFT"
    ||
    onboardingCase.status ===
      "IN_REVIEW";

  return (
    <div className="page-stack">
      <Link
        href="/supplier-onboarding"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier onboarding
      </Link>

      <section className="onboarding-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {onboardingCase.caseNumber}
            </span>

            <span
              className={
                `onboarding-status onboarding-status--${onboardingCase.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                onboardingCase.status,
              )}
            </span>

            <span
              className={
                `onboarding-risk onboarding-risk--${onboardingCase.riskTier.toLowerCase()}`
              }
            >
              {onboardingCase.riskTier}
            </span>
          </div>

          <h1>
            {onboardingCase.supplierName}
          </h1>

          <p>
            {onboardingCase.supplierCode}
            {" · "}
            {readable(
              onboardingCase.caseType,
            )}
            {" · Owner: "}
            {onboardingCase.ownerName}
          </p>
        </div>

        <div className="onboarding-detail-actions">
          {canManage &&
          onboardingCase.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitCase()
              }
            >
              <Send
                size={16}
              />
              Submit for review
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
          onboardingCase.activationClearance
            ? "onboarding-activation-banner onboarding-activation-banner--cleared"
            : onboardingCase.activationEligible
              ? "onboarding-activation-banner onboarding-activation-banner--ready"
              : "onboarding-activation-banner"
        }
      >
        {onboardingCase.activationClearance ? (
          <BadgeCheck
            size={20}
          />
        ) : onboardingCase.activationEligible ? (
          <ShieldCheck
            size={20}
          />
        ) : (
          <AlertTriangle
            size={20}
          />
        )}

        <div>
          <strong>
            {onboardingCase.activationClearance
              ? "Supplier activation clearance granted"
              : onboardingCase.activationEligible
                ? "All activation gates passed"
                : "Supplier activation remains blocked"}
          </strong>

          {onboardingCase.activationGateReasons.length >
          0 ? (
            <ul>
              {onboardingCase.activationGateReasons.map(
                reason => (
                  <li
                    key={reason}
                  >
                    {reason}
                  </li>
                ),
              )}
            </ul>
          ) : (
            <span>
              Mandatory qualification,
              evidence and approvals are
              complete.
            </span>
          )}
        </div>
      </section>

      <section className="onboarding-detail-kpis">
        <article className="request-detail-summary-card">
          <FileCheck2
            size={18}
          />

          <div>
            <span>
              Qualification
            </span>

            <strong>
              {onboardingCase.answeredMandatoryQuestions}
              {" / "}
              {onboardingCase.mandatoryQuestions}
            </strong>

            <small>
              {onboardingCase.nonCompliantMandatoryQuestions}
              {" non-compliant"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <ShieldCheck
            size={18}
          />

          <div>
            <span>
              Evidence
            </span>

            <strong>
              {onboardingCase.validMandatoryEvidence}
              {" / "}
              {onboardingCase.mandatoryEvidence}
            </strong>

            <small>
              Mandatory valid evidence
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <UserCheck
            size={18}
          />

          <div>
            <span>
              Approvals
            </span>

            <strong>
              {onboardingCase.approvedRequiredApprovals}
              {" / "}
              {onboardingCase.requiredApprovals}
            </strong>

            <small>
              Risk-based approvals
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Clock3
            size={18}
          />

          <div>
            <span>
              SLA
            </span>

            <strong>
              {onboardingCase.slaOverdue
                ? "Overdue"
                : `${onboardingCase.daysOpen} days`}
            </strong>

            <small>
              Due
              {" "}
              {new Date(
                onboardingCase.slaDueAt,
              )
                .toLocaleDateString()}
            </small>
          </div>
        </article>
      </section>

      <section className="onboarding-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Qualification
              </span>

              <h2>
                Supplier questionnaire
              </h2>
            </div>

            <FileCheck2
              size={19}
            />
          </div>

          <div className="onboarding-question-list">
            {onboardingCase.questions.map(
              question => (
                <article
                  key={question.id}
                  className={
                    question.complianceStatus ===
                    "NON_COMPLIANT"
                      ? "onboarding-question onboarding-question--non-compliant"
                      : "onboarding-question"
                  }
                >
                  <div className="onboarding-question-heading">
                    <div>
                      <strong>
                        {question.questionLabel}
                      </strong>

                      <span>
                        {question.questionCode}
                        {question.mandatory
                          ? " · Mandatory"
                          : " · Optional"}
                      </span>
                    </div>

                    <span
                      className={
                        `onboarding-compliance onboarding-compliance--${question.complianceStatus.toLowerCase().replaceAll("_", "-")}`
                      }
                    >
                      {readable(
                        question.complianceStatus,
                      )}
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    disabled={
                      !canManage
                      ||
                      !editable
                    }
                    value={
                      answers[
                        question.questionCode
                      ]
                      ??
                      ""
                    }
                    onChange={
                      event =>
                        setAnswers(
                          current => ({
                            ...current,
                            [question.questionCode]:
                              event.target.value,
                          }),
                        )
                    }
                  />

                  <div className="onboarding-question-controls">
                    <select
                      disabled={
                        !canManage
                        ||
                        !editable
                      }
                      value={
                        answerCompliance[
                          question.questionCode
                        ]
                        ??
                        "PENDING"
                      }
                      onChange={
                        event =>
                          setAnswerCompliance(
                            current => ({
                              ...current,
                              [question.questionCode]:
                                event.target.value as
                                  QualificationComplianceStatus,
                            }),
                          )
                      }
                    >
                      <option value="PENDING">
                        Pending assessment
                      </option>

                      <option value="COMPLIANT">
                        Compliant
                      </option>

                      <option value="NON_COMPLIANT">
                        Non-compliant
                      </option>
                    </select>

                    {canManage &&
                    editable ? (
                      <button
                        type="button"
                        disabled={running}
                        onClick={
                          () =>
                            void saveQuestion(
                              question,
                            )
                        }
                      >
                        Save answer
                      </button>
                    ) : null}
                  </div>

                  {question.answeredByName ? (
                    <small>
                      Last answered by
                      {" "}
                      {question.answeredByName}
                    </small>
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
                Supplier context
              </span>

              <h2>
                Master-data snapshot
              </h2>
            </div>

            <UserCheck
              size={19}
            />
          </div>

          <div className="onboarding-context-grid">
            <div>
              <span>
                Supplier status
              </span>

              <strong>
                {onboardingCase.supplierStatus ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Existing risk
              </span>

              <strong>
                {onboardingCase.supplierRiskLevel ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Category
              </span>

              <strong>
                {onboardingCase.supplierCategory ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Country
              </span>

              <strong>
                {onboardingCase.supplierCountry ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Qualification tier
              </span>

              <strong>
                {onboardingCase.riskTier}
              </strong>
            </div>

            <div>
              <span>
                Requalification
              </span>

              <strong>
                {onboardingCase.requalificationDueDate
                  ? new Date(
                      `${onboardingCase.requalificationDueDate}T00:00:00`,
                    )
                      .toLocaleDateString()
                  : "—"}
              </strong>
            </div>
          </div>

          {onboardingCase.notes ? (
            <div className="onboarding-notes">
              {onboardingCase.notes}
            </div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Qualification evidence
            </span>

            <h2>
              Mandatory documentation
            </h2>
          </div>

          <ShieldCheck
            size={19}
          />
        </div>

        <div className="onboarding-evidence-list">
          {onboardingCase.evidence.map(
            evidence => (
              <article
                key={evidence.id}
                className={
                  evidence.status ===
                    "REJECTED"
                  ||
                  evidence.status ===
                    "EXPIRED"
                    ? "onboarding-evidence onboarding-evidence--blocked"
                    : "onboarding-evidence"
                }
              >
                <div className="onboarding-evidence-heading">
                  <div>
                    <strong>
                      {readable(
                        evidence.evidenceType,
                      )}
                    </strong>

                    <span>
                      {evidence.mandatory
                        ? "Mandatory"
                        : "Optional"}
                    </span>
                  </div>

                  <span
                    className={
                      `onboarding-evidence-status onboarding-evidence-status--${evidence.status.toLowerCase()}`
                    }
                  >
                    {readable(
                      evidence.status,
                    )}
                  </span>
                </div>

                <div className="onboarding-evidence-fields">
                  <label>
                    <span>
                      Document / evidence reference
                    </span>

                    <input
                      disabled={
                        !canManage
                        ||
                        !editable
                      }
                      value={
                        evidenceReferences[
                          evidence.evidenceType
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setEvidenceReferences(
                            current => ({
                              ...current,
                              [evidence.evidenceType]:
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
                        evidenceExpiry[
                          evidence.evidenceType
                        ]
                        ??
                        ""
                      }
                      onChange={
                        event =>
                          setEvidenceExpiry(
                            current => ({
                              ...current,
                              [evidence.evidenceType]:
                                event.target.value,
                            }),
                          )
                      }
                    />
                  </label>
                </div>

                {canManage &&
                editable ? (
                  <div className="onboarding-evidence-controls">
                    <button
                      type="button"
                      disabled={running}
                      onClick={
                        () =>
                          void uploadEvidence(
                            evidence,
                          )
                      }
                    >
                      Upload reference
                    </button>

                    <input
                      value={
                        evidenceNotes[
                          evidence.id
                        ]
                        ??
                        ""
                      }
                      placeholder={
                        "Evidence review note"
                      }
                      onChange={
                        event =>
                          setEvidenceNotes(
                            current => ({
                              ...current,
                              [evidence.id]:
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
                          evidenceNotes[
                            evidence.id
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void reviewEvidence(
                            evidence,
                            "VALIDATE",
                          )
                      }
                    >
                      <BadgeCheck
                        size={14}
                      />
                      Validate
                    </button>

                    <button
                      type="button"
                      className="onboarding-danger-button"
                      disabled={
                        running
                        ||
                        !(
                          evidenceNotes[
                            evidence.id
                          ]
                          ??
                          ""
                        )
                          .trim()
                      }
                      onClick={
                        () =>
                          void reviewEvidence(
                            evidence,
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

                {evidence.reviewNote ? (
                  <div className="onboarding-review-note">
                    {evidence.reviewNote}
                    {evidence.reviewedByName
                      ? ` — ${evidence.reviewedByName}`
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
              Risk-based routing
            </span>

            <h2>
              Qualification approvals
            </h2>
          </div>

          <UserCheck
            size={19}
          />
        </div>

        {onboardingCase.approvals.length ===
        0 ? (
          <div className="onboarding-empty">
            Approval routing is created
            when the case is submitted.
          </div>
        ) : (
          <div className="onboarding-approval-list">
            {onboardingCase.approvals.map(
              approval => {
                const canDecide =
                  approval.approvalLevel ===
                    "PROCUREMENT"
                    ? canProcurementApprove
                    : canGovern;

                return (
                  <article
                    key={approval.id}
                  >
                    <div className="onboarding-approval-heading">
                      <div>
                        <strong>
                          {readable(
                            approval.approvalLevel,
                          )}
                        </strong>

                        <span>
                          {approval.required
                            ? "Required"
                            : "Optional"}
                        </span>
                      </div>

                      <span
                        className={
                          `onboarding-approval-status onboarding-approval-status--${approval.status.toLowerCase()}`
                        }
                      >
                        {readable(
                          approval.status,
                        )}
                      </span>
                    </div>

                    {approval.decisionNote ? (
                      <div className="onboarding-review-note">
                        {approval.decisionNote}
                        {approval.decidedByName
                          ? ` — ${approval.decidedByName}`
                          : ""}
                      </div>
                    ) : null}

                    {approval.status ===
                      "PENDING" &&
                    onboardingCase.status ===
                      "IN_REVIEW" &&
                    canDecide ? (
                      <div className="onboarding-approval-controls">
                        <input
                          value={
                            approvalNotes[
                              approval.id
                            ]
                            ??
                            ""
                          }
                          placeholder={
                            "Approval rationale"
                          }
                          onChange={
                            event =>
                              setApprovalNotes(
                                current => ({
                                  ...current,
                                  [approval.id]:
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
                              approvalNotes[
                                approval.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void decideApproval(
                                approval,
                                "APPROVE",
                              )
                          }
                        >
                          <BadgeCheck
                            size={14}
                          />
                          Approve
                        </button>

                        <button
                          type="button"
                          className="onboarding-danger-button"
                          disabled={
                            running
                            ||
                            !(
                              approvalNotes[
                                approval.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void decideApproval(
                                approval,
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
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      {canGovern &&
      (
        onboardingCase.status ===
          "IN_REVIEW"
        ||
        onboardingCase.status ===
          "DRAFT"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance decision
              </span>

              <h2>
                Final qualification
              </h2>
            </div>

            <ShieldCheck
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Final decision rationale
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              value={finalNote}
              onChange={
                event =>
                  setFinalNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="onboarding-form-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !finalNote.trim()
              }
              onClick={
                () =>
                  void cancelCase()
              }
            >
              <XCircle
                size={16}
              />
              Cancel case
            </button>

            {onboardingCase.status ===
            "IN_REVIEW" ? (
              <>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={
                    running
                    ||
                    !finalNote.trim()
                  }
                  onClick={
                    () =>
                      void rejectCase()
                  }
                >
                  <AlertTriangle
                    size={16}
                  />
                  Reject supplier
                </button>

                <button
                  type="button"
                  className="button button--primary"
                  disabled={
                    running
                    ||
                    !finalNote.trim()
                    ||
                    !onboardingCase.activationEligible
                  }
                  onClick={
                    () =>
                      void finalizeCase()
                  }
                >
                  <BadgeCheck
                    size={16}
                  />
                  Grant activation clearance
                </button>
              </>
            ) : null}
          </div>

          {!onboardingCase.activationEligible &&
          onboardingCase.status ===
            "IN_REVIEW" ? (
            <div className="onboarding-final-block">
              <AlertTriangle
                size={15}
              />

              <span>
                Activation clearance is
                disabled until every
                mandatory gate passes.
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {onboardingCase.decisionNote ? (
        <section className="onboarding-decision-card">
          <BadgeCheck
            size={18}
          />

          <div>
            <strong>
              {readable(
                onboardingCase.status,
              )}
            </strong>

            <p>
              {onboardingCase.decisionNote}
            </p>

            {onboardingCase.requalificationDueDate ? (
              <span>
                Requalification due
                {" "}
                {new Date(
                  `${onboardingCase.requalificationDueDate}T00:00:00`,
                )
                  .toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
