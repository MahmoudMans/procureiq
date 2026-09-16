"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  use,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { rolloverEvidenceApi } from "@/lib/api";
import RolloverEvidenceView from "@/components/rollover-evidence-view";

import type {
  EvidenceAction,
  EvidenceDetail,
  EvidenceResolution,
} from "@/types/rollover-evidence";

const resolutions: Record<EvidenceAction, EvidenceResolution[]> = {
  RECOVERY_RETRY: [
    "RECOVERY_CONFIRMED",
    "PARTIAL",
    "UNRESOLVED",
  ],
  WRITE_OFF_ESCALATION: [
    "WRITE_OFF_CONFIRMED",
    "PARTIAL",
    "UNRESOLVED",
  ],
  INVESTIGATION_ESCALATION: [
    "INVESTIGATION_CONCLUDED",
    "PARTIAL",
    "UNRESOLVED",
  ],
  RISK_ACCEPTANCE_ESCALATION: [
    "RISK_ACCEPTANCE_CONFIRMED",
    "UNRESOLVED",
  ],
};

export default function RolloverOutcomeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<EvidenceDetail | null>(null);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = useRef(false);
  const liveId = useRef(id);

  useEffect(() => {
    let alive = true;
    liveId.current = id;

    rolloverEvidenceApi.detail(id)
      .then(value => {
        if (alive) setData(value);
      })
      .catch((cause: unknown) => {
        if (alive) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load evidence.",
          );
        }
      });

    return () => {
      alive = false;
    };
  }, [id]);

  function applyDetail(value: EvidenceDetail) {
    if (liveId.current === value.cycle.id) {
      setData(value);
    }
  }

  async function run(operation: () => Promise<void>) {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError("");

    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Operation failed.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!data) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const item = data.items.find(value => value.id === selected);

    if (!item) {
      setError("Choose a source item.");
      return;
    }

    await run(async () => {
      if (data.cycle.status === "PLAN_DRAFT") {
        applyDetail(
          await rolloverEvidenceApi.plan(id, {
            itemId: selected,
            version: data.cycle.version,
            targetDate: String(values.get("date") ?? ""),
            rationale: String(
              values.get("rationale") ?? "",
            ).trim(),
          }),
        );
      } else {
        const type = String(
          values.get("resolution") ?? "",
        ) as EvidenceResolution;

        const amount = String(
          values.get("amount") ?? "",
        ).trim();

        if (
          !resolutions[item.action].includes(type) ||
          !/^\d+(?:\.\d{1,2})?$/.test(amount)
        ) {
          throw new Error(
            "Choose a compatible resolution and an exact amount with at most two decimal places.",
          );
        }

        applyDetail(
          await rolloverEvidenceApi.observe(id, {
            itemId: selected,
            version: data.cycle.version,
            resolutionType: type,
            reductionAmount: amount,
            observedOn: String(values.get("date") ?? ""),
            evidenceReference: String(
              values.get("reference") ?? "",
            ).trim(),
            evidenceNote: String(
              values.get("rationale") ?? "",
            ).trim(),
          }),
        );
      }

      setSelected("");
      form.reset();
    });
  }

  if (!data || data.cycle.id !== id) {
    return (
      <main className="page-shell">
        <h1>Rollover evidence</h1>
        <p role="status">{error || "Loading…"}</p>
      </main>
    );
  }

  const { cycle, permissions, metrics } = data;
  const planning = cycle.status === "PLAN_DRAFT";
  const recording = planning || cycle.status === "OBSERVING";

  const candidates = data.items.filter(
    item => planning
      ? item.plan === null
      : item.observation === null,
  );

  const chosen = candidates.find(item => item.id === selected);

  const operations: {
    name: string;
    label: string;
    enabled: boolean;
  }[] = [];

  if (planning) {
    operations.push({
      name: "submit-plan",
      label: "Submit governance plan",
      enabled: permissions.write && candidates.length === 0,
    });
  }

  if (cycle.status === "PLAN_REVIEW") {
    operations.push({
      name: "approve-plan",
      label: "Approve governance plan",
      enabled: permissions.manage,
    });
  }

  if (cycle.status === "PLAN_APPROVED") {
    operations.push({
      name: "close-governance",
      label: "Close governance and start observations",
      enabled: permissions.manage,
    });
  }

  if (cycle.status === "OBSERVING") {
    operations.push({
      name: "submit-evidence",
      label: "Submit observed evidence",
      enabled: permissions.write && metrics.complete,
    });
  }

  if (cycle.status === "EVIDENCE_REVIEW") {
    operations.push({
      name: "verify-evidence",
      label: "Verify outcome evidence",
      enabled: permissions.manage,
    });
  }

  if (
    cycle.status === "VERIFIED" &&
    metrics.disposition === "FULLY_RESOLVED"
  ) {
    operations.push({
      name: "close-evidence",
      label: "Close fully resolved evidence",
      enabled: permissions.manage,
    });
  }

  return (
    <main className="page-shell">
      <Link href="/flywheel-rollover-outcomes">
        All rollover outcomes
      </Link>

      {error ? (
        <p className="alert error" role="alert">{error}</p>
      ) : null}

      <div className="button-row">
        <button
          disabled={busy}
          onClick={() => void run(async () => {
            applyDetail(await rolloverEvidenceApi.detail(id));
          })}
        >
          Reload
        </button>
      </div>

      <RolloverEvidenceView document={data} />

      {recording && permissions.write && candidates.length > 0 ? (
        <section className="panel">
          <h2>
            {planning
              ? "Govern the next cycle"
              : "Record immutable observed evidence"}
          </h2>

          <p>
            {planning
              ? "The prior action is preserved. Supply a target and rationale for every positive residual item."
              : "Check the evidence carefully: recorded observations cannot be edited or deleted."}
          </p>

          <form className="form-grid" onSubmit={record}>
            <label>
              Source item

              <select
                value={selected}
                onChange={event => setSelected(event.target.value)}
                required
                disabled={busy}
              >
                <option value="">Select item</option>

                {candidates.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.action}
                    {" · "}
                    {cycle.currency} {item.openingAmount}
                    {" · "}
                    {item.id.slice(0,8)}
                  </option>
                ))}
              </select>
            </label>

            {!planning && chosen ? (
              <>
                <label>
                  Resolution

                  <select
                    name="resolution"
                    key={chosen.id}
                    required
                    disabled={busy}
                    defaultValue="UNRESOLVED"
                  >
                    {resolutions[chosen.action].map(value => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Observed reduction

                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    pattern="[0-9]+([.][0-9]{1,2})?"
                    required
                    disabled={busy}
                  />
                </label>

                <label>
                  Evidence reference

                  <input
                    name="reference"
                    maxLength={500}
                    required
                    disabled={busy}
                  />
                </label>
              </>
            ) : null}

            <label>
              {planning ? "Target date" : "Observed on"}

              <input
                name="date"
                type="date"
                required
                disabled={busy}
              />
            </label>

            <label className="full-width">
              {planning ? "Governance rationale" : "Evidence note"}

              <textarea
                name="rationale"
                maxLength={2500}
                required
                disabled={busy}
              />
            </label>

            <button
              type="submit"
              disabled={busy || !chosen}
            >
              {planning ? "Record plan" : "Record observation"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <h2>Lifecycle</h2>

        {operations.length > 0 ? (
          <label>
            Decision note

            <textarea
              maxLength={2500}
              value={note}
              onChange={event => setNote(event.target.value)}
              disabled={busy}
            />
          </label>
        ) : null}

        <div className="button-row">
          {operations.map(operation => (
            <button
              key={operation.name}
              disabled={
                busy ||
                !operation.enabled ||
                !note.trim()
              }
              onClick={() => void run(async () => {
                applyDetail(
                  await rolloverEvidenceApi.transition(id, {
                    version: cycle.version,
                    operation: operation.name,
                    note: note.trim(),
                  }),
                );

                setNote("");
              })}
            >
              {operation.label}
            </button>
          ))}

          {permissions.write ? (
            <button
              disabled={busy}
              onClick={() => void run(async () => {
                const snapshot = await rolloverEvidenceApi.capture(id);

                router.push(
                  `/flywheel-rollover-outcomes/snapshots/${snapshot.id}`,
                );
              })}
            >
              Capture sealed snapshot
            </button>
          ) : null}
        </div>

        {data.nextCycleId ? (
          <p>
            <Link
              href={`/flywheel-rollover-outcomes/${data.nextCycleId}`}
            >
              Open the next governed generation
            </Link>
          </p>
        ) : (
          cycle.status === "VERIFIED" &&
          metrics.disposition === "FURTHER_GOVERNANCE_REQUIRED" ? (
            <>
              <p>
                Positive residual remains. This verified cycle
                cannot be closed as financially resolved.
              </p>

              {permissions.write ? (
                <button
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const next = await rolloverEvidenceApi.open({
                      parentCycleId: id,
                    });

                    router.push(
                      `/flywheel-rollover-outcomes/${next.cycle.id}`,
                    );
                  })}
                >
                  Start next governed cycle
                </button>
              ) : null}
            </>
          ) : null
        )}
      </section>

      <section className="panel">
        <h2>Sealed snapshots</h2>

        {data.snapshots.length === 0 ? (
          <p>No snapshots yet.</p>
        ) : (
          data.snapshots.map(snapshot => (
            <p key={snapshot.id}>
              <Link
                href={`/flywheel-rollover-outcomes/snapshots/${snapshot.id}`}
              >
                Version {snapshot.version}
              </Link>
              {" · "}
              {snapshot.capturedAt}
            </p>
          ))
        )}
      </section>
    </main>
  );
}
