"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  createFlywheelContinuationRolloverCase,
  getFlywheelContinuationRolloverDashboard,
} from "@/lib/api";

import type {
  FlywheelContinuationRolloverDashboard,
} from "@/types/flywheel-continuation-rollover";

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

export default function ContinuationRolloversPage() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<FlywheelContinuationRolloverDashboard | null>(
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

    getFlywheelContinuationRolloverDashboard()
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
              : "Unable to load residual-cycle rollovers.",
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
        "A verified positive-residual outcome is required.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      const result =
        await createFlywheelContinuationRolloverCase({
          sourceContinuationOutcomeCaseId:
            sourceId,
        });

      router.push(
        `/flywheel-continuation-rollovers/${result.rolloverCase.id}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create residual rollover cycle.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!dashboard) {
    return (
      <main className="page-shell">
        <h1>Residual cycle rollovers</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Persistent residual governance
          </p>

          <h1>Residual cycle rollovers</h1>

          <p>
            Start a new governed continuation cycle only when
            verified evidence proves that positive financial
            residual remains.
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
          <span>Approved</span>
          <strong>
            {dashboard.summary.approvedCases}
          </strong>
        </article>

        <article className="metric-card">
          <span>Closed</span>
          <strong>
            {dashboard.summary.closedCases}
          </strong>
        </article>
      </section>

      <section className="panel">
        <h2>Governed residual</h2>

        <div className="metric-grid">
          {dashboard.summary.governedResidualByCurrency.map(
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
        <h2>Start next cycle</h2>

        <form
          className="form-grid"
          onSubmit={createCase}
        >
          <label className="full-width">
            Verified residual outcome

            <select
              value={sourceId}
              onChange={(event) =>
                setSourceId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Select verified positive residual
              </option>

              {dashboard.eligibleSources.map(
                (source) => (
                  <option
                    key={source.continuationOutcomeCaseId}
                    value={source.continuationOutcomeCaseId}
                  >
                    {source.continuationOutcomeNumber}
                    {" — "}
                    {source.parentContinuationNumber}
                    {" — "}
                    {money(
                      source.remainingResidualAmount,
                      source.currency,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="full-width">
            <button
              disabled={busy}
              type="submit"
            >
              Create rollover cycle
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Rollover cycles</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Parent</th>
                <th>Status</th>
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
                          `/flywheel-continuation-rollovers/${item.id}`
                        }
                      >
                        {item.rolloverNumber}
                      </Link>
                    </td>

                    <td>
                      {item.parentContinuationNumber}
                    </td>

                    <td>{item.status}</td>

                    <td>
                      {money(
                        item.sourceRemainingResidualAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.itemCount}/
                      {item.sourceResidualItemCount}
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
