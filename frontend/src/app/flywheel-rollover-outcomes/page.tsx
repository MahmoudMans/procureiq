"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { rolloverEvidenceApi } from "@/lib/api";
import { evidenceMoney } from "@/components/rollover-evidence-view";
import type { EvidenceDashboard } from "@/types/rollover-evidence";

export default function RolloverOutcomesDashboard() {
  const router = useRouter();

  const [data, setData] = useState<EvidenceDashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    let alive = true;

    rolloverEvidenceApi.dashboard()
      .then(value => {
        if (alive) setData(value);
      })
      .catch((cause: unknown) => {
        if (alive) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load outcome evidence.",
          );
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending.current) return;

    const root = String(
      new FormData(event.currentTarget).get("root") ?? "",
    );

    if (!root) {
      setError("Choose a CLOSED rollover.");
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");

    try {
      const result = await rolloverEvidenceApi.open({
        rolloverCaseId: root,
      });

      router.push(
        `/flywheel-rollover-outcomes/${result.cycle.id}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to open evidence.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <main className="page-shell">
        <h1>Rollover outcomes</h1>
        <p role="status">{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Observed results and repeatable follow-up
          </p>
          <h1>Rollover outcomes</h1>
          <p>
            Record evidence, measure effectiveness, and govern the
            exposure that remains.
          </p>
        </div>
      </div>

      {error ? (
        <p className="alert error" role="alert">{error}</p>
      ) : null}

      <section className="panel">
        <h2>Current chain exposure</h2>

        <p>
          Latest generation only. Earlier cycle amounts are not
          added again. Provisional observations remain subject to
          verification.
        </p>

        <div className="metric-grid">
          {data.exposure.map(total => (
            <article className="metric-card" key={total.currency}>
              <span>Remaining · {total.currency}</span>
              <strong>
                {evidenceMoney(total.remaining,total.currency)}
              </strong>
              <p>
                Original:{" "}
                {evidenceMoney(total.original,total.currency)}
              </p>
              <p>
                Cumulative observed reduction:{" "}
                {evidenceMoney(
                  total.cumulativeReduction,
                  total.currency,
                )}
              </p>
            </article>
          ))}
        </div>

        {data.exposure.length === 0 ? (
          <p>No evidence chains yet.</p>
        ) : null}
      </section>

      {data.permissions.write ? (
        <section className="panel">
          <h2>Open evidence from a closed rollover</h2>

          {data.sources.length === 0 ? (
            <p>No unimported CLOSED rollovers are available.</p>
          ) : (
            <form className="form-grid" onSubmit={open}>
              <label>
                Source rollover

                <select name="root" required disabled={busy}>
                  <option value="">Select source</option>

                  {data.sources.map(source => (
                    <option key={source.id} value={source.id}>
                      {source.number}
                      {" · "}
                      {evidenceMoney(source.amount,source.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" disabled={busy}>
                Open outcome evidence
              </button>
            </form>
          )}
        </section>
      ) : null}

      <section className="panel">
        <h2>Evidence generations</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Chain</th>
                <th>Generation</th>
                <th>Status</th>
                <th>Remaining</th>
                <th>Effectiveness</th>
                <th>Coverage</th>
              </tr>
            </thead>

            <tbody>
              {data.cycles.map(({ cycle, metrics, isLatest }) => (
                <tr key={cycle.id}>
                  <td>
                    <Link
                      href={`/flywheel-rollover-outcomes/${cycle.id}`}
                    >
                      {cycle.rootRolloverNumber}
                    </Link>
                    <p>{cycle.title}</p>
                  </td>
                  <td>
                    {cycle.cycleNumber}
                    {" "}
                    {isLatest ? "· Current" : "· Historical"}
                  </td>
                  <td>{cycle.status.replaceAll("_", " ")}</td>
                  <td>
                    {evidenceMoney(metrics.remaining,cycle.currency)}
                  </td>
                  <td>{metrics.reductionPercent}%</td>
                  <td>
                    {metrics.observedCount}/{metrics.itemCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
