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
  Scale,
  Target,
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
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addFlywheelStrategyItem,
  approveFlywheelStrategyPortfolio,
  captureFlywheelStrategySnapshot,
  closeFlywheelStrategyPortfolio,
  decideFlywheelStrategyItem,
  getFlywheelStrategyPortfolio,
  submitFlywheelStrategyForReview,
} from "@/lib/api";
import type {
  FlywheelStrategyDecision,
  FlywheelStrategyPortfolioDetail,
} from "@/types/flywheel-strategy";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Portfolio = FlywheelStrategyPortfolioDetail["portfolio"];
type Candidate = FlywheelStrategyPortfolioDetail["candidates"][number];
type PortfolioItem = FlywheelStrategyPortfolioDetail["items"][number];
type PortfolioSnapshot = FlywheelStrategyPortfolioDetail["snapshots"][number];
type Flow = "SUBMIT" | "SNAPSHOT";
type LineageField = "lineage" | "capacity";
type RationaleRequest = { kind: "APPROVE" } | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const DECISIONS: { value: FlywheelStrategyDecision; label: string; hint: string }[] = [
  {
    value: "PRIORITIZE",
    label: "Prioritize",
    hint: "Commit capacity to this lineage. Prioritized capacity counts against the portfolio envelope and becomes available to Step 68 allocation mandates.",
  },
  {
    value: "HOLD",
    label: "Hold",
    hint: "Keep the lineage in the portfolio without committing capacity.",
  },
  {
    value: "EXIT",
    label: "Exit",
    hint: "Stop investing in this lineage. No capacity is committed.",
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

function knownDecision(value: string): FlywheelStrategyDecision | null {
  const found = DECISIONS.find((option) => option.value === value);

  return found ? found.value : null;
}

function decisionRank(item: PortfolioItem): number {
  return String(item.decision) === "PENDING" ? 0 : 1;
}

function PortfolioBadge({ status }: { status: string }) {
  return <StatusBadge value={status} label={readable(status)} />;
}

function DecisionBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "PRIORITIZE":
      return <StatusBadge value="APPROVED" label="Prioritize" />;

    case "HOLD":
      return <StatusBadge value="ON_HOLD" label="Hold" />;

    case "EXIT":
      return <StatusBadge value="REJECTED" label="Exit" />;

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
    eyebrow: "Freeze candidate set",
    title: "Submit for governance review?",
    confirm: "Submit for review",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for review",
    failed: "Could not submit the portfolio",
  },
  SNAPSHOT: {
    eyebrow: "Immutable evidence trail",
    title: "Capture a portfolio snapshot?",
    confirm: "Capture snapshot",
    busy: "Capturing…",
    keep: "Not yet",
    done: "Snapshot captured",
    failed: "Could not capture the snapshot",
  },
};

function flowDescription(flow: Flow, portfolio: Portfolio): string {
  switch (flow) {
    case "SUBMIT":
      return `${portfolio.portfolioNumber} will be frozen for governance review. At least two competing lineages are required, and current Step 66 authority is revalidated before it enters review.`;

    case "SNAPSHOT":
      return `The current state of ${portfolio.portfolioNumber} is recorded as an immutable snapshot.`;
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

function rationaleCopy(request: RationaleRequest, portfolio: Portfolio): RationaleCopy {
  switch (request.kind) {
    case "APPROVE":
      return {
        eyebrow: "Manager approval",
        title: "Approve allocation strategy",
        description: `${portfolio.portfolioNumber} will be approved with ${portfolio.prioritizeCount} prioritized ${portfolio.prioritizeCount === 1 ? "lineage" : "lineages"} (${money(portfolio.prioritizedCapacityAmount, portfolio.currency)} of ${money(portfolio.capitalCapacityAmount, portfolio.currency)}).`,
        label: "Approval rationale",
        placeholder: "Why is this allocation strategy approved?",
        confirm: "Approve portfolio",
        busy: "Approving…",
        done: "Portfolio approved",
      };

    case "CLOSE":
      return {
        eyebrow: "Governance lifecycle",
        title: "Close portfolio",
        description: `${portfolio.portfolioNumber} was approved. Closing it finishes the governance lifecycle.`,
        label: "Closure rationale",
        placeholder: "Summarise why this portfolio can be closed.",
        confirm: "Close portfolio",
        busy: "Closing…",
        done: "Portfolio closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  portfolioId: string,
  note: string,
): Promise<FlywheelStrategyPortfolioDetail> {
  switch (request.kind) {
    case "APPROVE":
      return approveFlywheelStrategyPortfolio(portfolioId, note);

    case "CLOSE":
      return closeFlywheelStrategyPortfolio(portfolioId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ItemColumnOptions {
  currency: string;
  canDecide: boolean;
  busy: boolean;
  onDecide: (item: PortfolioItem) => void;
}

function buildItemColumns(options: ItemColumnOptions): Column<PortfolioItem>[] {
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
      id: "proposed",
      header: "Proposed",
      align: "right",
      sortValue: (item) => item.proposedCapacityAmount,
      cell: (item) => money(item.proposedCapacityAmount, currency),
    },
    {
      id: "cumulative",
      header: "Cumulative",
      align: "right",
      sortValue: (item) => item.cumulativeValueMultiple,
      cell: (item) => `${item.cumulativeValueMultiple.toFixed(2)}x`,
    },
    {
      id: "marginal",
      header: "Marginal",
      align: "right",
      sortValue: (item) => item.latestMarginalValueMultiple,
      cell: (item) => `${item.latestMarginalValueMultiple.toFixed(2)}x`,
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (item) => item.priorityScore,
      cell: (item) => <strong>{item.priorityScore.toFixed(1)}</strong>,
    },
    {
      id: "advisory",
      header: "Advisory",
      sortValue: (item) => String(item.advisoryRecommendation),
      cell: (item) => <DecisionBadge decision={String(item.advisoryRecommendation)} />,
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => decisionRank(item),
      cell: (item) => (
        <div className="kit-cell-stack">
          <DecisionBadge decision={String(item.decision)} />

          {item.decisionNote ? <small>{item.decisionNote}</small> : null}

          {item.decidedByName ? <small>By {item.decidedByName}</small> : null}
        </div>
      ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 120,
      cell: (item) =>
        options.canDecide && String(item.decision) === "PENDING" ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onDecide(item)}
          >
            <BadgeCheck size={14} />
            Decide
          </button>
        ) : null,
    },
  ];
}

function buildSnapshotColumns(): Column<PortfolioSnapshot>[] {
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
      sortValue: (item) => String(item.portfolioStatus),
      cell: (item) => <PortfolioBadge status={String(item.portfolioStatus)} />,
    },
    {
      id: "prioritized",
      header: "Prioritized",
      align: "right",
      sortValue: (item) => item.prioritizedCapacityAmount,
      cell: (item) => money(item.prioritizedCapacityAmount, item.currency),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingCapacityAmount,
      cell: (item) => money(item.remainingCapacityAmount, item.currency),
    },
    {
      id: "utilization",
      header: "Utilization",
      align: "right",
      sortValue: (item) => item.capacityUtilizationPct,
      cell: (item) => `${item.capacityUtilizationPct.toFixed(1)}%`,
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
        <Link href={`/flywheel-strategy/snapshots/${item.id}`} className="table-action">
          Evidence
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add lineage modal                                                   */
/* ------------------------------------------------------------------ */

interface AddModalProps {
  portfolioId: string;
  portfolio: Portfolio;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: FlywheelStrategyPortfolioDetail, title: string) => void;
}

function AddLineageModal({ portfolioId, portfolio, candidates, onClose, onSaved }: AddModalProps) {
  const first = candidates[0];

  const [lineageId, setLineageId] = useState(first?.flywheelLineageId ?? "");
  const [capacity, setCapacity] = useState(() =>
    first ? String(first.referenceNextCycleCapitalAmount) : "0",
  );
  const [errors, setErrors] = useState<Partial<Record<LineageField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.flywheelLineageId === lineageId);
  const amountValid = numberError(capacity, { min: 0.01 }) === undefined;
  const aboveReference =
    amountValid &&
    selected !== undefined &&
    Number(capacity) > selected.referenceNextCycleCapitalAmount + 0.005;
  const aboveEnvelope = amountValid && Number(capacity) > portfolio.capitalCapacityAmount + 0.005;

  function clearError(field: LineageField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  function handleSelect(id: string) {
    setLineageId(id);
    clearError("lineage");
    clearError("capacity");

    const candidate = candidates.find((current) => current.flywheelLineageId === id);

    if (candidate) {
      setCapacity(String(candidate.referenceNextCycleCapitalAmount));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<LineageField, string>> = {};

    if (!lineageId || !selected) {
      next.lineage = "Select an eligible lineage.";
    }

    const problem = numberError(capacity, { min: 0.01 });

    if (problem) {
      next.capacity = problem;
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await addFlywheelStrategyItem(portfolioId, {
        flywheelLineageId: lineageId,
        proposedCapacityAmount: Number(capacity),
      });

      onSaved(updated, selected ? selected.rootTargetInitiativeTitle : "Lineage");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add flywheel lineage.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Approved Step 66 authority"
      title="Add competing lineage"
      description="Choose an eligible Step 66 lineage and the capacity to propose for it."
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
            form="strategy-lineage-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add lineage"}
          </button>
        </>
      }
    >
      <form id="strategy-lineage-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Eligible lineage" htmlFor="strategy-lineage" error={errors.lineage}>
              <select
                id="strategy-lineage"
                className="kit-field-input"
                value={lineageId}
                aria-invalid={errors.lineage ? true : undefined}
                onChange={(event) => handleSelect(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.flywheelLineageId} value={candidate.flywheelLineageId}>
                    {candidate.rootTargetInitiativeTitle} — {candidate.lineageNumber} — score{" "}
                    {candidate.priorityScore.toFixed(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <NumberField
              id="strategy-capacity"
              label={`Proposed capacity (${portfolio.currency})`}
              min={0.01}
              step="0.01"
              value={capacity}
              error={errors.capacity}
              onChange={(value) => {
                setCapacity(value);
                clearError("capacity");
              }}
            />

            {selected ? (
              <p className="kit-meta-line">
                Next-cycle capital on the lineage:{" "}
                {money(selected.referenceNextCycleCapitalAmount, portfolio.currency)}
              </p>
            ) : null}
          </div>
        </div>

        {aboveReference && selected ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The proposal is above the{" "}
            {money(selected.referenceNextCycleCapitalAmount, portfolio.currency)} of next-cycle
            capital that the lineage references.
          </p>
        ) : null}

        {aboveEnvelope ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The proposal is above the whole capacity envelope of{" "}
            {money(portfolio.capitalCapacityAmount, portfolio.currency)}, so it could never be
            prioritized.
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
  item: PortfolioItem;
  portfolio: Portfolio;
  onClose: () => void;
  onSaved: (updated: FlywheelStrategyPortfolioDetail, title: string, label: string) => void;
}

function DecisionModal({ item, portfolio, onClose, onSaved }: DecisionModalProps) {
  const advisory = knownDecision(String(item.advisoryRecommendation));

  const [decision, setDecision] = useState<FlywheelStrategyDecision>(advisory ?? "PRIORITIZE");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = DECISIONS.find((option) => option.value === decision);
  const differsFromAdvisory = advisory !== null && advisory !== decision;
  const exceedsCapacity =
    decision === "PRIORITIZE" &&
    item.proposedCapacityAmount > portfolio.remainingCapacityAmount + 0.005;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!note.trim()) {
      setNoteError("A governance rationale is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await decideFlywheelStrategyItem(item.id, {
        decision,
        decisionNote: note.trim(),
      });

      onSaved(updated, item.rootTargetInitiativeTitle, selected ? selected.label : "Decision");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record portfolio decision.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Human allocation authority"
      title="Portfolio decision"
      description={`${item.rootTargetInitiativeTitle} — proposing ${money(item.proposedCapacityAmount, portfolio.currency)}.`}
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
            form="strategy-decision-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record decision"}
          </button>
        </>
      }
    >
      <form id="strategy-decision-form" onSubmit={handleSubmit} noValidate>
        <p className="kit-meta-line" style={{ marginBottom: 12 }}>
          Advisory: {readable(String(item.advisoryRecommendation))} · Priority{" "}
          {item.priorityScore.toFixed(1)} · cumulative {item.cumulativeValueMultiple.toFixed(2)}x ·
          marginal {item.latestMarginalValueMultiple.toFixed(2)}x
        </p>

        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Decision" htmlFor="strategy-decision">
              <select
                id="strategy-decision"
                className="kit-field-input"
                value={decision}
                onChange={(event) => setDecision(event.target.value as FlywheelStrategyDecision)}
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
            <Field label="Governance rationale" htmlFor="strategy-rationale" error={noteError}>
              <textarea
                id="strategy-rationale"
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

        {differsFromAdvisory && advisory ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The advisory recommendation is {readable(advisory)}. This decision differs, so the
            rationale should explain why.
          </p>
        ) : null}

        {exceedsCapacity ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            Prioritizing this lineage would exceed the remaining capacity of{" "}
            {money(portfolio.remainingCapacityAmount, portfolio.currency)}.
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

interface PortfolioData {
  id: string;
  detail: FlywheelStrategyPortfolioDetail;
}

export default function FlywheelStrategyPortfolioPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<PortfolioData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
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
        const response = await getFlywheelStrategyPortfolio(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load flywheel strategy portfolio.",
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

  function applyDetail(updated: FlywheelStrategyPortfolioDetail) {
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
        <Link href="/flywheel-strategy" className="request-back-link">
          <ArrowLeft size={16} />
          Flywheel strategy
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

  const { portfolio, candidates, items, snapshots } = detail;
  const currency = portfolio.currency;
  const status = String(portfolio.status);
  const draft = status === "DRAFT";
  const inReview = status === "IN_REVIEW";
  const approved = status === "APPROVED";
  const busyAny = flowRunning || rationaleRunning;
  const canAddLineage = canManage && draft && candidates.length > 0;
  const allDecided = portfolio.itemCount > 0 && portfolio.pendingCount === 0;
  const hasPrioritized = portfolio.prioritizeCount > 0;
  const decidedCount = portfolio.itemCount - portfolio.pendingCount;
  const overCapacity = portfolio.remainingCapacityAmount < -0.005;

  const approveBlocked = !allDecided
    ? "Every lineage needs a decision first"
    : !hasPrioritized
      ? "At least one lineage must be prioritized"
      : undefined;

  const decisionTarget = items.find((item) => String(item.id) === deciding) ?? null;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "SUBMIT") {
        applyDetail(await submitFlywheelStrategyForReview(params.id));
      } else {
        await captureFlywheelStrategySnapshot(params.id);

        reload();
      }

      setFlow(null);

      toast.success(FLOWS[action].done, portfolio.portfolioNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the portfolio.",
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
    const copy = rationaleCopy(request, portfolio);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, portfolio.portfolioNumber);
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

  function handleAdded(updated: FlywheelStrategyPortfolioDetail, title: string) {
    applyDetail(updated);
    setAdding(false);
    toast.success("Lineage added", title);
  }

  function handleDecided(updated: FlywheelStrategyPortfolioDetail, title: string, label: string) {
    applyDetail(updated);
    setDeciding(null);
    toast.success(`Decision recorded: ${label}`, title);
  }

  const orderedItems = [...items].sort((a, b) => {
    const rank = decisionRank(a) - decisionRank(b);

    if (rank !== 0) {
      return rank;
    }

    return b.priorityScore - a.priorityScore;
  });

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, portfolio) : null;

  const kpis: KpiItem[] = [
    {
      label: "Capacity envelope",
      icon: WalletCards,
      value: money(portfolio.capitalCapacityAmount, currency),
      note: "Total capital capacity",
    },
    {
      label: "Prioritized",
      icon: Coins,
      value: money(portfolio.prioritizedCapacityAmount, currency),
      note: `${portfolio.prioritizeCount} prioritized ${portfolio.prioritizeCount === 1 ? "lineage" : "lineages"}`,
    },
    {
      label: "Remaining",
      icon: WalletCards,
      value: money(portfolio.remainingCapacityAmount, currency),
      note: "Still available",
      tone: overCapacity ? "warning" : "default",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${portfolio.capacityUtilizationPct.toFixed(1)}%`,
      note: "Of the envelope",
    },
    {
      label: "Average priority",
      icon: Target,
      value: portfolio.averagePriorityScore.toFixed(1),
      note: "Priority score",
    },
    {
      label: "Lineages",
      icon: Scale,
      value: String(portfolio.itemCount),
      note: inReview || approved ? `${portfolio.pendingCount} pending` : "Competing for capacity",
    },
  ];

  const itemColumns = buildItemColumns({
    currency,
    canDecide: canFinalize && inReview,
    busy: busyAny,
    onDecide: (item) => setDeciding(String(item.id)),
  });

  const snapshotColumns = buildSnapshotColumns();

  return (
    <div className="page-stack">
      <Link href="/flywheel-strategy" className="request-back-link">
        <ArrowLeft size={16} />
        Flywheel strategy
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{portfolio.portfolioNumber}</span>

            <PortfolioBadge status={status} />
          </div>

          <span className="eyebrow">Constrained capital portfolio</span>

          <h1>{portfolio.title}</h1>

          <p>
            {currency}
            {" · FY "}
            {portfolio.fiscalYear}
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

          {canAddLineage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add lineage
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || portfolio.itemCount < 2}
              title={
                portfolio.itemCount < 2
                  ? "At least two competing lineages are required"
                  : undefined
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
              disabled={busyAny || approveBlocked !== undefined}
              title={approveBlocked}
              onClick={() => openRationale({ kind: "APPROVE" })}
            >
              <BadgeCheck size={16} />
              Approve portfolio
            </button>
          ) : null}

          {canFinalize && approved ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close portfolio
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

      {overCapacity ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Prioritized capacity is above the envelope.</strong> It is{" "}
            {money(portfolio.prioritizedCapacityAmount, currency)} against{" "}
            {money(portfolio.capitalCapacityAmount, currency)}.
          </div>
        </div>
      ) : null}

      {draft && canManage && portfolio.itemCount < 2 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {candidates.length > 0 ? (
              <>
                <strong>Next step: add competing lineages.</strong> At least two are required before
                the portfolio can be submitted.
              </>
            ) : (
              <>
                <strong>Not enough eligible lineages.</strong> At least two compatible Step 66
                lineages are needed, and none more is available to add.
              </>
            )}
          </div>
        </div>
      ) : null}

      {draft && canManage && portfolio.itemCount >= 2 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Submit when the lineage set is final.</strong> Submission freezes it and
            revalidates the current Step 66 authority.
          </div>
        </div>
      ) : null}

      {inReview && portfolio.pendingCount > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {portfolio.pendingCount}{" "}
              {portfolio.pendingCount === 1 ? "lineage still needs" : "lineages still need"} a
              decision.
            </strong>{" "}
            {canFinalize
              ? "Use Decide on each row to prioritize, hold or exit it."
              : "A procurement manager or administrator needs to decide."}
          </div>
        </div>
      ) : null}

      {inReview && allDecided && !hasPrioritized ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No lineage is prioritized.</strong> The portfolio cannot be approved until at
            least one lineage is prioritized.
          </div>
        </div>
      ) : null}

      {inReview && allDecided && hasPrioritized && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Every lineage has a decision.</strong> Approve the portfolio to finish the
            governance review.
          </div>
        </div>
      ) : null}

      {approved && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The portfolio is approved.</strong> Close it when the governance lifecycle is
            finished.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Portfolio summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Capacity and decisions</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={portfolio.capacityUtilizationPct}
          tone="primary"
          caption={`${money(portfolio.prioritizedCapacityAmount, currency)} of ${money(portfolio.capitalCapacityAmount, currency)} prioritized (${portfolio.capacityUtilizationPct.toFixed(1)}%)`}
          label="Prioritized capacity against the envelope"
        />

        {!draft && portfolio.itemCount > 0 ? (
          <ProgressLine
            pct={(decidedCount / portfolio.itemCount) * 100}
            tone={portfolio.pendingCount === 0 ? meterToneFor("success") : "primary"}
            caption={`${decidedCount} of ${portfolio.itemCount} lineages have a decision`}
            label="Lineages with a decision"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Portfolio authority</span>

            <h2>Governance context</h2>
          </div>
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>Owner</span>

            <strong>{portfolio.portfolioOwnerName}</strong>
          </div>

          <div>
            <span>Fiscal year</span>

            <strong>{portfolio.fiscalYear}</strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>Strategic objective</span>

            <p>{portfolio.strategicObjective}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Human allocation authority</span>

            <h2>Portfolio lineages</h2>
          </div>

          {canAddLineage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add lineage
            </button>
          ) : (
            <Scale size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Portfolio lineages"
          busy={fetching}
          empty={
            <EmptyState
              icon={Scale}
              title="No lineages"
              description="No Step 66 lineage has been added to this portfolio."
              action={
                canAddLineage ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add lineage
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
            <span className="eyebrow">Immutable evidence trail</span>

            <h2>Portfolio snapshots</h2>
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
          ariaLabel="Portfolio snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No portfolio snapshot has been captured yet."
            />
          }
        />
      </section>

      {adding ? (
        <AddLineageModal
          portfolioId={params.id}
          portfolio={portfolio}
          candidates={candidates}
          onClose={() => setAdding(false)}
          onSaved={handleAdded}
        />
      ) : null}

      {decisionTarget !== null ? (
        <DecisionModal
          item={decisionTarget}
          portfolio={portfolio}
          onClose={() => setDeciding(null)}
          onSaved={handleDecided}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, portfolio)}
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
