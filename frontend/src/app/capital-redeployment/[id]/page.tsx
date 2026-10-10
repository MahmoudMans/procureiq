"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  FileCheck2,
  Gauge,
  Goal,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
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
  activateCapitalRedeployment,
  authorizeCapitalRedeployment,
  closeCapitalRedeploymentCase,
  createCapitalRedeploymentGate,
  decideCapitalRedeploymentGate,
  getCapitalRedeploymentCase,
  recordCapitalRedeploymentRelease,
  submitCapitalRedeploymentForAuthorization,
  submitCapitalRedeploymentForVerification,
  verifyCapitalRedeployment,
} from "@/lib/api";
import type {
  CapitalRedeploymentCaseDetail,
  CapitalRedeploymentGateStatus,
} from "@/types/capital-redeployment";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RedeploymentCase = CapitalRedeploymentCaseDetail["redeploymentCase"];
type Gate = CapitalRedeploymentCaseDetail["gates"][number];
type Authorization = CapitalRedeploymentCaseDetail["authorizations"][number];
type Release = CapitalRedeploymentCaseDetail["releases"][number];
type Verification = CapitalRedeploymentCaseDetail["verifications"][number];
type Workflow = "SUBMIT_AUTH" | "ACTIVATE" | "SUBMIT_VERIFY";
type GateField = "title" | "requirement";
type DecisionField = "evidence" | "note";
type ReleaseField = "date" | "amount" | "evidence" | "reference";

type RationaleRequest =
  | { kind: "AUTHORIZE" }
  | { kind: "REJECT" }
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
    case "READY_FOR_AUTHORIZATION":
      return <StatusBadge value="READY" label="Ready for authorization" />;

    case "AUTHORIZED":
      return <StatusBadge value="APPROVED" label="Authorized" />;

    case "REMEDIATION_REQUIRED":
      return <StatusBadge value="AT_RISK" label="Remediation required" />;

    case "READY_FOR_VERIFICATION":
      return <StatusBadge value="READY" label="Ready for verification" />;

    case "VERIFIED":
      return <StatusBadge value="ACHIEVED" label="Verified" />;

    default:
      return <StatusBadge value={status} />;
  }
}

function GateBadge({ status }: { status: string }) {
  if (status === "SATISFIED") {
    return <StatusBadge value="ACHIEVED" label="Satisfied" />;
  }

  if (status === "WAIVED") {
    return <StatusBadge value="ACCEPTED" label="Waived" />;
  }

  return <StatusBadge value={status} />;
}

function VerificationBadge({ decision }: { decision: string }) {
  if (decision === "VERIFIED") {
    return <StatusBadge value="ACHIEVED" label="Verified" />;
  }

  if (decision === "REMEDIATION_REQUIRED") {
    return <StatusBadge value="AT_RISK" label="Remediation required" />;
  }

  return <StatusBadge value={decision} />;
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

interface WorkflowCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const WORKFLOWS: Record<Workflow, WorkflowCopy> = {
  SUBMIT_AUTH: {
    eyebrow: "Authorization gate",
    title: "Submit for funding authorization?",
    confirm: "Submit for authorization",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for authorization",
    failed: "Could not submit for authorization",
  },
  ACTIVATE: {
    eyebrow: "Release activation",
    title: "Activate this redeployment?",
    confirm: "Activate redeployment",
    busy: "Activating…",
    keep: "Not yet",
    done: "Redeployment activated",
    failed: "Could not activate the redeployment",
  },
  SUBMIT_VERIFY: {
    eyebrow: "Verification gate",
    title: "Submit for verification?",
    confirm: "Submit for verification",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for verification",
    failed: "Could not submit for verification",
  },
};

function workflowDescription(workflow: Workflow, rc: RedeploymentCase): string {
  switch (workflow) {
    case "SUBMIT_AUTH":
      return `${rc.redeploymentNumber} will be sent to a manager for funding authorization.`;

    case "ACTIVATE":
      return `${rc.redeploymentNumber} will be activated, and capital releases can then be recorded.`;

    case "SUBMIT_VERIFY":
      return `${rc.redeploymentNumber} will be submitted for independent verification.`;
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
  tone: "primary" | "danger";
  done: string;
}

function rationaleCopy(request: RationaleRequest, rc: RedeploymentCase): RationaleCopy {
  switch (request.kind) {
    case "AUTHORIZE":
      return {
        eyebrow: "Manager authorization",
        title: "Authorize this redeployment",
        description: `${money(rc.approvedRedeploymentAmount, rc.currency)} of recycled capital will be authorized for ${rc.targetInitiativeTitle}.`,
        label: "Authorization rationale",
        placeholder: "Why is this capital being authorized?",
        confirm: "Authorize capital",
        busy: "Authorizing…",
        tone: "primary",
        done: "Capital authorized",
      };

    case "REJECT":
      return {
        eyebrow: "Manager authorization",
        title: "Reject this redeployment",
        description: `${rc.redeploymentNumber} will be rejected and no capital will be authorized.`,
        label: "Rejection rationale",
        placeholder: "Why is this redeployment being rejected?",
        confirm: "Reject redeployment",
        busy: "Rejecting…",
        tone: "danger",
        done: "Redeployment rejected",
      };

    case "VERIFY":
      return {
        eyebrow: "Independent verification",
        title: "Verify the full redeployment",
        description: `${money(rc.releasedRedeploymentAmount, rc.currency)} was released toward ${rc.targetInitiativeTitle}.`,
        label: "Verification rationale",
        placeholder: "What confirms the capital reached its target?",
        confirm: "Verify redeployment",
        busy: "Verifying…",
        tone: "primary",
        done: "Redeployment verified",
      };

    case "REMEDIATE":
      return {
        eyebrow: "Independent verification",
        title: "Require remediation",
        description: `${rc.redeploymentNumber} goes back for remediation so further releases can be recorded.`,
        label: "Verification rationale",
        placeholder: "What needs to be remediated?",
        confirm: "Require remediation",
        busy: "Updating…",
        tone: "danger",
        done: "Remediation required",
      };

    case "CLOSE":
      return {
        eyebrow: "Governance closure",
        title: "Close this redeployment case",
        description: `${rc.redeploymentNumber} was verified. Closing it finishes redeployment governance.`,
        label: "Closure note",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close redeployment case",
        busy: "Closing…",
        tone: "primary",
        done: "Redeployment case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  id: string,
  note: string,
): Promise<CapitalRedeploymentCaseDetail> {
  switch (request.kind) {
    case "AUTHORIZE":
      return authorizeCapitalRedeployment(id, { decision: "APPROVED", authorizationNote: note });

    case "REJECT":
      return authorizeCapitalRedeployment(id, { decision: "REJECTED", authorizationNote: note });

    case "VERIFY":
      return verifyCapitalRedeployment(id, { decision: "VERIFIED", verificationNote: note });

    case "REMEDIATE":
      return verifyCapitalRedeployment(id, {
        decision: "REMEDIATION_REQUIRED",
        verificationNote: note,
      });

    case "CLOSE":
      return closeCapitalRedeploymentCase(id, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface GateColumnOptions {
  canDecide: boolean;
  busy: boolean;
  onDecide: (gate: Gate) => void;
}

function buildGateColumns(options: GateColumnOptions): Column<Gate>[] {
  return [
    {
      id: "gate",
      header: "Gate",
      sortValue: (gate) => gate.title.toLowerCase(),
      cell: (gate) => (
        <div className="request-primary-cell">
          <strong>{gate.title}</strong>

          <span>{gate.gateNumber}</span>

          <span>{gate.requirement}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (gate) => String(gate.status),
      cell: (gate) => <GateBadge status={String(gate.status)} />,
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: (gate) =>
        gate.evidenceNote ? (
          <span>{gate.evidenceNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 130,
      cell: (gate) =>
        options.canDecide && gate.status === "PENDING" ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onDecide(gate)}
          >
            <ShieldCheck size={14} />
            Decide
          </button>
        ) : null,
    },
  ];
}

function buildAuthorizationColumns(currency: string): Column<Authorization>[] {
  return [
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => <StatusBadge value={String(item.decision)} />,
    },
    {
      id: "amount",
      header: "Authorized amount",
      align: "right",
      sortValue: (item) => item.authorizedAmount,
      cell: (item) => money(item.authorizedAmount, currency),
    },
    {
      id: "note",
      header: "Authorization note",
      cell: (item) => <span>{item.authorizationNote}</span>,
    },
    {
      id: "by",
      header: "Authorized",
      sortValue: (item) => item.authorizedAt,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{formatDateTime(item.authorizedAt)}</span>

          <small>{item.authorizedByName}</small>
        </div>
      ),
    },
  ];
}

function buildReleaseColumns(currency: string): Column<Release>[] {
  return [
    {
      id: "amount",
      header: "Released",
      align: "right",
      sortValue: (item) => item.releasedAmount,
      cell: (item) => <strong>{money(item.releasedAmount, currency)}</strong>,
    },
    {
      id: "date",
      header: "Released on",
      sortValue: (item) => item.releasedOn,
      cell: (item) => formatDate(item.releasedOn),
    },
    {
      id: "reference",
      header: "Reference",
      sortValue: (item) => item.referenceText.toLowerCase(),
      cell: (item) => item.referenceText,
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: (item) => <span>{item.evidenceNote}</span>,
    },
    {
      id: "by",
      header: "Recorded",
      sortValue: (item) => item.releasedAt,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{formatDateTime(item.releasedAt)}</span>

          <small>{item.releasedByName}</small>
        </div>
      ),
    },
  ];
}

function buildVerificationColumns(currency: string): Column<Verification>[] {
  return [
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => <VerificationBadge decision={String(item.decision)} />,
    },
    {
      id: "pct",
      header: "Redeployed",
      align: "right",
      sortValue: (item) => item.redeploymentPct,
      cell: (item) => `${item.redeploymentPct.toFixed(1)}%`,
    },
    {
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.releasedRedeploymentAmount,
      cell: (item) => money(item.releasedRedeploymentAmount, currency),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingRedeploymentAmount,
      cell: (item) => money(item.remainingRedeploymentAmount, currency),
    },
    {
      id: "note",
      header: "Verification note",
      cell: (item) => <span>{item.verificationNote}</span>,
    },
    {
      id: "by",
      header: "Verified by",
      sortValue: (item) => item.verifiedByName.toLowerCase(),
      cell: (item) => item.verifiedByName,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add gate modal                                                      */
/* ------------------------------------------------------------------ */

interface AddGateModalProps {
  caseId: string;
  onClose: () => void;
  onSaved: (updated: CapitalRedeploymentCaseDetail, title: string) => void;
}

function AddGateModal({ caseId, onClose, onSaved }: AddGateModalProps) {
  const [title, setTitle] = useState("");
  const [requirement, setRequirement] = useState("");
  const [errors, setErrors] = useState<Partial<Record<GateField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: GateField) {
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

    const next: Partial<Record<GateField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter a gate title.";
    }

    if (!requirement.trim()) {
      next.requirement = "Describe the evidence this gate requires.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await createCapitalRedeploymentGate(caseId, {
        title: title.trim(),
        requirement: requirement.trim(),
      });

      onSaved(updated, title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create redeployment gate.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Release controls"
      title="Add redeployment gate"
      description="Evidence that must be satisfied or waived before the redeployment can be authorized."
      size="md"
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
            form="redeployment-gate-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add evidence gate"}
          </button>
        </>
      }
    >
      <form id="redeployment-gate-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Gate title" htmlFor="gate-title" error={errors.title}>
              <input
                id="gate-title"
                className="kit-field-input"
                maxLength={220}
                value={title}
                aria-invalid={errors.title ? true : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearError("title");
                }}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Evidence requirement"
              htmlFor="gate-requirement"
              error={errors.requirement}
            >
              <textarea
                id="gate-requirement"
                className="kit-field-input"
                rows={4}
                value={requirement}
                aria-invalid={errors.requirement ? true : undefined}
                onChange={(event) => {
                  setRequirement(event.target.value);
                  clearError("requirement");
                }}
              />
            </Field>
          </div>
        </div>

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
/* Decide gate modal                                                   */
/* ------------------------------------------------------------------ */

interface DecisionModalProps {
  gate: Gate;
  onClose: () => void;
  onSaved: (updated: CapitalRedeploymentCaseDetail, message: string, title: string) => void;
}

function DecisionModal({ gate, onClose, onSaved }: DecisionModalProps) {
  const [decision, setDecision] = useState<CapitalRedeploymentGateStatus>("SATISFIED");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DecisionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const waiving = String(decision) === "WAIVED";

  function clearError(field: DecisionField) {
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

    const next: Partial<Record<DecisionField, string>> = {};

    if (!evidence.trim()) {
      next.evidence = "Gate evidence is required.";
    }

    if (!note.trim()) {
      next.note = "A decision note is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await decideCapitalRedeploymentGate(gate.id, {
        decision,
        evidenceNote: evidence.trim(),
        decisionNote: note.trim(),
      });

      onSaved(updated, waiving ? "Gate waived" : "Gate satisfied", gate.title);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to decide redeployment gate.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Evidence gate"
      title="Decide gate"
      description={`${gate.gateNumber} — ${gate.title}. Requirement: ${gate.requirement}`}
      size="md"
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
            form="redeployment-decision-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : waiving ? "Waive gate" : "Satisfy gate"}
          </button>
        </>
      }
    >
      <form id="redeployment-decision-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Outcome" htmlFor="decision-outcome">
              <select
                id="decision-outcome"
                className="kit-field-input"
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as CapitalRedeploymentGateStatus)
                }
              >
                <option value="SATISFIED">Satisfy</option>

                <option value="WAIVED">Waive</option>
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Evidence" htmlFor="decision-evidence" error={errors.evidence}>
              <textarea
                id="decision-evidence"
                className="kit-field-input"
                rows={3}
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
            <Field label="Decision note" htmlFor="decision-note" error={errors.note}>
              <textarea
                id="decision-note"
                className="kit-field-input"
                rows={3}
                maxLength={2000}
                value={note}
                aria-invalid={errors.note ? true : undefined}
                onChange={(event) => {
                  setNote(event.target.value);
                  clearError("note");
                }}
              />
            </Field>
          </div>
        </div>

        {waiving ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            Waiving accepts the gate without the required evidence being met. Explain why in the
            decision note.
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
/* Record release modal                                                */
/* ------------------------------------------------------------------ */

interface ReleaseModalProps {
  caseId: string;
  redeployment: RedeploymentCase;
  onClose: () => void;
  onSaved: (updated: CapitalRedeploymentCaseDetail) => void;
}

function ReleaseModal({ caseId, redeployment, onClose, onSaved }: ReleaseModalProps) {
  const remaining = redeployment.remainingRedeploymentAmount;

  const [releasedOn, setReleasedOn] = useState(() => isoDate(0));
  const [amount, setAmount] = useState(() => String(remaining));
  const [evidence, setEvidence] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ReleaseField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validAmount = numberError(amount, { min: 0.01, max: remaining }) === undefined;
  const partial = validAmount && Number(amount) < remaining;

  function clearError(field: ReleaseField) {
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

    const next: Partial<Record<ReleaseField, string>> = {};

    if (!releasedOn) {
      next.date = "Choose the release date.";
    } else if (releasedOn > isoDate(0)) {
      next.date = "A release cannot be dated in the future.";
    }

    const amountProblem = numberError(amount, { min: 0.01, max: remaining });

    if (amountProblem) {
      next.amount = amountProblem;
    }

    if (!evidence.trim()) {
      next.evidence = "Describe the evidence for this release.";
    }

    if (!reference.trim()) {
      next.reference = "Enter a release reference.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await recordCapitalRedeploymentRelease(caseId, {
        releasedOn,
        releasedAmount: Number(amount),
        evidenceNote: evidence.trim(),
        referenceText: reference.trim(),
      });

      onSaved(updated);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record redeployment release.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Immutable release evidence"
      title="Record capital redeployment"
      description={`${money(remaining, redeployment.currency)} remains to be redeployed. A release cannot be changed once recorded.`}
      size="md"
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
            form="redeployment-release-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record release"}
          </button>
        </>
      }
    >
      <form id="redeployment-release-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Released on" htmlFor="release-date" error={errors.date}>
            <input
              id="release-date"
              className="kit-field-input"
              type="date"
              value={releasedOn}
              aria-invalid={errors.date ? true : undefined}
              onChange={(event) => {
                setReleasedOn(event.target.value);
                clearError("date");
              }}
            />
          </Field>

          <NumberField
            id="release-amount"
            label={`Released amount (${redeployment.currency})`}
            min={0.01}
            max={remaining}
            step="0.01"
            value={amount}
            error={errors.amount}
            onChange={(value) => {
              setAmount(value);
              clearError("amount");
            }}
          />

          <div className="kit-pair-wide">
            <Field label="Release reference" htmlFor="release-reference" error={errors.reference}>
              <input
                id="release-reference"
                className="kit-field-input"
                maxLength={220}
                value={reference}
                aria-invalid={errors.reference ? true : undefined}
                onChange={(event) => {
                  setReference(event.target.value);
                  clearError("reference");
                }}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Release evidence" htmlFor="release-evidence" error={errors.evidence}>
              <textarea
                id="release-evidence"
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
        </div>

        {partial ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This is a partial release. Full verification needs 100% of the approved amount to be
            redeployed.
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
  detail: CapitalRedeploymentCaseDetail;
}

export default function CapitalRedeploymentCasePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<CaseData | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [addingGate, setAddingGate] = useState(false);
  const [deciding, setDeciding] = useState<Gate | null>(null);
  const [releasing, setReleasing] = useState(false);
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
        const response = await getCapitalRedeploymentCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load capital-redeployment case.",
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

  function applyDetail(updated: CapitalRedeploymentCaseDetail) {
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
        <Link href="/capital-redeployment" className="request-back-link">
          <ArrowLeft size={16} />
          Capital redeployment
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

  const { redeploymentCase: rc, gates, authorizations, releases, verifications } = detail;
  const currency = rc.currency;
  const status = String(rc.status);
  const planned = status === "PLANNED";
  const canRelease = status === "ACTIVE" || status === "REMEDIATION_REQUIRED";
  const remaining = rc.remainingRedeploymentAmount;
  const fullyRedeployed = Math.abs(rc.redeploymentPct - 100) < 0.005;
  const gatesResolved = rc.gateCount - rc.pendingGateCount;
  const busyAny = workflowRunning || rationaleRunning;

  const canSubmitAuth = canManage && planned && rc.gateCount > 0 && rc.pendingGateCount === 0;
  const canSubmitVerify = canManage && canRelease && releases.length > 0;

  async function confirmWorkflow() {
    if (workflow === null) {
      return;
    }

    const action = workflow;

    setWorkflowRunning(true);

    try {
      if (action === "SUBMIT_AUTH") {
        applyDetail(await submitCapitalRedeploymentForAuthorization(params.id));
      } else if (action === "ACTIVATE") {
        applyDetail(await activateCapitalRedeployment(params.id));
      } else {
        applyDetail(await submitCapitalRedeploymentForVerification(params.id));
      }

      setWorkflow(null);

      toast.success(WORKFLOWS[action].done, rc.redeploymentNumber);
    } catch (caught) {
      setWorkflow(null);

      toast.error(
        WORKFLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the redeployment.",
      );
    } finally {
      setWorkflowRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, rc);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, rc.redeploymentNumber);
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

  function handleGateAdded(updated: CapitalRedeploymentCaseDetail, title: string) {
    applyDetail(updated);
    setAddingGate(false);
    toast.success("Gate added", title);
  }

  function handleDecided(
    updated: CapitalRedeploymentCaseDetail,
    message: string,
    title: string,
  ) {
    applyDetail(updated);
    setDeciding(null);
    toast.success(message, title);
  }

  function handleReleased(updated: CapitalRedeploymentCaseDetail) {
    applyDetail(updated);
    setReleasing(false);
    toast.success("Release recorded", rc.redeploymentNumber);
  }

  const orderedGates = [...gates].sort((a, b) => {
    const left = a.status === "PENDING" ? 0 : 1;
    const right = b.status === "PENDING" ? 0 : 1;

    return left - right;
  });

  const orderedAuthorizations = [...authorizations].sort((a, b) =>
    b.authorizedAt.localeCompare(a.authorizedAt),
  );

  const orderedReleases = [...releases].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, rc) : null;

  const kpis: KpiItem[] = [
    {
      label: "Approved",
      icon: Coins,
      value: money(rc.approvedRedeploymentAmount, currency),
      note: "Approved redeployment amount",
    },
    {
      label: "Released",
      icon: BadgeCheck,
      value: money(rc.releasedRedeploymentAmount, currency),
      note: `${rc.redeploymentPct.toFixed(1)}% redeployed`,
    },
    {
      label: "Remaining",
      icon: Gauge,
      value: money(remaining, currency),
      note: "Still to be redeployed",
    },
    {
      label: "Completion",
      icon: Gauge,
      value: `${rc.redeploymentPct.toFixed(1)}%`,
      note: "Of the approved amount",
    },
    {
      label: "Health",
      icon: ShieldCheck,
      value: readable(String(rc.redeploymentHealth)),
      note: "Redeployment health",
    },
    {
      label: "Current source capital",
      icon: Coins,
      value: money(rc.currentSourceFundingRemainingAmount, currency),
      note: "Remaining in the source funding",
    },
  ];

  const gateColumns = buildGateColumns({
    canDecide: canFinalize && planned,
    busy: busyAny,
    onDecide: (gate) => setDeciding(gate),
  });

  const authorizationColumns = buildAuthorizationColumns(currency);
  const releaseColumns = buildReleaseColumns(currency);
  const verificationColumns = buildVerificationColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/capital-redeployment" className="request-back-link">
        <ArrowLeft size={16} />
        Capital redeployment
      </Link>

      <section className="redeployment-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{rc.redeploymentNumber}</span>

            <CaseBadge status={status} />
          </div>

          <span className="eyebrow">Governed recycled-capital release</span>

          <h1>{rc.targetInitiativeTitle}</h1>

          <p>
            {rc.recyclingSourceNumber}
            {" · "}
            {rc.targetValueCaseNumber}
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

          {canManage && planned ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAddingGate(true)}
            >
              <Plus size={15} />
              Add gate
            </button>
          ) : null}

          {canSubmitAuth ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setWorkflow("SUBMIT_AUTH")}
            >
              <FileCheck2 size={16} />
              Submit for authorization
            </button>
          ) : null}

          {canFinalize && status === "READY_FOR_AUTHORIZATION" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "REJECT" })}
            >
              <XCircle size={16} />
              Reject
            </button>
          ) : null}

          {canFinalize && status === "READY_FOR_AUTHORIZATION" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "AUTHORIZE" })}
            >
              <BadgeCheck size={16} />
              Authorize capital
            </button>
          ) : null}

          {canFinalize && status === "AUTHORIZED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setWorkflow("ACTIVATE")}
            >
              Activate
            </button>
          ) : null}

          {canFinalize && canRelease ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny || remaining <= 0}
              title={remaining <= 0 ? "The full amount is already released" : undefined}
              onClick={() => setReleasing(true)}
            >
              <Plus size={15} />
              Record release
            </button>
          ) : null}

          {canSubmitVerify ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setWorkflow("SUBMIT_VERIFY")}
            >
              <FileCheck2 size={16} />
              Submit for verification
            </button>
          ) : null}

          {canFinalize && status === "READY_FOR_VERIFICATION" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "REMEDIATE" })}
            >
              <XCircle size={16} />
              Require remediation
            </button>
          ) : null}

          {canFinalize && status === "READY_FOR_VERIFICATION" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !fullyRedeployed}
              title={fullyRedeployed ? undefined : "Verification needs 100% redeployment"}
              onClick={() => openRationale({ kind: "VERIFY" })}
            >
              <BadgeCheck size={16} />
              Verify redeployment
            </button>
          ) : null}

          {canFinalize && status === "VERIFIED" ? (
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

      {planned && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {rc.gateCount === 0 ? (
              <>
                <strong>Next step: add an evidence gate.</strong> Every redeployment needs at least
                one gate before it can be authorized.
              </>
            ) : rc.pendingGateCount > 0 ? (
              <>
                <strong>
                  {rc.pendingGateCount} {rc.pendingGateCount === 1 ? "gate is" : "gates are"} still
                  pending.
                </strong>{" "}
                A manager needs to satisfy or waive {rc.pendingGateCount === 1 ? "it" : "them"}{" "}
                before the case can be submitted.
              </>
            ) : (
              <>
                <strong>All gates are resolved.</strong> Submit the case for funding authorization.
              </>
            )}
          </div>
        </div>
      ) : null}

      {status === "READY_FOR_AUTHORIZATION" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting the authorization decision.</strong>{" "}
            {canFinalize
              ? "Use Authorize capital or Reject above."
              : "A procurement manager or administrator needs to decide."}
          </div>
        </div>
      ) : null}

      {status === "AUTHORIZED" && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The capital is authorized.</strong> Activate the redeployment so releases can
            be recorded.
          </div>
        </div>
      ) : null}

      {status === "REMEDIATION_REQUIRED" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Remediation is required.</strong> Record further releases, then submit for
            verification again.
          </div>
        </div>
      ) : null}

      {canFinalize && canRelease && remaining > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{money(remaining, currency)} remains to be redeployed.</strong> Record each
            release with its evidence.
          </div>
        </div>
      ) : null}

      {status === "READY_FOR_VERIFICATION" && !fullyRedeployed ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Full verification is blocked.</strong> Only {rc.redeploymentPct.toFixed(1)}% is
            redeployed, with {money(remaining, currency)} remaining. Require remediation to record
            more releases.
          </div>
        </div>
      ) : null}

      {status === "VERIFIED" && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The redeployment is verified.</strong> Close the case to finish governance.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Redeployment summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Redeployment against the approved amount</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={rc.redeploymentPct}
          tone={fullyRedeployed ? meterToneFor("success") : "primary"}
          caption={`${money(rc.releasedRedeploymentAmount, currency)} of ${money(rc.approvedRedeploymentAmount, currency)} redeployed (${rc.redeploymentPct.toFixed(1)}%)`}
          label="Capital redeployed against the approved amount"
        />

        {rc.gateCount > 0 ? (
          <ProgressLine
            pct={(gatesResolved / rc.gateCount) * 100}
            tone={rc.pendingGateCount === 0 ? meterToneFor("success") : "primary"}
            caption={`${gatesResolved} of ${rc.gateCount} evidence gates resolved`}
            label="Evidence gates resolved"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen Step 62 authority</span>

            <h2>Target investment context</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="redeployment-objective">{rc.redeploymentObjective}</p>

        <div className="redeployment-context-grid">
          <div>
            <span>Owner</span>

            <strong>{rc.redeploymentOwnerName}</strong>
          </div>

          <div>
            <span>Target ROI</span>

            <strong>{rc.targetRoiPctSnapshot.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Persistence</span>

            <strong>{rc.targetPersistencePctSnapshot.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Target health</span>

            <strong>{readable(String(rc.targetValueHealthSnapshot))}</strong>
          </div>

          <div>
            <span>Target net value</span>

            <strong>{money(rc.targetNetValueSnapshot, currency)}</strong>
          </div>

          <div>
            <span>Source recyclable snapshot</span>

            <strong>{money(rc.sourceRecyclableCapitalSnapshot, currency)}</strong>
          </div>
        </div>
      </section>

      <div className="redeployment-source-links">
        <Link href={`/capital-recycling/${rc.recyclingSourceId}`} className="table-action">
          Step 62 reinvestment authority
        </Link>

        <Link href={`/funding-execution/${rc.sourceFundingCommitmentId}`} className="table-action">
          Step 58 source funding
        </Link>

        <Link href={`/strategic-value/${rc.targetValueCaseId}`} className="table-action">
          Step 56 target value case
        </Link>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Evidence gates</span>

            <h2>Release readiness</h2>
          </div>

          {canManage && planned ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAddingGate(true)}
            >
              <Plus size={15} />
              Add gate
            </button>
          ) : (
            <ShieldCheck size={19} />
          )}
        </div>

        <DataTable
          columns={gateColumns}
          rows={orderedGates}
          getRowId={(gate) => String(gate.id)}
          ariaLabel="Redeployment gates"
          busy={fetching}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="No gates"
              description="No redeployment gate has been created."
              action={
                canManage && planned ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingGate(true)}
                  >
                    <Plus size={15} />
                    Add gate
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {authorizations.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Immutable authorization evidence</span>

              <h2>Authorization history</h2>
            </div>

            <BadgeCheck size={19} />
          </div>

          <DataTable
            columns={authorizationColumns}
            rows={orderedAuthorizations}
            getRowId={(item) => String(item.id)}
            ariaLabel="Authorization history"
            busy={fetching}
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Redeployment ledger</span>

            <h2>Release history</h2>
          </div>

          {canFinalize && canRelease && remaining > 0 ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setReleasing(true)}
            >
              <Plus size={15} />
              Record release
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        <DataTable
          columns={releaseColumns}
          rows={orderedReleases}
          getRowId={(item) => String(item.id)}
          ariaLabel="Release history"
          busy={fetching}
          empty={
            <EmptyState
              icon={Coins}
              title="No releases"
              description="No redeployment release has been recorded."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable verification history</span>

            <h2>Redeployment verification</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        <DataTable
          columns={verificationColumns}
          rows={verifications}
          getRowId={(item) => String(item.id)}
          ariaLabel="Redeployment verification"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No verification yet"
              description="No verification decision has been recorded."
            />
          }
        />
      </section>

      <section className="redeployment-method-note">
        <Goal size={18} />

        <div>
          <strong>
            Redeployment evidence is separate from the historical source-funding ledger
          </strong>

          <p>
            Step 63 proves that recycled capital was authorized and redeployed toward the approved
            Step 62 target. It never rewrites the original Step 58 releases or Step 57 allocation
            decisions.
          </p>
        </div>
      </section>

      {addingGate ? (
        <AddGateModal
          caseId={params.id}
          onClose={() => setAddingGate(false)}
          onSaved={handleGateAdded}
        />
      ) : null}

      {deciding !== null ? (
        <DecisionModal
          gate={deciding}
          onClose={() => setDeciding(null)}
          onSaved={handleDecided}
        />
      ) : null}

      {releasing ? (
        <ReleaseModal
          caseId={params.id}
          redeployment={rc}
          onClose={() => setReleasing(false)}
          onSaved={handleReleased}
        />
      ) : null}

      {workflow !== null ? (
        <ActionDialog
          eyebrow={WORKFLOWS[workflow].eyebrow}
          title={WORKFLOWS[workflow].title}
          description={workflowDescription(workflow, rc)}
          confirmLabel={WORKFLOWS[workflow].confirm}
          busyLabel={WORKFLOWS[workflow].busy}
          cancelLabel={WORKFLOWS[workflow].keep}
          busy={workflowRunning}
          onConfirm={() => void confirmWorkflow()}
          onCancel={() => setWorkflow(null)}
        >
          {workflow === "SUBMIT_VERIFY" && remaining > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {money(remaining, currency)} is still unreleased. Full verification needs 100% of the
              approved amount to be redeployed.
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
          tone={rationaleInfo.tone}
          maxLength={2000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
