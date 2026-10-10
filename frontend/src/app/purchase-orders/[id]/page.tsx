"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileText,
  Info,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
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
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { DeliveryWorkspace } from "@/components/deliveries/delivery-workspace";
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  issuePurchaseOrder,
  reopenPurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/api";
import type { PurchaseOrder } from "@/types/purchase-order";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type OrderLine = PurchaseOrder["lines"][number];
type OrderAction = "ISSUE" | "REOPEN" | "CANCEL";

const DAY_MS = 86400000;

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

const ACTIONS: Record<OrderAction, ActionCopy> = {
  ISSUE: {
    eyebrow: "Issue purchase order",
    title: "Issue this purchase order?",
    confirm: "Issue purchase order",
    busy: "Issuing…",
    keep: "Not yet",
    done: "Purchase order issued",
    failed: "Could not issue the purchase order",
    tone: "primary",
  },
  REOPEN: {
    eyebrow: "Reopen for revision",
    title: "Reopen this purchase order?",
    confirm: "Reopen as draft",
    busy: "Reopening…",
    keep: "Not yet",
    done: "Purchase order reopened as a draft",
    failed: "Could not reopen the purchase order",
    tone: "primary",
  },
  CANCEL: {
    eyebrow: "Cancel purchase order",
    title: "Cancel this purchase order?",
    confirm: "Cancel PO",
    busy: "Cancelling…",
    keep: "Keep PO",
    done: "Purchase order cancelled",
    failed: "Could not cancel the purchase order",
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

/** Whole days from one YYYY-MM-DD date to another (negative = the second is earlier). */
function daysBetween(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00`);
  const end = Date.parse(`${to}T00:00:00`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.round((end - start) / DAY_MS);
}

interface DeliveryState {
  text: string;
  late: boolean;
}

function deliveryState(
  status: string,
  expected: string,
  today: string | null,
): DeliveryState | null {
  if ((status !== "ISSUED" && status !== "PARTIALLY_RECEIVED") || today === null) {
    return null;
  }

  const days = daysBetween(today, expected);

  if (days === null) {
    return null;
  }

  if (days < 0) {
    return { text: `${-days} ${-days === 1 ? "day" : "days"} overdue`, late: true };
  }

  if (days === 0) {
    return { text: "due today", late: false };
  }

  return { text: `${days} ${days === 1 ? "day" : "days"} left`, late: false };
}

function guidance(status: string): string | null {
  switch (status) {
    case "DRAFT":
      return "This purchase order is a draft. Confirm the delivery details, then issue it to commit the spend.";

    case "ISSUED":
      return "Issued. Record each delivery below as the goods arrive.";

    case "PARTIALLY_RECEIVED":
      return "Part of this order has been received. Record the remaining deliveries below.";

    case "RECEIVED":
      return "Fully received. What remains is invoice matching and payment.";

    default:
      return null;
  }
}

function actionDescription(action: OrderAction, order: PurchaseOrder): string {
  const amount = money(order.totalAmount, order.currency);

  if (action === "ISSUE") {
    return `${order.poNumber} for ${amount} with ${order.supplierName} will be issued and become a purchase commitment. Deliveries can then be recorded against it.`;
  }

  if (action === "REOPEN") {
    return `${order.poNumber} goes back to a draft so you can correct it. ${order.supplierName} will not see it again until you issue it, and their response is cleared.`;
  }

  return `${order.poNumber} for ${amount} with ${order.supplierName} will be cancelled.`;
}

function buildLineColumns(currency: string): Column<OrderLine>[] {
  return [
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
      header: "Qty",
      align: "right",
      sortValue: (line) => line.quantity,
      cell: (line) => (
        <span className="kit-num">
          {line.quantity} {line.unit}
        </span>
      ),
    },
    {
      id: "unitPrice",
      header: "Unit price",
      align: "right",
      sortValue: (line) => line.unitPrice,
      cell: (line) => <span className="kit-num">{money(line.unitPrice, currency)}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: (line) => line.lineTotal,
      firstSort: "desc",
      cell: (line) => <strong className="kit-num">{money(line.lineTotal, currency)}</strong>,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Delivery details form (drafts only)                                 */
/* ------------------------------------------------------------------ */

interface DeliveryValues {
  expected: string;
  address: string;
  notes: string;
}

function valuesOf(order: PurchaseOrder): DeliveryValues {
  return {
    expected: order.expectedDeliveryDate,
    address: order.deliveryAddress,
    notes: order.buyerNotes ?? "",
  };
}

function isDirty(values: DeliveryValues, order: PurchaseOrder): boolean {
  const base = valuesOf(order);

  return (
    values.expected !== base.expected ||
    values.address.trim() !== base.address.trim() ||
    values.notes.trim() !== base.notes.trim()
  );
}

interface DeliveryFormProps {
  order: PurchaseOrder;
  onSaved: (updated: PurchaseOrder) => void;
  onDirtyChange: (dirty: boolean) => void;
}

function DeliveryForm({ order, onSaved, onDirtyChange }: DeliveryFormProps) {
  const toast = useToast();

  const [values, setValues] = useState<DeliveryValues>(() => valuesOf(order));
  const [errors, setErrors] = useState<{ expected?: string; address?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(values, order);

  function change(patch: Partial<DeliveryValues>) {
    const next = { ...values, ...patch };

    setValues(next);
    onDirtyChange(isDirty(next, order));
  }

  function reset() {
    setValues(valuesOf(order));
    setErrors({});
    setFormError(null);
    onDirtyChange(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: { expected?: string; address?: string } = {};

    if (!values.expected) {
      next.expected = "Choose the expected delivery date.";
    }

    if (!values.address.trim()) {
      next.address = "Enter the delivery address.";
    }

    setErrors(next);

    if (next.expected || next.address) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const updated = await updatePurchaseOrder(order.id, {
        expectedDeliveryDate: values.expected,
        deliveryAddress: values.address.trim(),
        buyerNotes: values.notes.trim() || undefined,
      });

      onSaved(updated);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to update purchase order.";

      setFormError(message);
      toast.error("Could not save the delivery details", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div className="panel__header">
        <div>
          <span className="eyebrow">Order logistics</span>

          <h2>Delivery details</h2>
        </div>
      </div>

      <div className="kit-pair-grid">
        <Field label="Expected delivery" htmlFor="po-expected" error={errors.expected}>
          <input
            id="po-expected"
            className="kit-field-input"
            type="date"
            value={values.expected}
            aria-invalid={errors.expected ? true : undefined}
            onChange={(event) => {
              change({ expected: event.target.value });
              setErrors((current) => ({ ...current, expected: undefined }));
            }}
          />
        </Field>

        <div className="kit-pair-wide">
          <Field label="Delivery address" htmlFor="po-address" error={errors.address}>
            <textarea
              id="po-address"
              className="kit-field-input"
              rows={4}
              maxLength={1000}
              value={values.address}
              aria-invalid={errors.address ? true : undefined}
              onChange={(event) => {
                change({ address: event.target.value });
                setErrors((current) => ({ ...current, address: undefined }));
              }}
            />
          </Field>
        </div>

        <div className="kit-pair-wide">
          <Field label="Buyer notes" htmlFor="po-notes">
            <textarea
              id="po-notes"
              className="kit-field-input"
              rows={4}
              maxLength={2000}
              value={values.notes}
              onChange={(event) => change({ notes: event.target.value })}
            />
          </Field>
        </div>
      </div>

      {formError ? (
        <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
          <CircleAlert size={18} />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="kit-form-footer">
        {dirty ? <span className="kit-form-state">Unsaved changes</span> : null}

        {dirty ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={reset}
            disabled={saving}
          >
            Discard changes
          </button>
        ) : null}

        <button type="submit" className="button button--primary" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save PO draft"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface OrderData {
  id: string;
  order: PurchaseOrder;
}

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const [result, setResult] = useState<OrderData | null>(null);
  const [pendingAction, setPendingAction] = useState<OrderAction | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [unsavedId, setUnsavedId] = useState<string | null>(null);
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
        const response = await getPurchaseOrder(id);

        if (active) {
          setResult({ id, order: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load purchase order.",
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
  const order = data?.order ?? null;

  function handleOrderUpdated(updated: PurchaseOrder) {
    setResult((current) => (current ? { ...current, order: updated } : current));
  }

  function handleSaved(updated: PurchaseOrder) {
    handleOrderUpdated(updated);
    setUnsavedId(null);

    toast.success("Delivery details saved", updated.poNumber);
  }

  async function confirmAction() {
    if (!order || pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setActionRunning(true);

    try {
      const updated =
        action === "ISSUE"
          ? await issuePurchaseOrder(order.id)
          : action === "REOPEN"
            ? await reopenPurchaseOrder(order.id)
            : await cancelPurchaseOrder(order.id);

      handleOrderUpdated(updated);
      setUnsavedId(null);
      setPendingAction(null);

      toast.success(ACTIONS[action].done, updated.poNumber);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update purchase order status.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  if (order === null) {
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
        <Link href="/purchase-orders" className="request-back-link">
          <ArrowLeft size={16} />
          Purchase orders
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

  const hasUnsaved = unsavedId === String(order.id);
  const delivery = deliveryState(order.status, order.expectedDeliveryDate, today);
  const overdueNote = delivery !== null && delivery.late;
  const awaitingRevision =
    order.status === "ISSUED" && order.supplierResponse === "REJECTED";
  const note = awaitingRevision ? null : guidance(order.status);
  const lineCount = order.lines.length;

  const draftDatePassed =
    order.status === "DRAFT" &&
    today !== null &&
    order.expectedDeliveryDate < today;

  const showDeliveries =
    order.status === "ISSUED" ||
    order.status === "PARTIALLY_RECEIVED" ||
    order.status === "RECEIVED";

  const kpis: KpiItem[] = [
    {
      label: "Supplier",
      icon: Building2,
      value: order.supplierName,
      note: order.supplierCode,
    },
    {
      label: "Awarded quotation",
      icon: ReceiptText,
      value: order.quotationNumber,
      note: order.rfqNumber,
    },
    {
      label: "Expected delivery",
      icon: CalendarDays,
      value: formatDate(order.expectedDeliveryDate),
      note: delivery ? `${order.paymentTerms} · ${delivery.text}` : order.paymentTerms,
      tone: overdueNote || draftDatePassed ? "warning" : "default",
    },
    {
      label: "Order value",
      icon: FileText,
      value: money(order.totalAmount, order.currency),
      note: `${lineCount} ${lineCount === 1 ? "line" : "lines"}`,
    },
  ];

  const supplierAnswered = order.supplierResponse !== "PENDING";
  const showSupplierResponse =
    order.issuedAt !== null && (order.status !== "CANCELLED" || supplierAnswered);

  if (showSupplierResponse) {
    kpis.push({
      label: "Supplier response",
      icon: CheckCircle2,
      value:
        order.supplierResponse === "ACKNOWLEDGED"
          ? "Acknowledged"
          : order.supplierResponse === "REJECTED"
            ? "Rejected"
            : "Awaiting response",
      note: order.supplierRespondedAt
        ? formatDateTime(order.supplierRespondedAt)
        : `${order.supplierName} has not answered yet`,
      tone: order.supplierResponse === "REJECTED" ? "warning" : "default",
    });
  }

  return (
    <div className="page-stack">
      <Link href="/purchase-orders" className="request-back-link">
        <ArrowLeft size={16} />
        Purchase orders
      </Link>

      <section className="po-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{order.poNumber}</span>

            <StatusBadge value={order.status} />
          </div>

          <h1>{order.supplierName}</h1>

          <p>
            Purchase commitment generated from awarded sourcing event {order.rfqNumber}.
          </p>
        </div>

        <div className="po-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {order.status === "ISSUED" && order.supplierResponse === "REJECTED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={actionRunning}
              onClick={() => setPendingAction("REOPEN")}
            >
              <RotateCcw size={16} />
              Reopen for revision
            </button>
          ) : null}

          {order.status === "DRAFT" || order.status === "ISSUED" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={actionRunning}
              onClick={() => setPendingAction("CANCEL")}
            >
              <Ban size={16} />
              Cancel PO
            </button>
          ) : null}

          {order.status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={actionRunning}
              onClick={() => setPendingAction("ISSUE")}
            >
              <PackageCheck size={16} />
              Issue purchase order
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

      {overdueNote ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Delivery is overdue.</strong> The expected delivery date was{" "}
            {formatDate(order.expectedDeliveryDate)}. Follow up with {order.supplierName}{" "}
            or record the delivery below.
          </div>
        </div>
      ) : draftDatePassed ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Expected delivery date has passed.</strong> Update it in the delivery
            details before issuing this order.
          </div>
        </div>
      ) : note ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>{note}</div>
        </div>
      ) : null}

      {order.supplierResponse === "REJECTED" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{order.supplierName} rejected this purchase order.</strong>{" "}
            {order.supplierResponseNote
              ? `Their reason: ${order.supplierResponseNote}. `
              : "No reason was given. "}
            {order.status === "ISSUED"
              ? "Reopen it for revision to correct the order and issue it again, or cancel it."
              : null}
          </div>
        </div>
      ) : order.supplierResponse === "ACKNOWLEDGED" && order.supplierResponseNote ? (
        <div className="kit-callout kit-callout--info" role="status">
          <CheckCircle2 size={17} />

          <div>
            <strong>{order.supplierName} acknowledged this purchase order.</strong>{" "}
            {`Their note: ${order.supplierResponseNote}`}
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Purchase order summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Commercial commitment</span>

            <h2>Purchase order lines</h2>
          </div>

          <strong className="po-total-highlight">
            {money(order.totalAmount, order.currency)}
          </strong>
        </div>

        <DataTable
          columns={buildLineColumns(order.currency)}
          rows={order.lines}
          getRowId={(line) => String(line.id ?? line.lineNumber)}
          ariaLabel="Purchase order lines"
          empty={
            <EmptyState
              compact
              icon={FileText}
              title="No order lines"
              description="This purchase order has no lines."
            />
          }
        />

        <div className="po-commercial-summary">
          <div>
            <span>Subtotal</span>

            <strong>{money(order.subtotal, order.currency)}</strong>
          </div>

          <div>
            <span>Discount</span>

            <strong>-{money(order.discountAmount, order.currency)}</strong>
          </div>

          <div>
            <span>Shipping</span>

            <strong>{money(order.shippingAmount, order.currency)}</strong>
          </div>

          <div>
            <span>Tax</span>

            <strong>{money(order.taxAmount, order.currency)}</strong>
          </div>

          <div className="po-commercial-summary__total">
            <span>Final total</span>

            <strong>{money(order.totalAmount, order.currency)}</strong>
          </div>
        </div>
      </section>

      {showDeliveries ? (
        <DeliveryWorkspace order={order} onOrderUpdated={handleOrderUpdated} />
      ) : null}

      {order.status === "DRAFT" ? (
        <DeliveryForm
          key={String(order.id)}
          order={order}
          onSaved={handleSaved}
          onDirtyChange={(dirty) => setUnsavedId(dirty ? String(order.id) : null)}
        />
      ) : (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Delivery instructions</span>

              <h2>Receiving information</h2>
            </div>
          </div>

          <div className="po-readonly-grid">
            <div>
              <span>Address</span>

              <p>{order.deliveryAddress}</p>
            </div>

            <div>
              <span>Buyer notes</span>

              <p>{order.buyerNotes ?? "No buyer notes."}</p>
            </div>

            {order.issuedAt ? (
              <div>
                <span>Issued</span>

                <p>
                  {formatDateTime(order.issuedAt)}
                  {" by "}
                  {order.issuedByName}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={ACTIONS[pendingAction].eyebrow}
          title={ACTIONS[pendingAction].title}
          description={actionDescription(pendingAction, order)}
          confirmLabel={ACTIONS[pendingAction].confirm}
          busyLabel={ACTIONS[pendingAction].busy}
          cancelLabel={ACTIONS[pendingAction].keep}
          tone={ACTIONS[pendingAction].tone}
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        >
          {pendingAction === "ISSUE" && hasUnsaved ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              You have unsaved delivery changes. They will not be part of the issued order
              unless you save them first.
            </p>
          ) : null}

          {pendingAction === "ISSUE" && draftDatePassed ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              The expected delivery date ({formatDate(order.expectedDeliveryDate)}) has
              already passed.
            </p>
          ) : null}

          {pendingAction === "ISSUE" && lineCount === 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              This order has no lines.
            </p>
          ) : null}

          {pendingAction === "REOPEN" ? (
            <p className="kit-dialog-note">
              {order.supplierResponseNote
                ? `Their reason: ${order.supplierResponseNote}. `
                : ""}
              The supplier will not see the order again until you issue it.
            </p>
          ) : null}

          {pendingAction === "CANCEL" && order.status === "ISSUED" ? (
            <p className="kit-dialog-note">This order has already been issued.</p>
          ) : null}
        </ActionDialog>
      ) : null}
    </div>
  );
}
