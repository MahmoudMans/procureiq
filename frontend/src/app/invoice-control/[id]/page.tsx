"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  FileCheck2,
  Info,
  PauseCircle,
  PlayCircle,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
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
  Meter,
  SegmentedFilter,
  type SegmentedOption,
  Skeleton,
  type StatItem,
  StatStrip,
  StatusBadge,
  formatDate,
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  approveProcurementInvoice,
  cancelProcurementInvoice,
  dismissInvoiceException,
  getProcurementInvoice,
  holdProcurementInvoice,
  markProcurementInvoicePaid,
  markProcurementInvoiceReady,
  releaseProcurementInvoiceHold,
  resolveInvoiceException,
  runInvoiceMatch,
} from "@/lib/api";
import type { InvoiceMatchException, ProcurementInvoice } from "@/types/invoice-control";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type InvoiceLine = ProcurementInvoice["lines"][number];
type InvoiceAction = "APPROVE" | "READY" | "PAID" | "RELEASE";

type RationaleRequest =
  | { kind: "HOLD" }
  | { kind: "CANCEL" }
  | { kind: "RESOLVE"; exception: InvoiceMatchException }
  | { kind: "DISMISS"; exception: InvoiceMatchException };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "APPROVER"];
const PAY_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const MATCHABLE_STATUSES = ["MATCH_PENDING", "MATCHED", "EXCEPTION"];
const HOLDABLE_STATUSES = ["MATCHED", "APPROVED", "READY_FOR_PAYMENT"];
const CLOSED_STATUSES = ["PAID", "CANCELLED"];

const SEVERITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

interface ActionCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const ACTIONS: Record<InvoiceAction, ActionCopy> = {
  APPROVE: {
    eyebrow: "Approve invoice",
    title: "Approve this invoice?",
    confirm: "Approve invoice",
    busy: "Approving…",
    keep: "Not yet",
    done: "Invoice approved",
    failed: "Could not approve the invoice",
  },
  READY: {
    eyebrow: "Payment preparation",
    title: "Mark ready for payment?",
    confirm: "Ready for payment",
    busy: "Updating…",
    keep: "Not yet",
    done: "Invoice ready for payment",
    failed: "Could not mark the invoice ready",
  },
  PAID: {
    eyebrow: "Record payment",
    title: "Mark this invoice as paid?",
    confirm: "Mark paid",
    busy: "Recording…",
    keep: "Not yet",
    done: "Invoice marked as paid",
    failed: "Could not mark the invoice paid",
  },
  RELEASE: {
    eyebrow: "Payment hold",
    title: "Release the payment hold?",
    confirm: "Release hold",
    busy: "Releasing…",
    keep: "Keep hold",
    done: "Payment hold released",
    failed: "Could not release the payment hold",
  },
};

function actionDescription(action: InvoiceAction, invoice: ProcurementInvoice): string {
  const amount = money(invoice.totalAmount, invoice.currency);

  switch (action) {
    case "APPROVE":
      return `${invoice.invoiceNumber} from ${invoice.supplierName} for ${amount} will be approved and can then be prepared for payment.`;

    case "READY":
      return `${invoice.invoiceNumber} for ${amount} will be released to payment execution.`;

    case "PAID":
      return `${invoice.invoiceNumber} for ${amount} will be recorded as paid and the invoice will be closed.`;

    case "RELEASE":
      return `The payment hold on ${invoice.invoiceNumber} will be lifted so processing can continue.`;
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
  keep: string;
  tone: "primary" | "danger";
  done: string;
  failed: string;
}

function rationaleCopy(request: RationaleRequest, invoice: ProcurementInvoice): RationaleCopy {
  switch (request.kind) {
    case "HOLD":
      return {
        eyebrow: "Payment control",
        title: "Place payment hold",
        description: `Payment of ${invoice.invoiceNumber} will be blocked until the hold is released.`,
        label: "Hold rationale",
        placeholder: "Why is payment being held?",
        confirm: "Place hold",
        busy: "Placing hold…",
        keep: "Cancel",
        tone: "primary",
        done: "Payment hold placed",
        failed: "Could not place the payment hold",
      };

    case "CANCEL":
      return {
        eyebrow: "Invoice governance",
        title: "Cancel this invoice?",
        description: `${invoice.invoiceNumber} will be cancelled and removed from payment processing.`,
        label: "Cancellation rationale",
        placeholder: "Why is this invoice being cancelled?",
        confirm: "Cancel invoice",
        busy: "Cancelling…",
        keep: "Keep invoice",
        tone: "danger",
        done: "Invoice cancelled",
        failed: "Could not cancel the invoice",
      };

    case "RESOLVE":
      return {
        eyebrow: "Match exception",
        title: "Resolve exception",
        description: `Record the evidence that clears: ${readable(request.exception.exceptionType)}.`,
        label: "Resolution evidence",
        placeholder: "Resolution evidence or correction made",
        confirm: "Resolve exception",
        busy: "Resolving…",
        keep: "Cancel",
        tone: "primary",
        done: "Exception resolved",
        failed: "Could not resolve the exception",
      };

    case "DISMISS":
      return {
        eyebrow: "Match exception",
        title: "Dismiss exception",
        description: `Dismissing accepts the variance without a correction: ${readable(request.exception.exceptionType)}.`,
        label: "Approval rationale",
        placeholder: "Why is this variance acceptable?",
        confirm: "Dismiss exception",
        busy: "Dismissing…",
        keep: "Cancel",
        tone: "danger",
        done: "Exception dismissed",
        failed: "Could not dismiss the exception",
      };
  }
}

function nextStep(invoice: ProcurementInvoice): string | null {
  switch (invoice.status) {
    case "MATCH_PENDING":
      return "The three-way match has not completed yet. Re-run it once the receipt and purchase order data are in place.";

    case "EXCEPTION":
      return `${invoice.openExceptions} open ${
        invoice.openExceptions === 1 ? "exception" : "exceptions"
      } must be resolved or dismissed before this invoice can be approved.`;

    case "MATCHED":
      return "The invoice matches its purchase order and receipt. It is ready for approval.";

    case "APPROVED":
      return "Approved. Mark it ready for payment when the payment run is prepared.";

    case "READY_FOR_PAYMENT":
      return "Ready for payment. Record the payment once finance has executed it.";

    default:
      return null;
  }
}

function buildLineColumns(currency: string): Column<InvoiceLine>[] {
  return [
    {
      id: "line",
      header: "#",
      width: 60,
      sortValue: (line) => line.lineNumber,
      cell: (line) => line.lineNumber,
    },
    {
      id: "description",
      header: "Description",
      sortValue: (line) => line.description.toLowerCase(),
      cell: (line) => line.description,
    },
    {
      id: "quantity",
      header: "Quantity",
      align: "right",
      sortValue: (line) => line.quantity,
      cell: (line) => <span className="kit-num">{line.quantity}</span>,
    },
    {
      id: "unitPrice",
      header: "Unit price",
      align: "right",
      sortValue: (line) => line.unitPrice,
      cell: (line) => <span className="kit-num">{money(line.unitPrice, currency)}</span>,
    },
    {
      id: "lineTotal",
      header: "Line total",
      align: "right",
      sortValue: (line) => line.lineTotal,
      firstSort: "desc",
      cell: (line) => <strong className="kit-num">{money(line.lineTotal, currency)}</strong>,
    },
  ];
}

interface InvoiceData {
  id: string;
  invoice: ProcurementInvoice;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);
  const canPay = user !== null && PAY_ROLES.includes(user.role);

  const [result, setResult] = useState<InvoiceData | null>(null);
  const [pendingAction, setPendingAction] = useState<InvoiceAction | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [exceptionView, setExceptionView] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setError(null);

      try {
        const response = await getProcurementInvoice(id);

        if (active) {
          setResult({ id, invoice: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load procurement invoice.",
          );
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, reloadKey]);

  const data = result !== null && result.id === params.id ? result : null;
  const invoice = data?.invoice ?? null;

  const busyAny = actionRunning || matching || rationaleRunning;

  async function rerunMatch() {
    if (!invoice || busyAny) {
      return;
    }

    setMatching(true);

    try {
      await runInvoiceMatch(invoice.id);

      toast.success("Three-way match re-run", invoice.invoiceNumber);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(
        "Could not re-run the match",
        caught instanceof Error ? caught.message : "Unable to rerun three-way match.",
      );
    } finally {
      setMatching(false);
    }
  }

  async function confirmAction() {
    if (!invoice || pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setActionRunning(true);

    try {
      if (action === "APPROVE") {
        await approveProcurementInvoice(invoice.id);
      } else if (action === "READY") {
        await markProcurementInvoiceReady(invoice.id);
      } else if (action === "PAID") {
        await markProcurementInvoicePaid(invoice.id);
      } else {
        await releaseProcurementInvoiceHold(invoice.id);
      }

      setPendingAction(null);

      toast.success(ACTIONS[action].done, invoice.invoiceNumber);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the invoice.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function confirmRationale(reason: string) {
    if (!invoice || rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, invoice);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      if (request.kind === "HOLD") {
        await holdProcurementInvoice(invoice.id, reason);
      } else if (request.kind === "CANCEL") {
        await cancelProcurementInvoice(invoice.id, reason);
      } else if (request.kind === "RESOLVE") {
        await resolveInvoiceException(request.exception.id, reason);
      } else {
        await dismissInvoiceException(request.exception.id, reason);
      }

      setRationale(null);

      toast.success(copy.done, invoice.invoiceNumber);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setRationaleError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(request: RationaleRequest) {
    setRationaleError(null);
    setRationale(request);
  }

  if (invoice === null) {
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
        <Link href="/invoice-control" className="request-back-link">
          <ArrowLeft size={16} />
          Invoice control
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

  const canRerunMatch = canManage && MATCHABLE_STATUSES.includes(invoice.status);
  const canHold = canManage && HOLDABLE_STATUSES.includes(invoice.status);
  const canCancel = canApprove && !CLOSED_STATUSES.includes(invoice.status);

  const guidance = nextStep(invoice);

  const sameCurrency = invoice.currency === invoice.purchaseOrderCurrency;
  const invoicedPct =
    sameCurrency && invoice.purchaseOrderTotal > 0
      ? (invoice.cumulativeInvoicedValue / invoice.purchaseOrderTotal) * 100
      : null;

  const linesTotal = invoice.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const lineColumns = buildLineColumns(invoice.currency);

  const openExceptions = invoice.exceptions.filter((exception) => exception.status === "OPEN");
  const view = exceptionView === "" ? (openExceptions.length > 0 ? "OPEN" : "ALL") : exceptionView;
  const shownExceptions = [...(view === "OPEN" ? openExceptions : invoice.exceptions)].sort(
    (a, b) =>
      (a.status === "OPEN" ? 0 : 1) - (b.status === "OPEN" ? 0 : 1) ||
      (SEVERITY_RANK[b.severity] ?? -1) - (SEVERITY_RANK[a.severity] ?? -1),
  );

  const exceptionOptions: SegmentedOption[] = [
    { value: "OPEN", label: `Open · ${openExceptions.length}` },
    { value: "ALL", label: `All · ${invoice.exceptions.length}` },
  ];

  const kpis: KpiItem[] = [
    {
      label: "Invoice total",
      icon: Coins,
      value: money(invoice.totalAmount, invoice.currency),
      note: `Tax ${money(invoice.taxAmount, invoice.currency)}`,
    },
    {
      label: "PO total",
      icon: ReceiptText,
      value: money(invoice.purchaseOrderTotal, invoice.purchaseOrderCurrency),
      note: readable(invoice.purchaseOrderStatus),
    },
    {
      label: "Open exceptions",
      icon: ShieldAlert,
      value: String(invoice.openExceptions),
      note: "Three-way match controls",
      tone: invoice.openExceptions > 0 ? "warning" : "default",
    },
    {
      label: "AP aging",
      icon: AlertTriangle,
      value: invoice.overdue ? `${invoice.agingDays} days` : "Current",
      note: `Due ${formatDate(invoice.dueDate)}`,
      tone: invoice.overdue ? "warning" : "default",
    },
  ];

  const lineStats: StatItem[] = [
    { label: "Lines subtotal", value: money(linesTotal, invoice.currency) },
    { label: "Tax", value: money(invoice.taxAmount, invoice.currency) },
    { label: "Invoice total", value: money(invoice.totalAmount, invoice.currency) },
  ];

  return (
    <div className="page-stack">
      <Link href="/invoice-control" className="request-back-link">
        <ArrowLeft size={16} />
        Invoice control
      </Link>

      <section className="invoice-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{invoice.invoiceNumber}</span>

            <StatusBadge value={invoice.status} />

            <StatusBadge
              value={invoice.matchStatus}
              label={`Match: ${readable(invoice.matchStatus)}`}
            />
          </div>

          <h1>{invoice.supplierName}</h1>

          <p>
            Supplier invoice {invoice.supplierInvoiceNumber}
            {" · PO "}
            {invoice.purchaseOrderNumber}
            {" · Created by "}
            {invoice.createdByName}
          </p>
        </div>

        <div className="invoice-detail-actions">
          {canRerunMatch ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => void rerunMatch()}
            >
              <RefreshCw size={16} className={matching ? "kit-spin" : undefined} />
              {matching ? "Matching…" : "Rerun match"}
            </button>
          ) : null}

          {canHold ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "HOLD" })}
            >
              <PauseCircle size={16} />
              Hold payment
            </button>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CANCEL" })}
            >
              <XCircle size={16} />
              Cancel invoice
            </button>
          ) : null}

          {canApprove && invoice.status === "MATCHED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingAction("APPROVE")}
            >
              <BadgeCheck size={16} />
              Approve invoice
            </button>
          ) : null}

          {canManage && invoice.status === "APPROVED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingAction("READY")}
            >
              <PlayCircle size={16} />
              Ready for payment
            </button>
          ) : null}

          {canPay && invoice.status === "READY_FOR_PAYMENT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingAction("PAID")}
            >
              <Coins size={16} />
              Mark paid
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

      {invoice.paymentHold ? (
        <section className="invoice-hold-banner">
          <PauseCircle size={18} />

          <div>
            <strong>Payment hold active</strong>

            <span>
              {invoice.holdReason ??
                "Payment is blocked until invoice exceptions are cleared."}
            </span>
          </div>

          {canApprove && invoice.status === "PAYMENT_HOLD" && invoice.openExceptions === 0 ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPendingAction("RELEASE")}
            >
              Release hold
            </button>
          ) : null}
        </section>
      ) : null}

      {guidance && !invoice.paymentHold ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step.</strong> {guidance}
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Invoice totals" />

      <section className="invoice-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Three-way match</span>

              <h2>PO &amp; invoice exposure</h2>
            </div>

            <FileCheck2 size={19} />
          </div>

          {invoicedPct !== null ? (
            <div className="kit-meter-wrap">
              <Meter
                value={Math.min(invoicedPct, 100)}
                max={100}
                tone={invoicedPct > 100 ? meterToneFor("danger") : "primary"}
                ariaLabel="Share of the purchase order invoiced"
              />

              <span
                className={
                  invoicedPct > 100
                    ? "kit-meter-caption kit-meter-caption--late"
                    : "kit-meter-caption"
                }
              >
                {invoicedPct.toFixed(1)}% of the PO value invoiced to date
              </span>
            </div>
          ) : null}

          <div className="invoice-match-grid">
            <div>
              <span>PO total</span>

              <strong>{money(invoice.purchaseOrderTotal, invoice.purchaseOrderCurrency)}</strong>
            </div>

            <div>
              <span>Cumulative invoiced</span>

              <strong>{money(invoice.cumulativeInvoicedValue, invoice.currency)}</strong>
            </div>

            <div>
              <span>Remaining PO value</span>

              <strong>
                {money(invoice.remainingPoValue, invoice.purchaseOrderCurrency)}
              </strong>
            </div>

            <div>
              <span>Variance tolerance</span>

              <strong>{invoice.poVarianceTolerancePct.toFixed(1)}%</strong>
            </div>

            <div>
              <span>Receipt state</span>

              <StatusBadge value={invoice.purchaseOrderStatus} />
            </div>

            <div>
              <span>Currency match</span>

              <StatusBadge
                value={sameCurrency ? "MATCHED" : "MISMATCH"}
                label={sameCurrency ? "Matched" : "Mismatch"}
                tone={sameCurrency ? "success" : "danger"}
                dot={false}
              />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Invoice lifecycle</span>

              <h2>Approval &amp; payment</h2>
            </div>

            <Coins size={19} />
          </div>

          <div className="invoice-lifecycle-grid">
            <div>
              <span>Approved</span>

              <strong>{invoice.approvedAt ? formatDateTime(invoice.approvedAt) : "—"}</strong>

              <small>{invoice.approvedByName ?? ""}</small>
            </div>

            <div>
              <span>Ready for payment</span>

              <strong>
                {invoice.readyForPaymentAt ? formatDateTime(invoice.readyForPaymentAt) : "—"}
              </strong>
            </div>

            <div>
              <span>Paid</span>

              <strong>{invoice.paidAt ? formatDateTime(invoice.paidAt) : "—"}</strong>
            </div>
          </div>

          {invoice.notes ? <div className="invoice-notes">{invoice.notes}</div> : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Invoice content</span>

            <h2>Line items</h2>
          </div>

          <ReceiptText size={19} />
        </div>

        <StatStrip items={lineStats} />

        <DataTable
          columns={lineColumns}
          rows={invoice.lines}
          getRowId={(line) => String(line.id)}
          ariaLabel="Invoice line items"
          empty={
            <EmptyState
              compact
              icon={ReceiptText}
              title="No line items"
              description="This invoice has no line items."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Payment exceptions</span>

            <h2>Match exceptions</h2>
          </div>

          <ShieldAlert size={19} />
        </div>

        {invoice.exceptions.length === 0 ? (
          <EmptyState
            compact
            icon={ShieldCheck}
            title="No matching exceptions"
            description="No matching exceptions have been detected for this invoice."
          />
        ) : (
          <>
            <div className="kit-toolbar" style={{ marginBottom: 14 }}>
              <SegmentedFilter
                options={exceptionOptions}
                value={view}
                onChange={setExceptionView}
                ariaLabel="Filter exceptions"
              />
            </div>

            {shownExceptions.length === 0 ? (
              <EmptyState
                compact
                icon={ShieldCheck}
                title="No open exceptions"
                description="Every exception has been resolved or dismissed."
              />
            ) : (
              <div className="invoice-exception-list">
                {shownExceptions.map((exception) => (
                  <article
                    key={exception.id}
                    className={`invoice-exception invoice-exception--${exception.severity.toLowerCase()}`}
                  >
                    <div className="invoice-exception-heading">
                      <div>
                        <StatusBadge value={exception.severity} />

                        <strong>{readable(exception.exceptionType)}</strong>

                        <StatusBadge value={exception.status} />
                      </div>

                      {exception.varianceAmount !== null ? (
                        <div>
                          <span>Variance</span>

                          <strong>{money(exception.varianceAmount, invoice.currency)}</strong>
                        </div>
                      ) : null}
                    </div>

                    <p>{exception.details}</p>

                    {exception.expectedValue !== null || exception.actualValue !== null ? (
                      <div className="invoice-exception-values">
                        <span>
                          Expected:{" "}
                          {exception.expectedValue !== null
                            ? money(exception.expectedValue, invoice.currency)
                            : "—"}
                        </span>

                        <span>
                          Actual:{" "}
                          {exception.actualValue !== null
                            ? money(exception.actualValue, invoice.currency)
                            : "—"}
                        </span>
                      </div>
                    ) : null}

                    {exception.resolutionNote ? (
                      <div className="invoice-resolution-note">
                        {exception.resolutionNote}
                        {exception.resolvedByName ? ` — ${exception.resolvedByName}` : ""}
                      </div>
                    ) : null}

                    {exception.status === "OPEN" && (canManage || canApprove) ? (
                      <div className="invoice-inline-controls">
                        {canManage ? (
                          <button
                            type="button"
                            className="invoice-inline-button"
                            disabled={busyAny}
                            onClick={() => openRationale({ kind: "RESOLVE", exception })}
                          >
                            <BadgeCheck size={14} />
                            Resolve
                          </button>
                        ) : null}

                        {canApprove ? (
                          <button
                            type="button"
                            className="invoice-inline-button invoice-inline-button--danger"
                            disabled={busyAny}
                            onClick={() => openRationale({ kind: "DISMISS", exception })}
                          >
                            <XCircle size={14} />
                            Dismiss
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={ACTIONS[pendingAction].eyebrow}
          title={ACTIONS[pendingAction].title}
          description={actionDescription(pendingAction, invoice)}
          confirmLabel={ACTIONS[pendingAction].confirm}
          busyLabel={ACTIONS[pendingAction].busy}
          cancelLabel={ACTIONS[pendingAction].keep}
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        >
          {pendingAction === "PAID" ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              Recording a payment cannot be undone from this screen.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {rationale !== null
        ? (() => {
            const copy = rationaleCopy(rationale, invoice);

            return (
              <RationaleDialog
                eyebrow={copy.eyebrow}
                title={copy.title}
                description={copy.description}
                label={copy.label}
                placeholder={copy.placeholder}
                confirmLabel={copy.confirm}
                busyLabel={copy.busy}
                cancelLabel={copy.keep}
                tone={copy.tone}
                busy={rationaleRunning}
                error={rationaleError}
                onConfirm={(reason) => void confirmRationale(reason)}
                onCancel={() => setRationale(null)}
              />
            );
          })()
        : null}
    </div>
  );
}
