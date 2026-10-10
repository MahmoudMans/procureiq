"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Info,
  RefreshCw,
  Send,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import "@/components/supplier-portal/portal-rfqs.css";
import { InvitationResponse } from "@/components/supplier-portal/invitation-response";
import { PortalHeader } from "@/components/supplier-portal/portal-header";
import {
  deadlineNote,
  formatDeadline,
  formatMoney,
  parseAmount,
  quotationLabel,
  quotationTone,
  readable,
  roundMoney,
} from "@/components/supplier-portal/portal-rfq-format";
import {
  getSupplierPortalRfq,
  saveSupplierPortalQuotation,
  submitSupplierPortalQuotation,
  withdrawSupplierPortalQuotation,
} from "@/lib/supplier-portal-rfqs";
import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";
import type { PortalQuotationInput, PortalRfqDetail } from "@/types/supplier-portal-rfq";

type FieldErrors = Record<string, string>;

const AMOUNT_MESSAGE = "Enter an amount of 0 or more, with up to 2 decimals.";

/* ------------------------------------------------------------------ */
/* Quotation editor                                                    */
/* ------------------------------------------------------------------ */

interface EditorProps {
  detail: PortalRfqDetail;
  onUpdated: (detail: PortalRfqDetail) => void;
  onSessionExpired: () => void;
}

function QuotationEditor({ detail, onUpdated, onSessionExpired }: EditorProps) {
  const quotation = detail.quotation;

  const [leadTime, setLeadTime] = useState(() => (quotation ? String(quotation.leadTimeDays) : ""));
  const [terms, setTerms] = useState(() => quotation?.paymentTerms ?? "");
  const [validity, setValidity] = useState(() => quotation?.validityDate ?? "");
  const [discount, setDiscount] = useState(() => (quotation ? String(quotation.discountAmount) : "0"));
  const [shipping, setShipping] = useState(() => (quotation ? String(quotation.shippingAmount) : "0"));
  const [tax, setTax] = useState(() => (quotation ? String(quotation.taxAmount) : "0"));
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};

    for (const line of quotation?.lines ?? []) {
      initial[line.rfqLineItemId] = String(line.unitPrice);
    }

    return initial;
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"save" | "submit" | "withdraw" | null>(null);
  const [confirming, setConfirming] = useState<"submit" | "withdraw" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const status = quotation?.status ?? null;
  const mayRespond =
    detail.open &&
    detail.biddingBlockedReason === null &&
    detail.invitationStatus !== "DECLINED";
  const canEdit = mayRespond && status !== "SUBMITTED";
  const canWithdraw = mayRespond && status === "SUBMITTED";
  const showPrices = canEdit || canWithdraw || quotation !== null;
  const currency = detail.currency;

  const lineTotals = detail.lineItems.map((item) => {
    const price = parseAmount(prices[item.id] ?? "");

    return price === null ? null : roundMoney(item.quantity * price);
  });

  const complete = lineTotals.every((total) => total !== null);
  const subtotal = roundMoney(lineTotals.reduce<number>((sum, total) => sum + (total ?? 0), 0));
  const discountValue = parseAmount(discount) ?? 0;
  const shippingValue = parseAmount(shipping) ?? 0;
  const taxValue = parseAmount(tax) ?? 0;
  const estimatedTotal = roundMoney(subtotal - discountValue + shippingValue + taxValue);

  function clearError(key: string) {
    setErrors((current) => {
      if (!(key in current)) {
        return current;
      }

      const next = { ...current };

      delete next[key];

      return next;
    });
  }

  function validate(): PortalQuotationInput | null {
    const next: FieldErrors = {};

    if (!/^\d{1,4}$/.test(leadTime.trim())) {
      next.leadTime = "Enter whole days, for example 14.";
    }

    const termsText = terms.trim();

    if (!termsText) {
      next.terms = "Enter your payment terms.";
    } else if (termsText.length > 300) {
      next.terms = "Use at most 300 characters.";
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(validity)) {
      next.validity = "Choose how long this quotation stays valid.";
    }

    const discountAmount = parseAmount(discount);
    const shippingAmount = parseAmount(shipping);
    const taxAmount = parseAmount(tax);

    if (discountAmount === null) {
      next.discount = AMOUNT_MESSAGE;
    }

    if (shippingAmount === null) {
      next.shipping = AMOUNT_MESSAGE;
    }

    if (taxAmount === null) {
      next.tax = AMOUNT_MESSAGE;
    }

    const lines = detail.lineItems.map((item) => {
      const price = parseAmount(prices[item.id] ?? "");

      if (price === null) {
        next[`line:${item.id}`] = "Enter a price of 0 or more.";
      }

      return { rfqLineItemId: item.id, unitPrice: price ?? 0 };
    });

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return null;
    }

    return {
      leadTimeDays: Number(leadTime.trim()),
      paymentTerms: termsText,
      validityDate: validity,
      discountAmount: discountAmount ?? 0,
      shippingAmount: shippingAmount ?? 0,
      taxAmount: taxAmount ?? 0,
      lines,
    };
  }

  function fail(caught: unknown, fallback: string) {
    const message = caught instanceof Error ? caught.message : fallback;

    if (/session/i.test(message)) {
      onSessionExpired();

      return;
    }

    setApiError(message);
  }

  async function persist(thenSubmit: boolean) {
    if (busy !== null) {
      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      onSessionExpired();

      return;
    }

    const input = validate();

    if (input === null) {
      setConfirming(null);

      return;
    }

    setBusy(thenSubmit ? "submit" : "save");
    setApiError(null);
    setNotice(null);
    setConfirming(null);

    try {
      const saved = await saveSupplierPortalQuotation(token, detail.id, input);

      onUpdated(saved);

      if (thenSubmit) {
        const submitted = await submitSupplierPortalQuotation(token, detail.id);

        onUpdated(submitted);
        setNotice("Quotation submitted. Procurement can now see it in the comparison.");
      } else {
        setNotice("Draft saved. It is not visible to procurement until you submit it.");
      }
    } catch (caught) {
      fail(caught, "Unable to save your quotation.");
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    if (busy !== null) {
      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      onSessionExpired();

      return;
    }

    setBusy("withdraw");
    setApiError(null);
    setNotice(null);
    setConfirming(null);

    try {
      const updated = await withdrawSupplierPortalQuotation(token, detail.id);

      onUpdated(updated);
      setNotice("Quotation withdrawn. You can revise it and submit again before the deadline.");
    } catch (caught) {
      fail(caught, "Unable to withdraw your quotation.");
    } finally {
      setBusy(null);
    }
  }

  function startSubmit() {
    if (busy !== null) {
      return;
    }

    setApiError(null);
    setNotice(null);

    if (validate() !== null) {
      setConfirming("submit");
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="portal-rfq-stack">
      {detail.biddingBlockedReason ? (
        <div className="portal-rfq-callout portal-rfq-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>You cannot respond to this RFQ</strong>

            <p>{detail.biddingBlockedReason}</p>
          </div>
        </div>
      ) : null}

      {!detail.open && quotation === null ? (
        <div className="portal-rfq-callout portal-rfq-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Responses are closed</strong>

            <p>This RFQ is no longer accepting quotations, and none was submitted from your account.</p>
          </div>
        </div>
      ) : null}

      {!detail.open && status === "SUBMITTED" ? (
        <div className="portal-rfq-callout portal-rfq-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Your submitted quotation is final</strong>

            <p>The RFQ is closed, so the quotation can no longer be withdrawn or changed.</p>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="portal-notice" role="status">
          <CheckCircle2 size={17} />

          {notice}
        </div>
      ) : null}

      {apiError ? (
        <div className="portal-auth-error" role="alert">
          <CircleAlert size={17} />

          {apiError}
        </div>
      ) : null}

      {errorCount > 0 ? (
        <div className="portal-auth-error" role="alert">
          <CircleAlert size={17} />

          Check the highlighted fields before continuing.
        </div>
      ) : null}

      <section className="supplier-portal-panel">
        <div className="supplier-portal-panel-heading">
          <div>
            <span>{showPrices ? "Your response" : "What is requested"}</span>

            <h2>{showPrices ? "Items and prices" : "Requested items"}</h2>
          </div>

          {quotation ? (
            <span className={`portal-rfq-pill portal-rfq-pill--${quotationTone(status)}`}>
              {quotation.quotationNumber}
              {" · "}
              {quotationLabel(status)}
            </span>
          ) : null}
        </div>

        <div className="portal-rfq-table-wrap">
          <table className="portal-rfq-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Category</th>
                <th className="portal-rfq-num">Quantity</th>
                <th>Unit</th>
                {showPrices ? <th className="portal-rfq-num">Unit price ({currency})</th> : null}
                {showPrices ? <th className="portal-rfq-num">Line total</th> : null}
              </tr>
            </thead>

            <tbody>
              {detail.lineItems.map((item, index) => {
                const lineTotal = lineTotals[index];
                const errorKey = `line:${item.id}`;

                return (
                  <tr key={item.id}>
                    <td>{item.lineNumber}</td>

                    <td>
                      <strong>{item.itemName}</strong>

                      {item.description ? <small>{item.description}</small> : null}
                    </td>

                    <td>{item.category}</td>

                    <td className="portal-rfq-num">
                      {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                    </td>

                    <td>{item.unit}</td>

                    {showPrices ? (
                      <td className="portal-rfq-num">
                        <input
                          className="portal-rfq-input portal-rfq-input--price"
                          inputMode="decimal"
                          autoComplete="off"
                          aria-label={`Unit price for ${item.itemName}`}
                          aria-invalid={errors[errorKey] ? true : undefined}
                          value={prices[item.id] ?? ""}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const value = event.target.value;

                            setPrices((current) => ({ ...current, [item.id]: value }));
                            clearError(errorKey);
                          }}
                        />

                        {errors[errorKey] ? <small role="alert">{errors[errorKey]}</small> : null}
                      </td>
                    ) : null}

                    {showPrices ? (
                      <td className="portal-rfq-num">
                        {lineTotal === null ? "—" : formatMoney(lineTotal, currency)}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showPrices ? (
        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Commercial terms</span>

              <h2>Terms and totals</h2>
            </div>
          </div>

          <div className="portal-rfq-fields">
            <label className="portal-rfq-field">
              <span>Lead time (days)</span>

              <input
                className="portal-rfq-input"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={errors.leadTime ? true : undefined}
                value={leadTime}
                disabled={!canEdit}
                onChange={(event) => {
                  setLeadTime(event.target.value);
                  clearError("leadTime");
                }}
              />

              <small role="alert">{errors.leadTime ?? ""}</small>
            </label>

            <label className="portal-rfq-field">
              <span>Payment terms</span>

              <input
                className="portal-rfq-input"
                autoComplete="off"
                maxLength={300}
                aria-invalid={errors.terms ? true : undefined}
                value={terms}
                disabled={!canEdit}
                onChange={(event) => {
                  setTerms(event.target.value);
                  clearError("terms");
                }}
              />

              <small role="alert">{errors.terms ?? ""}</small>
            </label>

            <label className="portal-rfq-field">
              <span>Quotation valid until</span>

              <input
                className="portal-rfq-input"
                type="date"
                aria-invalid={errors.validity ? true : undefined}
                value={validity}
                disabled={!canEdit}
                onChange={(event) => {
                  setValidity(event.target.value);
                  clearError("validity");
                }}
              />

              <small role="alert">{errors.validity ?? ""}</small>
            </label>

            <label className="portal-rfq-field">
              <span>Discount ({currency})</span>

              <input
                className="portal-rfq-input"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.discount ? true : undefined}
                value={discount}
                disabled={!canEdit}
                onChange={(event) => {
                  setDiscount(event.target.value);
                  clearError("discount");
                }}
              />

              <small role="alert">{errors.discount ?? ""}</small>
            </label>

            <label className="portal-rfq-field">
              <span>Shipping ({currency})</span>

              <input
                className="portal-rfq-input"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.shipping ? true : undefined}
                value={shipping}
                disabled={!canEdit}
                onChange={(event) => {
                  setShipping(event.target.value);
                  clearError("shipping");
                }}
              />

              <small role="alert">{errors.shipping ?? ""}</small>
            </label>

            <label className="portal-rfq-field">
              <span>Tax ({currency})</span>

              <input
                className="portal-rfq-input"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.tax ? true : undefined}
                value={tax}
                disabled={!canEdit}
                onChange={(event) => {
                  setTax(event.target.value);
                  clearError("tax");
                }}
              />

              <small role="alert">{errors.tax ?? ""}</small>
            </label>
          </div>

          <dl className="portal-rfq-totals">
            <div>
              <dt>Subtotal</dt>

              <dd>{complete ? formatMoney(subtotal, currency) : "—"}</dd>
            </div>

            <div>
              <dt>Discount</dt>

              <dd>−{formatMoney(discountValue, currency)}</dd>
            </div>

            <div>
              <dt>Shipping</dt>

              <dd>{formatMoney(shippingValue, currency)}</dd>
            </div>

            <div>
              <dt>Tax</dt>

              <dd>{formatMoney(taxValue, currency)}</dd>
            </div>

            <div className="portal-rfq-totals__total">
              <dt>Estimated total</dt>

              <dd>{complete ? formatMoney(estimatedTotal, currency) : "—"}</dd>
            </div>

            {quotation ? (
              <div>
                <dt>Saved total</dt>

                <dd>{formatMoney(quotation.totalAmount, quotation.currency)}</dd>
              </div>
            ) : null}
          </dl>

          {confirming === "submit" ? (
            <div className="portal-rfq-callout portal-rfq-callout--warning" role="status">
              <AlertTriangle size={17} />

              <div>
                <strong>Submit this quotation to procurement?</strong>

                <p>
                  Your quotation of about {formatMoney(estimatedTotal, currency)} becomes visible to
                  the buyer. You can withdraw and revise it until the deadline.
                </p>

                <div className="portal-rfq-actions portal-rfq-actions--start">
                  <button
                    type="button"
                    className="button"
                    onClick={() => void persist(true)}
                    disabled={busy !== null}
                  >
                    <Send size={15} />
                    {busy === "submit" ? "Submitting..." : "Confirm and submit"}
                  </button>

                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setConfirming(null)}
                    disabled={busy !== null}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {confirming === "withdraw" ? (
            <div className="portal-rfq-callout portal-rfq-callout--warning" role="status">
              <AlertTriangle size={17} />

              <div>
                <strong>Withdraw your quotation?</strong>

                <p>
                  Procurement will no longer see it in the comparison. You can revise it and submit
                  again before the deadline.
                </p>

                <div className="portal-rfq-actions portal-rfq-actions--start">
                  <button
                    type="button"
                    className="button"
                    onClick={() => void withdraw()}
                    disabled={busy !== null}
                  >
                    <Undo2 size={15} />
                    {busy === "withdraw" ? "Withdrawing..." : "Confirm withdrawal"}
                  </button>

                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setConfirming(null)}
                    disabled={busy !== null}
                  >
                    Keep quotation
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {canEdit || canWithdraw ? (
            <div className="portal-rfq-actions">
              {canEdit ? (
                <>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void persist(false)}
                    disabled={busy !== null}
                  >
                    {busy === "save" ? "Saving..." : "Save draft"}
                  </button>

                  <button
                    type="button"
                    className="button"
                    onClick={startSubmit}
                    disabled={busy !== null}
                  >
                    <Send size={15} />
                    Submit quotation
                  </button>
                </>
              ) : null}

              {canWithdraw ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    setApiError(null);
                    setNotice(null);
                    setConfirming("withdraw");
                  }}
                  disabled={busy !== null}
                >
                  <Undo2 size={15} />
                  Withdraw quotation
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface DetailData {
  id: string;
  /** Changes only when data is loaded from the server, so the editor re-initialises on refresh. */
  loadId: number;
  detail: PortalRfqDetail;
}

export default function SupplierPortalRfqPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [result, setResult] = useState<DetailData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);

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
        const response = await getSupplierPortalRfq(token, id);

        if (active) {
          setResult((current) => ({
            id,
            loadId: (current?.loadId ?? 0) + 1,
            detail: response,
          }));
          setLoadError(null);
        }
      } catch (caught) {
        if (!active) {
          return;
        }

        const message = caught instanceof Error ? caught.message : "Unable to load this RFQ.";

        if (/session/i.test(message)) {
          clearSupplierPortalToken();
          router.replace("/supplier-portal/login");

          return;
        }

        setLoadError(message);
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

  const data = result !== null && result.id === params.id ? result : null;
  const detail = data?.detail ?? null;

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);

    return () => window.clearTimeout(timer);
  }, [detail]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function handleUpdated(updated: PortalRfqDetail) {
    setResult((current) => (current ? { ...current, detail: updated } : current));
  }

  function handleSessionExpired() {
    clearSupplierPortalToken();
    router.replace("/supplier-portal/login");
  }

  if (detail === null && loadError === null) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">Loading RFQ...</div>
      </main>
    );
  }

  if (detail === null || data === null) {
    return (
      <main className="supplier-portal-shell">
        <PortalHeader />

        <div className="supplier-portal-content">
          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {loadError ?? "This RFQ is unavailable."}

            <button type="button" onClick={reload}>
              Try again
            </button>
          </div>

          <Link href="/supplier-portal/rfqs" className="supplier-portal-back-link">
            <ArrowLeft size={15} />
            All RFQs
          </Link>
        </div>
      </main>
    );
  }

  const note = detail.open ? deadlineNote(detail.responseDeadline, now) : null;

  return (
    <main className="supplier-portal-shell">
      <PortalHeader />

      <div className="supplier-portal-content">
        <Link href="/supplier-portal/rfqs" className="supplier-portal-back-link">
          <ArrowLeft size={15} />
          All RFQs
        </Link>

        {loadError ? (
          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {loadError}

            <button type="button" onClick={reload}>
              Try again
            </button>
          </div>
        ) : null}

        <section className="supplier-portal-welcome">
          <div>
            <span>{detail.rfqNumber}</span>

            <h1>{detail.title}</h1>

            {detail.description ? <p>{detail.description}</p> : null}
          </div>

          <div>
            <strong>{detail.open ? "Open for response" : readable(detail.rfqStatus)}</strong>

            <span>Deadline {formatDeadline(detail.responseDeadline)}</span>

            {note ? (
              <span className={`portal-rfq-note portal-rfq-note--${note.tone}`}>{note.text}</span>
            ) : null}

            <button
              type="button"
              className="button button--secondary"
              onClick={reload}
              disabled={fetching}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </section>

        <InvitationResponse
          detail={detail}
          onUpdated={handleUpdated}
          onSessionExpired={handleSessionExpired}
        />

        <QuotationEditor
          key={`${detail.id}:${data.loadId}`}
          detail={detail}
          onUpdated={handleUpdated}
          onSessionExpired={handleSessionExpired}
        />
      </div>
    </main>
  );
}
