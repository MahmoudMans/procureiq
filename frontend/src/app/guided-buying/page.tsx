"use client";

import {
  BadgeCheck,
  CircleAlert,
  Compass,
  Download,
  FileStack,
  Plus,
  RefreshCw,
  Route,
  SearchX,
  ShieldAlert,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
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
  formatMoney,
  useConfirm,
  useToast,
} from "@/components/kit";
import {
  activateGuidedBuyingTemplate,
  deactivateGuidedBuyingTemplate,
  deactivatePreferredSupplier,
  getGuidedBuyingIntakes,
  getGuidedBuyingSummary,
  getGuidedBuyingTemplates,
  getPreferredSuppliers,
} from "@/lib/api";
import type {
  GuidedBuyingIntake,
  GuidedBuyingSummary,
  GuidedBuyingTemplate,
  PreferredSupplier,
} from "@/types/guided-buying";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const CONFIG_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const COLLAPSED_ITEMS = 6;

const ROUTE_TONES: Record<string, BadgeTone> = {
  DIRECT_BUY: "success",
  COMPETITIVE_SOURCING: "info",
  PURCHASE_ORDER_CONTROL: "accent",
  CONTRACT_CONTROL: "accent",
  RISK_REVIEW: "high",
  MULTI_CONTROL: "warning",
};

const ROUTE_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "DIRECT_BUY", label: "Direct buy" },
  { value: "COMPETITIVE_SOURCING", label: "Competitive sourcing" },
  { value: "PURCHASE_ORDER_CONTROL", label: "PO control" },
  { value: "CONTRACT_CONTROL", label: "Contract control" },
  { value: "RISK_REVIEW", label: "Risk review" },
  { value: "MULTI_CONTROL", label: "Multi control" },
];

const STATUS_FILTERS: SegmentedOption[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "READY", label: "Ready" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CANCELLED", label: "Cancelled" },
];

const EMPTY_INTAKES: GuidedBuyingIntake[] = [];
const EMPTY_TEMPLATES: GuidedBuyingTemplate[] = [];
const EMPTY_PREFERRED: PreferredSupplier[] = [];
const integer = new Intl.NumberFormat("en-US");

/** The pipeline total mixes currencies, so it is shown as a plain number. */
function plainNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function messageOf(result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== "rejected") {
    return null;
  }

  return result.reason instanceof Error
    ? result.reason.message
    : "Unable to load guided buying.";
}

const COLUMNS: Column<GuidedBuyingIntake>[] = [
  {
    id: "intake",
    header: "Intake",
    sortValue: (intake) => intake.intakeNumber,
    cell: (intake) => (
      <div className="request-primary-cell">
        <strong>
          <Link href={`/guided-buying/${intake.id}`} className="supplier-360-link">
            {intake.intakeNumber}
          </Link>
        </strong>

        <span>{intake.title}</span>
      </div>
    ),
  },
  {
    id: "department",
    header: "Department",
    sortValue: (intake) => intake.departmentName.toLowerCase(),
    cell: (intake) => intake.departmentName,
  },
  {
    id: "category",
    header: "Category",
    sortValue: (intake) => intake.category.toLowerCase(),
    cell: (intake) => intake.category,
  },
  {
    id: "estimate",
    header: "Estimate",
    align: "right",
    sortValue: (intake) => intake.estimatedAmount,
    firstSort: "desc",
    cell: (intake) => (
      <strong className="kit-num">
        {formatMoney(intake.estimatedAmount, intake.currency)}
      </strong>
    ),
  },
  {
    id: "route",
    header: "Guided route",
    sortValue: (intake) => intake.guidanceRoute,
    cell: (intake) => (
      <StatusBadge
        value={intake.guidanceRoute}
        tone={ROUTE_TONES[intake.guidanceRoute]}
      />
    ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (intake) => intake.status,
    cell: (intake) => <StatusBadge value={intake.status} />,
  },
  {
    id: "requester",
    header: "Requester",
    sortValue: (intake) => intake.requesterName.toLowerCase(),
    cell: (intake) => intake.requesterName,
  },
  {
    id: "open",
    header: <span className="kit-sr-only">Actions</span>,
    align: "right",
    width: 70,
    cell: (intake) => (
      <Link href={`/guided-buying/${intake.id}`} className="table-action">
        Open
      </Link>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function GuidedBuyingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const canConfigure = user !== null && CONFIG_ROLES.includes(user.role);

  const [intakes, setIntakes] = useState<GuidedBuyingIntake[] | null>(null);
  const [templates, setTemplates] = useState<GuidedBuyingTemplate[] | null>(null);
  const [preferred, setPreferred] = useState<PreferredSupplier[] | null>(null);
  const [summary, setSummary] = useState<GuidedBuyingSummary | null>(null);
  const [query, setQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showAllPreferred, setShowAllPreferred] = useState(false);
  const [pendingId, setPendingId] = useState<string | number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      const [intakeResult, templateResult, preferredResult, summaryResult] =
        await Promise.allSettled([
          getGuidedBuyingIntakes(),
          getGuidedBuyingTemplates(),
          getPreferredSuppliers(),
          getGuidedBuyingSummary(),
        ]);

      if (!active) {
        return;
      }

      if (intakeResult.status === "fulfilled") {
        setIntakes(intakeResult.value);
      }

      if (templateResult.status === "fulfilled") {
        setTemplates(templateResult.value);
      }

      if (preferredResult.status === "fulfilled") {
        setPreferred(preferredResult.value);
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      }

      setError(
        messageOf(intakeResult) ??
          messageOf(templateResult) ??
          messageOf(preferredResult) ??
          messageOf(summaryResult),
      );

      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [reloadKey]);

  async function reloadConfiguration() {
    const [templateResponse, preferredResponse, summaryResponse] = await Promise.all([
      getGuidedBuyingTemplates(),
      getPreferredSuppliers(),
      getGuidedBuyingSummary(),
    ]);

    setTemplates(templateResponse);
    setPreferred(preferredResponse);
    setSummary(summaryResponse);
  }

  async function toggleTemplate(template: GuidedBuyingTemplate) {
    setPendingId(template.id);

    try {
      if (template.active) {
        await deactivateGuidedBuyingTemplate(template.id);
      } else {
        await activateGuidedBuyingTemplate(template.id);
      }

      await reloadConfiguration();

      toast.success(
        template.active ? "Template deactivated" : "Template activated",
        template.name,
      );
    } catch (caught) {
      toast.error(
        "Could not update template",
        caught instanceof Error
          ? caught.message
          : "Unable to update guided-buying template.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function deactivatePreferred(supplier: PreferredSupplier) {
    const confirmed = await confirm({
      title: `Deactivate ${supplier.supplierName} as a preferred supplier?`,
      tone: "danger",
      confirmLabel: "Deactivate",
    });

    if (!confirmed) {
      return;
    }

    setPendingId(supplier.id);

    try {
      await deactivatePreferredSupplier(supplier.id);
      await reloadConfiguration();

      toast.success("Preferred supplier deactivated", supplier.supplierName);
    } catch (caught) {
      toast.error(
        "Could not deactivate supplier",
        caught instanceof Error
          ? caught.message
          : "Unable to deactivate preferred supplier.",
      );
    } finally {
      setPendingId(null);
    }
  }

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (intakes ?? EMPTY_INTAKES)
      .filter((intake) => !routeFilter || intake.guidanceRoute === routeFilter)
      .filter((intake) => !statusFilter || intake.status === statusFilter)
      .filter(
        (intake) =>
          !normalized ||
          [
            intake.intakeNumber,
            intake.title,
            intake.category,
            intake.departmentName,
            intake.requesterName,
            intake.supplierName ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [intakes, query, routeFilter, statusFilter]);

  const initialLoad = intakes === null && error === null;
  const configLoading = templates === null && preferred === null && error === null;
  const hasFilters = query.trim() !== "" || routeFilter !== "" || statusFilter !== "";

  const templateList = templates ?? EMPTY_TEMPLATES;
  const preferredList = preferred ?? EMPTY_PREFERRED;

  const visibleTemplates = showAllTemplates
    ? templateList
    : templateList.slice(0, COLLAPSED_ITEMS);

  const visiblePreferred = showAllPreferred
    ? preferredList
    : preferredList.slice(0, COLLAPSED_ITEMS);

  function clearFilters() {
    setQuery("");
    setRouteFilter("");
    setStatusFilter("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-guided-buying-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Intake number",
        "Title",
        "Department",
        "Category",
        "Requester",
        "Supplier",
        "Currency",
        "Estimated amount",
        "Guided route",
        "Status",
      ],
      rows.map((intake) => [
        intake.intakeNumber,
        intake.title,
        intake.departmentName,
        intake.category,
        intake.requesterName,
        intake.supplierName ?? "",
        intake.currency,
        intake.estimatedAmount,
        intake.guidanceRoute,
        intake.status,
      ]),
    );

    toast.success(
      "Intakes exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const kpis: KpiItem[] = [
    {
      label: "Open intake",
      icon: Compass,
      value: summary
        ? integer.format(summary.draftIntakes + summary.readyIntakes)
        : "—",
      note: `${integer.format(summary?.convertedIntakes ?? 0)} converted to requests`,
    },
    {
      label: "Sourcing routes",
      icon: Route,
      value: summary ? integer.format(summary.competitiveSourcingRoutes) : "—",
      note: `${integer.format(summary?.multiControlRoutes ?? 0)} multi-control intakes`,
    },
    {
      label: "Risk review",
      icon: ShieldAlert,
      value: summary ? integer.format(summary.riskReviewRoutes) : "—",
      note: "Supplier-risk escalations.",
      tone: (summary?.riskReviewRoutes ?? 0) > 0 ? "warning" : "default",
    },
    {
      label: "Guided configuration",
      icon: BadgeCheck,
      value: summary ? integer.format(summary.activeTemplates) : "—",
      note: `${integer.format(
        summary?.activePreferredSuppliers ?? 0,
      )} preferred supplier mappings`,
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No intakes match these filters"
      description="Try a different search term, route or status, or clear the filters."
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
      icon={Compass}
      title="No intakes yet"
      description="Start an intake and ProcureIQ will guide it to the right buying route."
      action={
        <Link href="/guided-buying/new" className="button button--primary">
          <Plus size={16} />
          New intake
        </Link>
      }
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Procurement intake</span>

          <h1>Guided buying</h1>

          <p>
            Guide business users toward compliant buying routes, reusable request
            templates and preferred suppliers before procurement work begins.
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

          {canConfigure ? (
            <>
              <Link
                href="/guided-buying/preferred/new"
                className="button button--secondary"
              >
                <Star size={16} />
                Preferred supplier
              </Link>

              <Link
                href="/guided-buying/templates/new"
                className="button button--secondary"
              >
                <FileStack size={16} />
                New template
              </Link>
            </>
          ) : null}

          <Link href="/guided-buying/new" className="button button--primary">
            <Plus size={16} />
            New intake
          </Link>
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={summary === null && error === null}
        ariaLabel="Guided buying totals"
      />

      <section className="guided-pipeline-banner">
        <div>
          <span>Open intake pipeline</span>

          <strong>{summary ? plainNumber(summary.openPipelineValue) : "—"}</strong>
        </div>

        <p>Estimated value currently in draft or ready guided-buying intake.</p>
      </section>

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search intake, category or requester"
          ariaLabel="Search intakes"
          shortcut
        />

        <SelectField
          label="Route"
          value={routeFilter}
          onChange={setRouteFilter}
          options={ROUTE_OPTIONS}
        />

        <SegmentedFilter
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by intake status"
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

      {error && intakes === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(intake) => intake.id}
          ariaLabel="Guided buying intakes"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          persistKey="guided-buying"
          resetKey={`${query}|${routeFilter}|${statusFilter}`}
        />
      )}

      <section className="guided-config-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Reusable intake</span>

              <h2>Buying templates</h2>
            </div>

            <span className="kit-count-pill">{templateList.length}</span>
          </div>

          <div className="guided-template-list">
            {configLoading ? (
              <>
                <Skeleton height={58} />
                <Skeleton height={58} />
                <Skeleton height={58} />
              </>
            ) : null}

            {!configLoading
              ? visibleTemplates.map((template) => (
                  <article
                    key={template.id}
                    className={`guided-template-card ${
                      !template.active ? "guided-template-card--inactive" : ""
                    }`}
                  >
                    <div>
                      <span>{template.templateCode}</span>

                      <strong>{template.name}</strong>

                      <small>
                        {template.category} · {template.defaultCurrency}
                      </small>
                    </div>

                    {canConfigure ? (
                      <button
                        type="button"
                        className="guided-inline-button"
                        disabled={pendingId === template.id}
                        onClick={() => void toggleTemplate(template)}
                      >
                        {template.active ? "Deactivate" : "Activate"}
                      </button>
                    ) : (
                      <StatusBadge value={template.active ? "ACTIVE" : "INACTIVE"} />
                    )}
                  </article>
                ))
              : null}

            {!configLoading && templateList.length === 0 ? (
              <EmptyState
                compact
                icon={FileStack}
                title="No templates configured"
                description="Templates pre-fill recurring requests for business users."
              />
            ) : null}
          </div>

          {templateList.length > COLLAPSED_ITEMS ? (
            <div className="kit-panel-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setShowAllTemplates((open) => !open)}
              >
                {showAllTemplates
                  ? "Show fewer"
                  : `Show all ${templateList.length} templates`}
              </button>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Preferred supply</span>

              <h2>Preferred suppliers</h2>
            </div>

            <span className="kit-count-pill">{preferredList.length}</span>
          </div>

          <div className="guided-preferred-list">
            {configLoading ? (
              <>
                <Skeleton height={58} />
                <Skeleton height={58} />
                <Skeleton height={58} />
              </>
            ) : null}

            {!configLoading
              ? visiblePreferred.map((supplier) => (
                  <article
                    key={supplier.id}
                    className={
                      !supplier.active
                        ? "guided-preferred-card guided-preferred-card--inactive"
                        : "guided-preferred-card"
                    }
                  >
                    <div className="guided-preferred-rank">
                      {supplier.preferenceRank}
                    </div>

                    <div>
                      <strong>{supplier.supplierName}</strong>

                      <span>
                        {supplier.category} · Risk {supplier.supplierRiskLevel ?? "—"} ·
                        Rating {supplier.supplierRating.toFixed(1)}
                      </span>
                    </div>

                    {canConfigure && supplier.active ? (
                      <button
                        type="button"
                        className="guided-inline-button"
                        disabled={pendingId === supplier.id}
                        onClick={() => void deactivatePreferred(supplier)}
                      >
                        Deactivate
                      </button>
                    ) : null}
                  </article>
                ))
              : null}

            {!configLoading && preferredList.length === 0 ? (
              <EmptyState
                compact
                icon={Star}
                title="No preferred suppliers"
                description="Map preferred suppliers to categories to steer buyers."
              />
            ) : null}
          </div>

          {preferredList.length > COLLAPSED_ITEMS ? (
            <div className="kit-panel-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setShowAllPreferred((open) => !open)}
              >
                {showAllPreferred
                  ? "Show fewer"
                  : `Show all ${preferredList.length} suppliers`}
              </button>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
