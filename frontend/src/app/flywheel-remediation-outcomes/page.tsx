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
  createFlywheelRemediationOutcomeCase,
  getFlywheelRemediationOutcomeDashboard,
} from "@/lib/api";

import type {
  FlywheelRemediationOutcomeDashboard,
} from "@/types/flywheel-remediation-outcome";

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

export default function FlywheelRemediationOutcomesPage() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<FlywheelRemediationOutcomeDashboard | null>(
      null,
    );

  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getFlywheelRemediationOutcomeDashboard()
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
              : "Unable to load remediation outcomes.",
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
          source.remediationPlanId === sourceId,
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
        "Source remediation plan and title are required.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      const result =
        await createFlywheelRemediationOutcomeCase({
          sourceRemediationPlanId: sourceId,
          title: title.trim(),
        });

      router.push(
        `/flywheel-remediation-outcomes/${result.outcomeCase.id}`,
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
        <h1>Remediation outcomes</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Residual closure assurance
          </p>

          <h1>
            Remediation outcomes
          </h1>

          <p>
            Record independently observed evidence showing what
            happened after residual-remediation governance.
          </p>

          <p>
            ProcureIQ records evidence only. It does not execute
            collections, write-offs, refunds, payments, or
            accounting entries.
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
          <span>Total cases</span>
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
      </section>

      <section className="panel">
        <h2>
          Remaining residual by currency
        </h2>

        {dashboard.summary.remainingByCurrency.length === 0 ? (
          <p>No governed outcome residual yet.</p>
        ) : (
          <div className="metric-grid">
            {dashboard.summary.remainingByCurrency.map(
              (total) => (
                <article
                  className="metric-card"
                  key={total.currency}
                >
                  <span>
                    {total.currency}
                  </span>

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
        )}
      </section>

      <section className="panel">
        <h2>Create outcome case</h2>

        <form
          className="form-grid"
          onSubmit={createCase}
        >
          <label>
            Eligible remediation plan

            <select
              value={sourceId}
              onChange={(event) =>
                setSourceId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Select remediation plan
              </option>

              {dashboard.eligibleSources.map(
                (source) => (
                  <option
                    key={source.remediationPlanId}
                    value={source.remediationPlanId}
                  >
                    {source.title} —{" "}
                    {money(
                      source.residualAmount,
                      source.currency,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Outcome case title

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
                  selected.residualAmount,
                  selected.currency,
                )}
              </strong>{" "}
              across {selected.itemCount} remediation decision(s).
            </div>
          ) : null}

          <div className="full-width">
            <button
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Creating…"
                : "Create outcome case"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Outcome cases</h2>

        {dashboard.cases.length === 0 ? (
          <p>No outcome cases yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Status</th>
                  <th>Source residual</th>
                  <th>Resolved</th>
                  <th>Remaining</th>
                  <th>Evidence</th>
                </tr>
              </thead>

              <tbody>
                {dashboard.cases.map(
                  (outcome) => (
                    <tr key={outcome.id}>
                      <td>
                        <Link
                          href={
                            `/flywheel-remediation-outcomes/${outcome.id}`
                          }
                        >
                          {outcome.outcomeNumber}
                        </Link>

                        <div>
                          {outcome.title}
                        </div>
                      </td>

                      <td>
                        {outcome.status}
                      </td>

                      <td>
                        {money(
                          outcome.sourceResidualAmount,
                          outcome.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          outcome.resolvedAmount,
                          outcome.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          outcome.remainingResidualAmount,
                          outcome.currency,
                        )}
                      </td>

                      <td>
                        {outcome.itemCount}/
                        {outcome.sourceItemCount}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
