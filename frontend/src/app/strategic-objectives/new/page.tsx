"use client";

import {
  ArrowLeft,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  createStrategicObjective,
  getStrategicOkrContext,
} from "@/lib/api";

import type {
  OkrContext,
  StrategicObjectivePeriodType,
} from "@/types/strategic-okr";

function dates(
  fiscalYear: number,
  periodType:
    StrategicObjectivePeriodType,
  quarter: number,
): {
  start: string;
  end: string;
} {
  if (
    periodType ===
      "ANNUAL"
  ) {
    return {
      start:
        `${fiscalYear}-01-01`,
      end:
        `${fiscalYear}-12-31`,
    };
  }

  const starts = [
    "01-01",
    "04-01",
    "07-01",
    "10-01",
  ];

  const ends = [
    "03-31",
    "06-30",
    "09-30",
    "12-31",
  ];

  return {
    start:
      `${fiscalYear}-${starts[quarter - 1]}`,
    end:
      `${fiscalYear}-${ends[quarter - 1]}`,
  };
}

export default function NewStrategicObjectivePage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const currency =
    (
      searchParams.get(
        "currency",
      )
      ??
      "EUR"
    )
      .toUpperCase();

  const initialYear =
    Number(
      searchParams.get(
        "fiscalYear",
      )
      ??
      new Date()
        .getUTCFullYear(),
    );

  const [
    context,
    setContext,
  ] =
    useState<
      OkrContext |
      null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    periodType,
    setPeriodType,
  ] =
    useState<StrategicObjectivePeriodType>(
      "ANNUAL",
    );

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      initialYear,
    );

  const [
    quarter,
    setQuarter,
  ] =
    useState(1);

  const initialDates =
    dates(
      initialYear,
      "ANNUAL",
      1,
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      initialDates.start,
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      initialDates.end,
    );

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

    getStrategicOkrContext(
      currency,
    )
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
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load strategic-objective context.",
            );
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    currency,
  ]);

  function updatePeriod(
    type:
      StrategicObjectivePeriodType,
    year: number,
    selectedQuarter: number,
  ) {
    const value =
      dates(
        year,
        type,
        selectedQuarter,
      );

    setStartDate(
      value.start,
    );

    setEndDate(
      value.end,
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const result =
        await createStrategicObjective({
          title:
            title.trim(),
          description:
            description.trim(),
          currency,
          periodType,
          fiscalYear,
          quarter:
            periodType ===
              "QUARTERLY"
              ? quarter
              : undefined,
          startDate,
          endDate,
          ownerUserId:
            ownerUserId
            ||
            undefined,
        });

      router.push(
        `/strategic-objectives/${result.objective.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create strategic objective.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategic-objectives"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategic objectives
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement strategy
          </span>

          <h1>
            New strategic objective
          </h1>

          <p>
            Define the objective period,
            executive owner and strategic
            outcome. Key results are
            added after the objective is
            created.
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
              Strategic definition
            </span>

            <h2>
              Objective
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="okr-form-grid">
          <label className="request-field okr-form-wide">
            <span>
              Objective title
            </span>

            <input
              required
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
              Period
            </span>

            <select
              value={periodType}
              onChange={
                event => {
                  const value =
                    event.target.value as
                      StrategicObjectivePeriodType;

                  setPeriodType(
                    value,
                  );

                  updatePeriod(
                    value,
                    fiscalYear,
                    quarter,
                  );
                }
              }
            >
              <option value="ANNUAL">
                Annual
              </option>

              <option value="QUARTERLY">
                Quarterly
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
                event => {
                  const value =
                    Number(
                      event.target.value,
                    );

                  setFiscalYear(
                    value,
                  );

                  updatePeriod(
                    periodType,
                    value,
                    quarter,
                  );
                }
              }
            />
          </label>

          {periodType ===
          "QUARTERLY" ? (
            <label className="request-field">
              <span>
                Quarter
              </span>

              <select
                value={quarter}
                onChange={
                  event => {
                    const value =
                      Number(
                        event.target.value,
                      );

                    setQuarter(
                      value,
                    );

                    updatePeriod(
                      periodType,
                      fiscalYear,
                      value,
                    );
                  }
                }
              >
                <option value={1}>
                  Q1
                </option>

                <option value={2}>
                  Q2
                </option>

                <option value={3}>
                  Q3
                </option>

                <option value={4}>
                  Q4
                </option>
              </select>
            </label>
          ) : null}

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
                  candidate =>
                    candidate.role !==
                    "REQUESTER",
                )
                .map(
                  candidate => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                    >
                      {candidate.fullName}
                      {" — "}
                      {candidate.role}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="request-field">
            <span>
              Start
            </span>

            <input
              type="date"
              required
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
              End
            </span>

            <input
              type="date"
              required
              value={endDate}
              onChange={
                event =>
                  setEndDate(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field okr-form-wide">
            <span>
              Strategic outcome
            </span>

            <textarea
              required
              rows={7}
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

        <div className="okr-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !title.trim()
              ||
              !description.trim()
            }
          >
            {saving
              ? "Creating..."
              : "Create objective"}
          </button>
        </div>
      </form>
    </div>
  );
}
