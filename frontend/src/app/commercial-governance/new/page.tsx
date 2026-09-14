"use client";

import {
  ArrowLeft,
  CircleAlert,
  ScrollText,
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
  createCommercialGovernance,
  getCommercialGovernanceContext,
} from "@/lib/api";

import type {
  CommercialGovernanceContext,
} from "@/types/commercial-governance";

function dateText(
  value: string,
): string {
  return new Date(
    `${value}T00:00:00`,
  )
    .toLocaleDateString();
}

export default function NewCommercialGovernancePage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      CommercialGovernanceContext |
      null
    >(null);

  const [
    contractId,
    setContractId,
  ] =
    useState("");

  const [
    noticePeriodDays,
    setNoticePeriodDays,
  ] =
    useState(90);

  const [
    baselineContractValue,
    setBaselineContractValue,
  ] =
    useState(10000);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    priceEscalationPct,
    setPriceEscalationPct,
  ] =
    useState(3);

  const [
    maxPoVariancePct,
    setMaxPoVariancePct,
  ] =
    useState(5);

  const [
    autoRenewal,
    setAutoRenewal,
  ] =
    useState(false);

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

    getCommercialGovernanceContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          const contract =
            response.contracts.find(
              candidate =>
                !candidate.governanceConfigured,
            );

          if (contract) {
            setContractId(
              contract.contractId,
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
              : "Unable to load contract-governance context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const availableContracts =
    context
      ?.contracts
      .filter(
        contract =>
          !contract.governanceConfigured,
      )
    ??
    [];

  const selectedContract =
    availableContracts.find(
      contract =>
        contract.contractId ===
        contractId,
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

      const detail =
        await createCommercialGovernance({
          contractId,
          noticePeriodDays,
          baselineContractValue,
          currency:
            currency
              .trim()
              .toUpperCase(),
          priceEscalationPct,
          maxPoVariancePct,
          autoRenewal,
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
        `/commercial-governance/${detail.governance.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create contract commercial governance.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/commercial-governance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Commercial governance
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Contract economics
          </span>

          <h1>
            Govern contract
          </h1>

          <p>
            Configure renewal controls,
            commercial baselines,
            escalation allowances and
            purchase-order leakage
            thresholds.
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

      {availableContracts.length ===
      0 ? (
        <section className="panel">
          <div className="commercial-empty">
            Every available supplier
            contract already has
            commercial governance
            configured.
          </div>
        </section>
      ) : (
        <form
          className="commercial-create-layout"
          onSubmit={handleSubmit}
        >
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Contract controls
                </span>

                <h2>
                  Commercial baseline
                </h2>
              </div>

              <ScrollText
                size={19}
              />
            </div>

            <div className="commercial-form-grid">
              <label className="request-field commercial-form-wide">
                <span>
                  Supplier contract
                </span>

                <select
                  required
                  value={contractId}
                  onChange={
                    event =>
                      setContractId(
                        event.target.value,
                      )
                  }
                >
                  {availableContracts.map(
                    contract => (
                      <option
                        key={
                          contract.contractId
                        }
                        value={
                          contract.contractId
                        }
                      >
                        {contract.supplierCode}
                        {" — "}
                        {contract.supplierName}
                        {" — ends "}
                        {dateText(
                          contract.endDate,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Notice period days
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="1095"
                  value={noticePeriodDays}
                  onChange={
                    event =>
                      setNoticePeriodDays(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Currency
                </span>

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
                <span>
                  Commercial baseline value
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    baselineContractValue
                  }
                  onChange={
                    event =>
                      setBaselineContractValue(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Allowed price escalation %
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={
                    priceEscalationPct
                  }
                  onChange={
                    event =>
                      setPriceEscalationPct(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Maximum PO variance %
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={
                    maxPoVariancePct
                  }
                  onChange={
                    event =>
                      setMaxPoVariancePct(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Governance owner
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

              <label className="commercial-auto-renew commercial-form-wide">
                <input
                  type="checkbox"
                  checked={autoRenewal}
                  onChange={
                    event =>
                      setAutoRenewal(
                        event.target.checked,
                      )
                  }
                />

                <div>
                  <strong>
                    Contract includes auto-renewal
                  </strong>

                  <span>
                    Track the notice
                    deadline closely to
                    prevent unintended
                    renewal.
                  </span>
                </div>
              </label>

              <label className="request-field commercial-form-wide">
                <span>
                  Governance notes
                </span>

                <textarea
                  rows={4}
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

            <div className="commercial-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  saving
                  ||
                  !contractId
                }
              >
                <ScrollText
                  size={16}
                />

                {saving
                  ? "Configuring..."
                  : "Configure governance"}
              </button>
            </div>
          </section>

          <aside className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Contract authority
                </span>

                <h2>
                  Existing contract
                </h2>
              </div>
            </div>

            {!selectedContract ? (
              <div className="commercial-empty">
                Select a supplier
                contract.
              </div>
            ) : (
              <div className="commercial-contract-preview">
                <div>
                  <span>
                    Supplier
                  </span>

                  <strong>
                    {selectedContract.supplierName}
                  </strong>

                  <small>
                    {selectedContract.supplierCode}
                  </small>
                </div>

                <div>
                  <span>
                    Contract status
                  </span>

                  <strong>
                    {selectedContract.contractStatus}
                  </strong>
                </div>

                <div>
                  <span>
                    Contract end
                  </span>

                  <strong>
                    {dateText(
                      selectedContract.endDate,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Contract ID
                  </span>

                  <strong className="commercial-contract-id">
                    {selectedContract.contractId.slice(
                      0,
                      12,
                    )}
                  </strong>
                </div>
              </div>
            )}
          </aside>
        </form>
      )}
    </div>
  );
}
