"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  Gauge,
  Goal,
  Hourglass,
  Info,
  RefreshCw,
  Send,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  closeStrategicValueCase,
  getStrategicValueCase,
  submitStrategicValueForReview,
  verifyStrategicValueCase,
} from "@/lib/api";
import type { StrategicValueCaseDetail } from "@/types/strategic-value";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ValueCase = StrategicValueCaseDetail["valueCase"];
type RationaleRequest = { kind: "VERIFY" } | { kind: "CLOSE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function CaseBadge({ status }: { status: string }) {
  switch (status) {
    case "READY_FOR_REVIEW":
      return <StatusBadge value="IN_REVIEW" label="Ready for review" />;

    case "VERIFIED":
      return <StatusBadge value="COMPLETED" label="Verified" />;

    default:
      return <StatusBadge value={status} label={readable(status)} />;
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

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  done: string;
}

function rationaleCopy(request: RationaleRequest, valueCase: ValueCase): RationaleCopy {
  switch (request.kind) {
    case "VERIFY": {
      const below = valueCase.roiPct < valueCase.targetRoiPct - 0.05;

      return {
        eyebrow: "Independent financial governance",
        title: "Verify value case",
        description: `${valueCase.caseNumber} will be verified with an ROI of ${valueCase.roiPct.toFixed(1)}% against a target of ${valueCase.targetRoiPct.toFixed(1)}% and a net value of ${money(valueCase.netValueAmount, valueCase.currency)}.${below ? " The ROI is below the target, so the note should explain why the case is verified." : ""}`,
        label: "Verification note",
        placeholder: "What supports the governed valuation?",
        confirm: "Verify value case",
        busy: "Verifying…",
        done: "Value case verified",
      };
    }

    case "CLOSE":
      return {
        eyebrow: "Governance closure",
        title: "Close value case",
        description: `${valueCase.caseNumber} was verified. Closing it finishes the governance lifecycle.`,
        label: "Closure note",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close value case",
        busy: "Closing…",
        done: "Value case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<StrategicValueCaseDetail> {
  switch (request.kind) {
    case "VERIFY":
      return verifyStrategicValueCase(caseId, note);

    case "CLOSE":
      return closeStrategicValueCase(caseId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface CaseData {
  id: string;
  detail: StrategicValueCaseDetail;
}

export default function StrategicValueCasePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<CaseData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitRunning, setSubmitRunning] = useState(false);
  const [rationale, setRationale] = useState<RationaleRequest | null>(null);
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
        const response = await getStrategicValueCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load strategic value case.",
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

  function applyDetail(updated: StrategicValueCaseDetail) {
    setResult((current) => (current ? { ...current, detail: updated } : current));
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
        <Link href="/strategic-value" className="request-back-link">
          <ArrowLeft size={16} />
          Strategic value
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

  const { valueCase: vc } = detail;
  const currency = vc.currency;
  const status = String(vc.status);
  const active = status === "ACTIVE";
  const ready = status === "READY_FOR_REVIEW";
  const verified = status === "VERIFIED";
  const closed = status === "CLOSED";
  const busyAny = submitRunning || rationaleRunning;
  const belowTarget = vc.roiPct < vc.targetRoiPct - 0.05;
  const paybackLate = vc.paybackMonths !== null && vc.paybackMonths > vc.targetPaybackMonths + 0.05;
  const atRisk = vc.valueAtRiskAmount > 0.005;
  const roiAgainstTarget = vc.targetRoiPct > 0 ? (vc.roiPct / vc.targetRoiPct) * 100 : 0;

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      applyDetail(await submitStrategicValueForReview(params.id));

      setSubmitting(false);

      toast.success("Submitted for review", vc.caseNumber);
    } catch (caught) {
      setSubmitting(false);

      toast.error(
        "Could not submit the value case",
        caught instanceof Error ? caught.message : "Unable to submit strategic value case.",
      );
    } finally {
      setSubmitRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, vc);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, vc.caseNumber);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to record the decision.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(request: RationaleRequest) {
    setRationaleError(null);
    setRationale(request);
  }

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, vc) : null;

  const kpis: KpiItem[] = [
    {
      label: "ROI",
      icon: Gauge,
      value: `${vc.roiPct.toFixed(1)}%`,
      note: `Target ${vc.targetRoiPct.toFixed(1)}%`,
      tone: belowTarget ? "warning" : "default",
    },
    {
      label: "Investment",
      icon: Coins,
      value: money(vc.investmentCostAmount, currency),
      note: "Governed investment cost",
    },
    {
      label: "Durable value",
      icon: WalletCards,
      value: money(vc.durableHorizonValueAmount, currency),
      note: `Over ${vc.valueHorizonMonths} months`,
    },
    {
      label: "Net value",
      icon: BadgeCheck,
      value: money(vc.netValueAmount, currency),
      note: "Durable value less total cost",
    },
    {
      label: "Value at risk",
      icon: TrendingDown,
      value: money(vc.valueAtRiskAmount, currency),
      note: "Lost to persistence decay",
      tone: atRisk ? "warning" : "default",
    },
    {
      label: "Payback",
      icon: Hourglass,
      value: vc.paybackMonths === null ? "N/A" : `${vc.paybackMonths.toFixed(1)} mo`,
      note: `Target ${vc.targetPaybackMonths.toFixed(1)} mo`,
      tone: paybackLate ? "warning" : "default",
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/strategic-value" className="request-back-link">
        <ArrowLeft size={16} />
        Strategic value
      </Link>

      <section className="value-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{vc.caseNumber}</span>

            <CaseBadge status={status} />

            <StatusBadge value={String(vc.valueHealth)} label={readable(String(vc.valueHealth))} />
          </div>

          <span className="eyebrow">Long-term ROI governance</span>

          <h1>{vc.initiativeTitle}</h1>

          <p>
            {vc.persistencePlanNumber}
            {" · "}
            {vc.commitmentNumber}
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

          {canManage && active ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setSubmitting(true)}
            >
              <Send size={15} />
              Submit for review
            </button>
          ) : null}

          {canFinalize && ready ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "VERIFY" })}
            >
              <BadgeCheck size={16} />
              Verify value case
            </button>
          ) : null}

          {canFinalize && verified ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "CLOSE" })}
            >
              Close case
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

      {belowTarget ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>ROI is below the target.</strong> It is {vc.roiPct.toFixed(1)}% against a
            target of {vc.targetRoiPct.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {paybackLate && vc.paybackMonths !== null ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Payback is slower than the target.</strong> It is {vc.paybackMonths.toFixed(1)}{" "}
            months against a target of {vc.targetPaybackMonths.toFixed(1)} months.
          </div>
        </div>
      ) : null}

      {active && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Submit the value case when the valuation is final.</strong> Submission freezes
            the governed financial assumptions for independent management verification. Upstream
            Step 53 and Step 55 evidence stays read-only.
          </div>
        </div>
      ) : null}

      {ready ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting independent verification.</strong>{" "}
            {canFinalize
              ? "Use Verify value case above."
              : "A procurement manager or administrator needs to verify it."}
          </div>
        </div>
      ) : null}

      {verified && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The value case is verified.</strong> Close it to finish the governance
            lifecycle.
          </div>
        </div>
      ) : null}

      {closed ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This value case is closed.</strong> The governed valuation is final.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Value case summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Return and persistence</h2>
          </div>

          <Gauge size={19} />
        </div>

        <ProgressLine
          pct={roiAgainstTarget}
          tone={belowTarget ? "primary" : meterToneFor("success")}
          caption={`ROI ${vc.roiPct.toFixed(1)}% against a target of ${vc.targetRoiPct.toFixed(1)}%`}
          label="ROI against the target"
        />

        <ProgressLine
          pct={vc.persistencePct}
          tone="primary"
          caption={`Step 55 persistence ${vc.persistencePct.toFixed(1)}% — ${money(vc.durableAnnualValueAmount, currency)} durable of ${money(vc.annualizedValueAmount, currency)} annualized value`}
          label="Value persistence"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Durable-value bridge</span>

            <h2>Persistence-adjusted economics</h2>
          </div>

          <Goal size={19} />
        </div>

        <div className="value-bridge-grid">
          <div>
            <span>Step 53 validated contribution</span>

            <strong>{vc.step53ValidatedContributionPoints.toFixed(1)} pts</strong>
          </div>

          <div>
            <span>Step 55 persistence</span>

            <strong>{vc.persistencePct.toFixed(1)}%</strong>
          </div>

          <div>
            <span>Annualized baseline value</span>

            <strong>{money(vc.annualizedValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Durable annual value</span>

            <strong>{money(vc.durableAnnualValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Baseline horizon value</span>

            <strong>{money(vc.baselineHorizonValueAmount, currency)}</strong>
          </div>

          <div>
            <span>Decayed value</span>

            <strong className="value-risk-text">{money(vc.decayedValueAmount, currency)}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Financial authority</span>

            <h2>Governed valuation baseline</h2>
          </div>
        </div>

        <div className="value-financial-grid">
          <div>
            <span>Value owner</span>

            <strong>{vc.valueOwnerName}</strong>
          </div>

          <div>
            <span>Currency</span>

            <strong>{currency}</strong>
          </div>

          <div>
            <span>Horizon</span>

            <strong>{vc.valueHorizonMonths} months</strong>
          </div>

          <div>
            <span>Annual operating cost</span>

            <strong>{money(vc.annualOperatingCostAmount, currency)}</strong>
          </div>

          <div>
            <span>Total cost</span>

            <strong>{money(vc.totalCostAmount, currency)}</strong>
          </div>

          <div>
            <span>Status</span>

            <strong>{readable(status)}</strong>
          </div>
        </div>

        <div className="value-valuation-note">
          <strong>Valuation evidence</strong>

          <p>{vc.valuationNote}</p>
        </div>
      </section>

      <div className="value-source-links">
        <Link href={`/outcome-persistence/${vc.persistencePlanId}`} className="table-action">
          Step 55 persistence evidence
        </Link>

        <Link href={`/strategy-execution/${vc.commitmentId}`} className="table-action">
          Step 53 execution evidence
        </Link>
      </div>

      {vc.verificationNote ? (
        <section className="value-verification-note">
          <strong>Independent verification</strong>

          <p>{vc.verificationNote}</p>

          <small>
            {vc.verifiedByName ?? "Management"}
            {vc.verifiedAt ? ` · ${formatDateTime(vc.verifiedAt)}` : ""}
          </small>
        </section>
      ) : null}

      <section className="value-method-note">
        <Goal size={18} />

        <div>
          <strong>ROI uses only governed monetary assumptions</strong>

          <p>
            Persistence percentage adjusts the separately entered financial value baseline.
            Contribution points remain non-monetary evidence and are displayed only for
            traceability.
          </p>
        </div>
      </section>

      {submitting ? (
        <ActionDialog
          eyebrow="Independent review gate"
          title="Submit value case for review?"
          description={`${vc.caseNumber} will be submitted at an ROI of ${vc.roiPct.toFixed(1)}% against a target of ${vc.targetRoiPct.toFixed(1)}%. The governed financial assumptions are frozen for independent management verification.`}
          confirmLabel="Submit for review"
          busyLabel="Submitting…"
          cancelLabel="Not yet"
          busy={submitRunning}
          onConfirm={() => void confirmSubmit()}
          onCancel={() => setSubmitting(false)}
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
          tone="primary"
          maxLength={5000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
