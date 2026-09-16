import Link from "next/link";
import type { EvidenceDocument } from "@/types/rollover-evidence";

export function evidenceMoney(value: string, currency: string) {
  const [whole, cents = ""] = value.split(".");

  return (
    `${currency} ` +
    `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.` +
    cents.padEnd(2, "0")
  );
}

export default function RolloverEvidenceView({
  document,
}: {
  document: EvidenceDocument;
}) {
  const { cycle, metrics, items, events } = document;

  return <>
    <div className="page-header">
      <div>
        <p className="eyebrow">
          {cycle.rootRolloverNumber}
          {" · "}
          Evidence generation {cycle.cycleNumber}
        </p>
        <h1>{cycle.title}</h1>
        <p>
          {cycle.status.replaceAll("_", " ")}
          {" · "}
          Version {cycle.version}
        </p>
      </div>
    </div>

    <section className="panel">
      <h2>Source and lineage</h2>

      <p>
        Original rollover:{" "}
        <Link
          href={`/flywheel-continuation-rollovers/${cycle.rootRolloverId}`}
        >
          {cycle.rootRolloverNumber}
        </Link>
      </p>

      {cycle.parentCycleId ? (
        <p>
          Parent evidence:{" "}
          <Link
            href={`/flywheel-rollover-outcomes/${cycle.parentCycleId}`}
          >
            Previous generation
          </Link>
        </p>
      ) : (
        <p>Governance was completed in the original rollover.</p>
      )}

      {cycle.sourceSnapshotId ? (
        <p>
          Source snapshot:{" "}
          <Link
            href={`/flywheel-rollover-outcomes/snapshots/${cycle.sourceSnapshotId}`}
          >
            Verified parent evidence
          </Link>
        </p>
      ) : null}

      <p>
        Closing governance does not recover money. These amounts
        describe observed evidence, not executed payments or
        accounting postings.
      </p>
    </section>

    <section className="metric-grid">
      {([
        ["Opening residual", metrics.opening],
        ["Observed recovery", metrics.recovered],
        ["Observed write-off", metrics.writeOff],
        ["Other evidenced reduction", metrics.otherReduction],
        ["Remaining exposure", metrics.remaining],
      ] as const).map(([label, amount]) => (
        <article className="metric-card" key={label}>
          <span>{label}</span>
          <strong>{evidenceMoney(amount,cycle.currency)}</strong>
        </article>
      ))}

      <article className="metric-card">
        <span>Reduction effectiveness</span>
        <strong>{metrics.reductionPercent}%</strong>
      </article>
    </section>

    <section className="panel">
      <h2>Evidence coverage</h2>

      <p>
        {metrics.observedCount}/{metrics.itemCount} items observed
        {" · "}
        {metrics.disposition.replaceAll("_", " ")}
      </p>

      <p>
        {metrics.disposition === "PENDING_VERIFICATION"
          ? "Provisional amounts. Unobserved items remain fully outstanding."
          : "Manager-verified evidence. Historical amounts are not overwritten by later generations."}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Opening</th>
              <th>Plan</th>
              <th>Observation</th>
              <th>Remaining</th>
              <th>Evidence</th>
            </tr>
          </thead>

          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.action.replaceAll("_", " ")}</td>
                <td>
                  {evidenceMoney(item.openingAmount,cycle.currency)}
                </td>
                <td>
                  {item.plan ? (
                    <>
                      {item.plan.targetDate}
                      <p>{item.plan.rationale}</p>
                    </>
                  ) : "—"}
                </td>
                <td>
                  {item.observation?.resolutionType.replaceAll("_", " ")
                    ?? "Not observed"}
                </td>
                <td>
                  {evidenceMoney(
                    item.observation?.remainingAmount
                      ?? item.openingAmount,
                    cycle.currency,
                  )}
                </td>
                <td>
                  {item.observation ? (
                    <>
                      {item.observation.evidenceReference}
                      <p>{item.observation.observedOn}</p>
                      <p>{item.observation.evidenceNote}</p>
                    </>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className="panel">
      <h2>Audit history</h2>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Event</th>
              <th>Actor</th>
              <th>Note</th>
            </tr>
          </thead>

          <tbody>
            {events.map(event => (
              <tr key={event.version}>
                <td>{event.version}</td>
                <td>
                  {event.type.replaceAll("_", " ")}
                  <p>{event.at}</p>
                </td>
                <td>
                  {event.actorName}
                  <p>{event.actorRole}</p>
                </td>
                <td>{event.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
