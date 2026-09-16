"use client";

import Link from "next/link";
import {
  use,
  useEffect,
  useState,
} from "react";

import {
  getFlywheelResidualContinuationSnapshot,
} from "@/lib/api";

import type {
  FlywheelResidualContinuationSnapshotDetail,
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

export default function ResidualContinuationSnapshot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelResidualContinuationSnapshotDetail | null>(
      null,
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelResidualContinuationSnapshot(
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
              : "Unable to load continuation snapshot.",
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
        <h1>Continuation snapshot</h1>
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
            Sealed residual-continuation governance evidence.
          </p>
        </div>

        <Link
          href={
            `/flywheel-remediation-continuations/${snapshot.continuationCaseId}`
          }
        >
          Back
        </Link>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Status</span>
          <strong>
            {snapshot.continuationStatus}
          </strong>
        </article>

        <article className="metric-card">
          <span>Residual</span>
          <strong>
            {money(
              snapshot.sourceRemainingResidualAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Items</span>
          <strong>
            {snapshot.itemCount}
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
                    </td>

                    <td>
                      {money(
                        item.sourceRemainingResidualAmount,
                        snapshot.currency,
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
    </main>
  );
}
