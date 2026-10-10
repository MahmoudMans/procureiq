"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  Coins,
  FileCheck2,
  Gauge,
  Info,
  Plus,
  ReceiptText,
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
  addFlywheelSettlementItem,
  captureFlywheelSettlementSnapshot,
  closeFlywheelSettlementCase,
  getFlywheelSettlementCase,
  reconcileFlywheelSettlementCase,
  submitFlywheelSettlementForReview,
} from "@/lib/api";
import type { FlywheelSettlementCaseDetail } from "@/types/flywheel-settlement";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SettlementCase = FlywheelSettlementCaseDetail["settlementCase"];
type Candidate = FlywheelSettlementCaseDetail["candidates"][number];
type SettlementItem = FlywheelSettlementCaseDetail["items"][number];
type SettlementSnapshot = FlywheelSettlementCaseDetail["snapshots"][number];
type Flow = "SUBMIT" | "SNAPSHOT";
type EvidenceField = "item" | "amount" | "date" | "reference" | "note";
type RationaleRequest = { kind: "RECONCILE" } | { kind: "CLOSE" };

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
  if (status === "RECONCILED") {
    return <StatusBadge value="COMPLETED" label="Reconciled" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
}

function ItemStatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();

  if (upper.includes("UNRESOLVED") || upper.includes("UNSETTLED")) {
    return <StatusBadge value="OFF_TRACK" label={readable(status)} />;
  }

  if (upper.includes("PARTIAL")) {
    return <StatusBadge value="PENDING" label={readable(status)} />;
  }

  if (upper.includes("SETTLED") || upper === "MATCHED") {
    return <StatusBadge value="COMPLETED" label={readable(status)} />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
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
    eyebrow: "Evidence completeness gate",
    title: "Submit reconciliation for review?",
    confirm: "Submit for review",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for review",
    failed: "Could not submit the reconciliation",
  },
  SNAPSHOT: {
    eyebrow: "Immutable reconciliation evidence",
    title: "Capture a settlement snapshot?",
    confirm: "Capture snapshot",
    busy: "Capturing…",
    keep: "Not yet",
    done: "Snapshot captured",
    failed: "Could not capture the snapshot",
  },
};

function flowDescription(flow: Flow, settlementCase: SettlementCase): string {
  switch (flow) {
    case "SUBMIT":
      return `${settlementCase.reconciliationNumber} will be submitted for manager review. Evidence can no longer be added while it is under review.`;

    case "SNAPSHOT":
      return `The current state of ${settlementCase.reconciliationNumber} is recorded as an immutable snapshot.`;
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

function rationaleCopy(request: RationaleRequest, settlementCase: SettlementCase): RationaleCopy {
  switch (request.kind) {
    case "RECONCILE": {
      const variance = Math.abs(settlementCase.varianceAmount);

      return {
        eyebrow: "Manager reconciliation authority",
        title: "Finalize reconciliation",
        description:
          variance > 0.005
            ? `${settlementCase.reconciliationNumber} will be reconciled with a variance of ${money(variance, settlementCase.currency)} between released and settled.`
            : `${settlementCase.reconciliationNumber} will be reconciled. Released and settled amounts agree.`,
        label: "Reconciliation conclusion",
        placeholder: "What does the settlement evidence conclude?",
        confirm: "Reconcile case",
        busy: "Reconciling…",
        done: "Reconciliation finalized",
      };
    }

    case "CLOSE":
      return {
        eyebrow: "Governance lifecycle",
        title: "Close reconciliation",
        description: `${settlementCase.reconciliationNumber} was reconciled. Closing it finishes the governance lifecycle.`,
        label: "Closure rationale",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close case",
        busy: "Closing…",
        done: "Reconciliation case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<FlywheelSettlementCaseDetail> {
  switch (request.kind) {
    case "RECONCILE":
      return reconcileFlywheelSettlementCase(caseId, note);

    case "CLOSE":
      return closeFlywheelSettlementCase(caseId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildItemColumns(currency: string): Column<SettlementItem>[] {
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
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.sourceReleasedAmount,
      cell: (item) => money(item.sourceReleasedAmount, currency),
    },
    {
      id: "settled",
      header: "Settled",
      align: "right",
      sortValue: (item) => item.settledAmount,
      cell: (item) => <strong>{money(item.settledAmount, currency)}</strong>,
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => Math.abs(item.varianceAmount),
      cell: (item) => (
        <span className={Math.abs(item.varianceAmount) > 0.005 ? "kit-text-warning" : undefined}>
          {money(item.varianceAmount, currency)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.reconciliationStatus),
      cell: (item) => <ItemStatusBadge status={String(item.reconciliationStatus)} />,
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

function buildSnapshotColumns(): Column<SettlementSnapshot>[] {
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
      id: "settled",
      header: "Settled",
      align: "right",
      sortValue: (item) => item.settledAmount,
      cell: (item) => money(item.settledAmount, item.currency),
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => Math.abs(item.varianceAmount),
      cell: (item) => money(item.varianceAmount, item.currency),
    },
    {
      id: "settlement",
      header: "Settlement",
      align: "right",
      sortValue: (item) => item.settlementPct,
      cell: (item) => `${item.settlementPct.toFixed(1)}%`,
    },
    {
      id: "by",
      header: "Captured by",
      sortValue: (item) => (item.capturedByName ?? "").toLowerCase(),
      cell: (item) => item.capturedByName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "evidence",
      header: <span className="kit-sr-only">Evidence</span>,
      align: "right",
      cell: (item) => (
        <Link href={`/flywheel-settlement/snapshots/${item.id}`} className="table-action">
          Evidence
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Record settlement evidence modal                                    */
/* ------------------------------------------------------------------ */

interface EvidenceModalProps {
  caseId: string;
  currency: string;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: FlywheelSettlementCaseDetail, title: string) => void;
}

function EvidenceModal({ caseId, currency, candidates, onClose, onSaved }: EvidenceModalProps) {
  const first = candidates[0];

  const [itemId, setItemId] = useState(first?.releaseItemId ?? "");
  const [amount, setAmount] = useState(() => (first ? String(first.sourceReleasedAmount) : "0"));
  const [date, setDate] = useState(() => isoDate(0));
  const [reference, setReference] = useState(first?.executionReference ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<EvidenceField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.releaseItemId === itemId);
  const amountValid = numberError(amount, { min: 0 }) === undefined;
  const settled = amountValid ? Number(amount) : 0;
  const released = selected ? selected.sourceReleasedAmount : 0;
  const below = amountValid && selected !== undefined && settled < released - 0.005;
  const above = amountValid && selected !== undefined && settled > released + 0.005;

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
    clearError("reference");

    const candidate = candidates.find((current) => current.releaseItemId === id);

    if (candidate) {
      setAmount(String(candidate.sourceReleasedAmount));
      setReference(candidate.executionReference ?? "");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<EvidenceField, string>> = {};

    if (!itemId || !selected) {
      next.item = "Select a released item.";
    }

    const problem = numberError(amount, { min: 0 });

    if (problem) {
      next.amount = problem;
    }

    if (!date) {
      next.date = "Choose the evidence date.";
    } else if (date > isoDate(0)) {
      next.date = "The evidence date cannot be in the future.";
    }

    if (!problem && Number(amount) > 0 && !reference.trim()) {
      next.reference = "An external evidence reference is required when an amount is settled.";
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
      const updated = await addFlywheelSettlementItem(caseId, {
        releaseItemId: itemId,
        settledAmount: Number(amount),
        evidenceReference: reference.trim() ? reference.trim() : null,
        evidenceDate: date,
        evidenceNote: note.trim(),
      });

      onSaved(updated, selected ? selected.rootTargetInitiativeTitle : "Released item");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add settlement evidence.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Manual external evidence"
      title="Record settlement evidence"
      description="Record the external evidence that a released item was settled."
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
            form="settlement-evidence-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record evidence"}
          </button>
        </>
      }
    >
      <form id="settlement-evidence-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Released item" htmlFor="settlement-item" error={errors.item}>
              <select
                id="settlement-item"
                className="kit-field-input"
                value={itemId}
                aria-invalid={errors.item ? true : undefined}
                onChange={(event) => handleSelect(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.releaseItemId} value={candidate.releaseItemId}>
                    {candidate.rootTargetInitiativeTitle} — {candidate.lineageNumber} —{" "}
                    {money(candidate.sourceReleasedAmount, currency)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <NumberField
            id="settlement-amount"
            label={`Settled amount (${currency})`}
            min={0}
            step="0.01"
            value={amount}
            error={errors.amount}
            onChange={(value) => {
              setAmount(value);
              clearError("amount");
              clearError("reference");
            }}
          />

          <Field label="Evidence date" htmlFor="settlement-date" error={errors.date}>
            <input
              id="settlement-date"
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

          {selected ? (
            <div className="kit-pair-wide">
              <p className="kit-meta-line">
                Released for this item: {money(selected.sourceReleasedAmount, currency)}
              </p>
            </div>
          ) : null}

          <div className="kit-pair-wide">
            <Field
              label="External evidence reference"
              htmlFor="settlement-reference"
              error={errors.reference}
            >
              <input
                id="settlement-reference"
                className="kit-field-input"
                maxLength={300}
                placeholder="Bank statement, ERP journal, treasury reference..."
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
            <Field label="Evidence note" htmlFor="settlement-note" error={errors.note}>
              <textarea
                id="settlement-note"
                className="kit-field-input"
                rows={4}
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

        {below ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The settled amount is below the released amount, which leaves a variance of{" "}
            {money(released - settled, currency)}.
          </p>
        ) : null}

        {above ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The settled amount is above the released amount of {money(released, currency)}.
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
  detail: FlywheelSettlementCaseDetail;
}

export default function FlywheelSettlementCasePage() {
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
        const response = await getFlywheelSettlementCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load settlement reconciliation case.",
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

  function applyDetail(updated: FlywheelSettlementCaseDetail) {
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
        <Link href="/flywheel-settlement" className="request-back-link">
          <ArrowLeft size={16} />
          Settlement evidence
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

  const { settlementCase: sc, releaseAuthority: release, candidates, items, snapshots } = detail;
  const currency = sc.currency;
  const status = String(sc.status);
  const draft = status === "DRAFT";
  const inReview = status === "IN_REVIEW";
  const reconciled = status === "RECONCILED";
  const busyAny = flowRunning || rationaleRunning;
  const evidenceComplete = sc.itemCount === release.releasedItemCount && release.releasedItemCount > 0;
  const canRecord = canManage && draft && candidates.length > 0;
  const hasVariance = sc.itemCount > 0 && Math.abs(sc.varianceAmount) > 0.005;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "SUBMIT") {
        applyDetail(await submitFlywheelSettlementForReview(params.id));
      } else {
        await captureFlywheelSettlementSnapshot(params.id);

        reload();
      }

      setFlow(null);

      toast.success(FLOWS[action].done, sc.reconciliationNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the reconciliation case.",
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
    const copy = rationaleCopy(request, sc);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, sc.reconciliationNumber);
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

  function handleRecorded(updated: FlywheelSettlementCaseDetail, title: string) {
    applyDetail(updated);
    setRecording(false);
    toast.success("Settlement evidence recorded", title);
  }

  const orderedItems = [...items].sort((a, b) => {
    const gap = Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount);

    if (gap !== 0) {
      return gap;
    }

    return a.rootTargetInitiativeTitle.localeCompare(b.rootTargetInitiativeTitle);
  });

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, sc) : null;

  const kpis: KpiItem[] = [
    {
      label: "Released",
      icon: Coins,
      value: money(sc.sourceReleasedAmount, currency),
      note: `${release.releasedItemCount} released ${release.releasedItemCount === 1 ? "item" : "items"}`,
    },
    {
      label: "Settled",
      icon: BadgeCheck,
      value: money(sc.settledAmount, currency),
      note: `${sc.itemCount} with evidence`,
    },
    {
      label: "Variance",
      icon: TrendingDown,
      value: money(sc.varianceAmount, currency),
      note: "Released less settled",
      tone: hasVariance ? "warning" : "default",
    },
    {
      label: "Settlement",
      icon: Gauge,
      value: `${sc.settlementPct.toFixed(1)}%`,
      note: "Of the released amount",
    },
    {
      label: "Partial",
      icon: FileCheck2,
      value: String(sc.partialCount),
      note: "Partly settled items",
      tone: sc.partialCount > 0 ? "warning" : "default",
    },
    {
      label: "Unresolved",
      icon: AlertTriangle,
      value: String(sc.unresolvedCount),
      note: "Items with no settlement",
      tone: sc.unresolvedCount > 0 ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns(currency);
  const snapshotColumns = buildSnapshotColumns();

  return (
    <div className="page-stack">
      <Link href="/flywheel-settlement" className="request-back-link">
        <ArrowLeft size={16} />
        Settlement evidence
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{sc.reconciliationNumber}</span>

            <CaseBadge status={status} />
          </div>

          <span className="eyebrow">Release settlement reconciliation</span>

          <h1>{sc.title}</h1>

          <p>
            {currency}
            {" · "}
            {sc.releaseNumber}
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

          {canRecord ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
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
              disabled={busyAny || !evidenceComplete}
              title={
                evidenceComplete
                  ? undefined
                  : "Every released item needs a settlement evidence record first"
              }
              onClick={() => setFlow("SUBMIT")}
            >
              <FileCheck2 size={16} />
              Submit for review
            </button>
          ) : null}

          {canFinalize && inReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "RECONCILE" })}
            >
              <BadgeCheck size={16} />
              Reconcile case
            </button>
          ) : null}

          {canFinalize && reconciled ? (
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

      {hasVariance ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              Settled differs from released by {money(Math.abs(sc.varianceAmount), currency)}.
            </strong>{" "}
            {sc.partialCount} partly settled and {sc.unresolvedCount} unresolved{" "}
            {sc.partialCount + sc.unresolvedCount === 1 ? "item" : "items"}.
          </div>
        </div>
      ) : null}

      {draft && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {evidenceComplete ? (
              <>
                <strong>All settlement evidence is recorded.</strong> Every released item has an
                evidence record. Submit the case for review.
              </>
            ) : (
              <>
                <strong>
                  {candidates.length} released {candidates.length === 1 ? "item still needs" : "items still need"}{" "}
                  settlement evidence.
                </strong>{" "}
                Every released source item needs one record before the case can enter review.
              </>
            )}
          </div>
        </div>
      ) : null}

      {inReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting manager reconciliation.</strong>{" "}
            {canFinalize
              ? "Use Reconcile case above."
              : "A procurement manager or administrator needs to finalize it."}
          </div>
        </div>
      ) : null}

      {reconciled && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The case is reconciled.</strong> Close it to finish the governance lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Settlement summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Evidence and settlement coverage</h2>
          </div>

          <Gauge size={19} />
        </div>

        {release.releasedItemCount > 0 ? (
          <ProgressLine
            pct={(sc.itemCount / release.releasedItemCount) * 100}
            tone={evidenceComplete ? meterToneFor("success") : "primary"}
            caption={`${sc.itemCount} of ${release.releasedItemCount} released items have settlement evidence`}
            label="Released items with settlement evidence"
          />
        ) : null}

        <ProgressLine
          pct={sc.settlementPct}
          tone={sc.settlementPct >= 100 ? meterToneFor("success") : "primary"}
          caption={`${money(sc.settledAmount, currency)} of ${money(sc.sourceReleasedAmount, currency)} released has settled (${sc.settlementPct.toFixed(1)}%)`}
          label="Settled against released"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Step 69/70 source authority</span>

            <h2>Finalized release</h2>
          </div>

          <ReceiptText size={19} />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>Release</span>

            <strong>{release.releaseNumber}</strong>
          </div>

          <div>
            <span>Mandate</span>

            <strong>{release.allocationMandateNumber}</strong>
          </div>

          <div>
            <span>Release owner</span>

            <strong>{release.releaseOwnerName}</strong>
          </div>

          <div>
            <span>Reconciliation owner</span>

            <strong>{sc.reconciliationOwnerName}</strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>Reconciliation rationale</span>

            <p>{sc.reconciliationRationale}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Reconciliation evidence</span>

            <h2>Settlement items</h2>
          </div>

          {canRecord ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record evidence
            </button>
          ) : (
            <ReceiptText size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Settlement items"
          busy={fetching}
          empty={
            <EmptyState
              icon={ReceiptText}
              title="No settlement evidence"
              description="No settlement evidence has been recorded."
              action={
                canRecord ? (
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
            <span className="eyebrow">Immutable reconciliation evidence</span>

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
          ariaLabel="Settlement snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No settlement snapshot has been captured yet."
            />
          }
        />
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
          description={flowDescription(flow, sc)}
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
