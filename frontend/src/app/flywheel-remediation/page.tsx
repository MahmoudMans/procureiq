"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createFlywheelResidualRemediationPlan,
  getFlywheelResidualRemediationDashboard,
} from "@/lib/api";

import type {
  FlywheelResidualRemediationDashboard,
} from "@/types/flywheel-remediation";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export default function FlywheelRemediationPage() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<FlywheelResidualRemediationDashboard | null>(null);

  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getFlywheelResidualRemediationDashboard()
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
              : "Unable to load residual remediation.",
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
          source.executionCaseId === sourceId,
      ),
    [dashboard, sourceId],
  );

  async function createPlan(event: FormEvent) {
    event.preventDefault();

    if (
      !sourceId ||
      !title.trim() ||
      !objective.trim()
    ) {
      setError(
        "Source, title and remediation objective are required.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result =
        await createFlywheelResidualRemediationPlan({
          sourceExecutionCaseId: sourceId,
          title: title.trim(),
          remediationObjective: objective.trim(),
        });

      router.push(
        `/flywheel-remediation/${result.plan.id}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create remediation plan.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!dashboard) {
    return (
      <main className="page-shell">
        <h1>Residual exposure remediation</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">Capital flywheel governance</p>
          <h1>Residual exposure remediation</h1>
          <p>
            Govern positive financial residual remaining after verified
            variance-treatment execution evidence.
          </p>
          <p>
            ProcureIQ records remediation governance only. It does not
            execute payments, collections, refunds, write-offs, or
            accounting postings.
          </p>
        </div>
      </div>

      {error ? (
        <div className="alert error">{error}</div>
      ) : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Total plans</span>
          <strong>{dashboard.summary.totalPlans}</strong>
        </article>

        <article className="metric-card">
          <span>Draft</span>
          <strong>{dashboard.summary.draftPlans}</strong>
        </article>

        <article className="metric-card">
          <span>In review</span>
          <strong>{dashboard.summary.inReviewPlans}</strong>
        </article>

        <article className="metric-card">
          <span>Approved</span>
          <strong>{dashboard.summary.approvedPlans}</strong>
        </article>

        <article className="metric-card">
          <span>Closed</span>
          <strong>{dashboard.summary.closedPlans}</strong>
        </article>
      </section>

      <section className="panel">
        <h2>Residual exposure by currency</h2>

        {dashboard.summary.residualByCurrency.length === 0 ? (
          <p>No governed residual exposure yet.</p>
        ) : (
          <div className="metric-grid">
            {dashboard.summary.residualByCurrency.map((total) => (
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
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Create remediation plan</h2>

        <form
          className="form-grid"
          onSubmit={createPlan}
        >
          <label>
            Eligible execution case

            <select
              value={sourceId}
              onChange={(event) =>
                setSourceId(event.target.value)
              }
            >
              <option value="">
                Select execution case
              </option>

              {dashboard.eligibleSources.map((source) => (
                <option
                  key={source.executionCaseId}
                  value={source.executionCaseId}
                >
                  {source.title} —{" "}
                  {money(
                    source.financialResidualAmount,
                    source.currency,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label>
            Plan title

            <input
              value={title}
              maxLength={240}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </label>

          <label className="full-width">
            Remediation objective

            <textarea
              value={objective}
              maxLength={2500}
              onChange={(event) =>
                setObjective(event.target.value)
              }
            />
          </label>

          {selected ? (
            <div className="full-width">
              <strong>
                {money(
                  selected.financialResidualAmount,
                  selected.currency,
                )}
              </strong>{" "}
              across {selected.residualItemCount} positive-residual
              execution item(s).
            </div>
          ) : null}

          <div className="full-width">
            <button
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Creating…"
                : "Create remediation plan"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Remediation plans</h2>

        {dashboard.plans.length === 0 ? (
          <p>No remediation plans yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Residual</th>
                  <th>Governed</th>
                  <th>Coverage</th>
                </tr>
              </thead>

              <tbody>
                {dashboard.plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <Link
                        href={`/flywheel-remediation/${plan.id}`}
                      >
                        {plan.planNumber}
                      </Link>

                      <div>{plan.title}</div>
                    </td>

                    <td>{plan.status}</td>

                    <td>
                      {money(
                        plan.sourceResidualAmount,
                        plan.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        plan.coveredResidualAmount,
                        plan.currency,
                      )}
                    </td>

                    <td>
                      {plan.itemCount}/
                      {plan.sourcePositiveItemCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
