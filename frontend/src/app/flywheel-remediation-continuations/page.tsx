"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createFlywheelResidualContinuationCase,
  getFlywheelResidualContinuationDashboard,
} from "@/lib/api";

import type {
  FlywheelResidualContinuationDashboard,
} from "@/types/flywheel-remediation-continuation";

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

export default function ResidualContinuationPage() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<FlywheelResidualContinuationDashboard | null>(
      null,
    );

  const [sourceId, setSourceId] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelResidualContinuationDashboard()
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
              : "Unable to load residual continuations.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () =>
      dashboard?.eligibleSources.find(
        (source) =>
          source.outcomeCaseId === sourceId,
      ),
    [dashboard, sourceId],
  );

  async function createCase(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !sourceId ||
      !title.trim()
    ) {
      setError(
        "Source outcome and title are required.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      const result =
        await createFlywheelResidualContinuationCase({
          sourceOutcomeCaseId: sourceId,
          title: title.trim(),
        });

      router.push(
        `/flywheel-remediation-continuations/${result.continuationCase.id}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create continuation case.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!dashboard) {
    return (
      <main className="page-shell">
        <h1>Residual continuations</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Post-verification residual governance
          </p>

          <h1>Residual continuations</h1>

          <p>
            Govern remaining financial exposure without rewriting
            immutable remediation-outcome evidence.
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
        <h2>Create continuation case</h2>

        <form
          className="form-grid"
          onSubmit={createCase}
        >
          <label>
            Verified outcome with residual

            <select
              value={sourceId}
              onChange={(event) =>
                setSourceId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Select source outcome
              </option>

              {dashboard.eligibleSources.map(
                (source) => (
                  <option
                    key={source.outcomeCaseId}
                    value={source.outcomeCaseId}
                  >
                    {source.outcomeNumber} —{" "}
                    {money(
                      source.remainingResidualAmount,
                      source.currency,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Continuation title

            <input
              value={title}
              maxLength={240}
              onChange={(event) =>
                setTitle(
                  event.target.value,
                )
              }
            />
          </label>

          {selected ? (
            <div className="full-width">
              <strong>
                {money(
                  selected.remainingResidualAmount,
                  selected.currency,
                )}
              </strong>{" "}
              across {selected.residualItemCount} residual item(s).
            </div>
          ) : null}

          <div className="full-width">
            <button
              type="submit"
              disabled={busy}
            >
              Create continuation
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Continuation cases</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Continuation</th>
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
                          `/flywheel-remediation-continuations/${item.id}`
                        }
                      >
                        {item.continuationNumber}
                      </Link>

                      <div>{item.title}</div>
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
