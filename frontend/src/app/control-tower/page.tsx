"use client";

import {
  Activity,
  BadgeCheck,
  CircleAlert,
  Clock3,
  Coins,
  Download,
  RefreshCcw,
  RefreshCw,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  type FilterChip,
  FilterChips,
  KpiGrid,
  type KpiItem,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  SelectField,
  type SelectOption,
  type StatItem,
  StatStrip,
  StatusBadge,
  downloadCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  readable,
  timeOf,
  useToast,
} from "@/components/kit";
import { getControlTowerDashboard, scanControlTower } from "@/lib/api";
import type { ControlTowerDashboard } from "@/types/control-tower";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

type Item = ControlTowerDashboard["items"][number];

const SCAN_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const SEVERITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

const CURRENCY_OPTIONS: SelectOption[] = ["EUR", "USD", "GBP", "TND"].map((code) => ({
  value: code,
  label: code,
}));

const TYPE_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "SUPPLIER_RISK_ALERT", label: "Supplier risk alert" },
  { value: "RISK_ESCALATION_OVERDUE", label: "Risk escalation overdue" },
  { value: "DOCUMENT_COMPLIANCE_GAP", label: "Document compliance gap" },
  { value: "SOURCING_INITIATIVE_OVERDUE", label: "Sourcing initiative overdue" },
  { value: "BENEFIT_VALIDATION_PENDING", label: "Benefit validation pending" },
  { value: "BENEFIT_LEAKAGE", label: "Benefit leakage" },
  { value: "COMMERCIAL_LEAKAGE", label: "Commercial leakage" },
  { value: "GOVERNANCE_DECISION_OVERDUE", label: "Governance decision overdue" },
  { value: "GOVERNANCE_ACTION_OVERDUE", label: "Governance action overdue" },
];

const SEVERITY_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
];

const EMPTY_ITEMS: Item[] = [];
const integer = new Intl.NumberFormat("en-US");

interface TowerData {
  currency: string;
  dashboard: ControlTowerDashboard;
}

const COLUMNS: Column<Item>[] = [
  {
    id: "priority",
    header: "Priority",
    sortValue: (item) => item.priorityScore,
    firstSort: "desc",
    cell: (item) => (
      <strong className={`kit-num${item.priorityScore >= 80 ? " kit-text-danger" : ""}`}>
        {item.priorityScore.toFixed(0)}
      </strong>
    ),
  },
  {
    id: "exception",
    header: "Exception",
    sortValue: (item) => item.title.toLowerCase(),
    cell: (item) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/control-tower/${item.id}`} className="supplier-360-link">
            {item.title}
          </Link>
        </strong>

        <span>
          {item.sourceReference} · {item.ageDays}d in queue
        </span>
      </div>
    ),
  },
  {
    id: "severity",
    header: "Severity",
    sortValue: (item) => SEVERITY_RANK[item.severity] ?? -1,
    firstSort: "desc",
    cell: (item) => <StatusBadge value={item.severity} />,
  },
  {
    id: "type",
    header: "Type",
    sortValue: (item) => item.exceptionType,
    cell: (item) => readable(item.exceptionType),
  },
  {
    id: "exposure",
    header: "Exposure",
    align: "right",
    sortValue: (item) => item.monetaryExposure,
    firstSort: "desc",
    cell: (item) =>
      item.monetaryExposure > 0 ? (
        <strong className="kit-num">{formatMoney(item.monetaryExposure, item.currency)}</strong>
      ) : (
        <span className="kit-text-muted">—</span>
      ),
  },
  {
    id: "sla",
    header: "SLA due",
    sortValue: (item) => timeOf(item.slaDueAt),
    cell: (item) => (
      <div className="kit-cell-stack">
        <span>{formatDate(item.slaDueAt)}</span>

        {item.slaOverdue ? <small className="kit-cell-flag">SLA overdue</small> : null}
      </div>
    ),
  },
  {
    id: "owner",
    header: "Owner",
    sortValue: (item) => (item.ownerName ?? "").toLowerCase(),
    cell: (item) =>
      item.ownerName ?? <span className="kit-text-muted">Unassigned</span>,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (item) => item.status,
    cell: (item) => <StatusBadge value={item.status} />,
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (item) => (
      <Link href={`/control-tower/${item.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ControlTowerPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canScan = user !== null && SCAN_ROLES.includes(user.role);

  const [currency, setCurrency] = useState("EUR");
  const [result, setResult] = useState<TowerData | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scope, setScope] = useState("");
  const [scanning, setScanning] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getControlTowerDashboard(currency);

        if (active) {
          setResult({ currency, dashboard: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load procurement control tower.",
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
  }, [currency, reloadKey]);

  // Figures are only shown once they belong to the selected currency.
  const dashboard = result !== null && result.currency === currency ? result.dashboard : null;
  const summary = dashboard?.summary ?? null;
  const items = dashboard?.items ?? EMPTY_ITEMS;
  const pending = dashboard === null && error === null;

  const overdueCount = useMemo(() => items.filter((item) => item.slaOverdue).length, [items]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items
      .filter((item) => !typeFilter || item.exceptionType === typeFilter)
      .filter((item) => !severityFilter || item.severity === severityFilter)
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter((item) => scope !== "OVERDUE" || item.slaOverdue)
      .filter(
        (item) =>
          !normalized ||
          [
            item.title,
            item.details,
            item.sourceReference,
            item.ownerName ?? "",
            item.exceptionType,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [items, query, typeFilter, severityFilter, statusFilter, scope]);

  const chips: FilterChip[] = [];

  if (query.trim()) {
    chips.push({
      key: "query",
      label: `Search: “${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  if (typeFilter) {
    chips.push({
      key: "type",
      label: `Type: ${readable(typeFilter)}`,
      onRemove: () => setTypeFilter(""),
    });
  }

  if (severityFilter) {
    chips.push({
      key: "severity",
      label: `Severity: ${readable(severityFilter)}`,
      onRemove: () => setSeverityFilter(""),
    });
  }

  if (statusFilter) {
    chips.push({
      key: "status",
      label: `Status: ${readable(statusFilter)}`,
      onRemove: () => setStatusFilter(""),
    });
  }

  const hasFilters = chips.length > 0 || scope !== "";

  const scopeOptions: SegmentedOption[] = [
    { value: "", label: "All" },
    {
      value: "OVERDUE",
      label: dashboard && overdueCount > 0 ? `SLA overdue · ${overdueCount}` : "SLA overdue",
    },
  ];

  function clearFilters() {
    setQuery("");
    setTypeFilter("");
    setSeverityFilter("");
    setStatusFilter("");
    setScope("");
  }

  async function scan() {
    setScanning(true);

    try {
      const outcome = await scanControlTower(currency);

      toast.success(
        "Scan complete",
        `${outcome.sourceExceptions} source exceptions · ${outcome.discoveredCount} discovered · ${outcome.refreshedCount} refreshed · ${outcome.autoResolvedCount} auto-resolved`,
      );

      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(
        "Could not run the scan",
        caught instanceof Error ? caught.message : "Unable to run control-tower scan.",
      );
    } finally {
      setScanning(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-control-tower-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Priority score",
        "Title",
        "Details",
        "Source reference",
        "Days in queue",
        "Severity",
        "Type",
        "Currency",
        "Monetary exposure",
        "SLA due",
        "SLA overdue",
        "Owner",
        "Status",
      ],
      rows.map((item) => [
        item.priorityScore.toFixed(0),
        item.title,
        item.details,
        item.sourceReference,
        item.ageDays,
        item.severity,
        item.exceptionType,
        item.currency,
        item.monetaryExposure,
        item.slaDueAt,
        item.slaOverdue ? "Yes" : "No",
        item.ownerName ?? "",
        item.status,
      ]),
    );

    toast.success(
      "Exceptions exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const slaOverdue = summary?.slaOverdueItems ?? 0;
  const unassigned = summary?.unassignedItems ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Active exceptions",
      icon: Activity,
      value: summary ? integer.format(summary.activeItems) : "—",
      note: "Management queue.",
    },
    {
      label: "Critical / high",
      icon: ShieldAlert,
      value: summary ? integer.format(summary.criticalItems + summary.highItems) : "—",
      note: `${summary?.criticalItems ?? 0} critical`,
      tone: (summary?.criticalItems ?? 0) > 0 ? "warning" : "default",
    },
    {
      label: "SLA overdue",
      icon: Clock3,
      value: summary ? integer.format(slaOverdue) : "—",
      note: "Requires immediate attention.",
      tone: slaOverdue > 0 ? "warning" : "default",
    },
    {
      label: "Active exposure",
      icon: Coins,
      value: summary ? formatMoney(summary.activeMonetaryExposure, currency, true) : "—",
      note: "Monetary exposure / value at stake.",
    },
  ];

  const stats: StatItem[] = [
    { label: "Supplier risk", value: summary ? integer.format(summary.supplierRiskItems) : "—" },
    { label: "Compliance", value: summary ? integer.format(summary.complianceItems) : "—" },
    { label: "Sourcing", value: summary ? integer.format(summary.sourcingItems) : "—" },
    {
      label: "Benefits / leakage",
      value: summary ? integer.format(summary.benefitsItems) : "—",
    },
    { label: "Governance", value: summary ? integer.format(summary.governanceItems) : "—" },
    {
      label: "Unassigned",
      value: summary ? integer.format(unassigned) : "—",
      tone: unassigned > 0 ? "danger" : "default",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No exceptions match these filters"
      description="Try a different search term, type or severity, or clear the filters."
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
      icon={ShieldCheck}
      title="No exceptions in the queue"
      description={
        canScan
          ? "Run a scan to look for new procurement exceptions."
          : "Nothing currently needs management attention."
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Management by exception</span>

          <h1>Procurement control tower</h1>

          <p>
            Consolidate material procurement exceptions into one explainable operating
            queue with priority, ownership, SLA and resolution governance.
          </p>
        </div>

        <div className="page-heading__actions">
          <SelectField
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
          />

          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Reload
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

          {canScan ? (
            <button
              type="button"
              className="button button--primary"
              disabled={scanning}
              onClick={() => void scan()}
            >
              <RefreshCcw size={15} className={scanning ? "kit-spin" : undefined} />
              {scanning ? "Scanning…" : "Run scan"}
            </button>
          ) : null}
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

      {error && dashboard === null ? null : (
        <>
          <KpiGrid items={kpis} loading={pending} ariaLabel="Control tower totals" />

          <StatStrip items={stats} loading={pending} />

          {dashboard?.latestRun ? (
            <section className="control-tower-last-run">
              <BadgeCheck size={15} />

              <span>
                Last scan: {formatDateTime(dashboard.latestRun.startedAt)} ·{" "}
                {dashboard.latestRun.discoveredCount} discovered ·{" "}
                {dashboard.latestRun.refreshedCount} refreshed ·{" "}
                {dashboard.latestRun.autoResolvedCount} auto-resolved
              </span>
            </section>
          ) : null}

          <div className="kit-filters">
            <div className="kit-toolbar">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search title, source, owner or details"
                ariaLabel="Search exceptions"
                shortcut
              />

              <SelectField
                label="Type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={TYPE_OPTIONS}
              />

              <SelectField
                label="Severity"
                value={severityFilter}
                onChange={setSeverityFilter}
                options={SEVERITY_OPTIONS}
              />

              <SelectField
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />

              <SegmentedFilter
                options={scopeOptions}
                value={scope}
                onChange={setScope}
                ariaLabel="Filter by SLA state"
              />
            </div>

            <FilterChips chips={chips} onClearAll={clearFilters} />
          </div>

          <DataTable
            columns={COLUMNS}
            rows={rows}
            getRowId={(item) => item.id}
            ariaLabel="Management exceptions"
            loading={pending}
            busy={fetching}
            empty={emptyNode}
            defaultSort={{ id: "priority", dir: "desc" }}
            persistKey="control-tower"
            resetKey={`${query}|${typeFilter}|${severityFilter}|${statusFilter}|${scope}|${currency}`}
          />

          <section className="control-tower-method-note">
            <UserRoundSearch size={18} />

            <div>
              <strong>Deterministic exception priority</strong>

              <p>
                Priority combines source severity, exception type, overdue urgency and
                monetary exposure. Stable exception keys prevent duplicate queue items.
                Rescans refresh active issues and automatically resolve queue items when
                the underlying source condition disappears.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
