"use client";

import {
  ArrowLeft,
  CalendarRange,
  CircleAlert,
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
  createProcurementPlan,
  getPlanningContextOptions,
} from "@/lib/api";

import type {
  PlanningContextOptions,
} from "@/types/planning";

const CURRENT_YEAR =
  new Date()
    .getUTCFullYear();

export default function NewPlanningPage() {
  const router =
    useRouter();

  const [
    options,
    setOptions,
  ] =
    useState<
      PlanningContextOptions |
      null
    >(null);

  const [
    name,
    setName,
  ] =
    useState(
      `Annual Procurement Plan ${CURRENT_YEAR}`,
    );

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      CURRENT_YEAR,
    );

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
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    getPlanningContextOptions()
      .then(
        response => {
          if (!active) {
            return;
          }

          setOptions(
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
              : "Unable to load planning context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const plan =
        await createProcurementPlan({
          name:
            name.trim(),
          fiscalYear,
          currency:
            currency
              .trim()
              .toUpperCase(),
          ownerUserId:
            ownerUserId ||
            undefined,
          notes:
            notes.trim() ||
            undefined,
        });

      router.push(
        `/planning/${plan.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create procurement plan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/planning"
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Procurement planning
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategic planning
          </span>

          <h1>
            New procurement plan
          </h1>

          <p>
            Establish the annual
            procurement planning
            authority before adding
            department and category
            demand initiatives.
          </p>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />
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
              Plan setup
            </span>

            <h2>
              Planning authority
            </h2>
          </div>

          <CalendarRange size={19} />
        </div>

        <div className="planning-form-grid">
          <label className="request-field planning-form-wide">
            <span>
              Plan name
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

          <label className="request-field">
            <span>
              Fiscal year
            </span>

            <input
              required
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

          <label className="request-field">
            <span>Currency</span>

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

          <label className="request-field planning-form-wide">
            <span>
              Plan owner
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
              {options
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

          <label className="request-field planning-form-wide">
            <span>Notes</span>

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
        </div>

        <div className="planning-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={saving}
          >
            <CalendarRange size={16} />

            {saving
              ? "Creating..."
              : "Create planning draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
