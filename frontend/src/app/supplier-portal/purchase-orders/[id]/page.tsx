"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import "@/components/supplier-portal/portal-rfqs.css";
import "@/components/supplier-portal/portal-purchase-orders.css";
import { PortalHeader } from "@/components/supplier-portal/portal-header";
import {
  awaitingResponse,
  formatPoDate,
  formatPoDateTime,
  orderStateLabel,
  orderStateTone,
} from "@/components/supplier-portal/portal-po-format";
import { formatMoney } from "@/components/supplier-portal/portal-rfq-format";
import {
  acknowledgeSupplierPortalPurchaseOrder,
  getSupplierPortalPurchaseOrder,
  rejectSupplierPortalPurchaseOrder,
} from "@/lib/supplier-portal-purchase-orders";
import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";
import type { PortalPurchaseOrderDetail } from "@/types/supplier-portal-purchase-order";

type Mode = "acknowledge" | "reject";

interface ResponseProps {
  detail: PortalPurchaseOrderDetail;
  onUpdated: (detail: PortalPurchaseOrderDetail) => void;
  onSessionExpired: () => void;
}

/**
 * The supplier's answer to an issued purchase order: acknowledge it, or reject it with a
 * reason. One answer only; once given it is shown here read-only.
 */
function OrderResponse({ detail, onUpdated, onSessionExpired }: ResponseProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const canRespond = awaitingResponse(detail);

  function choose(next: Mode) {
    setMode(next);
    setText("");
    setError(null);
    setFieldError(null);
  }

  function back() {
    setMode(null);
    setText("");
    setError(null);
    setFieldError(null);
  }

  async function send() {
    if (busy || mode === null) {
      return;
    }

    const trimmed = text.trim();

    if (mode === "reject" && trimmed.length === 0) {
      setFieldError("Tell the buyer why you are rejecting this purchase order.");

      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      onSessionExpired();

      return;
    }

    setBusy(true);
    setError(null);
    setFieldError(null);

    try {
      const updated =
        mode === "reject"
          ? await rejectSupplierPortalPurchaseOrder(token, detail.id, trimmed)
          : await acknowledgeSupplierPortalPurchaseOrder(token, detail.id, trimmed);

      onUpdated(updated);
      setMode(null);
      setText("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to send your response.";

      if (/session/i.test(message)) {
        onSessionExpired();

        return;
      }

      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (!canRespond) {
    if (detail.status === "CANCELLED") {
      return (
        <div className="portal-rfq-callout portal-rfq-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This purchase order was cancelled</strong>

            <p>No response is needed.</p>
          </div>
        </div>
      );
    }

    if (detail.supplierResponse === "ACKNOWLEDGED") {
      const when = detail.supplierRespondedAt
        ? ` on ${formatPoDateTime(detail.supplierRespondedAt)}`
        : "";
      const note = detail.supplierResponseNote ? ` Your note: ${detail.supplierResponseNote}` : "";

      return (
        <div className="portal-notice" role="status">
          <CheckCircle2 size={17} />

          {`You acknowledged this purchase order${when}.${note}`}
        </div>
      );
    }

    if (detail.supplierResponse === "REJECTED") {
      const when = detail.supplierRespondedAt
        ? ` on ${formatPoDateTime(detail.supplierRespondedAt)}`
        : "";

      return (
        <div className="portal-rfq-callout portal-rfq-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>{`You rejected this purchase order${when}`}</strong>

            {detail.supplierResponseNote ? (
              <p>{`Your reason: ${detail.supplierResponseNote}`}</p>
            ) : null}

            <p>
              Procurement has been told. If they revise the order they will issue it again, and
              you can respond to the new version.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="portal-rfq-callout portal-rfq-callout--info" role="status">
        <Info size={17} />

        <div>
          <strong>This purchase order is no longer open for a response</strong>
        </div>
      </div>
    );
  }

  return (
    <section className="supplier-portal-panel">
      <div className="supplier-portal-panel-heading">
        <div>
          <span>Your response</span>

          <h2>Acknowledge or reject this order</h2>
        </div>
      </div>

      <p style={{ margin: "0 0 12px" }}>
        Acknowledging tells procurement you accept the order as written. Reject it if the
        prices, quantities, delivery date or terms are wrong, and say why. You can respond
        once.
      </p>

      {error ? (
        <div className="portal-auth-error" role="alert">
          <CircleAlert size={17} />

          {error}
        </div>
      ) : null}

      {mode === null ? (
        <div className="portal-rfq-actions portal-rfq-actions--start">
          <button type="button" className="button" onClick={() => choose("acknowledge")}>
            <CheckCircle2 size={15} />
            Acknowledge order
          </button>

          <button
            type="button"
            className="button portal-po-secondary"
            onClick={() => choose("reject")}
          >
            Reject order
          </button>
        </div>
      ) : (
        <div className="portal-rfq-stack">
          <label className="portal-rfq-field">
            <span>
              {mode === "reject"
                ? "Reason for rejecting (required)"
                : "Note for procurement (optional)"}
            </span>

            <textarea
              className="portal-rfq-input"
              rows={4}
              maxLength={1000}
              value={text}
              aria-invalid={fieldError ? true : undefined}
              onChange={(event) => {
                setText(event.target.value);
                setFieldError(null);
              }}
            />

            <small>{fieldError}</small>
          </label>

          <div className="portal-rfq-actions portal-rfq-actions--start">
            <button type="button" className="button" disabled={busy} onClick={() => void send()}>
              {busy
                ? "Sending..."
                : mode === "reject"
                  ? "Send rejection"
                  : "Send acknowledgement"}
            </button>

            <button
              type="button"
              className="button portal-po-secondary"
              disabled={busy}
              onClick={back}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function SupplierPortalPurchaseOrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [result, setResult] = useState<PortalPurchaseOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function sessionExpired() {
    clearSupplierPortalToken();
    router.replace("/supplier-portal/login");
  }

  useEffect(() => {
    let active = true;
    const id = params.id;
    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    const timer = window.setTimeout(async () => {
      setFetching(true);

      try {
        const response = await getSupplierPortalPurchaseOrder(token, id);

        if (active) {
          setResult(response);
          setError(null);
        }
      } catch (caught) {
        if (!active) {
          return;
        }

        const message =
          caught instanceof Error ? caught.message : "Unable to load this purchase order.";

        if (/session/i.test(message)) {
          clearSupplierPortalToken();
          router.replace("/supplier-portal/login");

          return;
        }

        setError(message);
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
  }, [params.id, router, reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  const detail = result !== null && result.id === params.id ? result : null;

  if (detail === null) {
    if (error === null) {
      return (
        <main className="supplier-portal-shell">
          <div className="supplier-portal-loading">Loading purchase order...</div>
        </main>
      );
    }

    return (
      <main className="supplier-portal-shell">
        <PortalHeader />

        <div className="supplier-portal-content">
          <Link href="/supplier-portal/purchase-orders" className="portal-po-back">
            <ArrowLeft size={16} />
            Purchase orders
          </Link>

          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {error}

            <button type="button" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="supplier-portal-shell">
      <PortalHeader />

      <div className="supplier-portal-content">
        <Link href="/supplier-portal/purchase-orders" className="portal-po-back">
          <ArrowLeft size={16} />
          Purchase orders
        </Link>

        {error ? (
          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {error}

            <button type="button" onClick={reload}>
              Try again
            </button>
          </div>
        ) : null}

        <section className="supplier-portal-welcome">
          <div>
            <span>{detail.rfqNumber}</span>

            <h1>Purchase order {detail.poNumber}</h1>

            <p>
              <span className={`portal-rfq-pill portal-rfq-pill--${orderStateTone(detail)}`}>
                {orderStateLabel(detail)}
              </span>
            </p>
          </div>

          <button
            type="button"
            className="button portal-po-secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </section>

        <OrderResponse detail={detail} onUpdated={setResult} onSessionExpired={sessionExpired} />

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Order details</span>

              <h2>What the buyer ordered</h2>
            </div>
          </div>

          <dl className="portal-po-facts">
            <div>
              <dt>Awarded quotation</dt>

              <dd>{detail.quotationNumber}</dd>
            </div>

            <div>
              <dt>Payment terms</dt>

              <dd>{detail.paymentTerms}</dd>
            </div>

            <div>
              <dt>Expected delivery</dt>

              <dd>{formatPoDate(detail.expectedDeliveryDate)}</dd>
            </div>

            <div>
              <dt>Issued</dt>

              <dd>{formatPoDateTime(detail.issuedAt)}</dd>
            </div>

            <div className="portal-po-wide">
              <dt>Delivery address</dt>

              <dd className="portal-po-address">{detail.deliveryAddress}</dd>
            </div>
          </dl>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Commercial commitment</span>

              <h2>Order lines</h2>
            </div>
          </div>

          <div className="portal-po-table-wrap">
            <table className="portal-po-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="portal-po-num">Qty</th>
                  <th className="portal-po-num">Unit price</th>
                  <th className="portal-po-num">Total</th>
                </tr>
              </thead>

              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.lineNumber}>
                    <td>{line.lineNumber}</td>

                    <td>
                      <strong>{line.itemName}</strong>

                      {line.description ? <small>{line.description}</small> : null}
                    </td>

                    <td>{line.category}</td>

                    <td className="portal-po-num">
                      {line.quantity} {line.unit}
                    </td>

                    <td className="portal-po-num">
                      {formatMoney(line.unitPrice, detail.currency)}
                    </td>

                    <td className="portal-po-num">
                      {formatMoney(line.lineTotal, detail.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="portal-po-totals">
            <div>
              <span>Subtotal</span>

              <strong>{formatMoney(detail.subtotal, detail.currency)}</strong>
            </div>

            <div>
              <span>Discount</span>

              <strong>{`-${formatMoney(detail.discountAmount, detail.currency)}`}</strong>
            </div>

            <div>
              <span>Shipping</span>

              <strong>{formatMoney(detail.shippingAmount, detail.currency)}</strong>
            </div>

            <div>
              <span>Tax</span>

              <strong>{formatMoney(detail.taxAmount, detail.currency)}</strong>
            </div>

            <div className="portal-po-grand">
              <span>Total</span>

              <strong>{formatMoney(detail.totalAmount, detail.currency)}</strong>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
