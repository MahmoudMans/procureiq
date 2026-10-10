"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CircleAlert,
  Coins,
  FileCheck2,
  Gauge,
  Goal,
  Info,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
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
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addCapitalAllocationItem,
  approveCapitalAllocationCycle,
  captureCapitalAllocationSnapshot,
  closeCapitalAllocationCycle,
  decideCapitalAllocationItem,
  getCapitalAllocationCycle,
  removeCapitalAllocationItem,
  submitCapitalAllocationCycle,
} from "@/lib/api";
import type {
  CapitalAllocationCycleDetail,
  CapitalAllocationDecision,
} from "@/types/capital-allocation";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Cycle = CapitalAllocationCycleDetail["cycle"];
type Item = CapitalAllocationCycleDetail["items"][number];
type Candidate = CapitalAllocationCycleDetail["candidates"][number];
type AddField = "candidate" | "amount";

type ActionRequest =
  | { kind: "SUBMIT" }
  | { kind: "SNAPSHOT" }
  | { kind: "REMOVE"; item: Item };

type RationaleRequest = { kind: "APPROVE" } | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const DECIDE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const DECISIONS: { value: CapitalAllocationDecision; label: string; hint: string }[] = [
  {
    value: "FUND",
    label: "Fund",
    hint: "Commit capital from the cycle budget. The decision is rejected if it would breach the budget.",
  },
  {
    value: "DEFER",
    label: "Defer",
    hint: "Hold the candidate for a later cycle without committing capital.",
  },
  {
    value: "REJECT",
    label: "Reject",
    hint: "Decline the candidate. No capital is committed.",
  },
];

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function CycleBadge({ status }: { status: string }) {
  return <StatusBadge value={status} />;
}

function DecisionBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "FUND":
      return <StatusBadge value="APPROVED" label="Fund" />;

    case "DEFER":
      return <StatusBadge value="ON_HOLD" label="Defer" />;

    case "REJECT":
      return <StatusBadge value="REJECTED" label="Reject" />;

    case "PENDING":
      return <StatusBadge value="PENDING" label="Pending" />;

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

function initialDecision(item: Item): CapitalAllocationDecision {
  const current = String(item.decision);
  const advisory = String(item.recommendation);

  const pick =
    DECISIONS.find((option) => option.value === current) ??
    DECISIONS.find((option) => option.value === advisory);

  return pick ? pick.value : "FUND";
}

interface ActionCopy {
  eyebrow: string;
  title: string;
  description: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
  subject: string;
}

function actionCopy(request: ActionRequest, cycle: Cycle): ActionCopy {
  switch (request.kind) {
    case "SUBMIT":
      return {
        eyebrow: "Governance gate",
        title: "Submit for committee review?",
        description: `${cycle.cycleNumber} will be submitted for committee review. Submission freezes candidate membership and passes the cycle to managers for explicit investment decisions.`,
        confirm: "Submit for committee review",
        busy: "Submitting…",
        keep: "Not yet",
        done: "Submitted for committee review",
        failed: "Could not submit the cycle",
        subject: cycle.cycleNumber,
      };

    case "SNAPSHOT":
      return {
        eyebrow: "Immutable evidence",
        title: "Capture an investment-committee snapshot?",
        description: `The current state of ${cycle.cycleNumber} is recorded as an immutable snapshot.`,
        confirm: "Capture snapshot",
        busy: "Capturing…",
        keep: "Not yet",
        done: "Snapshot captured",
        failed: "Could not capture the snapshot",
        subject: cycle.cycleNumber,
      };

    case "REMOVE":
      return {
        eyebrow: "Candidate import",
        title: "Remove this candidate?",
        description: `${request.item.initiativeTitle} (${request.item.caseNumber}) will be removed from ${cycle.cycleNumber}. You can add it again while the cycle is a draft.`,
        confirm: "Remove candidate",
        busy: "Removing…",
        keep: "Keep candidate",
        done: "Candidate removed",
        failed: "Could not remove the candidate",
        subject: request.item.initiativeTitle,
      };
  }
}

async function performAction(
  request: ActionRequest,
  cycleId: string,
): Promise<CapitalAllocationCycleDetail | null> {
  switch (request.kind) {
    case "SUBMIT":
      return submitCapitalAllocationCycle(cycleId);

    case "SNAPSHOT":
      await captureCapitalAllocationSnapshot(cycleId);

      return null;

    case "REMOVE":
      return removeCapitalAllocationItem(request.item.id);
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

function rationaleCopy(request: RationaleRequest, cycle: Cycle): RationaleCopy {
  switch (request.kind) {
    case "APPROVE":
      return {
        eyebrow: "Committee governance",
        title: "Approve allocation",
        description: `${cycle.cycleNumber} will be approved with ${cycle.fundedItemCount} funded, ${cycle.deferredItemCount} deferred and ${cycle.rejectedItemCount} rejected.`,
        label: "Governance note",
        placeholder: "Why is this allocation ready to be approved?",
        confirm: "Approve allocation",
        busy: "Approving…",
        done: "Allocation approved",
      };

    case "CLOSE":
      return {
        eyebrow: "Committee governance",
        title: "Close allocation cycle",
        description: `${cycle.cycleNumber} was approved. Closing it finishes the allocation cycle.`,
        label: "Governance note",
        placeholder: "Summarise why this cycle can be closed.",
        confirm: "Close allocation cycle",
        busy: "Closing…",
        done: "Allocation cycle closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  cycleId: string,
  note: string,
): Promise<CapitalAllocationCycleDetail> {
  switch (request.kind) {
    case "APPROVE":
      return approveCapitalAllocationCycle(cycleId, note);

    case "CLOSE":
      return closeCapitalAllocationCycle(cycleId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ItemColumnOptions {
  currency: string;
  rankById: Map<string, number>;
  canRemove: boolean;
  canDecide: boolean;
  busy: boolean;
  onDecide: (item: Item) => void;
  onRemove: (item: Item) => void;
}

function buildItemColumns(options: ItemColumnOptions): Column<Item>[] {
  const { currency } = options;

  return [
    {
      id: "rank",
      header: "Rank",
      align: "right",
      sortValue: (item) => options.rankById.get(String(item.id)) ?? 0,
      cell: (item) => <strong>{options.rankById.get(String(item.id)) ?? "—"}</strong>,
    },
    {
      id: "candidate",
      header: "Candidate",
      sortValue: (item) => item.initiativeTitle.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.initiativeTitle}</strong>

          <span>{item.caseNumber}</span>
        </div>
      ),
    },
    {
      id: "request",
      header: "Request",
      align: "right",
      sortValue: (item) => item.requestedCapitalAmount,
      cell: (item) => money(item.requestedCapitalAmount, currency),
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (item) => item.priorityScore,
      cell: (item) => item.priorityScore.toFixed(1),
    },
    {
      id: "advisory",
      header: "Advisory",
      sortValue: (item) => String(item.recommendation),
      cell: (item) => <DecisionBadge decision={String(item.recommendation)} />,
    },
    {
      id: "roi",
      header: "ROI",
      align: "right",
      sortValue: (item) => item.roiPctSnapshot,
      cell: (item) => `${item.roiPctSnapshot.toFixed(1)}%`,
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (item) => item.persistencePctSnapshot,
      cell: (item) => `${item.persistencePctSnapshot.toFixed(1)}%`,
    },
    {
      id: "net",
      header: "Net value",
      align: "right",
      sortValue: (item) => item.netValueSnapshot,
      cell: (item) => money(item.netValueSnapshot, currency),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => (
        <div className="kit-cell-stack">
          <DecisionBadge decision={String(item.decision)} />

          {item.decisionNote ? <small>{item.decisionNote}</small> : null}
        </div>
      ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 130,
      cell: (item) => {
        if (options.canRemove) {
          return (
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onRemove(item)}
            >
              <Trash2 size={14} />
              Remove
            </button>
          );
        }

        if (options.canDecide) {
          return (
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onDecide(item)}
            >
              <BadgeCheck size={14} />
              {String(item.decision) === "PENDING" ? "Decide" : "Change"}
            </button>
          );
        }

        return null;
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add candidate modal                                                 */
/* ------------------------------------------------------------------ */

interface AddModalProps {
  cycleId: string;
  cycle: Cycle;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: CapitalAllocationCycleDetail, title: string) => void;
}

function AddCandidateModal({ cycleId, cycle, candidates, onClose, onSaved }: AddModalProps) {
  const first = candidates[0];

  const [candidateId, setCandidateId] = useState(first?.valueCaseId ?? "");
  const [amount, setAmount] = useState(() => (first ? String(first.investmentCostAmount) : "0"));
  const [errors, setErrors] = useState<Partial<Record<AddField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.valueCaseId === candidateId);
  const amountValid = numberError(amount, { min: 0.01 }) === undefined;
  const overBudget = amountValid && Number(amount) > cycle.budgetAmount + 0.005;

  function clearError(field: AddField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  function handleSelect(id: string) {
    setCandidateId(id);
    clearError("candidate");
    clearError("amount");

    const candidate = candidates.find((current) => current.valueCaseId === id);

    if (candidate) {
      setAmount(String(candidate.investmentCostAmount));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<AddField, string>> = {};

    if (!candidateId || !selected) {
      next.candidate = "Select a verified value case.";
    }

    const problem = numberError(amount, { min: 0.01 });

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
      const updated = await addCapitalAllocationItem(cycleId, {
        valueCaseId: candidateId,
        requestedCapitalAmount: Number(amount),
      });

      onSaved(updated, selected ? selected.initiativeTitle : "Candidate");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to add investment candidate.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Candidate import"
      title="Add verified value case"
      description="Choose a verified Step 56 value case and the capital to request for it."
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
            form="allocation-add-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add candidate"}
          </button>
        </>
      }
    >
      <form id="allocation-add-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field
              label="Verified Step 56 value case"
              htmlFor="allocation-candidate"
              error={errors.candidate}
            >
              <select
                id="allocation-candidate"
                className="kit-field-input"
                value={candidateId}
                aria-invalid={errors.candidate ? true : undefined}
                onChange={(event) => handleSelect(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.valueCaseId} value={candidate.valueCaseId}>
                    {candidate.caseNumber} — {candidate.initiativeTitle} · Priority{" "}
                    {candidate.priorityScore.toFixed(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <NumberField
              id="allocation-requested"
              label={`Requested capital (${cycle.currency})`}
              min={0.01}
              step="0.01"
              value={amount}
              error={errors.amount}
              onChange={(value) => {
                setAmount(value);
                clearError("amount");
              }}
            />
          </div>

          {selected ? (
            <div className="kit-pair-wide">
              <p className="kit-meta-line">
                Investment cost on the value case:{" "}
                {money(selected.investmentCostAmount, cycle.currency)}
              </p>
            </div>
          ) : null}
        </div>

        {overBudget ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The request is above the whole cycle budget of{" "}
            {money(cycle.budgetAmount, cycle.currency)}, so it could never be funded.
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
/* Decision modal                                                      */
/* ------------------------------------------------------------------ */

interface DecisionModalProps {
  item: Item;
  cycle: Cycle;
  onClose: () => void;
  onSaved: (updated: CapitalAllocationCycleDetail, title: string, label: string) => void;
}

function DecisionModal({ item, cycle, onClose, onSaved }: DecisionModalProps) {
  const [decision, setDecision] = useState<CapitalAllocationDecision>(() => initialDecision(item));
  const [note, setNote] = useState(item.decisionNote ?? "");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = DECISIONS.find((option) => option.value === decision);
  const differsFromAdvisory = String(decision) !== String(item.recommendation);
  const exceedsBudget =
    String(decision) === "FUND" &&
    String(item.decision) !== "FUND" &&
    item.requestedCapitalAmount > cycle.remainingBudgetAmount + 0.005;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!note.trim()) {
      setNoteError("An investment decision note is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await decideCapitalAllocationItem(item.id, {
        decision,
        decisionNote: note.trim(),
      });

      onSaved(updated, item.initiativeTitle, selected ? selected.label : "Decision");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record investment decision.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Investment committee"
      title="Allocation decision"
      description={`${item.initiativeTitle} — requesting ${money(item.requestedCapitalAmount, cycle.currency)}.`}
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
            form="allocation-decision-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record decision"}
          </button>
        </>
      }
    >
      <form id="allocation-decision-form" onSubmit={handleSubmit} noValidate>
        <p className="kit-meta-line" style={{ marginBottom: 12 }}>
          Advisory: {readable(String(item.recommendation))} · Priority{" "}
          {item.priorityScore.toFixed(1)} · ROI {item.roiPctSnapshot.toFixed(1)}%
        </p>

        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Decision" htmlFor="allocation-decision">
              <select
                id="allocation-decision"
                className="kit-field-input"
                value={decision}
                onChange={(event) => setDecision(event.target.value as CapitalAllocationDecision)}
              >
                {DECISIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {selected ? <p className="kit-meta-line">{selected.hint}</p> : null}
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Investment committee rationale"
              htmlFor="allocation-rationale"
              error={noteError}
            >
              <textarea
                id="allocation-rationale"
                className="kit-field-input"
                rows={5}
                maxLength={5000}
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

        {differsFromAdvisory ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The advisory recommendation is {readable(String(item.recommendation))}. This decision
            differs, so the rationale should explain why.
          </p>
        ) : null}

        {exceedsBudget ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            Funding this candidate would exceed the remaining budget of{" "}
            {money(cycle.remainingBudgetAmount, cycle.currency)}. A decision that breaches the
            cycle budget is rejected.
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

interface CycleData {
  id: string;
  detail: CapitalAllocationCycleDetail;
}

export default function CapitalAllocationCyclePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canDecide = user !== null && DECIDE_ROLES.includes(user.role);

  const [result, setResult] = useState<CycleData | null>(null);
  const [action, setAction] = useState<ActionRequest | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
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
        const response = await getCapitalAllocationCycle(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load allocation cycle.");
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

  function applyDetail(updated: CapitalAllocationCycleDetail) {
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
        <Link href="/capital-allocation" className="request-back-link">
          <ArrowLeft size={16} />
          Capital allocation
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

  const { cycle, candidates, items } = detail;
  const currency = cycle.currency;
  const status = String(cycle.status);
  const draft = status === "DRAFT";
  const inReview = status === "IN_REVIEW";
  const approved = status === "APPROVED";
  const busyAny = actionRunning || rationaleRunning;
  const decidedCount = items.length - cycle.pendingItemCount;
  const canAddCandidate = canManage && draft && candidates.length > 0;

  const decisionTarget = items.find((item) => String(item.id) === deciding) ?? null;

  async function confirmAction() {
    if (action === null) {
      return;
    }

    const request = action;
    const copy = actionCopy(request, cycle);

    setActionRunning(true);

    try {
      const updated = await performAction(request, params.id);

      if (updated !== null) {
        applyDetail(updated);
      }

      setAction(null);

      toast.success(copy.done, copy.subject);
    } catch (caught) {
      setAction(null);

      toast.error(
        copy.failed,
        caught instanceof Error ? caught.message : "Unable to update the allocation cycle.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, cycle);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, cycle.cycleNumber);
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

  function handleAdded(updated: CapitalAllocationCycleDetail, title: string) {
    applyDetail(updated);
    setAdding(false);
    toast.success("Candidate added", title);
  }

  function handleDecided(updated: CapitalAllocationCycleDetail, title: string, label: string) {
    applyDetail(updated);
    setDeciding(null);
    toast.success(`Decision recorded: ${label}`, title);
  }

  const rankById = new Map<string, number>(
    items.map((item, index) => [String(item.id), index + 1]),
  );

  const actionInfo = action !== null ? actionCopy(action, cycle) : null;
  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, cycle) : null;

  const kpis: KpiItem[] = [
    {
      label: "Budget",
      icon: WalletCards,
      value: money(cycle.budgetAmount, currency),
      note: "Cycle budget",
    },
    {
      label: "Funded",
      icon: Coins,
      value: money(cycle.fundedAmount, currency),
      note: `${cycle.fundedItemCount} funded`,
    },
    {
      label: "Remaining",
      icon: WalletCards,
      value: money(cycle.remainingBudgetAmount, currency),
      note: "Still available",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${cycle.budgetUtilizationPct.toFixed(1)}%`,
      note: "Of the budget",
    },
    {
      label: "Funded net value",
      icon: TrendingUp,
      value: money(cycle.fundedNetValueAmount, currency),
      note: "Across funded candidates",
    },
    {
      label: "Opportunity cost",
      icon: TrendingDown,
      value: money(cycle.opportunityCostAmount, currency),
      note: "Value not funded",
      tone: cycle.opportunityCostAmount > 0 ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns({
    currency,
    rankById,
    canRemove: canManage && draft,
    canDecide: canDecide && inReview,
    busy: busyAny,
    onDecide: (item) => setDeciding(String(item.id)),
    onRemove: (item) => setAction({ kind: "REMOVE", item }),
  });

  return (
    <div className="page-stack">
      <Link href="/capital-allocation" className="request-back-link">
        <ArrowLeft size={16} />
        Capital allocation
      </Link>

      <section className="allocation-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{cycle.cycleNumber}</span>

            <CycleBadge status={status} />
          </div>

          <span className="eyebrow">Governed capital-allocation cycle</span>

          <h1>{cycle.title}</h1>

          <p>
            {currency}
            {" · FY "}
            {cycle.fiscalYear}
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
              onClick={() => setAction({ kind: "SNAPSHOT" })}
            >
              <Camera size={15} />
              Capture snapshot
            </button>
          ) : null}

          {canAddCandidate ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add candidate
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || items.length === 0}
              title={items.length === 0 ? "Add at least one candidate first" : undefined}
              onClick={() => setAction({ kind: "SUBMIT" })}
            >
              <FileCheck2 size={16} />
              Submit for committee review
            </button>
          ) : null}

          {canDecide && inReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || cycle.pendingItemCount > 0}
              title={
                cycle.pendingItemCount > 0
                  ? "Every candidate needs a decision before the cycle can be approved"
                  : undefined
              }
              onClick={() => openRationale({ kind: "APPROVE" })}
            >
              <BadgeCheck size={16} />
              Approve allocation
            </button>
          ) : null}

          {canDecide && approved ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close cycle
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

      {draft && canManage && items.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {candidates.length > 0 ? (
              <>
                <strong>Next step: add a candidate.</strong> Choose a verified Step 56 value case
                and the capital to request.
              </>
            ) : (
              <>
                <strong>No verified value case is available.</strong> A candidate can be added once
                a Step 56 value case is verified.
              </>
            )}
          </div>
        </div>
      ) : null}

      {draft && canManage && items.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Submit when the candidate list is complete.</strong> Submission freezes
            candidate membership and passes the cycle to managers for investment decisions.
          </div>
        </div>
      ) : null}

      {inReview && cycle.pendingItemCount > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {cycle.pendingItemCount}{" "}
              {cycle.pendingItemCount === 1 ? "candidate still needs" : "candidates still need"} a
              decision.
            </strong>{" "}
            {canDecide
              ? "Use Decide on each row to fund, defer or reject it."
              : "A procurement manager or administrator needs to decide."}
          </div>
        </div>
      ) : null}

      {inReview && cycle.pendingItemCount === 0 && canDecide ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Every candidate has a decision.</strong> Approve the allocation to finish the
            committee review.
          </div>
        </div>
      ) : null}

      {approved && canDecide ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The allocation is approved.</strong> Close the cycle when allocation is
            complete.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Allocation summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Budget and decisions</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={cycle.budgetUtilizationPct}
          tone="primary"
          caption={`${money(cycle.fundedAmount, currency)} of ${money(cycle.budgetAmount, currency)} funded (${cycle.budgetUtilizationPct.toFixed(1)}%)`}
          label="Budget utilization"
        />

        {items.length > 0 ? (
          <ProgressLine
            pct={(decidedCount / items.length) * 100}
            tone={cycle.pendingItemCount === 0 ? meterToneFor("success") : "primary"}
            caption={`${decidedCount} of ${items.length} candidates have a decision`}
            label="Candidates with a decision"
          />
        ) : null}
      </section>

      <section className="panel allocation-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Allocation authority</span>

            <h2>Investment objective</h2>
          </div>

          <Goal size={19} />
        </div>

        <p>{cycle.objective}</p>

        <div className="allocation-cycle-signals">
          <div>
            <span>Average priority</span>

            <strong>{cycle.averagePriorityScore.toFixed(1)}</strong>
          </div>

          <div>
            <span>Funded</span>

            <strong>{cycle.fundedItemCount}</strong>
          </div>

          <div>
            <span>Deferred</span>

            <strong>{cycle.deferredItemCount}</strong>
          </div>

          <div>
            <span>Rejected</span>

            <strong>{cycle.rejectedItemCount}</strong>
          </div>

          <div>
            <span>Pending</span>

            <strong>{cycle.pendingItemCount}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Priority ranking</span>

            <h2>Investment candidates</h2>
          </div>

          {canAddCandidate ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add candidate
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={items}
          getRowId={(item) => String(item.id)}
          ariaLabel="Investment candidates"
          busy={fetching}
          empty={
            <EmptyState
              icon={Coins}
              title="No candidates"
              description="No verified value case has been added to this allocation cycle."
              action={
                canAddCandidate ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add candidate
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {cycle.approvalNote ? (
        <section className="allocation-approval-note">
          <strong>Approved investment allocation</strong>

          <p>{cycle.approvalNote}</p>

          <small>
            {cycle.approvedByName}
            {cycle.approvedAt ? ` · ${formatDateTime(cycle.approvedAt)}` : ""}
          </small>
        </section>
      ) : null}

      <section className="allocation-method-note">
        <Goal size={18} />

        <div>
          <strong>Budget enforcement is deterministic; allocation authority is human</strong>

          <p>
            A FUND decision is rejected when it would breach the governed cycle budget. Advisory
            ranking never creates funding automatically and never modifies Step 56 value evidence.
          </p>
        </div>
      </section>

      {adding ? (
        <AddCandidateModal
          cycleId={params.id}
          cycle={cycle}
          candidates={candidates}
          onClose={() => setAdding(false)}
          onSaved={handleAdded}
        />
      ) : null}

      {decisionTarget !== null ? (
        <DecisionModal
          item={decisionTarget}
          cycle={cycle}
          onClose={() => setDeciding(null)}
          onSaved={handleDecided}
        />
      ) : null}

      {action !== null && actionInfo !== null ? (
        <ActionDialog
          eyebrow={actionInfo.eyebrow}
          title={actionInfo.title}
          description={actionInfo.description}
          confirmLabel={actionInfo.confirm}
          busyLabel={actionInfo.busy}
          cancelLabel={actionInfo.keep}
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setAction(null)}
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
