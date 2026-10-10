"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  Coins,
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
  activateFundingCommitment,
  authorizeFundingTranche,
  captureFundingSnapshot,
  closeFundingCommitment,
  createFundingGate,
  createFundingTranche,
  decideFundingGate,
  getFundingCommitment,
  releaseFundingTranche,
  requestFundingAuthorization,
} from "@/lib/api";
import type { FundingCommitmentDetail, FundingGateStatus } from "@/types/funding-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Commitment = FundingCommitmentDetail["commitment"];
type Tranche = FundingCommitmentDetail["tranches"][number];
type TrancheGate = Tranche["gates"][number];
type TrancheField = "title" | "amount" | "date";
type GateField = "title" | "requirement";
type DecisionField = "evidence" | "note";

type FundingRequest =
  | { kind: "ACTIVATE" }
  | { kind: "CLOSE" }
  | { kind: "REQUEST_AUTH"; tranche: Tranche }
  | { kind: "AUTHORIZE"; tranche: Tranche }
  | { kind: "REJECT"; tranche: Tranche }
  | { kind: "RELEASE"; tranche: Tranche };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const AUTHORIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function FundingBadge({ status }: { status: string }) {
  switch (status) {
    case "READY_FOR_AUTHORIZATION":
      return <StatusBadge value="READY" label="Ready for authorization" />;

    case "AUTHORIZED":
      return <StatusBadge value="APPROVED" label="Authorized" />;

    case "RELEASED":
      return <StatusBadge value="PAID" label="Released" />;

    case "FULLY_RELEASED":
      return <StatusBadge value="PAID" label="Fully released" />;

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

interface RequestCopy {
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

function requestCopy(request: FundingRequest, commitment: Commitment): RequestCopy {
  switch (request.kind) {
    case "ACTIVATE":
      return {
        eyebrow: "Commitment activation",
        title: "Activate controlled funding",
        description: `${commitment.commitmentNumber} will be activated so tranches can be authorized and released.`,
        label: "Activation note",
        placeholder: "Why is this commitment ready to start?",
        confirm: "Activate funding commitment",
        busy: "Activating…",
        tone: "primary",
        done: "Funding commitment activated",
        subject: commitment.commitmentNumber,
      };

    case "CLOSE":
      return {
        eyebrow: "Funding closure",
        title: "Close funding commitment",
        description: `${commitment.commitmentNumber} is fully released. Closing it finishes funding governance.`,
        label: "Closure note",
        placeholder: "Summarise why this commitment can be closed.",
        confirm: "Close funding commitment",
        busy: "Closing…",
        tone: "primary",
        done: "Funding commitment closed",
        subject: commitment.commitmentNumber,
      };

    case "REQUEST_AUTH":
      return {
        eyebrow: "Tranche authorization",
        title: "Request authorization",
        description: `${request.tranche.trancheNumber} (${money(request.tranche.plannedReleaseAmount, commitment.currency)}) will be sent for authorization.`,
        label: "Authorization request note",
        placeholder: "Why is this tranche ready to be authorized?",
        confirm: "Request authorization",
        busy: "Requesting…",
        tone: "primary",
        done: "Authorization requested",
        subject: request.tranche.title,
      };

    case "AUTHORIZE":
      return {
        eyebrow: "Tranche authorization",
        title: "Authorize this tranche",
        description: `${request.tranche.trancheNumber} (${money(request.tranche.plannedReleaseAmount, commitment.currency)}) will be authorized for release.`,
        label: "Authorization decision note",
        placeholder: "Why is this tranche being authorized?",
        confirm: "Authorize tranche",
        busy: "Authorizing…",
        tone: "primary",
        done: "Tranche authorized",
        subject: request.tranche.title,
      };

    case "REJECT":
      return {
        eyebrow: "Tranche authorization",
        title: "Reject this tranche",
        description: `${request.tranche.trancheNumber} will be rejected and no capital will be authorized.`,
        label: "Authorization decision note",
        placeholder: "Why is this tranche being rejected?",
        confirm: "Reject tranche",
        busy: "Rejecting…",
        tone: "danger",
        done: "Tranche rejected",
        subject: request.tranche.title,
      };

    case "RELEASE":
      return {
        eyebrow: "Capital release",
        title: "Record capital release",
        description: `${money(request.tranche.plannedReleaseAmount, commitment.currency)} will be recorded as released for ${request.tranche.trancheNumber}. A release cannot be changed afterwards.`,
        label: "Capital-release evidence note",
        placeholder: "What evidence shows the capital was released?",
        confirm: "Record capital release",
        busy: "Recording…",
        tone: "primary",
        done: "Capital release recorded",
        subject: request.tranche.title,
      };
  }
}

function performRequest(
  request: FundingRequest,
  commitmentId: string,
  note: string,
): Promise<FundingCommitmentDetail> {
  switch (request.kind) {
    case "ACTIVATE":
      return activateFundingCommitment(commitmentId, note);

    case "CLOSE":
      return closeFundingCommitment(commitmentId, note);

    case "REQUEST_AUTH":
      return requestFundingAuthorization(request.tranche.id, note);

    case "AUTHORIZE":
      return authorizeFundingTranche(request.tranche.id, { decision: "APPROVED", note });

    case "REJECT":
      return authorizeFundingTranche(request.tranche.id, { decision: "REJECTED", note });

    case "RELEASE":
      return releaseFundingTranche(request.tranche.id, note);
  }
}

/* ------------------------------------------------------------------ */
/* Add tranche modal                                                   */
/* ------------------------------------------------------------------ */

interface TrancheModalProps {
  commitmentId: string;
  commitment: Commitment;
  nextSequence: number;
  onClose: () => void;
  onSaved: (updated: FundingCommitmentDetail, title: string) => void;
}

function TrancheModal({
  commitmentId,
  commitment,
  nextSequence,
  onClose,
  onSaved,
}: TrancheModalProps) {
  const unplanned = round2(commitment.committedCapitalAmount - commitment.plannedReleaseAmount);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(() => String(Math.max(0, unplanned)));
  const [date, setDate] = useState(() => isoDate(30));
  const [errors, setErrors] = useState<Partial<Record<TrancheField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validAmount = numberError(amount, { min: 0.01 }) === undefined;
  const aboveUnplanned = validAmount && Number(amount) > unplanned + 0.005;

  function clearError(field: TrancheField) {
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

    const next: Partial<Record<TrancheField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter a tranche title.";
    }

    const amountProblem = numberError(amount, { min: 0.01 });

    if (amountProblem) {
      next.amount = amountProblem;
    }

    if (!date) {
      next.date = "Choose a target date.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await createFundingTranche(commitmentId, {
        sequenceNo: nextSequence,
        title: title.trim(),
        plannedReleaseAmount: Number(amount),
        targetDate: date,
      });

      onSaved(updated, title.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create funding tranche.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Capital-release plan"
      title="Add release tranche"
      description={`Tranche ${nextSequence}. ${money(Math.max(0, unplanned), commitment.currency)} of the committed capital is not yet planned.`}
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
            form="funding-tranche-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add release tranche"}
          </button>
        </>
      }
    >
      <form id="funding-tranche-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Tranche title" htmlFor="tranche-title" error={errors.title}>
              <input
                id="tranche-title"
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

          <NumberField
            id="tranche-amount"
            label={`Planned amount (${commitment.currency})`}
            min={0.01}
            step="0.01"
            value={amount}
            error={errors.amount}
            onChange={(value) => {
              setAmount(value);
              clearError("amount");
            }}
          />

          <Field label="Target date" htmlFor="tranche-date" error={errors.date}>
            <input
              id="tranche-date"
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
        </div>

        {aboveUnplanned ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This is above the unplanned committed capital of{" "}
            {money(Math.max(0, unplanned), commitment.currency)}. Tranche amounts must add up to the
            committed capital to activate.
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
/* Add gate modal                                                      */
/* ------------------------------------------------------------------ */

interface GateModalProps {
  tranches: Tranche[];
  initialTrancheId: string;
  onClose: () => void;
  onSaved: (updated: FundingCommitmentDetail, title: string) => void;
}

function GateModal({ tranches, initialTrancheId, onClose, onSaved }: GateModalProps) {
  const [trancheId, setTrancheId] = useState(initialTrancheId);
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

    if (Object.keys(next).length > 0 || !trancheId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await createFundingGate(trancheId, {
        title: title.trim(),
        requirement: requirement.trim(),
      });

      onSaved(updated, title.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create release gate.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Evidence gate design"
      title="Add tranche gate"
      description="Evidence that must be satisfied or waived before the tranche can be authorized."
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
            form="funding-gate-form"
            className="button button--primary"
            disabled={saving || !trancheId}
          >
            {saving ? "Adding…" : "Add evidence gate"}
          </button>
        </>
      }
    >
      <form id="funding-gate-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Tranche" htmlFor="gate-tranche">
              <select
                id="gate-tranche"
                className="kit-field-input"
                value={trancheId}
                onChange={(event) => setTrancheId(event.target.value)}
              >
                {tranches.map((tranche) => (
                  <option key={tranche.id} value={tranche.id}>
                    {tranche.trancheNumber} — {tranche.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

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
  gate: TrancheGate;
  onClose: () => void;
  onSaved: (updated: FundingCommitmentDetail, message: string, title: string) => void;
}

function DecisionModal({ gate, onClose, onSaved }: DecisionModalProps) {
  const [decision, setDecision] = useState<FundingGateStatus>("SATISFIED");
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
      const updated = await decideFundingGate(gate.id, {
        decision,
        evidenceNote: evidence.trim(),
        decisionNote: note.trim(),
      });

      onSaved(updated, waiving ? "Gate waived" : "Gate satisfied", gate.title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to decide funding gate.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Evidence gate"
      title="Decide gate"
      description={`${gate.title}. Requirement: ${gate.requirement}`}
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
            form="funding-decision-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : waiving ? "Waive gate" : "Satisfy gate"}
          </button>
        </>
      }
    >
      <form id="funding-decision-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Outcome" htmlFor="funding-outcome">
              <select
                id="funding-outcome"
                className="kit-field-input"
                value={decision}
                onChange={(event) => setDecision(event.target.value as FundingGateStatus)}
              >
                <option value="SATISFIED">Satisfy</option>

                <option value="WAIVED">Waive</option>
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Evidence" htmlFor="funding-evidence" error={errors.evidence}>
              <textarea
                id="funding-evidence"
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
            <Field label="Decision note" htmlFor="funding-note" error={errors.note}>
              <textarea
                id="funding-note"
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
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface FundingData {
  id: string;
  detail: FundingCommitmentDetail;
}

export default function FundingCommitmentPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canAuthorize = user !== null && AUTHORIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<FundingData | null>(null);
  const [addingTranche, setAddingTranche] = useState(false);
  const [gateTrancheId, setGateTrancheId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<TrancheGate | null>(null);
  const [request, setRequest] = useState<FundingRequest | null>(null);
  const [requestRunning, setRequestRunning] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotRunning, setSnapshotRunning] = useState(false);
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
        const response = await getFundingCommitment(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load funding commitment.",
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

  function applyDetail(updated: FundingCommitmentDetail) {
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
        <Link href="/funding-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Funding execution
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

  const { commitment, tranches } = detail;
  const currency = commitment.currency;
  const status = String(commitment.status);
  const planned = status === "PLANNED";
  const activeCommitment = status === "ACTIVE";
  const busyAny = requestRunning || snapshotRunning;

  const orderedTranches = [...tranches].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const plannedTranches = orderedTranches.filter((tranche) => String(tranche.status) === "PLANNED");
  const canAddGates = canManage && (planned || activeCommitment) && plannedTranches.length > 0;
  const unplanned = round2(commitment.committedCapitalAmount - commitment.plannedReleaseAmount);

  const covered = Math.abs(commitment.plannedCoveragePct - 100) < 0.005;
  const ungated = tranches.filter((tranche) => tranche.gateCount === 0);
  const checks: { done: boolean; text: string }[] = [
    {
      done: tranches.length > 0,
      text:
        tranches.length > 0
          ? `${tranches.length} release ${tranches.length === 1 ? "tranche is" : "tranches are"} planned`
          : "Add at least one release tranche",
    },
    {
      done: covered,
      text: `Tranche amounts cover ${commitment.plannedCoveragePct.toFixed(1)}% of the committed capital (must be exactly 100%)`,
    },
    {
      done: tranches.length > 0 && ungated.length === 0,
      text:
        tranches.length > 0 && ungated.length === 0
          ? "Every tranche has at least one release gate"
          : `${ungated.length} ${ungated.length === 1 ? "tranche has" : "tranches have"} no release gate`,
    },
  ];
  const canActivate = checks.every((check) => check.done);

  const pendingAuthorizations = tranches.filter(
    (tranche) => String(tranche.status) === "READY_FOR_AUTHORIZATION",
  );
  const awaitingRelease = tranches.filter((tranche) => String(tranche.status) === "AUTHORIZED");

  async function confirmRequest(note: string) {
    if (request === null) {
      return;
    }

    const current = request;
    const copy = requestCopy(current, commitment);

    setRequestRunning(true);
    setRequestError(null);

    try {
      applyDetail(await performRequest(current, params.id, note.trim()));

      setRequest(null);

      toast.success(copy.done, copy.subject);
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : "Unable to record the decision.");
    } finally {
      setRequestRunning(false);
    }
  }

  function openRequest(next: FundingRequest) {
    setRequestError(null);
    setRequest(next);
  }

  async function confirmSnapshot() {
    setSnapshotRunning(true);

    try {
      await captureFundingSnapshot(params.id);

      setSnapshotOpen(false);

      toast.success("Snapshot captured", commitment.commitmentNumber);
    } catch (caught) {
      setSnapshotOpen(false);

      toast.error(
        "Could not capture the snapshot",
        caught instanceof Error ? caught.message : "Unable to capture funding snapshot.",
      );
    } finally {
      setSnapshotRunning(false);
    }
  }

  function handleTrancheAdded(updated: FundingCommitmentDetail, title: string) {
    applyDetail(updated);
    setAddingTranche(false);
    toast.success("Tranche added", title);
  }

  function handleGateAdded(updated: FundingCommitmentDetail, title: string) {
    applyDetail(updated);
    setGateTrancheId(null);
    toast.success("Gate added", title);
  }

  function handleDecided(updated: FundingCommitmentDetail, message: string, title: string) {
    applyDetail(updated);
    setDeciding(null);
    toast.success(message, title);
  }

  const requestInfo = request !== null ? requestCopy(request, commitment) : null;

  const kpis: KpiItem[] = [
    {
      label: "Authorized ceiling",
      icon: ShieldCheck,
      value: money(commitment.authorizedCapitalAmount, currency),
      note: `${money(commitment.remainingAuthorizationAmount, currency)} uncommitted`,
    },
    {
      label: "Committed",
      icon: Coins,
      value: money(commitment.committedCapitalAmount, currency),
      note: "Committed capital",
    },
    {
      label: "Planned",
      icon: Gauge,
      value: money(commitment.plannedReleaseAmount, currency),
      note: `${commitment.plannedCoveragePct.toFixed(1)}% plan coverage`,
      tone: planned && !covered ? "warning" : "default",
    },
    {
      label: "Released",
      icon: BadgeCheck,
      value: money(commitment.releasedAmount, currency),
      note: "Recorded capital releases",
    },
    {
      label: "Release %",
      icon: Gauge,
      value: `${commitment.releasePct.toFixed(1)}%`,
      note: "Of the committed capital",
    },
    {
      label: "Remaining",
      icon: Coins,
      value: money(commitment.remainingCommitmentAmount, currency),
      note: "Still to be released",
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/funding-execution" className="request-back-link">
        <ArrowLeft size={16} />
        Funding execution
      </Link>

      <section className="funding-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{commitment.commitmentNumber}</span>

            <FundingBadge status={status} />
          </div>

          <span className="eyebrow">Governed funding commitment</span>

          <h1>{commitment.initiativeTitle}</h1>

          <p>
            {commitment.allocationCycleNumber}
            {" · "}
            {commitment.caseNumber}
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

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setSnapshotOpen(true)}
            >
              <Camera size={15} />
              Capture snapshot
            </button>
          ) : null}

          {canManage && planned ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAddingTranche(true)}
            >
              <Plus size={15} />
              Add tranche
            </button>
          ) : null}

          {canAuthorize && planned ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !canActivate}
              title={canActivate ? undefined : "Complete the activation checklist first"}
              onClick={() => openRequest({ kind: "ACTIVATE" })}
            >
              Activate
            </button>
          ) : null}

          {canAuthorize && status === "FULLY_RELEASED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRequest({ kind: "CLOSE" })}
            >
              Close commitment
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

      {planned && (canManage || canAuthorize) ? (
        <div
          className={`kit-callout ${canActivate ? "kit-callout--info" : "kit-callout--warning"}`}
          role="status"
        >
          {canActivate ? <Info size={17} /> : <AlertTriangle size={17} />}

          <div>
            {canActivate ? (
              <>
                <strong>The commitment is ready to activate.</strong>{" "}
                {canAuthorize
                  ? "Use Activate above."
                  : "A procurement manager or administrator needs to activate it."}
              </>
            ) : (
              <>
                <strong>The commitment cannot be activated yet.</strong> See the activation
                checklist below.
              </>
            )}
          </div>
        </div>
      ) : null}

      {canAuthorize && pendingAuthorizations.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {pendingAuthorizations.length}{" "}
              {pendingAuthorizations.length === 1 ? "tranche is" : "tranches are"} waiting for
              authorization.
            </strong>{" "}
            Authorize or reject {pendingAuthorizations.length === 1 ? "it" : "them"} in the tranche
            list.
          </div>
        </div>
      ) : null}

      {canAuthorize && awaitingRelease.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {awaitingRelease.length} authorized {awaitingRelease.length === 1 ? "tranche" : "tranches"}{" "}
              {awaitingRelease.length === 1 ? "is" : "are"} waiting for the capital release to be
              recorded.
            </strong>
          </div>
        </div>
      ) : null}

      {commitment.pendingGateCount > 0 && activeCommitment ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {commitment.pendingGateCount}{" "}
              {commitment.pendingGateCount === 1 ? "release gate is" : "release gates are"} pending.
            </strong>{" "}
            A tranche can only be sent for authorization once its gates are resolved.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Funding summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Funding authority</span>

            <h2>Commitment context</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="funding-objective">{commitment.objective}</p>

        <div className="funding-context-grid">
          <div>
            <span>Funding owner</span>

            <strong>{commitment.fundingOwnerName}</strong>
          </div>

          <div>
            <span>Plan coverage</span>

            <strong>{commitment.plannedCoveragePct.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Uncommitted authorization</span>

            <strong>{money(commitment.remainingAuthorizationAmount, currency)}</strong>
          </div>

          <div>
            <span>Pending gates</span>

            <strong>{commitment.pendingGateCount}</strong>
          </div>
        </div>

        <ProgressLine
          pct={commitment.plannedCoveragePct}
          tone={covered ? meterToneFor("success") : "primary"}
          caption={`${commitment.plannedCoveragePct.toFixed(1)}% of the committed capital is planned into tranches`}
          label="Planned coverage of the committed capital"
        />

        <ProgressLine
          pct={commitment.releasePct}
          tone={commitment.releasePct >= 100 ? meterToneFor("success") : "primary"}
          caption={`${money(commitment.releasedAmount, currency)} of ${money(commitment.committedCapitalAmount, currency)} released (${commitment.releasePct.toFixed(1)}%)`}
          label="Capital released against the commitment"
        />
      </section>

      <div className="funding-source-link">
        <Link href={`/capital-allocation/${commitment.allocationCycleId}`} className="table-action">
          Open authoritative Step 57 allocation decision
        </Link>
      </div>

      {planned && (canManage || canAuthorize) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Commitment activation</span>

              <h2>Activation checklist</h2>
            </div>

            <ShieldCheck size={19} />
          </div>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {checks.map((check) => (
              <li
                key={check.text}
                className={check.done ? undefined : "kit-text-muted"}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                {check.done ? <BadgeCheck size={16} /> : <XCircle size={16} />}
                {check.text}
              </li>
            ))}
          </ul>

          {unplanned > 0.005 ? (
            <p className="kit-meta-line" style={{ marginTop: 12 }}>
              {money(unplanned, currency)} of the committed capital is not planned into a tranche
              yet.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Capital-release governance</span>

            <h2>Funding tranches</h2>
          </div>

          {canManage && planned ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingTranche(true)}
            >
              <Plus size={15} />
              Add tranche
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        {orderedTranches.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="No tranches"
            description="No release tranche has been defined."
            action={
              canManage && planned ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setAddingTranche(true)}
                >
                  <Plus size={15} />
                  Add tranche
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="funding-tranche-list">
            {orderedTranches.map((tranche) => {
              const trancheStatus = String(tranche.status);
              const released = trancheStatus === "RELEASED";
              const gatesOpen = tranche.pendingGateCount > 0 || tranche.gateCount === 0;

              return (
                <article key={tranche.id}>
                  <div className="funding-tranche-heading">
                    <div>
                      <FundingBadge status={trancheStatus} />

                      <strong>
                        {tranche.sequenceNo}. {tranche.title}
                      </strong>

                      <small>
                        {tranche.trancheNumber}
                        {" · Target "}
                        {showDate(tranche.targetDate)}
                      </small>
                    </div>

                    <strong>{money(tranche.plannedReleaseAmount, currency)}</strong>
                  </div>

                  <div className="funding-tranche-signals">
                    <span>
                      Gates
                      <strong>
                        {tranche.resolvedGateCount}
                        {" / "}
                        {tranche.gateCount}
                      </strong>
                    </span>

                    <span>
                      Authorization records
                      <strong>{tranche.authorizations.length}</strong>
                    </span>

                    <span>
                      Released
                      <strong>
                        {tranche.release ? money(tranche.release.releasedAmount, currency) : "No"}
                      </strong>
                    </span>
                  </div>

                  {tranche.gateCount > 0 ? (
                    <ProgressLine
                      pct={(tranche.resolvedGateCount / tranche.gateCount) * 100}
                      tone={
                        tranche.pendingGateCount === 0 ? meterToneFor("success") : "primary"
                      }
                      caption={`${tranche.resolvedGateCount} of ${tranche.gateCount} gates resolved`}
                      label={`${tranche.title} gates resolved`}
                    />
                  ) : null}

                  <div className="funding-gate-list">
                    {tranche.gates.map((gate) => (
                      <div key={gate.id} className="funding-gate">
                        <div>
                          <strong>{gate.title}</strong>

                          <GateBadge status={String(gate.status)} />

                          <p>{gate.requirement}</p>

                          {gate.evidenceNote ? <small>Evidence: {gate.evidenceNote}</small> : null}
                        </div>

                        {canAuthorize && gate.status === "PENDING" && trancheStatus === "PLANNED" ? (
                          <button
                            type="button"
                            className="kit-row-button"
                            disabled={busyAny}
                            onClick={() => setDeciding(gate)}
                          >
                            <ShieldCheck size={14} />
                            Decide
                          </button>
                        ) : null}
                      </div>
                    ))}

                    {tranche.gates.length === 0 ? (
                      <p className="kit-meta-line">This tranche has no release gate yet.</p>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 10,
                      alignItems: "center",
                    }}
                  >
                    {canAddGates && trancheStatus === "PLANNED" ? (
                      <button
                        type="button"
                        className="kit-row-button"
                        disabled={busyAny}
                        onClick={() => setGateTrancheId(String(tranche.id))}
                      >
                        <Plus size={14} />
                        Add gate
                      </button>
                    ) : null}

                    {activeCommitment && !released ? (
                      <>
                        {canManage && trancheStatus === "PLANNED" ? (
                          <button
                            type="button"
                            className="kit-row-button"
                            disabled={busyAny || gatesOpen}
                            title={
                              gatesOpen
                                ? "Resolve every gate, and add at least one, first"
                                : undefined
                            }
                            onClick={() => openRequest({ kind: "REQUEST_AUTH", tranche })}
                          >
                            Request authorization
                          </button>
                        ) : null}

                        {canAuthorize && trancheStatus === "READY_FOR_AUTHORIZATION" ? (
                          <>
                            <button
                              type="button"
                              className="kit-row-button"
                              disabled={busyAny}
                              onClick={() => openRequest({ kind: "AUTHORIZE", tranche })}
                            >
                              <BadgeCheck size={14} />
                              Authorize
                            </button>

                            <button
                              type="button"
                              className="kit-row-button"
                              disabled={busyAny}
                              onClick={() => openRequest({ kind: "REJECT", tranche })}
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </>
                        ) : null}

                        {canAuthorize && trancheStatus === "AUTHORIZED" ? (
                          <button
                            type="button"
                            className="kit-row-button"
                            disabled={busyAny}
                            onClick={() => openRequest({ kind: "RELEASE", tranche })}
                          >
                            <Coins size={14} />
                            Record capital release
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  {tranche.authorizations.length > 0 ? (
                    <div className="funding-authorization-history">
                      {tranche.authorizations.map((authorization) => (
                        <div key={authorization.id}>
                          <StatusBadge value={String(authorization.decision)} />

                          <span>
                            {money(authorization.authorizedAmount, currency)}
                            {" · "}
                            {authorization.authorizedByName}
                            {" · "}
                            {formatDateTime(authorization.authorizedAt)}
                          </span>

                          <p>{authorization.authorizationNote}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {tranche.release ? (
                    <div className="funding-release-record">
                      <strong>Immutable capital release</strong>

                      <p>
                        {money(tranche.release.releasedAmount, currency)}
                        {" · "}
                        {tranche.release.releaseNote}
                      </p>

                      <small>
                        {tranche.release.releasedByName}
                        {" · "}
                        {formatDateTime(tranche.release.releasedAt)}
                      </small>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {commitment.activationNote ? (
        <section className="funding-approval-note">
          <strong>Funding commitment activated</strong>

          <p>{commitment.activationNote}</p>

          <small>{commitment.activatedByName}</small>
        </section>
      ) : null}

      <section className="funding-method-note">
        <Goal size={18} />

        <div>
          <strong>Authorization evidence and release evidence are separate</strong>

          <p>
            A satisfied gate does not authorize capital. An approved authorization does not itself
            record a release. Each stage has its own immutable evidence boundary.
          </p>
        </div>
      </section>

      {addingTranche ? (
        <TrancheModal
          commitmentId={params.id}
          commitment={commitment}
          nextSequence={tranches.length + 1}
          onClose={() => setAddingTranche(false)}
          onSaved={handleTrancheAdded}
        />
      ) : null}

      {gateTrancheId !== null ? (
        <GateModal
          tranches={plannedTranches}
          initialTrancheId={gateTrancheId}
          onClose={() => setGateTrancheId(null)}
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

      {snapshotOpen ? (
        <ActionDialog
          eyebrow="Funding evidence"
          title="Capture a funding snapshot?"
          description={`The current state of ${commitment.commitmentNumber} is recorded. A snapshot cannot be changed afterwards.`}
          confirmLabel="Capture snapshot"
          busyLabel="Capturing…"
          cancelLabel="Not yet"
          busy={snapshotRunning}
          onConfirm={() => void confirmSnapshot()}
          onCancel={() => setSnapshotOpen(false)}
        />
      ) : null}

      {request !== null && requestInfo !== null ? (
        <RationaleDialog
          eyebrow={requestInfo.eyebrow}
          title={requestInfo.title}
          description={requestInfo.description}
          label={requestInfo.label}
          placeholder={requestInfo.placeholder}
          confirmLabel={requestInfo.confirm}
          busyLabel={requestInfo.busy}
          tone={requestInfo.tone}
          maxLength={2000}
          busy={requestRunning}
          error={requestError}
          onConfirm={(note) => void confirmRequest(note)}
          onCancel={() => setRequest(null)}
        />
      ) : null}
    </div>
  );
}
