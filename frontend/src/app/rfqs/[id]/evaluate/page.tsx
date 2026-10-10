"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CircleAlert,
  Gauge,
  Info,
  Medal,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Star,
  Trophy,
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
  Skeleton,
  StatusBadge,
  meterToneFor,
  useToast,
} from "@/components/kit";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  calculateRfqEvaluation,
  createAwardDecision,
  getAwardDecision,
  getRfq,
  getRfqEvaluation,
  getRfqQuotations,
} from "@/lib/api";
import type {
  AwardDecision,
  RfqEvaluation,
  RfqEvaluationInput,
} from "@/types/evaluation";
import type { Quotation } from "@/types/quotation";
import type { Rfq } from "@/types/rfq";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Scorecard = RfqEvaluation["scorecards"][number];

interface WeightState {
  priceWeight: number;
  deliveryWeight: number;
  supplierRatingWeight: number;
  riskWeight: number;
  qualityWeight: number;
}

const DEFAULT_WEIGHTS: WeightState = {
  priceWeight: 40,
  deliveryWeight: 20,
  supplierRatingWeight: 15,
  riskWeight: 10,
  qualityWeight: 15,
};

const WEIGHT_FIELDS: { key: keyof WeightState; label: string }[] = [
  { key: "priceWeight", label: "Commercial price" },
  { key: "deliveryWeight", label: "Delivery" },
  { key: "supplierRatingWeight", label: "Supplier rating" },
  { key: "riskWeight", label: "Supplier risk" },
  { key: "qualityWeight", label: "Quality / technical" },
];

const DEFAULT_QUALITY = 80;

const ALLOWED_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const AWARD_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function weightsOf(evaluation: RfqEvaluation): WeightState {
  return {
    priceWeight: evaluation.priceWeight,
    deliveryWeight: evaluation.deliveryWeight,
    supplierRatingWeight: evaluation.supplierRatingWeight,
    riskWeight: evaluation.riskWeight,
    qualityWeight: evaluation.qualityWeight,
  };
}

function qualityOf(quotations: Quotation[], evaluation: RfqEvaluation): Record<string, string> {
  return Object.fromEntries(
    quotations.map((quotation) => [
      quotation.id,
      String(
        evaluation.scorecards.find((card) => card.quotationId === quotation.id)
          ?.qualityScore ?? DEFAULT_QUALITY,
      ),
    ]),
  );
}

/** True when the inputs on screen no longer match the last calculated evaluation. */
function isStale(
  weights: WeightState,
  quality: Record<string, string>,
  quotations: Quotation[],
  evaluation: RfqEvaluation,
): boolean {
  if (evaluation.scorecards.length === 0) {
    return false;
  }

  const base = weightsOf(evaluation);

  if (WEIGHT_FIELDS.some((field) => weights[field.key] !== base[field.key])) {
    return true;
  }

  return quotations.some((quotation) => {
    const card = evaluation.scorecards.find((item) => item.quotationId === quotation.id);

    return card === undefined || Number(quality[quotation.id]) !== card.qualityScore;
  });
}

const SCORECARD_COLUMNS: Column<Scorecard>[] = [
  {
    id: "rank",
    header: "Rank",
    width: 90,
    sortValue: (score) => score.rankPosition,
    cell: (score) =>
      score.recommended ? (
        <span className="kit-inline-icon">
          <Trophy size={15} />#{score.rankPosition}
        </span>
      ) : (
        `#${score.rankPosition}`
      ),
  },
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (score) => score.supplierName.toLowerCase(),
    cell: (score) => (
      <div className="request-primary-cell">
        <strong>{score.supplierName}</strong>

        <span>{score.quotationNumber}</span>

        {score.recommended ? (
          <StatusBadge value="RECOMMENDED" label="Recommended" tone="success" dot={false} />
        ) : null}
      </div>
    ),
  },
  {
    id: "price",
    header: "Price",
    align: "right",
    sortValue: (score) => score.priceScore,
    firstSort: "desc",
    cell: (score) => <span className="kit-num">{score.priceScore.toFixed(1)}</span>,
  },
  {
    id: "delivery",
    header: "Delivery",
    align: "right",
    sortValue: (score) => score.deliveryScore,
    firstSort: "desc",
    cell: (score) => <span className="kit-num">{score.deliveryScore.toFixed(1)}</span>,
  },
  {
    id: "rating",
    header: "Rating",
    align: "right",
    sortValue: (score) => score.supplierRatingScore,
    firstSort: "desc",
    cell: (score) => <span className="kit-num">{score.supplierRatingScore.toFixed(1)}</span>,
  },
  {
    id: "risk",
    header: "Risk",
    align: "right",
    sortValue: (score) => score.riskScore,
    firstSort: "desc",
    cell: (score) => <span className="kit-num">{score.riskScore.toFixed(1)}</span>,
  },
  {
    id: "quality",
    header: "Quality",
    align: "right",
    sortValue: (score) => score.qualityScore,
    firstSort: "desc",
    cell: (score) => <span className="kit-num">{score.qualityScore.toFixed(1)}</span>,
  },
  {
    id: "weighted",
    header: "Weighted score",
    sortValue: (score) => score.weightedTotalScore,
    firstSort: "desc",
    cell: (score) => (
      <div style={{ minWidth: 130 }}>
        <strong className="kit-num">{score.weightedTotalScore.toFixed(2)}</strong>

        <Meter
          value={score.weightedTotalScore}
          max={100}
          tone={score.recommended ? meterToneFor("success") : "primary"}
          ariaLabel={`Weighted score for ${score.supplierName}`}
        />
      </div>
    ),
  },
];

interface EvalData {
  id: string;
  rfq: Rfq;
  quotations: Quotation[];
  evaluation: RfqEvaluation;
  award: AwardDecision | undefined;
}

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

interface WorkspaceProps {
  data: EvalData;
  canAward: boolean;
  fetching: boolean;
  error: string | null;
  onRefresh: () => void;
  onEvaluated: (evaluation: RfqEvaluation) => void;
  onAwarded: (award: AwardDecision) => void;
}

function EvaluationWorkspace({
  data,
  canAward,
  fetching,
  error,
  onRefresh,
  onEvaluated,
  onAwarded,
}: WorkspaceProps) {
  const { id, rfq, quotations, evaluation, award } = data;
  const toast = useToast();

  const [weights, setWeights] = useState<WeightState>(() => weightsOf(evaluation));
  const [quality, setQuality] = useState<Record<string, string>>(() =>
    qualityOf(quotations, evaluation),
  );
  const [qualityErrors, setQualityErrors] = useState<Record<string, string>>({});
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardRunning, setAwardRunning] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  const weightTotal =
    weights.priceWeight +
    weights.deliveryWeight +
    weights.supplierRatingWeight +
    weights.riskWeight +
    weights.qualityWeight;

  const weightMessage =
    weightTotal === 100
      ? "Weights add up to 100%."
      : weightTotal < 100
        ? `${100 - weightTotal} points still to allocate.`
        : `${weightTotal - 100} points over. Reduce a weight.`;

  const scorecards = evaluation.scorecards;
  const hasScores = scorecards.length > 0;
  const stale = isStale(weights, quality, quotations, evaluation);
  const tooFewQuotations = quotations.length < 2;

  const recommendedId = evaluation.recommendedQuotationId ?? "";
  const selectedId = choice || recommendedId || (hasScores ? scorecards[0].quotationId : "");
  const override = selectedId !== "" && selectedId !== recommendedId;
  const recommendedCard = scorecards.find((card) => card.quotationId === recommendedId);

  const topScore = hasScores
    ? Math.max(...scorecards.map((card) => card.weightedTotalScore))
    : null;

  const showCalculator = !award && rfq.status !== "AWARDED";
  const canRecordAward = canAward && !award && rfq.status === "CLOSED" && hasScores;

  function discard() {
    setWeights(weightsOf(evaluation));
    setQuality(qualityOf(quotations, evaluation));
    setQualityErrors({});
    setCalcError(null);
  }

  async function handleCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (calculating) {
      return;
    }

    const nextErrors: Record<string, string> = {};

    for (const quotation of quotations) {
      const raw = (quality[quotation.id] ?? "").trim();
      const value = Number(raw);

      if (raw === "" || !Number.isFinite(value) || value < 0 || value > 100) {
        nextErrors[quotation.id] = "Enter a score from 0 to 100.";
      }
    }

    setQualityErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || weightTotal !== 100) {
      return;
    }

    setCalculating(true);
    setCalcError(null);

    try {
      const input: RfqEvaluationInput = {
        ...weights,
        qualityScores: quotations.map((quotation) => ({
          quotationId: quotation.id,
          qualityScore: Number(quality[quotation.id]),
        })),
      };

      const response = await calculateRfqEvaluation(id, input);

      onEvaluated(response);
      setChoice("");

      toast.success(
        "Evaluation calculated",
        response.recommendedSupplierName
          ? `Recommended: ${response.recommendedSupplierName}`
          : "Scorecards updated.",
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to calculate supplier evaluation.";

      setCalcError(message);
      toast.error("Could not calculate the evaluation", message);
    } finally {
      setCalculating(false);
    }
  }

  async function confirmAward(rationale: string) {
    if (awardRunning || selectedId === "") {
      return;
    }

    setAwardRunning(true);
    setAwardError(null);

    try {
      const response = await createAwardDecision(id, selectedId, rationale);

      onAwarded(response);
      setAwardOpen(false);

      toast.success("Award recorded", response.selectedSupplierName);
    } catch (caught) {
      setAwardError(
        caught instanceof Error ? caught.message : "Unable to record award decision.",
      );
    } finally {
      setAwardRunning(false);
    }
  }

  const kpis: KpiItem[] = [
    {
      label: "Suppliers evaluated",
      icon: Gauge,
      value: String(evaluation.evaluatedSupplierCount ?? 0),
      note: "Submitted quotations included in scoring.",
    },
    {
      label: "Recommended supplier",
      icon: Trophy,
      value: evaluation.recommendedSupplierName ?? "Not calculated",
      note: "Highest weighted evaluation result.",
    },
    {
      label: "Top score",
      icon: Star,
      value: topScore !== null ? topScore.toFixed(1) : "—",
      note: "Weighted score out of 100.",
    },
    {
      label: "Award status",
      icon: Award,
      value: award ? "Decision recorded" : "Pending",
      note: "Final sourcing decision status.",
    },
  ];

  const weightSummary = WEIGHT_FIELDS.map(
    (field) => `${field.label} ${weightsOf(evaluation)[field.key]}%`,
  ).join(" · ");

  return (
    <div className="page-stack">
      <Link href={`/rfqs/${rfq.id}`} className="request-back-link">
        <ArrowLeft size={16} />
        {rfq.rfqNumber}
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">Supplier selection</span>

          <h1>Evaluation &amp; award</h1>

          <p>
            Score submitted suppliers using commercial, delivery, performance, risk and
            quality criteria.
          </p>
        </div>

        <div className="page-heading__actions">
          <StatusBadge value={rfq.status} />

          <button
            type="button"
            className="button button--secondary"
            onClick={onRefresh}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={onRefresh}>
            Try again
          </button>
        </div>
      ) : null}

      {!award && rfq.status === "PUBLISHED" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Sourcing is still open.</strong> Evaluation can be calculated now, but
            the RFQ must be closed before a final award can be recorded.
          </div>
        </div>
      ) : null}

      {!award && rfq.status === "CLOSED" && !canAward ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awarding needs a higher role.</strong> Only an Admin or Procurement
            Manager can record the award decision.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Evaluation summary" />

      {showCalculator ? (
        <form className="page-stack" onSubmit={handleCalculate} noValidate>
          {tooFewQuotations ? (
            <div className="kit-callout kit-callout--warning" role="status">
              <AlertTriangle size={17} />

              <div>
                <strong>Not enough quotations.</strong> At least two submitted quotations are
                needed to compare suppliers. {quotations.length} submitted so far.
              </div>
            </div>
          ) : null}

          {stale ? (
            <div className="kit-callout kit-callout--warning" role="status">
              <AlertTriangle size={17} />

              <div>
                <strong>The ranking below is out of date.</strong> The weights or quality
                scores were changed after the last calculation. Recalculate, or discard
                the changes.
              </div>
            </div>
          ) : null}

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Evaluation model</span>

                <h2>Criteria weights</h2>
              </div>

              <button
                type="button"
                className="button button--secondary"
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                disabled={calculating}
              >
                <RotateCcw size={15} />
                Default weights
              </button>
            </div>

            <div className="evaluation-weight-grid">
              {WEIGHT_FIELDS.map((field) => (
                <Field key={field.key} label={field.label} htmlFor={`weight-${field.key}`}>
                  <input
                    id={`weight-${field.key}`}
                    className="kit-field-input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={weights[field.key]}
                    onChange={(event) =>
                      setWeights((current) => ({
                        ...current,
                        [field.key]: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
              ))}
            </div>

            <div className="kit-meter-wrap">
              <Meter
                value={Math.max(0, Math.min(weightTotal, 100))}
                max={100}
                tone={meterToneFor(
                  weightTotal === 100 ? "success" : weightTotal < 100 ? "warning" : "danger",
                )}
                ariaLabel="Total of the criteria weights"
              />

              <span
                className={
                  weightTotal === 100
                    ? "kit-meter-caption"
                    : "kit-meter-caption kit-meter-caption--late"
                }
              >
                {weightTotal}% allocated · {weightMessage}
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Technical assessment</span>

                <h2>Quality scores</h2>
              </div>
            </div>

            {quotations.length === 0 ? (
              <EmptyState
                compact
                icon={Gauge}
                title="No submitted quotations"
                description="Quality scores can be entered once suppliers submit quotations."
              />
            ) : (
              <div className="evaluation-quality-grid">
                {quotations.map((quotation) => (
                  <article key={quotation.id} className="evaluation-quality-card">
                    <div>
                      <strong>{quotation.supplierName}</strong>

                      <span>{quotation.quotationNumber}</span>
                    </div>

                    <Field
                      label="Quality score / 100"
                      htmlFor={`quality-${quotation.id}`}
                      error={qualityErrors[quotation.id]}
                    >
                      <input
                        id={`quality-${quotation.id}`}
                        className="kit-field-input"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={quality[quotation.id] ?? ""}
                        aria-invalid={qualityErrors[quotation.id] ? true : undefined}
                        onChange={(event) => {
                          setQuality((current) => ({
                            ...current,
                            [quotation.id]: event.target.value,
                          }));
                          setQualityErrors((current) => {
                            const next = { ...current };

                            delete next[quotation.id];

                            return next;
                          });
                        }}
                      />
                    </Field>
                  </article>
                ))}
              </div>
            )}

            {calcError ? (
              <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
                <CircleAlert size={18} />
                <span>{calcError}</span>
              </div>
            ) : null}

            <div className="kit-form-footer">
              {stale ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={discard}
                  disabled={calculating}
                >
                  Discard changes
                </button>
              ) : null}

              <button
                type="submit"
                className="button button--primary"
                disabled={calculating || tooFewQuotations || weightTotal !== 100}
              >
                <Save size={16} />
                {calculating ? "Calculating…" : "Calculate evaluation"}
              </button>
            </div>
          </section>
        </form>
      ) : null}

      {hasScores ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Supplier scorecards</span>

              <h2>Weighted ranking</h2>
            </div>
          </div>

          <p className="kit-month-summary">
            <span>Weights used: {weightSummary}</span>
          </p>

          <DataTable
            columns={SCORECARD_COLUMNS}
            rows={scorecards}
            getRowId={(score) => String(score.quotationId)}
            ariaLabel="Weighted supplier ranking"
            defaultSort={{ id: "rank", dir: "asc" }}
          />
        </section>
      ) : showCalculator && !tooFewQuotations ? (
        <section className="panel">
          <EmptyState
            icon={Gauge}
            title="No evaluation yet"
            description="Set the weights and quality scores above, then calculate the evaluation to rank the suppliers."
          />
        </section>
      ) : null}

      {award ? (
        <section className="panel award-result">
          <div className="award-result__icon">
            <Medal size={26} />
          </div>

          <div className="award-result__content">
            <span className="eyebrow">Award decision</span>

            <h2>{award.selectedSupplierName}</h2>

            <p>{award.rationale}</p>

            <div className="award-result__meta">
              <span>{award.selectedQuotationNumber}</span>

              <span>{money(award.selectedTotalAmount, rfq.currency)}</span>

              <span>Decided by {award.decidedByName}</span>

              {award.manualOverride ? (
                <StatusBadge
                  value="OVERRIDE"
                  label="Manual override"
                  tone="warning"
                  dot={false}
                />
              ) : (
                <StatusBadge
                  value="RECOMMENDED"
                  label="Recommended supplier selected"
                  tone="success"
                  dot={false}
                />
              )}
            </div>
          </div>
        </section>
      ) : null}

      {!award && rfq.status === "CLOSED" && canAward && !hasScores ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Calculate the evaluation first.</strong> Awarding becomes available once
            the suppliers have been scored.
          </div>
        </div>
      ) : null}

      {canRecordAward ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Sourcing decision</span>

              <h2>Award supplier</h2>
            </div>

            <Award size={19} />
          </div>

          <p className="kit-month-summary">
            {recommendedCard ? (
              <span>
                Recommended: <strong>{recommendedCard.supplierName}</strong> with a weighted
                score of <strong>{recommendedCard.weightedTotalScore.toFixed(2)}</strong>
              </span>
            ) : (
              <span>No supplier is currently recommended.</span>
            )}
          </p>

          <div className="kit-form-footer">
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setAwardError(null);
                setAwardOpen(true);
              }}
            >
              <Award size={16} />
              Award supplier
            </button>
          </div>
        </section>
      ) : null}

      {awardOpen ? (
        <RationaleDialog
          eyebrow="Sourcing decision"
          title="Record award decision"
          description={`Choose the winning quotation for ${rfq.rfqNumber} and record the reason.`}
          label="Award rationale"
          placeholder={
            override
              ? "A different supplier is selected. Explain the business justification for overriding the recommendation."
              : "Explain the sourcing decision and why this supplier is being awarded."
          }
          confirmLabel="Record award"
          busyLabel="Recording…"
          maxLength={3000}
          busy={awardRunning}
          error={awardError}
          onConfirm={(reason) => void confirmAward(reason)}
          onCancel={() => setAwardOpen(false)}
        >
          <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
            <Field label="Selected quotation" htmlFor="award-quotation">
              <select
                id="award-quotation"
                className="kit-field-input"
                value={selectedId}
                disabled={awardRunning}
                onChange={(event) => setChoice(event.target.value)}
              >
                {scorecards.map((score) => (
                  <option key={score.quotationId} value={score.quotationId}>
                    {score.supplierName} — {score.weightedTotalScore.toFixed(2)}
                  </option>
                ))}
              </select>
            </Field>

            {override ? (
              <div className="kit-callout kit-callout--warning" role="status">
                <AlertTriangle size={17} />

                <div>
                  <strong>Manual override.</strong> You are selecting a supplier other than
                  the system recommendation. This will be recorded as an override.
                </div>
              </div>
            ) : null}

            {stale ? (
              <div className="kit-callout kit-callout--info" role="status">
                <Info size={17} />

                <div>
                  The weights or quality scores on screen differ from the last calculation.
                  The award is based on the calculated ranking shown above.
                </div>
              </div>
            ) : null}
          </div>
        </RationaleDialog>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function EvaluationPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const allowed = user !== null && ALLOWED_ROLES.includes(user.role);
  const canAward = user !== null && AWARD_ROLES.includes(user.role);

  const [result, setResult] = useState<EvalData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const [rfqResponse, quotationResponse, evaluationResponse, awardResponse] =
          await Promise.all([
            getRfq(id),
            getRfqQuotations(id),
            getRfqEvaluation(id),
            getAwardDecision(id),
          ]);

        if (active) {
          setResult({
            id,
            rfq: rfqResponse,
            quotations: quotationResponse.filter(
              (quotation) => quotation.status === "SUBMITTED",
            ),
            evaluation: evaluationResponse,
            award: awardResponse,
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load supplier evaluation.",
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
  }, [allowed, params.id, reloadKey]);

  const data = result !== null && result.id === params.id ? result : null;

  function handleEvaluated(evaluation: RfqEvaluation) {
    setResult((current) => (current ? { ...current, evaluation } : current));
  }

  function handleAwarded(award: AwardDecision) {
    setResult((current) =>
      current
        ? { ...current, award, rfq: { ...current.rfq, status: "AWARDED" } }
        : current,
    );
  }

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="Access restricted"
            description="Your role cannot access supplier evaluation."
          />
        </section>
      </div>
    );
  }

  if (data === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={110} />
          <Skeleton height={96} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/rfqs" className="request-back-link">
          <ArrowLeft size={16} />
          RFQs &amp; sourcing
        </Link>

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
      </div>
    );
  }

  return (
    <EvaluationWorkspace
      key={data.id}
      data={data}
      canAward={canAward}
      fetching={fetching}
      error={error}
      onRefresh={() => setReloadKey((key) => key + 1)}
      onEvaluated={handleEvaluated}
      onAwarded={handleAwarded}
    />
  );
}
