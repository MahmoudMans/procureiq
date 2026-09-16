"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import {
  getFlywheelResidualRemediationSnapshot,
} from "@/lib/api";

import type {
  FlywheelResidualRemediationSnapshotDetail,
} from "@/types/flywheel-remediation";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export default function FlywheelRemediationSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] =
    useState<FlywheelResidualRemediationSnapshotDetail | null>(
      null,
    );

  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setDetail(
          await getFlywheelResidualRemediationSnapshot(
            id,
          ),
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load remediation snapshot.",
        );
      }
    })();
  }, [id]);

  if (!detail) {
    return (
      <main className="page-shell">
        <h1>Residual remediation snapshot</h1>
        <p>{error || "Loading…"}</p>
      </main>
    );
  }

  const snapshot = detail.snapshot;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {snapshot.snapshotNumber}
          </p>

          <h1>{snapshot.title}</h1>

          <p>
            Sealed residual-remediation governance evidence.
          </p>
        </div>

        <Link
          href={
            `/flywheel-remediation/${snapshot.remediationPlanId}`
          }
        >
          Back to plan
        </Link>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Plan status</span>
          <strong>{snapshot.planStatus}</strong>
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
          <span>Items</span>
          <strong>{snapshot.itemCount}</strong>
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
        <h2>Governance allocation</h2>

        <div className="metric-grid">
          <article className="metric-card">
            <span>Recovery follow-up</span>
            <strong>
              {money(
                snapshot.recoveryFollowUpAmount,
                snapshot.currency,
              )}
            </strong>
          </article>

          <article className="metric-card">
            <span>Write-off review</span>
            <strong>
              {money(
                snapshot.writeOffReviewAmount,
                snapshot.currency,
              )}
            </strong>
          </article>

          <article className="metric-card">
            <span>Investigation escalation</span>
            <strong>
              {money(
                snapshot.investigationEscalationAmount,
                snapshot.currency,
              )}
            </strong>
          </article>

          <article className="metric-card">
            <span>Residual acceptance review</span>
            <strong>
              {money(
                snapshot.residualAcceptanceReviewAmount,
                snapshot.currency,
              )}
            </strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>Captured decisions</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source decision</th>
                <th>Residual</th>
                <th>Action</th>
                <th>Target date</th>
                <th>Rationale</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.sourceDecision}</td>

                  <td>
                    {money(
                      item.residualAmount,
                      snapshot.currency,
                    )}
                  </td>

                  <td>{item.action}</td>
                  <td>{item.targetDate}</td>
                  <td>{item.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
