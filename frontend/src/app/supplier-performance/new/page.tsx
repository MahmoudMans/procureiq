"use client";

import {
  ArrowLeft,
  CircleAlert,
  ClipboardCheck,
  Gauge,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createSupplierPerformanceReview,
  getSupplierPerformanceContext,
} from "@/lib/api";

import type {
  SupplierPerformanceContext,
} from "@/types/supplier-performance";

function band(
  score: number,
): string {
  if (score >= 85) {
    return "Excellent";
  }

  if (score >= 70) {
    return "Good";
  }

  if (score >= 55) {
    return "Needs improvement";
  }

  return "Critical";
}

export default function NewSupplierPerformanceReviewPage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      SupplierPerformanceContext |
      null
    >(null);

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    periodStart,
    setPeriodStart,
  ] =
    useState("");

  const [
    periodEnd,
    setPeriodEnd,
  ] =
    useState("");

  const [
    qualityScore,
    setQualityScore,
  ] =
    useState(80);

  const [
    deliveryScore,
    setDeliveryScore,
  ] =
    useState(80);

  const [
    commercialScore,
    setCommercialScore,
  ] =
    useState(80);

  const [
    serviceScore,
    setServiceScore,
  ] =
    useState(80);

  const [
    complianceScore,
    setComplianceScore,
  ] =
    useState(80);

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

    getSupplierPerformanceContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          if (
            response.suppliers.length >
            0
          ) {
            setSupplierId(
              response.suppliers[0].id,
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
              : "Unable to load supplier performance context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const weightedScore =
    useMemo(
      () =>
        (
          qualityScore *
            0.25
          +
          deliveryScore *
            0.25
          +
          commercialScore *
            0.2
          +
          serviceScore *
            0.15
          +
          complianceScore *
            0.15
        ),
      [
        qualityScore,
        deliveryScore,
        commercialScore,
        serviceScore,
        complianceScore,
      ],
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const review =
        await createSupplierPerformanceReview({
          supplierId,
          periodStart,
          periodEnd,
          qualityScore,
          deliveryScore,
          commercialScore,
          serviceScore,
          complianceScore,
          ownerUserId:
            ownerUserId ||
            undefined,
          notes:
            notes.trim() ||
            undefined,
        });

      router.push(
        `/supplier-performance/${review.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create supplier performance review.",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedSupplier =
    context
      ?.suppliers
      .find(
        supplier =>
          supplier.id ===
          supplierId,
      );

  return (
    <div className="page-stack">
      <Link
        href="/supplier-performance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier performance
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supplier governance
          </span>

          <h1>
            New performance review
          </h1>

          <p>
            Capture a weighted supplier
            scorecard across quality,
            delivery, commercial,
            service and compliance
            performance.
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

      <section className="supplier-score-preview">
        <div>
          <Gauge
            size={20}
          />

          <div>
            <span>
              Weighted score
            </span>

            <strong>
              {weightedScore.toFixed(1)}
              {" / 100"}
            </strong>
          </div>
        </div>

        <span>
          {band(
            weightedScore,
          )}
        </span>
      </section>

      <form
        className="panel"
        onSubmit={handleSubmit}
      >
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Review setup
            </span>

            <h2>
              Supplier & review period
            </h2>
          </div>

          <ClipboardCheck
            size={19}
          />
        </div>

        <div className="supplier-performance-form-grid">
          <label className="request-field supplier-performance-form-wide">
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
              {context
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

          {selectedSupplier ? (
            <div className="supplier-selected-context supplier-performance-form-wide">
              <div>
                <span>
                  Category
                </span>

                <strong>
                  {selectedSupplier.category ??
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Country
                </span>

                <strong>
                  {selectedSupplier.country ??
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Rating
                </span>

                <strong>
                  {selectedSupplier.rating ??
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Risk
                </span>

                <strong>
                  {selectedSupplier.riskLevel ??
                    "—"}
                </strong>
              </div>
            </div>
          ) : null}

          <label className="request-field">
            <span>
              Period start
            </span>

            <input
              required
              type="date"
              value={periodStart}
              onChange={
                event =>
                  setPeriodStart(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Period end
            </span>

            <input
              required
              type="date"
              value={periodEnd}
              onChange={
                event =>
                  setPeriodEnd(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field supplier-performance-form-wide">
            <span>
              Review owner
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
        </div>

        <div className="supplier-score-section">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Weighted scorecard
              </span>

              <h2>
                Performance dimensions
              </h2>
            </div>
          </div>

          <div className="supplier-score-grid">
            <ScoreInput
              label="Quality"
              weight="25%"
              value={qualityScore}
              setValue={
                setQualityScore
              }
            />

            <ScoreInput
              label="Delivery"
              weight="25%"
              value={deliveryScore}
              setValue={
                setDeliveryScore
              }
            />

            <ScoreInput
              label="Commercial"
              weight="20%"
              value={commercialScore}
              setValue={
                setCommercialScore
              }
            />

            <ScoreInput
              label="Service"
              weight="15%"
              value={serviceScore}
              setValue={
                setServiceScore
              }
            />

            <ScoreInput
              label="Compliance"
              weight="15%"
              value={complianceScore}
              setValue={
                setComplianceScore
              }
            />
          </div>
        </div>

        <label className="request-field supplier-performance-form-notes">
          <span>
            Review notes
          </span>

          <textarea
            rows={5}
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

        <div className="supplier-performance-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !supplierId
              ||
              !periodStart
              ||
              !periodEnd
            }
          >
            <ClipboardCheck
              size={16}
            />

            {saving
              ? "Creating..."
              : "Create review draft"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface ScoreInputProps {
  label: string;
  weight: string;
  value: number;
  setValue:
    (value: number) =>
      void;
}

function ScoreInput({
  label,
  weight,
  value,
  setValue,
}: ScoreInputProps) {
  return (
    <label className="supplier-score-input">
      <div>
        <span>
          {label}
        </span>

        <small>
          Weight {weight}
        </small>
      </div>

      <input
        required
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={value}
        onChange={
          event =>
            setValue(
              Number(
                event.target.value,
              ),
            )
        }
      />
    </label>
  );
}
