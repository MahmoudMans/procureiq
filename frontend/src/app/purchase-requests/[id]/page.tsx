"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  CircleAlert,
  FileText,
  Info,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  Skeleton,
  StatusBadge,
  formatDate,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { ApprovalHistory } from "@/components/purchase-requests/approval-history";
import { PurchaseRequestForm } from "@/components/purchase-requests/purchase-request-form";
import {
  cancelPurchaseRequest,
  getPurchaseRequest,
  submitPurchaseRequest,
  updatePurchaseRequest,
} from "@/lib/api";
import type { PurchaseRequest, PurchaseRequestInput } from "@/types/purchase-request";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RequestItem = PurchaseRequest["items"][number];
type RequestAction = "SUBMIT" | "CANCEL";

const MANAGER_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

interface ActionCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
  tone: "primary" | "danger";
}

const ACTIONS: Record<RequestAction, ActionCopy> = {
  SUBMIT: {
    eyebrow: "Submit for approval",
    title: "Submit this request?",
    confirm: "Submit request",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Request submitted",
    failed: "Could not submit the request",
    tone: "primary",
  },
  CANCEL: {
    eyebrow: "Cancel request",
    title: "Cancel this request?",
    confirm: "Cancel request",
    busy: "Cancelling…",
    keep: "Keep request",
    done: "Request cancelled",
    failed: "Could not cancel the request",
    tone: "danger",
  },
};

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Today's date in the browser's time zone, as YYYY-MM-DD. */
function localIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function actionDescription(action: RequestAction, request: PurchaseRequest): string {
  const amount = money(request.estimatedTotalAmount, request.currency);

  if (action === "SUBMIT") {
    return `${request.requestNumber} for ${amount} will be submitted into the approval workflow. It can no longer be edited as a draft.`;
  }

  return `${request.requestNumber} will be cancelled and withdrawn from procurement.`;
}

function guidance(status: string): string | null {
  switch (status) {
    case "DRAFT":
      return "This request is a draft. Review the details, then submit it for approval.";

    case "SUBMITTED":
      return "Submitted and waiting for approval. The approval history below shows who has to decide.";

    case "APPROVED":
      return "Approved. This request can now move into sourcing.";

    case "REJECTED":
      return "Rejected. The approval history below explains the decision.";

    case "CANCELLED":
      return "This request was cancelled and is now read-only.";

    default:
      return null;
  }
}

function toFormValue(request: PurchaseRequest): PurchaseRequestInput {
  return {
    title: request.title,
    description: request.description ?? "",
    businessJustification: request.businessJustification,
    costCenter: request.costCenter,
    currency: request.currency,
    desiredDeliveryDate: request.desiredDeliveryDate,
    items: request.items.map((item) => ({
      itemName: item.itemName,
      description: item.description ?? "",
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      estimatedUnitPrice: item.estimatedUnitPrice,
    })),
  };
}

function buildItemColumns(currency: string): Column<RequestItem>[] {
  return [
    {
      id: "line",
      header: "Line",
      width: 70,
      sortValue: (item) => item.lineNumber,
      cell: (item) => item.lineNumber,
    },
    {
      id: "item",
      header: "Item",
      sortValue: (item) => item.itemName.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.itemName}</strong>

          <span>{item.description ?? "No description"}</span>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortValue: (item) => (item.category ?? "").toLowerCase(),
      cell: (item) => item.category ?? "—",
    },
    {
      id: "quantity",
      header: "Qty",
      align: "right",
      sortValue: (item) => item.quantity,
      cell: (item) => <span className="kit-num">{item.quantity}</span>,
    },
    {
      id: "unit",
      header: "Unit",
      sortValue: (item) => item.unit,
      cell: (item) => item.unit,
    },
    {
      id: "unitPrice",
      header: "Unit price",
      align: "right",
      sortValue: (item) => item.estimatedUnitPrice,
      cell: (item) => (
        <span className="kit-num">{money(item.estimatedUnitPrice, currency)}</span>
      ),
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: (item) => item.estimatedLineTotal,
      firstSort: "desc",
      cell: (item) => (
        <strong className="kit-num">{money(item.estimatedLineTotal, currency)}</strong>
      ),
    },
  ];
}

interface RequestData {
  id: string;
  request: PurchaseRequest;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PurchaseRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const [result, setResult] = useState<RequestData | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<RequestAction | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getPurchaseRequest(id);

        if (active) {
          setResult({ id, request: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load purchase request.",
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

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(localIsoDate()), 0);

    return () => window.clearTimeout(timer);
  }, [result]);

  const data = result !== null && result.id === params.id ? result : null;
  const request = data?.request ?? null;

  const owner = user !== null && request !== null && user.id === request.requesterId;
  const manager = user !== null && MANAGER_ROLES.includes(user.role);
  const canModify = request !== null && (owner || manager);
  const canEdit = canModify && request?.status === "DRAFT";
  const canSubmit = canModify && request?.status === "DRAFT";
  const canCancel =
    canModify && (request?.status === "DRAFT" || request?.status === "SUBMITTED");

  async function handleSave(value: PurchaseRequestInput) {
    if (!request) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const updated = await updatePurchaseRequest(request.id, value);

      setResult((current) => (current ? { ...current, request: updated } : current));

      toast.success("Draft saved", updated.requestNumber);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to save purchase request.";

      setFormError(message);
      toast.error("Could not save the draft", message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!request || pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setActionRunning(true);

    try {
      const updated =
        action === "SUBMIT"
          ? await submitPurchaseRequest(request.id)
          : await cancelPurchaseRequest(request.id);

      setResult((current) => (current ? { ...current, request: updated } : current));
      setPendingAction(null);

      toast.success(ACTIONS[action].done, updated.requestNumber);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the purchase request.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  if (request === null) {
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
        <Link href="/purchase-requests" className="request-back-link">
          <ArrowLeft size={16} />
          Purchase requests
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const open = request.status === "DRAFT" || request.status === "SUBMITTED";
  const deliveryPassed =
    today !== null && open && request.desiredDeliveryDate < today;
  const note = guidance(request.status);
  const lineCount = request.items.length;

  const kpis: KpiItem[] = [
    {
      label: "Requester",
      icon: UserRound,
      value: request.requesterName,
      note: request.departmentName,
    },
    {
      label: "Desired delivery",
      icon: CalendarDays,
      value: formatDate(request.desiredDeliveryDate),
      note: deliveryPassed ? `${request.costCenter} · date has passed` : request.costCenter,
      tone: deliveryPassed ? "warning" : "default",
    },
    {
      label: "Estimated value",
      icon: FileText,
      value: money(request.estimatedTotalAmount, request.currency),
      note: `${lineCount} ${lineCount === 1 ? "line" : "lines"}`,
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/purchase-requests" className="request-back-link">
        <ArrowLeft size={16} />
        Purchase requests
      </Link>

      <section className="request-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{request.requestNumber}</span>

            <StatusBadge value={request.status} />
          </div>

          <h1>{request.title}</h1>

          <p>{request.description ?? "No additional request description."}</p>
        </div>

        <div className="request-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canCancel ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={actionRunning}
              onClick={() => setPendingAction("CANCEL")}
            >
              <Ban size={16} />
              Cancel request
            </button>
          ) : null}

          {canSubmit ? (
            <button
              type="button"
              className="button button--primary"
              disabled={actionRunning}
              onClick={() => setPendingAction("SUBMIT")}
            >
              <Send size={16} />
              Submit request
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {deliveryPassed ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Delivery date has passed.</strong> The desired delivery date was{" "}
            {formatDate(request.desiredDeliveryDate)}.
            {request.status === "DRAFT"
              ? " Update it before submitting the request."
              : " Let the approvers know if the need is still open."}
          </div>
        </div>
      ) : note ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>{note}</div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Purchase request summary" />

      <ApprovalHistory
        key={`${request.status}-${request.version}`}
        purchaseRequestId={request.id}
      />

      {canEdit ? (
        <PurchaseRequestForm
          key={request.version}
          initialValue={toFormValue(request)}
          submitLabel="Save draft"
          submitting={saving}
          error={formError}
          onSubmit={handleSave}
        />
      ) : (
        <>
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Business requirement</span>

                <h2>Request justification</h2>
              </div>
            </div>

            <div className="request-readonly-copy">
              <p>{request.businessJustification}</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Requested goods &amp; services</span>

                <h2>Line items</h2>
              </div>

              <strong className="po-total-highlight">
                {money(request.estimatedTotalAmount, request.currency)}
              </strong>
            </div>

            <DataTable
              columns={buildItemColumns(request.currency)}
              rows={request.items}
              getRowId={(item) => String(item.id ?? item.lineNumber)}
              ariaLabel="Purchase request line items"
              empty={
                <EmptyState
                  compact
                  icon={FileText}
                  title="No line items"
                  description="This request has no line items."
                />
              }
            />
          </section>
        </>
      )}

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={ACTIONS[pendingAction].eyebrow}
          title={ACTIONS[pendingAction].title}
          description={actionDescription(pendingAction, request)}
          confirmLabel={ACTIONS[pendingAction].confirm}
          busyLabel={ACTIONS[pendingAction].busy}
          cancelLabel={ACTIONS[pendingAction].keep}
          tone={ACTIONS[pendingAction].tone}
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        >
          {pendingAction === "SUBMIT" && deliveryPassed ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              The desired delivery date ({formatDate(request.desiredDeliveryDate)}) has
              already passed.
            </p>
          ) : null}

          {pendingAction === "SUBMIT" && request.estimatedTotalAmount <= 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              The estimated value is zero. Check the unit prices before submitting.
            </p>
          ) : null}

          {pendingAction === "CANCEL" && request.status === "SUBMITTED" ? (
            <p className="kit-dialog-note">
              This request is already in the approval workflow.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}
    </div>
  );
}
