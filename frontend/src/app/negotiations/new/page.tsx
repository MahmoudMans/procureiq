"use client";

import {
  ArrowLeft,
  CircleAlert,
  Handshake,
  ShieldAlert,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createNegotiationWorkspace,
  getNegotiationContext,
} from "@/lib/api";

import type {
  NegotiationContext,
} from "@/types/negotiation";

function money(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export default function NewNegotiationPage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      NegotiationContext |
      null
    >(null);

  const [
    quotationId,
    setQuotationId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  useEffect(() => {
    let active = true;

    getNegotiationContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          if (
            response.quotations.length >
            0
          ) {
            setQuotationId(
              response.quotations[0].id,
            );
          }

          const owner =
            response.users.find(
              user =>
                user.role !==
                "REQUESTER",
            );

          if (owner) {
            setOwnerUserId(
              owner.id,
            );
          }

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load negotiation context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const quotation =
    context
      ?.quotations
      .find(
        item =>
          item.id ===
          quotationId,
      )
    ??
    null;

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const workspace =
        await createNegotiationWorkspace({
          baselineQuotationId:
            quotationId,
          ownerUserId:
            ownerUserId
            ||
            undefined,
          notes:
            notes.trim()
            ||
            undefined,
        });

      router.push(
        `/negotiations/${workspace.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create negotiation workspace.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/negotiations"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Negotiations
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategic sourcing
          </span>

          <h1>
            New negotiation workspace
          </h1>

          <p>
            Select a submitted supplier
            quotation as the commercial
            baseline, assign an owner
            and begin scenario modeling.
          </p>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <form
        className="negotiation-create-layout"
        onSubmit={handleSubmit}
      >
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Negotiation baseline
              </span>

              <h2>
                Supplier quotation
              </h2>
            </div>

            <Handshake
              size={19}
            />
          </div>

          <div className="negotiation-form-grid">
            <label className="request-field negotiation-form-wide">
              <span>
                Submitted quotation
              </span>

              <select
                required
                value={quotationId}
                onChange={
                  event =>
                    setQuotationId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.quotations
                  .map(
                    item => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.rfqNumber}
                        {" — "}
                        {item.supplierName}
                        {" — "}
                        {item.currency}
                        {" "}
                        {item.totalAmount}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field negotiation-form-wide">
              <span>
                Negotiation owner
              </span>

              <select
                value={ownerUserId}
                onChange={
                  event =>
                    setOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.users
                  .filter(
                    user =>
                      user.role !==
                      "REQUESTER",
                  )
                  .map(
                    user => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.fullName}
                        {" — "}
                        {user.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field negotiation-form-wide">
              <span>
                Preparation notes
              </span>

              <textarea
                rows={5}
                maxLength={3000}
                value={notes}
                onChange={
                  event =>
                    setNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="negotiation-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                saving
                ||
                !quotationId
              }
            >
              <Handshake
                size={16}
              />

              {saving
                ? "Creating..."
                : "Create workspace"}
            </button>
          </div>
        </section>

        <aside className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Commercial context
              </span>

              <h2>
                Baseline snapshot
              </h2>
            </div>
          </div>

          {!quotation ? (
            <div className="negotiation-empty">
              No eligible submitted
              quotation is available.
            </div>
          ) : (
            <div className="negotiation-baseline-preview">
              <div>
                <span>
                  RFQ
                </span>

                <strong>
                  {quotation.rfqNumber}
                </strong>

                <small>
                  {quotation.rfqTitle}
                </small>
              </div>

              <div>
                <span>
                  Supplier
                </span>

                <strong>
                  {quotation.supplierName}
                </strong>

                <small>
                  Risk:
                  {" "}
                  {quotation.supplierRiskLevel ??
                    "—"}
                </small>
              </div>

              <div>
                <span>
                  Baseline
                </span>

                <strong>
                  {money(
                    quotation.totalAmount,
                    quotation.currency,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Quotation
                </span>

                <strong className="negotiation-reference">
                  {quotation.quotationReference.slice(
                    0,
                    12,
                  )}
                </strong>
              </div>

              {quotation.supplierRiskLevel ===
                "HIGH"
              ||
              quotation.supplierRiskLevel ===
                "CRITICAL" ? (
                <div className="negotiation-risk-warning">
                  <ShieldAlert
                    size={16}
                  />

                  <span>
                    Elevated supplier risk
                    should be factored into
                    the negotiation strategy.
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}
