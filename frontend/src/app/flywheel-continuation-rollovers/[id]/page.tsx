"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useEffect,
  useState,
} from "react";

import {
  addFlywheelContinuationRolloverItem,
  approveFlywheelContinuationRolloverCase,
  captureFlywheelContinuationRolloverSnapshot,
  closeFlywheelContinuationRolloverCase,
  getFlywheelContinuationRolloverCase,
  submitFlywheelContinuationRolloverCase,
} from "@/lib/api";

import type {
  FlywheelContinuationRolloverCaseDetail,
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

export default function ContinuationRolloverDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelContinuationRolloverCaseDetail | null>(
      null,
    );

  const [candidateId, setCandidateId] =
    useState("");

  const [targetDate, setTargetDate] =
    useState("");

  const [rationale, setRationale] =
    useState("");

  const [lifecycleNote, setLifecycleNote] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelContinuationRolloverCase(
      id,
    )
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
              : "Unable to load rollover cycle.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function reload() {
    setDetail(
      await getFlywheelContinuationRolloverCase(
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
        "Source item, target date and rationale are required.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      setDetail(
        await addFlywheelContinuationRolloverItem(
          id,
          {
            sourceContinuationOutcomeItemId:
              candidateId,

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
          : "Unable to add rollover governance.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function perform(
    operation:
      () => Promise<FlywheelContinuationRolloverCaseDetail>,
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
        <h1>Residual rollover cycle</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  const rollover =
    detail.rolloverCase;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {rollover.rolloverNumber}
          </p>

          <h1>{rollover.title}</h1>

          <p>
            New governance cycle created from independently
            verified positive residual exposure.
          </p>
        </div>

        <Link href="/flywheel-continuation-rollovers">
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

          <strong>
            {rollover.status}
          </strong>
        </article>

        <article className="metric-card">
          <span>Residual</span>

          <strong>
            {money(
              rollover.sourceRemainingResidualAmount,
              rollover.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Parent cycle</span>

          <strong>
            {rollover.parentContinuationNumber}
          </strong>
        </article>

        <article className="metric-card">
          <span>Source evidence</span>

          <strong>
            {rollover.sourceContinuationOutcomeNumber}
          </strong>
        </article>
      </section>

      <section className="panel">
        <h2>Immutable lineage</h2>

        <p>
          Parent continuation:{" "}
          <strong>
            {rollover.parentContinuationNumber}
          </strong>
        </p>

        <p>
          Verified outcome:{" "}
          <strong>
            {rollover.sourceContinuationOutcomeNumber}
          </strong>
        </p>

        <p>
          This rollover does not alter either source artifact.
        </p>
      </section>

      {rollover.status === "DRAFT" &&
      detail.candidates.length > 0 ? (
        <section className="panel">
          <h2>Govern positive residual</h2>

          <form
            className="form-grid"
            onSubmit={addItem}
          >
            <label>
              Positive residual item

              <select
                value={candidateId}
                onChange={(event) =>
                  setCandidateId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select residual
                </option>

                {detail.candidates.map(
                  (candidate) => (
                    <option
                      key={candidate.continuationOutcomeItemId}
                      value={candidate.continuationOutcomeItemId}
                    >
                      {candidate.sourceContinuationAction}
                      {" — "}
                      {candidate.sourceResolutionType}
                      {" — "}
                      {money(
                        candidate.remainingResidualAmount,
                        rollover.currency,
                      )}
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
                maxLength={2500}
                value={rationale}
                onChange={(event) =>
                  setRationale(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="full-width">
              <button
                disabled={busy}
                type="submit"
              >
                Add rollover governance
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <h2>Rollover items</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source action</th>
                <th>Observed outcome</th>
                <th>Next-cycle action</th>
                <th>Residual</th>
                <th>Target</th>
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
                      {item.sourceResolutionType}
                    </td>

                    <td>
                      {item.continuationAction}
                    </td>

                    <td>
                      {money(
                        item.sourceRemainingResidualAmount,
                        rollover.currency,
                      )}
                    </td>

                    <td>
                      {item.targetDate}
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
          {rollover.status === "DRAFT" ? (
            <button
              disabled={busy}
              onClick={() =>
                void perform(
                  () =>
                    submitFlywheelContinuationRolloverCase(
                      id,
                    ),
                )
              }
            >
              Submit
            </button>
          ) : null}

          {rollover.status === "IN_REVIEW" ? (
            <>
              <input
                value={lifecycleNote}
                placeholder="Manager approval note"
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
                      approveFlywheelContinuationRolloverCase(
                        id,
                        {
                          note:
                            lifecycleNote.trim(),
                        },
                      ),
                  )
                }
              >
                Approve rollover
              </button>
            </>
          ) : null}

          {rollover.status === "APPROVED" ? (
            <>
              <input
                value={lifecycleNote}
                placeholder="Governance closure note"
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
                      closeFlywheelContinuationRolloverCase(
                        id,
                        {
                          note:
                            lifecycleNote.trim(),
                        },
                      ),
                  )
                }
              >
                Close governance cycle
              </button>
            </>
          ) : null}

          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                try {
                  await captureFlywheelContinuationRolloverSnapshot(
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
                    `/flywheel-continuation-rollovers/snapshots/${snapshot.id}`
                  }
                >
                  {snapshot.snapshotNumber}
                </Link>
                {" — "}
                {snapshot.rolloverStatus}
                {" — "}
                {snapshot.sealed
                  ? "SEALED"
                  : "OPEN"}
              </li>
            ),
          )}
        </ul>
      </section>
    </main>
  );
}
