"use client";

import {
  BadgeCheck,
  CircleAlert,
  Clock3,
  Download,
  Plus,
  RefreshCw,
  SearchX,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
  type FilterChip,
  FilterChips,
  KpiGrid,
  type KpiItem,
  Meter,
  SearchField,
  SelectField,
  type SelectOption,
  type StatItem,
  StatStrip,
  StatusBadge,
  downloadCsv,
  readable,
  useToast,
} from "@/components/kit";
import {
  getSupplierOnboardingCases,
  getSupplierOnboardingSummary,
} from "@/lib/api";
import type {
  SupplierOnboardingCase,
  SupplierOnboardingSummary,
} from "@/types/supplier-onboarding";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const CREATOR_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

/** Cases that are finished, so an SLA no longer applies. */
const CLOSED: string[] = ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED"];

const TIER_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
];

const RISK_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "INITIAL", label: "Initial" },
  { value: "REQUALIFICATION", label: "Requalification" },
];

const EMPTY_CASES: SupplierOnboardingCase[] = [];
const integer = new Intl.NumberFormat("en-US");

function gateOf(item: SupplierOnboardingCase): { label: string; tone: BadgeTone; rank: number } {
  if (item.activationClearance) {
    return { label: "Cleared", tone: "success", rank: 2 };
  }

  if (item.activationEligible) {
    return { label: "Ready", tone: "info", rank: 1 };
  }

  return { label: "Blocked", tone: "neutral", rank: 0 };
}

function slaRank(item: SupplierOnboardingCase): number {
  if (CLOSED.includes(item.status)) {
    return -1;
  }

  return item.slaOverdue ? 100000 + item.daysOpen : item.daysOpen;
}

function ratio(done: number, total: number): number {
  return total > 0 ? done / total : 0;
}

interface ProgressCellProps {
  done: number;
  total: number;
  label: string;
  flag?: string | null;
}

function ProgressCell({ done, total, label, flag }: ProgressCellProps) {
  if (total <= 0) {
    return <span className="kit-text-muted">—</span>;
  }

  return (
    <div className="kit-cell-stack">
      <Meter
        value={done}
        max={total}
        label={`${done} / ${total}`}
        tone={done >= total ? "success" : "primary"}
        ariaLabel={label}
      />

      {flag ? <small className="kit-cell-flag">{flag}</small> : null}
    </div>
  );
}

const COLUMNS: Column<SupplierOnboardingCase>[] = [
  {
    id: "case",
    header: "Case",
    sortValue: (item) => item.caseNumber,
    cell: (item) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/supplier-onboarding/${item.id}`} className="supplier-360-link">
            {item.caseNumber}
          </Link>
        </strong>

        <span>
          {readable(item.caseType)} · {item.ownerName}
        </span>
      </div>
    ),
  },
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (item) => item.supplierName.toLowerCase(),
    cell: (item) => (
      <div className="stacked-cell">
        <strong>{item.supplierName}</strong>

        <span>
          {[item.supplierCode, item.supplierCountry].filter(Boolean).join(" · ")}
        </span>
      </div>
    ),
  },
  {
    id: "risk",
    header: "Risk",
    sortValue: (item) => TIER_RANK[item.riskTier] ?? -1,
    firstSort: "desc",
    cell: (item) => <StatusBadge value={item.riskTier} />,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (item) => item.status,
    cell: (item) => <StatusBadge value={item.status} />,
  },
  {
    id: "qualification",
    header: "Qualification",
    sortValue: (item) =>
      ratio(item.answeredMandatoryQuestions, item.mandatoryQuestions),
    cell: (item) => (
      <ProgressCell
        done={item.answeredMandatoryQuestions}
        total={item.mandatoryQuestions}
        label="Mandatory questions answered"
        flag={
          item.nonCompliantMandatoryQuestions > 0
            ? `${item.nonCompliantMandatoryQuestions} non-compliant`
            : null
        }
      />
    ),
  },
  {
    id: "evidence",
    header: "Evidence",
    sortValue: (item) => ratio(item.validMandatoryEvidence, item.mandatoryEvidence),
    cell: (item) => (
      <ProgressCell
        done={item.validMandatoryEvidence}
        total={item.mandatoryEvidence}
        label="Mandatory evidence validated"
      />
    ),
  },
  {
    id: "approvals",
    header: "Approvals",
    sortValue: (item) => ratio(item.approvedRequiredApprovals, item.requiredApprovals),
    cell: (item) => (
      <ProgressCell
        done={item.approvedRequiredApprovals}
        total={item.requiredApprovals}
        label="Required approvals granted"
      />
    ),
  },
  {
    id: "gate",
    header: "Gate",
    sortValue: (item) => gateOf(item).rank,
    firstSort: "desc",
    cell: (item) => {
      const gate = gateOf(item);

      return <StatusBadge value={gate.label} label={gate.label} tone={gate.tone} />;
    },
  },
  {
    id: "sla",
    header: "SLA",
    sortValue: slaRank,
    firstSort: "desc",
    cell: (item) => {
      if (CLOSED.includes(item.status)) {
        return <span className="kit-text-muted">Closed</span>;
      }

      return item.slaOverdue ? (
        <span className="kit-text-danger">Overdue · {item.daysOpen}d</span>
      ) : (
        <span>{item.daysOpen}d open</span>
      );
    },
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (item) => (
      <Link href={`/supplier-onboarding/${item.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SupplierOnboardingPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canCreate = user !== null && CREATOR_ROLES.includes(user.role);

  const [cases, setCases] = useState<SupplierOnboardingCase[] | null>(null);
  const [summary, setSummary] = useState<SupplierOnboardingSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);
      setSummaryFailed(false);

      const [caseResult, summaryResult] = await Promise.allSettled([
        getSupplierOnboardingCases(),
        getSupplierOnboardingSummary(),
      ]);

      if (!active) {
        return;
      }

      if (caseResult.status === "fulfilled") {
        setCases(caseResult.value);
      } else {
        setError(
          caseResult.reason instanceof Error
            ? caseResult.reason.message
            : "Unable to load supplier onboarding.",
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

    return (cases ?? EMPTY_CASES)
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter((item) => !riskFilter || item.riskTier === riskFilter)
      .filter((item) => !typeFilter || item.caseType === typeFilter)
      .filter(
        (item) =>
          !normalized ||
          [
            item.caseNumber,
            item.supplierCode,
            item.supplierName,
            item.supplierCategory ?? "",
            item.supplierCountry ?? "",
            item.ownerName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [cases, query, statusFilter, riskFilter, typeFilter]);

  const initialLoad = cases === null && error === null;
  const hasFilters =
    query.trim() !== "" || statusFilter !== "" || riskFilter !== "" || typeFilter !== "";

  const chips: FilterChip[] = [];

  if (query.trim()) {
    chips.push({
      key: "query",
      label: `Search: “${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  if (statusFilter) {
    chips.push({
      key: "status",
      label: `Status: ${readable(statusFilter)}`,
      onRemove: () => setStatusFilter(""),
    });
  }

  if (riskFilter) {
    chips.push({
      key: "risk",
      label: `Risk: ${readable(riskFilter)}`,
      onRemove: () => setRiskFilter(""),
    });
  }

  if (typeFilter) {
    chips.push({
      key: "type",
      label: `Type: ${readable(typeFilter)}`,
      onRemove: () => setTypeFilter(""),
    });
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("");
    setRiskFilter("");
    setTypeFilter("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-supplier-onboarding-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Case number",
        "Case type",
        "Supplier",
        "Supplier code",
        "Category",
        "Country",
        "Owner",
        "Risk tier",
        "Status",
        "Questions answered",
        "Questions mandatory",
        "Non-compliant questions",
        "Evidence valid",
        "Evidence mandatory",
        "Approvals granted",
        "Approvals required",
        "Activation gate",
        "SLA overdue",
        "Days open",
      ],
      rows.map((item) => [
        item.caseNumber,
        item.caseType,
        item.supplierName,
        item.supplierCode,
        item.supplierCategory ?? "",
        item.supplierCountry ?? "",
        item.ownerName,
        item.riskTier,
        item.status,
        item.answeredMandatoryQuestions,
        item.mandatoryQuestions,
        item.nonCompliantMandatoryQuestions,
        item.validMandatoryEvidence,
        item.mandatoryEvidence,
        item.approvedRequiredApprovals,
        item.requiredApprovals,
        gateOf(item).label,
        item.slaOverdue ? "Yes" : "No",
        item.daysOpen,
      ]),
    );

    toast.success(
      "Onboarding cases exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const overdueCases = summary?.overdueCases ?? 0;
  const requalExpired = summary?.requalificationExpired ?? 0;
  const highCritical = summary?.highCriticalRiskCases ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "In review",
      icon: UserCheck,
      value: summary ? integer.format(summary.inReviewCases) : "—",
      note: `${integer.format(summary?.draftCases ?? 0)} draft`,
    },
    {
      label: "Activation ready",
      icon: BadgeCheck,
      value: summary ? integer.format(summary.activationReadyCases) : "—",
      note: "All mandatory gates passed.",
    },
    {
      label: "SLA overdue",
      icon: Clock3,
      value: summary ? integer.format(overdueCases) : "—",
      note: "Open qualification cases beyond target.",
      tone: overdueCases > 0 ? "warning" : "default",
    },
    {
      label: "Requalification",
      icon: RefreshCw,
      value: summary ? integer.format(summary.requalificationDueWithin30Days) : "—",
      note: `${integer.format(requalExpired)} expired`,
      tone: requalExpired > 0 ? "warning" : "default",
    },
  ];

  const stats: StatItem[] = [
    {
      label: "Approved cases",
      value: summary ? integer.format(summary.approvedCases) : "—",
    },
    {
      label: "High / critical active",
      value: summary ? integer.format(highCritical) : "—",
      tone: highCritical > 0 ? "danger" : "default",
    },
    {
      label: "Rejected",
      value: summary ? integer.format(summary.rejectedCases) : "—",
    },
    {
      label: "Total cases",
      value: summary ? integer.format(summary.totalCases) : "—",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No onboarding cases match these filters"
      description="Try a different search term, or clear the filters to see every case."
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
      icon={UserCheck}
      title="No onboarding cases yet"
      description="Open a case to qualify a supplier through questionnaires, evidence and approvals."
      action={
        canCreate ? (
          <Link href="/supplier-onboarding/new" className="button button--primary">
            <Plus size={16} />
            New onboarding case
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

          <h1>Supplier onboarding</h1>

          <p>
            Qualify suppliers through mandatory questionnaires, evidence validation,
            risk-based approvals, activation gates and recurring requalification.
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

          {canCreate ? (
            <Link href="/supplier-onboarding/new" className="button button--primary">
              <Plus size={16} />
              New onboarding case
            </Link>
          ) : null}
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && !summaryFailed}
        ariaLabel="Onboarding totals"
      />

      <StatStrip items={stats} loading={summary === null && !summaryFailed} />

      <div className="kit-filters">
        <div className="kit-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search supplier, case, category or owner"
            ariaLabel="Search onboarding cases"
            shortcut
          />

          <SelectField
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />

          <SelectField
            label="Risk"
            value={riskFilter}
            onChange={setRiskFilter}
            options={RISK_OPTIONS}
          />

          <SelectField
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={TYPE_OPTIONS}
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
          getRowId={(item) => item.id}
          ariaLabel="Supplier onboarding cases"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          defaultSort={{ id: "sla", dir: "desc" }}
          persistKey="supplier-onboarding"
          resetKey={`${query}|${statusFilter}|${riskFilter}|${typeFilter}`}
        />
      )}

      <section className="onboarding-integrity-note">
        <ShieldCheck size={18} />

        <div>
          <strong>Activation clearance is governed, not automatic</strong>

          <p>
            ProcureIQ calculates whether the supplier has passed every qualification
            gate and records activation clearance, but it does not silently rewrite the
            supplier master-data status.
          </p>
        </div>
      </section>
    </div>
  );
}
