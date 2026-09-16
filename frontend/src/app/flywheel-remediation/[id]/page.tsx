"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";

import {
  addFlywheelResidualRemediationItem,
  approveFlywheelResidualRemediationPlan,
  captureFlywheelResidualRemediationSnapshot,
  closeFlywheelResidualRemediationPlan,
  getFlywheelResidualRemediationPlan,
  submitFlywheelResidualRemediationPlan,
} from "@/lib/api";

import type {
  FlywheelResidualRemediationAction,
  FlywheelResidualRemediationPlanDetail,
} from "@/types/flywheel-remediation";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

const actions: FlywheelResidualRemediationAction[] = [
  "RECOVERY_FOLLOW_UP",
  "WRITE_OFF_REVIEW",
  "INVESTIGATION_ESCALATION",
  "RESIDUAL_ACCEPTANCE_REVIEW",
];

export default function FlywheelRemediationPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelResidualRemediationPlanDetail | null>(null);

  const [candidateId, setCandidateId] = useState("");

  const [action, setAction] =
    useState<FlywheelResidualRemediationAction>(
      "RECOVERY_FOLLOW_UP",
    );

  const [targetDate, setTargetDate] = useState("");
  const [rationale, setRationale] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setDetail(
        await getFlywheelResidualRemediationPlan(id),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load remediation plan.",
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    getFlywheelResidualRemediationPlan(id)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load remediation plan.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function addDecision(event: FormEvent) {
    event.preventDefault();

    if (
      !candidateId ||
      !targetDate ||
      !rationale.trim()
    ) {
      setError(
        "Source item, target date and rationale are required.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      setDetail(
        await addFlywheelResidualRemediationItem(
          id,
          {
            sourceExecutionItemId: candidateId,
            action,
            targetDate,
            rationale: rationale.trim(),
          },
        ),
      );

      setCandidateId("");
      setRationale("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to add remediation decision.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function perform(
    operation: () => Promise<FlywheelResidualRemediationPlanDetail>,
  ) {
    setBusy(true);
    setError("");

    try {
      setDetail(
        await operation(),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <main className="page-shell">
        <h1>Residual remediation</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  const plan = detail.plan;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">{plan.planNumber}</p>
          <h1>{plan.title}</h1>
          <p>{plan.remediationObjective}</p>
        </div>

        <Link href="/flywheel-remediation">
          Back to remediation
        </Link>
      </div>

      {error ? (
        <div className="alert error">{error}</div>
      ) : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Status</span>
          <strong>{plan.status}</strong>
        </article>

        <article className="metric-card">
          <span>Source residual</span>
          <strong>
            {money(
              plan.sourceResidualAmount,
              plan.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Governed residual</span>
          <strong>
            {money(
              plan.coveredResidualAmount,
              plan.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Coverage</span>
          <strong>
            {plan.itemCount}/
            {plan.sourcePositiveItemCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <h2>Governance allocation</h2>

        <div className="metric-grid">
          <article className="metric-card">
            <span>Recovery follow-up</span>
            <strong>
              {money(
                plan.recoveryFollowUpAmount,
                plan.currency,
              )}
            </strong>
          </article>

          <article className="metric-card">
            <span>Write-off review</span>
            <strong>
              {money(
                plan.writeOffReviewAmount,
                plan.currency,
              )}
            </strong>
          </article>

          <article className="metric-card">
            <span>Investigation escalation</span>
            <strong>
              {money(
                plan.investigationEscalationAmount,
                plan.currency,
              )}
            </strong>
          </article>

          <article className="metric-card">
            <span>Residual acceptance review</span>
            <strong>
              {money(
                plan.residualAcceptanceReviewAmount,
                plan.currency,
              )}
            </strong>
          </article>
        </div>

        <p>
          These amounts represent governance classifications only.
          ProcureIQ does not execute collections, write-offs,
          payments, refunds, or accounting entries.
        </p>
      </section>

      {plan.status === "DRAFT" &&
      detail.candidates.length > 0 ? (
        <section className="panel">
          <h2>Add remediation decision</h2>

          <form
            className="form-grid"
            onSubmit={addDecision}
          >
            <label>
              Positive-residual source item

              <select
                value={candidateId}
                onChange={(event) =>
                  setCandidateId(event.target.value)
                }
              >
                <option value="">
                  Select source item
                </option>

                {detail.candidates.map((candidate) => (
                  <option
                    key={candidate.executionItemId}
                    value={candidate.executionItemId}
                  >
                    {candidate.sourceDecision} —{" "}
                    {money(
                      candidate.residualAmount,
                      plan.currency,
                    )}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Governance action

              <select
                value={action}
                onChange={(event) =>
                  setAction(
                    event.target
                      .value as FlywheelResidualRemediationAction,
                  )
                }
              >
                {actions.map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Target date

              <input
                type="date"
                value={targetDate}
                onChange={(event) =>
                  setTargetDate(event.target.value)
                }
              />
            </label>

            <label className="full-width">
              Rationale

              <textarea
                value={rationale}
                maxLength={2500}
                onChange={(event) =>
                  setRationale(event.target.value)
                }
              />
            </label>

            <div className="full-width">
              <button
                type="submit"
                disabled={busy}
              >
                Add remediation decision
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <h2>Remediation decisions</h2>

        {detail.items.length === 0 ? (
          <p>No remediation decisions yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source decision</th>
                  <th>Residual</th>
                  <th>Action</th>
                  <th>Target date</th>
                  <th>Rationale</th>
                </tr>
              </thead>

              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sourceDecision}</td>

                    <td>
                      {money(
                        item.residualAmount,
                        plan.currency,
                      )}
                    </td>

                    <td>{item.action}</td>
                    <td>{item.targetDate}</td>
                    <td>{item.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Lifecycle</h2>

        <div className="button-row">
          {plan.status === "DRAFT" ? (
            <button
              disabled={busy}
              onClick={() =>
                void perform(
                  () =>
                    submitFlywheelResidualRemediationPlan(
                      id,
                    ),
                )
              }
            >
              Submit for review
            </button>
          ) : null}

          {plan.status === "IN_REVIEW" ? (
            <>
              <input
                value={note}
                placeholder="Approval note"
                onChange={(event) =>
                  setNote(event.target.value)
                }
              />

              <button
                disabled={
                  busy ||
                  !note.trim()
                }
                onClick={() =>
                  void perform(
                    () =>
                      approveFlywheelResidualRemediationPlan(
                        id,
                        {
                          note: note.trim(),
                        },
                      ),
                  )
                }
              >
                Approve
              </button>
            </>
          ) : null}

          {plan.status === "APPROVED" ? (
            <>
              <input
                value={note}
                placeholder="Closure note"
                onChange={(event) =>
                  setNote(event.target.value)
                }
              />

              <button
                disabled={
                  busy ||
                  !note.trim()
                }
                onClick={() =>
                  void perform(
                    () =>
                      closeFlywheelResidualRemediationPlan(
                        id,
                        {
                          note: note.trim(),
                        },
                      ),
                  )
                }
              >
                Close
              </button>
            </>
          ) : null}

          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                try {
                  await captureFlywheelResidualRemediationSnapshot(
                    id,
                  );

                  await reload();
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Unable to capture snapshot.",
                  );
                }
              })()
            }
          >
            Capture snapshot
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Evidence snapshots</h2>

        {detail.snapshots.length === 0 ? (
          <p>No snapshots captured.</p>
        ) : (
          <ul>
            {detail.snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <Link
                  href={
                    `/flywheel-remediation/snapshots/${snapshot.id}`
                  }
                >
                  {snapshot.snapshotNumber}
                </Link>{" "}
                — {snapshot.planStatus} —{" "}
                {new Date(
                  snapshot.capturedAt,
                ).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
