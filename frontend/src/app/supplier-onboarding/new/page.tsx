"use client";

import {
  ArrowLeft,
  CircleAlert,
  ShieldCheck,
  UserCheck,
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
  createSupplierOnboardingCase,
  getSupplierOnboardingContext,
} from "@/lib/api";

import type {
  SupplierOnboardingCaseType,
  SupplierOnboardingContext,
  SupplierOnboardingRiskTier,
} from "@/types/supplier-onboarding";

function readable(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase(),
    );
}

export default function NewSupplierOnboardingPage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      SupplierOnboardingContext |
      null
    >(null);

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    caseType,
    setCaseType,
  ] =
    useState<SupplierOnboardingCaseType>(
      "INITIAL",
    );

  const [
    riskTier,
    setRiskTier,
  ] =
    useState<SupplierOnboardingRiskTier>(
      "MEDIUM",
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

    getSupplierOnboardingContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          const supplier =
            response.suppliers[0];

          if (supplier) {
            setSupplierId(
              supplier.id,
            );

            const risk =
              supplier.riskLevel;

            if (
              risk === "LOW"
              ||
              risk === "MEDIUM"
              ||
              risk === "HIGH"
              ||
              risk === "CRITICAL"
            ) {
              setRiskTier(
                risk,
              );
            }
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
              : "Unable to load supplier onboarding context.",
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

  function selectSupplier(
    value: string,
  ) {
    setSupplierId(
      value,
    );

    const supplier =
      context
        ?.suppliers
        .find(
          candidate =>
            candidate.id ===
            value,
        );

    if (!supplier) {
      return;
    }

    if (
      supplier.riskLevel ===
        "LOW"
      ||
      supplier.riskLevel ===
        "MEDIUM"
      ||
      supplier.riskLevel ===
        "HIGH"
      ||
      supplier.riskLevel ===
        "CRITICAL"
    ) {
      setRiskTier(
        supplier.riskLevel,
      );
    }
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const onboardingCase =
        await createSupplierOnboardingCase({
          supplierId,
          caseType,
          riskTier,
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
        `/supplier-onboarding/${onboardingCase.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create supplier onboarding case.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/supplier-onboarding"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier onboarding
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supplier governance
          </span>

          <h1>
            New onboarding case
          </h1>

          <p>
            Create an initial
            qualification or recurring
            requalification case with a
            risk-based SLA and approval
            route.
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
          <div className="onboarding-empty">
            No supplier records are
            available.
          </div>
        </section>
      ) : (
        <form
          className="onboarding-create-layout"
          onSubmit={handleSubmit}
        >
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Qualification scope
                </span>

                <h2>
                  Onboarding setup
                </h2>
              </div>

              <UserCheck
                size={19}
              />
            </div>

            <div className="onboarding-form-grid">
              <label className="request-field onboarding-form-wide">
                <span>
                  Supplier
                </span>

                <select
                  required
                  value={supplierId}
                  onChange={
                    event =>
                      selectSupplier(
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
                        {" — "}
                        {supplier.status ??
                          "Unknown"}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Case type
                </span>

                <select
                  value={caseType}
                  onChange={
                    event =>
                      setCaseType(
                        event.target.value as
                          SupplierOnboardingCaseType,
                      )
                  }
                >
                  <option value="INITIAL">
                    Initial onboarding
                  </option>

                  <option value="REQUALIFICATION">
                    Requalification
                  </option>
                </select>
              </label>

              <label className="request-field">
                <span>
                  Qualification risk tier
                </span>

                <select
                  value={riskTier}
                  onChange={
                    event =>
                      setRiskTier(
                        event.target.value as
                          SupplierOnboardingRiskTier,
                      )
                  }
                >
                  <option value="LOW">
                    Low
                  </option>

                  <option value="MEDIUM">
                    Medium
                  </option>

                  <option value="HIGH">
                    High
                  </option>

                  <option value="CRITICAL">
                    Critical
                  </option>
                </select>
              </label>

              <label className="request-field onboarding-form-wide">
                <span>
                  Case owner
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

              <label className="request-field onboarding-form-wide">
                <span>
                  Case notes
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

            <div className="onboarding-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  saving
                  ||
                  !supplierId
                }
              >
                <UserCheck
                  size={16}
                />

                {saving
                  ? "Creating..."
                  : "Create qualification case"}
              </button>
            </div>
          </section>

          <aside className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Supplier context
                </span>

                <h2>
                  Master-data snapshot
                </h2>
              </div>
            </div>

            {!selectedSupplier ? (
              <div className="onboarding-empty">
                Select a supplier.
              </div>
            ) : (
              <div className="onboarding-supplier-preview">
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
                    Current status
                  </span>

                  <strong>
                    {selectedSupplier.status ??
                      "—"}
                  </strong>
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

                <div>
                  <span>
                    Qualification tier
                  </span>

                  <strong>
                    {readable(
                      riskTier,
                    )}
                  </strong>
                </div>
              </div>
            )}

            <div className="onboarding-gate-note">
              <ShieldCheck
                size={16}
              />

              <span>
                Higher-risk suppliers
                receive shorter SLAs,
                additional evidence
                requirements and
                additional compliance /
                risk approvals.
              </span>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
