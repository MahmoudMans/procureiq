"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock,
  Coins,
  Gauge,
  GaugeCircle,
  History,
  Hourglass,
  Info,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Timer,
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
  formatDate,
  formatDateTime,
  meterToneFor,
} from "@/components/kit";
import { getOperatingRhythmSnapshot } from "@/lib/api";
import type { OperatingRhythmSnapshotDetail } from "@/types/operating-rhythm";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type DomainRow = OperatingRhythmSnapshotDetail["domains"][number];
type OwnerRow = OperatingRhythmSnapshotDetail["owners"][number];
type ExceptionRow = OperatingRhythmSnapshotDetail["exceptionTypes"][number];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function byActive<T extends { activeCount: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.activeCount - a.activeCount);
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

interface DimensionMetrics {
  dimensionLabel: string;
  workloadSharePct: number;
  activeCount: number;
  slaOverdueCount: number;
  persistentCount: number;
  resolvedCount: number;
  slaAttainmentPct: number;
}

function buildDimensionColumns<T extends DimensionMetrics>(header: string): Column<T>[] {
  return [
    {
      id: "dimension",
      header,
      sortValue: (item) => item.dimensionLabel.toLowerCase(),
      cell: (item) => <strong>{item.dimensionLabel}</strong>,
    },
    {
      id: "active",
      header: "Active",
      align: "right",
      sortValue: (item) => item.activeCount,
      cell: (item) => item.activeCount,
    },
    {
      id: "share",
      header: "Workload share",
      align: "right",
      sortValue: (item) => item.workloadSharePct,
      cell: (item) => `${item.workloadSharePct.toFixed(1)}%`,
    },
    {
      id: "overdue",
      header: "SLA overdue",
      align: "right",
      sortValue: (item) => item.slaOverdueCount,
      cell: (item) =>
        item.slaOverdueCount > 0 ? (
          <strong className="kit-text-danger">{item.slaOverdueCount}</strong>
        ) : (
          item.slaOverdueCount
        ),
    },
    {
      id: "persistent",
      header: "Persistent",
      align: "right",
      sortValue: (item) => item.persistentCount,
      cell: (item) => item.persistentCount,
    },
    {
      id: "resolved",
      header: "Resolved",
      align: "right",
      sortValue: (item) => item.resolvedCount,
      cell: (item) => item.resolvedCount,
    },
    {
      id: "sla",
      header: "SLA attainment",
      align: "right",
      sortValue: (item) => (item.resolvedCount > 0 ? item.slaAttainmentPct : null),
      cell: (item) =>
        item.resolvedCount > 0 ? `${item.slaAttainmentPct.toFixed(1)}%` : "—",
    },
  ];
}

function buildExceptionColumns(currency: string): Column<ExceptionRow>[] {
  return [
    ...buildDimensionColumns<ExceptionRow>("Exception type"),
    {
      id: "exposure",
      header: "Exposure",
      align: "right",
      sortValue: (item) => item.activeExposure,
      cell: (item) => money(item.activeExposure, currency),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface SnapshotData {
  id: string;
  detail: OperatingRhythmSnapshotDetail;
}

export default function OperatingRhythmSnapshotPage() {
  const params = useParams<{ id: string }>();

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
        const response = await getOperatingRhythmSnapshot(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load operating-rhythm snapshot.",
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
        <Link href="/operating-rhythm" className="request-back-link">
          <ArrowLeft size={16} />
          Operating rhythm
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

  const { snapshot, metrics } = detail;
  const currency = snapshot.currency;
  const hasResolved = metrics.resolvedCount > 0;
  const hasBacklog = metrics.activeBacklogCount > 0;
  const overdue = metrics.slaOverdueCount > 0;
  const persistent = metrics.persistentExceptionCount > 0;
  const breached = overdue || persistent;
  const backlogRisk = metrics.criticalBacklogCount > 0 || metrics.unassignedCount > 0;

  const breachParts: string[] = [];

  if (overdue) {
    breachParts.push(
      `${plural(metrics.slaOverdueCount, "active exception was", "active exceptions were")} past SLA`,
    );
  }

  if (persistent) {
    breachParts.push(
      `${plural(metrics.persistentExceptionCount, "exception had", "exceptions had")} persisted for 7 days or more`,
    );
  }

  const riskParts: string[] = [];

  if (metrics.criticalBacklogCount > 0) {
    riskParts.push(
      `${plural(metrics.criticalBacklogCount, "critical exception is", "critical exceptions are")} in the backlog`,
    );
  }

  if (metrics.unassignedCount > 0) {
    riskParts.push(
      `${plural(metrics.unassignedCount, "exception has", "exceptions have")} no owner`,
    );
  }

  const domains = byActive(detail.domains);
  const owners = byActive(detail.owners);
  const exceptionTypes = [...detail.exceptionTypes].sort(
    (a, b) => b.activeExposure - a.activeExposure,
  );

  const kpis: KpiItem[] = [
    {
      label: "Active backlog",
      icon: Activity,
      value: String(metrics.activeBacklogCount),
      note: `Average age ${metrics.avgActiveAgeDays.toFixed(1)} days`,
    },
    {
      label: "SLA overdue",
      icon: Clock,
      value: String(metrics.slaOverdueCount),
      note: "Active and past SLA",
      tone: overdue ? "warning" : "default",
    },
    {
      label: "Persistent ≥7d",
      icon: Repeat,
      value: String(metrics.persistentExceptionCount),
      note: "Open for a week or more",
      tone: persistent ? "warning" : "default",
    },
    {
      label: "Resolved",
      icon: BadgeCheck,
      value: String(metrics.resolvedCount),
      note: "In this period",
    },
    {
      label: "SLA attainment",
      icon: Gauge,
      value: hasResolved ? `${metrics.slaAttainmentPct.toFixed(1)}%` : "—",
      note: hasResolved ? "Of resolved exceptions" : "Nothing resolved yet",
    },
    {
      label: "Active exposure",
      icon: Coins,
      value: money(metrics.activeMonetaryExposure, currency),
      note: "Monetary exposure in the backlog",
    },
  ];

  const secondaryKpis: KpiItem[] = [
    {
      label: "Critical backlog",
      icon: AlertTriangle,
      value: String(metrics.criticalBacklogCount),
      note: "Critical severity",
      tone: metrics.criticalBacklogCount > 0 ? "warning" : "default",
    },
    {
      label: "High backlog",
      icon: ShieldAlert,
      value: String(metrics.highBacklogCount),
      note: "High severity",
    },
    {
      label: "Unassigned",
      icon: UserX,
      value: String(metrics.unassignedCount),
      note: "No owner yet",
      tone: metrics.unassignedCount > 0 ? "warning" : "default",
    },
    {
      label: "On-time resolutions",
      icon: BadgeCheck,
      value: String(metrics.onTimeResolvedCount),
      note: "Resolved within SLA",
    },
    {
      label: "Late resolutions",
      icon: Clock,
      value: String(metrics.lateResolvedCount),
      note: "Resolved after SLA",
      tone: metrics.lateResolvedCount > 0 ? "warning" : "default",
    },
    {
      label: "Avg resolution",
      icon: Timer,
      value: `${metrics.avgResolutionHours.toFixed(1)}h`,
      note: "Time to resolve",
    },
    {
      label: "Avg backlog age",
      icon: Hourglass,
      value: `${metrics.avgActiveAgeDays.toFixed(1)}d`,
      note: "Age of active exceptions",
    },
  ];

  const domainColumns = buildDimensionColumns<DomainRow>("Domain");
  const ownerColumns = buildDimensionColumns<OwnerRow>("Owner");
  const exceptionColumns = buildExceptionColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/operating-rhythm" className="request-back-link">
        <ArrowLeft size={16} />
        Operating rhythm
      </Link>

      <section className="rhythm-detail-heading">
        <div>
          <span className="eyebrow">Immutable operating snapshot</span>

          <h1>{snapshot.snapshotNumber}</h1>

          <p>
            {formatDate(snapshot.periodStart)}
            {" → "}
            {formatDate(snapshot.periodEnd)}
            {" · "}
            {currency}
            {" · Captured by "}
            {snapshot.capturedByName}
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

          <div className="rhythm-captured-card">
            <span>Captured</span>

            <strong>{formatDateTime(snapshot.capturedAt)}</strong>
          </div>
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

      {breached ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Service levels were under pressure when this snapshot was captured.</strong>{" "}
            {breachParts.join(" and ")}.
          </div>
        </div>
      ) : (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No SLA breach at capture.</strong> No active exception was past SLA or
            persistent for 7 days or more.
          </div>
        </div>
      )}

      {backlogRisk ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Backlog risk.</strong> {riskParts.join(" and ")}.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Operating snapshot summary" />

      <KpiGrid items={secondaryKpis} ariaLabel="Backlog and resolution detail" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Service levels</span>

            <h2>SLA performance at capture</h2>
          </div>

          <Gauge size={19} />
        </div>

        {hasResolved ? (
          <ProgressLine
            pct={metrics.slaAttainmentPct}
            tone={metrics.lateResolvedCount === 0 ? meterToneFor("success") : "primary"}
            caption={`${metrics.onTimeResolvedCount} of ${metrics.resolvedCount} resolutions were on time (${metrics.slaAttainmentPct.toFixed(1)}%)`}
            label="On-time resolutions"
          />
        ) : (
          <p className="kit-meta-line">
            No exception was resolved in this period, so SLA attainment is not measured.
          </p>
        )}

        {hasBacklog ? (
          <ProgressLine
            pct={(metrics.slaOverdueCount / metrics.activeBacklogCount) * 100}
            tone="primary"
            caption={`${metrics.slaOverdueCount} of ${metrics.activeBacklogCount} active exceptions are past SLA`}
            label="Active exceptions past SLA"
          />
        ) : (
          <p className="kit-meta-line">There was no active backlog when this snapshot was captured.</p>
        )}
      </section>

      <section className="rhythm-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Bottlenecks</span>

              <h2>Domain scorecard</h2>
            </div>

            <GaugeCircle size={19} />
          </div>

          <DataTable
            columns={domainColumns}
            rows={domains}
            getRowId={(item) => String(item.dimensionKey)}
            ariaLabel="Domain scorecard"
            busy={fetching}
            empty={
              <EmptyState
                icon={GaugeCircle}
                title="No domains"
                description="No domain rows were captured in this snapshot."
              />
            }
          />
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Workload</span>

              <h2>Owner performance</h2>
            </div>

            <History size={19} />
          </div>

          <DataTable
            columns={ownerColumns}
            rows={owners}
            getRowId={(item) => String(item.dimensionKey)}
            ariaLabel="Owner performance"
            busy={fetching}
            empty={
              <EmptyState
                icon={History}
                title="No owners"
                description="No owner rows were captured in this snapshot."
              />
            }
          />
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Root-cause concentration</span>

            <h2>Exception-type performance</h2>
          </div>

          <Activity size={19} />
        </div>

        <DataTable
          columns={exceptionColumns}
          rows={exceptionTypes}
          getRowId={(item) => String(item.dimensionKey)}
          ariaLabel="Exception-type performance"
          busy={fetching}
          empty={
            <EmptyState
              icon={Activity}
              title="No exception types"
              description="No exception-type rows were captured in this snapshot."
            />
          }
        />
      </section>

      <section className="rhythm-method-note">
        <GaugeCircle size={18} />

        <div>
          <strong>Immutable operating record</strong>

          <p>
            Snapshot metrics and dimension rows cannot be updated or deleted after capture. This
            preserves an auditable historical view even as the live control-tower queue continues
            to change.
          </p>
        </div>
      </section>
    </div>
  );
}
