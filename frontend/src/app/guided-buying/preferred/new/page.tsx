"use client";

import {
  ArrowLeft,
  CircleAlert,
  Star,
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
  createPreferredSupplier,
  getSavingsContextOptions,
  getGuidedBuyingContext,
} from "@/lib/api";

import type {
  GuidedBuyingContext,
} from "@/types/guided-buying";

import type {
  SavingsContextOptions,
} from "@/types/savings";

export default function NewPreferredSupplierPage() {
  const router =
    useRouter();

  const [
    guidedContext,
    setGuidedContext,
  ] =
    useState<
      GuidedBuyingContext |
      null
    >(null);

  const [
    supplierContext,
    setSupplierContext,
  ] =
    useState<
      SavingsContextOptions |
      null
    >(null);

  const [
    category,
    setCategory,
  ] =
    useState("");

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    preferenceRank,
    setPreferenceRank,
  ] =
    useState(1);

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

    Promise.all([
      getGuidedBuyingContext(),
      getSavingsContextOptions(),
    ])
      .then(
        ([
          guidedResponse,
          supplierResponse,
        ]) => {
          if (!active) {
            return;
          }

          setGuidedContext(
            guidedResponse,
          );

          setSupplierContext(
            supplierResponse,
          );

          if (
            guidedResponse.categories.length >
            0
          ) {
            setCategory(
              guidedResponse.categories[0],
            );
          }

          if (
            supplierResponse.suppliers.length >
            0
          ) {
            setSupplierId(
              supplierResponse.suppliers[0].id,
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
              : "Unable to load preferred-supplier context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      await createPreferredSupplier({
        category:
          category.trim(),
        supplierId,
        preferenceRank,
        notes:
          notes.trim()
          ||
          undefined,
      });

      router.push(
        "/guided-buying",
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create preferred supplier mapping.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/guided-buying"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Guided buying
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Preferred supply
          </span>

          <h1>
            Add preferred supplier
          </h1>

          <p>
            Associate an active supplier
            with a buying category and
            define its recommendation
            priority.
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
        className="panel"
        onSubmit={handleSubmit}
      >
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Category recommendation
            </span>

            <h2>
              Supplier preference
            </h2>
          </div>

          <Star
            size={19}
          />
        </div>

        <div className="guided-form-grid">
          <label className="request-field guided-form-wide">
            <span>
              Category
            </span>

            <input
              required
              list="preferred-category-options"
              maxLength={120}
              value={category}
              onChange={
                event =>
                  setCategory(
                    event.target.value,
                  )
              }
            />

            <datalist id="preferred-category-options">
              {guidedContext
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

          <label className="request-field guided-form-wide">
            <span>
              Supplier
            </span>

            <select
              required
              value={supplierId}
              onChange={
                event =>
                  setSupplierId(
                    event.target.value,
                  )
              }
            >
              {supplierContext
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
                      {" — "}
                      {supplier.category ??
                        "Uncategorized"}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="request-field">
            <span>
              Preference rank
            </span>

            <input
              required
              type="number"
              min="1"
              max="99"
              value={preferenceRank}
              onChange={
                event =>
                  setPreferenceRank(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <div />

          <label className="request-field guided-form-wide">
            <span>
              Recommendation notes
            </span>

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

        <div className="guided-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !category.trim()
              ||
              !supplierId
            }
          >
            <Star
              size={16}
            />

            {saving
              ? "Adding..."
              : "Add preferred supplier"}
          </button>
        </div>
      </form>
    </div>
  );
}
