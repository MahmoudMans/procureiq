"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  Hourglass,
  Info,
  ListChecks,
  RefreshCw,
  Scale,
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
import { getCapacitySnapshot } from "@/lib/api";
import type { CapacitySnapshotDetail } from "@/types/capacity-planning";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotMember = CapacitySnapshotDetail["members"][number];
type SnapshotWorkItem = CapacitySnapshotDetail["workItems"][number];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function hours(value: number): string {
  return `${value.toFixed(0)}h`;
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

function buildMemberColumns(): Column<SnapshotMember>[] {
  return [
    {
      id: "member",
      header: "Member",
      sortValue: (item) => String(item.userName).toLowerCase(),
      cell: (item) => <strong>{item.userName}</strong>,
    },
    {
      id: "capacity",
      header: "Capacity",
      align: "right",
      sortValue: (item) => item.effectiveCapacityHours,
      cell: (item) => hours(item.effectiveCapacityHours),
    },
    {
      id: "assigned",
      header: "Assigned",
      align: "right",
      sortValue: (item) => item.assignedEffortHours,
      cell: (item) => hours(item.assignedEffortHours),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: (item) => item.remainingCapacityHours,
      cell: (item) => (
        <span className={item.remainingCapacityHours < -0.005 ? "kit-text-danger" : undefined}>
          {hours(item.remainingCapacityHours)}
        </span>
      ),
    },
    {
      id: "utilization",
      header: "Utilization",
      align: "right",
      sortValue: (item) => item.utilizationPct,
      cell: (item) => (
        <strong className={item.utilizationPct > 100.005 ? "kit-text-warning" : undefined}>
          {item.utilizationPct.toFixed(1)}%
        </strong>
      ),
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

function buildWorkColumns(): Column<SnapshotWorkItem>[] {
  return [
    {
      id: "work",
      header: "Work item",
      sortValue: (item) => String(item.sourceTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.sourceTitle}</strong>

          <small>{item.sourceReference}</small>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortValue: (item) => String(item.sourceType),
      cell: (item) => readable(String(item.sourceType)),
    },
    {
      id: "effort",
      header: "Effort",
      align: "right",
      sortValue: (item) => item.estimatedEffortHours,
      cell: (item) => hours(item.estimatedEffortHours),
    },
    {
      id: "allocation",
      header: "Allocation",
      align: "right",
      sortValue: (item) => item.allocationPct,
      cell: (item) => (
        <span
          className={
            item.allocationPct < 99.995 && item.unassignedEffortHours > 0.5
              ? "kit-text-warning"
              : undefined
          }
        >
          {item.allocationPct.toFixed(0)}%
        </span>
      ),
    },
    {
      id: "unassigned",
      header: "Unassigned",
      align: "right",
      sortValue: (item) => item.unassignedEffortHours,
      cell: (item) => (
        <span className={item.unassignedEffortHours > 0.5 ? "kit-text-warning" : undefined}>
          {hours(item.unassignedEffortHours)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.planningStatus),
      cell: (item) => (
        <StatusBadge
          value={String(item.planningStatus)}
          label={readable(String(item.planningStatus))}
        />
      ),
    },
    {
      id: "pressure",
      header: "Deadline pressure",
      sortValue: (item) => (item.deadlinePressure ? 1 : 0),
      cell: (item) =>
        item.deadlinePressure ? (
          <StatusBadge value="PENDING" label="Pressure" />
        ) : (
          <span className="kit-text-muted">No</span>
        ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: CapacitySnapshotDetail;
}

export default function CapacitySnapshotPage() {
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
        const response = await getCapacitySnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load capacity snapshot.");
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
        <Link href="/capacity-planning" className="request-back-link">
          <ArrowLeft size={16} />
          Capacity planning
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

  const { snapshot, summary, members, workItems } = detail;
  const hasMembers = members.length > 0;
  const hasWork = workItems.length > 0;

  const capacity = summary.effectiveCapacityHours;
  const demand = summary.estimatedDemandHours;
  const shortfall = demand - capacity;
  const loadPct = capacity > 0 ? (demand / capacity) * 100 : 0;
  const overloaded = members.filter((member) => member.utilizationPct > 100.005);
  const pressured = workItems.filter((item) => item.deadlinePressure);
  const unassignedItems = workItems.filter((item) => item.unassignedEffortHours > 0.5);
  const unassignedHours = workItems.reduce((sum, item) => sum + item.unassignedEffortHours, 0);

  const orderedMembers = [...members].sort((a, b) => b.utilizationPct - a.utilizationPct);
  const orderedWork = [...workItems].sort(
    (a, b) =>
      Number(b.deadlinePressure) - Number(a.deadlinePressure) ||
      b.unassignedEffortHours - a.unassignedEffortHours,
  );
  const topMember = orderedMembers.length > 0 ? orderedMembers[0] : null;

  function exportMembers() {
    downloadRows(
      `${snapshot.snapshotNumber}-members.csv`,
      [
        "Member",
        "Effective capacity hours",
        "Assigned hours",
        "Remaining hours",
        "Utilization %",
        "Health",
      ],
      orderedMembers.map((member) => [
        String(member.userName),
        member.effectiveCapacityHours,
        member.assignedEffortHours,
        member.remainingCapacityHours,
        member.utilizationPct,
        readable(String(member.health)),
      ]),
    );

    toast.success("Snapshot exported", plural(members.length, "member", "members"));
  }

  function exportWork() {
    downloadRows(
      `${snapshot.snapshotNumber}-work-allocation.csv`,
      [
        "Work item",
        "Reference",
        "Type",
        "Estimated effort hours",
        "Allocation %",
        "Unassigned hours",
        "Planning status",
        "Deadline pressure",
      ],
      orderedWork.map((item) => [
        String(item.sourceTitle),
        String(item.sourceReference),
        readable(String(item.sourceType)),
        item.estimatedEffortHours,
        item.allocationPct,
        item.unassignedEffortHours,
        readable(String(item.planningStatus)),
        item.deadlinePressure ? "Yes" : "No",
      ]),
    );

    toast.success("Snapshot exported", plural(workItems.length, "work item", "work items"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Capacity score",
      icon: Gauge,
      value: summary.capacityScore.toFixed(1),
      note: readable(String(summary.portfolioHealth)),
    },
    {
      label: "Effective capacity",
      icon: Users,
      value: hours(capacity),
      note: "Available hours at capture",
    },
    {
      label: "Demand",
      icon: Hourglass,
      value: hours(demand),
      note: "Estimated strategic effort",
    },
    {
      label: "Gap",
      icon: Scale,
      value: hours(summary.capacityGapHours),
      note: shortfall > 0.5 ? "Demand above capacity" : "Capacity covers demand",
      tone: shortfall > 0.5 ? "warning" : "default",
    },
    {
      label: "Assignment coverage",
      icon: ListChecks,
      value: `${summary.assignmentCoveragePct.toFixed(1)}%`,
      note: "Effort with an owner",
    },
    {
      label: "Deadline health",
      icon: CalendarClock,
      value: `${summary.deadlineHealthPct.toFixed(1)}%`,
      note: `${plural(pressured.length, "work item", "work items")} under pressure`,
    },
  ];

  const memberColumns = buildMemberColumns();
  const workColumns = buildWorkColumns();

  return (
    <div className="page-stack">
      <Link href="/capacity-planning" className="request-back-link">
        <ArrowLeft size={16} />
        Capacity planning
      </Link>

      <section className="capacity-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(summary.portfolioHealth)}
              label={readable(String(summary.portfolioHealth))}
            />
          </div>

          <span className="eyebrow">Immutable executive capacity record</span>

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
            onClick={exportMembers}
            disabled={!hasMembers}
          >
            <Download size={15} />
            Export members
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportWork}
            disabled={!hasWork}
          >
            <Download size={15} />
            Export work
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

      {shortfall > 0.5 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Demand exceeded effective capacity by {hours(shortfall)}.</strong> The team
            had {hours(capacity)} available against {hours(demand)} of estimated effort.
          </div>
        </div>
      ) : null}

      {overloaded.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(overloaded.length, "member was", "members were")} above 100% utilization.
            </strong>
            {topMember !== null && topMember.utilizationPct > 100.005
              ? ` The highest was ${topMember.userName} at ${topMember.utilizationPct.toFixed(1)}%.`
              : ""}
          </div>
        </div>
      ) : null}

      {pressured.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(pressured.length, "work item was", "work items were")} under deadline
              pressure.
            </strong>{" "}
            Deadline health was {summary.deadlineHealthPct.toFixed(1)}% at capture.
          </div>
        </div>
      ) : null}

      {unassignedItems.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{hours(unassignedHours)} of effort was unassigned.</strong> It sat across{" "}
            {plural(unassignedItems.length, "work item", "work items")}.
          </div>
        </div>
      ) : null}

      {!hasMembers && !hasWork ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no members or work items.</strong> There was no
            capacity evidence when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Capacity snapshot summary" />

      {hasMembers || hasWork ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Load at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          {capacity > 0 ? (
            <ProgressLine
              pct={loadPct}
              tone={loadPct <= 100 ? meterToneFor("success") : "primary"}
              caption={`Demand ${hours(demand)} against ${hours(capacity)} effective capacity (${loadPct.toFixed(1)}%)`}
              label="Demand against effective capacity"
            />
          ) : null}

          <ProgressLine
            pct={summary.assignmentCoveragePct}
            tone={summary.assignmentCoveragePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Assignment coverage ${summary.assignmentCoveragePct.toFixed(1)}%`}
            label="Assignment coverage"
          />

          <ProgressLine
            pct={summary.deadlineHealthPct}
            tone={summary.deadlineHealthPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Deadline health ${summary.deadlineHealthPct.toFixed(1)}%`}
            label="Deadline health"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen team load</span>

            <h2>Member capacity</h2>
          </div>

          <Users size={19} />
        </div>

        {hasMembers ? (
          <p className="kit-meta-line">
            Highest utilization first, across {plural(members.length, "member", "members")}.
          </p>
        ) : null}

        <DataTable
          columns={memberColumns}
          rows={orderedMembers}
          getRowId={(member) => String(member.userId)}
          ariaLabel="Frozen member capacity"
          busy={fetching}
          empty={
            <EmptyState
              icon={Users}
              title="No members captured"
              description="This snapshot has no member capacity records."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen strategic demand</span>

            <h2>Work allocation</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasWork ? (
          <p className="kit-meta-line">
            Deadline pressure first, then the most unassigned effort, across{" "}
            {plural(workItems.length, "work item", "work items")}.
          </p>
        ) : null}

        <DataTable
          columns={workColumns}
          rows={orderedWork}
          getRowId={(item) => `${String(item.sourceType)}:${String(item.sourceEntityId)}`}
          ariaLabel="Frozen work allocation"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No work items captured"
              description="This snapshot has no strategic work items."
            />
          }
        />
      </section>

      <section className="capacity-method-note">
        <Gauge size={18} />

        <div>
          <strong>Immutable capacity evidence</strong>

          <p>
            This record preserves team capacity and strategic demand as they existed at capture
            time. Later profile, assignment or Step 46 changes do not rewrite it.
          </p>
        </div>
      </section>
    </div>
  );
}
