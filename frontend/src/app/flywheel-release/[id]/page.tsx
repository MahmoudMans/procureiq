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
  RefreshCw,
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
  meterToneFor,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addFlywheelReleaseItem,
  cancelFlywheelReleaseBatch,
  cancelFlywheelReleaseItem,
  captureFlywheelReleaseSnapshot,
  closeFlywheelReleaseBatch,
  executeFlywheelReleaseItem,
  finalizeFlywheelReleaseBatch,
  getFlywheelReleaseBatch,
  submitFlywheelReleaseForExecution,
} from "@/lib/api";
import type { FlywheelReleaseBatchDetail } from "@/types/flywheel-release";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Batch = FlywheelReleaseBatchDetail["batch"];
type Candidate = FlywheelReleaseBatchDetail["candidates"][number];
type ReleaseItem = FlywheelReleaseBatchDetail["items"][number];
type ReleaseSnapshot = FlywheelReleaseBatchDetail["snapshots"][number];
type Flow = "SUBMIT" | "SNAPSHOT";
type ItemField = "item" | "amount";
type ExecuteField = "reference" | "note";

type RationaleRequest =
  | { kind: "FINALIZE" }
  | { kind: "CLOSE" }
  | { kind: "CANCEL_BATCH" }
  | { kind: "CANCEL_ITEM"; item: ReleaseItem };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const EXECUTE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function itemRank(status: string): number {
  switch (status) {
    case "PENDING":
      return 0;
    case "RELEASED":
      return 1;
    default:
      return 2;
  }
}

function BatchBadge({ status }: { status: string }) {
  switch (status) {
    case "IN_EXECUTION":
      return <StatusBadge value="IN_PROGRESS" label="In execution" />;

    case "EXECUTED":
      return <StatusBadge value="COMPLETED" label="Executed" />;

    default:
      return <StatusBadge value={status} />;
  }
}

function ItemBadge({ status }: { status: string }) {
  if (status === "RELEASED") {
    return <StatusBadge value="PAID" label="Released" />;
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
    eyebrow: "Revalidate Step 68 authority",
    title: "Submit for execution?",
    confirm: "Submit for execution",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for execution",
    failed: "Could not submit for execution",
  },
  SNAPSHOT: {
    eyebrow: "Execution evidence",
    title: "Capture a release snapshot?",
    confirm: "Capture snapshot",
    busy: "Capturing…",
    keep: "Not yet",
    done: "Snapshot captured",
    failed: "Could not capture the snapshot",
  },
};

function flowDescription(flow: Flow, batch: Batch): string {
  switch (flow) {
    case "SUBMIT":
      return `${batch.releaseNumber} will be checked against the authorized Step 68 mandate, every source allocation item and cumulative historical release usage, then moved into execution.`;

    case "SNAPSHOT":
      return `The current state of ${batch.releaseNumber} is recorded as an immutable snapshot.`;
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
  subject: string;
}

function rationaleCopy(request: RationaleRequest, batch: Batch): RationaleCopy {
  switch (request.kind) {
    case "FINALIZE":
      return {
        eyebrow: "Manager execution confirmation",
        title: "Finalize release batch",
        description: `${batch.releaseNumber} has ${batch.releasedCount} recorded ${batch.releasedCount === 1 ? "release" : "releases"} and no pending items. It will be marked as executed.`,
        label: "Batch execution note",
        placeholder: "Confirm that the releases were executed as recorded.",
        confirm: "Mark batch executed",
        busy: "Finalizing…",
        tone: "primary",
        done: "Batch marked executed",
        subject: batch.releaseNumber,
      };

    case "CLOSE":
      return {
        eyebrow: "Release lifecycle",
        title: "Close release batch",
        description: `${batch.releaseNumber} was executed. Closing it finishes the release lifecycle.`,
        label: "Closure rationale",
        placeholder: "Summarise why this batch can be closed.",
        confirm: "Close release batch",
        busy: "Closing…",
        tone: "primary",
        done: "Release batch closed",
        subject: batch.releaseNumber,
      };

    case "CANCEL_BATCH":
      return {
        eyebrow: "Release lifecycle",
        title: "Cancel this batch",
        description: `${batch.releaseNumber} will be cancelled without recording a release. Pending items are cancelled and the history is kept.`,
        label: "Batch cancellation rationale",
        placeholder: "Why is this batch being cancelled?",
        confirm: "Cancel batch",
        busy: "Cancelling…",
        cancelLabel: "Keep batch",
        tone: "danger",
        done: "Batch cancelled",
        subject: batch.releaseNumber,
      };

    case "CANCEL_ITEM":
      return {
        eyebrow: "Release item",
        title: "Cancel this release item",
        description: `${request.item.lineageNumber} will be cancelled and no capital will be released for it.`,
        label: "Cancellation rationale",
        placeholder: "Why is this item being cancelled?",
        confirm: "Cancel item",
        busy: "Cancelling…",
        cancelLabel: "Keep item",
        tone: "danger",
        done: "Release item cancelled",
        subject: request.item.lineageNumber,
      };
  }
}

function performRationale(
  request: RationaleRequest,
  batchId: string,
  note: string,
): Promise<FlywheelReleaseBatchDetail> {
  switch (request.kind) {
    case "FINALIZE":
      return finalizeFlywheelReleaseBatch(batchId, note);

    case "CLOSE":
      return closeFlywheelReleaseBatch(batchId, note);

    case "CANCEL_BATCH":
      return cancelFlywheelReleaseBatch(batchId, note);

    case "CANCEL_ITEM":
      return cancelFlywheelReleaseItem(request.item.id, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ItemColumnOptions {
  currency: string;
  canAct: boolean;
  busy: boolean;
  onRelease: (item: ReleaseItem) => void;
  onCancel: (item: ReleaseItem) => void;
}

function buildItemColumns(options: ItemColumnOptions): Column<ReleaseItem>[] {
  const { currency } = options;

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
      id: "authorized",
      header: "Authorized",
      align: "right",
      sortValue: (item) => item.mandateAuthorizedItemAmount,
      cell: (item) => money(item.mandateAuthorizedItemAmount, currency),
    },
    {
      id: "planned",
      header: "Planned",
      align: "right",
      sortValue: (item) => item.plannedReleaseAmount,
      cell: (item) => <strong>{money(item.plannedReleaseAmount, currency)}</strong>,
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (item) => item.strategyPriorityScore,
      cell: (item) => item.strategyPriorityScore.toFixed(1),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => itemRank(String(item.status)),
      cell: (item) => <ItemBadge status={String(item.status)} />,
    },
    {
      id: "execution",
      header: "Execution",
      cell: (item) => (
        <div className="kit-cell-stack">
          {item.executionReference ? <strong>{item.executionReference}</strong> : null}

          <span>{item.executionNote ?? item.cancellationNote ?? "Awaiting execution"}</span>

          {item.releasedByName ? <small>Released by {item.releasedByName}</small> : null}

          {item.cancelledByName ? <small>Cancelled by {item.cancelledByName}</small> : null}
        </div>
      ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 230,
      cell: (item) =>
        options.canAct && item.status === "PENDING" ? (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onRelease(item)}
            >
              <BadgeCheck size={14} />
              Record release
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onCancel(item)}
            >
              <XCircle size={14} />
              Cancel
            </button>
          </div>
        ) : null,
    },
  ];
}

function buildSnapshotColumns(): Column<ReleaseSnapshot>[] {
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
      sortValue: (item) => String(item.releaseStatus),
      cell: (item) => <BatchBadge status={String(item.releaseStatus)} />,
    },
    {
      id: "released",
      header: "Released",
      align: "right",
      sortValue: (item) => item.batchReleasedAmount,
      cell: (item) => money(item.batchReleasedAmount, item.currency),
    },
    {
      id: "cumulative",
      header: "Cumulative",
      align: "right",
      sortValue: (item) => item.cumulativeMandateReleasedAmount,
      cell: (item) => money(item.cumulativeMandateReleasedAmount, item.currency),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingMandateAmount,
      cell: (item) => money(item.remainingMandateAmount, item.currency),
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
        <Link href={`/flywheel-release/snapshots/${item.id}`} className="table-action">
          Evidence
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add release item modal                                              */
/* ------------------------------------------------------------------ */

interface AddItemModalProps {
  batchId: string;
  currency: string;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: FlywheelReleaseBatchDetail, title: string) => void;
}

function AddItemModal({ batchId, currency, candidates, onClose, onSaved }: AddItemModalProps) {
  const first = candidates[0];

  const [itemId, setItemId] = useState(first?.allocationItemId ?? "");
  const [amount, setAmount] = useState(() =>
    first ? String(first.remainingReleaseAuthorityAmount) : "0",
  );
  const [errors, setErrors] = useState<Partial<Record<ItemField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.allocationItemId === itemId);
  const remaining = selected?.remainingReleaseAuthorityAmount ?? 0;

  function clearError(field: ItemField) {
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

    const candidate = candidates.find((current) => current.allocationItemId === id);

    if (candidate) {
      setAmount(String(candidate.remainingReleaseAuthorityAmount));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<ItemField, string>> = {};

    if (!itemId || !selected) {
      next.item = "Select an allocation item.";
    }

    const problem = numberError(amount, { min: 0.01, max: remaining });

    if (problem) {
      next.amount = problem;
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await addFlywheelReleaseItem(batchId, {
        allocationItemId: itemId,
        plannedReleaseAmount: Number(amount),
      });

      onSaved(updated, selected ? selected.lineageNumber : "Release item");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add release item.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Authorized allocation items"
      title="Add release item"
      description="Choose an authorized Step 68 allocation item and the amount to release in this batch."
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
            form="release-item-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add release item"}
          </button>
        </>
      }
    >
      <form id="release-item-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Allocation item" htmlFor="release-allocation" error={errors.item}>
              <select
                id="release-allocation"
                className="kit-field-input"
                value={itemId}
                aria-invalid={errors.item ? true : undefined}
                onChange={(event) => handleSelect(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.allocationItemId} value={candidate.allocationItemId}>
                    {candidate.rootTargetInitiativeTitle} — {candidate.lineageNumber} — remaining{" "}
                    {money(candidate.remainingReleaseAuthorityAmount, currency)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <NumberField
              id="release-planned"
              label={`Planned release (${currency})`}
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
          </div>

          <div className="kit-pair-wide">
            <p className="kit-meta-line">
              Remaining release authority for this item: {money(remaining, currency)}
            </p>
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
/* Record release modal                                                */
/* ------------------------------------------------------------------ */

interface ExecuteModalProps {
  item: ReleaseItem;
  currency: string;
  onClose: () => void;
  onSaved: (updated: FlywheelReleaseBatchDetail, title: string) => void;
}

function ExecuteModal({ item, currency, onClose, onSaved }: ExecuteModalProps) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ExecuteField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: ExecuteField) {
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

    const next: Partial<Record<ExecuteField, string>> = {};

    if (!reference.trim()) {
      next.reference = "Enter the execution reference.";
    }

    if (!note.trim()) {
      next.note = "Describe the execution evidence.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await executeFlywheelReleaseItem(item.id, {
        executionReference: reference.trim(),
        executionNote: note.trim(),
      });

      onSaved(updated, item.lineageNumber);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record release execution.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Execution evidence"
      title="Record release"
      description={`${item.lineageNumber} — ${money(item.plannedReleaseAmount, currency)} planned.`}
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
            form="release-execute-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record release"}
          </button>
        </>
      }
    >
      <form id="release-execute-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Execution reference" htmlFor="execute-reference" error={errors.reference}>
              <input
                id="execute-reference"
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

          <div className="kit-pair-wide">
            <Field label="Execution evidence note" htmlFor="execute-note" error={errors.note}>
              <textarea
                id="execute-note"
                className="kit-field-input"
                rows={5}
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

        <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
          Once a release is recorded, the batch can no longer be cancelled.
        </p>

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

interface BatchData {
  id: string;
  detail: FlywheelReleaseBatchDetail;
}

export default function FlywheelReleaseBatchPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canExecute = user !== null && EXECUTE_ROLES.includes(user.role);

  const [result, setResult] = useState<BatchData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [executing, setExecuting] = useState<ReleaseItem | null>(null);
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
        const response = await getFlywheelReleaseBatch(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load release batch.");
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

  function applyDetail(updated: FlywheelReleaseBatchDetail) {
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
        <Link href="/flywheel-release" className="request-back-link">
          <ArrowLeft size={16} />
          Capital release
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

  const { batch, mandateAuthority: authority, candidates, items, snapshots } = detail;
  const currency = batch.currency;
  const status = String(batch.status);
  const draft = status === "DRAFT";
  const inExecution = status === "IN_EXECUTION";
  const executed = status === "EXECUTED";
  const allFinal = batch.itemCount > 0 && batch.pendingCount === 0;
  const hasReleased = batch.releasedCount > 0;
  const canFinalizeBatch = allFinal && hasReleased;
  const canCancelBatch = canExecute && (draft || inExecution) && batch.releasedCount === 0;
  const busyAny = flowRunning || rationaleRunning;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "SUBMIT") {
        applyDetail(await submitFlywheelReleaseForExecution(params.id));
      } else {
        await captureFlywheelReleaseSnapshot(params.id);

        reload();
      }

      setFlow(null);

      toast.success(FLOWS[action].done, batch.releaseNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the release batch.",
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
    const copy = rationaleCopy(request, batch);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, copy.subject);
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

  function handleItemAdded(updated: FlywheelReleaseBatchDetail, title: string) {
    applyDetail(updated);
    setAddingItem(false);
    toast.success("Release item added", title);
  }

  function handleReleased(updated: FlywheelReleaseBatchDetail, title: string) {
    applyDetail(updated);
    setExecuting(null);
    toast.success("Release recorded", title);
  }

  const orderedItems = [...items].sort((a, b) => {
    const rank = itemRank(String(a.status)) - itemRank(String(b.status));

    if (rank !== 0) {
      return rank;
    }

    return b.plannedReleaseAmount - a.plannedReleaseAmount;
  });

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, batch) : null;

  const batchReleasePct =
    batch.batchPlannedReleaseAmount > 0
      ? (batch.batchReleasedAmount / batch.batchPlannedReleaseAmount) * 100
      : null;

  const kpis: KpiItem[] = [
    {
      label: "Mandate authority",
      icon: WalletCards,
      value: money(batch.mandateAuthorizedAmount, currency),
      note: "Authorized by Step 68",
    },
    {
      label: "Batch planned",
      icon: Coins,
      value: money(batch.batchPlannedReleaseAmount, currency),
      note: `${batch.itemCount} release ${batch.itemCount === 1 ? "item" : "items"}`,
    },
    {
      label: "Batch released",
      icon: BadgeCheck,
      value: money(batch.batchReleasedAmount, currency),
      note: `${batch.releasedCount} released, ${batch.pendingCount} pending`,
    },
    {
      label: "Cumulative released",
      icon: Coins,
      value: money(batch.cumulativeMandateReleasedAmount, currency),
      note: "Across all batches",
    },
    {
      label: "Remaining mandate",
      icon: WalletCards,
      value: money(batch.remainingMandateAmount, currency),
      note: "Still available to release",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${batch.cumulativeReleaseUtilizationPct.toFixed(1)}%`,
      note: "Of the mandate",
    },
  ];

  const itemColumns = buildItemColumns({
    currency,
    canAct: canExecute && inExecution,
    busy: busyAny,
    onRelease: (item) => setExecuting(item),
    onCancel: (item) => openRationale({ kind: "CANCEL_ITEM", item }),
  });

  const snapshotColumns = buildSnapshotColumns();

  return (
    <div className="page-stack">
      <Link href="/flywheel-release" className="request-back-link">
        <ArrowLeft size={16} />
        Capital release
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{batch.releaseNumber}</span>

            <BatchBadge status={status} />
          </div>

          <span className="eyebrow">Controlled release execution</span>

          <h1>{batch.title}</h1>

          <p>
            {currency}
            {" · FY "}
            {batch.fiscalYear}
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
                  ? "No allocation item has remaining release authority"
                  : undefined
              }
              onClick={() => setAddingItem(true)}
            >
              <Plus size={15} />
              Add release item
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || batch.itemCount === 0}
              title={batch.itemCount === 0 ? "Add at least one release item first" : undefined}
              onClick={() => setFlow("SUBMIT")}
            >
              <FileCheck2 size={16} />
              Submit for execution
            </button>
          ) : null}

          {canExecute && inExecution ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !canFinalizeBatch}
              title={
                canFinalizeBatch
                  ? undefined
                  : "Every item needs a final status, with at least one release recorded"
              }
              onClick={() => openRationale({ kind: "FINALIZE" })}
            >
              <BadgeCheck size={16} />
              Mark batch executed
            </button>
          ) : null}

          {canExecute && executed ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close batch
            </button>
          ) : null}

          {canCancelBatch ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CANCEL_BATCH" })}
            >
              <XCircle size={15} />
              Cancel batch
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

      {draft && canManage && candidates.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No more allocation items can be added.</strong> No additional Step 68 allocation
            item has remaining release authority for this batch.
          </div>
        </div>
      ) : null}

      {draft && canManage && candidates.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {items.length === 0 ? (
              <>
                <strong>Next step: add a release item.</strong> Choose an authorized allocation item
                and the amount to release.
              </>
            ) : (
              <>
                <strong>Submit for execution when the plan is complete.</strong> Submission checks
                the authorized Step 68 mandate and cumulative release usage again.
              </>
            )}
          </div>
        </div>
      ) : null}

      {inExecution && batch.pendingCount > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {batch.pendingCount} release {batch.pendingCount === 1 ? "item is" : "items are"}{" "}
              awaiting execution.
            </strong>{" "}
            {canExecute
              ? "Record the release or cancel each pending item."
              : "A procurement manager or administrator needs to record the releases."}
          </div>
        </div>
      ) : null}

      {inExecution && allFinal && hasReleased && canExecute ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Every item has a final status.</strong> Mark the batch executed to confirm the
            releases.
          </div>
        </div>
      ) : null}

      {inExecution && allFinal && !hasReleased ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No release was recorded.</strong> Every item was cancelled, so the batch cannot
            be marked executed. A manager can cancel the batch instead.
          </div>
        </div>
      ) : null}

      {executed && canExecute ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The batch is executed.</strong> Close it to finish the release lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Release summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Release against the mandate</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={batch.cumulativeReleaseUtilizationPct}
          tone="primary"
          caption={`${money(batch.cumulativeMandateReleasedAmount, currency)} of ${money(batch.mandateAuthorizedAmount, currency)} released across all batches (${batch.cumulativeReleaseUtilizationPct.toFixed(1)}%)`}
          label="Cumulative release against the mandate"
        />

        {batchReleasePct !== null ? (
          <ProgressLine
            pct={batchReleasePct}
            tone={batchReleasePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`${money(batch.batchReleasedAmount, currency)} of ${money(batch.batchPlannedReleaseAmount, currency)} planned has been released in this batch`}
            label="Batch release against the plan"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Step 68 execution authority</span>

            <h2>Authorized mandate</h2>
          </div>

          <WalletCards size={19} />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>Mandate</span>

            <strong>{authority.allocationMandateNumber}</strong>
          </div>

          <div>
            <span>Strategy</span>

            <strong>{authority.strategyPortfolioNumber}</strong>
          </div>

          <div>
            <span>Mandate owner</span>

            <strong>{authority.mandateOwnerName}</strong>
          </div>

          <div>
            <span>Release owner</span>

            <strong>{batch.releaseOwnerName}</strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>Release rationale</span>

            <p>{batch.releaseRationale}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Execution evidence</span>

            <h2>Release items</h2>
          </div>

          {canManage && draft && candidates.length > 0 ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingItem(true)}
            >
              <Plus size={15} />
              Add release item
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Release items"
          busy={fetching}
          empty={
            <EmptyState
              icon={Coins}
              title="No release items"
              description="No release item has been added."
              action={
                canManage && draft && candidates.length > 0 ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingItem(true)}
                  >
                    <Plus size={15} />
                    Add release item
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

            <h2>Release snapshots</h2>
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
          ariaLabel="Release snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No release snapshot has been captured yet."
            />
          }
        />
      </section>

      {status === "CANCELLED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Release lifecycle</span>

              <h2>Batch cancelled</h2>
            </div>

            <XCircle size={19} />
          </div>

          {batch.closeNote ? <p>{batch.closeNote}</p> : null}

          <p className="kit-meta-line">
            No release was recorded by this batch. Its evidence remains available.
          </p>
        </section>
      ) : null}

      {status === "CLOSED" && batch.closeNote ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Release lifecycle</span>

              <h2>Release batch closed</h2>
            </div>

            <BadgeCheck size={19} />
          </div>

          <p>{batch.closeNote}</p>
        </section>
      ) : null}

      {addingItem ? (
        <AddItemModal
          batchId={params.id}
          currency={currency}
          candidates={candidates}
          onClose={() => setAddingItem(false)}
          onSaved={handleItemAdded}
        />
      ) : null}

      {executing !== null ? (
        <ExecuteModal
          item={executing}
          currency={currency}
          onClose={() => setExecuting(null)}
          onSaved={handleReleased}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, batch)}
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
