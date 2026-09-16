"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useEffect,
  useState,
} from "react";

import {
  addFlywheelResidualContinuationItem,
  approveFlywheelResidualContinuationCase,
  captureFlywheelResidualContinuationSnapshot,
  closeFlywheelResidualContinuationCase,
  getFlywheelResidualContinuationCase,
  submitFlywheelResidualContinuationCase,
} from "@/lib/api";

import type {
  FlywheelResidualContinuationAction,
  FlywheelResidualContinuationCaseDetail,
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

const actions: FlywheelResidualContinuationAction[] = [
  "RECOVERY_RETRY",
  "WRITE_OFF_ESCALATION",
  "INVESTIGATION_ESCALATION",
  "RISK_ACCEPTANCE_ESCALATION",
];

export default function ResidualContinuationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelResidualContinuationCaseDetail | null>(
      null,
    );

  const [candidateId, setCandidateId] =
    useState("");

  const [action, setAction] =
    useState<FlywheelResidualContinuationAction>(
      "RECOVERY_RETRY",
    );

  const [targetDate, setTargetDate] =
    useState("");

  const [rationale, setRationale] =
    useState("");

  const [note, setNote] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelResidualContinuationCase(id)
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
              : "Unable to load continuation case.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function reload() {
    setDetail(
      await getFlywheelResidualContinuationCase(
        id,
      ),
    );
  }

  async function addItem(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !candidateId ||
      !targetDate ||
      !rationale.trim()
    ) {
      setError(
        "Residual item, target date and rationale are required.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      setDetail(
        await addFlywheelResidualContinuationItem(
          id,
          {
            sourceOutcomeItemId:
              candidateId,

            continuationAction:
              action,

            targetDate,

            rationale:
              rationale.trim(),
          },
        ),
      );

      setCandidateId("");
      setTargetDate("");
      setRationale("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to add continuation governance.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function perform(
    operation:
      () => Promise<FlywheelResidualContinuationCaseDetail>,
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
        <h1>Residual continuation</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  const continuation =
    detail.continuationCase;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {continuation.continuationNumber}
          </p>

          <h1>{continuation.title}</h1>

          <p>
            Follow-up governance for residual exposure preserved
            from immutable outcome evidence.
          </p>
        </div>

        <Link href="/flywheel-remediation-continuations">
          Back
        </Link>
      </div>

      {error ? (
        <div className="alert error">
          {error}
        </div>
      ) : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Status</span>
          <strong>{continuation.status}</strong>
        </article>

        <article className="metric-card">
          <span>Residual exposure</span>
          <strong>
            {money(
              continuation.sourceRemainingResidualAmount,
              continuation.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Governance coverage</span>
          <strong>
            {continuation.itemCount}/
            {continuation.sourceResidualItemCount}
          </strong>
        </article>
      </section>

      {continuation.status === "DRAFT" &&
      detail.candidates.length > 0 ? (
        <section className="panel">
          <h2>Add continuation governance</h2>

          <form
            className="form-grid"
            onSubmit={addItem}
          >
            <label>
              Residual outcome item

              <select
                value={candidateId}
                onChange={(event) =>
                  setCandidateId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select residual item
                </option>

                {detail.candidates.map(
                  (candidate) => (
                    <option
                      key={candidate.outcomeItemId}
                      value={candidate.outcomeItemId}
                    >
                      {candidate.sourceAction} —{" "}
                      {money(
                        candidate.remainingResidualAmount,
                        continuation.currency,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Continuation action

              <select
                value={action}
                onChange={(event) =>
                  setAction(
                    event.target
                      .value as FlywheelResidualContinuationAction,
                  )
                }
              >
                {actions.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Target date

              <input
                type="date"
                value={targetDate}
                onChange={(event) =>
                  setTargetDate(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="full-width">
              Rationale

              <textarea
                value={rationale}
                maxLength={2500}
                onChange={(event) =>
                  setRationale(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="full-width">
              <button
                type="submit"
                disabled={busy}
              >
                Add immutable governance
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <h2>Continuation items</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Residual</th>
                <th>Continuation</th>
                <th>Target</th>
                <th>Rationale</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      {item.sourceAction}
                      <div>
                        {item.sourceResolutionType}
                      </div>
                    </td>

                    <td>
                      {money(
                        item.sourceRemainingResidualAmount,
                        continuation.currency,
                      )}
                    </td>

                    <td>
                      {item.continuationAction}
                    </td>

                    <td>
                      {item.targetDate}
                    </td>

                    <td>
                      {item.rationale}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Lifecycle</h2>

        <div className="button-row">
          {continuation.status === "DRAFT" ? (
            <button
              disabled={busy}
              onClick={() =>
                void perform(
                  () =>
                    submitFlywheelResidualContinuationCase(
                      id,
                    ),
                )
              }
            >
              Submit
            </button>
          ) : null}

          {continuation.status === "IN_REVIEW" ? (
            <>
              <input
                value={note}
                placeholder="Approval note"
                onChange={(event) =>
                  setNote(
                    event.target.value,
                  )
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
                      approveFlywheelResidualContinuationCase(
                        id,
                        {
                          note:
                            note.trim(),
                        },
                      ),
                  )
                }
              >
                Approve
              </button>
            </>
          ) : null}

          {continuation.status === "APPROVED" ? (
            <>
              <input
                value={note}
                placeholder="Closure note"
                onChange={(event) =>
                  setNote(
                    event.target.value,
                  )
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
                      closeFlywheelResidualContinuationCase(
                        id,
                        {
                          note:
                            note.trim(),
                        },
                      ),
                  )
                }
              >
                Close governance
              </button>
            </>
          ) : null}

          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                try {
                  await captureFlywheelResidualContinuationSnapshot(
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
        <h2>Snapshots</h2>

        <ul>
          {detail.snapshots.map(
            (snapshot) => (
              <li key={snapshot.id}>
                <Link
                  href={
                    `/flywheel-remediation-continuations/snapshots/${snapshot.id}`
                  }
                >
                  {snapshot.snapshotNumber}
                </Link>{" "}
                — {snapshot.continuationStatus}
              </li>
            ),
          )}
        </ul>
      </section>
    </main>
  );
}
