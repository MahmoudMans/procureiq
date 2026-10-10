"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  ExternalLink,
  FileCheck2,
  Info,
  Link2,
  RefreshCw,
  Route,
  ShieldAlert,
  Star,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

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
  formatDateTime,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import {
  cancelGuidedBuyingIntake,
  getGuidedBuyingContext,
  getGuidedBuyingIntake,
  linkGuidedBuyingRequest,
  markGuidedBuyingReady,
  refreshGuidedBuyingRecommendation,
} from "@/lib/api";
import type { GuidedBuyingContext, GuidedBuyingIntake } from "@/types/guided-buying";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type PreferredSupplier = GuidedBuyingContext["preferredSuppliers"][number];
type PurchaseRequest = GuidedBuyingContext["purchaseRequests"][number];
type Flow = "READY" | "CANCEL";

const PREFERRED_LIMIT = 6;
const REQUEST_DIFFERENCE = 0.1;

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function isHighRisk(level: string | null | undefined): boolean {
  return level === "HIGH" || level === "CRITICAL";
}

function IntakeBadge({ status }: { status: string }) {
  if (status === "CONVERTED") {
    return <StatusBadge value="COMPLETED" label="Converted" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
}

function RiskBadge({ level }: { level: string }) {
  return <StatusBadge value={level} label={readable(level)} />;
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
  READY: {
    eyebrow: "Purchase-request handoff",
    title: "Mark this intake ready?",
    confirm: "Mark ready",
    busy: "Marking…",
    keep: "Not yet",
    done: "Intake marked ready",
    failed: "Could not mark the intake ready",
  },
  CANCEL: {
    eyebrow: "Intake lifecycle",
    title: "Cancel this intake?",
    confirm: "Cancel intake",
    busy: "Cancelling…",
    keep: "Keep intake",
    done: "Intake cancelled",
    failed: "Could not cancel the intake",
  },
};

function flowDescription(flow: Flow, intake: GuidedBuyingIntake): string {
  switch (flow) {
    case "READY":
      return `${intake.intakeNumber} will be marked ready for the purchase-request handoff.`;

    case "CANCEL":
      return `${intake.intakeNumber} will be cancelled. A cancelled intake can no longer be linked to a purchase request.`;
  }
}

function performFlow(flow: Flow, intakeId: string): Promise<unknown> {
  switch (flow) {
    case "READY":
      return markGuidedBuyingReady(intakeId);

    case "CANCEL":
      return cancelGuidedBuyingIntake(intakeId);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildPreferredColumns(): Column<PreferredSupplier>[] {
  return [
    {
      id: "rank",
      header: "Rank",
      align: "right",
      sortValue: (item) => item.preferenceRank,
      cell: (item) => <strong>#{item.preferenceRank}</strong>,
    },
    {
      id: "supplier",
      header: "Supplier",
      sortValue: (item) => item.supplierName.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.supplierName}</strong>

          <span>{item.supplierCode}</span>
        </div>
      ),
    },
    {
      id: "rating",
      header: "Rating",
      align: "right",
      sortValue: (item) => item.supplierRating,
      cell: (item) => item.supplierRating.toFixed(1),
    },
    {
      id: "risk",
      header: "Risk",
      sortValue: (item) => String(item.supplierRiskLevel ?? ""),
      cell: (item) =>
        item.supplierRiskLevel ? (
          <RiskBadge level={String(item.supplierRiskLevel)} />
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Link purchase request modal                                         */
/* ------------------------------------------------------------------ */

interface LinkModalProps {
  intake: GuidedBuyingIntake;
  requests: PurchaseRequest[];
  onClose: () => void;
  onSaved: (requestNumber: string) => Promise<void>;
}

function LinkRequestModal({ intake, requests, onClose, onSaved }: LinkModalProps) {
  const [requestId, setRequestId] = useState(requests[0]?.id ?? "");
  const [requestError, setRequestError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = requests.find((request) => request.id === requestId);
  const total = selected ? Number(selected.estimatedTotal) : Number.NaN;
  const differs =
    Number.isFinite(total) &&
    intake.estimatedAmount > 0 &&
    Math.abs(total - intake.estimatedAmount) / intake.estimatedAmount > REQUEST_DIFFERENCE;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!requestId || !selected) {
      setRequestError("Select the purchase request to link.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await linkGuidedBuyingRequest(intake.id, requestId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to link purchase request.");
      setSaving(false);

      return;
    }

    await onSaved(selected.requestNumber);
  }

  return (
    <Modal
      eyebrow="Purchase-request handoff"
      title="Link purchase request"
      description={`Link the formal purchase request to ${intake.intakeNumber} to complete the guided-buying conversion.`}
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
            form="guided-link-form"
            className="button button--primary"
            disabled={saving}
          >
            <Link2 size={16} />
            {saving ? "Linking…" : "Link request"}
          </button>
        </>
      }
    >
      <form id="guided-link-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Matching purchase request" htmlFor="guided-request" error={requestError}>
              <select
                id="guided-request"
                className="kit-field-input"
                value={requestId}
                aria-invalid={requestError ? true : undefined}
                onChange={(event) => {
                  setRequestId(event.target.value);
                  setRequestError(undefined);
                }}
              >
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.requestNumber} — {request.title} — {request.currency}{" "}
                    {request.estimatedTotal}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              Only requests from {intake.departmentName} in {intake.currency} are listed.
            </p>
          </div>
        </div>

        {differs && selected ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The request total of {money(total, selected.currency)} differs from the intake
            estimate of {money(intake.estimatedAmount, intake.currency)} by more than{" "}
            {Math.round(REQUEST_DIFFERENCE * 100)}%.
          </p>
        ) : null}

        <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
          Linking converts the intake and cannot be undone from this page.
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

interface IntakeData {
  id: string;
  intake: GuidedBuyingIntake;
  context: GuidedBuyingContext;
}

export default function GuidedBuyingDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const [result, setResult] = useState<IntakeData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [guidanceRunning, setGuidanceRunning] = useState(false);
  const [linking, setLinking] = useState(false);
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
        const [intakeResponse, contextResponse] = await Promise.all([
          getGuidedBuyingIntake(id),
          getGuidedBuyingContext(),
        ]);

        if (active) {
          setResult({ id, intake: intakeResponse, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load guided-buying intake.",
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
  const loadedIntake = data?.intake ?? null;
  const context = data?.context ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function refreshIntake() {
    const id = params.id;

    try {
      const fresh = await getGuidedBuyingIntake(id);

      setResult((current) =>
        current && current.id === id ? { ...current, intake: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the intake.");
    }
  }

  if (loadedIntake === null) {
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
        <Link href="/guided-buying" className="request-back-link">
          <ArrowLeft size={16} />
          Guided buying
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

  const intake: GuidedBuyingIntake = loadedIntake;
  const status = String(intake.status);
  const draft = status === "DRAFT";
  const ready = status === "READY";
  const converted = status === "CONVERTED";
  const cancelled = status === "CANCELLED";
  const open = draft || ready;
  const busyAny = flowRunning || guidanceRunning;

  const preferredAll = (context?.preferredSuppliers ?? [])
    .filter(
      (preferred) =>
        preferred.active &&
        preferred.category.toLowerCase() === intake.category.toLowerCase(),
    )
    .sort((left, right) => left.preferenceRank - right.preferenceRank);

  const preferredShown = preferredAll.slice(0, PREFERRED_LIMIT);

  const availableRequests = (context?.purchaseRequests ?? []).filter(
    (request) =>
      request.departmentId === intake.departmentId && request.currency === intake.currency,
  );

  const riskLevel = intake.supplierRiskLevel ? String(intake.supplierRiskLevel) : null;
  const highRisk = isHighRisk(riskLevel);
  const offPreferred =
    Boolean(intake.supplierName) &&
    preferredAll.length > 0 &&
    !preferredAll.some((preferred) => preferred.supplierName === intake.supplierName);
  const canLink = open && availableRequests.length > 0;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      await performFlow(action, intake.id);

      await refreshIntake();

      setFlow(null);

      toast.success(FLOWS[action].done, intake.intakeNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update guided-buying intake.",
      );
    } finally {
      setFlowRunning(false);
    }
  }

  async function refreshGuidance() {
    if (guidanceRunning) {
      return;
    }

    setGuidanceRunning(true);

    try {
      await refreshGuidedBuyingRecommendation(intake.id);

      await refreshIntake();

      toast.success("Guidance refreshed", intake.intakeNumber);
    } catch (caught) {
      toast.error(
        "Could not refresh the guidance",
        caught instanceof Error ? caught.message : "Unable to refresh the recommendation.",
      );
    } finally {
      setGuidanceRunning(false);
    }
  }

  async function handleLinked(requestNumber: string) {
    await refreshIntake();

    setLinking(false);

    toast.success("Purchase request linked", `${requestNumber} — the intake is converted`);
  }

  const kpis: KpiItem[] = [
    {
      label: "Estimated amount",
      icon: Coins,
      value: money(intake.estimatedAmount, intake.currency),
      note: intake.category,
    },
    {
      label: "Guidance route",
      icon: Route,
      value: readable(String(intake.guidanceRoute)),
      note: "Recommended buying route",
    },
    {
      label: "Preferred suppliers",
      icon: Star,
      value: String(preferredAll.length),
      note: `For ${intake.category}`,
    },
    {
      label: "Selected supplier risk",
      icon: ShieldAlert,
      value: riskLevel ? readable(riskLevel) : "—",
      note: intake.supplierName ?? "No supplier selected",
      tone: highRisk ? "warning" : "default",
    },
  ];

  const preferredColumns = buildPreferredColumns();

  return (
    <div className="page-stack">
      <Link href="/guided-buying" className="request-back-link">
        <ArrowLeft size={16} />
        Guided buying
      </Link>

      <section className="guided-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{intake.intakeNumber}</span>

            <IntakeBadge status={status} />

            <StatusBadge
              value={String(intake.guidanceRoute)}
              label={readable(String(intake.guidanceRoute))}
            />
          </div>

          <h1>{intake.title}</h1>

          <p>
            {intake.departmentName}
            {" · "}
            {intake.category}
            {" · "}
            {money(intake.estimatedAmount, intake.currency)}
            {" · Requester: "}
            {intake.requesterName}
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

          {!cancelled ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => void refreshGuidance()}
            >
              <RefreshCw size={15} className={guidanceRunning ? "kit-spin" : undefined} />
              {guidanceRunning ? "Refreshing…" : "Refresh guidance"}
            </button>
          ) : null}

          {open ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => setFlow("CANCEL")}
            >
              <XCircle size={15} />
              Cancel
            </button>
          ) : null}

          {draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("READY")}
            >
              <BadgeCheck size={16} />
              Mark ready
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

      {highRisk && riskLevel ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The selected supplier is rated {readable(riskLevel)} risk.</strong>{" "}
            {intake.supplierName ?? "The supplier"} may need a closer look or an alternative before
            a request is raised.
          </div>
        </div>
      ) : null}

      {offPreferred ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The selected supplier is not on the preferred list.</strong>{" "}
            {intake.supplierName} is not a preferred supplier for {intake.category}. The
            recommended suppliers are listed below.
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Mark the intake ready when the guidance is final.</strong> Refresh the guidance
            if the details have changed, then raise the formal purchase request.
          </div>
        </div>
      ) : null}

      {ready ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The intake is ready.</strong> Create the formal purchase request, then link it
            here to complete the conversion.
          </div>
        </div>
      ) : null}

      {open && availableRequests.length === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No matching purchase request is available to link.</strong> A request needs to
            be in {intake.departmentName} and in {intake.currency}. Create it with the request form,
            then refresh this page.
          </div>
        </div>
      ) : null}

      {cancelled ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This intake was cancelled.</strong> It is no longer active, so no further
            action is available.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Intake summary" />

      <section className="guided-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Buying guidance</span>

              <h2>Recommended route</h2>
            </div>

            <Route size={19} />
          </div>

          <div className="guided-detail-recommendation">
            <StatusBadge
              value={String(intake.guidanceRoute)}
              label={readable(String(intake.guidanceRoute))}
            />

            <p>{intake.guidanceSummary}</p>

            {riskLevel ? (
              <div className="guided-risk-context">
                <ShieldAlert size={16} />

                <span>
                  Selected supplier risk: <strong>{riskLevel}</strong>
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Preferred supply</span>

              <h2>Recommended suppliers</h2>
            </div>

            <Star size={19} />
          </div>

          <DataTable
            columns={preferredColumns}
            rows={preferredShown}
            getRowId={(item) => String(item.id)}
            ariaLabel="Recommended suppliers"
            busy={fetching}
            empty={
              <EmptyState
                icon={Star}
                title="No preferred suppliers"
                description={`No preferred suppliers are configured for ${intake.category}.`}
              />
            }
          />

          {preferredAll.length > PREFERRED_LIMIT ? (
            <p className="kit-meta-line" style={{ marginTop: 10 }}>
              Showing the top {PREFERRED_LIMIT} of {preferredAll.length} preferred suppliers.
            </p>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Intake context</span>

            <h2>Business request</h2>
          </div>

          <FileCheck2 size={19} />
        </div>

        <div className="guided-context-grid">
          <div>
            <span>Department</span>

            <strong>{intake.departmentName}</strong>
          </div>

          <div>
            <span>Category</span>

            <strong>{intake.category}</strong>
          </div>

          <div>
            <span>Estimated amount</span>

            <strong>{money(intake.estimatedAmount, intake.currency)}</strong>
          </div>

          <div>
            <span>Selected supplier</span>

            <strong>{intake.supplierName ?? "Not selected"}</strong>
          </div>

          <div>
            <span>Template</span>

            <strong>
              {intake.templateCode
                ? `${intake.templateCode} — ${intake.templateName}`
                : "No template"}
            </strong>
          </div>

          <div>
            <span>Requester</span>

            <strong>{intake.requesterName}</strong>
          </div>
        </div>

        {intake.description ? <div className="guided-description">{intake.description}</div> : null}
      </section>

      {converted ? (
        <section className="guided-converted-card">
          <BadgeCheck size={19} />

          <div>
            <span>Converted to purchase request</span>

            <strong>{intake.linkedRequestNumber}</strong>

            <small>
              {intake.linkedRequestStatus ? readable(String(intake.linkedRequestStatus)) : ""}
              {intake.convertedAt ? ` · ${formatDateTime(intake.convertedAt)}` : ""}
            </small>
          </div>

          {intake.linkedPurchaseRequestId ? (
            <Link
              href={`/requests/${intake.linkedPurchaseRequestId}`}
              className="button button--secondary"
            >
              <ExternalLink size={16} />
              Open request
            </Link>
          ) : null}
        </section>
      ) : null}

      {open ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Purchase-request handoff</span>

              <h2>Link created request</h2>
            </div>

            <Link2 size={19} />
          </div>

          <p className="guided-link-help">
            Create the formal purchase request using the existing request workflow, then link it
            here to complete the guided-buying conversion.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <Link href="/requests/new" className="button button--secondary">
              <ExternalLink size={16} />
              Open request form
            </Link>

            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !canLink}
              title={
                canLink
                  ? undefined
                  : `No purchase request in ${intake.departmentName} and ${intake.currency} is available to link`
              }
              onClick={() => setLinking(true)}
            >
              <Link2 size={16} />
              Link request
            </button>
          </div>
        </section>
      ) : null}

      {linking ? (
        <LinkRequestModal
          intake={intake}
          requests={availableRequests}
          onClose={() => setLinking(false)}
          onSaved={handleLinked}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, intake)}
          confirmLabel={FLOWS[flow].confirm}
          busyLabel={FLOWS[flow].busy}
          cancelLabel={FLOWS[flow].keep}
          busy={flowRunning}
          onConfirm={() => void confirmFlow()}
          onCancel={() => setFlow(null)}
        />
      ) : null}
    </div>
  );
}
