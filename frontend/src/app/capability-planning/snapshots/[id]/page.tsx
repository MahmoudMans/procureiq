"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BrainCircuit,
  CircleAlert,
  ClipboardList,
  Download,
  Gauge,
  GraduationCap,
  Info,
  ListChecks,
  RefreshCw,
  ShieldAlert,
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
import { getCapabilitySnapshot } from "@/lib/api";
import type { CapabilitySnapshotDetail } from "@/types/capability-planning";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type SnapshotMember = CapabilitySnapshotDetail["members"][number];
type SnapshotWorkItem = CapabilitySnapshotDetail["workItems"][number];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
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
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.userName}</strong>

          <small>{readable(String(item.role))}</small>
        </div>
      ),
    },
    {
      id: "skills",
      header: "Assessed skills",
      align: "right",
      sortValue: (item) => item.assessedSkillCount,
      cell: (item) => item.assessedSkillCount,
    },
    {
      id: "proficiency",
      header: "Avg proficiency",
      align: "right",
      sortValue: (item) => item.averageProficiency,
      cell: (item) => item.averageProficiency.toFixed(2),
    },
    {
      id: "assigned",
      header: "Assigned work",
      align: "right",
      sortValue: (item) => item.assignedWorkItemCount,
      cell: (item) => item.assignedWorkItemCount,
    },
    {
      id: "gaps",
      header: "Capability gaps",
      align: "right",
      sortValue: (item) => item.capabilityGapCount,
      cell: (item) => (
        <span className={item.capabilityGapCount > 0 ? "kit-text-warning" : undefined}>
          {item.capabilityGapCount}
        </span>
      ),
    },
    {
      id: "development",
      header: "Open development",
      align: "right",
      sortValue: (item) => item.openDevelopmentActionCount,
      cell: (item) => item.openDevelopmentActionCount,
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
      id: "assigned",
      header: "Assigned",
      align: "right",
      sortValue: (item) => item.assignedMemberCount,
      cell: (item) => (
        <span className={item.assignedMemberCount === 0 ? "kit-text-warning" : undefined}>
          {item.assignedMemberCount}
        </span>
      ),
    },
    {
      id: "requirements",
      header: "Requirements",
      align: "right",
      sortValue: (item) => item.requirementCount,
      cell: (item) => item.requirementCount,
    },
    {
      id: "criticalGaps",
      header: "Critical gaps",
      align: "right",
      sortValue: (item) => item.criticalGapCount,
      cell: (item) => (
        <strong className={item.criticalGapCount > 0 ? "kit-text-warning" : undefined}>
          {item.criticalGapCount}
        </strong>
      ),
    },
    {
      id: "assignedFit",
      header: "Assigned fit",
      align: "right",
      sortValue: (item) => item.assignedFitPct,
      cell: (item) => `${item.assignedFitPct.toFixed(1)}%`,
    },
    {
      id: "benchFit",
      header: "Bench fit",
      align: "right",
      sortValue: (item) => item.benchFitPct,
      cell: (item) => `${item.benchFitPct.toFixed(1)}%`,
    },
    {
      id: "benchDepth",
      header: "Bench depth",
      align: "right",
      sortValue: (item) => item.benchReadyMemberCount,
      cell: (item) => (
        <span className={item.benchReadyMemberCount === 0 ? "kit-text-warning" : undefined}>
          {item.benchReadyMemberCount}
        </span>
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
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: CapabilitySnapshotDetail;
}

export default function CapabilitySnapshotPage() {
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
        const response = await getCapabilitySnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load capability snapshot.",
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
        <Link href="/capability-planning" className="request-back-link">
          <ArrowLeft size={16} />
          Capability planning
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

  const withGaps = workItems.filter((item) => item.criticalGapCount > 0);
  const noBench = workItems.filter((item) => item.benchReadyMemberCount === 0);
  const unstaffed = workItems.filter((item) => item.assignedMemberCount === 0);
  const membersWithGaps = members.filter((member) => member.capabilityGapCount > 0);
  const readyShare = hasWork ? ((workItems.length - withGaps.length) / workItems.length) * 100 : 0;

  const orderedMembers = [...members].sort(
    (a, b) => b.capabilityGapCount - a.capabilityGapCount || a.averageProficiency - b.averageProficiency,
  );
  const orderedWork = [...workItems].sort(
    (a, b) => b.criticalGapCount - a.criticalGapCount || a.assignedFitPct - b.assignedFitPct,
  );
  const worst = orderedWork.length > 0 ? orderedWork[0] : null;

  function exportMembers() {
    downloadRows(
      `${snapshot.snapshotNumber}-members.csv`,
      [
        "Member",
        "Role",
        "Assessed skills",
        "Average proficiency",
        "Assigned work items",
        "Capability gaps",
        "Open development actions",
      ],
      orderedMembers.map((member) => [
        String(member.userName),
        readable(String(member.role)),
        member.assessedSkillCount,
        member.averageProficiency,
        member.assignedWorkItemCount,
        member.capabilityGapCount,
        member.openDevelopmentActionCount,
      ]),
    );

    toast.success("Snapshot exported", plural(members.length, "member", "members"));
  }

  function exportWork() {
    downloadRows(
      `${snapshot.snapshotNumber}-work-readiness.csv`,
      [
        "Work item",
        "Reference",
        "Type",
        "Assigned members",
        "Requirements",
        "Critical gaps",
        "Assigned fit %",
        "Bench fit %",
        "Bench-ready members",
        "Readiness",
      ],
      orderedWork.map((item) => [
        String(item.sourceTitle),
        String(item.sourceReference),
        readable(String(item.sourceType)),
        item.assignedMemberCount,
        item.requirementCount,
        item.criticalGapCount,
        item.assignedFitPct,
        item.benchFitPct,
        item.benchReadyMemberCount,
        readable(String(item.readiness)),
      ]),
    );

    toast.success("Snapshot exported", plural(workItems.length, "work item", "work items"));
  }

  const kpis: KpiItem[] = [
    {
      label: "Capability score",
      icon: Gauge,
      value: summary.capabilityScore.toFixed(1),
      note: readable(String(summary.capabilityHealth)),
    },
    {
      label: "Requirement coverage",
      icon: ListChecks,
      value: `${summary.requirementCoveragePct.toFixed(1)}%`,
      note: "Across the work items",
    },
    {
      label: "Assigned fit",
      icon: BadgeCheck,
      value: `${summary.averageAssignedFitPct.toFixed(1)}%`,
      note: "Average, assigned members",
    },
    {
      label: "Bench fit",
      icon: Users,
      value: `${summary.averageBenchFitPct.toFixed(1)}%`,
      note: "Average, bench members",
    },
    {
      label: "Critical gaps",
      icon: ShieldAlert,
      value: String(summary.criticalGapCount),
      note: `${plural(withGaps.length, "work item", "work items")} affected`,
      tone: summary.criticalGapCount > 0 ? "warning" : "default",
    },
    {
      label: "Open development",
      icon: GraduationCap,
      value: String(summary.openDevelopmentActionCount),
      note: "Development actions in flight",
    },
  ];

  const memberColumns = buildMemberColumns();
  const workColumns = buildWorkColumns();

  return (
    <div className="page-stack">
      <Link href="/capability-planning" className="request-back-link">
        <ArrowLeft size={16} />
        Capability planning
      </Link>

      <section className="capability-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{snapshot.snapshotNumber}</span>

            <StatusBadge
              value={String(summary.capabilityHealth)}
              label={readable(String(summary.capabilityHealth))}
            />
          </div>

          <span className="eyebrow">Immutable executive capability record</span>

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

      {summary.criticalGapCount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(summary.criticalGapCount, "critical gap was", "critical gaps were")} recorded
              at capture.
            </strong>{" "}
            {plural(withGaps.length, "work item carried", "work items carried")} critical gaps
            {worst !== null && worst.criticalGapCount > 0
              ? `, the most on ${worst.sourceTitle} (${worst.criticalGapCount}).`
              : "."}
          </div>
        </div>
      ) : null}

      {unstaffed.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(unstaffed.length, "work item had", "work items had")} nobody assigned.
            </strong>{" "}
            Their assigned fit cannot be relied on.
          </div>
        </div>
      ) : null}

      {noBench.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {plural(noBench.length, "work item had", "work items had")} no bench-ready member.
            </strong>{" "}
            If an assigned member became unavailable, nobody was ready to step in.
          </div>
        </div>
      ) : null}

      {summary.openDevelopmentActionCount > 0 && membersWithGaps.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(
                summary.openDevelopmentActionCount,
                "development action was",
                "development actions were",
              )}{" "}
              open.
            </strong>{" "}
            {plural(membersWithGaps.length, "member had", "members had")} capability gaps at
            capture.
          </div>
        </div>
      ) : null}

      {!hasMembers && !hasWork ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This snapshot captured no members or work items.</strong> There was no
            workforce evidence when it was taken.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Capability snapshot summary" />

      {hasWork ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Readiness at capture</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={summary.requirementCoveragePct}
            tone={summary.requirementCoveragePct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Requirement coverage ${summary.requirementCoveragePct.toFixed(1)}%`}
            label="Requirement coverage"
          />

          <ProgressLine
            pct={summary.averageAssignedFitPct}
            tone={summary.averageAssignedFitPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Assigned fit ${summary.averageAssignedFitPct.toFixed(1)}%`}
            label="Assigned fit"
          />

          <ProgressLine
            pct={summary.averageBenchFitPct}
            tone={summary.averageBenchFitPct >= 100 ? meterToneFor("success") : "primary"}
            caption={`Bench fit ${summary.averageBenchFitPct.toFixed(1)}%`}
            label="Bench fit"
          />

          <ProgressLine
            pct={readyShare}
            tone={withGaps.length === 0 ? meterToneFor("success") : "primary"}
            caption={`${workItems.length - withGaps.length} of ${plural(workItems.length, "work item", "work items")} had no critical gaps`}
            label="Work items without critical gaps"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen workforce evidence</span>

            <h2>Member capability</h2>
          </div>

          <BrainCircuit size={19} />
        </div>

        {hasMembers ? (
          <p className="kit-meta-line">
            Most capability gaps first, across {plural(members.length, "member", "members")}.
          </p>
        ) : null}

        <DataTable
          columns={memberColumns}
          rows={orderedMembers}
          getRowId={(member) => String(member.userId)}
          ariaLabel="Frozen member capability"
          busy={fetching}
          empty={
            <EmptyState
              icon={Users}
              title="No members captured"
              description="This snapshot has no member capability records."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen strategic suitability</span>

            <h2>Work readiness</h2>
          </div>

          <ClipboardList size={19} />
        </div>

        {hasWork ? (
          <p className="kit-meta-line">
            Most critical gaps first, across {plural(workItems.length, "work item", "work items")}.
          </p>
        ) : null}

        <DataTable
          columns={workColumns}
          rows={orderedWork}
          getRowId={(item) => `${String(item.sourceType)}:${String(item.sourceEntityId)}`}
          ariaLabel="Frozen work readiness"
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

      <section className="capability-method-note">
        <BrainCircuit size={18} />

        <div>
          <strong>Immutable capability evidence</strong>

          <p>
            This snapshot freezes strategic-work readiness and workforce gap metrics at capture
            time. Later assessments, assignments, requirements and development actions do not
            rewrite it.
          </p>
        </div>
      </section>
    </div>
  );
}
