"use client";

import {
  ArrowLeft,
  CircleAlert,
  Goal,
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
  createStrategyScenario,
} from "@/lib/api";

export default function NewStrategyScenarioPage() {
  const router =
    useRouter();

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

      const result =
        await createStrategyScenario({
          name:
            name.trim(),
          description:
            description.trim()
            ||
            undefined,
          currency,
          fiscalYear,
        });

      router.push(
        `/strategy-scenarios/${result.scenario.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create procurement strategy scenario.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategy-scenarios"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategy scenarios
      </Link>

      <section className="scenario-detail-heading">
        <div>
          <span className="eyebrow">
            What-if planning
          </span>

          <h1>
            New strategy scenario
          </h1>

          <p>
            The current Step 50 board
            scorecard will be frozen as
            this scenario&apos;s baseline.
          </p>
        </div>

        <Goal
          size={24}
        />
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
        <div className="scenario-create-form">
          <label className="request-field scenario-create-wide">
            <span>
              Scenario name
            </span>

            <input
              required
              maxLength={300}
              value={name}
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
              Fiscal year
            </span>

            <input
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

          <label className="request-field scenario-create-wide">
            <span>
              Description
            </span>

            <textarea
              rows={7}
              maxLength={4000}
              value={description}
              onChange={
                event =>
                  setDescription(
                    event.target.value,
                  )
              }
            />
          </label>
        </div>

        <div className="scenario-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              running
              ||
              !name.trim()
            }
          >
            {running
              ? "Creating..."
              : "Create scenario"}
          </button>
        </div>
      </form>
    </div>
  );
}
