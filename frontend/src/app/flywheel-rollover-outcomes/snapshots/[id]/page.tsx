"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { rolloverEvidenceApi } from "@/lib/api";
import RolloverEvidenceView from "@/components/rollover-evidence-view";
import type { EvidenceSnapshot } from "@/types/rollover-evidence";

export default function RolloverEvidenceSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data, setData] = useState<EvidenceSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    rolloverEvidenceApi.snapshot(id)
      .then(value => {
        if (alive) setData(value);
      })
      .catch((cause: unknown) => {
        if (alive) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load snapshot.",
          );
        }
      });

    return () => {
      alive = false;
    };
  }, [id]);

  if (!data || data.id !== id) {
    return (
      <main className="page-shell">
        <h1>Sealed evidence</h1>
        <p role="status">{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Link
        href={`/flywheel-rollover-outcomes/${data.document.cycle.id}`}
      >
        Back to evidence cycle
      </Link>

      <section className="panel">
        <h2>Immutable evidence snapshot</h2>
        <p>
          Captured {data.capturedAt}. Amounts and events below
          are frozen at capture, not recalculated from later
          generations.
        </p>
      </section>

      <RolloverEvidenceView document={data.document} />
    </main>
  );
}
