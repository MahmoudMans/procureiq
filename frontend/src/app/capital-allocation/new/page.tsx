"use client";

import {
  ArrowLeft,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  type FormEvent,
  useState,
} from "react";

import {
  createCapitalAllocationCycle,
} from "@/lib/api";

export default function NewCapitalAllocationCyclePage() {
  const router =
    useRouter();

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      new Date()
        .getUTCFullYear(),
    );

  const [
    budget,
    setBudget,
  ] =
    useState(100000);

  const [
    objective,
    setObjective,
  ] =
    useState("");

  const [
    running,
    setRunning,
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

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const response =
        await createCapitalAllocationCycle({
          title:
            title.trim(),
          currency:
            currency.trim().toUpperCase(),
          fiscalYear,
          budgetAmount:
            budget,
          objective:
            objective.trim(),
        });

      router.push(
        `/capital-allocation/${response.cycle.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create capital-allocation cycle.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/capital-allocation"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital allocation
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Investment committee planning
          </span>

          <h1>
            New allocation cycle
          </h1>

          <p>
            Define a currency-specific
            investment budget before
            importing verified Step 56
            value cases.
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
        <div className="allocation-cycle-form">
          <label className="request-field allocation-form-wide">
            <span>
              Cycle title
            </span>

            <input
              required
              maxLength={300}
              value={title}
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
              Currency
            </span>

            <input
              required
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
              Fiscal year
            </span>

            <input
              type="number"
              min="2000"
              max="3000"
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
            <span>
              Governed budget
            </span>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={budget}
              onChange={
                event =>
                  setBudget(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field allocation-form-wide">
            <span>
              Allocation objective
            </span>

            <textarea
              required
              rows={6}
              maxLength={5000}
              value={objective}
              onChange={
                event =>
                  setObjective(
                    event.target.value,
                  )
              }
            />
          </label>
        </div>

        <div className="allocation-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              running
              ||
              !title.trim()
              ||
              !objective.trim()
              ||
              currency.trim().length !==
                3
            }
          >
            Create allocation cycle
          </button>
        </div>
      </form>
    </div>
  );
}
