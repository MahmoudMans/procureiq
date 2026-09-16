"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  createFlywheelContinuationOutcomeCase,
  getFlywheelContinuationOutcomeDashboard,
} from "@/lib/api";

import type {
  FlywheelContinuationOutcomeDashboard,
} from "@/types/flywheel-continuation-outcome";

function money(
  value: number,
  currency: string,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
    },
  ).format(value);
}

export default function ContinuationOutcomesPage() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<FlywheelContinuationOutcomeDashboard | null>(
      null,
    );

  const [sourceId, setSourceId] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelContinuationOutcomeDashboard()
      .then((result) => {
        if (!cancelled) {
          setDashboard(result);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load continuation outcomes.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createCase(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!sourceId) {
      setError(
        "A closed continuation source is required.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      const result =
        await createFlywheelContinuationOutcomeCase({
          sourceContinuationCaseId: sourceId,
        });

      router.push(
        `/flywheel-continuation-outcomes/${result.outcomeCase.id}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create outcome case.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!dashboard) {
    return (
      <main className="page-shell">
        <h1>Continuation outcomes</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Observed post-continuation evidence
          </p>

          <h1>Continuation outcomes</h1>

          <p>
            Re-evaluate residual exposure after a governance
            continuation closes without rewriting its immutable history.
          </p>
        </div>
      </div>

      {error ? (
        <div className="alert error">
          {error}
        </div>
      ) : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Total</span>
          <strong>
            {dashboard.summary.totalCases}
          </strong>
        </article>

        <article className="metric-card">
          <span>Draft</span>
          <strong>
            {dashboard.summary.draftCases}
          </strong>
        </article>

        <article className="metric-card">
          <span>In review</span>
          <strong>
            {dashboard.summary.inReviewCases}
          </strong>
        </article>

        <article className="metric-card">
          <span>Verified</span>
          <strong>
            {dashboard.summary.verifiedCases}
          </strong>
        </article>

        <article className="metric-card">
          <span>Closed</span>
          <strong>
            {dashboard.summary.closedCases}
          </strong>
        </article>

        <article className="metric-card">
          <span>Further governance</span>
          <strong>
            {dashboard.summary.furtherGovernanceRequiredCases}
          </strong>
        </article>
      </section>

      <section className="panel">
        <h2>Remaining residual</h2>

        <div className="metric-grid">
          {dashboard.summary.remainingResidualByCurrency.map(
            (total) => (
              <article
                className="metric-card"
                key={total.currency}
              >
                <span>{total.currency}</span>

                <strong>
                  {money(
                    total.amount,
                    total.currency,
                  )}
                </strong>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Create outcome evidence case</h2>

        <form
          className="form-grid"
          onSubmit={createCase}
        >
          <label className="full-width">
            Closed continuation

            <select
              value={sourceId}
              onChange={(event) =>
                setSourceId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Select closed continuation
              </option>

              {dashboard.eligibleSources.map(
                (source) => (
                  <option
                    key={source.continuationCaseId}
                    value={source.continuationCaseId}
                  >
                    {source.continuationNumber} —{" "}
                    {money(
                      source.sourceResidualAmount,
                      source.currency,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="full-width">
            <button
              type="submit"
              disabled={busy}
            >
              Create outcome case
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Outcome cases</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Outcome</th>
                <th>Status</th>
                <th>Disposition</th>
                <th>Residual</th>
                <th>Coverage</th>
              </tr>
            </thead>

            <tbody>
              {dashboard.cases.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        href={
                          `/flywheel-continuation-outcomes/${item.id}`
                        }
                      >
                        {item.outcomeNumber}
                      </Link>

                      <div>{item.title}</div>
                    </td>

                    <td>{item.status}</td>

                    <td>
                      {item.residualDisposition || "PENDING"}
                    </td>

                    <td>
                      {money(
                        item.currentRemainingResidualAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.itemCount}/
                      {item.sourceItemCount}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
