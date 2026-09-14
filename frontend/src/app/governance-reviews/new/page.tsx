"use client";

import {
  ArrowLeft,
  CircleAlert,
  Landmark,
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
  createGovernanceReview,
  getGovernanceReviewContext,
} from "@/lib/api";

import type {
  GovernanceReviewContext,
} from "@/types/governance-review";

function firstDayOfMonth(): string {
  const date =
    new Date();

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1,
    ),
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function NewGovernanceReviewPage() {
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

  const [
    context,
    setContext,
  ] =
    useState<
      GovernanceReviewContext |
      null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    periodStart,
    setPeriodStart,
  ] =
    useState(
      firstDayOfMonth(),
    );

  const [
    periodEnd,
    setPeriodEnd,
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
    chairUserId,
    setChairUserId,
  ] =
    useState("");

  const [
    executiveSummary,
    setExecutiveSummary,
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

    getGovernanceReviewContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          const governanceUser =
            response.users.find(
              user =>
                user.role ===
                  "PROCUREMENT_MANAGER"
                ||
                user.role ===
                  "ADMIN",
            )
            ??
            response.users.find(
              user =>
                user.role !==
                  "REQUESTER",
            );

          if (governanceUser) {
            setOwnerUserId(
              governanceUser.id,
            );

            setChairUserId(
              governanceUser.id,
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
              : "Unable to load governance-review context.",
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
        await createGovernanceReview({
          title:
            title.trim(),
          periodStart,
          periodEnd,
          currency,
          ownerUserId:
            ownerUserId
            ||
            undefined,
          chairUserId:
            chairUserId
            ||
            undefined,
          executiveSummary:
            executiveSummary.trim(),
        });

      router.push(
        `/governance-reviews/${result.review.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create governance review.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/governance-reviews"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Governance reviews
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Executive review cycle
          </span>

          <h1>
            New governance review
          </h1>

          <p>
            Define the review period,
            executive ownership and
            management narrative before
            freezing the point-in-time
            procurement snapshot.
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
              Review definition
            </span>

            <h2>
              Board review setup
            </h2>
          </div>

          <Landmark
            size={19}
          />
        </div>

        <div className="governance-form-grid">
          <label className="request-field governance-form-wide">
            <span>
              Review title
            </span>

            <input
              required
              maxLength={240}
              value={title}
              placeholder={
                "Example: September 2026 Procurement Executive Review"
              }
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
              Period start
            </span>

            <input
              required
              type="date"
              value={periodStart}
              onChange={
                event =>
                  setPeriodStart(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Period end
            </span>

            <input
              required
              type="date"
              value={periodEnd}
              onChange={
                event =>
                  setPeriodEnd(
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
              value={currency}
              disabled
            />
          </label>

          <label className="request-field">
            <span>
              Review owner
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
              Review chair
            </span>

            <select
              value={chairUserId}
              onChange={
                event =>
                  setChairUserId(
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

          <label className="request-field governance-form-wide">
            <span>
              Executive summary
            </span>

            <textarea
              required
              rows={9}
              maxLength={5000}
              value={executiveSummary}
              placeholder={
                "Summarize the procurement context, management priorities, material changes and key topics expected for executive discussion."
              }
              onChange={
                event =>
                  setExecutiveSummary(
                    event.target.value,
                  )
              }
            />
          </label>
        </div>

        <div className="governance-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !title.trim()
              ||
              !executiveSummary.trim()
            }
          >
            {saving
              ? "Creating..."
              : "Create draft review"}
          </button>
        </div>
      </form>
    </div>
  );
}
