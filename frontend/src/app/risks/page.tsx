"use client";

import {
  AlertTriangle,
  CircleAlert,
  Download,
  Gauge,
  Plus,
  RefreshCw,
  SearchX,
  ShieldAlert,
  Siren,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  SelectField,
  type SelectOption,
  StatusBadge,
  downloadCsv,
  formatDate,
  readable,
  useToast,
} from "@/components/kit";
import {
  getRiskCases,
  getRiskSummary,
  refreshSystemRiskExceptions,
} from "@/lib/api";
import type {
  RiskCase,
  RiskCaseStatus,
  RiskCategory,
  RiskSeverity,
  RiskSummary,
} from "@/types/risk";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const MANAGER_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_MITIGATION", label: "In mitigation" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ACCEPTED", label: "Accepted" },
];

const SEVERITY_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "CONTRACT", label: "Contract" },
  { value: "PURCHASE_ORDER", label: "Purchase order" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "SOURCING", label: "Sourcing" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "OTHER", label: "Other" },
];

const SEVERITY_RANK: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const EMPTY_RISKS: RiskCase[] = [];
const integer = new Intl.NumberFormat("en-US");

const COLUMNS: Column<RiskCase>[] = [
  {
    id: "risk",
    header: "Risk",
    sortValue: (risk) => risk.riskNumber,
    cell: (risk) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/risks/${risk.id}`} className="supplier-360-link">
            {risk.riskNumber}
          </Link>
        </strong>

        <span>{risk.title}</span>
      </div>
    ),
  },
  {
    id: "context",
    header: "Context",
    sortValue: (risk) =>
      (
        risk.supplierName ??
        risk.purchaseOrderNumber ??
        risk.contractNumber ??
        risk.rfqNumber ??
        "General"
      ).toLowerCase(),
    cell: (risk) => (
      <div className="stacked-cell">
        <strong>
          {risk.supplierName ??
            risk.purchaseOrderNumber ??
            risk.contractNumber ??
            risk.rfqNumber ??
            "General"}
        </strong>

        <span>{risk.origin === "SYSTEM" ? "System detected" : "Manual"}</span>
      </div>
    ),
  },
  {
    id: "category",
    header: "Category",
    sortValue: (risk) => risk.category,
    cell: (risk) => readable(risk.category),
  },
  {
    id: "score",
    header: "Score",
    sortValue: (risk) => risk.riskScore,
    firstSort: "desc",
    cell: (risk) => (
      <span className={`kit-score kit-score--${risk.severity.toLowerCase()}`}>
        {risk.riskScore}/25
      </span>
    ),
  },
  {
    id: "severity",
    header: "Severity",
    sortValue: (risk) => SEVERITY_RANK[risk.severity] ?? -1,
    firstSort: "desc",
    cell: (risk) => <StatusBadge value={risk.severity} />,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (risk) => risk.status,
    cell: (risk) => <StatusBadge value={risk.status} />,
  },
  {
    id: "owner",
    header: "Owner",
    sortValue: (risk) => risk.ownerName.toLowerCase(),
    cell: (risk) => risk.ownerName,
  },
  {
    id: "due",
    header: "Due",
    sortValue: (risk) => risk.dueDate,
    cell: (risk) => (
      <div className="kit-cell-stack">
        <span>{risk.dueDate ? formatDate(risk.dueDate) : "—"}</span>

        {risk.overdue ? <small className="kit-cell-flag">Overdue</small> : null}
      </div>
    ),
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (risk) => (
      <Link href={`/risks/${risk.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function RiskRegisterPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGER_ROLES.includes(user.role);

  const [cases, setCases] = useState<RiskCase[] | null>(null);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [fetching, setFetching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Headline numbers do not depend on the filters, so they load separately.
  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const response = await getRiskSummary();

        if (active) {
          setSummary(response);
          setSummaryFailed(false);
        }
      } catch {
        if (active) {
          setSummaryFailed(true);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // The register: debounced, and re-run whenever a filter changes.
  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getRiskCases(
          query.trim() || undefined,
          (status as RiskCaseStatus) || undefined,
          (severity as RiskSeverity) || undefined,
          (category as RiskCategory) || undefined,
        );

        if (active) {
          setCases(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load procurement risks.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, status, severity, category, reloadKey]);

  const rows = cases ?? EMPTY_RISKS;
  const initialLoad = cases === null && error === null;

  const chips: FilterChip[] = [];

  if (query.trim()) {
    chips.push({
      key: "query",
      label: `Search: “${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  if (status) {
    chips.push({
      key: "status",
      label: `Status: ${readable(status)}`,
      onRemove: () => setStatus(""),
    });
  }

  if (severity) {
    chips.push({
      key: "severity",
      label: `Severity: ${readable(severity)}`,
      onRemove: () => setSeverity(""),
    });
  }

  if (category) {
    chips.push({
      key: "category",
      label: `Category: ${readable(category)}`,
      onRemove: () => setCategory(""),
    });
  }

  function clearFilters() {
    setQuery("");
    setStatus("");
    setSeverity("");
    setCategory("");
  }

  async function refreshExceptions() {
    setScanning(true);

    try {
      const result = await refreshSystemRiskExceptions();

      toast.success(
        "System exceptions refreshed",
        `${result.discoveredConditions} conditions checked · ${result.createdCases} created · ${result.reopenedCases} reopened · ${result.updatedCases} updated`,
      );

      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(
        "Could not refresh exceptions",
        caught instanceof Error ? caught.message : "Unable to refresh system exceptions.",
      );
    } finally {
      setScanning(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-risks-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Risk number",
        "Title",
        "Context",
        "Origin",
        "Category",
        "Score (of 25)",
        "Severity",
        "Status",
        "Owner",
        "Due date",
        "Overdue",
      ],
      rows.map((risk) => [
        risk.riskNumber,
        risk.title,
        risk.supplierName ??
          risk.purchaseOrderNumber ??
          risk.contractNumber ??
          risk.rfqNumber ??
          "General",
        risk.origin,
        risk.category,
        risk.riskScore,
        risk.severity,
        risk.status,
        risk.ownerName,
        risk.dueDate,
        risk.overdue ? "Yes" : "No",
      ]),
    );

    toast.success(
      "Risks exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const criticalCases = summary?.criticalCases ?? 0;
  const overdueCases = summary?.overdueCases ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Open risks",
      icon: ShieldAlert,
      value: summary ? integer.format(summary.openCases) : "—",
      note: `${integer.format(summary?.totalCases ?? 0)} total risk cases`,
    },
    {
      label: "Critical",
      icon: Siren,
      value: summary ? integer.format(criticalCases) : "—",
      note: `${integer.format(summary?.highCases ?? 0)} additional high risks`,
      tone: criticalCases > 0 ? "warning" : "default",
    },
    {
      label: "Overdue",
      icon: AlertTriangle,
      value: summary ? integer.format(overdueCases) : "—",
      note: "Risk actions past target resolution date.",
      tone: overdueCases > 0 ? "warning" : "default",
    },
    {
      label: "Average score",
      icon: Gauge,
      value: summary ? summary.averageOpenRiskScore.toFixed(1) : "—",
      note: "Average open exposure out of 25.",
    },
  ];

  const emptyNode =
    chips.length > 0 ? (
      <EmptyState
        icon={SearchX}
        title="No risks match these filters"
        description="Try a different search term, or clear the filters to see the whole register."
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
        icon={ShieldAlert}
        title="No risks recorded"
        description={
          canManage
            ? "Log a risk manually, or refresh system exceptions to detect procurement issues automatically."
            : "No procurement risks are currently recorded."
        }
        action={
          canManage ? (
            <Link href="/risks/new" className="button button--primary">
              <Plus size={16} />
              New risk
            </Link>
          ) : undefined
        }
      />
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procurement governance</span>

          <h1>Risk register</h1>

          <p>
            Centralize procurement exceptions, score exposure, assign ownership,
            track mitigation and control resolution.
          </p>
        </div>

        <div className="page-heading__actions">
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
            <>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void refreshExceptions()}
                disabled={scanning}
              >
                <RefreshCw size={15} className={scanning ? "kit-spin" : undefined} />
                {scanning ? "Refreshing…" : "Refresh exceptions"}
              </button>

              <Link href="/risks/new" className="button button--primary">
                <Plus size={16} />
                New risk
              </Link>
            </>
          ) : null}
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Risk totals"
      />

      <div className="kit-filters">
        <div className="kit-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search risk, supplier or description"
            ariaLabel="Search risks"
            shortcut
          />

          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />

          <SelectField
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_OPTIONS}
          />

          <SelectField
            label="Category"
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS}
          />
        </div>

        <FilterChips chips={chips} onClearAll={clearFilters} />
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

      {error && cases === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(risk) => risk.id}
          ariaLabel="Risk register"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          defaultSort={{ id: "score", dir: "desc" }}
          persistKey="risks"
          resetKey={`${query}|${status}|${severity}|${category}`}
        />
      )}
    </div>
  );
}
