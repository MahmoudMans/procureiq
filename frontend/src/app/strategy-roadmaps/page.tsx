"use client";

import {
  CircleAlert,
  Download,
  Goal,
  Plus,
  RefreshCw,
  SearchX,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type Column,
  DataTable,
  EmptyState,
  Meter,
  SearchField,
  SelectField,
  type SelectOption,
  type StatItem,
  StatStrip,
  StatusBadge,
  downloadCsv,
  meterToneFor,
  readable,
  toneFor,
  useToast,
} from "@/components/kit";
import { getStrategyRoadmapDashboard } from "@/lib/api";
import type { StrategyRoadmapDashboard } from "@/types/strategy-roadmap";

/* ------------------------------------------------------------------ */
/* Helpers & columns                                                   */
/* ------------------------------------------------------------------ */

type Roadmap = StrategyRoadmapDashboard["roadmaps"][number];

const EMPTY_ROADMAPS: Roadmap[] = [];
const integer = new Intl.NumberFormat("en-US");

function signed(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function ratio(done: number, total: number): number {
  return total > 0 ? done / total : 0;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const COLUMNS: Column<Roadmap>[] = [
  {
    id: "roadmap",
    header: "Roadmap",
    sortValue: (roadmap) => roadmap.title.toLowerCase(),
    cell: (roadmap) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/strategy-roadmaps/${roadmap.id}`} className="supplier-360-link">
            {roadmap.title}
          </Link>
        </strong>

        <span>
          {roadmap.roadmapNumber} · FY {roadmap.fiscalYear}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (roadmap) => roadmap.status,
    cell: (roadmap) => <StatusBadge value={roadmap.status} />,
  },
  {
    id: "scenario",
    header: "Scenario",
    sortValue: (roadmap) => roadmap.sourceScenarioNumber,
    cell: (roadmap) => roadmap.sourceScenarioNumber,
  },
  {
    id: "delta",
    header: "Scenario delta",
    align: "right",
    sortValue: (roadmap) => roadmap.scenarioDelta,
    firstSort: "desc",
    cell: (roadmap) => (
      <span
        className={`kit-num${
          roadmap.scenarioDelta > 0
            ? " kit-text-success"
            : roadmap.scenarioDelta < 0
              ? " kit-text-danger"
              : ""
        }`}
      >
        {signed(roadmap.scenarioDelta)}
      </span>
    ),
  },
  {
    id: "initiatives",
    header: "Initiatives",
    sortValue: (roadmap) =>
      ratio(roadmap.completedInitiativeCount, roadmap.initiativeCount),
    firstSort: "desc",
    cell: (roadmap) =>
      roadmap.initiativeCount > 0 ? (
        <Meter
          value={roadmap.completedInitiativeCount}
          max={roadmap.initiativeCount}
          label={`${roadmap.completedInitiativeCount} / ${roadmap.initiativeCount}`}
          tone={
            roadmap.completedInitiativeCount >= roadmap.initiativeCount
              ? "success"
              : "primary"
          }
          ariaLabel="Completed initiatives"
        />
      ) : (
        <span className="kit-text-muted">—</span>
      ),
  },
  {
    id: "blocked",
    header: "Blocked",
    sortValue: (roadmap) =>
      roadmap.blockedInitiativeCount * 1_000_000 +
      roadmap.overdueMilestoneCount * 1_000 +
      roadmap.rejectedGateCount,
    firstSort: "desc",
    cell: (roadmap) => (
      <div className="kit-cell-stack">
        <span
          className={roadmap.blockedInitiativeCount > 0 ? "kit-text-danger" : "kit-text-muted"}
        >
          {roadmap.blockedInitiativeCount}
        </span>

        {roadmap.overdueMilestoneCount > 0 ? (
          <small className="kit-cell-flag">
            {plural(roadmap.overdueMilestoneCount, "overdue milestone")}
          </small>
        ) : null}

        {roadmap.rejectedGateCount > 0 ? (
          <small className="kit-cell-flag">
            {plural(roadmap.rejectedGateCount, "rejected gate")}
          </small>
        ) : null}
      </div>
    ),
  },
  {
    id: "readiness",
    header: "Readiness",
    sortValue: (roadmap) => roadmap.readinessScore,
    firstSort: "desc",
    cell: (roadmap) => (
      <Meter
        value={roadmap.readinessScore}
        max={100}
        label={roadmap.readinessScore.toFixed(1)}
        tone={meterToneFor(toneFor(roadmap.readinessHealth))}
        ariaLabel="Readiness score"
      />
    ),
  },
  {
    id: "health",
    header: "Health",
    sortValue: (roadmap) => roadmap.readinessHealth,
    cell: (roadmap) => <StatusBadge value={roadmap.readinessHealth} />,
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (roadmap) => (
      <Link href={`/strategy-roadmaps/${roadmap.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function StrategyRoadmapsPage() {
  const toast = useToast();

  const [dashboard, setDashboard] = useState<StrategyRoadmapDashboard | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getStrategyRoadmapDashboard();

        if (active) {
          setDashboard(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load strategy roadmaps.",
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
  }, [reloadKey]);

  const all = dashboard?.roadmaps ?? EMPTY_ROADMAPS;

  const totals = useMemo(
    () => ({
      active: all.filter((roadmap) => roadmap.status === "ACTIVE").length,
      blocked: all.reduce((sum, roadmap) => sum + roadmap.blockedInitiativeCount, 0),
      overdue: all.reduce((sum, roadmap) => sum + roadmap.overdueMilestoneCount, 0),
      rejected: all.reduce((sum, roadmap) => sum + roadmap.rejectedGateCount, 0),
    }),
    [all],
  );

  const statusOptions = useMemo<SelectOption[]>(() => {
    const unique = Array.from(new Set(all.map((roadmap) => roadmap.status))).sort();

    return [
      { value: "", label: "All" },
      ...unique.map((value) => ({ value, label: readable(value) })),
    ];
  }, [all]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return all
      .filter((roadmap) => !status || roadmap.status === status)
      .filter(
        (roadmap) =>
          !normalized ||
          [roadmap.title, roadmap.roadmapNumber, roadmap.sourceScenarioNumber]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [all, query, status]);

  const loaded = dashboard !== null;
  const initialLoad = dashboard === null && error === null;
  const hasFilters = query.trim() !== "" || status !== "";

  function clearFilters() {
    setQuery("");
    setStatus("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-strategy-roadmaps-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Roadmap number",
        "Title",
        "Fiscal year",
        "Status",
        "Source scenario",
        "Scenario delta",
        "Initiatives",
        "Completed initiatives",
        "Blocked initiatives",
        "Overdue milestones",
        "Rejected gates",
        "Readiness score",
        "Readiness health",
      ],
      rows.map((roadmap) => [
        roadmap.roadmapNumber,
        roadmap.title,
        roadmap.fiscalYear,
        roadmap.status,
        roadmap.sourceScenarioNumber,
        roadmap.scenarioDelta,
        roadmap.initiativeCount,
        roadmap.completedInitiativeCount,
        roadmap.blockedInitiativeCount,
        roadmap.overdueMilestoneCount,
        roadmap.rejectedGateCount,
        roadmap.readinessScore.toFixed(1),
        roadmap.readinessHealth,
      ]),
    );

    toast.success(
      "Roadmaps exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const stats: StatItem[] = [
    { label: "Roadmaps", value: loaded ? integer.format(all.length) : "—" },
    { label: "Active", value: loaded ? integer.format(totals.active) : "—" },
    {
      label: "Blocked initiatives",
      value: loaded ? integer.format(totals.blocked) : "—",
      tone: totals.blocked > 0 ? "danger" : "default",
    },
    {
      label: "Overdue milestones",
      value: loaded ? integer.format(totals.overdue) : "—",
      tone: totals.overdue > 0 ? "danger" : "default",
    },
    {
      label: "Rejected gates",
      value: loaded ? integer.format(totals.rejected) : "—",
      tone: totals.rejected > 0 ? "danger" : "default",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No roadmaps match these filters"
      description="Try a different search term or status, or clear the filters."
      action={
        <button
          type="button"
          className="button button--secondary"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      }
    />
  ) : (
    <EmptyState
      icon={Goal}
      title="No strategy roadmaps yet"
      description="Turn an approved planning scenario into a governed initiative roadmap."
      action={
        <Link href="/strategy-roadmaps/new" className="button button--primary">
          <Plus size={16} />
          New roadmap
        </Link>
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Scenario-to-execution planning</span>

          <h1>Strategy roadmaps</h1>

          <p>
            Convert an approved Step 51 planning scenario into a governed initiative
            roadmap with owners, dependencies, milestones, gates and immutable
            readiness evidence.
          </p>
        </div>

        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>

          <Link href="/strategy-roadmaps/new" className="button button--primary">
            <Plus size={15} />
            New roadmap
          </Link>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      <StatStrip items={stats} loading={initialLoad} />

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search roadmap, number or scenario"
          ariaLabel="Search roadmaps"
          shortcut
        />

        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          options={statusOptions}
        />
      </div>

      {error && dashboard === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(roadmap) => roadmap.id}
          ariaLabel="Strategy roadmaps"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="strategy-roadmaps"
          resetKey={`${query}|${status}`}
        />
      )}

      <section className="roadmap-method-note">
        <Goal size={18} />

        <div>
          <strong>Roadmaps remain a governed planning layer</strong>

          <p>
            Roadmap initiatives do not automatically create sourcing, supplier,
            benefit, capacity, OKR or other operational records. They coordinate the
            approved scenario&apos;s proposed implementation only.
          </p>
        </div>
      </section>
    </div>
  );
}
