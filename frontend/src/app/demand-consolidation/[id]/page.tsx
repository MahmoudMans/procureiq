"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CircleAlert,
  Coins,
  ExternalLink,
  Info,
  Layers3,
  Link2,
  RefreshCw,
  Send,
  Target,
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
  Modal,
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  approveDemandConsolidationBundle,
  cancelDemandConsolidationBundle,
  closeDemandConsolidationBundle,
  getDemandConsolidationBundle,
  getDemandConsolidationContext,
  linkDemandConsolidationRfq,
  submitDemandConsolidationBundle,
} from "@/lib/api";
import type {
  DemandBundle,
  DemandConsolidationContext,
} from "@/types/demand-consolidation";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type BundleItem = DemandBundle["items"][number];
type Rfq = DemandConsolidationContext["rfqs"][number];
type Flow = "SUBMIT" | "CLOSE";
type RationaleKind = "APPROVE" | "REJECT" | "CANCEL";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function BundleBadge({ status }: { status: string }) {
  return <StatusBadge value={status} label={readable(status)} />;
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
    eyebrow: "Consolidation governance",
    title: "Submit for review?",
    confirm: "Submit for review",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for review",
    failed: "Could not submit the bundle",
  },
  CLOSE: {
    eyebrow: "Sourcing lifecycle",
    title: "Close this bundle?",
    confirm: "Close bundle",
    busy: "Closing…",
    keep: "Keep open",
    done: "Bundle closed",
    failed: "Could not close the bundle",
  },
};

function flowDescription(flow: Flow, bundle: DemandBundle): string {
  switch (flow) {
    case "SUBMIT":
      return `${bundle.bundleNumber} will be sent to procurement management for a decision on the consolidation.`;

    case "CLOSE":
      return `${bundle.bundleNumber} will be closed. Closing it finishes the consolidation lifecycle.`;
  }
}

function performFlow(flow: Flow, bundleId: string): Promise<unknown> {
  switch (flow) {
    case "SUBMIT":
      return submitDemandConsolidationBundle(bundleId);

    case "CLOSE":
      return closeDemandConsolidationBundle(bundleId);
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
}

function rationaleCopy(kind: RationaleKind, bundle: DemandBundle): RationaleCopy {
  switch (kind) {
    case "APPROVE":
      return {
        eyebrow: "Consolidation governance",
        title: "Approve this bundle",
        description: `${bundle.bundleNumber} combines ${bundle.intakeCount} ${bundle.intakeCount === 1 ? "intake" : "intakes"} across ${bundle.departmentCount} ${bundle.departmentCount === 1 ? "department" : "departments"} (${money(bundle.consolidatedValue, bundle.currency)}). Approval lets it be linked to an RFQ for sourcing.`,
        label: "Decision rationale",
        placeholder: "Why is this consolidation approved?",
        confirm: "Approve bundle",
        busy: "Approving…",
        tone: "primary",
        done: "Bundle approved",
      };

    case "REJECT":
      return {
        eyebrow: "Consolidation governance",
        title: "Reject this bundle",
        description: `${bundle.bundleNumber} will be rejected and cancelled. It will not go to sourcing.`,
        label: "Decision rationale",
        placeholder: "Why is this consolidation rejected?",
        confirm: "Reject bundle",
        busy: "Rejecting…",
        cancelLabel: "Keep bundle",
        tone: "danger",
        done: "Bundle rejected",
      };

    case "CANCEL":
      return {
        eyebrow: "Bundle controls",
        title: "Cancel consolidation",
        description: `${bundle.bundleNumber} will be cancelled and will not go to sourcing.`,
        label: "Cancellation rationale",
        placeholder: "Why is this consolidation being cancelled?",
        confirm: "Cancel bundle",
        busy: "Cancelling…",
        cancelLabel: "Keep bundle",
        tone: "danger",
        done: "Bundle cancelled",
      };
  }
}

function performRationale(
  kind: RationaleKind,
  bundleId: string,
  note: string,
): Promise<unknown> {
  switch (kind) {
    case "APPROVE":
      return approveDemandConsolidationBundle(bundleId, note);

    case "REJECT":
    case "CANCEL":
      return cancelDemandConsolidationBundle(bundleId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildItemColumns(bundle: DemandBundle): Column<BundleItem>[] {
  const { currency, consolidatedValue } = bundle;

  return [
    {
      id: "intake",
      header: "Intake",
      sortValue: (item) => item.title.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.title}</strong>

          <span>{item.intakeNumber}</span>
        </div>
      ),
    },
    {
      id: "department",
      header: "Department",
      sortValue: (item) => (item.departmentName ?? "").toLowerCase(),
      cell: (item) => item.departmentName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "route",
      header: "Guidance route",
      sortValue: (item) => String(item.guidanceRoute),
      cell: (item) => readable(String(item.guidanceRoute)),
    },
    {
      id: "status",
      header: "Intake status",
      sortValue: (item) => String(item.intakeStatus),
      cell: (item) => (
        <StatusBadge
          value={String(item.intakeStatus)}
          label={readable(String(item.intakeStatus))}
        />
      ),
    },
    {
      id: "amount",
      header: "Estimated amount",
      align: "right",
      sortValue: (item) => item.estimatedAmount,
      cell: (item) => <strong>{money(item.estimatedAmount, currency)}</strong>,
    },
    {
      id: "share",
      header: "Share",
      align: "right",
      sortValue: (item) => item.estimatedAmount,
      cell: (item) =>
        consolidatedValue > 0
          ? `${((item.estimatedAmount / consolidatedValue) * 100).toFixed(1)}%`
          : "—",
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      cell: (item) => (
        <Link href={`/guided-buying/${item.intakeId}`} className="table-action">
          Open
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Link RFQ modal                                                      */
/* ------------------------------------------------------------------ */

interface LinkModalProps {
  bundleId: string;
  bundle: DemandBundle;
  rfqs: Rfq[];
  onClose: () => void;
  onSaved: (rfqNumber: string) => Promise<void>;
}

function LinkRfqModal({ bundleId, bundle, rfqs, onClose, onSaved }: LinkModalProps) {
  const [rfqId, setRfqId] = useState(rfqs[0]?.id ?? "");
  const [rfqError, setRfqError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = rfqs.find((rfq) => rfq.id === rfqId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!rfqId || !selected) {
      setRfqError("Select the RFQ to link.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await linkDemandConsolidationRfq(bundleId, rfqId);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to link RFQ to demand bundle.",
      );
      setSaving(false);

      return;
    }

    await onSaved(selected.rfqNumber);
  }

  return (
    <Modal
      eyebrow="Sourcing handoff"
      title="Link RFQ"
      description={`Link the consolidated RFQ to ${bundle.bundleNumber} to move the bundle into sourcing.`}
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
            form="demand-link-form"
            className="button button--primary"
            disabled={saving}
          >
            <Link2 size={16} />
            {saving ? "Linking…" : "Link RFQ"}
          </button>
        </>
      }
    >
      <form id="demand-link-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Matching RFQ" htmlFor="demand-rfq" error={rfqError}>
              <select
                id="demand-rfq"
                className="kit-field-input"
                value={rfqId}
                aria-invalid={rfqError ? true : undefined}
                onChange={(event) => {
                  setRfqId(event.target.value);
                  setRfqError(undefined);
                }}
              >
                {rfqs.map((rfq) => (
                  <option key={rfq.id} value={rfq.id}>
                    {rfq.rfqNumber} — {rfq.title} — {readable(String(rfq.status))}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              Only RFQs in {bundle.currency} are listed, matching the bundle currency.
            </p>
          </div>
        </div>

        <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
          Linking moves the bundle into sourcing and cannot be undone from this page.
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

interface BundleData {
  id: string;
  bundle: DemandBundle;
  context: DemandConsolidationContext;
}

export default function DemandBundleDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<BundleData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [linking, setLinking] = useState(false);
  const [rationale, setRationale] = useState<RationaleKind | null>(null);
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
        const [bundleResponse, contextResponse] = await Promise.all([
          getDemandConsolidationBundle(id),
          getDemandConsolidationContext(),
        ]);

        if (active) {
          setResult({ id, bundle: bundleResponse, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load demand bundle.");
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
  const loadedBundle = data?.bundle ?? null;
  const context = data?.context ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getDemandConsolidationBundle(id);

      setResult((current) =>
        current && current.id === id ? { ...current, bundle: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the bundle.");
    }
  }

  if (loadedBundle === null) {
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
        <Link href="/demand-consolidation" className="request-back-link">
          <ArrowLeft size={16} />
          Demand consolidation
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

  const bundle: DemandBundle = loadedBundle;
  const status = String(bundle.status);
  const draft = status === "DRAFT";
  const underReview = status === "UNDER_REVIEW";
  const approved = status === "APPROVED";
  const sourcing = status === "SOURCING";
  const cancelled = status === "CANCELLED";
  const busyAny = flowRunning || rationaleRunning;

  const compatibleRfqs = (context?.rfqs ?? []).filter((rfq) => rfq.currency === bundle.currency);
  const canLink = canManage && approved && compatibleRfqs.length > 0;
  const sourcingLate =
    Boolean(bundle.targetSourcingDate) &&
    String(bundle.targetSourcingDate).slice(0, 10) < isoDate(0) &&
    (draft || underReview || approved);

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      await performFlow(action, params.id);

      await refresh();

      setFlow(null);

      toast.success(FLOWS[action].done, bundle.bundleNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the demand bundle.",
      );
    } finally {
      setFlowRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const kind = rationale;
    const copy = rationaleCopy(kind, bundle);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      await performRationale(kind, params.id, note.trim());

      await refresh();

      setRationale(null);

      toast.success(copy.done, bundle.bundleNumber);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to record the decision.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(kind: RationaleKind) {
    setRationaleError(null);
    setRationale(kind);
  }

  async function handleLinked(rfqNumber: string) {
    await refresh();

    setLinking(false);

    toast.success("RFQ linked", `${rfqNumber} — the bundle is now in sourcing`);
  }

  const orderedItems = [...bundle.items].sort((a, b) => b.estimatedAmount - a.estimatedAmount);
  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, bundle) : null;

  const kpis: KpiItem[] = [
    {
      label: "Consolidated demand",
      icon: Layers3,
      value: money(bundle.consolidatedValue, bundle.currency),
      note: `${bundle.intakeCount} combined ${bundle.intakeCount === 1 ? "intake" : "intakes"}`,
    },
    {
      label: "Departments",
      icon: Building2,
      value: String(bundle.departmentCount),
      note: "Participating business units",
    },
    {
      label: "Expected leverage",
      icon: Target,
      value: `${bundle.expectedLeveragePct.toFixed(1)}%`,
      note: "Consolidation leverage model",
    },
    {
      label: "Expected savings",
      icon: Coins,
      value: money(bundle.expectedSavings, bundle.currency),
      note: "Estimated sourcing opportunity",
    },
  ];

  const itemColumns = buildItemColumns(bundle);

  return (
    <div className="page-stack">
      <Link href="/demand-consolidation" className="request-back-link">
        <ArrowLeft size={16} />
        Demand consolidation
      </Link>

      <section className="demand-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{bundle.bundleNumber}</span>

            <BundleBadge status={status} />
          </div>

          <h1>{bundle.title}</h1>

          <p>
            {bundle.category}
            {" · "}
            {bundle.departmentCount} {bundle.departmentCount === 1 ? "department" : "departments"}
            {" · "}
            {bundle.intakeCount} {bundle.intakeCount === 1 ? "intake" : "intakes"}
            {" · Owner: "}
            {bundle.ownerName}
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

          {canApprove && (draft || approved) ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale("CANCEL")}
            >
              <XCircle size={15} />
              Cancel bundle
            </button>
          ) : null}

          {canApprove && underReview ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale("REJECT")}
            >
              <XCircle size={15} />
              Reject bundle
            </button>
          ) : null}

          {canApprove && underReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale("APPROVE")}
            >
              <BadgeCheck size={16} />
              Approve bundle
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("SUBMIT")}
            >
              <Send size={16} />
              Submit for review
            </button>
          ) : null}

          {canManage && approved ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !canLink}
              title={
                compatibleRfqs.length === 0
                  ? `No RFQ in ${bundle.currency} is available to link`
                  : undefined
              }
              onClick={() => setLinking(true)}
            >
              <Link2 size={16} />
              Link RFQ
            </button>
          ) : null}

          {canManage && sourcing ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("CLOSE")}
            >
              <BadgeCheck size={16} />
              Close bundle
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

      {sourcingLate ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The target sourcing date has passed.</strong> It was{" "}
            {formatDate(bundle.targetSourcingDate)} and the bundle has not reached sourcing.
          </div>
        </div>
      ) : null}

      {draft && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Submit the bundle when it is complete.</strong> Procurement management then
            decides whether to approve the consolidation.
          </div>
        </div>
      ) : null}

      {underReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting a consolidation decision.</strong>{" "}
            {canApprove
              ? "Use Approve bundle or Reject bundle above."
              : "A procurement manager or administrator needs to decide."}
          </div>
        </div>
      ) : null}

      {approved && canManage && compatibleRfqs.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The bundle is approved.</strong> Create the consolidated RFQ, then link it to
            move the bundle into sourcing.
          </div>
        </div>
      ) : null}

      {approved && canManage && compatibleRfqs.length === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No RFQ in {bundle.currency} is available to link.</strong> Create the
            consolidated RFQ first, then refresh this page.
          </div>
        </div>
      ) : null}

      {sourcing && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The bundle is in sourcing.</strong> Close it when the sourcing opportunity is
            complete.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Bundle summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Consolidated demand</span>

            <h2>Bundle composition</h2>
          </div>

          <Layers3 size={19} />
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Bundle composition"
          busy={fetching}
          empty={
            <EmptyState
              icon={Layers3}
              title="No intakes"
              description="No intake has been added to this bundle."
            />
          }
        />
      </section>

      <section className="demand-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Sourcing timeline</span>

              <h2>Governance context</h2>
            </div>
          </div>

          <div className="demand-context-grid">
            <div>
              <span>Target sourcing date</span>

              <strong className={sourcingLate ? "kit-text-warning" : undefined}>
                {formatDate(bundle.targetSourcingDate)}
              </strong>
            </div>

            <div>
              <span>Currency</span>

              <strong>{bundle.currency}</strong>
            </div>

            <div>
              <span>Owner</span>

              <strong>{bundle.ownerName}</strong>
            </div>

            <div>
              <span>Linked RFQ</span>

              <strong>{bundle.linkedRfqNumber ?? "Not linked"}</strong>
            </div>
          </div>

          {bundle.rationale ? <div className="demand-rationale">{bundle.rationale}</div> : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Sourcing handoff</span>

              <h2>RFQ opportunity</h2>
            </div>

            <Link2 size={19} />
          </div>

          {approved ? (
            <>
              <p className="demand-sourcing-help">
                Create the consolidated RFQ through the existing sourcing workflow, then link it
                here to move the bundle into sourcing.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <Link href="/rfqs/new" className="button button--secondary">
                  <ExternalLink size={16} />
                  Open RFQ form
                </Link>

                {canManage ? (
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={busyAny || !canLink}
                    onClick={() => setLinking(true)}
                  >
                    <Link2 size={16} />
                    Link RFQ
                  </button>
                ) : null}
              </div>

              {!canManage ? (
                <p className="kit-meta-line" style={{ marginTop: 10 }}>
                  A buyer, procurement manager or administrator needs to link the RFQ.
                </p>
              ) : null}
            </>
          ) : bundle.linkedRfqId ? (
            <div className="demand-linked-rfq">
              <BadgeCheck size={18} />

              <div>
                <span>Sourcing opportunity</span>

                <strong>
                  {bundle.linkedRfqNumber}
                  {" · "}
                  {bundle.linkedRfqTitle}
                </strong>

                <small>
                  {bundle.linkedRfqStatus ? readable(String(bundle.linkedRfqStatus)) : ""}
                  {bundle.sourcingStartedAt
                    ? ` · linked ${formatDateTime(bundle.sourcingStartedAt)}`
                    : ""}
                </small>
              </div>

              <Link href={`/rfqs/${bundle.linkedRfqId}`} className="table-action">
                Open RFQ
              </Link>
            </div>
          ) : (
            <div className="demand-empty">
              {cancelled
                ? "This bundle was cancelled before an RFQ was linked."
                : "RFQ linkage becomes available after bundle approval."}
            </div>
          )}
        </section>
      </section>

      {bundle.decisionNote ? (
        <section className="demand-decision-card">
          <BadgeCheck size={19} />

          <div>
            <span>Governance decision</span>

            <strong>{bundle.decisionNote}</strong>

            <small>
              {bundle.decidedByName ?? "Procurement management"}
              {bundle.decidedAt ? ` · ${formatDateTime(bundle.decidedAt)}` : ""}
            </small>
          </div>
        </section>
      ) : null}

      {linking ? (
        <LinkRfqModal
          bundleId={params.id}
          bundle={bundle}
          rfqs={compatibleRfqs}
          onClose={() => setLinking(false)}
          onSaved={handleLinked}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, bundle)}
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
          maxLength={2000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
