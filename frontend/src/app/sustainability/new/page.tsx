"use client";

import {
  ArrowLeft,
  CircleAlert,
  Leaf,
  ShieldCheck,
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
  createSustainabilityAssessment,
  getSustainabilityContext,
} from "@/lib/api";

import type {
  SustainabilityContext,
} from "@/types/sustainability";

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

function ratingForScore(
  score: number,
): string {
  if (score >= 85) {
    return "Leading";
  }

  if (score >= 70) {
    return "Good";
  }

  if (score >= 55) {
    return "Moderate";
  }

  if (score >= 40) {
    return "High risk";
  }

  return "Critical";
}

export default function NewSustainabilityAssessmentPage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      SustainabilityContext |
      null
    >(null);

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    environmentalScore,
    setEnvironmentalScore,
  ] =
    useState(60);

  const [
    socialScore,
    setSocialScore,
  ] =
    useState(60);

  const [
    governanceScore,
    setGovernanceScore,
  ] =
    useState(60);

  const [
    assessmentDate,
    setAssessmentDate,
  ] =
    useState(
      today(),
    );

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

    getSustainabilityContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          if (
            response.suppliers[0]
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
              : "Unable to load sustainability context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const selectedSupplier =
    context
      ?.suppliers
      .find(
        supplier =>
          supplier.id ===
          supplierId,
      )
    ??
    null;

  const overallScore =
    useMemo(
      () =>
        environmentalScore *
          0.4
        +
        socialScore *
          0.35
        +
        governanceScore *
          0.25,
      [
        environmentalScore,
        socialScore,
        governanceScore,
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

      const assessment =
        await createSustainabilityAssessment({
          supplierId,
          environmentalScore,
          socialScore,
          governanceScore,
          assessmentDate,
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
        `/sustainability/${assessment.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create sustainability assessment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/sustainability"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Sustainability
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Responsible procurement
          </span>

          <h1>
            New ESG assessment
          </h1>

          <p>
            Score environmental, social
            and governance performance
            using ProcureIQ&apos;s
            transparent weighted ESG
            methodology.
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

      {!context ||
      context.suppliers.length ===
        0 ? (
        <section className="panel">
          <div className="sustainability-empty">
            No active suppliers are
            available for assessment.
          </div>
        </section>
      ) : (
        <form
          className="sustainability-create-layout"
          onSubmit={handleSubmit}
        >
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  ESG methodology
                </span>

                <h2>
                  Assessment scores
                </h2>
              </div>

              <Leaf
                size={19}
              />
            </div>

            <div className="sustainability-form-grid">
              <label className="request-field sustainability-form-wide">
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
                  {context.suppliers.map(
                    supplier => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.supplierCode}
                        {" — "}
                        {supplier.supplierName}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Environmental score / 100
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={
                    environmentalScore
                  }
                  onChange={
                    event =>
                      setEnvironmentalScore(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Social score / 100
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={socialScore}
                  onChange={
                    event =>
                      setSocialScore(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Governance score / 100
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={
                    governanceScore
                  }
                  onChange={
                    event =>
                      setGovernanceScore(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Assessment date
                </span>

                <input
                  required
                  type="date"
                  value={assessmentDate}
                  onChange={
                    event =>
                      setAssessmentDate(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field sustainability-form-wide">
                <span>
                  Assessment owner
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
                  {context.users
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

              <label className="request-field sustainability-form-wide">
                <span>
                  Assessment notes
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

            <div className="sustainability-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  saving
                  ||
                  !supplierId
                }
              >
                <Leaf
                  size={16}
                />

                {saving
                  ? "Creating..."
                  : "Create ESG assessment"}
              </button>
            </div>
          </section>

          <aside className="sustainability-create-side">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Score preview
                  </span>

                  <h2>
                    Weighted ESG
                  </h2>
                </div>
              </div>

              <div className="sustainability-score-preview">
                <strong>
                  {overallScore.toFixed(
                    1,
                  )}
                </strong>

                <span>
                  {ratingForScore(
                    overallScore,
                  )}
                </span>

                <p>
                  Environmental 40% ·
                  Social 35% · Governance
                  25%
                </p>
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Supplier context
                  </span>

                  <h2>
                    Current master data
                  </h2>
                </div>
              </div>

              {!selectedSupplier ? (
                <div className="sustainability-empty">
                  Select a supplier.
                </div>
              ) : (
                <div className="sustainability-supplier-preview">
                  <div>
                    <span>
                      Supplier
                    </span>

                    <strong>
                      {selectedSupplier.supplierName}
                    </strong>

                    <small>
                      {selectedSupplier.supplierCode}
                    </small>
                  </div>

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
                      Existing risk
                    </span>

                    <strong>
                      {selectedSupplier.riskLevel ??
                        "—"}
                    </strong>
                  </div>
                </div>
              )}

              <div className="sustainability-gate-note">
                <ShieldCheck
                  size={16}
                />

                <span>
                  ESG approval does not
                  automatically modify the
                  supplier master record.
                  Responsible-sourcing
                  eligibility is a
                  separate governance
                  result.
                </span>
              </div>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}
