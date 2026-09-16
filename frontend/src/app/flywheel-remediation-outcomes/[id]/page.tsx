"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useEffect,
  useState,
} from "react";

import {
  addFlywheelRemediationOutcomeItem,
  captureFlywheelRemediationOutcomeSnapshot,
  closeFlywheelRemediationOutcomeCase,
  getFlywheelRemediationOutcomeCase,
  submitFlywheelRemediationOutcomeCase,
  verifyFlywheelRemediationOutcomeCase,
} from "@/lib/api";

import type {
  FlywheelRemediationOutcomeCaseDetail,
  FlywheelRemediationResolutionType,
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

const resolutionTypes: FlywheelRemediationResolutionType[] = [
  "RECOVERY_EVIDENCED",
  "WRITE_OFF_EVIDENCED",
  "INVESTIGATION_RESOLVED",
  "RISK_ACCEPTANCE_EVIDENCED",
  "UNRESOLVED",
];

export default function FlywheelRemediationOutcomeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelRemediationOutcomeCaseDetail | null>(
      null,
    );

  const [candidateId, setCandidateId] = useState("");

  const [resolutionType, setResolutionType] =
    useState<FlywheelRemediationResolutionType>(
      "RECOVERY_EVIDENCED",
    );

  const [resolvedAmount, setResolvedAmount] =
    useState("");

  const [observedOn, setObservedOn] =
    useState("");

  const [evidenceReference, setEvidenceReference] =
    useState("");

  const [evidenceNote, setEvidenceNote] =
    useState("");

  const [note, setNote] =
    useState("");

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    getFlywheelRemediationOutcomeCase(id)
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
      await getFlywheelRemediationOutcomeCase(
        id,
      ),
    );
  }

  async function addEvidence(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !candidateId ||
      !resolvedAmount ||
      !observedOn ||
      !evidenceReference.trim() ||
      !evidenceNote.trim()
    ) {
      setError(
        "Source item, amount, observed date and evidence are required.",
      );

      return;
    }

    const amount =
      Number(
        resolvedAmount,
      );

    if (
      !Number.isFinite(
        amount,
      )
      ||
      amount < 0
    ) {
      setError(
        "Resolved amount must be a valid non-negative number.",
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      setDetail(
        await addFlywheelRemediationOutcomeItem(
          id,
          {
            sourceRemediationItemId:
              candidateId,

            resolutionType,

            resolvedAmount:
              amount,

            observedOn,

            evidenceReference:
              evidenceReference.trim(),

            evidenceNote:
              evidenceNote.trim(),
          },
        ),
      );

      setCandidateId("");
      setResolvedAmount("");
      setEvidenceReference("");
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
      () => Promise<FlywheelRemediationOutcomeCaseDetail>,
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
        <h1>Remediation outcome</h1>
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

          <h1>
            {outcome.title}
          </h1>

          <p>
            Evidence-backed assurance for remediation outcomes.
          </p>
        </div>

        <Link href="/flywheel-remediation-outcomes">
          Back to outcomes
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
            {outcome.status}
          </strong>
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
          <span>Resolved by evidence</span>
          <strong>
            {money(
              outcome.resolvedAmount,
              outcome.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Remaining residual</span>
          <strong>
            {money(
              outcome.remainingResidualAmount,
              outcome.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Evidence coverage</span>
          <strong>
            {outcome.itemCount}/
            {outcome.sourceItemCount}
          </strong>
        </article>

        <article className="metric-card">
          <span>Items with residual</span>
          <strong>
            {outcome.unresolvedItemCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <p>
          Resolved amounts are evidence classifications only.
          ProcureIQ did not itself execute the underlying recovery,
          write-off, investigation resolution, or risk acceptance.
        </p>
      </section>

      {outcome.status === "DRAFT" &&
      detail.candidates.length > 0 ? (
        <section className="panel">
          <h2>
            Record outcome evidence
          </h2>

          <form
            className="form-grid"
            onSubmit={addEvidence}
          >
            <label>
              Remediation decision

              <select
                value={candidateId}
                onChange={(event) =>
                  setCandidateId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select source decision
                </option>

                {detail.candidates.map(
                  (candidate) => (
                    <option
                      key={
                        candidate.remediationItemId
                      }
                      value={
                        candidate.remediationItemId
                      }
                    >
                      {candidate.sourceAction} —{" "}
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
              Resolution type

              <select
                value={resolutionType}
                onChange={(event) =>
                  setResolutionType(
                    event.target
                      .value as FlywheelRemediationResolutionType,
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
              Resolved amount

              <input
                type="number"
                min="0"
                step="0.01"
                value={resolvedAmount}
                onChange={(event) =>
                  setResolvedAmount(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Observed date

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
                value={evidenceReference}
                maxLength={500}
                onChange={(event) =>
                  setEvidenceReference(
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
                Record immutable evidence
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <h2>Outcome evidence</h2>

        {detail.items.length === 0 ? (
          <p>No outcome evidence recorded.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Source residual</th>
                  <th>Resolution</th>
                  <th>Resolved</th>
                  <th>Remaining</th>
                  <th>Evidence</th>
                </tr>
              </thead>

              <tbody>
                {detail.items.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        {item.sourceAction}
                      </td>

                      <td>
                        {money(
                          item.sourceResidualAmount,
                          outcome.currency,
                        )}
                      </td>

                      <td>
                        {item.resolutionType}
                      </td>

                      <td>
                        {money(
                          item.resolvedAmount,
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
                        <strong>
                          {item.evidenceReference}
                        </strong>

                        <div>
                          {item.evidenceNote}
                        </div>

                        <div>
                          {item.observedOn}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
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
                    submitFlywheelRemediationOutcomeCase(
                      id,
                    ),
                )
              }
            >
              Submit for review
            </button>
          ) : null}

          {outcome.status === "IN_REVIEW" ? (
            <>
              <input
                value={note}
                placeholder="Verification note"
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
                      verifyFlywheelRemediationOutcomeCase(
                        id,
                        {
                          note:
                            note.trim(),
                        },
                      ),
                  )
                }
              >
                Verify evidence
              </button>
            </>
          ) : null}

          {outcome.status === "VERIFIED" ? (
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
                  !note.trim() ||
                  outcome.remainingResidualAmount !== 0
                }
                onClick={() =>
                  void perform(
                    () =>
                      closeFlywheelRemediationOutcomeCase(
                        id,
                        {
                          note:
                            note.trim(),
                        },
                      ),
                  )
                }
              >
                Close outcome case
              </button>
            </>
          ) : null}

          <button
            disabled={busy}
            onClick={() =>
              void (async () => {
                try {
                  await captureFlywheelRemediationOutcomeSnapshot(
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

        {outcome.status === "VERIFIED" &&
        outcome.remainingResidualAmount !== 0 ? (
          <p>
            Closure remains blocked until remaining residual reaches zero.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2>Evidence snapshots</h2>

        {detail.snapshots.length === 0 ? (
          <p>No snapshots captured.</p>
        ) : (
          <ul>
            {detail.snapshots.map(
              (snapshot) => (
                <li key={snapshot.id}>
                  <Link
                    href={
                      `/flywheel-remediation-outcomes/snapshots/${snapshot.id}`
                    }
                  >
                    {snapshot.snapshotNumber}
                  </Link>{" "}
                  — {snapshot.outcomeStatus} —{" "}
                  {new Date(
                    snapshot.capturedAt,
                  ).toLocaleString()}
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </main>
  );
}
