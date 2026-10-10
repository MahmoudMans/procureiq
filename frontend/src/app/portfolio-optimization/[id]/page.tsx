"use client";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  Gauge,
  GitCompareArrows,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
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
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import {
  approvePortfolioOptimizationScenario,
  archivePortfolioOptimizationScenario,
  evaluatePortfolioOptimizationScenario,
  getPortfolioOptimizationScenario,
} from "@/lib/api";
import type { PortfolioScenarioDetail } from "@/types/portfolio-optimization";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Scenario = PortfolioScenarioDetail["scenario"];
type ScenarioItem = PortfolioScenarioDetail["items"][number];
type Flow = "EVALUATE" | "APPROVE" | "ARCHIVE";

const EVALUATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

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

function usagePct(value: number, limit: number): number {
  return limit > 0 ? (value / limit) * 100 : 0;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function ScenarioBadge({ status }: { status: string }) {
  if (status === "EVALUATED") {
    return <StatusBadge value="READY" label="Evaluated" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
}

function DecisionBadge({ decision }: { decision: string }) {
  switch (decision) {
    case "SELECTED":
      return <StatusBadge value="APPROVED" label="Selected" />;

    case "EXCLUDED":
      return <StatusBadge value="CANCELLED" label="Excluded" />;

    default:
      return <StatusBadge value={decision} label={readable(decision)} />;
  }
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

interface FlowCopy {
  eyebrow: string;
  title: string;
  description: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

function flowCopy(flow: Flow, scenario: Scenario): FlowCopy {
  switch (flow) {
    case "EVALUATE": {
      const again = String(scenario.status) === "EVALUATED";

      return {
        eyebrow: "Constraint-based selection",
        title: again ? "Re-evaluate this scenario?" : "Evaluate this scenario?",
        description: again
          ? `${scenario.scenarioCode} will be recalculated against its current constraints. The new selection replaces the existing results.`
          : `${scenario.scenarioCode} will select and exclude initiatives under its hard constraints.`,
        confirm: again ? "Re-evaluate" : "Evaluate scenario",
        busy: "Evaluating…",
        keep: "Not yet",
        done: again ? "Scenario re-evaluated" : "Scenario evaluated",
        failed: "Could not evaluate the scenario",
      };
    }

    case "APPROVE":
      return {
        eyebrow: "Portfolio governance",
        title: "Approve this scenario?",
        description: `${scenario.scenarioCode} will be approved with ${scenario.selectedCount} of ${scenario.candidateCount} initiatives, ${money(scenario.selectedBudget, scenario.currency)} of managed value and ${money(scenario.selectedTargetSavings, scenario.currency)} of target savings. The approval is recorded under your name.`,
        confirm: "Approve scenario",
        busy: "Approving…",
        keep: "Not yet",
        done: "Scenario approved",
        failed: "Could not approve the scenario",
      };

    case "ARCHIVE":
      return {
        eyebrow: "Scenario lifecycle",
        title: "Archive this scenario?",
        description: `${scenario.scenarioCode} will be archived. An archived scenario can no longer be evaluated or approved.`,
        confirm: "Archive scenario",
        busy: "Archiving…",
        keep: "Keep scenario",
        done: "Scenario archived",
        failed: "Could not archive the scenario",
      };
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildSelectedColumns(currency: string): Column<ScenarioItem>[] {
  return [
    {
      id: "rank",
      header: "Rank",
      align: "right",
      sortValue: (item) => item.rankPosition ?? null,
      cell: (item) =>
        item.rankPosition !== null && item.rankPosition !== undefined ? (
          <strong>#{item.rankPosition}</strong>
        ) : (
          "—"
        ),
    },
    {
      id: "initiative",
      header: "Initiative",
      sortValue: (item) => item.initiativeTitle.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.initiativeTitle}</strong>

          <span>
            {item.initiativeNumber}
            {" · "}
            {readable(String(item.initiativeType))}
          </span>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortValue: (item) => String(item.categoryName).toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.categoryName}</strong>

          <span>{readable(String(item.matrixPosition))}</span>
        </div>
      ),
    },
    {
      id: "utility",
      header: "Utility",
      align: "right",
      sortValue: (item) => item.utilityScore,
      cell: (item) => <strong className="portfolio-utility">{item.utilityScore.toFixed(1)}</strong>,
    },
    {
      id: "value",
      header: "Managed value",
      align: "right",
      sortValue: (item) => item.estimatedValue,
      cell: (item) => money(item.estimatedValue, currency),
    },
    {
      id: "savings",
      header: "Savings",
      align: "right",
      sortValue: (item) => item.targetSavings,
      cell: (item) => money(item.targetSavings, currency),
    },
    {
      id: "efficiency",
      header: "Efficiency",
      align: "right",
      sortValue: (item) => item.savingsEfficiencyPct,
      cell: (item) => item.savingsEfficiencyPct.toFixed(1),
    },
    {
      id: "risk",
      header: "Risk",
      align: "right",
      sortValue: (item) => item.supplyRiskScore,
      cell: (item) => item.supplyRiskScore.toFixed(1),
    },
  ];
}

function buildExcludedColumns(currency: string): Column<ScenarioItem>[] {
  return [
    {
      id: "initiative",
      header: "Initiative",
      sortValue: (item) => item.initiativeTitle.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.initiativeTitle}</strong>

          <span>
            {item.initiativeNumber}
            {" · "}
            {item.categoryName}
          </span>
        </div>
      ),
    },
    {
      id: "utility",
      header: "Utility",
      align: "right",
      sortValue: (item) => item.utilityScore,
      cell: (item) => <strong>{item.utilityScore.toFixed(1)}</strong>,
    },
    {
      id: "value",
      header: "Managed value",
      align: "right",
      sortValue: (item) => item.estimatedValue,
      cell: (item) => money(item.estimatedValue, currency),
    },
    {
      id: "reason",
      header: "Exclusion reason",
      cell: (item) => <span>{item.exclusionReason ?? "Excluded by scenario constraints."}</span>,
    },
  ];
}

function buildDecompositionColumns(): Column<ScenarioItem>[] {
  return [
    {
      id: "initiative",
      header: "Initiative",
      sortValue: (item) => item.initiativeTitle.toLowerCase(),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{item.initiativeTitle}</strong>

          <span>{item.categoryName}</span>
        </div>
      ),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => String(item.decision),
      cell: (item) => <DecisionBadge decision={String(item.decision)} />,
    },
    {
      id: "utility",
      header: "Utility",
      align: "right",
      sortValue: (item) => item.utilityScore,
      cell: (item) => <strong>{item.utilityScore.toFixed(1)}</strong>,
    },
    {
      id: "efficiency",
      header: "Savings efficiency",
      align: "right",
      sortValue: (item) => item.savingsEfficiencyPct,
      cell: (item) => item.savingsEfficiencyPct.toFixed(1),
    },
    {
      id: "strategic",
      header: "Strategic value",
      align: "right",
      sortValue: (item) => item.strategicValueScore,
      cell: (item) => item.strategicValueScore.toFixed(1),
    },
    {
      id: "priority",
      header: "Priority",
      align: "right",
      sortValue: (item) => item.priorityScore,
      cell: (item) => item.priorityScore.toFixed(1),
    },
    {
      id: "urgency",
      header: "Matrix urgency",
      align: "right",
      sortValue: (item) => item.matrixUrgencyScore,
      cell: (item) => item.matrixUrgencyScore.toFixed(1),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface ScenarioData {
  id: string;
  detail: PortfolioScenarioDetail;
}

export default function PortfolioOptimizationScenarioPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canEvaluate = user !== null && EVALUATE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<ScenarioData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
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
        const response = await getPortfolioOptimizationScenario(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load portfolio scenario.",
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

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getPortfolioOptimizationScenario(id);

      setResult((current) =>
        current && current.id === id ? { ...current, detail: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the scenario.");
    }
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
        <Link href="/portfolio-optimization" className="request-back-link">
          <ArrowLeft size={16} />
          Portfolio optimization
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

  const { scenario } = detail;
  const currency = scenario.currency;
  const status = String(scenario.status);
  const draft = status === "DRAFT";
  const evaluated = status === "EVALUATED";
  const approvedStatus = status === "APPROVED";
  const archived = status === "ARCHIVED";
  const showUsage = !draft;
  const canRunEvaluate = canEvaluate && (draft || evaluated);
  const approveBlocked = !scenario.minimumTargetMet
    ? "The minimum savings constraint is not satisfied"
    : scenario.selectedCount === 0
      ? "No initiative is selected"
      : undefined;

  const selected = detail.items
    .filter((item) => item.decision === "SELECTED")
    .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0));

  const excluded = detail.items
    .filter((item) => item.decision === "EXCLUDED")
    .sort((a, b) => b.utilityScore - a.utilityScore);

  const decomposition = [...detail.items].sort((a, b) => b.utilityScore - a.utilityScore);

  const breaches: string[] = [];

  if (showUsage) {
    if (scenario.selectedBudget > scenario.budgetLimit + 0.5) {
      breaches.push("managed value");
    }

    if (scenario.selectedCount > scenario.maxInitiatives) {
      breaches.push("initiative count");
    }

    if (scenario.averageSelectedRisk > scenario.maxAverageRiskScore + 0.05) {
      breaches.push("average risk");
    }
  }

  const shortfall = scenario.minTotalTargetSavings - scenario.selectedTargetSavings;
  const flowInfo = flow !== null ? flowCopy(flow, scenario) : null;

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;
    const copy = flowCopy(action, scenario);

    setFlowRunning(true);

    try {
      let detailText: string = scenario.scenarioCode;

      if (action === "EVALUATE") {
        const outcome = await evaluatePortfolioOptimizationScenario(params.id);

        detailText = `${outcome.selectedCount} selected · ${outcome.excludedCount} excluded · ${outcome.minimumTargetMet ? "minimum savings satisfied" : "minimum savings not satisfied"}`;
      } else if (action === "APPROVE") {
        await approvePortfolioOptimizationScenario(params.id);
      } else {
        await archivePortfolioOptimizationScenario(params.id);
      }

      await refresh();

      setFlow(null);

      toast.success(copy.done, detailText);
    } catch (caught) {
      setFlow(null);

      toast.error(
        copy.failed,
        caught instanceof Error ? caught.message : "Unable to update the portfolio scenario.",
      );
    } finally {
      setFlowRunning(false);
    }
  }

  const kpis: KpiItem[] = [
    {
      label: "Selected initiatives",
      icon: BadgeCheck,
      value: `${scenario.selectedCount} / ${scenario.candidateCount}`,
      note: "Selected of all candidates",
    },
    {
      label: "Managed value",
      icon: Coins,
      value: money(scenario.selectedBudget, currency),
      note: "Of the selected initiatives",
    },
    {
      label: "Target savings",
      icon: Target,
      value: money(scenario.selectedTargetSavings, currency),
      note: scenario.minimumTargetMet ? "Meets the minimum" : "Below the minimum",
      tone: showUsage && !scenario.minimumTargetMet ? "warning" : "default",
    },
    {
      label: "Savings / managed value",
      icon: Gauge,
      value: `${scenario.savingsToBudgetPct.toFixed(1)}%`,
      note: "Savings efficiency of the portfolio",
    },
    {
      label: "Average risk",
      icon: ShieldAlert,
      value: scenario.averageSelectedRisk.toFixed(1),
      note: `Maximum ${scenario.maxAverageRiskScore.toFixed(1)}`,
      tone:
        showUsage && scenario.averageSelectedRisk > scenario.maxAverageRiskScore + 0.05
          ? "warning"
          : "default",
    },
    {
      label: "Excluded",
      icon: XCircle,
      value: String(excluded.length),
      note: "Removed by the constraints",
    },
  ];

  const selectedColumns = buildSelectedColumns(currency);
  const excludedColumns = buildExcludedColumns(currency);
  const decompositionColumns = buildDecompositionColumns();

  return (
    <div className="page-stack">
      <Link href="/portfolio-optimization" className="request-back-link">
        <ArrowLeft size={16} />
        Portfolio optimization
      </Link>

      <section className="portfolio-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{scenario.scenarioCode}</span>

            <ScenarioBadge status={status} />
          </div>

          <h1>{scenario.name}</h1>

          <p>
            {currency}
            {" · Owner: "}
            {scenario.ownerName}
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

          {canApprove && !archived ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={flowRunning}
              onClick={() => setFlow("ARCHIVE")}
            >
              <Archive size={15} />
              Archive
            </button>
          ) : null}

          {canRunEvaluate ? (
            <button
              type="button"
              className={`button ${draft ? "button--primary" : "button--secondary"}`}
              disabled={flowRunning}
              onClick={() => setFlow("EVALUATE")}
            >
              <GitCompareArrows size={16} />
              {evaluated ? "Re-evaluate" : "Evaluate scenario"}
            </button>
          ) : null}

          {canApprove && evaluated ? (
            <button
              type="button"
              className="button button--primary"
              disabled={flowRunning || approveBlocked !== undefined}
              title={approveBlocked}
              onClick={() => setFlow("APPROVE")}
            >
              <BadgeCheck size={16} />
              Approve scenario
            </button>
          ) : null}
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

      {draft && canEvaluate ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Evaluate the scenario to build the portfolio.</strong> Initiatives are selected
            and excluded under the hard constraints below.
          </div>
        </div>
      ) : null}

      {evaluated && !scenario.minimumTargetMet ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The minimum savings constraint is not satisfied.</strong> The selection is{" "}
            {money(Math.max(shortfall, 0), currency)} short of the required{" "}
            {money(scenario.minTotalTargetSavings, currency)}, so the scenario cannot be approved.
            Create another scenario with adjusted constraints.
          </div>
        </div>
      ) : null}

      {evaluated && scenario.minimumTargetMet && scenario.selectedCount === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No initiative is selected.</strong> The scenario cannot be approved until an
            evaluation selects at least one initiative.
          </div>
        </div>
      ) : null}

      {breaches.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The selection is outside {plural(breaches.length, "constraint", "constraints")}.</strong>{" "}
            Check the {breaches.join(", ")} against the limits below.
          </div>
        </div>
      ) : null}

      {evaluated && !approveBlocked && canApprove ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The scenario meets the minimum savings.</strong> Approve it when the selection
            is acceptable, or re-evaluate it after the constraints change.
          </div>
        </div>
      ) : null}

      {evaluated && !canApprove ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting approval.</strong> A procurement manager or administrator needs to
            approve the scenario.
          </div>
        </div>
      ) : null}

      {archived ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This scenario is archived.</strong> It can no longer be evaluated or approved.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Scenario summary" />

      <section className="portfolio-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Hard constraints</span>

              <h2>Scenario controls</h2>
            </div>

            <SlidersHorizontal size={19} />
          </div>

          <div className="portfolio-constraint-grid">
            <div>
              <span>Budget / managed-value cap</span>

              <strong>{money(scenario.budgetLimit, currency)}</strong>
            </div>

            <div>
              <span>Maximum initiatives</span>

              <strong>{scenario.maxInitiatives}</strong>
            </div>

            <div>
              <span>Maximum average risk</span>

              <strong>{scenario.maxAverageRiskScore.toFixed(1)}</strong>
            </div>

            <div>
              <span>Minimum savings target</span>

              <strong>{money(scenario.minTotalTargetSavings, currency)}</strong>
            </div>

            <div>
              <span>Critical categories</span>

              <strong>{scenario.allowCriticalPriority ? "Allowed" : "Excluded"}</strong>
            </div>

            <div>
              <span>Savings / managed value</span>

              <strong>{scenario.savingsToBudgetPct.toFixed(1)}%</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Governance check</span>

              <h2>Scenario readiness</h2>
            </div>

            <ShieldCheck size={19} />
          </div>

          <div
            className={
              scenario.minimumTargetMet
                ? "portfolio-readiness portfolio-readiness--ready"
                : "portfolio-readiness"
            }
          >
            <strong>
              {scenario.minimumTargetMet
                ? "Minimum savings constraint satisfied"
                : "Minimum savings constraint not satisfied"}
            </strong>

            <p>
              Required: {money(scenario.minTotalTargetSavings, currency)}
              {" · Selected: "}
              {money(scenario.selectedTargetSavings, currency)}
            </p>
          </div>

          {scenario.approvedAt ? (
            <div className="portfolio-approval-info">
              <BadgeCheck size={15} />

              <span>
                Approved by {scenario.approvedByName ?? "Procurement governance"}
                {" on "}
                {formatDateTime(scenario.approvedAt)}
              </span>
            </div>
          ) : null}

          {detail.notes ? (
            <div className="portfolio-notes">
              <strong>Scenario notes</strong>

              <p>{detail.notes}</p>
            </div>
          ) : null}
        </section>
      </section>

      {showUsage ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Hard constraints</span>

              <h2>Constraint usage</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={usagePct(scenario.selectedBudget, scenario.budgetLimit)}
            tone="primary"
            caption={`${money(scenario.selectedBudget, currency)} of the ${money(scenario.budgetLimit, currency)} managed-value cap (${usagePct(scenario.selectedBudget, scenario.budgetLimit).toFixed(1)}%)`}
            label="Managed value against the cap"
          />

          <ProgressLine
            pct={usagePct(scenario.selectedCount, scenario.maxInitiatives)}
            tone="primary"
            caption={`${scenario.selectedCount} of the ${scenario.maxInitiatives} maximum initiatives`}
            label="Selected initiatives against the maximum"
          />

          <ProgressLine
            pct={usagePct(scenario.averageSelectedRisk, scenario.maxAverageRiskScore)}
            tone="primary"
            caption={`Average risk ${scenario.averageSelectedRisk.toFixed(1)} against a maximum of ${scenario.maxAverageRiskScore.toFixed(1)}`}
            label="Average risk against the maximum"
          />

          {scenario.minTotalTargetSavings > 0 ? (
            <ProgressLine
              pct={usagePct(scenario.selectedTargetSavings, scenario.minTotalTargetSavings)}
              tone={scenario.minimumTargetMet ? meterToneFor("success") : "primary"}
              caption={`${money(scenario.selectedTargetSavings, currency)} of the ${money(scenario.minTotalTargetSavings, currency)} minimum savings target`}
              label="Target savings against the minimum"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Recommended portfolio</span>

            <h2>Selected initiatives</h2>
          </div>

          <span className="portfolio-count">{selected.length} selected</span>
        </div>

        <DataTable
          columns={selectedColumns}
          rows={selected}
          getRowId={(item) => String(item.id)}
          ariaLabel="Selected initiatives"
          busy={fetching}
          empty={
            <EmptyState
              icon={GitCompareArrows}
              title="No initiatives selected"
              description="No initiatives have been selected. Evaluate the scenario or adjust its constraints by creating another scenario."
              action={
                canRunEvaluate ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setFlow("EVALUATE")}
                  >
                    <GitCompareArrows size={15} />
                    {evaluated ? "Re-evaluate" : "Evaluate scenario"}
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Constraint transparency</span>

            <h2>Excluded initiatives</h2>
          </div>

          <span className="portfolio-count">{excluded.length} excluded</span>
        </div>

        <DataTable
          columns={excludedColumns}
          rows={excluded}
          getRowId={(item) => String(item.id)}
          ariaLabel="Excluded initiatives"
          busy={fetching}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="No excluded initiatives"
              description="No initiative was excluded by the scenario constraints."
            />
          }
        />
      </section>

      {decomposition.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Explainability</span>

              <h2>Initiative score decomposition</h2>
            </div>

            <SlidersHorizontal size={19} />
          </div>

          <DataTable
            columns={decompositionColumns}
            rows={decomposition}
            getRowId={(item) => `score-${String(item.id)}`}
            ariaLabel="Initiative score decomposition"
            busy={fetching}
          />
        </section>
      ) : null}

      {flow !== null && flowInfo !== null ? (
        <ActionDialog
          eyebrow={flowInfo.eyebrow}
          title={flowInfo.title}
          description={flowInfo.description}
          confirmLabel={flowInfo.confirm}
          busyLabel={flowInfo.busy}
          cancelLabel={flowInfo.keep}
          busy={flowRunning}
          onConfirm={() => void confirmFlow()}
          onCancel={() => setFlow(null)}
        />
      ) : null}
    </div>
  );
}
