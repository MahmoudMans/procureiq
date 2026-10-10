"use client";

import {
  CircleAlert,
  Coins,
  Download,
  Handshake,
  Plus,
  RefreshCw,
  SearchX,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  StatusBadge,
  downloadCsv,
  formatMoney,
  useToast,
} from "@/components/kit";
import { getNegotiationSummary, getNegotiationWorkspaces } from "@/lib/api";
import type {
  NegotiationSummary,
  NegotiationWorkspace,
} from "@/types/negotiation";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const MANAGER_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const STATUS_FILTERS: SegmentedOption[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "AGREED", label: "Agreed" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const EMPTY_WORKSPACES: NegotiationWorkspace[] = [];
const integer = new Intl.NumberFormat("en-US");

/** Summary figures carry no currency, so they are shown as plain numbers. */
function plainNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function savingsPercent(workspace: NegotiationWorkspace): number | null {
  return workspace.baselineValue > 0
    ? (workspace.agreedSavings / workspace.baselineValue) * 100
    : null;
}

const COLUMNS: Column<NegotiationWorkspace>[] = [
  {
    id: "negotiation",
    header: "Negotiation",
    sortValue: (workspace) => workspace.negotiationNumber,
    cell: (workspace) => (
      <div className="request-primary-cell">
        <strong>
          <Link
            href={`/negotiations/${workspace.id}`}
            className="supplier-360-link"
          >
            {workspace.negotiationNumber}
          </Link>
        </strong>

        <span>Owner: {workspace.ownerName}</span>
      </div>
    ),
  },
  {
    id: "rfq",
    header: "RFQ",
    sortValue: (workspace) => workspace.rfqNumber,
    cell: (workspace) => (
      <div className="request-primary-cell">
        <strong>{workspace.rfqNumber}</strong>
        <span>{workspace.rfqTitle}</span>
      </div>
    ),
  },
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (workspace) => workspace.supplierName.toLowerCase(),
    cell: (workspace) => workspace.supplierName,
  },
  {
    id: "baseline",
    header: "Baseline",
    align: "right",
    sortValue: (workspace) => workspace.baselineValue,
    firstSort: "desc",
    cell: (workspace) => (
      <span className="kit-num">
        {formatMoney(workspace.baselineValue, workspace.currency)}
      </span>
    ),
  },
  {
    id: "target",
    header: "Target",
    align: "right",
    sortValue: (workspace) => workspace.targetValue,
    firstSort: "desc",
    cell: (workspace) =>
      workspace.targetValue !== null ? (
        <span className="kit-num">
          {formatMoney(workspace.targetValue, workspace.currency)}
        </span>
      ) : (
        "—"
      ),
  },
  {
    id: "agreed",
    header: "Agreed",
    align: "right",
    sortValue: (workspace) => workspace.agreedValue,
    firstSort: "desc",
    cell: (workspace) =>
      workspace.agreedValue !== null ? (
        <span className="kit-num">
          {formatMoney(workspace.agreedValue, workspace.currency)}
        </span>
      ) : (
        "—"
      ),
  },
  {
    id: "savings",
    header: "Savings",
    align: "right",
    sortValue: (workspace) =>
      workspace.agreedValue === null ? null : workspace.agreedSavings,
    firstSort: "desc",
    cell: (workspace) => {
      if (workspace.agreedValue === null) {
        return "—";
      }

      const percent = savingsPercent(workspace);

      return (
        <div className="kit-cell-stack">
          <strong className="kit-num kit-text-success">
            {formatMoney(workspace.agreedSavings, workspace.currency)}
          </strong>

          {percent !== null ? <small>{percent.toFixed(1)}% off baseline</small> : null}
        </div>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    sortValue: (workspace) => workspace.status,
    cell: (workspace) => (
      <StatusBadge
        value={workspace.status}
        tone={workspace.status === "ACTIVE" ? "info" : undefined}
      />
    ),
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (workspace) => (
      <Link href={`/negotiations/${workspace.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function NegotiationsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGER_ROLES.includes(user.role);

  const [workspaces, setWorkspaces] = useState<NegotiationWorkspace[] | null>(null);
  const [summary, setSummary] = useState<NegotiationSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
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
      setSummaryFailed(false);

      const [workspaceResult, summaryResult] = await Promise.allSettled([
        getNegotiationWorkspaces(),
        getNegotiationSummary(),
      ]);

      if (!active) {
        return;
      }

      if (workspaceResult.status === "fulfilled") {
        setWorkspaces(workspaceResult.value);
      } else {
        setError(
          workspaceResult.reason instanceof Error
            ? workspaceResult.reason.message
            : "Unable to load negotiation intelligence.",
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummaryFailed(true);
      }

      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (workspaces ?? EMPTY_WORKSPACES)
      .filter((workspace) => !status || workspace.status === status)
      .filter(
        (workspace) =>
          !normalized ||
          [
            workspace.negotiationNumber,
            workspace.rfqNumber,
            workspace.rfqTitle,
            workspace.supplierName,
            workspace.ownerName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [workspaces, query, status]);

  const initialLoad = workspaces === null && error === null;
  const hasFilters = query.trim() !== "" || status !== "";

  function clearFilters() {
    setQuery("");
    setStatus("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-negotiations-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Negotiation number",
        "RFQ number",
        "RFQ title",
        "Supplier",
        "Owner",
        "Currency",
        "Baseline",
        "Target",
        "Agreed",
        "Agreed savings",
        "Savings % of baseline",
        "Status",
      ],
      rows.map((workspace) => [
        workspace.negotiationNumber,
        workspace.rfqNumber,
        workspace.rfqTitle,
        workspace.supplierName,
        workspace.ownerName,
        workspace.currency,
        workspace.baselineValue,
        workspace.targetValue,
        workspace.agreedValue,
        workspace.agreedValue === null ? null : workspace.agreedSavings,
        workspace.agreedValue === null
          ? null
          : (savingsPercent(workspace)?.toFixed(1) ?? null),
        workspace.status,
      ]),
    );

    toast.success(
      "Negotiations exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const kpis: KpiItem[] = [
    {
      label: "Active negotiations",
      icon: Handshake,
      value: summary ? integer.format(summary.activeWorkspaces) : "—",
      note: `${integer.format(summary?.draftWorkspaces ?? 0)} draft · ${integer.format(
        summary?.agreedWorkspaces ?? 0,
      )} agreed`,
    },
    {
      label: "Suppliers engaged",
      icon: Users,
      value: summary ? integer.format(summary.suppliersInNegotiation) : "—",
      note: "Active supplier negotiation coverage.",
    },
    {
      label: "Target opportunity",
      icon: Target,
      value: summary ? plainNumber(summary.targetSavingsOpportunity) : "—",
      note: "Negotiation target savings across workspaces.",
    },
    {
      label: "Agreed savings",
      icon: Coins,
      value: summary ? plainNumber(summary.agreedSavings) : "—",
      note: `${(summary?.averageAgreedSavingsPct ?? 0).toFixed(1)}% average negotiated reduction`,
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No negotiations match these filters"
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
      icon={Handshake}
      title="No negotiations yet"
      description="Create a negotiation workspace to model targets, compare supplier scenarios and capture rounds before award."
      action={
        canManage ? (
          <Link href="/negotiations/new" className="button button--primary">
            <Plus size={16} />
            New negotiation
          </Link>
        ) : undefined
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Strategic sourcing</span>

          <h1>Negotiations</h1>

          <p>
            Model commercial targets, define walk-away positions, compare supplier
            scenarios and capture negotiation rounds before final award.
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

          {canManage ? (
            <Link href="/negotiations/new" className="button button--primary">
              <Plus size={16} />
              New negotiation
            </Link>
          ) : null}
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Negotiation totals"
      />

      {summary ? (
        <section className="negotiation-pipeline-banner">
          <div>
            <TrendingDown size={18} />

            <div>
              <span>Negotiable baseline pipeline</span>

              <strong>{plainNumber(summary.baselinePipelineValue)}</strong>
            </div>
          </div>

          <p>
            Submitted quotation value currently in draft or active negotiation
            workspaces.
          </p>
        </section>
      ) : null}

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search negotiation, RFQ, supplier or owner"
          ariaLabel="Search negotiations"
          shortcut
        />

        <SegmentedFilter
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by status"
        />
      </div>

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

      {error && workspaces === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(workspace) => workspace.id}
          ariaLabel="Negotiation workspaces"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="negotiations"
          resetKey={`${query}|${status}`}
        />
      )}
    </div>
  );
}
