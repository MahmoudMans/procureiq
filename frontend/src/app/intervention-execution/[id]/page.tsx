"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  FileCheck2,
  Gauge,
  Goal,
  Info,
  Play,
  Plus,
  RefreshCw,
  Send,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  Field,
  KpiGrid,
  type KpiItem,
  Meter,
  type MeterTone,
  Modal,
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  acknowledgeInterventionExecution,
  closeInterventionExecutionCase,
  getInterventionExecutionCase,
  recordInterventionExecutionEvidence,
  startInterventionExecution,
  submitInterventionExecutionForVerification,
  verifyInterventionExecution,
} from "@/lib/api";
import type { InterventionExecutionCaseDetail } from "@/types/intervention-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ExecutionCase = InterventionExecutionCaseDetail["executionCase"];
type EvidenceRecord = InterventionExecutionCaseDetail["evidence"][number];
type VerificationRecord = InterventionExecutionCaseDetail["verifications"][number];
type Flow = "START" | "SUBMIT";
type EvidenceField = "date" | "amount" | "evidence" | "reference";
type RationaleRequest =
  | { kind: "ACKNOWLEDGE" }
  | { kind: "VERIFY" }
  | { kind: "REMEDIATE" }
  | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function CaseBadge({ status }: { status: string }) {
  switch (status) {
    case "REMEDIATION_REQUIRED":
      return <StatusBadge value="AT_RISK" label="Remediation required" />;

    case "READY_FOR_VERIFICATION":
      return <StatusBadge value="IN_REVIEW" label="Ready for verification" />;

    case "VERIFIED":
      return <StatusBadge value="COMPLETED" label="Verified" />;

    default:
      return <StatusBadge value={status} label={readable(status)} />;
  }
}

function VerificationBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "VERIFIED":
      return <StatusBadge value="COMPLETED" label="Verified" />;

    case "REMEDIATION_REQUIRED":
      return <StatusBadge value="AT_RISK" label="Remediation required" />;

    default:
      return <StatusBadge value={decision} label={readable(decision)} />;
  }
}

function ProgressLine({
  pct,
  tone,
  caption,
  label,
}: {
  pct: number;
  tone: MeterTone;
  caption: string;
  label: string;
}) {
  return (
    <div className="kit-meter-wrap">
      <Meter value={clampPercent(pct)} max={100} tone={tone} ariaLabel={label} />

      <span className="kit-meter-caption">{caption}</span>
    </div>
  );
}

interface FlowCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const FLOWS: Record<Flow, FlowCopy> = {
  START: {
    eyebrow: "Implementation start",
    title: "Start implementation?",
    confirm: "Start implementation",
    busy: "Starting…",
    keep: "Not yet",
    done: "Implementation started",
    failed: "Could not start the implementation",
  },
  SUBMIT: {
    eyebrow: "Verification gate",
    title: "Submit for verification?",
    confirm: "Submit for verification",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for verification",
    failed: "Could not submit for verification",
  },
};

function flowDescription(flow: Flow, executionCase: ExecutionCase): string {
  switch (flow) {
    case "START":
      return `${executionCase.executionNumber} becomes active and implementation evidence can be recorded against it.`;

    case "SUBMIT":
      return executionCase.implementationPct < 100
        ? `${executionCase.executionNumber} will be frozen for independent manager verification. Implementation is at ${executionCase.implementationPct.toFixed(1)}%, so it can be submitted but cannot be verified until it reaches 100%.`
        : `${executionCase.executionNumber} will be frozen for independent manager verification. Implementation is complete.`;
  }
}

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  cancelLabel?: string;
  tone: "primary" | "danger";
  done: string;
}

function rationaleCopy(request: RationaleRequest, executionCase: ExecutionCase): RationaleCopy {
  switch (request.kind) {
    case "ACKNOWLEDGE":
      return {
        eyebrow: "Authority acknowledgement",
        title: "Acknowledge approved intervention",
        description: `${executionCase.executionNumber} implements the approved ${readable(String(executionCase.approvedAction))} action affecting ${money(executionCase.approvedAffectedCapitalAmount, executionCase.currency)}. The acknowledgement is recorded immutably.`,
        label: "Acknowledgement note",
        placeholder: "Confirm that the approved action is understood and accepted.",
        confirm: "Record acknowledgement",
        busy: "Recording…",
        tone: "primary",
        done: "Authority acknowledged",
      };

    case "VERIFY":
      return {
        eyebrow: "Independent verification",
        title: "Verify implementation",
        description: `${executionCase.executionNumber} will be verified with ${money(executionCase.implementedCapitalAmount, executionCase.currency)} implemented (${executionCase.implementationPct.toFixed(1)}%).`,
        label: "Verification note",
        placeholder: "What evidence supports the verification?",
        confirm: "Verify execution",
        busy: "Verifying…",
        tone: "primary",
        done: "Execution verified",
      };

    case "REMEDIATE":
      return {
        eyebrow: "Independent verification",
        title: "Require remediation",
        description: `${executionCase.executionNumber} will be sent back for remediation. Further implementation evidence is needed before it can be submitted again.`,
        label: "Remediation requirement",
        placeholder: "What needs to be remediated?",
        confirm: "Require remediation",
        busy: "Recording…",
        cancelLabel: "Go back",
        tone: "danger",
        done: "Remediation required",
      };

    case "CLOSE":
      return {
        eyebrow: "Governance closure",
        title: "Close execution case",
        description: `${executionCase.executionNumber} was verified. Closing it finishes the governance lifecycle.`,
        label: "Closure note",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close execution case",
        busy: "Closing…",
        tone: "primary",
        done: "Execution case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<InterventionExecutionCaseDetail> {
  switch (request.kind) {
    case "ACKNOWLEDGE":
      return acknowledgeInterventionExecution(caseId, note);

    case "VERIFY":
      return verifyInterventionExecution(caseId, {
        decision: "VERIFIED",
        verificationNote: note,
      });

    case "REMEDIATE":
      return verifyInterventionExecution(caseId, {
        decision: "REMEDIATION_REQUIRED",
        verificationNote: note,
      });

    case "CLOSE":
      return closeInterventionExecutionCase(caseId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildEvidenceColumns(currency: string): Column<EvidenceRecord>[] {
  return [
    {
      id: "date",
      header: "Implemented on",
      sortValue: (item) => String(item.implementedOn ?? ""),
      cell: (item) => showDate(item.implementedOn),
    },
    {
      id: "capital",
      header: "Implemented capital",
      align: "right",
      sortValue: (item) => item.implementedCapitalAmount,
      cell: (item) => <strong>{money(item.implementedCapitalAmount, currency)}</strong>,
    },
    {
      id: "reference",
      header: "Reference",
      sortValue: (item) => String(item.referenceText ?? "").toLowerCase(),
      cell: (item) => item.referenceText,
    },
    {
      id: "note",
      header: "Evidence",
      cell: (item) => <span>{item.evidenceNote}</span>,
    },
    {
      id: "by",
      header: "Recorded by",
      sortValue: (item) => String(item.recordedByName ?? "").toLowerCase(),
      cell: (item) => item.recordedByName ?? <span className="kit-text-muted">—</span>,
    },
  ];
}

function buildVerificationColumns(currency: string): Column<VerificationRecord>[] {
  return [
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => <VerificationBadge decision={String(item.decision)} />,
    },
    {
      id: "pct",
      header: "Implementation",
      align: "right",
      sortValue: (item) => item.implementationPct,
      cell: (item) => `${item.implementationPct.toFixed(1)}%`,
    },
    {
      id: "implemented",
      header: "Implemented",
      align: "right",
      sortValue: (item) => item.implementedCapitalAmount,
      cell: (item) => money(item.implementedCapitalAmount, currency),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingImplementationAmount,
      cell: (item) => money(item.remainingImplementationAmount, currency),
    },
    {
      id: "note",
      header: "Verification note",
      cell: (item) => <span>{item.verificationNote}</span>,
    },
    {
      id: "by",
      header: "Verified by",
      sortValue: (item) => String(item.verifiedByName ?? "").toLowerCase(),
      cell: (item) => item.verifiedByName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "at",
      header: "Verified",
      sortValue: (item) => String(item.verifiedAt ?? ""),
      cell: (item) => (item.verifiedAt ? formatDateTime(item.verifiedAt) : "—"),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Record implementation modal                                         */
/* ------------------------------------------------------------------ */

interface EvidenceModalProps {
  caseId: string;
  executionCase: ExecutionCase;
  onClose: () => void;
  onSaved: (updated: InterventionExecutionCaseDetail, reference: string) => void;
}

function EvidenceModal({ caseId, executionCase, onClose, onSaved }: EvidenceModalProps) {
  const currency = executionCase.currency;
  const remaining = executionCase.remainingImplementationAmount;
  const isContinue = String(executionCase.approvedAction) === "CONTINUE";

  const [date, setDate] = useState(() => isoDate(0));
  const [amount, setAmount] = useState(() => (isContinue ? "0" : String(remaining)));
  const [evidence, setEvidence] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Partial<Record<EvidenceField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amountValid = !isContinue && numberError(amount, { min: 0.01 }) === undefined;
  const leavesRemaining = amountValid && Number(amount) < remaining - 0.005;

  function clearError(field: EvidenceField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<EvidenceField, string>> = {};

    if (!date) {
      next.date = "Choose the implementation date.";
    } else if (date > isoDate(0)) {
      next.date = "The implementation date cannot be in the future.";
    }

    if (!isContinue) {
      const problem = numberError(amount, { min: 0.01 });

      if (problem) {
        next.amount = problem;
      } else if (Number(amount) > remaining + 0.005) {
        next.amount = `Cannot exceed the remaining implementation of ${money(remaining, currency)}.`;
      }
    }

    if (!evidence.trim()) {
      next.evidence = "Describe the implementation evidence.";
    }

    if (!reference.trim()) {
      next.reference = "A reference or implementation identifier is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await recordInterventionExecutionEvidence(caseId, {
        implementedOn: date,
        implementedCapitalAmount: isContinue ? 0 : Number(amount),
        evidenceNote: evidence.trim(),
        referenceText: reference.trim(),
      });

      onSaved(updated, reference.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record implementation evidence.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Immutable implementation evidence"
      title="Record implementation"
      description="Evidence is immutable once recorded. It reconciles the approved intervention with what was actually implemented."
      size="lg"
      dismissible={!saving}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="execution-evidence-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record immutable evidence"}
          </button>
        </>
      }
    >
      <form id="execution-evidence-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Implemented on" htmlFor="execution-date" error={errors.date}>
            <input
              id="execution-date"
              className="kit-field-input"
              type="date"
              value={date}
              aria-invalid={errors.date ? true : undefined}
              onChange={(event) => {
                setDate(event.target.value);
                clearError("date");
              }}
            />
          </Field>

          {isContinue ? (
            <div>
              <p className="kit-meta-line">
                A Continue action has no capital to implement, so only the evidence is recorded.
              </p>
            </div>
          ) : (
            <div>
              <NumberField
                id="execution-amount"
                label={`Implemented capital (${currency})`}
                min={0.01}
                step="0.01"
                value={amount}
                error={errors.amount}
                onChange={(value) => {
                  setAmount(value);
                  clearError("amount");
                }}
              />

              <p className="kit-meta-line">
                Remaining to implement: {money(remaining, currency)}
              </p>
            </div>
          )}

          <div className="kit-pair-wide">
            <Field label="Evidence" htmlFor="execution-evidence" error={errors.evidence}>
              <textarea
                id="execution-evidence"
                className="kit-field-input"
                rows={5}
                value={evidence}
                aria-invalid={errors.evidence ? true : undefined}
                onChange={(event) => {
                  setEvidence(event.target.value);
                  clearError("evidence");
                }}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Reference / implementation identifier"
              htmlFor="execution-reference"
              error={errors.reference}
            >
              <input
                id="execution-reference"
                className="kit-field-input"
                value={reference}
                aria-invalid={errors.reference ? true : undefined}
                onChange={(event) => {
                  setReference(event.target.value);
                  clearError("reference");
                }}
              />
            </Field>
          </div>
        </div>

        {leavesRemaining ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This leaves {money(remaining - Number(amount), currency)} still to implement. Partial
            implementation can be submitted, but it cannot be verified until it reaches 100%.
          </p>
        ) : null}

        {error ? (
          <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface CaseData {
  id: string;
  detail: InterventionExecutionCaseDetail;
}

export default function InterventionExecutionCasePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<CaseData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getInterventionExecutionCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load intervention-execution case.",
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

  const data = result !== null && result.id === params.id ? result : null;
  const detail = data?.detail ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyDetail(updated: InterventionExecutionCaseDetail) {
    setResult((current) => (current ? { ...current, detail: updated } : current));
  }

  if (detail === null) {
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
        <Link href="/intervention-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Intervention execution
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

  const { executionCase: ec, evidence, verifications, acknowledgement } = detail;
  const currency = ec.currency;
  const status = String(ec.status);
  const planned = status === "PLANNED";
  const active = status === "ACTIVE";
  const remediation = status === "REMEDIATION_REQUIRED";
  const readyForVerification = status === "READY_FOR_VERIFICATION";
  const verified = status === "VERIFIED";
  const implementing = active || remediation;
  const isContinue = String(ec.approvedAction) === "CONTINUE";
  const complete = ec.implementationPct >= 100;
  const busyAny = flowRunning || rationaleRunning;
  const canRecord = canManage && implementing;
  const canSubmit = canManage && implementing && evidence.length > 0;
  const needsAcknowledgement = planned && !ec.acknowledged;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "START") {
        applyDetail(await startInterventionExecution(params.id));
      } else {
        applyDetail(await submitInterventionExecutionForVerification(params.id));
      }

      setFlow(null);

      toast.success(FLOWS[action].done, ec.executionNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the execution case.",
      );
    } finally {
      setFlowRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, ec);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, ec.executionNumber);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to record the decision.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(request: RationaleRequest) {
    setRationaleError(null);
    setRationale(request);
  }

  function handleRecorded(updated: InterventionExecutionCaseDetail, reference: string) {
    applyDetail(updated);
    setRecording(false);
    toast.success("Implementation evidence recorded", reference);
  }

  const orderedEvidence = [...evidence].sort((a, b) =>
    String(b.implementedOn ?? "").localeCompare(String(a.implementedOn ?? "")),
  );

  const orderedVerifications = [...verifications].sort((a, b) =>
    String(b.verifiedAt ?? "").localeCompare(String(a.verifiedAt ?? "")),
  );

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, ec) : null;

  const kpis: KpiItem[] = [
    {
      label: "Approved action",
      icon: Goal,
      value: readable(String(ec.approvedAction)),
      note: "From the Step 60 intervention",
    },
    {
      label: "Approved affected",
      icon: Coins,
      value: money(ec.approvedAffectedCapitalAmount, currency),
      note: "Capital the action covers",
    },
    {
      label: "Implemented",
      icon: BadgeCheck,
      value: money(ec.implementedCapitalAmount, currency),
      note: `${ec.evidenceCount} evidence ${ec.evidenceCount === 1 ? "record" : "records"}`,
    },
    {
      label: "Remaining implementation",
      icon: WalletCards,
      value: money(ec.remainingImplementationAmount, currency),
      note: "Still to be implemented",
    },
    {
      label: "Completion",
      icon: Gauge,
      value: `${ec.implementationPct.toFixed(1)}%`,
      note: "Of the approved amount",
    },
    {
      label: "Health",
      icon: Activity,
      value: readable(String(ec.executionHealth)),
      note: "Execution health",
    },
  ];

  const evidenceColumns = buildEvidenceColumns(currency);
  const verificationColumns = buildVerificationColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/intervention-execution" className="request-back-link">
        <ArrowLeft size={16} />
        Intervention execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{ec.executionNumber}</span>

            <CaseBadge status={status} />
          </div>

          <span className="eyebrow">Approved intervention implementation</span>

          <h1>{ec.initiativeTitle}</h1>

          <p>
            {ec.interventionNumber}
            {" · "}
            {ec.fundingCommitmentNumber}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canManage && needsAcknowledgement ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "ACKNOWLEDGE" })}
            >
              <BadgeCheck size={16} />
              Acknowledge
            </button>
          ) : null}

          {canManage && planned && ec.acknowledged ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("START")}
            >
              <Play size={15} />
              Start implementation
            </button>
          ) : null}

          {canRecord ? (
            <button
              type="button"
              className={`button ${evidence.length === 0 ? "button--primary" : "button--secondary"}`}
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record implementation
            </button>
          ) : null}

          {canSubmit ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("SUBMIT")}
            >
              <Send size={15} />
              Submit for verification
            </button>
          ) : null}

          {canFinalize && readyForVerification ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "REMEDIATE" })}
            >
              <XCircle size={15} />
              Require remediation
            </button>
          ) : null}

          {canFinalize && readyForVerification ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !complete}
              title={complete ? undefined : "Implementation must reach 100% before it can be verified"}
              onClick={() => openRationale({ kind: "VERIFY" })}
            >
              <BadgeCheck size={16} />
              Verify execution
            </button>
          ) : null}

          {canFinalize && verified ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close case
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

      {remediation ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Verification required remediation.</strong>{" "}
            {canManage
              ? "Record further implementation evidence, then submit the case for verification again."
              : "Further implementation evidence is needed before it can be submitted again."}
          </div>
        </div>
      ) : null}

      {canManage && needsAcknowledgement ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Acknowledge the approved intervention first.</strong> The acknowledgement is
            recorded immutably, and implementation can start after it.
          </div>
        </div>
      ) : null}

      {canManage && planned && ec.acknowledged ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The approved intervention is acknowledged.</strong> Start implementation to
            begin recording evidence.
          </div>
        </div>
      ) : null}

      {canManage && active && evidence.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Record the first implementation evidence.</strong> Evidence is immutable and
            reconciles the approved amount with what was implemented.
          </div>
        </div>
      ) : null}

      {canManage && implementing && evidence.length > 0 && !complete && !isContinue ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{money(ec.remainingImplementationAmount, currency)} remains to implement.</strong>{" "}
            You can submit now, but partial implementation cannot be verified until it reaches
            100%.
          </div>
        </div>
      ) : null}

      {canManage && implementing && evidence.length > 0 && (complete || isContinue) ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The implementation evidence is complete.</strong> Submit it for independent
            verification.
          </div>
        </div>
      ) : null}

      {readyForVerification ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting independent verification.</strong>{" "}
            {canFinalize
              ? "Use Verify execution or Require remediation above."
              : "A procurement manager or administrator needs to verify it."}
          </div>
        </div>
      ) : null}

      {readyForVerification && canFinalize && !complete ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Implementation is at {ec.implementationPct.toFixed(1)}%.</strong> It cannot be
            verified until it reaches 100%, so it can only be sent back for remediation.
          </div>
        </div>
      ) : null}

      {verified && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The execution is verified.</strong> Close the case to finish the governance
            lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Execution summary" />

      {!isContinue ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Implementation against the approved action</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={ec.implementationPct}
            tone={complete ? meterToneFor("success") : "primary"}
            caption={`${money(ec.implementedCapitalAmount, currency)} of ${money(ec.approvedAffectedCapitalAmount, currency)} implemented (${ec.implementationPct.toFixed(1)}%)`}
            label="Implemented capital against the approved amount"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Execution authority</span>

            <h2>Approved decision context</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="execution-objective">{ec.executionObjective}</p>

        <div className="execution-context-grid">
          <div>
            <span>Execution owner</span>

            <strong>{ec.executionOwnerName}</strong>
          </div>

          <div>
            <span>Step 58 released</span>

            <strong>{money(ec.currentReleasedCapitalAmount, currency)}</strong>
          </div>

          <div>
            <span>Step 58 remaining</span>

            <strong>{money(ec.currentRemainingCommitmentAmount, currency)}</strong>
          </div>

          <div>
            <span>Implementation variance</span>

            <strong>{money(ec.implementationVarianceAmount, currency)}</strong>
          </div>

          <div>
            <span>Source released snapshot</span>

            <strong>{money(ec.sourceReleasedCapitalSnapshot, currency)}</strong>
          </div>

          <div>
            <span>Source remaining snapshot</span>

            <strong>{money(ec.sourceRemainingCommitmentSnapshot, currency)}</strong>
          </div>

          <div>
            <span>Evidence records</span>

            <strong>{ec.evidenceCount}</strong>
          </div>

          <div>
            <span>Verification records</span>

            <strong>{ec.verificationCount}</strong>
          </div>
        </div>

        {ec.approvedTargetValueCaseNumber ? (
          <div className="execution-target-note">
            <strong>Approved reallocation target</strong>

            <p>
              {ec.approvedTargetValueCaseNumber}
              {" — "}
              {ec.approvedTargetInitiativeTitle}
            </p>
          </div>
        ) : null}
      </section>

      <div className="execution-source-links">
        <Link href={`/investment-interventions/${ec.interventionCaseId}`} className="table-action">
          Step 60 approved intervention
        </Link>

        <Link href={`/funding-execution/${ec.fundingCommitmentId}`} className="table-action">
          Step 58 funding evidence
        </Link>
      </div>

      {acknowledgement ? (
        <section className="execution-ack-record">
          <strong>Immutable execution acknowledgement</strong>

          <p>{acknowledgement.acknowledgementNote}</p>

          <small>
            {acknowledgement.acknowledgedByName}
            {" · "}
            {formatDateTime(acknowledgement.acknowledgedAt)}
          </small>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Implementation ledger</span>

            <h2>Evidence history</h2>
          </div>

          {canRecord ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record implementation
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        <DataTable
          columns={evidenceColumns}
          rows={orderedEvidence}
          getRowId={(item) => String(item.id)}
          ariaLabel="Implementation evidence"
          busy={fetching}
          empty={
            <EmptyState
              icon={Coins}
              title="No implementation evidence"
              description="No implementation evidence has been recorded."
              action={
                canRecord ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setRecording(true)}
                  >
                    <Plus size={15} />
                    Record implementation
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable verification history</span>

            <h2>Execution verification</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        <DataTable
          columns={verificationColumns}
          rows={orderedVerifications}
          getRowId={(item) => String(item.id)}
          ariaLabel="Execution verification"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No verification decision"
              description="No verification decision has been recorded."
            />
          }
        />
      </section>

      <section className="execution-method-note">
        <Goal size={18} />

        <div>
          <strong>Implemented capital is evidence, not a retroactive ledger edit</strong>

          <p>
            The implementation ledger reconciles approved Step 60 intervention amounts with
            documented execution. It does not delete, rewrite or reverse Step 58 release records.
          </p>
        </div>
      </section>

      {recording ? (
        <EvidenceModal
          caseId={params.id}
          executionCase={ec}
          onClose={() => setRecording(false)}
          onSaved={handleRecorded}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, ec)}
          confirmLabel={FLOWS[flow].confirm}
          busyLabel={FLOWS[flow].busy}
          cancelLabel={FLOWS[flow].keep}
          busy={flowRunning}
          onConfirm={() => void confirmFlow()}
          onCancel={() => setFlow(null)}
        />
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
          cancelLabel={rationaleInfo.cancelLabel}
          tone={rationaleInfo.tone}
          maxLength={5000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
