"use client";

import Link from "next/link";
import {
  use,
  useEffect,
  useState,
} from "react";

import {
  getFlywheelRemediationOutcomeSnapshot,
} from "@/lib/api";

import type {
  FlywheelRemediationOutcomeSnapshotDetail,
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

export default function FlywheelRemediationOutcomeSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelRemediationOutcomeSnapshotDetail | null>(
      null,
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    getFlywheelRemediationOutcomeSnapshot(
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
        <h1>
          Remediation outcome snapshot
        </h1>

        <p>
          {error || "Loading…"}
        </p>
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

          <h1>
            {snapshot.title}
          </h1>

          <p>
            Sealed remediation-outcome evidence.
          </p>
        </div>

        <Link
          href={
            `/flywheel-remediation-outcomes/${snapshot.outcomeCaseId}`
          }
        >
          Back to outcome case
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
          <span>Resolved</span>
          <strong>
            {money(
              snapshot.resolvedAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Remaining</span>
          <strong>
            {money(
              snapshot.remainingResidualAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article className="metric-card">
          <span>Unresolved items</span>
          <strong>
            {snapshot.unresolvedItemCount}
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
        <h2>
          Captured outcome evidence
        </h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Action</th>
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
                      {item.resolutionType}
                    </td>

                    <td>
                      {money(
                        item.resolvedAmount,
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
      </section>
    </main>
  );
}
