"use client";

import {
  ArrowLeft,
  CircleAlert,
  Scale,
  ShieldCheck,
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
  createCompliancePolicy,
  getPolicyComplianceContext,
} from "@/lib/api";

import type {
  PolicyComplianceContext,
  ProcurementPolicySeverity,
  ProcurementPolicyType,
} from "@/types/policy-compliance";

export default function NewCompliancePolicyPage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      PolicyComplianceContext |
      null
    >(null);

  const [
    policyCode,
    setPolicyCode,
  ] =
    useState("");

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    policyType,
    setPolicyType,
  ] =
    useState<ProcurementPolicyType>(
      "COMPETITIVE_SOURCING_THRESHOLD",
    );

  const [
    severity,
    setSeverity,
  ] =
    useState<ProcurementPolicySeverity>(
      "HIGH",
    );

  const [
    thresholdAmount,
    setThresholdAmount,
  ] =
    useState(10000);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    requiresWaiver,
    setRequiresWaiver,
  ] =
    useState(true);

  const [
    ownerUserId,
    setOwnerUserId,
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

    getPolicyComplianceContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
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
              : "Unable to load compliance context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const thresholdRequired =
    policyType !==
      "HIGH_RISK_SUPPLIER_RESTRICTION";

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      await createCompliancePolicy({
        policyCode:
          policyCode.trim(),
        name:
          name.trim(),
        description:
          description.trim()
          ||
          undefined,
        policyType,
        severity,
        thresholdAmount:
          thresholdRequired
            ? thresholdAmount
            : undefined,
        currency:
          currency.trim()
            ? currency
                .trim()
                .toUpperCase()
            : undefined,
        requiresWaiver,
        ownerUserId:
          ownerUserId
          ||
          undefined,
      });

      router.push(
        "/compliance",
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create procurement policy.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/compliance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Policy & compliance
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement governance
          </span>

          <h1>
            New procurement policy
          </h1>

          <p>
            Configure a reusable
            procurement control and let
            ProcureIQ automatically
            identify transactions that
            breach it.
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
              Policy definition
            </span>

            <h2>
              Compliance authority
            </h2>
          </div>

          <ShieldCheck
            size={19}
          />
        </div>

        <div className="compliance-form-grid">
          <label className="request-field">
            <span>
              Policy code
            </span>

            <input
              required
              maxLength={60}
              value={policyCode}
              placeholder="SRC_THRESHOLD"
              onChange={
                event =>
                  setPolicyCode(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Severity
            </span>

            <select
              value={severity}
              onChange={
                event =>
                  setSeverity(
                    event.target.value as
                      ProcurementPolicySeverity,
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

          <label className="request-field compliance-form-wide">
            <span>
              Policy name
            </span>

            <input
              required
              maxLength={220}
              value={name}
              onChange={
                event =>
                  setName(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field compliance-form-wide">
            <span>
              Description
            </span>

            <textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={
                event =>
                  setDescription(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field compliance-form-wide">
            <span>
              Policy type
            </span>

            <select
              value={policyType}
              onChange={
                event =>
                  setPolicyType(
                    event.target.value as
                      ProcurementPolicyType,
                  )
              }
            >
              <option value="COMPETITIVE_SOURCING_THRESHOLD">
                Competitive sourcing threshold
              </option>

              <option value="PURCHASE_ORDER_REQUIRED_THRESHOLD">
                Purchase order required threshold
              </option>

              <option value="CONTRACT_REQUIRED_THRESHOLD">
                Contract required threshold
              </option>

              <option value="HIGH_RISK_SUPPLIER_RESTRICTION">
                High-risk supplier restriction
              </option>
            </select>
          </label>

          {thresholdRequired ? (
            <label className="request-field">
              <span>
                Threshold amount
              </span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={thresholdAmount}
                onChange={
                  event =>
                    setThresholdAmount(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>
          ) : (
            <div />
          )}

          <label className="request-field">
            <span>
              Currency
            </span>

            <input
              maxLength={3}
              value={currency}
              placeholder="EUR"
              onChange={
                event =>
                  setCurrency(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field compliance-form-wide">
            <span>
              Policy owner
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

          <label className="compliance-waiver-option compliance-form-wide">
            <input
              type="checkbox"
              checked={requiresWaiver}
              onChange={
                event =>
                  setRequiresWaiver(
                    event.target.checked,
                  )
              }
            />

            <div>
              <strong>
                Allow governed waiver requests
              </strong>

              <span>
                Open violations may request
                a documented exception that
                requires management approval.
              </span>
            </div>
          </label>
        </div>

        <div className="compliance-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !policyCode.trim()
              ||
              !name.trim()
            }
          >
            <Scale
              size={16}
            />

            {saving
              ? "Creating..."
              : "Create active policy"}
          </button>
        </div>
      </form>
    </div>
  );
}
