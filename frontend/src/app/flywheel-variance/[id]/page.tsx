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
  SearchCheck,
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addFlywheelVarianceItem,
  approveFlywheelVariancePlan,
  captureFlywheelVarianceSnapshot,
  closeFlywheelVariancePlan,
  getFlywheelVariancePlan,
  submitFlywheelVarianceForReview,
} from "@/lib/api";
import type {
  FlywheelVarianceDecision,
  FlywheelVariancePlanDetail,
} from "@/types/flywheel-variance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Plan = FlywheelVariancePlanDetail["plan"];
type Candidate = FlywheelVariancePlanDetail["candidates"][number];
type VarianceItem = FlywheelVariancePlanDetail["items"][number];
type VarianceSnapshot = FlywheelVariancePlanDetail["snapshots"][number];
type Flow = "SUBMIT" | "SNAPSHOT";
type DecisionField = "item" | "date" | "rationale";
type RationaleRequest = { kind: "APPROVE" } | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const DECISIONS: { value: FlywheelVarianceDecision; label: string; hint: string }[] = [
  {
    value: "RECOVER",
    label: "Recover",
    hint: "Pursue recovery of the variance. Recovered amounts are recorded later as execution evidence.",
  },
  {
    value: "WRITE_OFF",
    label: "Write off",
    hint: "Accept the variance as a loss without recovering it.",
  },
  {
    value: "INVESTIGATE",
    label: "Investigate",
    hint: "Investigate the cause of the variance. Completing an investigation does not reduce the financial residual.",
  },
];

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

function PlanBadge({ status }: { status: string }) {
  return <StatusBadge value={status} label={readable(status)} />;
}

function TreatmentBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "RECOVER":
      return <StatusBadge value="ON_TRACK" label="Recover" />;

    case "WRITE_OFF":
      return <StatusBadge value="AT_RISK" label="Write off" />;

    case "INVESTIGATE":
      return <StatusBadge value="IN_REVIEW" label="Investigate" />;

    default:
      return <StatusBadge value={decision} label={readable(decision)} />;
  }
}

function SourceStatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();

  if (upper.includes("UNRESOLVED") || upper.includes("UNSETTLED")) {
    return <StatusBadge value="OFF_TRACK" label={readable(status)} />;
  }

  if (upper.includes("PARTIAL")) {
    return <StatusBadge value="PENDING" label={readable(status)} />;
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
    eyebrow: "100% coverage gate",
    title: "Submit for approval review?",
    confirm: "Submit for review",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for review",
    failed: "Could not submit the plan",
  },
  SNAPSHOT: {
    eyebrow: "Immutable variance evidence",
    title: "Capture a variance snapshot?",
    confirm: "Capture snapshot",
    busy: "Capturing…",
    keep: "Not yet",
    done: "Snapshot captured",
    failed: "Could not capture the snapshot",
  },
};

function flowDescription(flow: Flow, plan: Plan): string {
  switch (flow) {
    case "SUBMIT":
      return `${plan.planNumber} will be submitted for manager review. Every positive settlement variance has a governed treatment, and decisions can no longer be added while it is under review.`;

    case "SNAPSHOT":
      return `The current state of ${plan.planNumber} is recorded as an immutable snapshot.`;
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

function rationaleCopy(request: RationaleRequest, plan: Plan): RationaleCopy {
  switch (request.kind) {
    case "APPROVE":
      return {
        eyebrow: "Manager treatment authority",
        title: "Approve variance plan",
        description: `${plan.planNumber} governs ${money(plan.governedAmount, plan.currency)}: ${money(plan.recoverAmount, plan.currency)} to recover, ${money(plan.writeOffAmount, plan.currency)} to write off and ${money(plan.investigationAmount, plan.currency)} to investigate.`,
        label: "Approval rationale",
        placeholder: "Why are these treatments approved?",
        confirm: "Approve plan",
        busy: "Approving…",
        done: "Variance plan approved",
      };

    case "CLOSE":
      return {
        eyebrow: "Governance lifecycle",
        title: "Close variance plan",
        description: `${plan.planNumber} was approved. Closing it finishes the governance lifecycle.`,
        label: "Closure rationale",
        placeholder: "Summarise why this plan can be closed.",
        confirm: "Close plan",
        busy: "Closing…",
        done: "Variance plan closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  planId: string,
  note: string,
): Promise<FlywheelVariancePlanDetail> {
  switch (request.kind) {
    case "APPROVE":
      return approveFlywheelVariancePlan(planId, note);

    case "CLOSE":
      return closeFlywheelVariancePlan(planId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildItemColumns(currency: string): Column<VarianceItem>[] {
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
      id: "source",
      header: "Source status",
      sortValue: (item) => String(item.sourceReconciliationStatus),
      cell: (item) => <SourceStatusBadge status={String(item.sourceReconciliationStatus)} />,
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      sortValue: (item) => item.sourceVarianceAmount,
      cell: (item) => money(item.sourceVarianceAmount, currency),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => <TreatmentBadge decision={String(item.decision)} />,
    },
    {
      id: "target",
      header: "Target",
      sortValue: (item) => item.targetDate ?? null,
      cell: (item) => showDate(item.targetDate),
    },
    {
      id: "rationale",
      header: "Rationale",
      cell: (item) => <span>{item.decisionRationale}</span>,
    },
    {
      id: "by",
      header: "Added by",
      sortValue: (item) => (item.addedByName ?? "").toLowerCase(),
      cell: (item) => item.addedByName ?? <span className="kit-text-muted">—</span>,
    },
  ];
}

function buildSnapshotColumns(): Column<VarianceSnapshot>[] {
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
      sortValue: (item) => String(item.planStatus),
      cell: (item) => <PlanBadge status={String(item.planStatus)} />,
    },
    {
      id: "recovery",
      header: "Recovery",
      align: "right",
      sortValue: (item) => item.recoverAmount,
      cell: (item) => money(item.recoverAmount, item.currency),
    },
    {
      id: "writeOff",
      header: "Write-off",
      align: "right",
      sortValue: (item) => item.writeOffAmount,
      cell: (item) => money(item.writeOffAmount, item.currency),
    },
    {
      id: "investigation",
      header: "Investigation",
      align: "right",
      sortValue: (item) => item.investigationAmount,
      cell: (item) => money(item.investigationAmount, item.currency),
    },
    {
      id: "coverage",
      header: "Coverage",
      align: "right",
      sortValue: (item) => item.coveragePct,
      cell: (item) => `${item.coveragePct.toFixed(1)}%`,
    },
    {
      id: "evidence",
      header: <span className="kit-sr-only">Evidence</span>,
      align: "right",
      cell: (item) => (
        <Link href={`/flywheel-variance/snapshots/${item.id}`} className="table-action">
          Evidence
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Record treatment decision modal                                     */
/* ------------------------------------------------------------------ */

interface DecisionModalProps {
  planId: string;
  plan: Plan;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: FlywheelVariancePlanDetail, title: string, label: string) => void;
}

function DecisionModal({ planId, plan, candidates, onClose, onSaved }: DecisionModalProps) {
  const [itemId, setItemId] = useState(candidates[0]?.settlementItemId ?? "");
  const [decision, setDecision] = useState<FlywheelVarianceDecision>("INVESTIGATE");
  const [date, setDate] = useState(() => isoDate(14));
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DecisionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.settlementItemId === itemId);
  const option = DECISIONS.find((current) => current.value === decision);
  const dateInPast = date !== "" && date < isoDate(0);
  const writeOff = decision === "WRITE_OFF";

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

    if (!itemId || !selected) {
      next.item = "Select a variance item.";
    }

    if (!date) {
      next.date = "Choose a target date.";
    }

    if (!rationale.trim()) {
      next.rationale = "A decision rationale is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await addFlywheelVarianceItem(planId, {
        settlementItemId: itemId,
        decision,
        decisionRationale: rationale.trim(),
        targetDate: date,
      });

      onSaved(
        updated,
        selected ? selected.rootTargetInitiativeTitle : "Variance item",
        option ? option.label : "Decision",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add variance decision.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Human treatment decision"
      title="Govern settlement variance"
      description="Choose the treatment for one positive settlement variance."
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
            form="variance-decision-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record treatment decision"}
          </button>
        </>
      }
    >
      <form id="variance-decision-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Variance item" htmlFor="variance-item" error={errors.item}>
              <select
                id="variance-item"
                className="kit-field-input"
                value={itemId}
                aria-invalid={errors.item ? true : undefined}
                onChange={(event) => {
                  setItemId(event.target.value);
                  clearError("item");
                }}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.settlementItemId} value={candidate.settlementItemId}>
                    {candidate.rootTargetInitiativeTitle} — {candidate.lineageNumber} — variance{" "}
                    {money(candidate.sourceVarianceAmount, plan.currency)}
                  </option>
                ))}
              </select>
            </Field>

            {selected ? (
              <p className="kit-meta-line">
                Variance on this item: {money(selected.sourceVarianceAmount, plan.currency)}
              </p>
            ) : null}
          </div>

          <Field label="Treatment" htmlFor="variance-treatment">
            <select
              id="variance-treatment"
              className="kit-field-input"
              value={decision}
              onChange={(event) => setDecision(event.target.value as FlywheelVarianceDecision)}
            >
              {DECISIONS.map((current) => (
                <option key={current.value} value={current.value}>
                  {current.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Target date" htmlFor="variance-target" error={errors.date}>
            <input
              id="variance-target"
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

          {option ? (
            <div className="kit-pair-wide">
              <p className="kit-meta-line">{option.hint}</p>
            </div>
          ) : null}

          <div className="kit-pair-wide">
            <Field label="Decision rationale" htmlFor="variance-rationale" error={errors.rationale}>
              <textarea
                id="variance-rationale"
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

        {writeOff ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            A write-off gives up the variance without recovering it, so the rationale should
            explain why recovery is not pursued.
          </p>
        ) : null}

        {dateInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The target date is in the past.
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

interface PlanData {
  id: string;
  detail: FlywheelVariancePlanDetail;
}

export default function FlywheelVariancePlanPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<PlanData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [adding, setAdding] = useState(false);
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
        const response = await getFlywheelVariancePlan(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load variance-resolution plan.",
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

  function applyDetail(updated: FlywheelVariancePlanDetail) {
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
        <Link href="/flywheel-variance" className="request-back-link">
          <ArrowLeft size={16} />
          Variance resolution
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

  const { plan, sourceAuthority: source, candidates, items, snapshots } = detail;
  const currency = plan.currency;
  const status = String(plan.status);
  const draft = status === "DRAFT";
  const inReview = status === "IN_REVIEW";
  const approved = status === "APPROVED";
  const busyAny = flowRunning || rationaleRunning;
  const canRecord = canManage && draft && candidates.length > 0;
  const complete = plan.coveragePct >= 100 && candidates.length === 0 && plan.itemCount > 0;
  const totalItems = plan.itemCount + candidates.length;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "SUBMIT") {
        applyDetail(await submitFlywheelVarianceForReview(params.id));
      } else {
        await captureFlywheelVarianceSnapshot(params.id);

        reload();
      }

      setFlow(null);

      toast.success(FLOWS[action].done, plan.planNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the variance plan.",
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
    const copy = rationaleCopy(request, plan);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, plan.planNumber);
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

  function handleRecorded(updated: FlywheelVariancePlanDetail, title: string, label: string) {
    applyDetail(updated);
    setAdding(false);
    toast.success(`Treatment recorded: ${label}`, title);
  }

  const orderedItems = [...items].sort((a, b) => b.sourceVarianceAmount - a.sourceVarianceAmount);
  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, plan) : null;

  const kpis: KpiItem[] = [
    {
      label: "Source variance",
      icon: Scale,
      value: money(plan.sourceVarianceAmount, currency),
      note: "From the reconciled settlement",
    },
    {
      label: "Recovery",
      icon: BadgeCheck,
      value: money(plan.recoverAmount, currency),
      note: "To be recovered",
    },
    {
      label: "Write-off",
      icon: TrendingDown,
      value: money(plan.writeOffAmount, currency),
      note: "To be written off",
    },
    {
      label: "Investigation",
      icon: SearchCheck,
      value: money(plan.investigationAmount, currency),
      note: "To be investigated",
    },
    {
      label: "Governed",
      icon: FileCheck2,
      value: money(plan.governedAmount, currency),
      note: "Has a treatment decision",
    },
    {
      label: "Coverage",
      icon: Gauge,
      value: `${plan.coveragePct.toFixed(1)}%`,
      note: "Of the source variance",
    },
  ];

  const itemColumns = buildItemColumns(currency);
  const snapshotColumns = buildSnapshotColumns();

  return (
    <div className="page-stack">
      <Link href="/flywheel-variance" className="request-back-link">
        <ArrowLeft size={16} />
        Variance resolution
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{plan.planNumber}</span>

            <PlanBadge status={status} />
          </div>

          <span className="eyebrow">Settlement variance governance</span>

          <h1>{plan.title}</h1>

          <p>
            {currency}
            {" · "}
            {source.reconciliationNumber}
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
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Record decision
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !complete}
              title={
                complete
                  ? undefined
                  : "Every positive settlement variance needs a treatment decision first"
              }
              onClick={() => setFlow("SUBMIT")}
            >
              <FileCheck2 size={16} />
              Submit for review
            </button>
          ) : null}

          {canApprove && inReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "APPROVE" })}
            >
              <BadgeCheck size={16} />
              Approve plan
            </button>
          ) : null}

          {canApprove && approved ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close plan
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
            {complete ? (
              <>
                <strong>Every variance has a treatment.</strong> The plan has 100% coverage. Submit
                it for approval review.
              </>
            ) : candidates.length > 0 ? (
              <>
                <strong>
                  {candidates.length} positive settlement{" "}
                  {candidates.length === 1 ? "variance still needs" : "variances still need"} a
                  treatment.
                </strong>{" "}
                Each one needs exactly one governed treatment before review.
              </>
            ) : (
              <>
                <strong>No positive variance has a treatment yet.</strong> The settlement has no
                variance item to govern.
              </>
            )}
          </div>
        </div>
      ) : null}

      {inReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting manager approval.</strong>{" "}
            {canApprove
              ? "Use Approve plan above."
              : "A procurement manager or administrator needs to approve it."}
          </div>
        </div>
      ) : null}

      {approved && canApprove ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The plan is approved.</strong> Treatments can now be executed with evidence.
            Close the plan when the governance lifecycle is finished.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Variance plan summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Treatment coverage</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={plan.coveragePct}
          tone={plan.coveragePct >= 100 ? meterToneFor("success") : "primary"}
          caption={`${money(plan.governedAmount, currency)} of ${money(plan.sourceVarianceAmount, currency)} variance has a treatment (${plan.coveragePct.toFixed(1)}%)`}
          label="Governed against the source variance"
        />

        {totalItems > 0 ? (
          <ProgressLine
            pct={(plan.itemCount / totalItems) * 100}
            tone={candidates.length === 0 ? meterToneFor("success") : "primary"}
            caption={`${plan.itemCount} of ${totalItems} variance items have a treatment decision`}
            label="Variance items with a treatment"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Step 71/72 authority</span>

            <h2>Reconciled settlement</h2>
          </div>

          <Scale size={19} />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>Reconciliation</span>

            <strong>{source.reconciliationNumber}</strong>
          </div>

          <div>
            <span>Release</span>

            <strong>{source.releaseNumber}</strong>
          </div>

          <div>
            <span>Settlement owner</span>

            <strong>{source.reconciliationOwnerName}</strong>
          </div>

          <div>
            <span>Variance-plan owner</span>

            <strong>{plan.planOwnerName}</strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>Resolution objective</span>

            <p>{plan.resolutionObjective}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Resolution decisions</span>

            <h2>Governed variance</h2>
          </div>

          {canRecord ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Record decision
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Governed variance"
          busy={fetching}
          empty={
            <EmptyState
              icon={Coins}
              title="No treatment decisions"
              description="No variance treatment decision has been recorded."
              action={
                canRecord ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Record decision
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
            <span className="eyebrow">Immutable variance evidence</span>

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
          ariaLabel="Variance snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No variance snapshot has been captured yet."
            />
          }
        />
      </section>

      {adding ? (
        <DecisionModal
          planId={params.id}
          plan={plan}
          candidates={candidates}
          onClose={() => setAdding(false)}
          onSaved={handleRecorded}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, plan)}
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
