"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useEffect,
  useState,
} from "react";

import {
  addFlywheelContinuationOutcomeItem,
  captureFlywheelContinuationOutcomeSnapshot,
  closeFlywheelContinuationOutcomeCase,
  getFlywheelContinuationOutcomeCase,
  submitFlywheelContinuationOutcomeCase,
  verifyFlywheelContinuationOutcomeCase,
} from "@/lib/api";

import type {
  FlywheelContinuationOutcomeCaseDetail,
  FlywheelContinuationOutcomeResolutionType,
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

const resolutionTypes: FlywheelContinuationOutcomeResolutionType[] = [
  "RECOVERY_CONFIRMED",
  "WRITE_OFF_CONFIRMED",
  "INVESTIGATION_CONCLUDED",
  "RISK_ACCEPTANCE_CONFIRMED",
  "PARTIAL",
  "UNRESOLVED",
];

export default function ContinuationOutcomeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelContinuationOutcomeCaseDetail | null>(
      null,
    );

  const [candidateId, setCandidateId] =
    useState("");

  const [resolutionType, setResolutionType] =
    useState<FlywheelContinuationOutcomeResolutionType>(
      "UNRESOLVED",
    );

  const [reduction, setReduction] =
    useState("0.00");

  const [observedOn, setObservedOn] =
    useState("");

  const [reference, setReference] =
    useState("");

  const [evidenceNote, setEvidenceNote] =
    useState("");

  const [lifecycleNote, setLifecycleNote] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelContinuationOutcomeCase(id)
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
              : "Unable to load outcome case.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function reload() {
    setDetail(
      await getFlywheelContinuationOutcomeCase(
        id,
      ),
    );
  }

  async function addItem(
    event: FormEvent,
  ) {
    event.preventDefault();

    const numericReduction =
      Number(reduction);

    if (
      !candidateId ||
      !observedOn ||
      !reference.trim() ||
      !evidenceNote.trim() ||
      Number.isNaN(numericReduction)
    ) {
      setError(
        "Complete all evidence fields.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      setDetail(
        await addFlywheelContinuationOutcomeItem(
          id,
          {
            sourceContinuationItemId:
              candidateId,

            resolutionType,

            observedReductionAmount:
              numericReduction,

            observedOn,

            evidenceReference:
              reference.trim(),

            evidenceNote:
              evidenceNote.trim(),
          },
        ),
      );

      setCandidateId("");
      setResolutionType("UNRESOLVED");
      setReduction("0.00");
      setObservedOn("");
      setReference("");
      setEvidenceNote("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to record outcome evidence.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function perform(
    operation:
      () => Promise<FlywheelContinuationOutcomeCaseDetail>,
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
        <h1>Continuation outcome</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  const outcome =
    detail.outcomeCase;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {outcome.outcomeNumber}
          </p>

          <h1>{outcome.title}</h1>

          <p>
            Independent evidence of what actually happened after
            continuation governance closed.
          </p>
        </div>

        <Link href="/flywheel-continuation-outcomes">
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
          <strong>{outcome.status}</strong>
        </article>

        <article className="metric-card">
          <span>Source residual</span>
          <strong>
            {money(
              outcome.sourceResidualAmount,
              outcome.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Observed remaining</span>
          <strong>
            {money(
              outcome.currentRemainingResidualAmount,
              outcome.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Disposition</span>
          <strong>
            {outcome.residualDisposition || "PENDING"}
          </strong>
        </article>
      </section>

      {outcome.residualDisposition ===
      "FURTHER_GOVERNANCE_REQUIRED" ? (
        <section className="panel">
          <h2>Further governance required</h2>

          <p>
            This VERIFIED outcome still has positive residual
            exposure. It cannot be closed as financially resolved.
            The next governed continuation cycle will consume this
            explicit state.
          </p>
        </section>
      ) : null}

      {outcome.status === "DRAFT" &&
      detail.candidates.length > 0 ? (
        <section className="panel">
          <h2>Record observed evidence</h2>

          <form
            className="form-grid"
            onSubmit={addItem}
          >
            <label>
              Continuation item

              <select
                value={candidateId}
                onChange={(event) =>
                  setCandidateId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select source item
                </option>

                {detail.candidates.map(
                  (candidate) => (
                    <option
                      key={candidate.continuationItemId}
                      value={candidate.continuationItemId}
                    >
                      {candidate.continuationAction} —{" "}
                      {money(
                        candidate.sourceResidualAmount,
                        outcome.currency,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Outcome type

              <select
                value={resolutionType}
                onChange={(event) =>
                  setResolutionType(
                    event.target
                      .value as FlywheelContinuationOutcomeResolutionType,
                  )
                }
              >
                {resolutionTypes.map(
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
              Observed reduction

              <input
                type="number"
                min="0"
                step="0.01"
                value={reduction}
                onChange={(event) =>
                  setReduction(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Observed on

              <input
                type="date"
                value={observedOn}
                onChange={(event) =>
                  setObservedOn(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Evidence reference

              <input
                value={reference}
                maxLength={500}
                onChange={(event) =>
                  setReference(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="full-width">
              Evidence note

              <textarea
                value={evidenceNote}
                maxLength={2500}
                onChange={(event) =>
                  setEvidenceNote(
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
                Add immutable outcome evidence
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <h2>Observed outcome items</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Continuation</th>
                <th>Outcome</th>
                <th>Source</th>
                <th>Reduction</th>
                <th>Remaining</th>
                <th>Evidence</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      {item.sourceContinuationAction}
                    </td>

                    <td>
                      {item.resolutionType}
                    </td>

                    <td>
                      {money(
                        item.sourceResidualAmount,
                        outcome.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.observedReductionAmount,
                        outcome.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.remainingResidualAmount,
                        outcome.currency,
                      )}
                    </td>

                    <td>
                      {item.evidenceReference}
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
          {outcome.status === "DRAFT" ? (
            <button
              disabled={busy}
              onClick={() =>
                void perform(
                  () =>
                    submitFlywheelContinuationOutcomeCase(
                      id,
                    ),
                )
              }
            >
              Submit
            </button>
          ) : null}

          {outcome.status === "IN_REVIEW" ? (
            <>
              <input
                value={lifecycleNote}
                placeholder="Verification note"
                onChange={(event) =>
                  setLifecycleNote(
                    event.target.value,
                  )
                }
              />

              <button
                disabled={
                  busy ||
                  !lifecycleNote.trim()
                }
                onClick={() =>
                  void perform(
                    () =>
                      verifyFlywheelContinuationOutcomeCase(
                        id,
                        {
                          note:
                            lifecycleNote.trim(),
                        },
                      ),
                  )
                }
              >
                Verify outcomes
              </button>
            </>
          ) : null}

          {outcome.status === "VERIFIED" &&
          outcome.residualDisposition ===
            "FULLY_RESOLVED" ? (
            <>
              <input
                value={lifecycleNote}
                placeholder="Closure note"
                onChange={(event) =>
                  setLifecycleNote(
                    event.target.value,
                  )
                }
              />

              <button
                disabled={
                  busy ||
                  !lifecycleNote.trim()
                }
                onClick={() =>
                  void perform(
                    () =>
                      closeFlywheelContinuationOutcomeCase(
                        id,
                        {
                          note:
                            lifecycleNote.trim(),
                        },
                      ),
                  )
                }
              >
                Close resolved outcome
              </button>
            </>
          ) : null}

          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                try {
                  await captureFlywheelContinuationOutcomeSnapshot(
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
                    `/flywheel-continuation-outcomes/snapshots/${snapshot.id}`
                  }
                >
                  {snapshot.snapshotNumber}
                </Link>{" "}
                — {snapshot.outcomeStatus} —{" "}
                {snapshot.residualDisposition || "PENDING"}
              </li>
            ),
          )}
        </ul>
      </section>
    </main>
  );
}
