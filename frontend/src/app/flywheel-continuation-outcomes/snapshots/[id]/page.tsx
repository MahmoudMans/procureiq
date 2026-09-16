"use client";

import Link from "next/link";
import {
  use,
  useEffect,
  useState,
} from "react";

import {
  getFlywheelContinuationOutcomeSnapshot,
} from "@/lib/api";

import type {
  FlywheelContinuationOutcomeSnapshotDetail,
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

export default function ContinuationOutcomeSnapshot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelContinuationOutcomeSnapshotDetail | null>(
      null,
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelContinuationOutcomeSnapshot(
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
              : "Unable to load outcome snapshot.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!detail) {
    return (
      <main className="page-shell">
        <h1>Continuation outcome snapshot</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  const snapshot =
    detail.snapshot;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {snapshot.snapshotNumber}
          </p>

          <h1>{snapshot.title}</h1>

          <p>
            Sealed observed residual evidence.
          </p>
        </div>

        <Link
          href={
            `/flywheel-continuation-outcomes/${snapshot.outcomeCaseId}`
          }
        >
          Back
        </Link>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Status</span>
          <strong>
            {snapshot.outcomeStatus}
          </strong>
        </article>

        <article className="metric-card">
          <span>Source residual</span>
          <strong>
            {money(
              snapshot.sourceResidualAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Remaining residual</span>
          <strong>
            {money(
              snapshot.remainingResidualAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Disposition</span>
          <strong>
            {snapshot.residualDisposition || "PENDING"}
          </strong>
        </article>

        <article className="metric-card">
          <span>Sealed</span>
          <strong>
            {snapshot.sealed
              ? "YES"
              : "NO"}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Outcome</th>
                <th>Reduction</th>
                <th>Remaining</th>
                <th>Observed</th>
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
                        item.observedReductionAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.remainingResidualAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {item.observedOn}
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
    </main>
  );
}
