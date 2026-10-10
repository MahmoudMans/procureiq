"use client";

import {
  AlertTriangle,
  Banknote,
  CircleAlert,
  Download,
  FileCheck2,
  Plus,
  RefreshCw,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  formatDate,
  formatMoney,
  useToast,
} from "@/components/kit";
import {
  getContractAlerts,
  getContracts,
  getContractSummary,
} from "@/lib/api";
import type {
  ContractAlert,
  ContractStatus,
  ContractSummary,
  SupplierContract,
} from "@/types/contract";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const MANAGER_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const ALERTS_COLLAPSED = 5;

const STATUS_FILTERS: SegmentedOption[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "TERMINATED", label: "Terminated" },
];

const EMPTY_CONTRACTS: SupplierContract[] = [];
const integer = new Intl.NumberFormat("en-US");

const COLUMNS: Column<SupplierContract>[] = [
  {
    id: "contract",
    header: "Contract",
    sortValue: (contract) => contract.contractNumber,
    cell: (contract) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/contracts/${contract.id}`} className="supplier-360-link">
            {contract.contractNumber}
          </Link>
        </strong>

        <span>{contract.title}</span>
      </div>
    ),
  },
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (contract) => contract.supplierName.toLowerCase(),
    cell: (contract) => (
      <Link
        href={`/suppliers/${contract.supplierId}`}
        className="contract-table-link"
      >
        {contract.supplierName}
      </Link>
    ),
  },
  {
    id: "type",
    header: "Type",
    sortValue: (contract) => String(contract.contractType).toLowerCase(),
    cell: (contract) => contract.contractType,
  },
  {
    id: "endDate",
    header: "End date",
    sortValue: (contract) => contract.endDate,
    cell: (contract) => (
      <div className="kit-cell-stack">
        <span>{formatDate(contract.endDate)}</span>

        {contract.expiringSoon ? (
          <small className="kit-cell-flag kit-cell-flag--warning">Expiring soon</small>
        ) : null}
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (contract) => contract.status,
    cell: (contract) => <StatusBadge value={contract.status} />,
  },
  {
    id: "value",
    header: "Value",
    align: "right",
    sortValue: (contract) => contract.contractValue,
    firstSort: "desc",
    cell: (contract) => (
      <strong className="kit-num">
        {formatMoney(contract.contractValue, contract.currency)}
      </strong>
    ),
  },
  {
    id: "owner",
    header: "Owner",
    sortValue: (contract) => contract.ownerName.toLowerCase(),
    cell: (contract) => contract.ownerName,
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (contract) => (
      <Link href={`/contracts/${contract.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ContractsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGER_ROLES.includes(user.role);

  const [contracts, setContracts] = useState<SupplierContract[] | null>(null);
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [alerts, setAlerts] = useState<ContractAlert[]>([]);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Headline numbers and governance alerts: loaded once, and again on Refresh.
  useEffect(() => {
    let active = true;

    async function loadOverview() {
      const [summaryResult, alertResult] = await Promise.allSettled([
        getContractSummary(),
        getContractAlerts(),
      ]);

      if (!active) {
        return;
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
        setSummaryFailed(false);
      } else {
        setSummaryFailed(true);
      }

      if (alertResult.status === "fulfilled") {
        setAlerts(alertResult.value);
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // The list: debounced, and re-run whenever a filter changes.
  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getContracts(
          query.trim() || undefined,
          (status as ContractStatus) || undefined,
        );

        if (active) {
          setContracts(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load contracts and compliance.",
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
  }, [query, status, reloadKey]);

  const rows = contracts ?? EMPTY_CONTRACTS;
  const initialLoad = contracts === null && error === null;
  const hasFilters = query.trim() !== "" || status !== "";

  function clearFilters() {
    setQuery("");
    setStatus("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-contracts-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Contract number",
        "Title",
        "Supplier",
        "Type",
        "End date",
        "Status",
        "Expiring soon",
        "Currency",
        "Value",
        "Owner",
      ],
      rows.map((contract) => [
        contract.contractNumber,
        contract.title,
        contract.supplierName,
        String(contract.contractType),
        contract.endDate,
        contract.status,
        contract.expiringSoon ? "Yes" : "No",
        contract.currency,
        contract.contractValue,
        contract.ownerName,
      ]),
    );

    toast.success(
      "Contracts exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const expiringSoon = summary?.expiringSoonContracts ?? 0;
  const complianceIssues = summary?.suppliersWithComplianceIssues ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Active contracts",
      icon: FileCheck2,
      value: summary ? integer.format(summary.activeContracts) : "—",
      note: `${integer.format(summary?.totalContracts ?? 0)} total contracts`,
    },
    {
      label: "Active value",
      icon: Banknote,
      value: summary ? formatMoney(summary.activeContractValue, "EUR", true) : "—",
      note: "Current active contract exposure.",
    },
    {
      label: "Expiring soon",
      icon: AlertTriangle,
      value: summary ? integer.format(expiringSoon) : "—",
      note: "Contracts ending within 30 days.",
      tone: expiringSoon > 0 ? "warning" : "default",
    },
    {
      label: "Compliance issues",
      icon: ShieldCheck,
      value: summary ? integer.format(complianceIssues) : "—",
      note: `${integer.format(summary?.expiredComplianceDocuments ?? 0)} expired documents`,
      tone: complianceIssues > 0 ? "warning" : "default",
    },
  ];

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, ALERTS_COLLAPSED);

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No contracts match these filters"
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
      icon={FileCheck2}
      title="No contracts yet"
      description="Record supplier contracts to track renewals, expiry exposure and compliance."
      action={
        canManage ? (
          <Link href="/contracts/new" className="button button--primary">
            <Plus size={16} />
            New contract
          </Link>
        ) : undefined
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Supplier governance</span>

          <h1>Contracts &amp; compliance</h1>

          <p>
            Control supplier contracts, renewals, expiry exposure, compliance
            documentation and governance risk.
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
            <Link href="/contracts/new" className="button button--primary">
              <Plus size={16} />
              New contract
            </Link>
          ) : null}
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Contract totals"
      />

      {alerts.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Governance alerts</span>

              <h2>Attention required</h2>
            </div>

            <span className="kit-count-pill">{alerts.length}</span>
          </div>

          <div className="contract-alert-list">
            {visibleAlerts.map((alert, index) => (
              <Link
                key={`${alert.alertType}-${alert.supplierId}-${index}`}
                href={alert.href}
                className={`contract-alert contract-alert--${alert.severity.toLowerCase()}`}
              >
                <div>
                  <strong>{alert.title}</strong>

                  <span>
                    {alert.supplierName}
                    {alert.contractNumber ? ` · ${alert.contractNumber}` : ""}
                  </span>
                </div>

                <div>
                  <strong>
                    {alert.daysRemaining < 0
                      ? `${Math.abs(alert.daysRemaining)}d overdue`
                      : `${alert.daysRemaining}d`}
                  </strong>

                  <span>{alert.dueDate ? formatDate(alert.dueDate) : "No date"}</span>
                </div>
              </Link>
            ))}
          </div>

          {alerts.length > ALERTS_COLLAPSED ? (
            <div className="kit-panel-footer">
              <button
                type="button"
                className="text-button"
                onClick={() => setShowAllAlerts((open) => !open)}
              >
                {showAllAlerts ? "Show fewer" : `Show all ${alerts.length} alerts`}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search contract, supplier or title"
          ariaLabel="Search contracts"
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

      {error && contracts === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(contract) => contract.id}
          ariaLabel="Contracts"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="contracts"
          resetKey={`${query}|${status}`}
        />
      )}
    </div>
  );
}
