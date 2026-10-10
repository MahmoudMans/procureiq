"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  Gauge,
  Goal,
  Info,
  Plus,
  Recycle,
  RefreshCw,
  Target,
  TrendingUp,
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
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  closeCapitalRecyclingSource,
  createCapitalReinvestmentProposal,
  decideCapitalReinvestmentProposal,
  getCapitalRecyclingSource,
} from "@/lib/api";
import type { CapitalRecyclingSourceDetail } from "@/types/capital-recycling";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Source = CapitalRecyclingSourceDetail["source"];
type Target = CapitalRecyclingSourceDetail["targets"][number];
type Proposal = CapitalRecyclingSourceDetail["proposals"][number];
type ProposeField = "target" | "amount" | "rationale";

type RationaleRequest =
  | { kind: "CLOSE" }
  | { kind: "APPROVE"; proposal: Proposal }
  | { kind: "REJECT"; proposal: Proposal };

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

function decisionRank(proposal: Proposal): number {
  return proposal.decision === null ? 0 : 1;
}

function SourceBadge({ status }: { status: string }) {
  if (status === "FULLY_ALLOCATED") {
    return <StatusBadge value="COMPLETED" label="Fully allocated" />;
  }

  return <StatusBadge value={status} />;
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (decision === null) {
    return <StatusBadge value="PENDING" label="Awaiting decision" />;
  }

  if (decision === "APPROVED") {
    return <StatusBadge value="APPROVED" label="Approved" />;
  }

  if (decision === "REJECTED") {
    return <StatusBadge value="REJECTED" label="Rejected" />;
  }

  return <StatusBadge value={decision} label={readable(decision)} />;
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

function rationaleCopy(request: RationaleRequest, source: Source): RationaleCopy {
  switch (request.kind) {
    case "CLOSE":
      return {
        eyebrow: "Source closure",
        title: "Close recycling source",
        description: `${source.sourceNumber} is fully allocated. Closing it finishes the recycling lifecycle.`,
        label: "Closure note",
        placeholder: "Summarise why this source can be closed.",
        confirm: "Close recycling source",
        busy: "Closing…",
        tone: "primary",
        done: "Recycling source closed",
        subject: source.sourceNumber,
      };

    case "APPROVE":
      return {
        eyebrow: "Governance decision",
        title: "Approve reinvestment",
        description: `${money(request.proposal.requestedReinvestmentAmount, source.currency)} of recyclable capital will be reserved for ${request.proposal.targetInitiativeTitle}. Approval does not create a new funding release.`,
        label: "Governance decision note",
        placeholder: "Why is this reinvestment approved?",
        confirm: "Approve reinvestment",
        busy: "Approving…",
        tone: "primary",
        done: "Reinvestment approved",
        subject: request.proposal.targetInitiativeTitle,
      };

    case "REJECT":
      return {
        eyebrow: "Governance decision",
        title: "Reject reinvestment",
        description: `The proposal to reinvest ${money(request.proposal.requestedReinvestmentAmount, source.currency)} in ${request.proposal.targetInitiativeTitle} will be rejected. The capital stays available for another proposal.`,
        label: "Governance decision note",
        placeholder: "Why is this reinvestment rejected?",
        confirm: "Reject reinvestment",
        busy: "Rejecting…",
        cancelLabel: "Keep proposal",
        tone: "danger",
        done: "Reinvestment rejected",
        subject: request.proposal.targetInitiativeTitle,
      };
  }
}

function performRationale(
  request: RationaleRequest,
  sourceId: string,
  note: string,
): Promise<CapitalRecyclingSourceDetail> {
  switch (request.kind) {
    case "CLOSE":
      return closeCapitalRecyclingSource(sourceId, note);

    case "APPROVE":
      return decideCapitalReinvestmentProposal(request.proposal.id, {
        decision: "APPROVED",
        decisionNote: note,
      });

    case "REJECT":
      return decideCapitalReinvestmentProposal(request.proposal.id, {
        decision: "REJECTED",
        decisionNote: note,
      });
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildTargetColumns(): Column<Target>[] {
  return [
    {
      id: "target",
      header: "Target",
      sortValue: (item) => item.initiativeTitle.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.initiativeTitle}</strong>

          <span>{item.valueCaseNumber}</span>
        </div>
      ),
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.valueHealth),
      cell: (item) => (
        <StatusBadge
          value={String(item.valueHealth)}
          label={readable(String(item.valueHealth))}
        />
      ),
    },
    {
      id: "roi",
      header: "ROI",
      align: "right",
      sortValue: (item) => item.roiPct,
      cell: (item) => `${item.roiPct.toFixed(1)}%`,
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (item) => item.persistencePct,
      cell: (item) => `${item.persistencePct.toFixed(1)}%`,
    },
    {
      id: "net",
      header: "Net value",
      align: "right",
      sortValue: (item) => item.netValueAmount,
      cell: (item) => money(item.netValueAmount, item.currency),
    },
    {
      id: "preferred",
      header: "Preferred",
      sortValue: (item) => (item.preferredTarget ? 0 : 1),
      cell: (item) =>
        item.preferredTarget ? (
          <StatusBadge value="RECOMMENDED" label="Step 60 target" />
        ) : (
          <span className="kit-text-muted">No</span>
        ),
    },
    {
      id: "link",
      header: <span className="kit-sr-only">Value case</span>,
      align: "right",
      cell: (item) => (
        <Link href={`/strategic-value/${item.valueCaseId}`} className="table-action">
          Value case
        </Link>
      ),
    },
  ];
}

interface ProposalColumnOptions {
  currency: string;
  canDecide: boolean;
  busy: boolean;
  onApprove: (proposal: Proposal) => void;
  onReject: (proposal: Proposal) => void;
}

function buildProposalColumns(options: ProposalColumnOptions): Column<Proposal>[] {
  const { currency } = options;

  return [
    {
      id: "target",
      header: "Target",
      sortValue: (item) => item.targetInitiativeTitle.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.targetInitiativeTitle}</strong>

          <span>{item.targetValueCaseNumber}</span>
        </div>
      ),
    },
    {
      id: "requested",
      header: "Requested",
      align: "right",
      sortValue: (item) => item.requestedReinvestmentAmount,
      cell: (item) => <strong>{money(item.requestedReinvestmentAmount, currency)}</strong>,
    },
    {
      id: "roi",
      header: "ROI",
      align: "right",
      sortValue: (item) => item.targetRoiPctSnapshot,
      cell: (item) => `${item.targetRoiPctSnapshot.toFixed(1)}%`,
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (item) => item.targetPersistencePctSnapshot,
      cell: (item) => `${item.targetPersistencePctSnapshot.toFixed(1)}%`,
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.targetValueHealthSnapshot),
      cell: (item) => (
        <StatusBadge
          value={String(item.targetValueHealthSnapshot)}
          label={readable(String(item.targetValueHealthSnapshot))}
        />
      ),
    },
    {
      id: "net",
      header: "Net value",
      align: "right",
      sortValue: (item) => item.targetNetValueSnapshot,
      cell: (item) => money(item.targetNetValueSnapshot, currency),
    },
    {
      id: "rationale",
      header: "Rationale",
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{item.proposalRationale}</span>

          <small>
            Available at proposal: {money(item.sourceAvailableCapitalSnapshot, currency)} ·{" "}
            {item.proposedByName}
          </small>
        </div>
      ),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => decisionRank(item),
      cell: (item) =>
        item.decision ? (
          <div className="kit-cell-stack">
            <DecisionBadge decision={String(item.decision.decision)} />

            <span>{item.decision.decisionNote}</span>

            <small>
              {item.decision.decidedByName} · {formatDateTime(item.decision.decidedAt)}
            </small>
          </div>
        ) : (
          <DecisionBadge decision={null} />
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 210,
      cell: (item) =>
        options.canDecide && item.decision === null ? (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onApprove(item)}
            >
              <BadgeCheck size={14} />
              Approve
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onReject(item)}
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>
        ) : null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Propose reinvestment modal                                          */
/* ------------------------------------------------------------------ */

interface ProposeModalProps {
  sourceId: string;
  source: Source;
  targets: Target[];
  onClose: () => void;
  onSaved: (updated: CapitalRecyclingSourceDetail, title: string) => void;
}

function ProposeModal({ sourceId, source, targets, onClose, onSaved }: ProposeModalProps) {
  const preferred = targets.find((target) => target.preferredTarget);

  const [targetId, setTargetId] = useState((preferred ?? targets[0])?.valueCaseId ?? "");
  const [amount, setAmount] = useState(() => String(source.availableCapitalAmount));
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ProposeField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = targets.find((target) => target.valueCaseId === targetId);
  const amountValid =
    numberError(amount, { min: 0.01, max: source.availableCapitalAmount }) === undefined;
  const offPreferred = selected !== undefined && !selected.preferredTarget && preferred !== undefined;
  const partial = amountValid && Number(amount) < source.availableCapitalAmount - 0.005;

  function clearError(field: ProposeField) {
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

    const next: Partial<Record<ProposeField, string>> = {};

    if (!targetId || !selected) {
      next.target = "Select a governed Step 56 target.";
    }

    const problem = numberError(amount, { min: 0.01, max: source.availableCapitalAmount });

    if (problem) {
      next.amount = problem;
    }

    if (!rationale.trim()) {
      next.rationale = "A proposal rationale is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await createCapitalReinvestmentProposal(sourceId, {
        targetValueCaseId: targetId,
        requestedReinvestmentAmount: Number(amount),
        proposalRationale: rationale.trim(),
      });

      onSaved(updated, selected ? selected.initiativeTitle : "Reinvestment proposal");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create reinvestment proposal.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Reinvestment proposal"
      title="Allocate recyclable capital"
      description="Propose reserving recyclable capital against a governed Step 56 target. A manager decides the proposal."
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
            form="recycling-propose-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Creating…" : "Create immutable proposal"}
          </button>
        </>
      }
    >
      <form id="recycling-propose-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Governed Step 56 target" htmlFor="recycling-target" error={errors.target}>
              <select
                id="recycling-target"
                className="kit-field-input"
                value={targetId}
                aria-invalid={errors.target ? true : undefined}
                onChange={(event) => {
                  setTargetId(event.target.value);
                  clearError("target");
                }}
              >
                {targets.map((target) => (
                  <option key={target.valueCaseId} value={target.valueCaseId}>
                    {target.preferredTarget ? "Preferred · " : ""}
                    {target.valueCaseNumber} — {target.initiativeTitle} · ROI{" "}
                    {target.roiPct.toFixed(1)}%
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <NumberField
              id="recycling-amount"
              label={`Reinvestment amount (${source.currency})`}
              min={0.01}
              max={source.availableCapitalAmount}
              step="0.01"
              value={amount}
              error={errors.amount}
              onChange={(value) => {
                setAmount(value);
                clearError("amount");
              }}
            />

            <p className="kit-meta-line">
              Available to reinvest: {money(source.availableCapitalAmount, source.currency)}
            </p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Proposal rationale" htmlFor="recycling-rationale" error={errors.rationale}>
              <textarea
                id="recycling-rationale"
                className="kit-field-input"
                rows={5}
                maxLength={5000}
                value={rationale}
                aria-invalid={errors.rationale ? true : undefined}
                onChange={(event) => {
                  setRationale(event.target.value);
                  clearError("rationale");
                }}
              />
            </Field>
          </div>
        </div>

        {offPreferred && preferred ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The Step 60 approved reallocation target is {preferred.valueCaseNumber}. This proposal
            targets a different value case, so the rationale should explain why.
          </p>
        ) : null}

        {partial ? (
          <p className="kit-meta-line" style={{ marginTop: 14 }}>
            This reserves only part of the available capital. The remaining{" "}
            {money(source.availableCapitalAmount - Number(amount), source.currency)} stays
            available for another proposal.
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

interface SourceData {
  id: string;
  detail: CapitalRecyclingSourceDetail;
}

export default function CapitalRecyclingSourcePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<SourceData | null>(null);
  const [proposing, setProposing] = useState(false);
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
        const response = await getCapitalRecyclingSource(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load capital-recycling source.",
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

  function applyDetail(updated: CapitalRecyclingSourceDetail) {
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
        <Link href="/capital-recycling" className="request-back-link">
          <ArrowLeft size={16} />
          Capital recycling
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

  const { source, targets, proposals } = detail;
  const currency = source.currency;
  const status = String(source.status);
  const open = status === "OPEN";
  const fullyAllocated = status === "FULLY_ALLOCATED";
  const pendingProposals = proposals.filter((proposal) => proposal.decision === null);
  const hasPending = pendingProposals.length > 0;
  const available = source.availableCapitalAmount;
  const canPropose = canManage && open && !hasPending && available > 0 && targets.length > 0;
  const fundingDrift =
    Math.abs(source.currentFundingRemainingAmount - source.fundingRemainingSnapshot) > 0.005;

  const proposeBlocked = hasPending
    ? "A proposal is already awaiting a decision"
    : available <= 0
      ? "No recyclable capital is available"
      : targets.length === 0
        ? "No eligible reinvestment target exists"
        : undefined;

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, source);

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

  function handleProposed(updated: CapitalRecyclingSourceDetail, title: string) {
    applyDetail(updated);
    setProposing(false);
    toast.success("Reinvestment proposal created", title);
  }

  const orderedProposals = [...proposals].sort((a, b) => decisionRank(a) - decisionRank(b));
  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, source) : null;
  const committed = source.approvedReinvestmentAmount + source.pendingReinvestmentAmount;

  const kpis: KpiItem[] = [
    {
      label: "Verified implementation",
      icon: WalletCards,
      value: money(source.verifiedImplementedCapitalAmount, currency),
      note: "Verified capital",
    },
    {
      label: "Recyclable",
      icon: Recycle,
      value: money(source.recyclableCapitalAmount, currency),
      note: "Eligible to reinvest",
    },
    {
      label: "Approved reinvestment",
      icon: BadgeCheck,
      value: money(source.approvedReinvestmentAmount, currency),
      note: "Reserved by approved proposals",
    },
    {
      label: "Pending",
      icon: Coins,
      value: money(source.pendingReinvestmentAmount, currency),
      note: hasPending
        ? `${pendingProposals.length} awaiting a decision`
        : "No proposal awaiting a decision",
    },
    {
      label: "Available",
      icon: TrendingUp,
      value: money(source.availableCapitalAmount, currency),
      note: "Still available to reinvest",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${source.utilizationPct.toFixed(1)}%`,
      note: "Of the recyclable capital",
    },
  ];

  const targetColumns = buildTargetColumns();

  const proposalColumns = buildProposalColumns({
    currency,
    canDecide: canFinalize,
    busy: rationaleRunning,
    onApprove: (proposal) => openRationale({ kind: "APPROVE", proposal }),
    onReject: (proposal) => openRationale({ kind: "REJECT", proposal }),
  });

  return (
    <div className="page-stack">
      <Link href="/capital-recycling" className="request-back-link">
        <ArrowLeft size={16} />
        Capital recycling
      </Link>

      <section className="recycling-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{source.sourceNumber}</span>

            <SourceBadge status={status} />
          </div>

          <span className="eyebrow">Governed recyclable capital</span>

          <h1>{source.sourceInitiativeTitle}</h1>

          <p>
            {source.executionNumber}
            {" · "}
            {source.fundingCommitmentNumber}
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

          {canManage && open ? (
            <button
              type="button"
              className="button button--primary"
              disabled={rationaleRunning || !canPropose}
              title={proposeBlocked}
              onClick={() => setProposing(true)}
            >
              <Plus size={16} />
              Propose reinvestment
            </button>
          ) : null}

          {canFinalize && fullyAllocated ? (
            <button
              type="button"
              className="button button--primary"
              disabled={rationaleRunning}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close source
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

      {fundingDrift ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Funding remaining has changed since this source was created.</strong> It was{" "}
            {money(source.fundingRemainingSnapshot, currency)} at the snapshot and is now{" "}
            {money(source.currentFundingRemainingAmount, currency)}.
          </div>
        </div>
      ) : null}

      {canPropose && proposals.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: propose a reinvestment.</strong> Choose a governed Step 56 target
            for the {money(available, currency)} that is available.
          </div>
        </div>
      ) : null}

      {open && canManage && !hasPending && available > 0 && targets.length === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No eligible reinvestment target exists.</strong> A proposal can be created once
            a governed Step 56 target is available.
          </div>
        </div>
      ) : null}

      {hasPending ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {pendingProposals.length}{" "}
              {pendingProposals.length === 1 ? "proposal is" : "proposals are"} awaiting a
              decision.
            </strong>{" "}
            {canFinalize
              ? "Use Approve or Reject on the row. A new proposal can be created once it is decided."
              : "A procurement manager or administrator needs to decide it."}
          </div>
        </div>
      ) : null}

      {fullyAllocated && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>All recyclable capital is allocated.</strong> Close the source to finish the
            recycling lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Recycling summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Recyclable capital allocated</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={source.utilizationPct}
          tone={source.utilizationPct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Utilization ${source.utilizationPct.toFixed(1)}% · ${money(source.approvedReinvestmentAmount, currency)} approved and ${money(source.pendingReinvestmentAmount, currency)} pending of ${money(source.recyclableCapitalAmount, currency)} recyclable`}
          label="Recyclable capital allocated"
        />

        {source.recyclableCapitalAmount > 0 ? (
          <ProgressLine
            pct={(committed / source.recyclableCapitalAmount) * 100}
            tone="primary"
            caption={`${money(committed, currency)} is approved or pending`}
            label="Approved or pending reinvestment"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Capital safety bridge</span>

            <h2>Recycling authority</h2>
          </div>

          <Recycle size={19} />
        </div>

        <p className="recycling-objective">{source.recyclingObjective}</p>

        <div className="recycling-context-grid">
          <div>
            <span>Source action</span>

            <strong>{readable(String(source.sourceAction))}</strong>
          </div>

          <div>
            <span>Funding snapshot</span>

            <strong>{money(source.fundingRemainingSnapshot, currency)}</strong>
          </div>

          <div>
            <span>Current funding remaining</span>

            <strong>{money(source.currentFundingRemainingAmount, currency)}</strong>
          </div>

          <div>
            <span>Owner</span>

            <strong>{source.sourceOwnerName}</strong>
          </div>
        </div>

        {source.preferredTargetValueCaseNumber ? (
          <div className="recycling-target-note">
            <strong>Step 60 approved reallocation target</strong>

            <p>
              {source.preferredTargetValueCaseNumber}
              {" — "}
              {source.preferredTargetInitiativeTitle}
            </p>
          </div>
        ) : null}
      </section>

      <div className="recycling-source-links">
        <Link href={`/intervention-execution/${source.executionCaseId}`} className="table-action">
          Step 61 execution evidence
        </Link>

        <Link href={`/funding-execution/${source.fundingCommitmentId}`} className="table-action">
          Step 58 funding evidence
        </Link>

        <Link href={`/strategic-value/${source.sourceValueCaseId}`} className="table-action">
          Source Step 56 value case
        </Link>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Target opportunities</span>

            <h2>Eligible reinvestment targets</h2>
          </div>

          <Target size={19} />
        </div>

        <DataTable
          columns={targetColumns}
          rows={targets}
          getRowId={(item) => String(item.valueCaseId)}
          ariaLabel="Eligible reinvestment targets"
          busy={fetching}
          empty={
            <EmptyState
              icon={Target}
              title="No eligible targets"
              description="No governed Step 56 target is currently eligible for reinvestment."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable governance history</span>

            <h2>Reinvestment proposals</h2>
          </div>

          {canPropose ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={rationaleRunning}
              onClick={() => setProposing(true)}
            >
              <Plus size={15} />
              Propose reinvestment
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        <DataTable
          columns={proposalColumns}
          rows={orderedProposals}
          getRowId={(item) => String(item.id)}
          ariaLabel="Reinvestment proposals"
          busy={fetching}
          empty={
            <EmptyState
              icon={Coins}
              title="No proposals"
              description="No reinvestment proposal has been created."
              action={
                canPropose ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setProposing(true)}
                  >
                    <Plus size={15} />
                    Propose reinvestment
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="recycling-method-note">
        <Goal size={18} />

        <div>
          <strong>Approved reinvestment does not create a new funding release</strong>

          <p>
            Step 62 reserves verified recyclable capital against a governed Step 56 target.
            Separate downstream funding authority is still required before capital can be
            released.
          </p>
        </div>
      </section>

      {proposing ? (
        <ProposeModal
          sourceId={params.id}
          source={source}
          targets={targets}
          onClose={() => setProposing(false)}
          onSaved={handleProposed}
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
