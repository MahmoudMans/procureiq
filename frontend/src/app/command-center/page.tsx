"use client";

import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Download,
  FileWarning,
  Gauge,
  type LucideIcon,
  PackageSearch,
  PanelsTopLeft,
  RefreshCw,
  SearchX,
  ShieldAlert,
  TimerReset,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";

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
  Skeleton,
  StatusBadge,
  downloadCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  readable,
  useToast,
} from "@/components/kit";
import { getProcurementCommandCenter } from "@/lib/api";
import type {
  CommandCenter,
  CommandCenterAction,
  CommandCenterActionType,
} from "@/types/command-center";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const SEVERITY_RANK: Record<string, number> = {
  INFO: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const WORKSTREAMS: string[] = [
  "PENDING_REQUEST",
  "RFQ_DEADLINE",
  "OVERDUE_PURCHASE_ORDER",
  "CONTRACT_EXPIRY",
  "COMPLIANCE_EXPIRY",
  "PROCUREMENT_RISK",
  "BUDGET_EXCEPTION",
  "PLANNING_DEMAND",
  "SAVINGS_VALIDATION",
  "SAVINGS_REALIZATION",
];

const HORIZON_OPTIONS: SelectOption[] = [30, 60, 90, 180].map((days) => ({
  value: String(days),
  label: `${days} days`,
}));

const CURRENCY_OPTIONS: SelectOption[] = ["EUR", "USD", "GBP", "TND"].map((code) => ({
  value: code,
  label: code,
}));

const SEVERITY_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "INFO", label: "Informational" },
];

const EMPTY_ACTIONS: CommandCenterAction[] = [];
const integer = new Intl.NumberFormat("en-US");

interface CommandData {
  key: string;
  dashboard: CommandCenter;
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

interface ActionTypeIconProps {
  type: CommandCenterActionType;
  size: number;
}

function ActionTypeIcon({ type, size }: ActionTypeIconProps) {
  switch (type) {
    case "PENDING_REQUEST":
      return <ClipboardCheck size={size} />;

    case "RFQ_DEADLINE":
      return <TimerReset size={size} />;

    case "OVERDUE_PURCHASE_ORDER":
      return <PackageSearch size={size} />;

    case "CONTRACT_EXPIRY":
    case "COMPLIANCE_EXPIRY":
      return <FileWarning size={size} />;

    case "PROCUREMENT_RISK":
      return <ShieldAlert size={size} />;

    case "BUDGET_EXCEPTION":
      return <WalletCards size={size} />;

    case "PLANNING_DEMAND":
      return <CalendarClock size={size} />;

    case "SAVINGS_VALIDATION":
    case "SAVINGS_REALIZATION":
      return <BadgeDollarSign size={size} />;
  }
}

/* ------------------------------------------------------------------ */
/* Queue columns                                                       */
/* ------------------------------------------------------------------ */

const COLUMNS: Column<CommandCenterAction>[] = [
  {
    id: "priority",
    header: "Priority",
    sortValue: (action) =>
      (SEVERITY_RANK[action.severity] ?? -1) * 2 + (action.overdue ? 1 : 0),
    firstSort: "desc",
    cell: (action) => <StatusBadge value={action.severity} />,
  },
  {
    id: "action",
    header: "Action",
    sortValue: (action) => action.title.toLowerCase(),
    cell: (action) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={action.href} className="supplier-360-link">
            {action.title}
          </Link>
        </strong>

        <span className="kit-clamp" title={action.description}>
          {action.description}
        </span>
      </div>
    ),
  },
  {
    id: "workstream",
    header: "Workstream",
    sortValue: (action) => action.type,
    cell: (action) => (
      <span className="kit-inline-icon">
        <ActionTypeIcon type={action.type} size={15} />
        {readable(action.type)}
      </span>
    ),
  },
  {
    id: "reference",
    header: "Reference",
    sortValue: (action) => (action.reference ?? "").toLowerCase(),
    cell: (action) => action.reference ?? <span className="kit-text-muted">—</span>,
  },
  {
    id: "due",
    header: "Due",
    sortValue: (action) => action.dueDate ?? null,
    cell: (action) =>
      action.dueDate ? (
        <div className="kit-cell-stack">
          <span>{formatDate(action.dueDate)}</span>

          {action.overdue ? <small className="kit-cell-flag">Overdue</small> : null}
        </div>
      ) : (
        <span className="kit-text-muted">—</span>
      ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "right",
    sortValue: (action) => action.amount ?? null,
    firstSort: "desc",
    cell: (action) =>
      action.amount !== null ? (
        <span className="kit-num">
          {action.currency
            ? formatMoney(action.amount, action.currency)
            : integer.format(action.amount)}
        </span>
      ) : (
        <span className="kit-text-muted">—</span>
      ),
  },
  {
    id: "owner",
    header: "Owner",
    sortValue: (action) => (action.ownerName ?? "").toLowerCase(),
    cell: (action) => action.ownerName ?? <span className="kit-text-muted">—</span>,
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (action) => (
      <Link href={action.href} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

interface DomainMetricProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
}

function DomainMetric({ icon: Icon, label, value }: DomainMetricProps) {
  return (
    <article className="command-center-domain-card">
      <div>
        <Icon size={17} />
      </div>

      <span>{label}</span>

      <strong>{value}</strong>
    </article>
  );
}

function ActionMiniCard({ action }: { action: CommandCenterAction }) {
  return (
    <Link
      href={action.href}
      className={`command-center-mini-action command-center-mini-action--${action.severity.toLowerCase()}`}
    >
      <div>
        <ActionTypeIcon type={action.type} size={16} />
      </div>

      <section>
        <strong>{action.title}</strong>

        <span>{action.reference ?? readable(action.type)}</span>
      </section>

      <StatusBadge value={action.severity} />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CommandCenterPage() {
  const toast = useToast();

  const [horizon, setHorizon] = useState("60");
  const [currency, setCurrency] = useState("EUR");
  const [result, setResult] = useState<CommandData | null>(null);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("");
  const [workstream, setWorkstream] = useState("");
  const [scope, setScope] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getProcurementCommandCenter(Number(horizon), currency);

        if (active) {
          setResult({ key: `${horizon}|${currency}`, dashboard: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load procurement command center.",
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
  }, [horizon, currency, reloadKey]);

  // Figures are only shown once they belong to the selected horizon and currency.
  const data =
    result !== null && result.key === `${horizon}|${currency}` ? result.dashboard : null;

  const actions = data?.actions ?? EMPTY_ACTIONS;
  const summary = data?.summary ?? null;
  const pending = data === null && error === null;

  const breakdown = useMemo(
    () => [...(data?.breakdown ?? [])].sort((a, b) => b.total - a.total),
    [data],
  );

  const urgent = useMemo(
    () =>
      actions
        .filter((action) => action.severity === "CRITICAL" || action.severity === "HIGH")
        .slice(0, 6),
    [actions],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const action of actions) {
      counts[action.type] = (counts[action.type] ?? 0) + 1;
    }

    return counts;
  }, [actions]);

  const overdueCount = useMemo(
    () => actions.filter((action) => action.overdue).length,
    [actions],
  );

  const workstreamOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All" },
      ...WORKSTREAMS.map((type) => ({
        value: type,
        label: data ? `${readable(type)} · ${typeCounts[type] ?? 0}` : readable(type),
      })),
    ],
    [data, typeCounts],
  );

  const scopeOptions: SegmentedOption[] = [
    { value: "", label: "All" },
    {
      value: "OVERDUE",
      label: data && overdueCount > 0 ? `Overdue · ${overdueCount}` : "Overdue",
    },
  ];

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return actions
      .filter((action) => !severity || action.severity === severity)
      .filter((action) => !workstream || action.type === workstream)
      .filter((action) => scope !== "OVERDUE" || action.overdue)
      .filter(
        (action) =>
          !normalized ||
          [action.title, action.description, action.reference ?? "", action.ownerName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [actions, query, severity, workstream, scope]);

  const chips: FilterChip[] = [];

  if (query.trim()) {
    chips.push({
      key: "query",
      label: `Search: “${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  if (severity) {
    chips.push({
      key: "severity",
      label: `Priority: ${readable(severity)}`,
      onRemove: () => setSeverity(""),
    });
  }

  if (workstream) {
    chips.push({
      key: "workstream",
      label: `Workstream: ${readable(workstream)}`,
      onRemove: () => setWorkstream(""),
    });
  }

  const hasFilters = chips.length > 0 || scope !== "";

  function clearFilters() {
    setQuery("");
    setSeverity("");
    setWorkstream("");
    setScope("");
  }

  function pickWorkstream(type: string) {
    const next = workstream === type ? "" : type;

    setWorkstream(next);

    if (next) {
      document
        .getElementById("command-queue")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleTileKey(event: KeyboardEvent<HTMLElement>, type: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pickWorkstream(type);
    }
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-command-center-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Priority",
        "Workstream",
        "Title",
        "Description",
        "Reference",
        "Due date",
        "Overdue",
        "Currency",
        "Amount",
        "Owner",
      ],
      rows.map((action) => [
        action.severity,
        action.type,
        action.title,
        action.description,
        action.reference ?? "",
        action.dueDate ?? "",
        action.overdue ? "Yes" : "No",
        action.currency ?? "",
        action.amount,
        action.ownerName ?? "",
      ]),
    );

    toast.success(
      "Actions exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const overdueActions = summary?.overdueActions ?? 0;
  const criticalRisks = summary?.criticalRisks ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Open actions",
      icon: PanelsTopLeft,
      value: summary ? integer.format(summary.totalActions) : "—",
      note: `${summary?.criticalActions ?? 0} critical · ${summary?.highActions ?? 0} high`,
    },
    {
      label: "Overdue",
      icon: AlertTriangle,
      value: summary ? integer.format(overdueActions) : "—",
      note: "Actions already past their operational due date.",
      tone: overdueActions > 0 ? "warning" : "default",
    },
    {
      label: "Critical risks",
      icon: ShieldAlert,
      value: summary ? integer.format(criticalRisks) : "—",
      note: `${summary?.budgetExceptions ?? 0} budget exceptions`,
      tone: criticalRisks > 0 ? "warning" : "default",
    },
    {
      label: "Realized savings",
      icon: BadgeDollarSign,
      value: summary ? formatMoney(summary.realizedSavings, summary.currency, true) : "—",
      note: `${summary?.savingsActions ?? 0} savings actions remain`,
    },
  ];

  const domains: DomainMetricProps[] = [
    { icon: ClipboardCheck, label: "Approvals", value: summary?.pendingRequests ?? 0 },
    { icon: TimerReset, label: "RFQ deadlines", value: summary?.rfqDeadlines ?? 0 },
    {
      icon: PackageSearch,
      label: "Overdue POs",
      value: summary?.overduePurchaseOrders ?? 0,
    },
    {
      icon: FileWarning,
      label: "Contract / compliance",
      value: summary?.contractComplianceIssues ?? 0,
    },
    { icon: WalletCards, label: "Budget exceptions", value: summary?.budgetExceptions ?? 0 },
    { icon: CalendarClock, label: "Upcoming demand", value: summary?.upcomingDemand ?? 0 },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No actions match these filters"
      description="Try a different search term or workstream, or clear the filters."
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
      icon={CheckCircle2}
      title="No operational actions"
      description="Nothing needs attention inside the selected horizon."
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procurement operations</span>

          <h1>Command center</h1>

          <p>
            One prioritized operational cockpit for approvals, sourcing deadlines,
            deliveries, contracts, compliance, risk, budgets, planned demand and
            savings.
          </p>

          <span className="kit-meta-line">
            <Clock3 size={13} />
            Last generated {data ? formatDateTime(data.generatedAt) : "—"}
          </span>
        </div>

        <div className="page-heading__actions">
          <SelectField
            label="Action horizon"
            value={horizon}
            onChange={setHorizon}
            options={HORIZON_OPTIONS}
          />

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

      {error && data === null ? null : (
        <>
          <KpiGrid items={kpis} loading={pending} ariaLabel="Command center totals" />

          <section className="command-center-domain-grid">
            {domains.map((domain) => (
              <DomainMetric
                key={domain.label}
                icon={domain.icon}
                label={domain.label}
                value={summary ? domain.value : "—"}
              />
            ))}
          </section>

          <section className="command-center-main-grid">
            <section className="panel command-center-breakdown-panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">Operations map</span>

                  <h2>Action distribution</h2>
                </div>

                <Gauge size={19} />
              </div>

              <div className="command-center-breakdown">
                {pending ? (
                  <>
                    <Skeleton height={52} />
                    <Skeleton height={52} />
                    <Skeleton height={52} />
                  </>
                ) : null}

                {data
                  ? breakdown.map((item) => (
                      <article
                        key={item.type}
                        className="kit-clickable"
                        role="button"
                        tabIndex={0}
                        aria-pressed={workstream === item.type}
                        title="Filter the action queue by this workstream"
                        onClick={() => pickWorkstream(item.type)}
                        onKeyDown={(event) => handleTileKey(event, item.type)}
                      >
                        <div className="command-center-breakdown-icon">
                          <ActionTypeIcon type={item.type} size={17} />
                        </div>

                        <div>
                          <strong>{readable(item.type)}</strong>

                          <span>
                            {item.critical} critical · {item.high} high · {item.overdue}{" "}
                            overdue
                          </span>
                        </div>

                        <strong>{item.total}</strong>
                      </article>
                    ))
                  : null}

                {data && breakdown.length === 0 ? (
                  <EmptyState
                    compact
                    icon={CheckCircle2}
                    title="No open actions"
                    description="Nothing is waiting inside this horizon."
                  />
                ) : null}
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">Priority pulse</span>

                  <h2>Immediate attention</h2>
                </div>

                <AlertTriangle size={19} />
              </div>

              <div className="command-center-priority-list">
                {pending ? (
                  <>
                    <Skeleton height={56} />
                    <Skeleton height={56} />
                    <Skeleton height={56} />
                  </>
                ) : null}

                {data
                  ? urgent.map((action) => (
                      <ActionMiniCard key={`${action.type}-${action.id}`} action={action} />
                    ))
                  : null}

                {data && urgent.length === 0 ? (
                  <EmptyState
                    compact
                    icon={CheckCircle2}
                    title="Nothing urgent"
                    description="No critical or high-priority actions."
                  />
                ) : null}
              </div>
            </section>
          </section>

          <section id="command-queue" className="page-stack" style={{ scrollMarginTop: 80 }}>
            <div>
              <span className="eyebrow">Prioritized execution</span>

              <h2>Operational action queue</h2>
            </div>

            <div className="kit-filters">
              <div className="kit-toolbar">
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Search action, reference or owner"
                  ariaLabel="Search actions"
                  shortcut
                />

                <SelectField
                  label="Priority"
                  value={severity}
                  onChange={setSeverity}
                  options={SEVERITY_OPTIONS}
                />

                <SelectField
                  label="Workstream"
                  value={workstream}
                  onChange={setWorkstream}
                  options={workstreamOptions}
                />

                <SegmentedFilter
                  options={scopeOptions}
                  value={scope}
                  onChange={setScope}
                  ariaLabel="Filter by due state"
                />
              </div>

              <FilterChips chips={chips} onClearAll={clearFilters} />
            </div>

            <DataTable
              columns={COLUMNS}
              rows={rows}
              getRowId={(action) => `${action.type}-${action.id}`}
              ariaLabel="Operational action queue"
              loading={pending}
              busy={fetching}
              empty={emptyNode}
              defaultSort={{ id: "priority", dir: "desc" }}
              persistKey="command-center"
              resetKey={`${query}|${severity}|${workstream}|${scope}|${horizon}|${currency}`}
            />
          </section>
        </>
      )}
    </div>
  );
}
