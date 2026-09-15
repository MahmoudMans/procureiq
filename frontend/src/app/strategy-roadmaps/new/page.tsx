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
  useEffect,
  useState,
} from "react";

import {
  createStrategyRoadmap,
  getStrategyRoadmapDashboard,
  getStrategyScenarioDashboard,
} from "@/lib/api";

import type {
  StrategyRoadmapDashboard,
} from "@/types/strategy-roadmap";

import type {
  StrategyScenarioDashboard,
} from "@/types/strategy-scenario";

function futureDate(
  months: number,
): string {
  const date =
    new Date();

  date.setUTCMonth(
    date.getUTCMonth()
      + months,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function NewStrategyRoadmapPage() {
  const router =
    useRouter();

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
    scenarios,
    setScenarios,
  ] =
    useState<
      StrategyScenarioDashboard |
      null
    >(null);

  const [
    roadmaps,
    setRoadmaps,
  ] =
    useState<
      StrategyRoadmapDashboard |
      null
    >(null);

  const [
    scenarioId,
    setScenarioId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    objective,
    setObjective,
  ] =
    useState("");

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      futureDate(
        0,
      ),
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      futureDate(
        12,
      ),
    );

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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
      getStrategyScenarioDashboard(
        currency,
        fiscalYear,
      ),
      getStrategyRoadmapDashboard(),
    ])
      .then(
        ([
          scenarioResponse,
          roadmapResponse,
        ]) => {
          if (!active) {
            return;
          }

          setScenarios(
            scenarioResponse,
          );

          setRoadmaps(
            roadmapResponse,
          );

          const candidate =
            scenarioResponse
              .scenarios
              .find(
                scenario =>
                  scenario.status ===
                    "APPROVED"
                  &&
                  !roadmapResponse
                    .roadmaps
                    .some(
                      roadmap =>
                        roadmap.sourceScenarioId ===
                          scenario.id,
                    ),
              );

          setScenarioId(
            candidate?.id
            ??
            "",
          );
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load approved strategy scenarios.",
            );
          }
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(false);
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    currency,
    fiscalYear,
  ]);

  const availableScenarios =
    scenarios
      ?.scenarios
      .filter(
        scenario =>
          scenario.status ===
            "APPROVED"
          &&
          !(
            roadmaps
              ?.roadmaps
              .some(
                roadmap =>
                  roadmap.sourceScenarioId ===
                    scenario.id,
              )
            ??
            false
          ),
      )
    ??
    [];

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !scenarioId
      ||
      !title.trim()
      ||
      !objective.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      const response =
        await createStrategyRoadmap({
          approvedScenarioId:
            scenarioId,
          title:
            title.trim(),
          objective:
            objective.trim(),
          startDate,
          targetEndDate:
            endDate,
        });

      router.push(
        `/strategy-roadmaps/${response.roadmap.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create strategy roadmap.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategy-roadmaps"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategy roadmaps
      </Link>

      <section className="roadmap-detail-heading">
        <div>
          <span className="eyebrow">
            Scenario-to-roadmap governance
          </span>

          <h1>
            New strategy roadmap
          </h1>

          <p>
            Only an approved Step 51
            scenario without an existing
            roadmap can be selected.
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
        <div className="roadmap-create-form">
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

          <label className="request-field roadmap-create-wide">
            <span>
              Approved scenario
            </span>

            <select
              required
              value={scenarioId}
              onChange={
                event =>
                  setScenarioId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                Select approved scenario
              </option>

              {availableScenarios.map(
                scenario => (
                  <option
                    key={scenario.id}
                    value={scenario.id}
                  >
                    {scenario.scenarioNumber}
                    {" — "}
                    {scenario.name}
                    {" · "}
                    {scenario.latestSimulatedScore?.toFixed(
                      1,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="request-field roadmap-create-wide">
            <span>
              Roadmap title
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
              Start date
            </span>

            <input
              type="date"
              value={startDate}
              onChange={
                event =>
                  setStartDate(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Target end date
            </span>

            <input
              type="date"
              value={endDate}
              onChange={
                event =>
                  setEndDate(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field roadmap-create-wide">
            <span>
              Implementation objective
            </span>

            <textarea
              required
              rows={7}
              maxLength={4000}
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

        <div className="roadmap-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              loading
              ||
              running
              ||
              !scenarioId
              ||
              !title.trim()
              ||
              !objective.trim()
            }
          >
            Create roadmap
          </button>
        </div>
      </form>
    </div>
  );
}
