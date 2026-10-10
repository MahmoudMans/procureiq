"use client";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Gauge,
  Goal,
  Info,
  Play,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  Field,
  KpiGrid,
  type KpiItem,
  Meter,
  type MeterTone,
  Modal,
  Skeleton,
  StatusBadge,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  approveStrategyScenario,
  archiveStrategyScenario,
  deleteStrategyScenarioAssumption,
  evaluateStrategyScenario,
  getStrategyScenario,
  upsertStrategyScenarioAssumption,
} from "@/lib/api";
import type { BoardDimensionKey } from "@/types/strategy-cockpit";
import type { StrategyScenarioDetail } from "@/types/strategy-scenario";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Scenario = StrategyScenarioDetail["scenario"];
type Assumption = StrategyScenarioDetail["assumptions"][number];
type EvaluationDimension = NonNullable<
  StrategyScenarioDetail["latestEvaluation"]
>["dimensions"][number];
type RationaleKind = "APPROVE" | "ARCHIVE";
type AssumptionField = "points" | "rationale";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const dimensions: Array<{
  key: BoardDimensionKey;
  label: string;
}> = [
  { key: "OBJECTIVE_EXECUTION", label: "Objective execution" },
  { key: "STRATEGIC_ALIGNMENT", label: "Strategic alignment" },
  { key: "CAPACITY_READINESS", label: "Capacity readiness" },
  { key: "CAPABILITY_READINESS", label: "Capability readiness" },
  { key: "SUCCESSION_RESILIENCE", label: "Succession resilience" },
];

function signed(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
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

function Adjustment({ points }: { points: number }) {
  return (
    <span
      className={
        points > 0 ? "scenario-positive" : points < 0 ? "scenario-negative" : undefined
      }
    >
      {signed(points)}
      {" pts"}
    </span>
  );
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

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  cancelLabel?: string;
  done: string;
}

function rationaleCopy(kind: RationaleKind, scenario: Scenario): RationaleCopy {
  switch (kind) {
    case "APPROVE":
      return {
        eyebrow: "Planning governance",
        title: "Approve planning scenario",
        description: `${scenario.scenarioNumber} will be approved${
          scenario.latestSimulatedScore !== null && scenario.latestDelta !== null
            ? ` with a simulated score of ${scenario.latestSimulatedScore.toFixed(1)} against a frozen baseline of ${scenario.baselineOverallScore.toFixed(1)} (${signed(scenario.latestDelta)})`
            : ""
        }. Approval records a governed planning scenario only. It does not execute the scenario.`,
        label: "Governed decision note",
        placeholder: "Why is this planning scenario approved?",
        confirm: "Approve planning scenario",
        busy: "Approving…",
        done: "Planning scenario approved",
      };

    case "ARCHIVE":
      return {
        eyebrow: "Planning governance",
        title: "Archive scenario",
        description: `${scenario.scenarioNumber} will be archived. An archived scenario can no longer be edited, evaluated or approved.`,
        label: "Governed decision note",
        placeholder: "Why is this scenario being archived?",
        confirm: "Archive scenario",
        busy: "Archiving…",
        cancelLabel: "Keep scenario",
        done: "Scenario archived",
      };
  }
}

function performRationale(
  kind: RationaleKind,
  scenarioId: string,
  note: string,
): Promise<StrategyScenarioDetail> {
  switch (kind) {
    case "APPROVE":
      return approveStrategyScenario(scenarioId, note);

    case "ARCHIVE":
      return archiveStrategyScenario(scenarioId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface AssumptionColumnOptions {
  canRemove: boolean;
  busy: boolean;
  onRemove: (assumption: Assumption) => void;
}

function buildAssumptionColumns(options: AssumptionColumnOptions): Column<Assumption>[] {
  return [
    {
      id: "dimension",
      header: "Dimension",
      sortValue: (item) => item.dimensionLabel.toLowerCase(),
      cell: (item) => <strong>{item.dimensionLabel}</strong>,
    },
    {
      id: "adjustment",
      header: "Adjustment",
      align: "right",
      sortValue: (item) => item.adjustmentPoints,
      cell: (item) => <Adjustment points={item.adjustmentPoints} />,
    },
    {
      id: "rationale",
      header: "Rationale",
      cell: (item) => <span>{item.rationale}</span>,
    },
    {
      id: "by",
      header: "Updated by",
      sortValue: (item) => String(item.updatedByName ?? "").toLowerCase(),
      cell: (item) => item.updatedByName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 120,
      cell: (item) =>
        options.canRemove ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onRemove(item)}
          >
            <Trash2 size={14} />
            Remove
          </button>
        ) : null,
    },
  ];
}

function buildEvaluationColumns(): Column<EvaluationDimension>[] {
  return [
    {
      id: "dimension",
      header: "Dimension",
      sortValue: (item) => item.dimensionLabel.toLowerCase(),
      cell: (item) => <strong>{item.dimensionLabel}</strong>,
    },
    {
      id: "weight",
      header: "Weight",
      align: "right",
      sortValue: (item) => item.weightPct,
      cell: (item) => `${item.weightPct.toFixed(0)}%`,
    },
    {
      id: "baseline",
      header: "Baseline",
      align: "right",
      sortValue: (item) => item.baselineScore,
      cell: (item) => item.baselineScore.toFixed(1),
    },
    {
      id: "adjustment",
      header: "Adjustment",
      align: "right",
      sortValue: (item) => item.adjustmentPoints,
      cell: (item) => <Adjustment points={item.adjustmentPoints} />,
    },
    {
      id: "simulated",
      header: "Simulated",
      align: "right",
      sortValue: (item) => item.simulatedScore,
      cell: (item) => <strong>{item.simulatedScore.toFixed(1)}</strong>,
    },
    {
      id: "impact",
      header: "Weighted impact",
      align: "right",
      sortValue: (item) => ((item.simulatedScore - item.baselineScore) * item.weightPct) / 100,
      cell: (item) => {
        const impact = ((item.simulatedScore - item.baselineScore) * item.weightPct) / 100;

        return (
          <span
            className={
              impact > 0.005 ? "scenario-positive" : impact < -0.005 ? "scenario-negative" : undefined
            }
          >
            {signed(impact)}
          </span>
        );
      },
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => String(item.health),
      cell: (item) => (
        <StatusBadge value={String(item.health)} label={readable(String(item.health))} />
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add or update assumption modal                                      */
/* ------------------------------------------------------------------ */

interface AssumptionModalProps {
  scenarioId: string;
  onClose: () => void;
  onSaved: (updated: StrategyScenarioDetail, label: string) => void;
}

function AssumptionModal({ scenarioId, onClose, onSaved }: AssumptionModalProps) {
  const [dimensionKey, setDimensionKey] = useState<BoardDimensionKey>("OBJECTIVE_EXECUTION");
  const [points, setPoints] = useState("5");
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AssumptionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = points.trim() === "" ? Number.NaN : Number(points);
  const pointsValid = Number.isFinite(parsed) && parsed >= -100 && parsed <= 100;
  const large = pointsValid && Math.abs(parsed) >= 20;
  const zero = pointsValid && Math.abs(parsed) < 0.05;
  const dimensionLabel =
    dimensions.find((dimension) => dimension.key === dimensionKey)?.label ?? "Dimension";

  function clearError(field: AssumptionField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<AssumptionField, string>> = {};

    if (points.trim() === "" || !Number.isFinite(parsed)) {
      next.points = "Enter the adjustment in points.";
    } else if (parsed < -100 || parsed > 100) {
      next.points = "The adjustment must be between -100 and 100 points.";
    }

    if (!rationale.trim()) {
      next.rationale = "A rationale is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await upsertStrategyScenarioAssumption(scenarioId, {
        dimensionKey,
        adjustmentPoints: parsed,
        rationale: rationale.trim(),
      });

      onSaved(updated, `${dimensionLabel}: ${signed(parsed)} pts`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save strategy assumption.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Scenario modeling"
      title="Add or update assumption"
      description="An explicit planning assumption adjusts one board dimension in the simulation."
      size="md"
      dismissible={!saving}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="scenario-assumption-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save assumption"}
          </button>
        </>
      }
    >
      <form id="scenario-assumption-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div>
            <Field label="Dimension" htmlFor="scenario-dimension">
              <select
                id="scenario-dimension"
                className="kit-field-input"
                value={dimensionKey}
                onChange={(event) => setDimensionKey(event.target.value as BoardDimensionKey)}
              >
                {dimensions.map((dimension) => (
                  <option key={dimension.key} value={dimension.key}>
                    {dimension.label}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              Saving for a dimension that already has an assumption replaces it.
            </p>
          </div>

          <div>
            <Field label="Adjustment points" htmlFor="scenario-points" error={errors.points}>
              <input
                id="scenario-points"
                className="kit-field-input"
                type="number"
                min={-100}
                max={100}
                step={0.1}
                value={points}
                aria-invalid={errors.points ? true : undefined}
                onChange={(event) => {
                  setPoints(event.target.value);
                  clearError("points");
                }}
              />
            </Field>

            <p className="kit-meta-line">
              From -100 to 100. Each dimension is clamped to 0–100 at evaluation.
            </p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Rationale" htmlFor="scenario-rationale" error={errors.rationale}>
              <textarea
                id="scenario-rationale"
                className="kit-field-input"
                rows={5}
                maxLength={3000}
                value={rationale}
                aria-invalid={errors.rationale ? true : undefined}
                onChange={(event) => {
                  setRationale(event.target.value);
                  clearError("rationale");
                }}
              />
            </Field>
          </div>
        </div>

        {large ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This is a large adjustment of {signed(parsed)} points, so the rationale should justify
            it.
          </p>
        ) : null}

        {zero ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            A zero adjustment has no effect on the simulation.
          </p>
        ) : null}

        {error ? (
          <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface ScenarioData {
  id: string;
  detail: StrategyScenarioDetail;
}

export default function StrategyScenarioPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<ScenarioData | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateRunning, setEvaluateRunning] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeRunning, setRemoveRunning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rationale, setRationale] = useState<RationaleKind | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
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
        const response = await getStrategyScenario(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load strategy scenario.");
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

  function applyDetail(updated: StrategyScenarioDetail) {
    setResult((current) => (current ? { ...current, detail: updated } : current));
  }

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getStrategyScenario(id);

      setResult((current) => (current && current.id === id ? { ...current, detail: fresh } : current));
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
        <Link href="/strategy-scenarios" className="request-back-link">
          <ArrowLeft size={16} />
          Strategy scenarios
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

  const { scenario, assumptions, latestEvaluation } = detail;
  const status = String(scenario.status);
  const evaluated = status === "EVALUATED";
  const approvedStatus = status === "APPROVED";
  const archived = status === "ARCHIVED";
  const editable = !approvedStatus && !archived;
  const busyAny = evaluateRunning || removeRunning || rationaleRunning;
  const canAdd = canManage && editable;
  const canEvaluate = canManage && editable;
  const hasSimulation = scenario.latestSimulatedScore !== null;
  const dropped = scenario.latestDelta !== null && scenario.latestDelta < -0.05;
  const removing = assumptions.find((assumption) => String(assumption.id) === removeId) ?? null;

  const orderedAssumptions = [...assumptions].sort(
    (a, b) => Math.abs(b.adjustmentPoints) - Math.abs(a.adjustmentPoints),
  );

  async function confirmEvaluate() {
    setEvaluateRunning(true);

    try {
      await evaluateStrategyScenario(params.id);

      await refresh();

      setEvaluating(false);

      toast.success("Scenario evaluated", scenario.scenarioNumber);
    } catch (caught) {
      setEvaluating(false);

      toast.error(
        "Could not evaluate the scenario",
        caught instanceof Error ? caught.message : "Unable to evaluate strategy scenario.",
      );
    } finally {
      setEvaluateRunning(false);
    }
  }

  async function confirmRemove() {
    if (removing === null) {
      return;
    }

    const label = removing.dimensionLabel;

    setRemoveRunning(true);

    try {
      await deleteStrategyScenarioAssumption(removing.id);

      await refresh();

      setRemoveId(null);

      toast.success("Assumption removed", label);
    } catch (caught) {
      setRemoveId(null);

      toast.error(
        "Could not remove the assumption",
        caught instanceof Error ? caught.message : "Unable to remove strategy assumption.",
      );
    } finally {
      setRemoveRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const kind = rationale;
    const copy = rationaleCopy(kind, scenario);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(kind, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, scenario.scenarioNumber);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to finalize strategy scenario.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(kind: RationaleKind) {
    setRationaleError(null);
    setRationale(kind);
  }

  async function handleSaved(updated: StrategyScenarioDetail, label: string) {
    applyDetail(updated);

    setAdding(false);

    toast.success("Assumption saved", `${label} — evaluate again to refresh the simulation`);
  }

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, scenario) : null;

  const kpis: KpiItem[] = [
    {
      label: "Frozen baseline",
      icon: Gauge,
      value: scenario.baselineOverallScore.toFixed(1),
      note: readable(String(scenario.baselineHealth)),
    },
    {
      label: "Latest simulation",
      icon: Play,
      value: scenario.latestSimulatedScore === null ? "—" : scenario.latestSimulatedScore.toFixed(1),
      note: scenario.latestSimulatedHealth
        ? readable(String(scenario.latestSimulatedHealth))
        : "Not evaluated",
    },
    {
      label: "Score delta",
      icon: TrendingDown,
      value: scenario.latestDelta === null ? "—" : signed(scenario.latestDelta),
      note: scenario.latestMovement ? readable(String(scenario.latestMovement)) : "No movement yet",
      tone: dropped ? "warning" : "default",
    },
    {
      label: "Assumptions",
      icon: SlidersHorizontal,
      value: String(assumptions.length),
      note: "Explicit dimension adjustments",
    },
  ];

  const assumptionColumns = buildAssumptionColumns({
    canRemove: canManage && editable,
    busy: busyAny,
    onRemove: (assumption) => setRemoveId(String(assumption.id)),
  });

  const evaluationColumns = buildEvaluationColumns();

  return (
    <div className="page-stack">
      <Link href="/strategy-scenarios" className="request-back-link">
        <ArrowLeft size={16} />
        Strategy scenarios
      </Link>

      <section className="scenario-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{scenario.scenarioNumber}</span>

            <ScenarioBadge status={status} />
          </div>

          <span className="eyebrow">What-if scenario</span>

          <h1>{scenario.name}</h1>

          <p>
            {"FY "}
            {scenario.fiscalYear}
            {" · "}
            {scenario.currency}
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

          {canFinalize && (evaluated || approvedStatus) ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => openRationale("ARCHIVE")}
            >
              <Archive size={15} />
              Archive
            </button>
          ) : null}

          {canAdd ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add assumption
            </button>
          ) : null}

          {canEvaluate ? (
            <button
              type="button"
              className={`button ${hasSimulation ? "button--secondary" : "button--primary"}`}
              disabled={busyAny || assumptions.length === 0}
              title={
                assumptions.length === 0
                  ? "Add at least one assumption before evaluating"
                  : undefined
              }
              onClick={() => setEvaluating(true)}
            >
              <Play size={15} />
              {hasSimulation ? "Re-evaluate" : "Evaluate scenario"}
            </button>
          ) : null}

          {canFinalize && evaluated ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale("APPROVE")}
            >
              <BadgeCheck size={16} />
              Approve planning scenario
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

      {dropped && scenario.latestDelta !== null ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The simulation lowers the overall score.</strong> It moves by{" "}
            {signed(scenario.latestDelta)} points from the frozen baseline of{" "}
            {scenario.baselineOverallScore.toFixed(1)}.
          </div>
        </div>
      ) : null}

      {canAdd && assumptions.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: add the first assumption.</strong> Each assumption adjusts one board
            dimension, and the scenario needs at least one before it can be evaluated.
          </div>
        </div>
      ) : null}

      {canEvaluate && assumptions.length > 0 && latestEvaluation === null ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Evaluate the scenario to run the simulation.</strong> It applies{" "}
            {plural(assumptions.length, "assumption", "assumptions")} to the frozen baseline.
          </div>
        </div>
      ) : null}

      {canEvaluate && assumptions.length > 0 && latestEvaluation !== null ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Changed an assumption?</strong> Evaluate again so the simulation reflects the
            current assumptions. Every evaluation is stored as an immutable record.
          </div>
        </div>
      ) : null}

      {evaluated && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting a planning decision.</strong> Approve the scenario as a governed
            planning record, or archive it.
          </div>
        </div>
      ) : null}

      {evaluated && !canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting a planning decision.</strong> A procurement manager or administrator
            needs to approve or archive the scenario.
          </div>
        </div>
      ) : null}

      {approvedStatus ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This scenario is approved.</strong> It is a governed planning record and no
            longer editable.
          </div>
        </div>
      ) : null}

      {archived ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This scenario is archived.</strong> It can no longer be edited, evaluated or
            approved.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Scenario summary" />

      {hasSimulation && scenario.latestSimulatedScore !== null ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Overall score comparison</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={scenario.baselineOverallScore}
            tone="primary"
            caption={`Frozen baseline ${scenario.baselineOverallScore.toFixed(1)} of 100`}
            label="Frozen baseline score"
          />

          <ProgressLine
            pct={scenario.latestSimulatedScore}
            tone={
              scenario.latestSimulatedScore >= scenario.baselineOverallScore
                ? meterToneFor("success")
                : "primary"
            }
            caption={`Latest simulation ${scenario.latestSimulatedScore.toFixed(1)} of 100`}
            label="Latest simulated score"
          />
        </section>
      ) : null}

      {scenario.description ? (
        <section className="panel scenario-description">
          <p>{scenario.description}</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Explicit planning assumptions</span>

            <h2>Dimension adjustments</h2>
          </div>

          {canAdd ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add assumption
            </button>
          ) : (
            <Goal size={19} />
          )}
        </div>

        <DataTable
          columns={assumptionColumns}
          rows={orderedAssumptions}
          getRowId={(item) => String(item.id)}
          ariaLabel="Dimension adjustments"
          busy={fetching}
          empty={
            <EmptyState
              icon={SlidersHorizontal}
              title="No assumptions"
              description="No assumptions have been defined."
              action={
                canAdd ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add assumption
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {latestEvaluation ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Latest immutable evaluation</span>

              <h2>{latestEvaluation.evaluation.evaluationNumber}</h2>
            </div>

            <Link
              href={`/strategy-scenarios/evaluations/${latestEvaluation.evaluation.id}`}
              className="table-action"
            >
              Open frozen evaluation
            </Link>
          </div>

          <p className="scenario-evaluation-summary">{latestEvaluation.generatedSummary}</p>

          <DataTable
            columns={evaluationColumns}
            rows={latestEvaluation.dimensions}
            getRowId={(item) => String(item.dimensionKey)}
            ariaLabel="Evaluation by dimension"
            busy={fetching}
          />
        </section>
      ) : null}

      {scenario.approvalNote ? (
        <section className="scenario-governance-note">
          <strong>{approvedStatus ? "Approved planning scenario" : "Governance decision"}</strong>

          <p>{scenario.approvalNote}</p>

          <small>
            {approvedStatus ? "Approved by " : "Decided by "}
            {scenario.approvedByName ?? "Procurement management"}
          </small>
        </section>
      ) : null}

      <section className="scenario-method-note">
        <Goal size={18} />

        <div>
          <strong>Approval does not execute the scenario</strong>

          <p>
            Approved scenarios are governed planning records only. They do not alter Step 50 board
            evidence, OKRs, capacity, assignments, capability assessments or succession decisions.
          </p>
        </div>
      </section>

      {adding ? (
        <AssumptionModal
          scenarioId={params.id}
          onClose={() => setAdding(false)}
          onSaved={(updated, label) => void handleSaved(updated, label)}
        />
      ) : null}

      {evaluating ? (
        <ActionDialog
          eyebrow="Deterministic simulation"
          title={hasSimulation ? "Re-evaluate this scenario?" : "Evaluate this scenario?"}
          description={`Evaluation applies ${plural(assumptions.length, "governed assumption", "governed assumptions")} to the frozen baseline, clamps each dimension to 0–100, applies the Step 50 board weights, and stores an immutable evaluation.`}
          confirmLabel={hasSimulation ? "Re-evaluate" : "Evaluate scenario"}
          busyLabel="Evaluating…"
          cancelLabel="Not yet"
          busy={evaluateRunning}
          onConfirm={() => void confirmEvaluate()}
          onCancel={() => setEvaluating(false)}
        />
      ) : null}

      {removing !== null ? (
        <ActionDialog
          eyebrow="Scenario modeling"
          title="Remove this assumption?"
          description={`The ${signed(removing.adjustmentPoints)} point adjustment to ${removing.dimensionLabel} will be removed from the scenario. Evaluate again afterwards to refresh the simulation.`}
          confirmLabel="Remove assumption"
          busyLabel="Removing…"
          cancelLabel="Keep assumption"
          busy={removeRunning}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoveId(null)}
        />
      ) : null}

      {rationale !== null && rationaleInfo !== null ? (
        <RationaleDialog
          eyebrow={rationaleInfo.eyebrow}
          title={rationaleInfo.title}
          description={rationaleInfo.description}
          label={rationaleInfo.label}
          placeholder={rationaleInfo.placeholder}
          confirmLabel={rationaleInfo.confirm}
          busyLabel={rationaleInfo.busy}
          cancelLabel={rationaleInfo.cancelLabel}
          tone="primary"
          maxLength={4000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
