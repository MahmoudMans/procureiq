"use client";

import Link from "next/link";
import {
  use,
  useEffect,
  useState,
} from "react";

import {
  getFlywheelContinuationRolloverSnapshot,
} from "@/lib/api";

import type {
  FlywheelContinuationRolloverSnapshotDetail,
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

export default function ContinuationRolloverSnapshot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelContinuationRolloverSnapshotDetail | null>(
      null,
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelContinuationRolloverSnapshot(
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
              : "Unable to load rollover snapshot.",
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
        <h1>Rollover snapshot</h1>
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
            Sealed residual-cycle governance evidence.
          </p>
        </div>

        <Link
          href={
            `/flywheel-continuation-rollovers/${snapshot.rolloverCaseId}`
          }
        >
          Back
        </Link>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Status</span>

          <strong>
            {snapshot.rolloverStatus}
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
          <span>Parent</span>

          <strong>
            {snapshot.parentContinuationNumber}
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
                <th>Prior action</th>
                <th>Outcome</th>
                <th>Next action</th>
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
                        snapshot.currency,
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
    </main>
  );
}
