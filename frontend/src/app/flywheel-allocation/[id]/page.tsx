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
  Landmark,
  Plus,
  RefreshCw,
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
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addFlywheelAllocationItem,
  authorizeFlywheelAllocationMandate,
  captureFlywheelAllocationSnapshot,
  closeFlywheelAllocationMandate,
  getFlywheelAllocationMandate,
  submitFlywheelAllocationForReview,
} from "@/lib/api";
import type { FlywheelAllocationMandateDetail } from "@/types/flywheel-allocation";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Mandate = FlywheelAllocationMandateDetail["mandate"];
type Candidate = FlywheelAllocationMandateDetail["candidates"][number];
type MandateItem = FlywheelAllocationMandateDetail["items"][number];
type MandateSnapshot = FlywheelAllocationMandateDetail["snapshots"][number];
type Flow = "SUBMIT" | "SNAPSHOT";
type ItemField = "item" | "amount";
type RationaleRequest = { kind: "AUTHORIZE" } | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const AUTHORIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function MandateBadge({ status }: { status: string }) {
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
    eyebrow: "Revalidate Step 67 authority",
    title: "Submit for authorization review?",
    confirm: "Submit for review",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for review",
    failed: "Could not submit the mandate",
  },
  SNAPSHOT: {
    eyebrow: "Immutable evidence",
    title: "Capture a mandate snapshot?",
    confirm: "Capture snapshot",
    busy: "Capturing…",
    keep: "Not yet",
    done: "Snapshot captured",
    failed: "Could not capture the snapshot",
  },
};

function flowDescription(flow: Flow, mandate: Mandate): string {
  switch (flow) {
    case "SUBMIT":
      return `${mandate.mandateNumber} will be frozen for manager review. Submission rechecks the source Step 67 portfolio and every prioritized item.`;

    case "SNAPSHOT":
      return `The current state of ${mandate.mandateNumber} is recorded as an immutable snapshot.`;
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

function rationaleCopy(request: RationaleRequest, mandate: Mandate): RationaleCopy {
  switch (request.kind) {
    case "AUTHORIZE":
      return {
        eyebrow: "Manager capital authority",
        title: "Authorize this mandate",
        description: `${mandate.mandateNumber} will authorize ${money(mandate.requestedAllocationAmount, mandate.currency)} across ${mandate.itemCount} allocation ${mandate.itemCount === 1 ? "item" : "items"}. Release batches can then draw on it.`,
        label: "Authorization rationale",
        placeholder: "Why is this allocation plan authorized?",
        confirm: "Authorize mandate",
        busy: "Authorizing…",
        done: "Mandate authorized",
      };

    case "CLOSE":
      return {
        eyebrow: "Authorization lifecycle",
        title: "Close this mandate",
        description: `${mandate.mandateNumber} was authorized. Closing it finishes the authorization lifecycle.`,
        label: "Closure rationale",
        placeholder: "Summarise why this mandate can be closed.",
        confirm: "Close mandate",
        busy: "Closing…",
        done: "Mandate closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  mandateId: string,
  note: string,
): Promise<FlywheelAllocationMandateDetail> {
  switch (request.kind) {
    case "AUTHORIZE":
      return authorizeFlywheelAllocationMandate(mandateId, note);

    case "CLOSE":
      return closeFlywheelAllocationMandate(mandateId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildItemColumns(currency: string): Column<MandateItem>[] {
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
      header: "Step 67 proposed",
      align: "right",
      sortValue: (item) => item.strategyProposedCapacityAmount,
      cell: (item) => money(item.strategyProposedCapacityAmount, currency),
    },
    {
      id: "requested",
      header: "Requested",
      align: "right",
      sortValue: (item) => item.requestedAllocationAmount,
      cell: (item) => <strong>{money(item.requestedAllocationAmount, currency)}</strong>,
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (item) => item.strategyPriorityScore,
      cell: (item) => item.strategyPriorityScore.toFixed(1),
    },
    {
      id: "advisory",
      header: "Advisory",
      sortValue: (item) => String(item.strategyAdvisoryRecommendation),
      cell: (item) => (
        <StatusBadge
          value={String(item.strategyAdvisoryRecommendation)}
          label={readable(String(item.strategyAdvisoryRecommendation))}
        />
      ),
    },
    {
      id: "by",
      header: "Added by",
      sortValue: (item) => (item.addedByName ?? "").toLowerCase(),
      cell: (item) => item.addedByName ?? <span className="kit-text-muted">—</span>,
    },
  ];
}

function buildSnapshotColumns(): Column<MandateSnapshot>[] {
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
      sortValue: (item) => String(item.mandateStatus),
      cell: (item) => <MandateBadge status={String(item.mandateStatus)} />,
    },
    {
      id: "requested",
      header: "Requested",
      align: "right",
      sortValue: (item) => item.requestedAllocationAmount,
      cell: (item) => money(item.requestedAllocationAmount, item.currency),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingStrategyCapacityAmount,
      cell: (item) => money(item.remainingStrategyCapacityAmount, item.currency),
    },
    {
      id: "utilization",
      header: "Utilization",
      align: "right",
      sortValue: (item) => item.allocationUtilizationPct,
      cell: (item) => `${item.allocationUtilizationPct.toFixed(1)}%`,
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
        <Link href={`/flywheel-allocation/snapshots/${item.id}`} className="table-action">
          Evidence
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add allocation item modal                                           */
/* ------------------------------------------------------------------ */

interface AddItemModalProps {
  mandateId: string;
  mandate: Mandate;
  candidates: Candidate[];
  onClose: () => void;
  onSaved: (updated: FlywheelAllocationMandateDetail, title: string) => void;
}

function AddItemModal({ mandateId, mandate, candidates, onClose, onSaved }: AddItemModalProps) {
  const first = candidates[0];

  const [itemId, setItemId] = useState(first?.strategyItemId ?? "");
  const [amount, setAmount] = useState(() =>
    first ? String(first.strategyProposedCapacityAmount) : "0",
  );
  const [errors, setErrors] = useState<Partial<Record<ItemField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = candidates.find((candidate) => candidate.strategyItemId === itemId);
  const amountValid = numberError(amount, { min: 0.01 }) === undefined;
  const aboveProposed =
    amountValid &&
    selected !== undefined &&
    Number(amount) > selected.strategyProposedCapacityAmount + 0.005;
  const aboveRemaining =
    amountValid && Number(amount) > mandate.remainingStrategyCapacityAmount + 0.005;

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

    const candidate = candidates.find((current) => current.strategyItemId === id);

    if (candidate) {
      setAmount(String(candidate.strategyProposedCapacityAmount));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<ItemField, string>> = {};

    if (!itemId || !selected) {
      next.item = "Select a strategy lineage.";
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
      const updated = await addFlywheelAllocationItem(mandateId, {
        strategyItemId: itemId,
        requestedAllocationAmount: Number(amount),
      });

      onSaved(updated, selected ? selected.lineageNumber : "Allocation item");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add allocation item.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="PRIORITIZE decisions only"
      title="Add allocation item"
      description="Choose a Step 67 prioritized lineage and the capital to request for it."
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
            form="allocation-item-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add allocation"}
          </button>
        </>
      }
    >
      <form id="allocation-item-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Strategy lineage" htmlFor="allocation-lineage" error={errors.item}>
              <select
                id="allocation-lineage"
                className="kit-field-input"
                value={itemId}
                aria-invalid={errors.item ? true : undefined}
                onChange={(event) => handleSelect(event.target.value)}
              >
                {candidates.map((candidate) => (
                  <option key={candidate.strategyItemId} value={candidate.strategyItemId}>
                    {candidate.rootTargetInitiativeTitle} — {candidate.lineageNumber} —{" "}
                    {money(candidate.strategyProposedCapacityAmount, mandate.currency)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <NumberField
              id="allocation-requested"
              label={`Requested allocation (${mandate.currency})`}
              min={0.01}
              step="0.01"
              value={amount}
              error={errors.amount}
              onChange={(value) => {
                setAmount(value);
                clearError("amount");
              }}
            />

            <p className="kit-meta-line">
              Remaining Step 67 capacity on this mandate:{" "}
              {money(mandate.remainingStrategyCapacityAmount, mandate.currency)}
            </p>
          </div>
        </div>

        {aboveProposed && selected ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The request is above the {money(selected.strategyProposedCapacityAmount, mandate.currency)}{" "}
            that Step 67 proposed for this lineage.
          </p>
        ) : null}

        {aboveRemaining ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This would exceed the remaining Step 67 capacity, so submitting the mandate may be
            refused.
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

interface MandateData {
  id: string;
  detail: FlywheelAllocationMandateDetail;
}

export default function FlywheelAllocationMandatePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canAuthorize = user !== null && AUTHORIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<MandateData | null>(null);
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
        const response = await getFlywheelAllocationMandate(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load allocation mandate.");
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

  function applyDetail(updated: FlywheelAllocationMandateDetail) {
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
        <Link href="/flywheel-allocation" className="request-back-link">
          <ArrowLeft size={16} />
          Capital mandates
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

  const { mandate, strategyAuthority: strategy, candidates, items, snapshots } = detail;
  const currency = mandate.currency;
  const status = String(mandate.status);
  const draft = status === "DRAFT";
  const inReview = status === "IN_REVIEW";
  const authorized = status === "AUTHORIZED";
  const busyAny = flowRunning || rationaleRunning;
  const canAddItem = canManage && draft && candidates.length > 0;
  const overCapacity = mandate.remainingStrategyCapacityAmount < -0.005;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      if (action === "SUBMIT") {
        applyDetail(await submitFlywheelAllocationForReview(params.id));
      } else {
        await captureFlywheelAllocationSnapshot(params.id);

        reload();
      }

      setFlow(null);

      toast.success(FLOWS[action].done, mandate.mandateNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the mandate.",
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
    const copy = rationaleCopy(request, mandate);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, mandate.mandateNumber);
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

  function handleAdded(updated: FlywheelAllocationMandateDetail, title: string) {
    applyDetail(updated);
    setAdding(false);
    toast.success("Allocation item added", title);
  }

  const orderedItems = [...items].sort((a, b) => {
    if (b.strategyPriorityScore !== a.strategyPriorityScore) {
      return b.strategyPriorityScore - a.strategyPriorityScore;
    }

    return b.requestedAllocationAmount - a.requestedAllocationAmount;
  });

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, mandate) : null;

  const kpis: KpiItem[] = [
    {
      label: "Step 67 prioritized",
      icon: Landmark,
      value: money(mandate.strategyPrioritizedCapacityAmount, currency),
      note: "Capacity authorized by strategy",
    },
    {
      label: "Requested allocation",
      icon: Coins,
      value: money(mandate.requestedAllocationAmount, currency),
      note: `${mandate.itemCount} allocation ${mandate.itemCount === 1 ? "item" : "items"}`,
    },
    {
      label: "Remaining capacity",
      icon: WalletCards,
      value: money(mandate.remainingStrategyCapacityAmount, currency),
      note: "Left on the Step 67 capacity",
      tone: overCapacity ? "warning" : "default",
    },
    {
      label: "Utilization",
      icon: Gauge,
      value: `${mandate.allocationUtilizationPct.toFixed(1)}%`,
      note: "Of the prioritized capacity",
    },
    {
      label: "Allocation items",
      icon: FileCheck2,
      value: String(mandate.itemCount),
      note: `${candidates.length} more available to add`,
    },
    {
      label: "Strategy priority avg",
      icon: Target,
      value: strategy.averagePriorityScore.toFixed(1),
      note: "Step 67 priority score",
    },
  ];

  const itemColumns = buildItemColumns(currency);
  const snapshotColumns = buildSnapshotColumns();

  return (
    <div className="page-stack">
      <Link href="/flywheel-allocation" className="request-back-link">
        <ArrowLeft size={16} />
        Capital mandates
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{mandate.mandateNumber}</span>

            <MandateBadge status={status} />
          </div>

          <span className="eyebrow">Governed capital authorization</span>

          <h1>{mandate.title}</h1>

          <p>
            {currency}
            {" · FY "}
            {mandate.fiscalYear}
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

          {canAddItem ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add allocation item
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || mandate.itemCount === 0}
              title={mandate.itemCount === 0 ? "Add at least one allocation item first" : undefined}
              onClick={() => setFlow("SUBMIT")}
            >
              <FileCheck2 size={16} />
              Submit for review
            </button>
          ) : null}

          {canAuthorize && inReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "AUTHORIZE" })}
            >
              <BadgeCheck size={16} />
              Authorize mandate
            </button>
          ) : null}

          {canAuthorize && authorized ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close mandate
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
            <strong>The requested allocation is above the prioritized capacity.</strong> It is{" "}
            {money(mandate.requestedAllocationAmount, currency)} against{" "}
            {money(mandate.strategyPrioritizedCapacityAmount, currency)} from Step 67.
          </div>
        </div>
      ) : null}

      {draft && canManage && items.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            {candidates.length > 0 ? (
              <>
                <strong>Next step: add an allocation item.</strong> Choose a Step 67 prioritized
                lineage and the capital to request.
              </>
            ) : (
              <>
                <strong>No Step 67 prioritized lineage is available.</strong> An allocation item
                can be added once the approved strategy has a lineage with a PRIORITIZE decision.
              </>
            )}
          </div>
        </div>
      ) : null}

      {draft && canManage && items.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Submit when the allocation plan is complete.</strong>{" "}
            {candidates.length === 0
              ? "Every available Step 67 prioritized lineage has been added. "
              : ""}
            Submission freezes the plan for manager review and rechecks the source strategy.
          </div>
        </div>
      ) : null}

      {inReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting capital authorization.</strong>{" "}
            {canAuthorize
              ? "Use Authorize mandate above."
              : "A procurement manager or administrator needs to authorize it."}
          </div>
        </div>
      ) : null}

      {authorized && canAuthorize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The mandate is authorized.</strong> Release batches can draw on it. Close it
            when the authorization lifecycle is finished.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Mandate summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Allocation against the strategy</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={mandate.allocationUtilizationPct}
          tone="primary"
          caption={`${money(mandate.requestedAllocationAmount, currency)} of ${money(mandate.strategyPrioritizedCapacityAmount, currency)} prioritized capacity requested (${mandate.allocationUtilizationPct.toFixed(1)}%)`}
          label="Requested allocation against the Step 67 capacity"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Step 67 source authority</span>

            <h2>Approved strategy</h2>
          </div>

          <Landmark size={19} />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>Portfolio</span>

            <strong>{strategy.strategyPortfolioNumber}</strong>
          </div>

          <div>
            <span>Strategy owner</span>

            <strong>{strategy.strategyOwnerName}</strong>
          </div>

          <div>
            <span>Mandate owner</span>

            <strong>{mandate.mandateOwnerName}</strong>
          </div>

          <div>
            <span>Strategy status</span>

            <strong>{readable(String(strategy.status))}</strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>Mandate rationale</span>

            <p>{mandate.mandateRationale}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen strategy allocation inputs</span>

            <h2>Mandate items</h2>
          </div>

          {canAddItem ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add allocation item
            </button>
          ) : (
            <Coins size={19} />
          )}
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Mandate items"
          busy={fetching}
          empty={
            <EmptyState
              icon={Coins}
              title="No allocation items"
              description="No allocation item has been added."
              action={
                canAddItem ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add allocation item
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
            <span className="eyebrow">Immutable evidence</span>

            <h2>Mandate snapshots</h2>
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
          ariaLabel="Mandate snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No mandate snapshot has been captured yet."
            />
          }
        />
      </section>

      {adding ? (
        <AddItemModal
          mandateId={params.id}
          mandate={mandate}
          candidates={candidates}
          onClose={() => setAdding(false)}
          onSaved={handleAdded}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, mandate)}
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
