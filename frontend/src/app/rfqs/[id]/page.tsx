"use client";

import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CircleAlert,
  FileText,
  LockKeyhole,
  Send,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  Skeleton,
  StatusBadge,
  formatDate,
  formatMoney,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { QuotationWorkspace } from "@/components/quotations/quotation-workspace";
import { RfqForm } from "@/components/rfqs/rfq-form";
import {
  cancelRfq,
  closeRfq,
  getRfq,
  getSuppliers,
  publishRfq,
  updateRfq,
} from "@/lib/api";
import type { Rfq, RfqUpdateInput } from "@/types/rfq";
import type { Supplier } from "@/types/supplier";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RfqLine = Rfq["lineItems"][number];
type RfqInvitation = Rfq["invitations"][number];
type RfqAction = "PUBLISH" | "CLOSE" | "CANCEL";

const SOURCING_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const EVALUABLE_STATUSES = ["PUBLISHED", "CLOSED", "AWARDED"];

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

const ACTIONS: Record<RfqAction, ActionCopy> = {
  PUBLISH: {
    eyebrow: "Publish RFQ",
    title: "Publish this RFQ?",
    confirm: "Publish RFQ",
    busy: "Publishing…",
    keep: "Not yet",
    done: "RFQ published",
    failed: "Could not publish the RFQ",
    tone: "primary",
  },
  CLOSE: {
    eyebrow: "Close RFQ",
    title: "Close this RFQ?",
    confirm: "Close RFQ",
    busy: "Closing…",
    keep: "Keep open",
    done: "RFQ closed",
    failed: "Could not close the RFQ",
    tone: "primary",
  },
  CANCEL: {
    eyebrow: "Cancel RFQ",
    title: "Cancel this RFQ?",
    confirm: "Cancel RFQ",
    busy: "Cancelling…",
    keep: "Keep RFQ",
    done: "RFQ cancelled",
    failed: "Could not cancel the RFQ",
    tone: "danger",
  },
};

function actionDescription(action: RfqAction, rfq: Rfq): string {
  const invited = rfq.invitations.length;

  switch (action) {
    case "PUBLISH":
      return `${rfq.rfqNumber} will be opened to ${invited} invited ${
        invited === 1 ? "supplier" : "suppliers"
      } and can no longer be edited as a draft.`;

    case "CLOSE":
      return `Closing ${rfq.rfqNumber} ends the response period so the received quotations can be evaluated.`;

    case "CANCEL":
      return `${rfq.rfqNumber} will be marked as cancelled.`;
  }
}

function toFormValue(rfq: Rfq): RfqUpdateInput {
  return {
    title: rfq.title,
    description: rfq.description ?? "",
    responseDeadline: rfq.responseDeadline.slice(0, 16),
    supplierIds: rfq.invitations.map((invitation) => invitation.supplierId),
  };
}

interface DeadlineNote {
  text: string;
  late: boolean;
}

function deadlineNote(
  deadline: string,
  status: string,
  now: number | null,
): DeadlineNote | null {
  if (status !== "PUBLISHED" || now === null) {
    return null;
  }

  const target = Date.parse(deadline);

  if (Number.isNaN(target)) {
    return null;
  }

  const diff = target - now;

  if (diff < 0) {
    return { text: "Deadline passed. Close the RFQ to evaluate.", late: true };
  }

  const hours = Math.ceil(diff / 3600000);

  if (hours < 24) {
    return { text: `Closes in ${hours}h`, late: false };
  }

  const days = Math.ceil(hours / 24);

  return { text: `${days} ${days === 1 ? "day" : "days"} left`, late: false };
}

const LINE_COLUMNS: Column<RfqLine>[] = [
  {
    id: "line",
    header: "Line",
    width: 70,
    sortValue: (line) => line.lineNumber,
    cell: (line) => line.lineNumber,
  },
  {
    id: "item",
    header: "Item",
    sortValue: (line) => line.itemName.toLowerCase(),
    cell: (line) => (
      <div className="request-primary-cell">
        <strong>{line.itemName}</strong>

        <span>{line.description ?? "No description"}</span>
      </div>
    ),
  },
  {
    id: "category",
    header: "Category",
    sortValue: (line) => (line.category ?? "").toLowerCase(),
    cell: (line) => line.category ?? "—",
  },
  {
    id: "quantity",
    header: "Quantity",
    align: "right",
    sortValue: (line) => line.quantity,
    cell: (line) => <span className="kit-num">{line.quantity}</span>,
  },
  {
    id: "unit",
    header: "Unit",
    sortValue: (line) => line.unit,
    cell: (line) => line.unit,
  },
];

const INVITATION_COLUMNS: Column<RfqInvitation>[] = [
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (invitation) => invitation.supplierName.toLowerCase(),
    cell: (invitation) => (
      <div className="request-primary-cell">
        <strong>
          <Link
            href={`/suppliers/${invitation.supplierId}`}
            className="supplier360-table-link"
          >
            {invitation.supplierName}
          </Link>
        </strong>

        <span>{invitation.supplierCode}</span>
      </div>
    ),
  },
  {
    id: "country",
    header: "Country",
    sortValue: (invitation) => (invitation.country ?? "").toLowerCase(),
    cell: (invitation) => invitation.country ?? "—",
  },
  {
    id: "category",
    header: "Category",
    sortValue: (invitation) => (invitation.category ?? "").toLowerCase(),
    cell: (invitation) => invitation.category ?? "—",
  },
  {
    id: "status",
    header: "Invitation",
    sortValue: (invitation) => invitation.status,
    cell: (invitation) => <StatusBadge value={invitation.status} />,
  },
];

interface RfqData {
  id: string;
  rfq: Rfq;
  suppliers: Supplier[];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function RfqDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const allowed = user !== null && SOURCING_ROLES.includes(user.role);

  const [result, setResult] = useState<RfqData | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<RfqAction | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setError(null);

      try {
        const [rfqResponse, supplierResponse] = await Promise.all([
          getRfq(id),
          getSuppliers({ status: "ACTIVE" }),
        ]);

        if (active) {
          setResult({ id, rfq: rfqResponse, suppliers: supplierResponse });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load RFQ.");
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [allowed, params.id, reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);

    return () => window.clearTimeout(timer);
  }, [result]);

  const data = result !== null && result.id === params.id ? result : null;
  const rfq = data?.rfq ?? null;

  async function handleSave(value: RfqUpdateInput) {
    if (!rfq) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const updated = await updateRfq(rfq.id, value);

      setResult((current) => (current ? { ...current, rfq: updated } : current));

      toast.success("RFQ draft saved", updated.rfqNumber);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to update RFQ.";

      setFormError(message);
      toast.error("Could not save the RFQ", message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!rfq || pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setActionRunning(true);

    try {
      let updated: Rfq;

      if (action === "PUBLISH") {
        updated = await publishRfq(rfq.id);
      } else if (action === "CLOSE") {
        updated = await closeRfq(rfq.id);
      } else {
        updated = await cancelRfq(rfq.id);
      }

      setResult((current) => (current ? { ...current, rfq: updated } : current));
      setPendingAction(null);

      toast.success(ACTIONS[action].done, updated.rfqNumber);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update RFQ status.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="Access restricted"
            description="Your role cannot access this sourcing event."
          />
        </section>
      </div>
    );
  }

  if (rfq === null) {
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
        <Link href="/rfqs" className="request-back-link">
          <ArrowLeft size={16} />
          RFQs &amp; sourcing
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

  const canEvaluate = EVALUABLE_STATUSES.includes(rfq.status);
  const deadline = deadlineNote(rfq.responseDeadline, rfq.status, now);
  const suppliers = data?.suppliers ?? [];

  return (
    <div className="page-stack">
      <Link href="/rfqs" className="request-back-link">
        <ArrowLeft size={16} />
        RFQs &amp; sourcing
      </Link>

      <section className="rfq-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{rfq.rfqNumber}</span>

            <StatusBadge value={rfq.status} />
          </div>

          <h1>{rfq.title}</h1>

          <p>{rfq.description ?? "No sourcing instructions have been provided."}</p>
        </div>

        <div className="rfq-detail-actions">
          {canEvaluate ? (
            <Link href={`/rfqs/${rfq.id}/evaluate`} className="button button--secondary">
              Evaluate suppliers
            </Link>
          ) : null}

          {rfq.status === "AWARDED" ? (
            <Link href="/purchase-orders/new" className="button button--primary">
              Create purchase order
            </Link>
          ) : null}

          {rfq.status === "DRAFT" || rfq.status === "PUBLISHED" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={actionRunning}
              onClick={() => setPendingAction("CANCEL")}
            >
              <Ban size={16} />
              Cancel
            </button>
          ) : null}

          {rfq.status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={actionRunning}
              onClick={() => setPendingAction("PUBLISH")}
            >
              <Send size={16} />
              Publish RFQ
            </button>
          ) : null}

          {rfq.status === "PUBLISHED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={actionRunning}
              onClick={() => setPendingAction("CLOSE")}
            >
              <LockKeyhole size={16} />
              Close RFQ
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

      <section className="rfq-detail-summary-grid">
        <article className="request-detail-summary-card">
          <FileText size={18} />

          <div>
            <span>Source request</span>

            <strong>{rfq.purchaseRequestNumber}</strong>

            <small>{rfq.purchaseRequestTitle}</small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Building2 size={18} />

          <div>
            <span>Suppliers invited</span>

            <strong>{rfq.invitations.length}</strong>

            <small>{rfq.departmentName}</small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <CalendarDays size={18} />

          <div>
            <span>Response deadline</span>

            <strong>{formatDate(rfq.responseDeadline)}</strong>

            <small>
              {new Date(rfq.responseDeadline).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>

            {deadline ? (
              <small
                className={
                  deadline.late
                    ? "kit-deadline-note kit-deadline-note--late"
                    : "kit-deadline-note"
                }
              >
                {deadline.text}
              </small>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Approved requirement</span>

            <h2>RFQ line items</h2>
          </div>

          <strong className="rfq-approved-value">
            {formatMoney(rfq.purchaseRequestValue, rfq.currency)}
          </strong>
        </div>

        <DataTable
          columns={LINE_COLUMNS}
          rows={rfq.lineItems}
          getRowId={(line) => String(line.id ?? line.lineNumber)}
          ariaLabel="RFQ line items"
          empty={
            <EmptyState
              compact
              icon={FileText}
              title="No line items"
              description="This RFQ has no line items."
            />
          }
        />
      </section>

      <QuotationWorkspace rfq={rfq} />

      {rfq.status === "DRAFT" ? (
        <RfqForm
          key={rfq.version}
          suppliers={suppliers}
          initialValue={toFormValue(rfq)}
          submitting={saving}
          submitLabel="Save RFQ draft"
          error={formError}
          onSubmit={handleSave}
        />
      ) : (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Supplier competition</span>

              <h2>Invited suppliers</h2>
            </div>
          </div>

          <DataTable
            columns={INVITATION_COLUMNS}
            rows={rfq.invitations}
            getRowId={(invitation) => String(invitation.id ?? invitation.supplierId)}
            ariaLabel="Invited suppliers"
            empty={
              <EmptyState
                compact
                icon={Building2}
                title="No suppliers invited"
                description="No supplier invitations exist for this RFQ."
              />
            }
          />
        </section>
      )}

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={ACTIONS[pendingAction].eyebrow}
          title={ACTIONS[pendingAction].title}
          description={actionDescription(pendingAction, rfq)}
          confirmLabel={ACTIONS[pendingAction].confirm}
          busyLabel={ACTIONS[pendingAction].busy}
          cancelLabel={ACTIONS[pendingAction].keep}
          tone={ACTIONS[pendingAction].tone}
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        >
          {pendingAction === "PUBLISH" && rfq.invitations.length === 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              No suppliers are invited yet. Add invitations to the draft before publishing.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}
    </div>
  );
}
