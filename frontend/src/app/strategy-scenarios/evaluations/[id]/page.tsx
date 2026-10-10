"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CircleAlert,
  ExternalLink,
  Gauge,
  Goal,
  Info,
  Play,
  RefreshCw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
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
  StatusBadge,
  formatDateTime,
  meterToneFor,
  readable,
} from "@/components/kit";
import { getStrategyScenarioEvaluation } from "@/lib/api";
import type { StrategyScenarioEvaluationDetail } from "@/types/strategy-scenario";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type EvaluationDimension = StrategyScenarioEvaluationDetail["dimensions"][number];

function signed(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function Signed({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span
      className={
        value > 0.005 ? "scenario-positive" : value < -0.005 ? "scenario-negative" : undefined
      }
    >
      {signed(value)}
      {suffix}
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

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildDimensionColumns(): Column<EvaluationDimension>[] {
  return [
    {
      id: "dimension",
      header: "Dimension",
      sortValue: (item) => String(item.dimensionLabel).toLowerCase(),
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
      cell: (item) => <Signed value={item.adjustmentPoints} suffix=" pts" />,
    },
    {
      id: "simulated",
      header: "Simulated",
      align: "right",
      sortValue: (item) => item.simulatedScore,
      cell: (item) => <strong>{item.simulatedScore.toFixed(1)}</strong>,
    },
    {
      id: "contribution",
      header: "Contribution",
      align: "right",
      sortValue: (item) => item.weightedContribution,
      cell: (item) => item.weightedContribution.toFixed(1),
    },
    {
      id: "impact",
      header: "Weighted impact",
      align: "right",
      sortValue: (item) => ((item.simulatedScore - item.baselineScore) * item.weightPct) / 100,
      cell: (item) => (
        <Signed value={((item.simulatedScore - item.baselineScore) * item.weightPct) / 100} />
      ),
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
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface EvaluationData {
  id: string;
  detail: StrategyScenarioEvaluationDetail;
}

export default function StrategyScenarioEvaluationPage() {
  const params = useParams<{ id: string }>();

  const [result, setResult] = useState<EvaluationData | null>(null);
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
        const response = await getStrategyScenarioEvaluation(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load strategy scenario evaluation.",
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

  const { evaluation, dimensions } = detail;
  const delta = evaluation.scoreDelta;
  const dropped = delta < -0.05;
  const deteriorated = evaluation.deterioratedDimensionCount;
  const clamped = dimensions.filter(
    (dimension) =>
      Math.abs(dimension.baselineScore + dimension.adjustmentPoints - dimension.simulatedScore) >
      0.05,
  );

  const kpis: KpiItem[] = [
    {
      label: "Baseline",
      icon: Gauge,
      value: evaluation.baselineOverallScore.toFixed(1),
      note: "Frozen board score",
    },
    {
      label: "Simulated",
      icon: Play,
      value: evaluation.simulatedOverallScore.toFixed(1),
      note: readable(String(evaluation.simulatedHealth)),
    },
    {
      label: "Delta",
      icon: Activity,
      value: signed(delta),
      note: readable(String(evaluation.movement)),
      tone: dropped ? "warning" : "default",
    },
    {
      label: "Improved dimensions",
      icon: TrendingUp,
      value: String(evaluation.improvedDimensionCount),
      note: "Above their baseline",
    },
    {
      label: "Deteriorated dimensions",
      icon: TrendingDown,
      value: String(deteriorated),
      note: "Below their baseline",
      tone: deteriorated > 0 ? "warning" : "default",
    },
    {
      label: "Dimensions evaluated",
      icon: SlidersHorizontal,
      value: String(dimensions.length),
      note: "Board dimensions",
    },
  ];

  const dimensionColumns = buildDimensionColumns();

  return (
    <div className="page-stack">
      <Link href={`/strategy-scenarios/${evaluation.scenarioId}`} className="request-back-link">
        <ArrowLeft size={16} />
        Scenario
      </Link>

      <section className="scenario-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{evaluation.evaluationNumber}</span>

            <StatusBadge
              value={String(evaluation.simulatedHealth)}
              label={readable(String(evaluation.simulatedHealth))}
            />
          </div>

          <span className="eyebrow">Immutable what-if evaluation</span>

          <h1>{evaluation.evaluationNumber}</h1>

          <p>
            Evaluated by {evaluation.evaluatedByName}
            {" · "}
            {formatDateTime(evaluation.evaluatedAt)}
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

          <Link
            href={`/strategy-scenarios/${evaluation.scenarioId}`}
            className="button button--secondary"
          >
            <ExternalLink size={15} />
            Open scenario
          </Link>
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

      {dropped ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The simulation lowers the overall score.</strong> It moves by {signed(delta)}{" "}
            points, from a baseline of {evaluation.baselineOverallScore.toFixed(1)} to{" "}
            {evaluation.simulatedOverallScore.toFixed(1)}
            {deteriorated > 0
              ? `, with ${plural(deteriorated, "dimension", "dimensions")} deteriorating.`
              : "."}
          </div>
        </div>
      ) : null}

      {!dropped && deteriorated > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Some dimensions deteriorate.</strong> The overall score does not fall, but{" "}
            {plural(deteriorated, "dimension scores", "dimensions score")} lower than baseline, so
            review the trade-off below.
          </div>
        </div>
      ) : null}

      {clamped.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(clamped.length, "dimension reached", "dimensions reached")} the 0–100 limit.
            </strong>{" "}
            {clamped.map((dimension) => dimension.dimensionLabel).join(", ")}. The adjustment did
            not take full effect there, because each dimension is clamped to 0–100.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Evaluation summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Overall score comparison</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={evaluation.baselineOverallScore}
          tone="primary"
          caption={`Baseline ${evaluation.baselineOverallScore.toFixed(1)} of 100`}
          label="Baseline score"
        />

        <ProgressLine
          pct={evaluation.simulatedOverallScore}
          tone={
            evaluation.simulatedOverallScore >= evaluation.baselineOverallScore
              ? meterToneFor("success")
              : "primary"
          }
          caption={`Simulated ${evaluation.simulatedOverallScore.toFixed(1)} of 100`}
          label="Simulated score"
        />
      </section>

      <section className="panel scenario-description">
        <p>{detail.generatedSummary}</p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Frozen simulation</span>

            <h2>Dimension trade-offs</h2>
          </div>

          <SlidersHorizontal size={19} />
        </div>

        <DataTable
          columns={dimensionColumns}
          rows={dimensions}
          getRowId={(dimension) => String(dimension.dimensionKey)}
          ariaLabel="Dimension trade-offs"
          busy={fetching}
          empty={
            <EmptyState
              icon={SlidersHorizontal}
              title="No dimensions"
              description="This evaluation has no dimension results."
            />
          }
        />
      </section>

      <section className="scenario-method-note">
        <Goal size={18} />

        <div>
          <strong>Frozen what-if evidence</strong>

          <p>
            This evaluation is immutable. Future scenario edits create a new evaluation instead of
            rewriting this result.
          </p>
        </div>
      </section>
    </div>
  );
}
