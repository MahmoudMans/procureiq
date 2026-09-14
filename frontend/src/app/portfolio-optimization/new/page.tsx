"use client";

import {
  ArrowLeft,
  CircleAlert,
  SlidersHorizontal,
  Target,
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
  createPortfolioOptimizationScenario,
  getPortfolioOptimizationContext,
} from "@/lib/api";

import type {
  PortfolioOptimizationContext,
} from "@/types/portfolio-optimization";

export default function NewPortfolioOptimizationScenarioPage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      PortfolioOptimizationContext |
      null
    >(null);

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    budgetLimit,
    setBudgetLimit,
  ] =
    useState(500000);

  const [
    maxInitiatives,
    setMaxInitiatives,
  ] =
    useState(10);

  const [
    maxAverageRiskScore,
    setMaxAverageRiskScore,
  ] =
    useState(60);

  const [
    minTotalTargetSavings,
    setMinTotalTargetSavings,
  ] =
    useState(25000);

  const [
    allowCriticalPriority,
    setAllowCriticalPriority,
  ] =
    useState(true);

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

    getPortfolioOptimizationContext()
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
              candidate =>
                candidate.role !==
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
              : "Unable to load portfolio scenario context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const result =
        await createPortfolioOptimizationScenario({
          name:
            name.trim(),
          currency,
          ownerUserId:
            ownerUserId
            ||
            undefined,
          budgetLimit,
          maxInitiatives,
          maxAverageRiskScore,
          minTotalTargetSavings,
          allowCriticalPriority,
          notes:
            notes.trim()
            ||
            undefined,
        });

      router.push(
        `/portfolio-optimization/${result.scenario.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create portfolio scenario.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/portfolio-optimization"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Portfolio optimization
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            What-if planning
          </span>

          <h1>
            New portfolio scenario
          </h1>

          <p>
            Define the hard constraints
            that ProcureIQ must respect
            when selecting sourcing and
            category initiatives.
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
        onSubmit={submit}
      >
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Optimization constraints
            </span>

            <h2>
              Scenario definition
            </h2>
          </div>

          <SlidersHorizontal
            size={19}
          />
        </div>

        <div className="portfolio-form-grid">
          <label className="request-field portfolio-form-wide">
            <span>
              Scenario name
            </span>

            <input
              required
              maxLength={240}
              value={name}
              placeholder={
                "Example: Balanced FY27 sourcing portfolio"
              }
              onChange={
                event =>
                  setName(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event =>
                  setCurrency(
                    event.target.value,
                  )
              }
            >
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          <label className="request-field">
            <span>
              Owner
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

          <label className="request-field">
            <span>
              Managed-value / budget limit
            </span>

            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={budgetLimit}
              onChange={
                event =>
                  setBudgetLimit(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Maximum initiatives
            </span>

            <input
              required
              type="number"
              min="1"
              max="100"
              value={maxInitiatives}
              onChange={
                event =>
                  setMaxInitiatives(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Maximum average risk
            </span>

            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={maxAverageRiskScore}
              onChange={
                event =>
                  setMaxAverageRiskScore(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Minimum total target savings
            </span>

            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={minTotalTargetSavings}
              onChange={
                event =>
                  setMinTotalTargetSavings(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="portfolio-checkbox-field">
            <input
              type="checkbox"
              checked={allowCriticalPriority}
              onChange={
                event =>
                  setAllowCriticalPriority(
                    event.target.checked,
                  )
              }
            />

            <span>
              Allow initiatives from
              critical-priority categories
            </span>
          </label>

          <label className="request-field portfolio-form-wide">
            <span>
              Scenario notes
            </span>

            <textarea
              rows={6}
              maxLength={3000}
              value={notes}
              placeholder={
                "Describe assumptions, executive constraints or planning context."
              }
              onChange={
                event =>
                  setNotes(
                    event.target.value,
                  )
              }
            />
          </label>
        </div>

        <div className="portfolio-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !name.trim()
            }
          >
            <Target
              size={16}
            />

            {saving
              ? "Creating..."
              : "Create scenario"}
          </button>
        </div>
      </form>
    </div>
  );
}
