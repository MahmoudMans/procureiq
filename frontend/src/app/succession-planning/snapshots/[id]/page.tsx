"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Info,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Users,
  UsersRound,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  Meter,
  type MeterTone,
  Skeleton,
  StatusBadge,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { getSuccessionSnapshot } from "@/lib/api";
import type { SuccessionSnapshotDetail } from "@/types/succession-planning";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotPolicy = SuccessionSnapshotDetail["policies"][number];
type SnapshotCandidate = SuccessionSnapshotDetail["candidates"][number];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function belowTarget(policy: SnapshotPolicy): boolean {
  return policy.readyPeopleCount < policy.targetReadyPeople;
}

/** Downloads rows as a CSV file. Text that could be read as a formula is neutralised. */
function downloadRows(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const cell = (value: string | number): string => {
    const text =
      typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : String(value);

    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  const body = [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ProgressLine({
  pct,
  tone,
  caption,
  label,
}: {
  pct: number;
  tone: MeterTone;
  caption: string;
  label: string;
}) {
  return (
    <div className="kit-meter-wrap">
      <Meter value={clampPercent(pct)} max={100} tone={tone} ariaLabel={label} />

      <span className="kit-meter-caption">{caption}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildPolicyColumns(): Column<SnapshotPolicy>[] {
  return [
    {
      id: "capability",
      header: "Capability",
      sortValue: (item) => String(item.skillName).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.skillName}</strong>

          <small>{item.skillCode}</small>
        </div>
      ),
    },
    {
      id: "criticality",
      header: "Criticality",
      sortValue: (item) => String(item.criticality),
      cell: (item) => (
        <StatusBadge
          value={String(item.criticality)}
          label={readable(String(item.criticality))}
        />
      ),
    },
    {
      id: "target",
      header: "Target",
      align: "right",
      sortValue: (item) => item.targetReadyPeople,
      cell: (item) => item.targetReadyPeople,
    },
    {
      id: "ready",
      header: "Ready",
      align: "right",
      sortValue: (item) => item.readyPeopleCount,
      cell: (item) => (
        <strong className={belowTarget(item) ? "kit-text-warning" : undefined}>
          {item.readyPeopleCount}
        </strong>
      ),
    },
    {
      id: "bench",
      header: "Bench",
      align: "right",
      sortValue: (item) => item.readyBenchCount,
      cell: (item) => (
        <span className={item.readyBenchCount === 0 ? "kit-text-warning" : undefined}>
          {item.readyBenchCount}
        </span>
      ),
    },
    {
      id: "work",
      header: "Strategic work",
      align: "right",
      sortValue: (item) => item.strategicWorkCount,
      cell: (item) => item.strategicWorkCount,
    },
    {
      id: "spof",
      header: "SPOF",
      sortValue: (item) => (item.singlePointFailure ? 1 : 0),
      cell: (item) =>
        item.singlePointFailure ? (
          <StatusBadge value="CRITICAL" label="SPOF" />
        ) : (
          <span className="kit-text-muted">No</span>
        ),
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: (item) => item.policyScore,
      cell: (item) => <strong>{item.policyScore.toFixed(1)}</strong>,
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.health),
      cell: (item) => (
        <StatusBadge value={String(item.health)} label={readable(String(item.health))} />
      ),
    },
  ];
}

function buildCandidateColumns(): Column<SnapshotCandidate>[] {
  return [
    {
      id: "candidate",
      header: "Candidate",
      sortValue: (item) => String(item.userName).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.userName}</strong>

          <small>{readable(String(item.role))}</small>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.status),
      cell: (item) => (
        <StatusBadge value={String(item.status)} label={readable(String(item.status))} />
      ),
    },
    {
      id: "readiness",
      header: "Readiness",
      sortValue: (item) => String(item.readiness),
      cell: (item) => (
        <StatusBadge value={String(item.readiness)} label={readable(String(item.readiness))} />
      ),
    },
    {
      id: "proficiency",
      header: "Proficiency",
      align: "right",
      sortValue: (item) => item.currentProficiency,
      cell: (item) => `L${item.currentProficiency}`,
    },
    {
      id: "fit",
      header: "Skill fit",
      align: "right",
      sortValue: (item) => item.proficiencyFitPct,
      cell: (item) => `${item.proficiencyFitPct.toFixed(1)}%`,
    },
    {
      id: "utilization",
      header: "Utilization",
      align: "right",
      sortValue: (item) => item.capacityUtilizationPct,
      cell: (item) => (
        <span className={item.capacityUtilizationPct > 100.005 ? "kit-text-warning" : undefined}>
          {item.capacityUtilizationPct.toFixed(1)}%
        </span>
      ),
    },
    {
      id: "evidence",
      header: "Evidence score",
      align: "right",
      sortValue: (item) => item.evidenceScore,
      cell: (item) => <strong>{item.evidenceScore.toFixed(1)}</strong>,
    },
    {
      id: "development",
      header: "Development",
      align: "right",
      sortValue: (item) => item.openDevelopmentActionCount,
      cell: (item) => item.openDevelopmentActionCount,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: SuccessionSnapshotDetail;
}

export default function SuccessionSnapshotPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const [result, setResult] = useState<SnapshotData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getSuccessionSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load succession snapshot.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, reloadKey]);

  const data = result !== null && result.id === params.id ? result : null;
  const detail = data?.detail ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  if (detail === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/succession-planning" className="request-back-link">
          <ArrowLeft size={16} />
          Succession planning
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { snapshot, summary, policies, candidates } = detail;
  const hasPolicies = policies.length > 0;
  const hasCandidates = candidates.length > 0;

  const spofCount = summary.singlePointFailureCount;
  const critical = summary.criticalExposureCount;
  const nominated = summary.nominatedCandidateCount;
  const ready = summary.readyCandidateCount;
  const readyPct = nominated > 0 ? (ready / nominated) * 100 : 0;

  const short = policies.filter(belowTarget);
  const noBench = policies.filter((item) => item.readyBenchCount === 0);
  const atTarget = policies.length - short.length;
  const overUtilized = candidates.filter((item) => item.capacityUtilizationPct > 100.005);

  const orderedPolicies = [...policies].sort(
    (a, b) => Number(b.singlePointFailure) - Number(a.singlePointFailure) || a.policyScore - b.policyScore,
  );
  const firstSpof = orderedPolicies.find((item) => item.singlePointFailure) ?? null;
  const orderedCandidates = [...candidates].sort((a, b) => b.evidenceScore - a.evidenceScore);

  function exportPolicies() {
    downloadRows(
      `${snapshot.snapshotNumber}-capabilities.csv`,
      [
        "Capability",
        "Skill code",
        "Criticality",
        "Target ready people",
        "Ready people",
        "Ready bench",
        "Strategic work items",
        "Single point of failure",
        "Policy score",
        "Health",
      ],
      orderedPolicies.map((item) => [
        String(item.skillName),
        String(item.skillCode),
        readable(String(item.criticality)),
        item.targetReadyPeople,
        item.readyPeopleCount,
        item.readyBenchCount,
        item.strategicWorkCount,
        item.singlePointFailure ? "Yes" : "No",
        item.policyScore,
        readable(String(item.health)),
      ]),
    );

    toast.success("Snapshot exported", plural(policies.length, "capability", "capabilities"));
  }

  function exportCandidates() {
    downloadRows(
      `${snapshot.snapshotNumber}-candidates.csv`,
      [
        "Candidate",
        "Role",
        "Status",
        "Readiness",
        "Current proficiency level",
        "Skill fit %",
        "Capacity utilization %",
        "Evidence score",
        "Open development actions",
      ],
      orderedCandidates.map((item) => [
        String(item.userName),
        readable(String(item.role)),
        readable(String(item.status)),
        readable(String(item.readiness)),
        item.currentProficiency,
        item.proficiencyFitPct,
        item.capacityUtilizationPct,
        item.evidenceScore,
        item.openDevelopmentActionCount,
      ]),
    );

    toast.success("Snapshot exported", plural(candidates.length, "candidate", "candidates"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Succession score",
      icon: Gauge,
      value: summary.successionScore.toFixed(1),
      note: readable(String(summary.successionHealth)),
    },
    {
      label: "Policy coverage",
      icon: ListChecks,
      value: `${summary.policyCoveragePct.toFixed(1)}%`,
      note: "Capabilities covered by a policy",
    },
    {
      label: "SPOF",
      icon: UserX,
      value: String(spofCount),
      note: "Single points of failure",
      tone: spofCount > 0 ? "warning" : "default",
    },
    {
      label: "Critical exposure",
      icon: ShieldAlert,
      value: String(critical),
      note: "Critical capabilities exposed",
      tone: critical > 0 ? "warning" : "default",
    },
    {
      label: "Candidates",
      icon: Users,
      value: String(nominated),
      note: "Nominated for succession",
    },
    {
      label: "Ready candidates",
      icon: BadgeCheck,
      value: String(ready),
      note: nominated > 0 ? `${readyPct.toFixed(0)}% of nominated` : "No candidates nominated",
    },
  ];

  const policyColumns = buildPolicyColumns();
  const candidateColumns = buildCandidateColumns();

  return (
    <div className="page-stack">
      <Link href="/succession-planning" className="request-back-link">
        <ArrowLeft size={16} />
        Succession planning
      </Link>

      <section className="succession-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(summary.successionHealth)}
              label={readable(String(summary.successionHealth))}
            />
          </div>

          <span className="eyebrow">Immutable workforce-resilience record</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            FY {snapshot.fiscalYear}
            {" · "}
            {snapshot.currency}
            {" · Captured by "}
            {snapshot.capturedByName ?? "Procurement management"}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportPolicies}
            disabled={!hasPolicies}
          >
            <Download size={15} />
            Export capabilities
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCandidates}
            disabled={!hasCandidates}
          >
            <Download size={15} />
            Export candidates
          </button>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {spofCount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(spofCount, "capability was a", "capabilities were")} single{" "}
              {spofCount === 1 ? "point" : "points"} of failure.
            </strong>
            {firstSpof !== null ? ` The lowest-scoring was ${firstSpof.skillName}.` : ""}
          </div>
        </div>
      ) : null}

      {critical > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(critical, "critical exposure was", "critical exposures were")} recorded at
              capture.
            </strong>{" "}
            Policy coverage was {summary.policyCoveragePct.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {short.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(short.length, "capability had", "capabilities had")} fewer ready people than
              the target.
            </strong>{" "}
            The Ready column shows {short.length === 1 ? "it" : "them"} in amber.
          </div>
        </div>
      ) : null}

      {noBench.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(noBench.length, "capability had", "capabilities had")} no ready bench member.
            </strong>{" "}
            If a ready person became unavailable, nobody was ready to step in.
          </div>
        </div>
      ) : null}

      {overUtilized.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(overUtilized.length, "candidate was", "candidates were")} above 100%
              capacity utilization.
            </strong>{" "}
            The Utilization column shows {overUtilized.length === 1 ? "it" : "them"} in amber.
          </div>
        </div>
      ) : null}

      {hasPolicies && !hasCandidates ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No succession candidates were captured in this snapshot.</strong> The
            capabilities below had no nominated successors when it was taken.
          </div>
        </div>
      ) : null}

      {!hasPolicies && !hasCandidates ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no capabilities or candidates.</strong> There was no
            succession evidence when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Succession snapshot summary" />

      {hasPolicies || hasCandidates ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Resilience at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={summary.successionScore}
            tone={summary.successionScore >= 100 ? meterToneFor("success") : "primary"}
            caption={`Succession score ${summary.successionScore.toFixed(1)} of 100`}
            label="Succession score"
          />

          <ProgressLine
            pct={summary.policyCoveragePct}
            tone={summary.policyCoveragePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Policy coverage ${summary.policyCoveragePct.toFixed(1)}%`}
            label="Policy coverage"
          />

          {hasPolicies ? (
            <ProgressLine
              pct={(atTarget / policies.length) * 100}
              tone={short.length === 0 ? meterToneFor("success") : "primary"}
              caption={`${atTarget} of ${plural(policies.length, "capability", "capabilities")} had the target number of ready people`}
              label="Capabilities at their ready-people target"
            />
          ) : null}

          {nominated > 0 ? (
            <ProgressLine
              pct={readyPct}
              tone={readyPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`${ready} of ${plural(nominated, "nominated candidate", "nominated candidates")} were ready`}
              label="Ready candidates"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen capability resilience</span>

            <h2>Critical capabilities</h2>
          </div>

          <UsersRound size={19} />
        </div>

        {hasPolicies ? (
          <p className="kit-meta-line">
            Single points of failure first, then the lowest score, across{" "}
            {plural(policies.length, "capability", "capabilities")}.
          </p>
        ) : null}

        <DataTable
          columns={policyColumns}
          rows={orderedPolicies}
          getRowId={(item) => String(item.id)}
          ariaLabel="Frozen critical capabilities"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No capabilities captured"
              description="This snapshot has no critical capabilities."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen succession pipeline</span>

            <h2>Candidate evidence</h2>
          </div>

          <Users size={19} />
        </div>

        {hasCandidates ? (
          <p className="kit-meta-line">
            Highest evidence score first, across{" "}
            {plural(candidates.length, "candidate", "candidates")}.
          </p>
        ) : null}

        <DataTable
          columns={candidateColumns}
          rows={orderedCandidates}
          getRowId={(item) => String(item.id)}
          ariaLabel="Frozen succession candidates"
          busy={fetching}
          empty={
            <EmptyState
              icon={Users}
              title="No candidates captured"
              description="No succession candidates were captured in this snapshot."
            />
          }
        />
      </section>

      <section className="succession-method-note">
        <UsersRound size={18} />

        <div>
          <strong>Immutable workforce resilience evidence</strong>

          <p>
            This snapshot preserves critical-capability coverage, key-person exposure and
            candidate evidence exactly as they existed at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
