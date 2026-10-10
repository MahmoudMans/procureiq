"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  ClipboardCheck,
  Coins,
  FileCheck2,
  Gauge,
  Info,
  Plus,
  RefreshCw,
  TrendingDown,
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
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addFlywheelVarianceExecutionItem,
  captureFlywheelVarianceExecutionSnapshot,
  closeFlywheelVarianceExecutionCase,
  getFlywheelVarianceExecutionCase,
  submitFlywheelVarianceExecutionForReview,
  verifyFlywheelVarianceExecutionCase,
} from "@/lib/api";
import type {
  FlywheelVarianceExecutionCaseDetail,
  FlywheelVarianceExecutionOutcome,
} from "@/types/flywheel-variance-execution";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ExecutionCase = FlywheelVarianceExecutionCaseDetail["executionCase"];
type Candidate = FlywheelVarianceExecutionCaseDetail["candidates"][number];
type ExecutionItem = FlywheelVarianceExecutionCaseDetail["items"][number];
type ExecutionSnapshot = FlywheelVarianceExecutionCaseDetail["snapshots"][number];
type Flow = "SUBMIT" | "SNAPSHOT";
type EvidenceField = "item" | "amount" | "date" | "reference" | "note";
type RationaleRequest = { kind: "VERIFY" } | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const VERIFY_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

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

function defaultAmount(candidate?: Candidate): string {
  if (!candidate || candidate.sourceDecision === "INVESTIGATE") {
    return "0";
  }

  return String(candidate.sourceVarianceAmount);
}

function CaseBadge({ status }: { status: string }) {
  if (status === "VERIFIED") {
    return <StatusBadge value="ACHIEVED" label="Verified" />;
  }

  return <StatusBadge value={status} />;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "COMPLETED") {
    return <StatusBadge value="COMPLETED" label="Completed" />;
  }

  if (outcome === "PARTIAL") {
    return <StatusBadge value="PENDING" label="Partial" />;
  }

  if (outcome === "UNRESOLVED") {
    return <StatusBadge value="OFF_TRACK" label="Unresolved" />;
  }

  return <StatusBadge value={outcome} label={readable(outcome)} />;
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
  SUBMIT: {
    eyebrow: "Evidence completeness",
    title: "Submit for verification?",
    confirm: "Submit for verification",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for verification",
    failed: "Could not submit for verification",
  },
  SNAPSHOT: {
    eyebrow: "Immutable execution evidence",
    title: "Capture an execution snapshot?",
    confirm: "Capture snapshot",
    busy: "Capturing…",
    keep: "Not yet",
    done: "Snapshot captured",
    failed: "Could not capture the snapshot",
  },
};

function flowDescription(flow: Flow, executionCase: ExecutionCase): string {
  switch (flow) {
    case "SUBMIT":
      return `${executionCase.executionNumber} will be submitted for manager verification. Evidence can no longer be added while it is under review.`;

    case "SNAPSHOT":
      return `The current state of ${executionCase.executionNumber} is recorded as an immutable snapshot.`;
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
  done: string;
}

function rationaleCopy(request: RationaleRequest, executionCase: ExecutionCase): RationaleCopy {
  switch (request.kind) {
    case "VERIFY":
      return {
        eyebrow: "Manager evidence verification",
        title: "Verify treatment execution",
        description: `${executionCase.executionNumber} has execution evidence for every Step 73 treatment decision. Verifying confirms that evidence.`,
        label: "Verification conclusion",
        placeholder: "What confirms the evidence is complete and credible?",
        confirm: "Verify execution evidence",
        busy: "Verifying…",
        done: "Execution evidence verified",
      };

    case "CLOSE":
      return {
        eyebrow: "Evidence lifecycle",
        title: "Close execution case",
        description: `${executionCase.executionNumber} was verified. Closing it finishes the evidence lifecycle.`,
        label: "Closure rationale",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close execution case",
        busy: "Closing…",
        done: "Execution case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<FlywheelVarianceExecutionCaseDetail> {
  switch (request.kind) {
    case "VERIFY":
      return verifyFlywheelVarianceExecutionCase(caseId, note);

    case "CLOSE":
      return closeFlywheelVarianceExecutionCase(caseId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildItemColumns(currency: string): Column<ExecutionItem>[] {
  return [
    {
      id: "lineage",
      header: "Lineage",
      sortValue: (item) => item.rootTargetInitiativeTitle.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.rootTargetInitiativeTitle}</strong>

          <span>{item.lineageNumber}</span>
        </div>
      ),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.sourceDecision),
      cell: (item) => readable(String(item.sourceDecision)),
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => item.sourceVarianceAmount,
      cell: (item) => money(item.sourceVarianceAmount, currency),
    },
    {
      id: "executed",
      header: "Executed",
      align: "right",
      sortValue: (item) => item.executedAmount,
      cell: (item) => <strong>{money(item.executedAmount, currency)}</strong>,
    },
    {
      id: "residual",
      header: "Financial residual",
      align: "right",
      sortValue: (item) => item.financialResidualAmount,
      cell: (item) => (
        <span className={item.financialResidualAmount > 0 ? "kit-text-warning" : undefined}>
          {money(item.financialResidualAmount, currency)}
        </span>
      ),
    },
    {
      id: "outcome",
      header: "Outcome",
      sortValue: (item) => String(item.outcome),
      cell: (item) => <OutcomeBadge outcome={String(item.outcome)} />,
    },
    {
      id: "reference",
      header: "Reference",
      sortValue: (item) => (item.evidenceReference ?? "").toLowerCase(),
      cell: (item) => item.evidenceReference ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "date",
      header: "Date",
      sortValue: (item) => item.evidenceDate ?? null,
      cell: (item) => showDate(item.evidenceDate),
    },
    {
      id: "note",
      header: "Evidence",
      cell: (item) => <span>{item.evidenceNote}</span>,
    },
  ];
}

function buildSnapshotColumns(): Column<ExecutionSnapshot>[] {
  return [
    {
      id: "snapshot",
      header: "Snapshot",
      sortValue: (item) => item.snapshotNumber,
      cell: (item) => <strong>{item.snapshotNumber}</strong>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.caseStatus),
      cell: (item) => <CaseBadge status={String(item.caseStatus)} />,
    },
    {
      id: "recovered",
      header: "Recovered",
      align: "right",
      sortValue: (item) => item.recoveredAmount,
      cell: (item) => money(item.recoveredAmount, item.currency),
    },
    {
      id: "writtenOff",
      header: "Written off",
      align: "right",
      sortValue: (item) => item.writtenOffAmount,
      cell: (item) => money(item.writtenOffAmount, item.currency),
    },
    {
      id: "investigation",
      header: "Investigation",
      align: "right",
      sortValue: (item) => item.completedInvestigationAmount,
      cell: (item) => money(item.completedInvestigationAmount, item.currency),
    },
    {
      id: "residual",
      header: "Financial residual",
      align: "right",
      sortValue: (item) => item.exposure.financialResidualAmount,
      cell: (item) => money(item.exposure.financialResidualAmount, item.currency),
    },
    {
      id: "completion",
      header: "Treatment completion",
      align: "right",
      sortValue: (item) => item.completionPct,
      cell: (item) => `${item.completionPct.toFixed(1)}%`,
    },
    {
      id: "evidence",
      header: <span className="kit-sr-only">Evidence</span>,
      align: "right",
      cell: (item) => (
        <Link href={`/flywheel-variance-execution/snapshots/${item.id}`} className="table-action">
          Evidence
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Record evidence modal                                               */
/* ------------------------------------------------------------------ */

interface EvidenceModalProps {
  caseId: string;
  currency: string;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: FlywheelVarianceExecutionCaseDetail, title: string) => void;
}

function EvidenceModal({ caseId, currency, candidates, onClose, onSaved }: EvidenceModalProps) {
  const first = candidates[0];

  const [itemId, setItemId] = useState(first?.varianceItemId ?? "");
  const [outcome, setOutcome] = useState<FlywheelVarianceExecutionOutcome>("COMPLETED");
  const [amount, setAmount] = useState(() => defaultAmount(first));
  const [date, setDate] = useState(() => isoDate(0));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<EvidenceField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.varianceItemId === itemId);
  const investigation = selected?.sourceDecision === "INVESTIGATE";
  const amountValid = numberError(amount, { min: 0 }) === undefined;
  const exceedsVariance =
    !investigation &&
    amountValid &&
    selected !== undefined &&
    Number(amount) > selected.sourceVarianceAmount + 0.005;
  const completedBelow =
    !investigation &&
    amountValid &&
    selected !== undefined &&
    String(outcome) === "COMPLETED" &&
    Number(amount) < selected.sourceVarianceAmount - 0.005;

  function clearError(field: EvidenceField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  function handleSelect(id: string) {
    setItemId(id);
    clearError("item");
    clearError("amount");

    const candidate = candidates.find((current) => current.varianceItemId === id);

    if (candidate) {
      setAmount(defaultAmount(candidate));
      setOutcome("COMPLETED");

      if (candidate.sourceDecision === "INVESTIGATE") {
        setReference("");
        clearError("reference");
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<EvidenceField, string>> = {};

    if (!itemId || !selected) {
      next.item = "Select a Step 73 treatment.";
    }

    if (!investigation) {
      const problem = numberError(amount, { min: 0 });

      if (problem) {
        next.amount = problem;
      }
    }

    const executed = investigation ? 0 : Number(amount);

    if (!date) {
      next.date = "Choose the evidence date.";
    } else if (date > isoDate(0)) {
      next.date = "The evidence date cannot be in the future.";
    }

    if (executed > 0 && !reference.trim()) {
      next.reference = "An external evidence reference is required when an amount is recorded.";
    }

    if (!note.trim()) {
      next.note = "Describe the evidence.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await addFlywheelVarianceExecutionItem(caseId, {
        varianceItemId: itemId,
        executedAmount: executed,
        outcome,
        evidenceReference: reference.trim() ? reference.trim() : null,
        evidenceDate: date,
        evidenceNote: note.trim(),
      });

      onSaved(updated, selected ? selected.rootTargetInitiativeTitle : "Treatment");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to record treatment execution evidence.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="External action evidence"
      title="Record treatment execution"
      description="Record the external evidence for one Step 73 treatment decision."
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
            form="variance-evidence-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record execution evidence"}
          </button>
        </>
      }
    >
      <form id="variance-evidence-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Step 73 treatment" htmlFor="evidence-item" error={errors.item}>
              <select
                id="evidence-item"
                className="kit-field-input"
                value={itemId}
                aria-invalid={errors.item ? true : undefined}
                onChange={(event) => handleSelect(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.varianceItemId} value={candidate.varianceItemId}>
                    {candidate.rootTargetInitiativeTitle} — {readable(String(candidate.sourceDecision))}{" "}
                    — {money(candidate.sourceVarianceAmount, currency)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Outcome" htmlFor="evidence-outcome">
            <select
              id="evidence-outcome"
              className="kit-field-input"
              value={outcome}
              onChange={(event) =>
                setOutcome(event.target.value as FlywheelVarianceExecutionOutcome)
              }
            >
              <option value="COMPLETED">Completed</option>

              {!investigation ? <option value="PARTIAL">Partial</option> : null}

              <option value="UNRESOLVED">Unresolved</option>
            </select>
          </Field>

          {investigation ? (
            <Field label="Executed financial amount" htmlFor="evidence-amount-fixed">
              <input
                id="evidence-amount-fixed"
                className="kit-field-input"
                value="0"
                disabled
                readOnly
              />
            </Field>
          ) : (
            <NumberField
              id="evidence-amount"
              label={`Executed financial amount (${currency})`}
              min={0}
              step="0.01"
              value={amount}
              error={errors.amount}
              onChange={(value) => {
                setAmount(value);
                clearError("amount");
              }}
            />
          )}

          {investigation ? (
            <div className="kit-pair-wide">
              <p className="kit-meta-line">
                An investigation carries no financial amount, so it does not reduce the financial
                residual.
              </p>
            </div>
          ) : null}

          <Field label="Evidence date" htmlFor="evidence-date" error={errors.date}>
            <input
              id="evidence-date"
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

          <div className="kit-pair-wide">
            <Field
              label="External evidence reference"
              htmlFor="evidence-reference"
              error={errors.reference}
            >
              <input
                id="evidence-reference"
                className="kit-field-input"
                maxLength={300}
                placeholder="Bank reference, ERP journal, accounting record, investigation file..."
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
            <Field label="Evidence note" htmlFor="evidence-note" error={errors.note}>
              <textarea
                id="evidence-note"
                className="kit-field-input"
                rows={5}
                maxLength={5000}
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

        {exceedsVariance && selected ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The executed amount is above the approved variance of{" "}
            {money(selected.sourceVarianceAmount, currency)}.
          </p>
        ) : null}

        {completedBelow && selected ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            A completed treatment normally covers the full variance of{" "}
            {money(selected.sourceVarianceAmount, currency)}. Use Partial if only part was
            recovered or written off.
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
  detail: FlywheelVarianceExecutionCaseDetail;
}

export default function FlywheelVarianceExecutionCasePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canVerify = user !== null && VERIFY_ROLES.includes(user.role);

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
        const response = await getFlywheelVarianceExecutionCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load treatment execution case.",
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

  function applyDetail(updated: FlywheelVarianceExecutionCaseDetail) {
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
        <Link href="/flywheel-variance-execution" className="request-back-link">
          <ArrowLeft size={16} />
          Treatment execution
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

  const { executionCase: ec, sourceAuthority: source, candidates, items, snapshots } = detail;
  const currency = ec.currency;
  const status = String(ec.status);
  const draft = status === "DRAFT";
  const inReview = status === "IN_REVIEW";
  const verified = status === "VERIFIED";
  const busyAny = flowRunning || rationaleRunning;

  const completeEvidence =
    ec.itemCount === source.itemCount && source.itemCount > 0 && candidates.length === 0;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "SUBMIT") {
        applyDetail(await submitFlywheelVarianceExecutionForReview(params.id));
      } else {
        await captureFlywheelVarianceExecutionSnapshot(params.id);

        reload();
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

  function handleRecorded(updated: FlywheelVarianceExecutionCaseDetail, title: string) {
    applyDetail(updated);
    setRecording(false);
    toast.success("Execution evidence recorded", title);
  }

  const orderedItems = [...items].sort(
    (a, b) => b.financialResidualAmount - a.financialResidualAmount,
  );

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, ec) : null;

  const kpis: KpiItem[] = [
    {
      label: "Source variance",
      icon: Coins,
      value: money(ec.sourceVarianceAmount, currency),
      note: "Approved variance",
    },
    {
      label: "Recovered",
      icon: BadgeCheck,
      value: money(ec.recoveredAmount, currency),
      note: "Recorded recoveries",
    },
    {
      label: "Written off",
      icon: TrendingDown,
      value: money(ec.writtenOffAmount, currency),
      note: "Recorded write-offs",
    },
    {
      label: "Investigation completed",
      icon: FileCheck2,
      value: money(ec.completedInvestigationAmount, currency),
      note: "Does not reduce the residual",
    },
    {
      label: "Financial residual",
      icon: AlertTriangle,
      value: money(ec.exposure.financialResidualAmount, currency),
      note: "Variance less recoveries and write-offs",
      tone: ec.exposure.financialResidualAmount > 0 ? "warning" : "default",
    },
    {
      label: "Treatment completion",
      icon: Gauge,
      value: `${ec.completionPct.toFixed(1)}%`,
      note: "Workflow progress",
    },
  ];

  const itemColumns = buildItemColumns(currency);
  const snapshotColumns = buildSnapshotColumns();

  return (
    <div className="page-stack">
      <Link href="/flywheel-variance-execution" className="request-back-link">
        <ArrowLeft size={16} />
        Treatment execution
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{ec.executionNumber}</span>

            <CaseBadge status={status} />
          </div>

          <span className="eyebrow">Step 73 treatment evidence</span>

          <h1>{ec.title}</h1>

          <p>
            {currency}
            {" · "}
            {ec.variancePlanNumber}
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
              onClick={() => setFlow("SNAPSHOT")}
            >
              <Camera size={15} />
              Snapshot
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny || candidates.length === 0}
              title={
                candidates.length === 0
                  ? "Every Step 73 treatment decision already has evidence"
                  : undefined
              }
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record evidence
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !completeEvidence}
              title={
                completeEvidence
                  ? undefined
                  : "Every Step 73 treatment decision needs one evidence record first"
              }
              onClick={() => setFlow("SUBMIT")}
            >
              <FileCheck2 size={16} />
              Submit for verification
            </button>
          ) : null}

          {canVerify && inReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "VERIFY" })}
            >
              <BadgeCheck size={16} />
              Verify evidence
            </button>
          ) : null}

          {canVerify && verified ? (
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

      {draft && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {completeEvidence ? (
              <>
                <strong>All evidence is recorded.</strong> Every Step 73 treatment decision has an
                evidence record. Submit the case for verification.
              </>
            ) : (
              <>
                <strong>
                  {candidates.length} Step 73 treatment{" "}
                  {candidates.length === 1 ? "decision still needs" : "decisions still need"}{" "}
                  execution evidence.
                </strong>{" "}
                Each decision requires one immutable evidence record before review.
              </>
            )}
          </div>
        </div>
      ) : null}

      {draft && ec.exposure.unrecordedVarianceAmount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {money(ec.exposure.unrecordedVarianceAmount, currency)} of variance has no recorded
              evidence yet.
            </strong>{" "}
            Evidence coverage is {ec.exposure.evidenceCoveragePct.toFixed(2)}%.
          </div>
        </div>
      ) : null}

      {inReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting manager verification.</strong>{" "}
            {canVerify
              ? "Use Verify evidence above."
              : "A procurement manager or administrator needs to verify the evidence."}
          </div>
        </div>
      ) : null}

      {verified && canVerify ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The execution evidence is verified.</strong> Close the case to finish the
            evidence lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Treatment execution summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Evidence and treatment coverage</h2>
          </div>

          <Gauge size={19} />
        </div>

        {source.itemCount > 0 ? (
          <ProgressLine
            pct={(ec.itemCount / source.itemCount) * 100}
            tone={completeEvidence ? meterToneFor("success") : "primary"}
            caption={`${ec.itemCount} of ${source.itemCount} treatment decisions have execution evidence`}
            label="Treatment decisions with evidence"
          />
        ) : null}

        <ProgressLine
          pct={ec.exposure.evidenceCoveragePct}
          tone={ec.exposure.evidenceCoveragePct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Evidence coverage ${ec.exposure.evidenceCoveragePct.toFixed(2)}% of the approved variance`}
          label="Evidence coverage of the approved variance"
        />

        <ProgressLine
          pct={ec.completionPct}
          tone={ec.completionPct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Treatment completion ${ec.completionPct.toFixed(1)}%`}
          label="Treatment completion"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Step 73 authority</span>

            <h2>Approved variance plan</h2>
          </div>

          <ClipboardCheck size={19} />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>Variance plan</span>

            <strong>{source.variancePlanNumber}</strong>
          </div>

          <div>
            <span>Reconciliation</span>

            <strong>{source.reconciliationNumber}</strong>
          </div>

          <div>
            <span>Step 73 owner</span>

            <strong>{source.planOwnerName}</strong>
          </div>

          <div>
            <span>Execution owner</span>

            <strong>{ec.executionOwnerName}</strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>Execution objective</span>

            <p>{ec.executionObjective}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Recorded evidence</span>

            <h2>Treatment executions</h2>
          </div>

          {canManage && draft && candidates.length > 0 ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record evidence
            </button>
          ) : (
            <ClipboardCheck size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Treatment executions"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardCheck}
              title="No execution evidence"
              description="No treatment execution evidence has been recorded."
              action={
                canManage && draft && candidates.length > 0 ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setRecording(true)}
                  >
                    <Plus size={15} />
                    Record evidence
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
            <span className="eyebrow">Immutable execution evidence</span>

            <h2>Snapshots</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setFlow("SNAPSHOT")}
            >
              <Camera size={15} />
              Snapshot
            </button>
          ) : (
            <Camera size={19} />
          )}
        </div>

        <DataTable
          columns={snapshotColumns}
          rows={snapshots}
          getRowId={(item) => String(item.id)}
          ariaLabel="Execution snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No execution snapshot has been captured yet."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">How to read these figures</span>

            <h2>Financial residual and evidence coverage</h2>
          </div>

          <Info size={19} />
        </div>

        <p>
          Financial residual equals approved variance minus recorded recoveries and recorded
          write-offs. Completing an investigation does not reduce that residual. Treatment
          completion measures workflow progress, not cash recovered or accounting entries posted by
          ProcureIQ.
        </p>

        <p className="kit-meta-line" style={{ marginTop: 10 }}>
          Variance without recorded evidence:{" "}
          {money(ec.exposure.unrecordedVarianceAmount, currency)}. Evidence coverage:{" "}
          {ec.exposure.evidenceCoveragePct.toFixed(2)}%.
        </p>
      </section>

      {recording ? (
        <EvidenceModal
          caseId={params.id}
          currency={currency}
          candidates={candidates}
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
          tone="primary"
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
