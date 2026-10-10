"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Goal,
  Info,
  Link2,
  RefreshCw,
  ShieldCheck,
  Users,
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
import { getStrategyRoadmapSnapshot } from "@/lib/api";
import type { StrategyRoadmapSnapshotDetail } from "@/types/strategy-roadmap";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotInitiative = StrategyRoadmapSnapshotDetail["initiatives"][number];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Blocked dependencies, overdue milestones and rejected gates on one initiative. */
function issueCount(item: SnapshotInitiative): number {
  return item.blockedDependencyCount + item.overdueMilestoneCount + item.rejectedGateCount;
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

function buildInitiativeColumns(): Column<SnapshotInitiative>[] {
  return [
    {
      id: "initiative",
      header: "Initiative",
      sortValue: (item) => String(item.title).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.title}</strong>

          <small>{item.initiativeNumber}</small>
        </div>
      ),
    },
    {
      id: "dimension",
      header: "Dimension",
      sortValue: (item) => String(item.dimensionKey),
      cell: (item) => readable(String(item.dimensionKey)),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (item) => String(item.priority),
      cell: (item) => readable(String(item.priority)),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (item) => String(item.ownerName ?? "").toLowerCase(),
      cell: (item) =>
        item.ownerName ? item.ownerName : <span className="kit-text-warning">Unowned</span>,
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
      id: "contribution",
      header: "Contribution",
      align: "right",
      sortValue: (item) => item.plannedContributionPoints,
      cell: (item) => item.plannedContributionPoints.toFixed(1),
    },
    {
      id: "blockers",
      header: "Dependency blockers",
      align: "right",
      sortValue: (item) => item.blockedDependencyCount,
      cell: (item) => (
        <span className={item.blockedDependencyCount > 0 ? "kit-text-warning" : undefined}>
          {item.blockedDependencyCount}
        </span>
      ),
    },
    {
      id: "overdue",
      header: "Overdue milestones",
      align: "right",
      sortValue: (item) => item.overdueMilestoneCount,
      cell: (item) => (
        <span className={item.overdueMilestoneCount > 0 ? "kit-text-warning" : undefined}>
          {item.overdueMilestoneCount}
        </span>
      ),
    },
    {
      id: "rejected",
      header: "Rejected gates",
      align: "right",
      sortValue: (item) => item.rejectedGateCount,
      cell: (item) => (
        <span className={item.rejectedGateCount > 0 ? "kit-text-warning" : undefined}>
          {item.rejectedGateCount}
        </span>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: StrategyRoadmapSnapshotDetail;
}

export default function StrategyRoadmapSnapshotPage() {
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
        const response = await getStrategyRoadmapSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load roadmap snapshot.");
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
        <Link href="/strategy-roadmaps" className="request-back-link">
          <ArrowLeft size={16} />
          Strategy roadmaps
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

  const { snapshot, roadmap, initiatives } = detail;
  const hasRows = initiatives.length > 0;
  const blocked = roadmap.blockedInitiativeCount;

  const withBlockers = initiatives.filter((item) => item.blockedDependencyCount > 0);
  const withOverdue = initiatives.filter((item) => item.overdueMilestoneCount > 0);
  const withRejected = initiatives.filter((item) => item.rejectedGateCount > 0);
  const unowned = initiatives.filter((item) => !item.ownerName);

  const totalBlockers = initiatives.reduce((sum, item) => sum + item.blockedDependencyCount, 0);
  const totalOverdue = initiatives.reduce((sum, item) => sum + item.overdueMilestoneCount, 0);
  const totalRejected = initiatives.reduce((sum, item) => sum + item.rejectedGateCount, 0);
  const totalContribution = initiatives.reduce(
    (sum, item) => sum + item.plannedContributionPoints,
    0,
  );
  const notBlocked = Math.max(0, initiatives.length - blocked);

  const orderedInitiatives = [...initiatives].sort(
    (a, b) => issueCount(b) - issueCount(a) || b.plannedContributionPoints - a.plannedContributionPoints,
  );
  const first = orderedInitiatives.length > 0 ? orderedInitiatives[0] : null;
  const mostExposed = first !== null && issueCount(first) > 0 ? first : null;

  function exportInitiatives() {
    downloadRows(
      `${snapshot.snapshotNumber}-initiatives.csv`,
      [
        "Initiative",
        "Initiative number",
        "Dimension",
        "Priority",
        "Owner",
        "Status",
        "Planned contribution points",
        "Dependency blockers",
        "Overdue milestones",
        "Rejected gates",
      ],
      orderedInitiatives.map((item) => [
        String(item.title),
        String(item.initiativeNumber),
        readable(String(item.dimensionKey)),
        readable(String(item.priority)),
        String(item.ownerName ?? ""),
        readable(String(item.status)),
        item.plannedContributionPoints,
        item.blockedDependencyCount,
        item.overdueMilestoneCount,
        item.rejectedGateCount,
      ]),
    );

    toast.success("Snapshot exported", plural(initiatives.length, "initiative", "initiatives"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Readiness",
      icon: Gauge,
      value: roadmap.readinessScore.toFixed(1),
      note: readable(String(roadmap.readinessHealth)),
    },
    {
      label: "Owner coverage",
      icon: Users,
      value: `${roadmap.ownerCoveragePct.toFixed(1)}%`,
      note: "Initiatives with an owner",
    },
    {
      label: "Dependency health",
      icon: Link2,
      value: `${roadmap.dependencyHealthPct.toFixed(1)}%`,
      note: "Dependencies not blocked",
    },
    {
      label: "Milestone health",
      icon: CalendarClock,
      value: `${roadmap.milestoneHealthPct.toFixed(1)}%`,
      note: "Milestones on schedule",
    },
    {
      label: "Gate health",
      icon: ShieldCheck,
      value: `${roadmap.gateHealthPct.toFixed(1)}%`,
      note: "Gates not rejected",
    },
    {
      label: "Blocked initiatives",
      icon: Ban,
      value: String(blocked),
      note: "Could not proceed at capture",
      tone: blocked > 0 ? "warning" : "default",
    },
  ];

  const initiativeColumns = buildInitiativeColumns();

  return (
    <div className="page-stack">
      <Link
        href={`/strategy-roadmaps/${encodeURIComponent(String(snapshot.roadmapId))}`}
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Roadmap
      </Link>

      <section className="roadmap-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(roadmap.readinessHealth)}
              label={readable(String(roadmap.readinessHealth))}
            />
          </div>

          <span className="eyebrow">Immutable roadmap evidence</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {snapshot.roadmapNumber}
            {" · "}
            {snapshot.roadmapTitle}
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
            onClick={exportInitiatives}
            disabled={!hasRows}
          >
            <Download size={15} />
            Export CSV
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

      {blocked > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(blocked, "initiative was", "initiatives were")} blocked at capture.
            </strong>
            {mostExposed !== null
              ? ` The most exposed was ${mostExposed.title}, with ${plural(issueCount(mostExposed), "open issue", "open issues")} across dependencies, milestones and gates.`
              : ""}
          </div>
        </div>
      ) : null}

      {withBlockers.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(withBlockers.length, "initiative had", "initiatives had")} blocked
              dependencies.
            </strong>{" "}
            {plural(totalBlockers, "dependency was", "dependencies were")} blocked in total.
            Dependency health was {roadmap.dependencyHealthPct.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {withOverdue.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(withOverdue.length, "initiative had", "initiatives had")} overdue milestones.
            </strong>{" "}
            {plural(totalOverdue, "milestone was", "milestones were")} overdue in total.
            Milestone health was {roadmap.milestoneHealthPct.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {withRejected.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(withRejected.length, "initiative had", "initiatives had")} rejected gates.
            </strong>{" "}
            {plural(totalRejected, "gate was", "gates were")} rejected in total. Gate health was{" "}
            {roadmap.gateHealthPct.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {unowned.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(unowned.length, "initiative had", "initiatives had")} no owner.
            </strong>{" "}
            Owner coverage was {roadmap.ownerCoveragePct.toFixed(1)}% at capture. The Owner column
            marks {unowned.length === 1 ? "it" : "them"} in amber.
          </div>
        </div>
      ) : null}

      {!hasRows ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no initiatives.</strong> There was no initiative
            portfolio on the roadmap when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Roadmap snapshot summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Readiness at capture</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={roadmap.readinessScore}
          tone={roadmap.readinessScore >= 100 ? meterToneFor("success") : "primary"}
          caption={`Readiness score ${roadmap.readinessScore.toFixed(1)} of 100`}
          label="Readiness score"
        />

        <ProgressLine
          pct={roadmap.ownerCoveragePct}
          tone={roadmap.ownerCoveragePct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Owner coverage ${roadmap.ownerCoveragePct.toFixed(1)}%`}
          label="Owner coverage"
        />

        <ProgressLine
          pct={roadmap.dependencyHealthPct}
          tone={roadmap.dependencyHealthPct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Dependency health ${roadmap.dependencyHealthPct.toFixed(1)}%`}
          label="Dependency health"
        />

        <ProgressLine
          pct={roadmap.milestoneHealthPct}
          tone={roadmap.milestoneHealthPct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Milestone health ${roadmap.milestoneHealthPct.toFixed(1)}%`}
          label="Milestone health"
        />

        <ProgressLine
          pct={roadmap.gateHealthPct}
          tone={roadmap.gateHealthPct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Gate health ${roadmap.gateHealthPct.toFixed(1)}%`}
          label="Gate health"
        />

        {hasRows ? (
          <ProgressLine
            pct={(notBlocked / initiatives.length) * 100}
            tone={blocked === 0 ? meterToneFor("success") : "primary"}
            caption={`${notBlocked} of ${plural(initiatives.length, "initiative", "initiatives")} were not blocked`}
            label="Initiatives that were not blocked"
          />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen initiative portfolio</span>

            <h2>Roadmap execution state</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasRows ? (
          <p className="kit-meta-line">
            Most open issues first, across {plural(initiatives.length, "initiative", "initiatives")}
            . Planned contribution totals {totalContribution.toFixed(1)} points.
          </p>
        ) : null}

        <DataTable
          columns={initiativeColumns}
          rows={orderedInitiatives}
          getRowId={(item) => String(item.id)}
          ariaLabel="Frozen roadmap initiatives"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No initiatives captured"
              description="This snapshot has no roadmap initiatives."
            />
          }
        />
      </section>

      <section className="roadmap-method-note">
        <Goal size={18} />

        <div>
          <strong>Immutable roadmap evidence</strong>

          <p>
            This snapshot freezes roadmap readiness, initiative status, blockers, schedule
            pressure and gate exposure at capture time. Later roadmap changes do not rewrite this
            record.
          </p>
        </div>
      </section>
    </div>
  );
}
