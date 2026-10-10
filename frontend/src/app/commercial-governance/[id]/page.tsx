"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  Coins,
  FileCheck2,
  Info,
  Plus,
  RefreshCw,
  ShieldAlert,
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  completeContractObligation,
  completeContractRenewal,
  createContractObligation,
  decideContractRenewal,
  deactivateCommercialGovernance,
  dismissCommercialLeakage,
  getCommercialGovernanceContext,
  getCommercialGovernanceDetail,
  resolveCommercialLeakage,
  startContractRenewalReview,
  waiveContractObligation,
} from "@/lib/api";
import type {
  CommercialGovernanceContext,
  CommercialGovernanceDetail,
  CommercialLeakageFinding,
  ContractObligation,
  ContractObligationType,
  ContractRenewalDecision,
} from "@/types/commercial-governance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Governance = CommercialGovernanceDetail["governance"];
type CommUser = CommercialGovernanceContext["users"][number];
type Flow = "START_REVIEW" | "COMPLETE_RENEWAL" | "DEACTIVATE";
type ObligationField = "title" | "dueDate";

type RationaleRequest =
  | { kind: "OBLIGATION_COMPLETE"; obligation: ContractObligation }
  | { kind: "OBLIGATION_WAIVE"; obligation: ContractObligation }
  | { kind: "LEAKAGE_RESOLVE"; finding: CommercialLeakageFinding }
  | { kind: "LEAKAGE_DISMISS"; finding: CommercialLeakageFinding };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: CommUser[] = [];
const DAY_MS = 86400000;
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const OBLIGATION_TYPES: { value: string; label: string }[] = [
  { value: "DELIVERY", label: "Delivery" },
  { value: "SERVICE_LEVEL", label: "Service level" },
  { value: "REPORTING", label: "Reporting" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "PAYMENT", label: "Payment" },
  { value: "RENEWAL", label: "Renewal" },
  { value: "OTHER", label: "Other" },
];

const RENEWAL_OPTIONS: { value: string; label: string; hint: string }[] = [
  {
    value: "RENEW",
    label: "Renew",
    hint: "The contract continues. The renewal workflow can then be completed.",
  },
  {
    value: "RENEGOTIATE",
    label: "Renegotiate",
    hint: "The contract is renegotiated before it is renewed.",
  },
  {
    value: "TERMINATE",
    label: "Terminate",
    hint: "The contract will not be renewed and ends at its expiry date.",
  },
];

function severityRank(value: string): number {
  return SEVERITY_ORDER[value] ?? 4;
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function amountText(value?: number | null, currency?: string | null): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return currency ? money(value, currency) : value.toFixed(2);
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

function daysUntil(date: string, now: number | null): number | null {
  if (now === null) {
    return null;
  }

  const target = new Date(`${date}T00:00:00`).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  return Math.ceil((target - now) / DAY_MS);
}

function RenewalBadge({ status }: { status: string }) {
  switch (status) {
    case "UPCOMING":
      return <StatusBadge value="PLANNED" label="Upcoming" />;

    case "RENEW":
      return <StatusBadge value="APPROVED" label="Renew" />;

    case "RENEGOTIATE":
      return <StatusBadge value="AT_RISK" label="Renegotiate" />;

    case "TERMINATE":
      return <StatusBadge value="REJECTED" label="Terminate" />;

    default:
      return <StatusBadge value={status} />;
  }
}

function ObligationBadge({ status }: { status: string }) {
  if (status === "WAIVED") {
    return <StatusBadge value="ACCEPTED" label="Waived" />;
  }

  return <StatusBadge value={status} />;
}

function LeakageBadge({ status }: { status: string }) {
  if (status === "OPEN") {
    return <StatusBadge value="AT_RISK" label="Open" />;
  }

  if (status === "DISMISSED") {
    return <StatusBadge value="ACCEPTED" label="Dismissed" />;
  }

  return <StatusBadge value={status} />;
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
  START_REVIEW: {
    eyebrow: "Renewal governance",
    title: "Start the renewal review?",
    confirm: "Start renewal review",
    busy: "Starting…",
    keep: "Not yet",
    done: "Renewal review started",
    failed: "Could not start the renewal review",
  },
  COMPLETE_RENEWAL: {
    eyebrow: "Renewal governance",
    title: "Complete the renewal workflow?",
    confirm: "Complete renewal workflow",
    busy: "Completing…",
    keep: "Not yet",
    done: "Renewal workflow completed",
    failed: "Could not complete the renewal workflow",
  },
  DEACTIVATE: {
    eyebrow: "Commercial governance",
    title: "Deactivate this governance record?",
    confirm: "Deactivate",
    busy: "Deactivating…",
    keep: "Keep active",
    done: "Governance deactivated",
    failed: "Could not deactivate the governance record",
  },
};

function flowDescription(flow: Flow, governance: Governance): string {
  switch (flow) {
    case "START_REVIEW":
      return `The renewal review for ${governance.supplierName} will begin, and a renewal decision can then be recorded.`;

    case "COMPLETE_RENEWAL":
      return `The ${readable(String(governance.renewalStatus))} decision for ${governance.supplierName} will be completed and the renewal workflow closed.`;

    case "DEACTIVATE":
      return `Commercial governance for ${governance.supplierName} will be deactivated. New obligations can only be added while it is active.`;
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
  subject: string;
}

function rationaleCopy(request: RationaleRequest): RationaleCopy {
  switch (request.kind) {
    case "OBLIGATION_COMPLETE":
      return {
        eyebrow: "Contract obligation",
        title: "Complete this obligation",
        description: `Record the evidence that “${request.obligation.title}” was fulfilled.`,
        label: "Completion evidence",
        placeholder: "How was the obligation fulfilled?",
        confirm: "Complete obligation",
        busy: "Completing…",
        tone: "primary",
        done: "Obligation completed",
        subject: request.obligation.title,
      };

    case "OBLIGATION_WAIVE":
      return {
        eyebrow: "Contract obligation",
        title: "Waive this obligation",
        description: `“${request.obligation.title}” will be waived and no longer count as open.`,
        label: "Waiver rationale",
        placeholder: "Why is this obligation being waived?",
        confirm: "Waive obligation",
        busy: "Waiving…",
        tone: "danger",
        done: "Obligation waived",
        subject: request.obligation.title,
      };

    case "LEAKAGE_RESOLVE":
      return {
        eyebrow: "Commercial leakage",
        title: "Resolve this finding",
        description: `Record how the ${readable(String(request.finding.findingType))} finding was resolved.`,
        label: "Resolution evidence",
        placeholder: "What was recovered or corrected?",
        confirm: "Resolve finding",
        busy: "Resolving…",
        tone: "primary",
        done: "Finding resolved",
        subject: readable(String(request.finding.findingType)),
      };

    case "LEAKAGE_DISMISS":
      return {
        eyebrow: "Commercial leakage",
        title: "Dismiss this finding",
        description: `The ${readable(String(request.finding.findingType))} finding will be dismissed and its exposure removed.`,
        label: "Dismissal rationale",
        placeholder: "Why is this finding not valid?",
        confirm: "Dismiss finding",
        busy: "Dismissing…",
        tone: "danger",
        done: "Finding dismissed",
        subject: readable(String(request.finding.findingType)),
      };
  }
}

async function performRationale(request: RationaleRequest, note: string): Promise<void> {
  switch (request.kind) {
    case "OBLIGATION_COMPLETE":
      await completeContractObligation(request.obligation.id, note);
      break;

    case "OBLIGATION_WAIVE":
      await waiveContractObligation(request.obligation.id, note);
      break;

    case "LEAKAGE_RESOLVE":
      await resolveCommercialLeakage(request.finding.id, note);
      break;

    case "LEAKAGE_DISMISS":
      await dismissCommercialLeakage(request.finding.id, note);
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ObligationColumnOptions {
  canManage: boolean;
  canApprove: boolean;
  busy: boolean;
  onComplete: (obligation: ContractObligation) => void;
  onWaive: (obligation: ContractObligation) => void;
}

function buildObligationColumns(options: ObligationColumnOptions): Column<ContractObligation>[] {
  return [
    {
      id: "obligation",
      header: "Obligation",
      sortValue: (obligation) => obligation.title.toLowerCase(),
      cell: (obligation) => (
        <div className="request-primary-cell">
          <strong>{obligation.title}</strong>

          <span>
            {readable(String(obligation.obligationType))}
            {obligation.description ? ` · ${obligation.description}` : ""}
          </span>

          {obligation.critical ? <StatusBadge value="CRITICAL" label="Critical" /> : null}
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (obligation) => (obligation.ownerName ?? "").toLowerCase(),
      cell: (obligation) => obligation.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (obligation) => obligation.dueDate,
      cell: (obligation) => (
        <div className="kit-cell-stack">
          <span>{formatDate(obligation.dueDate)}</span>

          {obligation.overdue && obligation.status === "OPEN" ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (obligation) => String(obligation.status),
      cell: (obligation) => <ObligationBadge status={String(obligation.status)} />,
    },
    {
      id: "outcome",
      header: "Outcome",
      cell: (obligation) =>
        obligation.completionNote ? (
          <span>{obligation.completionNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 220,
      cell: (obligation) => {
        if (!options.canManage || obligation.status !== "OPEN") {
          return null;
        }

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onComplete(obligation)}
            >
              <BadgeCheck size={14} />
              Complete
            </button>

            {options.canApprove ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onWaive(obligation)}
              >
                <XCircle size={14} />
                Waive
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

interface FindingColumnOptions {
  canManage: boolean;
  canApprove: boolean;
  busy: boolean;
  onResolve: (finding: CommercialLeakageFinding) => void;
  onDismiss: (finding: CommercialLeakageFinding) => void;
}

function buildFindingColumns(options: FindingColumnOptions): Column<CommercialLeakageFinding>[] {
  return [
    {
      id: "finding",
      header: "Finding",
      sortValue: (finding) => String(finding.findingType),
      cell: (finding) => (
        <div className="request-primary-cell">
          <strong>{readable(String(finding.findingType))}</strong>

          <span>{finding.sourceReference ?? "Contract"}</span>

          <span>{finding.details}</span>
        </div>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      sortValue: (finding) => severityRank(String(finding.severity)),
      cell: (finding) => <StatusBadge value={String(finding.severity)} />,
    },
    {
      id: "leakage",
      header: "Leakage",
      align: "right",
      sortValue: (finding) => finding.leakageAmount,
      cell: (finding) => <strong>{amountText(finding.leakageAmount, finding.currency)}</strong>,
    },
    {
      id: "values",
      header: "Expected vs actual",
      cell: (finding) =>
        finding.expectedValue !== null || finding.actualValue !== null ? (
          <div className="kit-cell-stack">
            <span>Expected {amountText(finding.expectedValue, finding.currency)}</span>

            <small>Actual {amountText(finding.actualValue, finding.currency)}</small>
          </div>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (finding) => String(finding.status),
      cell: (finding) => <LeakageBadge status={String(finding.status)} />,
    },
    {
      id: "resolution",
      header: "Resolution",
      cell: (finding) =>
        finding.resolutionNote ? (
          <div className="kit-cell-stack">
            <span>{finding.resolutionNote}</span>

            {finding.resolvedByName ? <small>— {finding.resolvedByName}</small> : null}
          </div>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 220,
      cell: (finding) => {
        if (!options.canManage || finding.status !== "OPEN") {
          return null;
        }

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onResolve(finding)}
            >
              <BadgeCheck size={14} />
              Resolve
            </button>

            {options.canApprove ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onDismiss(finding)}
              >
                <XCircle size={14} />
                Dismiss
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Renewal decision modal                                              */
/* ------------------------------------------------------------------ */

interface RenewalModalProps {
  governance: Governance;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function RenewalModal({ governance, onClose, onSaved }: RenewalModalProps) {
  const [decision, setDecision] = useState<ContractRenewalDecision>("RENEW");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choice =
    RENEWAL_OPTIONS.find((item) => item.value === String(decision)) ?? RENEWAL_OPTIONS[0];
  const terminating = String(decision) === "TERMINATE";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!note.trim()) {
      setNoteError("A renewal decision rationale is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await decideContractRenewal(governance.id, decision, note.trim());

      onSaved(readable(String(decision)));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record renewal decision.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Renewal governance"
      title="Record renewal decision"
      description={`${governance.supplierName} — the contract ends ${formatDate(governance.contractEndDate)}.`}
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
            form="renewal-decision-form"
            className={
              terminating ? "button button--primary kit-button-danger" : "button button--primary"
            }
            disabled={saving}
          >
            {saving ? "Recording…" : "Record decision"}
          </button>
        </>
      }
    >
      <form id="renewal-decision-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Renewal strategy" htmlFor="renewal-strategy">
              <select
                id="renewal-strategy"
                className="kit-field-input"
                value={decision}
                onChange={(event) => setDecision(event.target.value as ContractRenewalDecision)}
              >
                {RENEWAL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <p className="kit-meta-line">{choice.hint}</p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Decision rationale" htmlFor="renewal-note" error={noteError}>
              <textarea
                id="renewal-note"
                className="kit-field-input"
                rows={5}
                maxLength={2000}
                value={note}
                aria-invalid={noteError ? true : undefined}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError(undefined);
                }}
              />
            </Field>
          </div>
        </div>

        {terminating && governance.openObligations > 0 ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            {governance.openObligations}{" "}
            {governance.openObligations === 1 ? "obligation is" : "obligations are"} still open.
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
/* Add obligation modal                                                */
/* ------------------------------------------------------------------ */

interface ObligationModalProps {
  governanceId: string;
  users: CommUser[];
  defaultOwnerId: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function ObligationModal({
  governanceId,
  users,
  defaultOwnerId,
  onClose,
  onSaved,
}: ObligationModalProps) {
  const [type, setType] = useState<ContractObligationType>("SERVICE_LEVEL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => isoDate(30));
  const [critical, setCritical] = useState(false);
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [errors, setErrors] = useState<Partial<Record<ObligationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dueInPast = dueDate !== "" && dueDate < isoDate(0);

  function clearError(field: ObligationField) {
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

    const next: Partial<Record<ObligationField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter an obligation title.";
    }

    if (!dueDate) {
      next.dueDate = "Choose a due date.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createContractObligation(governanceId, {
        obligationType: type,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        critical,
        ownerUserId: ownerId || undefined,
      });

      onSaved(title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create contract obligation.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Obligation management"
      title="Add contract obligation"
      description="A contractual commitment that needs to be tracked to completion."
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
            form="obligation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add obligation"}
          </button>
        </>
      }
    >
      <form id="obligation-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Obligation type" htmlFor="obligation-type">
            <select
              id="obligation-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as ContractObligationType)}
            >
              {OBLIGATION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="obligation-due" error={errors.dueDate}>
            <input
              id="obligation-due"
              className="kit-field-input"
              type="date"
              value={dueDate}
              aria-invalid={errors.dueDate ? true : undefined}
              onChange={(event) => {
                setDueDate(event.target.value);
                clearError("dueDate");
              }}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Obligation title" htmlFor="obligation-title" error={errors.title}>
              <input
                id="obligation-title"
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
            <Field label="Description" htmlFor="obligation-description">
              <textarea
                id="obligation-description"
                className="kit-field-input"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Owner" htmlFor="obligation-owner">
              <select
                id="obligation-owner"
                className="kit-field-input"
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                {users.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} — {candidate.role}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <label className="kit-check">
              <input
                type="checkbox"
                checked={critical}
                onChange={(event) => setCritical(event.target.checked)}
              />

              <span>Mark this contractual obligation as critical.</span>
            </label>
          </div>
        </div>

        {dueInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The due date is in the past, so this obligation will be flagged as overdue.
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

interface GovernanceData {
  id: string;
  detail: CommercialGovernanceDetail;
  users: CommUser[];
}

export default function CommercialGovernanceDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<GovernanceData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [addingObligation, setAddingObligation] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
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
        const [detailResponse, contextResponse] = await Promise.all([
          getCommercialGovernanceDetail(id),
          getCommercialGovernanceContext(),
        ]);

        if (active) {
          setResult({
            id,
            detail: detailResponse,
            users: contextResponse.users.filter((candidate) => candidate.role !== "REQUESTER"),
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load commercial governance detail.",
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
  const detail = data?.detail ?? null;
  const users = data?.users ?? EMPTY_USERS;

  function reload() {
    setReloadKey((key) => key + 1);
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
        <Link href="/commercial-governance" className="request-back-link">
          <ArrowLeft size={16} />
          Commercial governance
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

  const { governance, obligations, leakageFindings } = detail;
  const currency = governance.currency;
  const renewalStatus = String(governance.renewalStatus);
  const active = String(governance.governanceStatus) === "ACTIVE";
  const decisionPending = renewalStatus === "UPCOMING" || renewalStatus === "UNDER_REVIEW";
  const decided =
    renewalStatus === "RENEW" || renewalStatus === "RENEGOTIATE" || renewalStatus === "TERMINATE";
  const busyAny = flowRunning || rationaleRunning;
  const defaultOwnerId = governance.ownerUserId || users[0]?.id || "";

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "START_REVIEW") {
        await startContractRenewalReview(governance.id);
      } else if (action === "COMPLETE_RENEWAL") {
        await completeContractRenewal(governance.id);
      } else {
        await deactivateCommercialGovernance(governance.id);
      }

      setFlow(null);

      toast.success(FLOWS[action].done, governance.supplierName);
      reload();
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update commercial governance.",
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
    const copy = rationaleCopy(request);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      await performRationale(request, note.trim());

      setRationale(null);

      toast.success(copy.done, copy.subject);
      reload();
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

  function handleDecided(message: string) {
    setDeciding(false);
    toast.success("Renewal decision recorded", message);
    reload();
  }

  function handleObligationAdded(title: string) {
    setAddingObligation(false);
    toast.success("Obligation added", title);
    reload();
  }

  const noticeDays = decisionPending ? daysUntil(governance.noticeDeadline, now) : null;
  const openObligations = obligations.filter((obligation) => obligation.status === "OPEN");
  const openFindings = leakageFindings.filter((finding) => finding.status === "OPEN");
  const resolvedObligations = obligations.length - openObligations.length;

  const orderedObligations = [...obligations].sort((a, b) => {
    const left = a.status === "OPEN" ? 0 : 1;
    const right = b.status === "OPEN" ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return a.dueDate.localeCompare(b.dueDate);
  });

  const orderedFindings = [...leakageFindings].sort((a, b) => {
    const left = a.status === "OPEN" ? 0 : 1;
    const right = b.status === "OPEN" ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    const severity = severityRank(String(a.severity)) - severityRank(String(b.severity));

    if (severity !== 0) {
      return severity;
    }

    return b.leakageAmount - a.leakageAmount;
  });

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale) : null;

  const kpis: KpiItem[] = [
    {
      label: "Commercial baseline",
      icon: Coins,
      value: money(governance.baselineContractValue, currency),
      note: "Contract reference value",
    },
    {
      label: "Notice deadline",
      icon: CalendarClock,
      value: formatDate(governance.noticeDeadline),
      note: `${governance.noticePeriodDays} days before expiry`,
      tone: noticeDays !== null && noticeDays <= 30 ? "warning" : "default",
    },
    {
      label: "Open obligations",
      icon: FileCheck2,
      value: String(governance.openObligations),
      note: `${governance.overdueObligations} overdue`,
      tone: governance.overdueObligations > 0 ? "warning" : "default",
    },
    {
      label: "Leakage exposure",
      icon: ShieldAlert,
      value: money(governance.leakageExposure, currency),
      note: `${governance.openLeakageFindings} open findings`,
      tone: governance.leakageExposure > 0 ? "warning" : "default",
    },
  ];

  const obligationColumns = buildObligationColumns({
    canManage: canManage && active,
    canApprove,
    busy: busyAny,
    onComplete: (obligation) => openRationale({ kind: "OBLIGATION_COMPLETE", obligation }),
    onWaive: (obligation) => openRationale({ kind: "OBLIGATION_WAIVE", obligation }),
  });

  const findingColumns = buildFindingColumns({
    canManage,
    canApprove,
    busy: busyAny,
    onResolve: (finding) => openRationale({ kind: "LEAKAGE_RESOLVE", finding }),
    onDismiss: (finding) => openRationale({ kind: "LEAKAGE_DISMISS", finding }),
  });

  return (
    <div className="page-stack">
      <Link href="/commercial-governance" className="request-back-link">
        <ArrowLeft size={16} />
        Commercial governance
      </Link>

      <section className="commercial-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{governance.supplierCode}</span>

            <RenewalBadge status={renewalStatus} />

            <StatusBadge value={String(governance.governanceStatus)} />
          </div>

          <h1>{governance.supplierName}</h1>

          <p>
            Contract {governance.contractId.slice(0, 12)}
            {" · ends "}
            {formatDate(governance.contractEndDate)}
            {" · Owner: "}
            {governance.ownerName}
          </p>
        </div>

        <div className="commercial-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canManage && renewalStatus === "UPCOMING" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("START_REVIEW")}
            >
              <CalendarClock size={16} />
              Start renewal review
            </button>
          ) : null}

          {canApprove && decisionPending ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setDeciding(true)}
            >
              <BadgeCheck size={16} />
              Record renewal decision
            </button>
          ) : null}

          {canManage && decided ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("COMPLETE_RENEWAL")}
            >
              <BadgeCheck size={16} />
              Complete renewal workflow
            </button>
          ) : null}

          {canApprove && active ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => setFlow("DEACTIVATE")}
            >
              <XCircle size={16} />
              Deactivate
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

      {!active ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Commercial governance is not active.</strong> New obligations can only be added
            while it is active.
          </div>
        </div>
      ) : null}

      {noticeDays !== null && noticeDays < 0 ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The notice deadline has passed.</strong> It was {formatDate(governance.noticeDeadline)}
            , {-noticeDays} {-noticeDays === 1 ? "day" : "days"} ago, and no renewal decision is
            recorded yet.
          </div>
        </div>
      ) : null}

      {noticeDays !== null && noticeDays >= 0 && noticeDays <= 30 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              The notice deadline is {noticeDays === 0 ? "today" : `in ${noticeDays} ${noticeDays === 1 ? "day" : "days"}`}.
            </strong>{" "}
            Record the renewal decision before it passes.
          </div>
        </div>
      ) : null}

      {canManage && renewalStatus === "UPCOMING" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: start the renewal review.</strong> A manager can then record whether
            to renew, renegotiate or terminate.
          </div>
        </div>
      ) : null}

      {renewalStatus === "UNDER_REVIEW" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The renewal review is under way.</strong>{" "}
            {canApprove
              ? "Use Record renewal decision above."
              : "A procurement manager or administrator needs to record the decision."}
          </div>
        </div>
      ) : null}

      {canManage && decided ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The renewal decision is recorded.</strong> Complete the renewal workflow when
            the follow-up is done.
          </div>
        </div>
      ) : null}

      {governance.overdueObligations > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {governance.overdueObligations}{" "}
              {governance.overdueObligations === 1 ? "obligation is" : "obligations are"} overdue.
            </strong>{" "}
            Complete or waive {governance.overdueObligations === 1 ? "it" : "them"} in the table
            below.
          </div>
        </div>
      ) : null}

      {openFindings.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <ShieldAlert size={17} />

          <div>
            <strong>{money(governance.leakageExposure, currency)} of leakage exposure.</strong>{" "}
            {openFindings.length} open {openFindings.length === 1 ? "finding needs" : "findings need"}{" "}
            a resolution.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Governance summary" />

      <section className="commercial-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Commercial controls</span>

              <h2>Contract economics</h2>
            </div>

            <Coins size={19} />
          </div>

          <div className="commercial-control-grid">
            <div>
              <span>Price escalation</span>

              <strong>{governance.priceEscalationPct.toFixed(1)}%</strong>
            </div>

            <div>
              <span>PO variance ceiling</span>

              <strong>{governance.maxPoVariancePct.toFixed(1)}%</strong>
            </div>

            <div>
              <span>Auto renewal</span>

              <strong>{governance.autoRenewal ? "Yes" : "No"}</strong>
            </div>

            <div>
              <span>Contract status</span>

              <strong>{readable(String(governance.contractStatus))}</strong>
            </div>
          </div>

          {governance.notes ? <div className="commercial-notes">{governance.notes}</div> : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Renewal governance</span>

              <h2>Renewal decision</h2>
            </div>

            {canApprove && decisionPending ? (
              <button
                type="button"
                className="button button--secondary"
                disabled={busyAny}
                onClick={() => setDeciding(true)}
              >
                Record decision
              </button>
            ) : (
              <RefreshCw size={19} />
            )}
          </div>

          {governance.renewalDecisionNote ? (
            <div className="commercial-renewal-decision">
              <span>{readable(renewalStatus)}</span>

              <strong>{governance.renewalDecisionNote}</strong>

              <small>
                {governance.renewalDecidedByName ?? "Procurement management"}
                {governance.renewalDecidedAt
                  ? ` · ${formatDateTime(governance.renewalDecidedAt)}`
                  : ""}
              </small>
            </div>
          ) : (
            <EmptyState
              compact
              icon={RefreshCw}
              title="No renewal decision"
              description="No renewal decision has been recorded yet."
            />
          )}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Contract execution</span>

            <h2>Obligations</h2>
          </div>

          {canManage && active ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingObligation(true)}
            >
              <Plus size={15} />
              Add obligation
            </button>
          ) : (
            <FileCheck2 size={19} />
          )}
        </div>

        {obligations.length > 0 ? (
          <div className="kit-meter-wrap">
            <Meter
              value={clampPercent((resolvedObligations / obligations.length) * 100)}
              max={100}
              tone={openObligations.length === 0 ? meterToneFor("success") : "primary"}
              ariaLabel="Obligations resolved"
            />

            <span className="kit-meter-caption">
              {resolvedObligations} of {obligations.length} obligations resolved
            </span>
          </div>
        ) : null}

        <DataTable
          columns={obligationColumns}
          rows={orderedObligations}
          getRowId={(obligation) => String(obligation.id)}
          ariaLabel="Contract obligations"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No obligations"
              description="No contractual obligations are currently tracked."
              action={
                canManage && active ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingObligation(true)}
                  >
                    <Plus size={15} />
                    Add obligation
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
            <span className="eyebrow">Commercial leakage</span>

            <h2>Contract and transaction findings</h2>
          </div>

          <ShieldAlert size={19} />
        </div>

        <DataTable
          columns={findingColumns}
          rows={orderedFindings}
          getRowId={(finding) => String(finding.id)}
          ariaLabel="Commercial leakage findings"
          busy={fetching}
          empty={
            <EmptyState
              icon={ShieldAlert}
              title="No leakage findings"
              description="No commercial leakage findings are linked to this governance record."
            />
          }
        />
      </section>

      {deciding ? (
        <RenewalModal
          governance={governance}
          onClose={() => setDeciding(false)}
          onSaved={handleDecided}
        />
      ) : null}

      {addingObligation ? (
        <ObligationModal
          governanceId={governance.id}
          users={users}
          defaultOwnerId={defaultOwnerId}
          onClose={() => setAddingObligation(false)}
          onSaved={handleObligationAdded}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, governance)}
          confirmLabel={FLOWS[flow].confirm}
          busyLabel={FLOWS[flow].busy}
          cancelLabel={FLOWS[flow].keep}
          tone={flow === "DEACTIVATE" || (flow === "COMPLETE_RENEWAL" && renewalStatus === "TERMINATE") ? "danger" : "primary"}
          busy={flowRunning}
          onConfirm={() => void confirmFlow()}
          onCancel={() => setFlow(null)}
        >
          {flow === "DEACTIVATE" && governance.openObligations > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {governance.openObligations}{" "}
              {governance.openObligations === 1 ? "obligation is" : "obligations are"} still open.
            </p>
          ) : null}

          {flow === "DEACTIVATE" && governance.openLeakageFindings > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {governance.openLeakageFindings} leakage{" "}
              {governance.openLeakageFindings === 1 ? "finding is" : "findings are"} still open.
            </p>
          ) : null}

          {flow === "COMPLETE_RENEWAL" && governance.openObligations > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {governance.openObligations}{" "}
              {governance.openObligations === 1 ? "obligation is" : "obligations are"} still open.
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
