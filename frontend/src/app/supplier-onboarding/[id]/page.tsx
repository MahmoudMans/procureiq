"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock3,
  FileCheck2,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  Meter,
  SegmentedFilter,
  type SegmentedOption,
  Skeleton,
  StatusBadge,
  formatDate,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
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
  QualificationComplianceStatus,
  QualificationQuestion,
  SupplierOnboardingCase,
} from "@/types/supplier-onboarding";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RationaleRequest =
  | { kind: "VALIDATE_EVIDENCE"; evidence: OnboardingEvidence }
  | { kind: "REJECT_EVIDENCE"; evidence: OnboardingEvidence }
  | { kind: "APPROVE"; approval: OnboardingApproval }
  | { kind: "REJECT_APPROVAL"; approval: OnboardingApproval }
  | { kind: "FINALIZE" }
  | { kind: "REJECT_CASE" }
  | { kind: "CANCEL_CASE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const PROCUREMENT_APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "APPROVER"];
const GOVERN_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const DAY_MS = 86400000;

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  keep: string;
  tone: "primary" | "danger";
  done: string;
  failed: string;
}

function rationaleCopy(request: RationaleRequest, c: SupplierOnboardingCase): RationaleCopy {
  switch (request.kind) {
    case "VALIDATE_EVIDENCE":
      return {
        eyebrow: "Evidence review",
        title: "Validate evidence",
        description: `Confirm that ${readable(request.evidence.evidenceType)} is valid for ${c.supplierName}.`,
        label: "Review note",
        placeholder: "What was checked, and why is it valid?",
        confirm: "Validate evidence",
        busy: "Validating…",
        keep: "Cancel",
        tone: "primary",
        done: "Evidence validated",
        failed: "Could not validate the evidence",
      };

    case "REJECT_EVIDENCE":
      return {
        eyebrow: "Evidence review",
        title: "Reject evidence",
        description: `${readable(request.evidence.evidenceType)} will be rejected and no longer counts toward the activation gates.`,
        label: "Rejection reason",
        placeholder: "What is wrong with this evidence?",
        confirm: "Reject evidence",
        busy: "Rejecting…",
        keep: "Cancel",
        tone: "danger",
        done: "Evidence rejected",
        failed: "Could not reject the evidence",
      };

    case "APPROVE":
      return {
        eyebrow: "Qualification approval",
        title: `Approve (${readable(request.approval.approvalLevel)})`,
        description: `Record your ${readable(request.approval.approvalLevel).toLowerCase()} approval of ${c.supplierName}.`,
        label: "Approval rationale",
        placeholder: "Why is this supplier acceptable?",
        confirm: "Approve",
        busy: "Approving…",
        keep: "Cancel",
        tone: "primary",
        done: "Approval recorded",
        failed: "Could not record the approval",
      };

    case "REJECT_APPROVAL":
      return {
        eyebrow: "Qualification approval",
        title: `Reject (${readable(request.approval.approvalLevel)})`,
        description: `Record your ${readable(request.approval.approvalLevel).toLowerCase()} rejection of ${c.supplierName}.`,
        label: "Rejection rationale",
        placeholder: "Why is this supplier not acceptable?",
        confirm: "Reject",
        busy: "Rejecting…",
        keep: "Cancel",
        tone: "danger",
        done: "Rejection recorded",
        failed: "Could not record the rejection",
      };

    case "FINALIZE":
      return {
        eyebrow: "Governance decision",
        title: "Grant activation clearance",
        description: `${c.supplierName} will be cleared for activation. Record the final decision.`,
        label: "Final decision rationale",
        placeholder: "Why is activation being cleared?",
        confirm: "Grant clearance",
        busy: "Granting…",
        keep: "Cancel",
        tone: "primary",
        done: "Activation clearance granted",
        failed: "Could not grant activation clearance",
      };

    case "REJECT_CASE":
      return {
        eyebrow: "Governance decision",
        title: "Reject this supplier",
        description: `${c.supplierName} will be rejected at qualification and will not be activated.`,
        label: "Rejection rationale",
        placeholder: "Why is this supplier being rejected?",
        confirm: "Reject supplier",
        busy: "Rejecting…",
        keep: "Cancel",
        tone: "danger",
        done: "Supplier rejected",
        failed: "Could not reject the supplier",
      };

    case "CANCEL_CASE":
      return {
        eyebrow: "Governance decision",
        title: "Cancel this onboarding case",
        description: `${c.caseNumber} will be cancelled without a qualification decision.`,
        label: "Cancellation rationale",
        placeholder: "Why is this case being cancelled?",
        confirm: "Cancel case",
        busy: "Cancelling…",
        keep: "Keep case",
        tone: "danger",
        done: "Onboarding case cancelled",
        failed: "Could not cancel the case",
      };
  }
}

function isUnanswered(question: QualificationQuestion): boolean {
  return !(question.answerValue ?? "").trim() || question.complianceStatus === "PENDING";
}

interface ExpiryNote {
  text: string;
  late: boolean;
}

function expiryNote(date: string, now: number | null): ExpiryNote | null {
  if (now === null) {
    return null;
  }

  const target = new Date(`${date}T00:00:00`).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  const days = Math.ceil((target - now) / DAY_MS);

  if (days < 0) {
    return { text: `Expired ${-days} ${-days === 1 ? "day" : "days"} ago`, late: true };
  }

  if (days === 0) {
    return { text: "Expires today", late: false };
  }

  if (days <= 30) {
    return { text: `Expires in ${days} ${days === 1 ? "day" : "days"}`, late: false };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Question card                                                       */
/* ------------------------------------------------------------------ */

interface QuestionCardProps {
  question: QualificationQuestion;
  caseId: string;
  canEdit: boolean;
  onSaved: () => void;
}

function QuestionCard({ question, caseId, canEdit, onSaved }: QuestionCardProps) {
  const toast = useToast();

  const [answer, setAnswer] = useState(question.answerValue ?? "");
  const [compliance, setCompliance] = useState<QualificationComplianceStatus>(
    question.complianceStatus,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    answer.trim() !== (question.answerValue ?? "").trim() ||
    compliance !== question.complianceStatus;

  async function save() {
    if (saving) {
      return;
    }

    if (!answer.trim() || compliance === "PENDING") {
      setError("Enter an answer and select its compliance assessment.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await answerSupplierQualificationQuestion(caseId, question.questionCode, {
        answerValue: answer.trim(),
        complianceStatus: compliance,
      });

      toast.success("Answer saved", question.questionCode);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save qualification answer.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={
        question.complianceStatus === "NON_COMPLIANT"
          ? "onboarding-question onboarding-question--non-compliant"
          : "onboarding-question"
      }
    >
      <div className="onboarding-question-heading">
        <div>
          <strong>{question.questionLabel}</strong>

          <span>
            {question.questionCode}
            {question.mandatory ? " · Mandatory" : " · Optional"}
          </span>
        </div>

        <StatusBadge value={question.complianceStatus} />
      </div>

      <textarea
        rows={3}
        aria-label={`Answer for ${question.questionLabel}`}
        disabled={!canEdit}
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
          setError(null);
        }}
      />

      <div className="onboarding-question-controls">
        <select
          aria-label={`Compliance assessment for ${question.questionLabel}`}
          disabled={!canEdit}
          value={compliance}
          onChange={(event) => {
            setCompliance(event.target.value as QualificationComplianceStatus);
            setError(null);
          }}
        >
          <option value="PENDING">Pending assessment</option>

          <option value="COMPLIANT">Compliant</option>

          <option value="NON_COMPLIANT">Non-compliant</option>
        </select>

        {canEdit ? (
          <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? "Saving…" : "Save answer"}
          </button>
        ) : null}
      </div>

      {error ? (
        <small className="kit-text-danger" role="alert">
          {error}
        </small>
      ) : null}

      {canEdit && dirty && !error ? <small className="kit-text-warning">Unsaved changes</small> : null}

      {question.answeredByName ? <small>Last answered by {question.answeredByName}</small> : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence card                                                       */
/* ------------------------------------------------------------------ */

interface EvidenceCardProps {
  evidence: OnboardingEvidence;
  caseId: string;
  canEdit: boolean;
  busy: boolean;
  now: number | null;
  onSaved: () => void;
  onReview: (kind: "VALIDATE" | "REJECT", evidence: OnboardingEvidence) => void;
}

function EvidenceCard({ evidence, caseId, canEdit, busy, now, onSaved, onReview }: EvidenceCardProps) {
  const toast = useToast();

  const [reference, setReference] = useState(evidence.documentReference ?? "");
  const [expiry, setExpiry] = useState(evidence.expiryDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savedReference = (evidence.documentReference ?? "").trim();
  const dirty = reference.trim() !== savedReference || expiry !== (evidence.expiryDate ?? "");
  const blocked = evidence.status === "REJECTED" || evidence.status === "EXPIRED";
  const expiryFlag = evidence.expiryDate ? expiryNote(evidence.expiryDate, now) : null;

  async function save() {
    if (saving) {
      return;
    }

    if (!reference.trim()) {
      setError("Evidence reference is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await uploadSupplierOnboardingEvidence(caseId, evidence.evidenceType, {
        documentReference: reference.trim(),
        expiryDate: expiry || undefined,
      });

      toast.success("Evidence reference saved", readable(evidence.evidenceType));
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to upload onboarding evidence reference.",
      );
    } finally {
      setSaving(false);
    }
  }

  const reviewBlocked = savedReference === "" || dirty;

  return (
    <article
      className={
        blocked ? "onboarding-evidence onboarding-evidence--blocked" : "onboarding-evidence"
      }
    >
      <div className="onboarding-evidence-heading">
        <div>
          <strong>{readable(evidence.evidenceType)}</strong>

          <span>{evidence.mandatory ? "Mandatory" : "Optional"}</span>
        </div>

        <StatusBadge value={evidence.status} />
      </div>

      <div className="onboarding-evidence-fields">
        <label>
          <span>Document / evidence reference</span>

          <input
            disabled={!canEdit}
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setError(null);
            }}
          />
        </label>

        <label>
          <span>Expiry date</span>

          <input
            type="date"
            disabled={!canEdit}
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <small className="kit-text-danger" role="alert">
          {error}
        </small>
      ) : null}

      {expiryFlag ? (
        <small className={expiryFlag.late ? "kit-text-danger" : "kit-text-warning"}>
          {expiryFlag.text}
        </small>
      ) : null}

      {canEdit ? (
        <div className="onboarding-evidence-controls">
          <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? "Saving…" : "Save reference"}
          </button>

          <button
            type="button"
            disabled={busy || reviewBlocked}
            title={
              reviewBlocked
                ? "Save the evidence reference before reviewing it"
                : "Validate this evidence"
            }
            onClick={() => onReview("VALIDATE", evidence)}
          >
            <BadgeCheck size={14} />
            Validate
          </button>

          <button
            type="button"
            className="onboarding-danger-button"
            disabled={busy || reviewBlocked}
            title={
              reviewBlocked
                ? "Save the evidence reference before reviewing it"
                : "Reject this evidence"
            }
            onClick={() => onReview("REJECT", evidence)}
          >
            <XCircle size={14} />
            Reject
          </button>
        </div>
      ) : null}

      {evidence.reviewNote ? (
        <div className="onboarding-review-note">
          {evidence.reviewNote}
          {evidence.reviewedByName ? ` — ${evidence.reviewedByName}` : ""}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Approvals table                                                     */
/* ------------------------------------------------------------------ */

interface ApprovalColumnOptions {
  reviewing: boolean;
  canProcurementApprove: boolean;
  canGovern: boolean;
  busy: boolean;
  onDecide: (approval: OnboardingApproval, kind: "APPROVE" | "REJECT") => void;
}

function buildApprovalColumns(options: ApprovalColumnOptions): Column<OnboardingApproval>[] {
  return [
    {
      id: "level",
      header: "Approval level",
      sortValue: (approval) => approval.approvalLevel,
      cell: (approval) => (
        <div className="request-primary-cell">
          <strong>{readable(approval.approvalLevel)}</strong>

          <span>{approval.required ? "Required" : "Optional"}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (approval) => approval.status,
      cell: (approval) => <StatusBadge value={approval.status} />,
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (approval) => (approval.decisionNote ?? "").toLowerCase(),
      cell: (approval) =>
        approval.decisionNote ? (
          <div className="kit-cell-stack">
            <span>{approval.decisionNote}</span>

            {approval.decidedByName ? <small>— {approval.decidedByName}</small> : null}
          </div>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "actions",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 190,
      cell: (approval) => {
        const canDecide =
          approval.approvalLevel === "PROCUREMENT"
            ? options.canProcurementApprove
            : options.canGovern;

        if (approval.status !== "PENDING" || !options.reviewing || !canDecide) {
          return null;
        }

        return (
          <div style={{ display: "inline-flex", gap: 8 }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onDecide(approval, "APPROVE")}
            >
              <BadgeCheck size={14} />
              Approve
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onDecide(approval, "REJECT")}
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>
        );
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface CaseData {
  id: string;
  onboardingCase: SupplierOnboardingCase;
}

export default function SupplierOnboardingDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canProcurementApprove = user !== null && PROCUREMENT_APPROVE_ROLES.includes(user.role);
  const canGovern = user !== null && GOVERN_ROLES.includes(user.role);

  const [result, setResult] = useState<CaseData | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitRunning, setSubmitRunning] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [questionView, setQuestionView] = useState("ALL");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getSupplierOnboardingCase(id);

        if (active) {
          setResult({ id, onboardingCase: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load supplier onboarding case.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);

    return () => window.clearTimeout(timer);
  }, [result]);

  const data = result !== null && result.id === params.id ? result : null;
  const onboardingCase = data?.onboardingCase ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function confirmSubmit() {
    if (!onboardingCase) {
      return;
    }

    setSubmitRunning(true);

    try {
      await submitSupplierOnboardingCase(params.id);

      setSubmitOpen(false);

      toast.success("Submitted for review", onboardingCase.caseNumber);
      reload();
    } catch (caught) {
      setSubmitOpen(false);

      toast.error(
        "Could not submit the case",
        caught instanceof Error ? caught.message : "Unable to submit onboarding case.",
      );
    } finally {
      setSubmitRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (!onboardingCase || rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, onboardingCase);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      switch (request.kind) {
        case "VALIDATE_EVIDENCE":
          await validateSupplierOnboardingEvidence(request.evidence.id, note);
          break;

        case "REJECT_EVIDENCE":
          await rejectSupplierOnboardingEvidence(request.evidence.id, note);
          break;

        case "APPROVE":
          await approveSupplierOnboarding(request.approval.id, note);
          break;

        case "REJECT_APPROVAL":
          await rejectSupplierOnboardingApproval(request.approval.id, note);
          break;

        case "FINALIZE":
          await finalizeSupplierOnboardingCase(params.id, note);
          break;

        case "REJECT_CASE":
          await rejectSupplierOnboardingCase(params.id, note);
          break;

        case "CANCEL_CASE":
          await cancelSupplierOnboardingCase(params.id, note);
          break;
      }

      setRationale(null);

      toast.success(copy.done, onboardingCase.caseNumber);
      reload();
    } catch (caught) {
      setRationaleError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(request: RationaleRequest) {
    setRationaleError(null);
    setRationale(request);
  }

  if (onboardingCase === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/supplier-onboarding" className="request-back-link">
          <ArrowLeft size={16} />
          Supplier onboarding
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const status = onboardingCase.status;
  const editable = status === "DRAFT" || status === "IN_REVIEW";
  const canEdit = canManage && editable;
  const busyAny = submitRunning || rationaleRunning;

  const missingQuestions =
    onboardingCase.mandatoryQuestions - onboardingCase.answeredMandatoryQuestions;
  const missingEvidence = onboardingCase.mandatoryEvidence - onboardingCase.validMandatoryEvidence;

  const todoCount = onboardingCase.questions.filter(
    (question) => question.mandatory && isUnanswered(question),
  ).length;
  const nonCompliantCount = onboardingCase.questions.filter(
    (question) => question.complianceStatus === "NON_COMPLIANT",
  ).length;

  const shownQuestions = onboardingCase.questions.filter((question) => {
    if (questionView === "TODO") {
      return question.mandatory && isUnanswered(question);
    }

    if (questionView === "NONCOMPLIANT") {
      return question.complianceStatus === "NON_COMPLIANT";
    }

    return true;
  });

  const questionOptions: SegmentedOption[] = [
    { value: "ALL", label: `All · ${onboardingCase.questions.length}` },
    { value: "TODO", label: `To do · ${todoCount}` },
    { value: "NONCOMPLIANT", label: `Non-compliant · ${nonCompliantCount}` },
  ];

  const kpis: KpiItem[] = [
    {
      label: "Qualification",
      icon: FileCheck2,
      value: `${onboardingCase.answeredMandatoryQuestions} / ${onboardingCase.mandatoryQuestions}`,
      note: `${onboardingCase.nonCompliantMandatoryQuestions} non-compliant`,
      tone: onboardingCase.nonCompliantMandatoryQuestions > 0 ? "warning" : "default",
    },
    {
      label: "Evidence",
      icon: ShieldCheck,
      value: `${onboardingCase.validMandatoryEvidence} / ${onboardingCase.mandatoryEvidence}`,
      note: "Mandatory valid evidence",
    },
    {
      label: "Approvals",
      icon: UserCheck,
      value: `${onboardingCase.approvedRequiredApprovals} / ${onboardingCase.requiredApprovals}`,
      note: "Risk-based approvals",
    },
    {
      label: "SLA",
      icon: Clock3,
      value: onboardingCase.slaOverdue ? "Overdue" : `${onboardingCase.daysOpen} days`,
      note: `Due ${formatDate(onboardingCase.slaDueAt)}`,
      tone: onboardingCase.slaOverdue ? "warning" : "default",
    },
  ];

  const approvalColumns = buildApprovalColumns({
    reviewing: status === "IN_REVIEW",
    canProcurementApprove,
    canGovern,
    busy: busyAny,
    onDecide: (approval, kind) =>
      openRationale(
        kind === "APPROVE"
          ? { kind: "APPROVE", approval }
          : { kind: "REJECT_APPROVAL", approval },
      ),
  });

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, onboardingCase) : null;

  return (
    <div className="page-stack">
      <Link href="/supplier-onboarding" className="request-back-link">
        <ArrowLeft size={16} />
        Supplier onboarding
      </Link>

      <section className="onboarding-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{onboardingCase.caseNumber}</span>

            <StatusBadge value={status} />

            <StatusBadge
              value={onboardingCase.riskTier}
              label={`${readable(onboardingCase.riskTier)} risk tier`}
            />
          </div>

          <h1>{onboardingCase.supplierName}</h1>

          <p>
            {onboardingCase.supplierCode}
            {" · "}
            {readable(onboardingCase.caseType)}
            {" · Owner: "}
            {onboardingCase.ownerName}
          </p>
        </div>

        <div className="onboarding-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canGovern && editable ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CANCEL_CASE" })}
            >
              <XCircle size={16} />
              Cancel case
            </button>
          ) : null}

          {canGovern && status === "IN_REVIEW" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "REJECT_CASE" })}
            >
              <AlertTriangle size={16} />
              Reject supplier
            </button>
          ) : null}

          {canGovern && status === "IN_REVIEW" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !onboardingCase.activationEligible}
              title={
                onboardingCase.activationEligible
                  ? undefined
                  : "Every mandatory gate must pass first"
              }
              onClick={() => openRationale({ kind: "FINALIZE" })}
            >
              <BadgeCheck size={16} />
              Grant activation clearance
            </button>
          ) : null}

          {canManage && status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setSubmitOpen(true)}
            >
              <Send size={16} />
              Submit for review
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      <section
        role="status"
        className={
          onboardingCase.activationClearance
            ? "onboarding-activation-banner onboarding-activation-banner--cleared"
            : onboardingCase.activationEligible
              ? "onboarding-activation-banner onboarding-activation-banner--ready"
              : "onboarding-activation-banner"
        }
      >
        {onboardingCase.activationClearance ? (
          <BadgeCheck size={20} />
        ) : onboardingCase.activationEligible ? (
          <ShieldCheck size={20} />
        ) : (
          <AlertTriangle size={20} />
        )}

        <div>
          <strong>
            {onboardingCase.activationClearance
              ? "Supplier activation clearance granted"
              : onboardingCase.activationEligible
                ? "All activation gates passed"
                : "Supplier activation remains blocked"}
          </strong>

          {onboardingCase.activationGateReasons.length > 0 ? (
            <ul>
              {onboardingCase.activationGateReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <span>Mandatory qualification, evidence and approvals are complete.</span>
          )}
        </div>
      </section>

      <KpiGrid items={kpis} ariaLabel="Onboarding gates" />

      <section className="onboarding-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Qualification</span>

              <h2>Supplier questionnaire</h2>
            </div>

            <FileCheck2 size={19} />
          </div>

          {onboardingCase.mandatoryQuestions > 0 ? (
            <div className="kit-meter-wrap">
              <Meter
                value={onboardingCase.answeredMandatoryQuestions}
                max={onboardingCase.mandatoryQuestions}
                tone={missingQuestions === 0 ? meterToneFor("success") : "primary"}
                ariaLabel="Mandatory questions answered"
              />

              <span className="kit-meter-caption">
                {onboardingCase.answeredMandatoryQuestions} of {onboardingCase.mandatoryQuestions}{" "}
                mandatory questions answered
              </span>
            </div>
          ) : null}

          {onboardingCase.questions.length > 0 ? (
            <div className="kit-toolbar" style={{ marginBottom: 14 }}>
              <SegmentedFilter
                options={questionOptions}
                value={questionView}
                onChange={setQuestionView}
                ariaLabel="Filter questions"
              />
            </div>
          ) : null}

          {onboardingCase.questions.length === 0 ? (
            <EmptyState
              compact
              icon={FileCheck2}
              title="No questions"
              description="No qualification questions apply to this case."
            />
          ) : shownQuestions.length === 0 ? (
            <EmptyState
              compact
              icon={ShieldCheck}
              title="Nothing in this view"
              description="No questions match the selected filter."
            />
          ) : (
            <div className="onboarding-question-list">
              {shownQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  caseId={params.id}
                  canEdit={canEdit}
                  onSaved={reload}
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Supplier context</span>

              <h2>Master-data snapshot</h2>
            </div>

            <UserCheck size={19} />
          </div>

          <div className="onboarding-context-grid">
            <div>
              <span>Supplier status</span>

              <strong>{onboardingCase.supplierStatus ?? "—"}</strong>
            </div>

            <div>
              <span>Existing risk</span>

              <strong>{onboardingCase.supplierRiskLevel ?? "—"}</strong>
            </div>

            <div>
              <span>Category</span>

              <strong>{onboardingCase.supplierCategory ?? "—"}</strong>
            </div>

            <div>
              <span>Country</span>

              <strong>{onboardingCase.supplierCountry ?? "—"}</strong>
            </div>

            <div>
              <span>Qualification tier</span>

              <strong>{onboardingCase.riskTier}</strong>
            </div>

            <div>
              <span>Requalification</span>

              <strong>
                {onboardingCase.requalificationDueDate
                  ? formatDate(onboardingCase.requalificationDueDate)
                  : "—"}
              </strong>
            </div>
          </div>

          {onboardingCase.notes ? (
            <div className="onboarding-notes">{onboardingCase.notes}</div>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Qualification evidence</span>

            <h2>Mandatory documentation</h2>
          </div>

          <ShieldCheck size={19} />
        </div>

        {onboardingCase.mandatoryEvidence > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={onboardingCase.validMandatoryEvidence}
              max={onboardingCase.mandatoryEvidence}
              tone={missingEvidence === 0 ? meterToneFor("success") : "primary"}
              ariaLabel="Mandatory evidence validated"
            />

            <span className="kit-meter-caption">
              {onboardingCase.validMandatoryEvidence} of {onboardingCase.mandatoryEvidence}{" "}
              mandatory evidence items validated
            </span>
          </div>
        ) : null}

        {onboardingCase.evidence.length === 0 ? (
          <EmptyState
            compact
            icon={ShieldCheck}
            title="No evidence required"
            description="No qualification evidence applies to this case."
          />
        ) : (
          <div className="onboarding-evidence-list">
            {onboardingCase.evidence.map((evidence) => (
              <EvidenceCard
                key={evidence.id}
                evidence={evidence}
                caseId={params.id}
                canEdit={canEdit}
                busy={busyAny}
                now={now}
                onSaved={reload}
                onReview={(kind, item) =>
                  openRationale(
                    kind === "VALIDATE"
                      ? { kind: "VALIDATE_EVIDENCE", evidence: item }
                      : { kind: "REJECT_EVIDENCE", evidence: item },
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Risk-based routing</span>

            <h2>Qualification approvals</h2>
          </div>

          <UserCheck size={19} />
        </div>

        {onboardingCase.requiredApprovals > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={onboardingCase.approvedRequiredApprovals}
              max={onboardingCase.requiredApprovals}
              tone={onboardingCase.approvedRequiredApprovals === onboardingCase.requiredApprovals ? meterToneFor("success") : "primary"}
              ariaLabel="Required approvals granted"
            />

            <span className="kit-meter-caption">
              {onboardingCase.approvedRequiredApprovals} of {onboardingCase.requiredApprovals}{" "}
              required approvals granted
            </span>
          </div>
        ) : null}

        <DataTable
          columns={approvalColumns}
          rows={onboardingCase.approvals}
          getRowId={(approval) => String(approval.id)}
          ariaLabel="Qualification approvals"
          busy={fetching}
          empty={
            <EmptyState
              compact
              icon={UserCheck}
              title="No approvals yet"
              description="Approval routing is created when the case is submitted."
            />
          }
        />
      </section>

      {onboardingCase.decisionNote ? (
        <section className="onboarding-decision-card">
          <BadgeCheck size={18} />

          <div>
            <strong>{readable(status)}</strong>

            <p>{onboardingCase.decisionNote}</p>

            {onboardingCase.requalificationDueDate ? (
              <span>
                Requalification due {formatDate(onboardingCase.requalificationDueDate)}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {submitOpen ? (
        <ActionDialog
          eyebrow="Submit for review"
          title="Submit this case for review?"
          description={`${onboardingCase.caseNumber} for ${onboardingCase.supplierName} will move into review and approval routing will be created.`}
          confirmLabel="Submit for review"
          busyLabel="Submitting…"
          cancelLabel="Not yet"
          busy={submitRunning}
          onConfirm={() => void confirmSubmit()}
          onCancel={() => setSubmitOpen(false)}
        >
          {missingQuestions > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {missingQuestions} mandatory{" "}
              {missingQuestions === 1 ? "question is" : "questions are"} still unanswered.
            </p>
          ) : null}

          {onboardingCase.nonCompliantMandatoryQuestions > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {onboardingCase.nonCompliantMandatoryQuestions} mandatory{" "}
              {onboardingCase.nonCompliantMandatoryQuestions === 1 ? "answer is" : "answers are"}{" "}
              non-compliant.
            </p>
          ) : null}

          {missingEvidence > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {missingEvidence} mandatory evidence{" "}
              {missingEvidence === 1 ? "item is" : "items are"} not valid yet.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {rationale !== null && rationaleInfo !== null ? (
        <RationaleDialog
          eyebrow={rationaleInfo.eyebrow}
          title={rationaleInfo.title}
          description={rationaleInfo.description}
          label={rationaleInfo.label}
          placeholder={rationaleInfo.placeholder}
          confirmLabel={rationaleInfo.confirm}
          busyLabel={rationaleInfo.busy}
          cancelLabel={rationaleInfo.keep}
          tone={rationaleInfo.tone}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
