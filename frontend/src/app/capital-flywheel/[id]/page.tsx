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
  RefreshCcw,
  RefreshCw,
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  appendCapitalFlywheelCycle,
  closeCapitalFlywheelLineage,
  getCapitalFlywheelLineage,
  reviewCapitalFlywheelLineage,
} from "@/lib/api";
import type {
  CapitalFlywheelLineageDetail,
  CapitalFlywheelReviewDecision,
} from "@/types/capital-flywheel";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Lineage = CapitalFlywheelLineageDetail["lineage"];
type Candidate = CapitalFlywheelLineageDetail["availableCandidates"][number];
type FlywheelCycle = CapitalFlywheelLineageDetail["cycles"][number];
type Review = CapitalFlywheelLineageDetail["reviews"][number];

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

function LineageBadge({ status }: { status: string }) {
  switch (status) {
    case "READY_FOR_REVIEW":
      return <StatusBadge value="READY" label="Ready for review" />;

    case "APPROVED_FOR_NEXT_CYCLE":
      return <StatusBadge value="APPROVED" label="Approved for next cycle" />;

    case "STOPPED":
      return <StatusBadge value="TERMINATED" label="Stopped" />;

    default:
      return <StatusBadge value={status} label={readable(status)} />;
  }
}

function HealthBadge({ health }: { health: string }) {
  const upper = health.toUpperCase();

  if (
    upper.includes("DIMIN") ||
    upper.includes("DECLIN") ||
    upper.includes("WEAK") ||
    upper.includes("WATCH")
  ) {
    return <StatusBadge value="AT_RISK" label={readable(health)} />;
  }

  if (
    upper.includes("EXHAUST") ||
    upper.includes("STOP") ||
    upper.includes("POOR") ||
    upper.includes("DEPLET")
  ) {
    return <StatusBadge value="OFF_TRACK" label={readable(health)} />;
  }

  return <StatusBadge value={health} label={readable(health)} />;
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  switch (recommendation) {
    case "CONTINUE":
      return <StatusBadge value="ON_TRACK" label="Continue" />;

    case "HOLD":
      return <StatusBadge value="AT_RISK" label="Hold" />;

    case "STOP":
      return <StatusBadge value="OFF_TRACK" label="Stop" />;

    default:
      return <StatusBadge value={recommendation} label={readable(recommendation)} />;
  }
}

function ReviewBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "CONTINUE_APPROVED":
      return <StatusBadge value="APPROVED" label="Next cycle approved" />;

    case "STOPPED":
      return <StatusBadge value="TERMINATED" label="Stopped" />;

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

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildCycleColumns(currency: string): Column<FlywheelCycle>[] {
  return [
    {
      id: "cycle",
      header: "Cycle",
      align: "right",
      sortValue: (cycle) => cycle.cycleIndex,
      cell: (cycle) => <strong>#{cycle.cycleIndex}</strong>,
    },
    {
      id: "initiative",
      header: "Initiative",
      sortValue: (cycle) => cycle.targetInitiativeTitle.toLowerCase(),
      cell: (cycle) => (
        <div className="request-primary-cell">
          <strong>{cycle.targetInitiativeTitle}</strong>

          <span>{cycle.persistenceCaseNumber}</span>
        </div>
      ),
    },
    {
      id: "year",
      header: "Fiscal year",
      sortValue: (cycle) => cycle.fiscalYear,
      cell: (cycle) => cycle.fiscalYear,
    },
    {
      id: "capital",
      header: "Capital",
      align: "right",
      sortValue: (cycle) => cycle.redeployedCapitalAmount,
      cell: (cycle) => money(cycle.redeployedCapitalAmount, currency),
    },
    {
      id: "net",
      header: "Projected net",
      align: "right",
      sortValue: (cycle) => cycle.projectedNetValueAmount,
      cell: (cycle) => money(cycle.projectedNetValueAmount, currency),
    },
    {
      id: "roi",
      header: "ROI",
      align: "right",
      sortValue: (cycle) => cycle.projectedRoiPct,
      cell: (cycle) => `${cycle.projectedRoiPct.toFixed(1)}%`,
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (cycle) => cycle.valuePersistencePct,
      cell: (cycle) => `${cycle.valuePersistencePct.toFixed(1)}%`,
    },
    {
      id: "efficiency",
      header: "Efficiency",
      align: "right",
      sortValue: (cycle) => cycle.efficiencyRetentionPct,
      cell: (cycle) => `${cycle.efficiencyRetentionPct.toFixed(1)}%`,
    },
    {
      id: "compounding",
      header: "Compounding",
      align: "right",
      sortValue: (cycle) => cycle.compoundingValueAmount,
      cell: (cycle) => money(cycle.compoundingValueAmount, currency),
    },
    {
      id: "decay",
      header: "Decay",
      align: "right",
      sortValue: (cycle) => cycle.decayedValueAmount,
      cell: (cycle) => money(cycle.decayedValueAmount, currency),
    },
    {
      id: "evidence",
      header: <span className="kit-sr-only">Evidence</span>,
      align: "right",
      cell: (cycle) => (
        <Link href={`/reinvestment-persistence/${cycle.persistenceCaseId}`} className="table-action">
          Evidence
        </Link>
      ),
    },
  ];
}

function buildReviewColumns(): Column<Review>[] {
  return [
    {
      id: "decision",
      header: "Decision",
      sortValue: (review) => String(review.decision),
      cell: (review) => (
        <div className="kit-cell-stack">
          <ReviewBadge decision={String(review.decision)} />

          {review.overrideFlag ? (
            <small className="kit-cell-flag">HOLD recommendation overridden</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "recommendation",
      header: "Recommendation",
      sortValue: (review) => String(review.recommendation),
      cell: (review) => <RecommendationBadge recommendation={String(review.recommendation)} />,
    },
    {
      id: "cycle",
      header: "Cycle",
      align: "right",
      sortValue: (review) => review.cycleCount,
      cell: (review) => review.cycleCount,
    },
    {
      id: "health",
      header: "Health",
      sortValue: (review) => String(review.flywheelHealth),
      cell: (review) => <HealthBadge health={String(review.flywheelHealth)} />,
    },
    {
      id: "value",
      header: "Value multiple",
      align: "right",
      sortValue: (review) => review.cumulativeValueMultiple,
      cell: (review) => `${review.cumulativeValueMultiple.toFixed(2)}x`,
    },
    {
      id: "marginal",
      header: "Marginal multiple",
      align: "right",
      sortValue: (review) => review.latestMarginalValueMultiple,
      cell: (review) => `${review.latestMarginalValueMultiple.toFixed(2)}x`,
    },
    {
      id: "retention",
      header: "Marginal retention",
      align: "right",
      sortValue: (review) => review.latestMarginalNetValueRetentionPct,
      cell: (review) => `${review.latestMarginalNetValueRetentionPct.toFixed(1)}%`,
    },
    {
      id: "efficiency",
      header: "Efficiency",
      align: "right",
      sortValue: (review) => review.latestCycleEfficiencyRetentionPct,
      cell: (review) => `${review.latestCycleEfficiencyRetentionPct.toFixed(1)}%`,
    },
    {
      id: "note",
      header: "Rationale",
      cell: (review) => <span>{review.decisionNote}</span>,
    },
    {
      id: "reviewed",
      header: "Reviewed",
      sortValue: (review) => review.reviewedAt,
      cell: (review) => (
        <div className="kit-cell-stack">
          <span>{formatDateTime(review.reviewedAt)}</span>

          <small>{review.reviewedByName}</small>
        </div>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Append cycle modal                                                  */
/* ------------------------------------------------------------------ */

interface AppendModalProps {
  lineageId: string;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: CapitalFlywheelLineageDetail, title: string) => void;
}

function AppendCycleModal({ lineageId, candidates, onClose, onSaved }: AppendModalProps) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.persistenceCaseId ?? "");
  const [rationale, setRationale] = useState("");
  const [candidateError, setCandidateError] = useState<string | undefined>(undefined);
  const [rationaleError, setRationaleError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.persistenceCaseId === candidateId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    let invalid = false;

    if (!candidateId || !selected) {
      setCandidateError("Select a sustained Step 65 outcome.");
      invalid = true;
    }

    if (!rationale.trim()) {
      setRationaleError("A relationship rationale is required.");
      invalid = true;
    }

    if (invalid) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await appendCapitalFlywheelCycle(lineageId, {
        persistenceCaseId: candidateId,
        relationshipRationale: rationale.trim(),
      });

      onSaved(updated, selected ? selected.targetInitiativeTitle : "Recycling cycle");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to append flywheel cycle.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Approved next-cycle authority"
      title="Append recycling cycle"
      description="Add a sustained Step 65 outcome as the next immutable cycle of this lineage."
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
            form="flywheel-append-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Appending…" : "Append immutable cycle"}
          </button>
        </>
      }
    >
      <form id="flywheel-append-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field
              label="Sustained Step 65 outcome"
              htmlFor="flywheel-candidate"
              error={candidateError}
            >
              <select
                id="flywheel-candidate"
                className="kit-field-input"
                value={candidateId}
                aria-invalid={candidateError ? true : undefined}
                onChange={(event) => {
                  setCandidateId(event.target.value);
                  setCandidateError(undefined);
                }}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.persistenceCaseId} value={candidate.persistenceCaseId}>
                    {candidate.persistenceCaseNumber} — {candidate.targetInitiativeTitle} · net{" "}
                    {money(candidate.projectedNetValueAmount, candidate.currency)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Capital-lineage relationship rationale"
              htmlFor="flywheel-relationship"
              error={rationaleError}
            >
              <textarea
                id="flywheel-relationship"
                className="kit-field-input"
                rows={5}
                maxLength={5000}
                value={rationale}
                aria-invalid={rationaleError ? true : undefined}
                onChange={(event) => {
                  setRationale(event.target.value);
                  setRationaleError(undefined);
                }}
              />
            </Field>
          </div>
        </div>

        <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
          A cycle is immutable once appended. It cannot be edited or removed.
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
/* Review modal                                                        */
/* ------------------------------------------------------------------ */

interface ReviewModalProps {
  lineageId: string;
  lineage: Lineage;
  onClose: () => void;
  onSaved: (updated: CapitalFlywheelLineageDetail, label: string) => void;
}

function ReviewModal({ lineageId, lineage, onClose, onSaved }: ReviewModalProps) {
  const recommendation = String(lineage.recommendation);

  const [decision, setDecision] = useState<CapitalFlywheelReviewDecision>(
    recommendation === "STOP" ? "STOPPED" : "CONTINUE_APPROVED",
  );
  const [note, setNote] = useState("");
  const [decisionError, setDecisionError] = useState<string | undefined>(undefined);
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const continuing = String(decision) === "CONTINUE_APPROVED";
  const overridesHold = continuing && recommendation === "HOLD";
  const againstContinue = !continuing && recommendation === "CONTINUE";
  const cyclesExhausted = continuing && lineage.cycleCount >= lineage.maximumCycleCount;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    let invalid = false;

    if (continuing && recommendation === "STOP") {
      setDecisionError("A STOP recommendation cannot be overridden. Choose Stop lineage.");
      invalid = true;
    }

    if (!note.trim()) {
      setNoteError("A decision rationale is required.");
      invalid = true;
    }

    if (invalid) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await reviewCapitalFlywheelLineage(lineageId, {
        decision,
        decisionNote: note.trim(),
      });

      onSaved(updated, continuing ? "Next cycle approved" : "Lineage stopped");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record flywheel review.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Economic continuation review"
      title="Govern next recycling cycle"
      description={`Deterministic recommendation: ${readable(recommendation)}. Health: ${readable(String(lineage.flywheelHealth))}.`}
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
            form="flywheel-review-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record flywheel decision"}
          </button>
        </>
      }
    >
      <form id="flywheel-review-form" onSubmit={handleSubmit} noValidate>
        <p className="kit-meta-line" style={{ marginBottom: 12 }}>
          Cumulative value {lineage.cumulativeValueMultiple.toFixed(2)}x · marginal value{" "}
          {lineage.latestMarginalValueMultiple.toFixed(2)}x · cycle {lineage.cycleCount} of{" "}
          {lineage.maximumCycleCount}
        </p>

        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Governance decision" htmlFor="flywheel-decision" error={decisionError}>
              <select
                id="flywheel-decision"
                className="kit-field-input"
                value={decision}
                aria-invalid={decisionError ? true : undefined}
                onChange={(event) => {
                  setDecision(event.target.value as CapitalFlywheelReviewDecision);
                  setDecisionError(undefined);
                }}
              >
                <option value="CONTINUE_APPROVED">Approve next cycle</option>

                <option value="STOPPED">Stop lineage</option>
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Decision rationale" htmlFor="flywheel-note" error={noteError}>
              <textarea
                id="flywheel-note"
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

        {overridesHold ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The recommendation is HOLD. Approving another cycle is an explicit override and is
            permanently recorded.
          </p>
        ) : null}

        {againstContinue ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The recommendation is CONTINUE. Stopping goes against it, so the rationale should
            explain why.
          </p>
        ) : null}

        {cyclesExhausted ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This lineage has already used all {lineage.maximumCycleCount} of its cycles, so no
            further cycle can be appended.
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

interface LineageData {
  id: string;
  detail: CapitalFlywheelLineageDetail;
}

export default function CapitalFlywheelLineagePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<LineageData | null>(null);
  const [appending, setAppending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeRunning, setCloseRunning] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
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
        const response = await getCapitalFlywheelLineage(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load capital-flywheel lineage.",
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

  function applyDetail(updated: CapitalFlywheelLineageDetail) {
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
        <Link href="/capital-flywheel" className="request-back-link">
          <ArrowLeft size={16} />
          Capital flywheel
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

  const { lineage, availableCandidates, cycles, reviews } = detail;
  const currency = lineage.currency;
  const status = String(lineage.status);
  const recommendation = String(lineage.recommendation);
  const approvedForNext = status === "APPROVED_FOR_NEXT_CYCLE";
  const readyForReview = status === "READY_FOR_REVIEW";
  const stopped = status === "STOPPED";
  const cyclesLeft = lineage.cycleCount < lineage.maximumCycleCount;
  const canAppend = canManage && approvedForNext && cyclesLeft;
  const hasCandidates = availableCandidates.length > 0;

  async function confirmClose(note: string) {
    setCloseRunning(true);
    setCloseError(null);

    try {
      applyDetail(await closeCapitalFlywheelLineage(params.id, note.trim()));

      setClosing(false);

      toast.success("Capital lineage closed", lineage.lineageNumber);
    } catch (caught) {
      setCloseError(caught instanceof Error ? caught.message : "Unable to close capital lineage.");
    } finally {
      setCloseRunning(false);
    }
  }

  function handleAppended(updated: CapitalFlywheelLineageDetail, title: string) {
    applyDetail(updated);
    setAppending(false);
    toast.success("Cycle appended", title);
  }

  function handleReviewed(updated: CapitalFlywheelLineageDetail, label: string) {
    applyDetail(updated);
    setReviewing(false);
    toast.success("Flywheel decision recorded", label);
  }

  const orderedCycles = [...cycles].sort((a, b) => a.cycleIndex - b.cycleIndex);
  const orderedReviews = [...reviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  const latestCycle = orderedCycles.length > 0 ? orderedCycles[orderedCycles.length - 1] : null;

  const marginalOk =
    lineage.latestMarginalValueMultiple >= lineage.minimumMarginalValueMultiple;
  const efficiencyOk =
    latestCycle !== null &&
    latestCycle.efficiencyRetentionPct >= lineage.minimumCycleEfficiencyRetentionPct;

  const summaryKpis: KpiItem[] = [
    {
      label: "Cumulative value multiple",
      icon: TrendingUp,
      value: `${lineage.cumulativeValueMultiple.toFixed(2)}x`,
      note: "Across all cycles",
    },
    {
      label: "Latest marginal multiple",
      icon: Gauge,
      value: `${lineage.latestMarginalValueMultiple.toFixed(2)}x`,
      note: `Minimum ${lineage.minimumMarginalValueMultiple.toFixed(2)}x`,
      tone: marginalOk ? "default" : "warning",
    },
    {
      label: "Marginal retention",
      icon: TrendingDown,
      value: `${lineage.latestMarginalNetValueRetentionPct.toFixed(1)}%`,
      note: "Of net value",
    },
    {
      label: "Cycles",
      icon: RefreshCcw,
      value: `${lineage.cycleCount} / ${lineage.maximumCycleCount}`,
      note: cyclesLeft ? "Cycles remaining" : "Maximum reached",
    },
    {
      label: "Recommendation",
      icon: BadgeCheck,
      value: readable(recommendation),
      note: "Deterministic",
    },
    {
      label: "Diminishing returns",
      icon: AlertTriangle,
      value: lineage.diminishingReturns ? "Detected" : "No",
      note: `Tolerance ${lineage.diminishingReturnTolerancePct.toFixed(1)}%`,
      tone: lineage.diminishingReturns ? "warning" : "default",
    },
  ];

  const valueKpis: KpiItem[] = [
    {
      label: "Original capital",
      icon: WalletCards,
      value: money(lineage.originalCapitalAmount, currency),
      note: "First cycle",
    },
    {
      label: "Cumulative projected net value",
      icon: Coins,
      value: money(lineage.cumulativeProjectedNetValueAmount, currency),
      note: "Projected",
    },
    {
      label: "Cumulative compounding",
      icon: TrendingUp,
      value: money(lineage.cumulativeCompoundingValueAmount, currency),
      note: "Compounded value",
    },
    {
      label: "Cumulative decay",
      icon: TrendingDown,
      value: money(lineage.cumulativeDecayedValueAmount, currency),
      note: "Decayed value",
      tone: lineage.cumulativeDecayedValueAmount > 0 ? "warning" : "default",
    },
  ];

  const cycleColumns = buildCycleColumns(currency);
  const reviewColumns = buildReviewColumns();

  return (
    <div className="page-stack">
      <Link href="/capital-flywheel" className="request-back-link">
        <ArrowLeft size={16} />
        Capital flywheel
      </Link>

      <section className="flywheel-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{lineage.lineageNumber}</span>

            <LineageBadge status={status} />

            <HealthBadge health={String(lineage.flywheelHealth)} />
          </div>

          <span className="eyebrow">Multi-cycle capital lineage</span>

          <h1>{lineage.rootTargetInitiativeTitle}</h1>

          <p>
            Original capital {money(lineage.originalCapitalAmount, currency)}
            {" · "}
            {lineage.lineageOwnerName}
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

          {canAppend ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={closeRunning || !hasCandidates}
              title={
                hasCandidates ? undefined : "No sustained Step 65 outcome is available to append"
              }
              onClick={() => setAppending(true)}
            >
              <Plus size={15} />
              Append cycle
            </button>
          ) : null}

          {canFinalize && readyForReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={closeRunning}
              onClick={() => setReviewing(true)}
            >
              <BadgeCheck size={16} />
              Record flywheel decision
            </button>
          ) : null}

          {canFinalize && stopped ? (
            <button
              type="button"
              className="button button--primary"
              disabled={closeRunning}
              onClick={() => {
                setCloseError(null);
                setClosing(true);
              }}
            >
              Close lineage
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

      {lineage.diminishingReturns ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Diminishing returns detected.</strong> Each further cycle is adding less value
            than the one before.
          </div>
        </div>
      ) : null}

      {readyForReview && canFinalize ? (
        <div
          className={
            recommendation === "CONTINUE"
              ? "kit-callout kit-callout--info"
              : "kit-callout kit-callout--warning"
          }
          role="status"
        >
          {recommendation === "CONTINUE" ? <Info size={17} /> : <AlertTriangle size={17} />}

          <div>
            {recommendation === "CONTINUE" ? (
              <>
                <strong>The recommendation is CONTINUE.</strong> Marginal value and efficiency
                remain strong. Record the decision to govern the next cycle.
              </>
            ) : null}

            {recommendation === "HOLD" ? (
              <>
                <strong>The recommendation is HOLD.</strong> Approving another cycle is an explicit
                override that is permanently recorded.
              </>
            ) : null}

            {recommendation === "STOP" ? (
              <>
                <strong>The recommendation is STOP.</strong> It cannot be overridden, so the only
                available decision is to stop the lineage.
              </>
            ) : null}

            {recommendation !== "CONTINUE" &&
            recommendation !== "HOLD" &&
            recommendation !== "STOP" ? (
              <>
                <strong>Ready for review.</strong> Record the decision to govern the next cycle.
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {readyForReview && !canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting economic review.</strong> A procurement manager or administrator needs
            to record the continuation decision.
          </div>
        </div>
      ) : null}

      {approvedForNext && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {!cyclesLeft ? (
              <>
                <strong>The maximum number of cycles has been reached.</strong> No further cycle can
                be appended to this lineage.
              </>
            ) : hasCandidates ? (
              <>
                <strong>The next cycle is approved.</strong> Append a sustained Step 65 outcome to
                continue the lineage.
              </>
            ) : (
              <>
                <strong>The next cycle is approved.</strong> No sustained Step 65 outcome is
                available to append yet.
              </>
            )}
          </div>
        </div>
      ) : null}

      {stopped && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The lineage is stopped.</strong> Close it to finish the capital lineage.
          </div>
        </div>
      ) : null}

      <KpiGrid items={summaryKpis} ariaLabel="Flywheel summary" />

      <KpiGrid items={valueKpis} ariaLabel="Cumulative value" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Against the continuation thresholds</h2>
          </div>

          <Gauge size={19} />
        </div>

        {lineage.maximumCycleCount > 0 ? (
          <ProgressLine
            pct={(lineage.cycleCount / lineage.maximumCycleCount) * 100}
            tone="primary"
            caption={`${lineage.cycleCount} of ${lineage.maximumCycleCount} cycles used`}
            label="Cycles used"
          />
        ) : null}

        {lineage.minimumMarginalValueMultiple > 0 ? (
          <ProgressLine
            pct={(lineage.latestMarginalValueMultiple / lineage.minimumMarginalValueMultiple) * 100}
            tone={marginalOk ? meterToneFor("success") : "primary"}
            caption={`Latest marginal multiple ${lineage.latestMarginalValueMultiple.toFixed(2)}x against a minimum of ${lineage.minimumMarginalValueMultiple.toFixed(2)}x`}
            label="Marginal value multiple against the minimum"
          />
        ) : null}

        {latestCycle !== null ? (
          <ProgressLine
            pct={latestCycle.efficiencyRetentionPct}
            tone={efficiencyOk ? meterToneFor("success") : "primary"}
            caption={`Latest cycle efficiency retention ${latestCycle.efficiencyRetentionPct.toFixed(1)}% against a minimum of ${lineage.minimumCycleEfficiencyRetentionPct.toFixed(1)}%`}
            label="Cycle efficiency retention against the minimum"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Flywheel policy</span>

            <h2>Economic continuation thresholds</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="flywheel-objective">{lineage.lineageObjective}</p>

        <div className="flywheel-context-grid">
          <div>
            <span>Owner</span>

            <strong>{lineage.lineageOwnerName}</strong>
          </div>

          <div>
            <span>Minimum marginal multiple</span>

            <strong>{lineage.minimumMarginalValueMultiple.toFixed(2)}x</strong>
          </div>

          <div>
            <span>Minimum efficiency retention</span>

            <strong>{lineage.minimumCycleEfficiencyRetentionPct.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Diminishing tolerance</span>

            <strong>{lineage.diminishingReturnTolerancePct.toFixed(1)}%</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable lineage evidence</span>

            <h2>Capital cycles</h2>
          </div>

          {canAppend && hasCandidates ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAppending(true)}
            >
              <Plus size={15} />
              Append cycle
            </button>
          ) : (
            <RefreshCcw size={19} />
          )}
        </div>

        <DataTable
          columns={cycleColumns}
          rows={orderedCycles}
          getRowId={(cycle) => String(cycle.id)}
          ariaLabel="Capital cycles"
          busy={fetching}
          empty={
            <EmptyState
              icon={RefreshCcw}
              title="No cycles"
              description="No capital cycle has been recorded for this lineage."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable continuation decisions</span>

            <h2>Review history</h2>
          </div>

          {canFinalize && readyForReview ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setReviewing(true)}
            >
              <BadgeCheck size={15} />
              Record decision
            </button>
          ) : (
            <BadgeCheck size={19} />
          )}
        </div>

        <DataTable
          columns={reviewColumns}
          rows={orderedReviews}
          getRowId={(review) => String(review.id)}
          ariaLabel="Review history"
          busy={fetching}
          empty={
            <EmptyState
              icon={BadgeCheck}
              title="No reviews"
              description="No capital-flywheel review has been recorded."
            />
          }
        />
      </section>

      <section className="flywheel-method-note">
        <Goal size={18} />

        <div>
          <strong>Another cycle requires explicit economic governance</strong>

          <p>
            CONTINUE is deterministic when marginal value and efficiency remain strong. HOLD can be
            explicitly overridden by a manager and that override is permanently recorded. STOP
            cannot be overridden.
          </p>
        </div>
      </section>

      {appending ? (
        <AppendCycleModal
          lineageId={params.id}
          candidates={availableCandidates}
          onClose={() => setAppending(false)}
          onSaved={handleAppended}
        />
      ) : null}

      {reviewing ? (
        <ReviewModal
          lineageId={params.id}
          lineage={lineage}
          onClose={() => setReviewing(false)}
          onSaved={handleReviewed}
        />
      ) : null}

      {closing ? (
        <RationaleDialog
          eyebrow="Lineage closure"
          title="Close capital lineage"
          description={`${lineage.lineageNumber} was stopped. Closing it finishes the capital lineage.`}
          label="Closure note"
          placeholder="Summarise why this lineage can be closed."
          confirmLabel="Close lineage"
          busyLabel="Closing…"
          tone="primary"
          maxLength={5000}
          busy={closeRunning}
          error={closeError}
          onConfirm={(note) => void confirmClose(note)}
          onCancel={() => setClosing(false)}
        />
      ) : null}
    </div>
  );
}
