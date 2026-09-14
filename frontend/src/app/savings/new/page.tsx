"use client";

import {
  ArrowLeft,
  BadgeDollarSign,
  CircleAlert,
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
  createSavingsInitiative,
  getSavingsContextOptions,
} from "@/lib/api";

import type {
  SavingsContextOptions,
  SavingsType,
} from "@/types/savings";

const CURRENT_YEAR =
  new Date()
    .getUTCFullYear();

export default function NewSavingsPage() {
  const router =
    useRouter();

  const [
    options,
    setOptions,
  ] =
    useState<
      SavingsContextOptions |
      null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    savingsType,
    setSavingsType,
  ] =
    useState<SavingsType>(
      "HARD_SAVINGS",
    );

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      CURRENT_YEAR,
    );

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    category,
    setCategory,
  ] =
    useState("");

  const [
    baselineValue,
    setBaselineValue,
  ] =
    useState(100000);

  const [
    negotiatedValue,
    setNegotiatedValue,
  ] =
    useState(90000);

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    rfqId,
    setRfqId,
  ] =
    useState("");

  const [
    purchaseOrderId,
    setPurchaseOrderId,
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
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    getSavingsContextOptions()
      .then(
        response => {
          if (!active) {
            return;
          }

          setOptions(
            response,
          );

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

          if (
            response.categories.length >
            0
          ) {
            setCategory(
              response.categories[0],
            );
          }
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
              : "Unable to load savings context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const target =
    Math.max(
      0,
      baselineValue -
        negotiatedValue,
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const initiative =
        await createSavingsInitiative({
          title:
            title.trim(),
          savingsType,
          fiscalYear,
          currency:
            currency
              .trim()
              .toUpperCase(),
          category:
            category.trim() ||
            undefined,
          baselineValue,
          negotiatedValue,
          ownerUserId:
            ownerUserId ||
            undefined,
          supplierId:
            supplierId ||
            undefined,
          rfqId:
            rfqId ||
            undefined,
          purchaseOrderId:
            purchaseOrderId ||
            undefined,
          notes:
            notes.trim() ||
            undefined,
        });

      router.push(
        `/savings/${initiative.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create savings initiative.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/savings"
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Savings & value
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Value management
          </span>

          <h1>
            New savings initiative
          </h1>

          <p>
            Define the baseline,
            negotiated value, ownership
            and procurement context for
            a savings opportunity.
          </p>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      <section className="savings-target-preview">
        <div>
          <BadgeDollarSign size={20} />

          <span>
            Calculated target savings
          </span>
        </div>

        <strong>
          {new Intl.NumberFormat(
            "en-US",
            {
              style: "currency",
              currency:
                currency.length === 3
                  ? currency.toUpperCase()
                  : "EUR",
            },
          ).format(target)}
        </strong>
      </section>

      <form
        className="panel"
        onSubmit={handleSubmit}
      >
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Savings definition
            </span>

            <h2>
              Initiative details
            </h2>
          </div>

          <BadgeDollarSign size={19} />
        </div>

        <div className="savings-form-grid">
          <label className="request-field savings-form-wide">
            <span>Title</span>

            <input
              required
              maxLength={220}
              value={title}
              placeholder={
                "Network equipment sourcing savings"
              }
              onChange={
                event =>
                  setTitle(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Savings type
            </span>

            <select
              value={savingsType}
              onChange={
                event =>
                  setSavingsType(
                    event.target.value as
                      SavingsType,
                  )
              }
            >
              <option value="HARD_SAVINGS">
                Hard savings
              </option>

              <option value="COST_AVOIDANCE">
                Cost avoidance
              </option>
            </select>
          </label>

          <label className="request-field">
            <span>
              Fiscal year
            </span>

            <input
              required
              type="number"
              min="2000"
              max="2200"
              value={fiscalYear}
              onChange={
                event =>
                  setFiscalYear(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>Currency</span>

            <input
              required
              minLength={3}
              maxLength={3}
              value={currency}
              onChange={
                event =>
                  setCurrency(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>Category</span>

            <input
              list="savings-category-options"
              maxLength={120}
              value={category}
              onChange={
                event =>
                  setCategory(
                    event.target.value,
                  )
              }
            />

            <datalist id="savings-category-options">
              {options
                ?.categories
                .map(
                  option => (
                    <option
                      key={option}
                      value={option}
                    />
                  ),
                )}
            </datalist>
          </label>

          <label className="request-field">
            <span>
              Baseline value
            </span>

            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={baselineValue}
              onChange={
                event =>
                  setBaselineValue(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Negotiated value
            </span>

            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={negotiatedValue}
              onChange={
                event =>
                  setNegotiatedValue(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>Owner</span>

            <select
              value={ownerUserId}
              onChange={
                event =>
                  setOwnerUserId(
                    event.target.value,
                  )
              }
            >
              {options
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

          <label className="request-field">
            <span>Supplier</span>

            <select
              value={supplierId}
              onChange={
                event => {
                  const value =
                    event.target.value;

                  setSupplierId(
                    value,
                  );

                  const supplier =
                    options
                      ?.suppliers
                      .find(
                        item =>
                          item.id ===
                          value,
                      );

                  if (
                    supplier?.category
                  ) {
                    setCategory(
                      supplier.category,
                    );
                  }
                }
              }
            >
              <option value="">
                No supplier
              </option>

              {options
                ?.suppliers
                .map(
                  supplier => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.supplierCode}
                      {" — "}
                      {supplier.legalName}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="request-field">
            <span>RFQ</span>

            <select
              value={rfqId}
              onChange={
                event =>
                  setRfqId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                No RFQ
              </option>

              {options
                ?.rfqs
                .filter(
                  rfq =>
                    rfq.currency ===
                      currency.toUpperCase(),
                )
                .map(
                  rfq => (
                    <option
                      key={rfq.id}
                      value={rfq.id}
                    >
                      {rfq.rfqNumber}
                      {" — "}
                      {rfq.title}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="request-field">
            <span>
              Purchase order
            </span>

            <select
              value={purchaseOrderId}
              onChange={
                event =>
                  setPurchaseOrderId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                No purchase order
              </option>

              {options
                ?.purchaseOrders
                .filter(
                  order =>
                    (
                      !supplierId ||
                      order.supplierId ===
                        supplierId
                    )
                    &&
                    order.currency ===
                      currency.toUpperCase(),
                )
                .map(
                  order => (
                    <option
                      key={order.id}
                      value={order.id}
                    >
                      {order.purchaseOrderNumber}
                      {" — "}
                      {order.supplierName}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="request-field savings-form-wide">
            <span>Notes</span>

            <textarea
              rows={4}
              maxLength={2000}
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

        <div className="savings-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={saving}
          >
            <BadgeDollarSign size={16} />

            {saving
              ? "Creating..."
              : "Create initiative"}
          </button>
        </div>
      </form>
    </div>
  );
}
