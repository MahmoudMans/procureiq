"use client";

import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  FileCheck2,
  Gauge,
  Goal,
  Info,
  Plus,
  RefreshCw,
  Send,
  TrendingDown,
  WalletCards,
  XCircle,
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
  Modal,
  Skeleton,
  StatusBadge,
  formatDateTime,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  closeInvestmentInterventionCase,
  decideInvestmentIntervention,
  getInvestmentInterventionCase,
  proposeInvestmentInterventionAction,
  submitInvestmentInterventionForReview,
} from "@/lib/api";
import type {
  InvestmentInterventionAction,
  InvestmentInterventionCaseDetail,
} from "@/types/investment-intervention";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type InterventionCase = InvestmentInterventionCaseDetail["interventionCase"];
type Proposal = InvestmentInterventionCaseDetail["proposals"][number];
type Target = InvestmentInterventionCaseDetail["reallocationTargets"][number];
type ProposalField = "amount" | "target" | "rationale";
type RationaleRequest = { kind: "APPROVE" } | { kind: "REJECT" } | { kind: "CLOSE" };

interface ComparisonRow {
  id: string;
  measure: string;
  source: string;
  current: string;
  change: string;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const ACTIONS: { value: InvestmentInterventionAction; label: string; hint: string }[] = [
  {
    value: "CONTINUE",
    label: "Continue",
    hint: "Keep funding on its current course. No capital is affected.",
  },
  {
    value: "HOLD_FUTURE_RELEASES",
    label: "Hold future releases",
    hint: "Hold further releases of the affected unreleased capital. Released capital is not changed.",
  },
  {
    value: "REDUCE_UNRELEASED",
    label: "Reduce unreleased capital",
    hint: "Reduce the unreleased commitment. Released capital is never changed.",
  },
  {
    value: "REALLOCATE_UNRELEASED",
    label: "Reallocate unreleased capital",
    hint: "Propose moving unreleased capital to another governed Step 56 value case. The reallocation is not executed automatically.",
  },
];

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function signedMoney(value: number, currency: string): string {
  if (Math.abs(value) < 0.005) {
    return "Unchanged";
  }

  return `${value > 0 ? "+" : ""}${money(value, currency)}`;
}

function signedPoints(value: number): string {
  if (Math.abs(value) < 0.05) {
    return "Unchanged";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pts`;
}

function amountFor(action: InvestmentInterventionAction, interventionCase: InterventionCase): number {
  if (action === "CONTINUE") {
    return 0;
  }

  return interventionCase.currentRecommendedAffectedCapitalAmount > 0
    ? interventionCase.currentRecommendedAffectedCapitalAmount
    : interventionCase.currentRemainingCommitmentAmount;
}

function CaseBadge({ status }: { status: string }) {
  return <StatusBadge value={status} label={readable(status)} />;
}

function ProposalDecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return <StatusBadge value="PENDING" label="Awaiting decision" />;
  }

  return <StatusBadge value={decision} label={readable(decision)} />;
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
  tone: "primary" | "danger";
  done: string;
}

function rationaleCopy(
  request: RationaleRequest,
  interventionCase: InterventionCase,
  pending: Proposal | null,
): RationaleCopy {
  const proposalText = pending
    ? `${readable(String(pending.actionType))} affecting ${money(pending.affectedCapitalAmount, interventionCase.currency)}`
    : "the submitted proposal";

  switch (request.kind) {
    case "APPROVE":
      return {
        eyebrow: "Independent intervention decision",
        title: "Approve intervention",
        description: `${interventionCase.interventionNumber} will be approved with ${proposalText}. Approval records a governance decision; it does not move any capital automatically.`,
        label: "Decision rationale",
        placeholder: "Why is this intervention approved?",
        confirm: "Approve intervention",
        busy: "Approving…",
        tone: "primary",
        done: "Intervention approved",
      };

    case "REJECT":
      return {
        eyebrow: "Independent intervention decision",
        title: "Reject proposal",
        description: `The proposal for ${interventionCase.interventionNumber} (${proposalText}) will be rejected and no governance action will be approved.`,
        label: "Decision rationale",
        placeholder: "Why is this proposal rejected?",
        confirm: "Reject proposal",
        busy: "Rejecting…",
        cancelLabel: "Keep proposal",
        tone: "danger",
        done: "Proposal rejected",
      };

    case "CLOSE":
      return {
        eyebrow: "Governance closure",
        title: "Close intervention case",
        description: `${interventionCase.interventionNumber} was approved. Closing it finishes the governance lifecycle.`,
        label: "Closure note",
        placeholder: "Summarise why this case can be closed.",
        confirm: "Close governance case",
        busy: "Closing…",
        tone: "primary",
        done: "Intervention case closed",
      };
  }
}

function performRationale(
  request: RationaleRequest,
  caseId: string,
  note: string,
): Promise<InvestmentInterventionCaseDetail> {
  switch (request.kind) {
    case "APPROVE":
      return decideInvestmentIntervention(caseId, {
        decision: "APPROVED",
        decisionNote: note,
      });

    case "REJECT":
      return decideInvestmentIntervention(caseId, {
        decision: "REJECTED",
        decisionNote: note,
      });

    case "CLOSE":
      return closeInvestmentInterventionCase(caseId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildComparisonColumns(): Column<ComparisonRow>[] {
  return [
    {
      id: "measure",
      header: "Measure",
      cell: (row) => <strong>{row.measure}</strong>,
    },
    {
      id: "source",
      header: "Source snapshot",
      align: "right",
      cell: (row) => row.source,
    },
    {
      id: "current",
      header: "Current evidence",
      align: "right",
      cell: (row) => row.current,
    },
    {
      id: "change",
      header: "Change",
      align: "right",
      cell: (row) => row.change,
    },
  ];
}

function buildProposalColumns(currency: string): Column<Proposal>[] {
  return [
    {
      id: "action",
      header: "Action",
      sortValue: (item) => String(item.actionType),
      cell: (item) => (
        <div className="request-primary-cell">
          <strong>{readable(String(item.actionType))}</strong>

          {item.targetValueCaseNumber ? (
            <span>
              Target: {item.targetValueCaseNumber} — {item.targetInitiativeTitle}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "affected",
      header: "Affected capital",
      align: "right",
      sortValue: (item) => item.affectedCapitalAmount,
      cell: (item) => <strong>{money(item.affectedCapitalAmount, currency)}</strong>,
    },
    {
      id: "source",
      header: "Source remaining",
      align: "right",
      sortValue: (item) => item.sourceRemainingCapitalSnapshot,
      cell: (item) => money(item.sourceRemainingCapitalSnapshot, currency),
    },
    {
      id: "rationale",
      header: "Rationale",
      cell: (item) => <span>{item.proposalRationale}</span>,
    },
    {
      id: "by",
      header: "Proposed by",
      sortValue: (item) => String(item.proposedByName ?? "").toLowerCase(),
      cell: (item) => item.proposedByName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (item) => (item.decision ? String(item.decision.decision) : ""),
      cell: (item) => (
        <div className="kit-cell-stack">
          <ProposalDecisionBadge decision={item.decision ? String(item.decision.decision) : null} />

          {item.decision ? <small>{item.decision.decisionNote}</small> : null}

          {item.decision ? (
            <small>
              By {item.decision.decidedByName} · {formatDateTime(item.decision.decidedAt)}
            </small>
          ) : null}
        </div>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Propose intervention modal                                          */
/* ------------------------------------------------------------------ */

interface ProposeModalProps {
  caseId: string;
  interventionCase: InterventionCase;
  targets: Target[];
  onClose: () => void;
  onSaved: (updated: InvestmentInterventionCaseDetail, label: string) => void;
}

function ProposeModal({ caseId, interventionCase, targets, onClose, onSaved }: ProposeModalProps) {
  const currency = interventionCase.currency;
  const remaining = interventionCase.currentRemainingCommitmentAmount;
  const advisory = interventionCase.currentRecommendation;

  const [action, setAction] = useState<InvestmentInterventionAction>(advisory);
  const [amount, setAmount] = useState(() => String(amountFor(advisory, interventionCase)));
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ProposalField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isContinue = action === "CONTINUE";
  const isReallocate = action === "REALLOCATE_UNRELEASED";
  const option = ACTIONS.find((current) => current.value === action);
  const noTargets = isReallocate && targets.length === 0;
  const amountValid = !isContinue && numberError(amount, { min: 0.01 }) === undefined;
  const coversAll = amountValid && remaining > 0 && Number(amount) >= remaining - 0.005;
  const differsFromAdvisory = action !== advisory;

  function clearError(field: ProposalField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  function handleAction(next: InvestmentInterventionAction) {
    setAction(next);
    setAmount(String(amountFor(next, interventionCase)));
    clearError("amount");
    clearError("target");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: Partial<Record<ProposalField, string>> = {};

    if (!isContinue) {
      const problem = numberError(amount, { min: 0.01 });

      if (problem) {
        next.amount = problem;
      } else if (Number(amount) > remaining + 0.005) {
        next.amount = `Cannot exceed the unreleased capital of ${money(remaining, currency)}.`;
      }
    }

    if (isReallocate && !targetId) {
      next.target = "Select a reallocation target.";
    }

    if (!rationale.trim()) {
      next.rationale = "A proposal rationale is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await proposeInvestmentInterventionAction(caseId, {
        actionType: action,
        affectedCapitalAmount: isContinue ? 0 : Number(amount),
        targetValueCaseId: isReallocate ? targetId : undefined,
        proposalRationale: rationale.trim(),
      });

      onSaved(updated, option ? option.label : "Proposal");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create intervention proposal.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Immutable proposal"
      title="Propose capital intervention"
      description="The proposal is immutable once created. It must be submitted for manager review before it can be decided."
      size="lg"
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
            form="intervention-proposal-form"
            className="button button--primary"
            disabled={saving || noTargets}
          >
            {saving ? "Creating…" : "Create immutable proposal"}
          </button>
        </>
      }
    >
      <form id="intervention-proposal-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Action" htmlFor="intervention-action">
              <select
                id="intervention-action"
                className="kit-field-input"
                value={action}
                onChange={(event) => handleAction(event.target.value as InvestmentInterventionAction)}
              >
                {ACTIONS.map((current) => (
                  <option key={current.value} value={current.value}>
                    {current.label}
                  </option>
                ))}
              </select>
            </Field>

            {option ? <p className="kit-meta-line">{option.hint}</p> : null}
          </div>

          {isContinue ? null : (
            <div className="kit-pair-wide">
              <NumberField
                id="intervention-amount"
                label={`Affected capital (${currency})`}
                min={0.01}
                step="0.01"
                value={amount}
                error={errors.amount}
                onChange={(value) => {
                  setAmount(value);
                  clearError("amount");
                }}
              />

              <p className="kit-meta-line">
                Unreleased capital that can be affected: {money(remaining, currency)}
              </p>
            </div>
          )}

          {isReallocate ? (
            <div className="kit-pair-wide">
              <Field
                label="Governed Step 56 reallocation target"
                htmlFor="intervention-target"
                error={errors.target}
              >
                <select
                  id="intervention-target"
                  className="kit-field-input"
                  value={targetId}
                  aria-invalid={errors.target ? true : undefined}
                  onChange={(event) => {
                    setTargetId(event.target.value);
                    clearError("target");
                  }}
                >
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.caseNumber} — {target.initiativeTitle} · ROI{" "}
                      {target.roiPct.toFixed(1)}%
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          <div className="kit-pair-wide">
            <Field
              label="Proposal rationale"
              htmlFor="intervention-rationale"
              error={errors.rationale}
            >
              <textarea
                id="intervention-rationale"
                className="kit-field-input"
                rows={5}
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

        {noTargets ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            No governed Step 56 reallocation target is available, so this action cannot be
            proposed.
          </p>
        ) : null}

        {differsFromAdvisory ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The advisory recommendation is {readable(String(advisory))}. This proposal differs, so
            the rationale should explain why.
          </p>
        ) : null}

        {coversAll && !isContinue ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This covers all of the unreleased capital.
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

interface CaseData {
  id: string;
  detail: InvestmentInterventionCaseDetail;
}

export default function InvestmentInterventionCasePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<CaseData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitRunning, setSubmitRunning] = useState(false);
  const [proposing, setProposing] = useState(false);
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
        const response = await getInvestmentInterventionCase(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load intervention case.");
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

  function applyDetail(updated: InvestmentInterventionCaseDetail) {
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
        <Link href="/investment-interventions" className="request-back-link">
          <ArrowLeft size={16} />
          Investment intervention
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

  const { interventionCase: ic, proposals, reallocationTargets } = detail;
  const currency = ic.currency;
  const status = String(ic.status);
  const open = status === "OPEN";
  const inReview = status === "IN_REVIEW";
  const approved = status === "APPROVED";
  const busyAny = submitRunning || rationaleRunning;
  const pendingProposal = proposals.find((proposal) => !proposal.decision) ?? null;
  const canPropose = canManage && open && pendingProposal === null;
  const canSubmit = canManage && open && pendingProposal !== null;
  const advisoryAction = String(ic.currentRecommendation);

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      applyDetail(await submitInvestmentInterventionForReview(params.id));

      setSubmitting(false);

      toast.success("Submitted for manager review", ic.interventionNumber);
    } catch (caught) {
      setSubmitting(false);

      toast.error(
        "Could not submit the proposal",
        caught instanceof Error ? caught.message : "Unable to submit intervention case.",
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
    const copy = rationaleCopy(request, ic, pendingProposal);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyDetail(await performRationale(request, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, ic.interventionNumber);
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

  function handleProposed(updated: InvestmentInterventionCaseDetail, label: string) {
    applyDetail(updated);
    setProposing(false);
    toast.success("Proposal created", label);
  }

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, ic, pendingProposal) : null;

  const comparison: ComparisonRow[] = [
    {
      id: "health",
      measure: "Performance health",
      source: readable(String(ic.sourcePerformanceHealth)),
      current: readable(String(ic.currentPerformanceHealth)),
      change:
        String(ic.sourcePerformanceHealth) === String(ic.currentPerformanceHealth)
          ? "Unchanged"
          : "Changed",
    },
    {
      id: "remaining",
      measure: "Remaining capital",
      source: money(ic.sourceRemainingCommitmentAmount, currency),
      current: money(ic.currentRemainingCommitmentAmount, currency),
      change: signedMoney(
        ic.currentRemainingCommitmentAmount - ic.sourceRemainingCommitmentAmount,
        currency,
      ),
    },
    {
      id: "variance",
      measure: "ROI variance",
      source: `${ic.sourceRoiVariancePct.toFixed(1)} pts`,
      current: `${ic.currentRoiVariancePct.toFixed(1)} pts`,
      change: signedPoints(ic.currentRoiVariancePct - ic.sourceRoiVariancePct),
    },
  ];

  const kpis: KpiItem[] = [
    {
      label: "Current health",
      icon: Activity,
      value: readable(String(ic.currentPerformanceHealth)),
      note: "From Step 59 performance",
    },
    {
      label: "Released capital",
      icon: Coins,
      value: money(ic.currentReleasedCapitalAmount, currency),
      note: "Cannot be reallocated",
    },
    {
      label: "Unreleased capital",
      icon: WalletCards,
      value: money(ic.currentRemainingCommitmentAmount, currency),
      note: "Bounds every intervention",
    },
    {
      label: "Realized ROI",
      icon: Gauge,
      value: `${ic.currentRealizedRoiPct.toFixed(1)}%`,
      note: "Current evidence",
    },
    {
      label: "ROI variance",
      icon: TrendingDown,
      value: `${ic.currentRoiVariancePct.toFixed(1)} pts`,
      note: "Against the baseline",
    },
    {
      label: "Efficiency",
      icon: Goal,
      value: `${ic.currentCapitalEfficiencyMultiple.toFixed(2)}x`,
      note: "Capital efficiency",
    },
  ];

  const comparisonColumns = buildComparisonColumns();
  const proposalColumns = buildProposalColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/investment-interventions" className="request-back-link">
        <ArrowLeft size={16} />
        Investment intervention
      </Link>

      <section className="intervention-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{ic.interventionNumber}</span>

            <CaseBadge status={status} />
          </div>

          <span className="eyebrow">Capital intervention governance</span>

          <h1>{ic.initiativeTitle}</h1>

          <p>
            {ic.performanceCaseNumber}
            {" · "}
            {ic.fundingCommitmentNumber}
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

          {canPropose ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setProposing(true)}
            >
              <Plus size={15} />
              Propose intervention
            </button>
          ) : null}

          {canSubmit ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setSubmitting(true)}
            >
              <Send size={15} />
              Submit for manager review
            </button>
          ) : null}

          {canFinalize && inReview ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "REJECT" })}
            >
              <XCircle size={15} />
              Reject proposal
            </button>
          ) : null}

          {canFinalize && inReview ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "APPROVE" })}
            >
              <BadgeCheck size={16} />
              Approve intervention
            </button>
          ) : null}

          {canFinalize && approved ? (
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

      {canPropose ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: propose a capital intervention.</strong> The advisory recommendation
            is {readable(advisoryAction)}, affecting{" "}
            {money(ic.currentRecommendedAffectedCapitalAmount, currency)}.
          </div>
        </div>
      ) : null}

      {canSubmit ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>A proposal is waiting.</strong> Submit it for manager review so that it can be
            approved or rejected.
          </div>
        </div>
      ) : null}

      {inReview ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting an independent decision.</strong>{" "}
            {canFinalize
              ? "Use Approve intervention or Reject proposal above."
              : "A procurement manager or administrator needs to decide."}
          </div>
        </div>
      ) : null}

      {approved && canFinalize ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The intervention is approved.</strong> Close the case to finish the governance
            lifecycle.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Intervention summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Intervention authority</span>

            <h2>Source snapshot vs current evidence</h2>
          </div>

          <Goal size={19} />
        </div>

        <p className="intervention-rationale">{ic.interventionRationale}</p>

        <DataTable
          columns={comparisonColumns}
          rows={comparison}
          getRowId={(row) => row.id}
          ariaLabel="Source snapshot against current evidence"
          busy={fetching}
        />
      </section>

      <section className="intervention-recommendation">
        <strong>Current advisory recommendation</strong>

        <p>
          {readable(advisoryAction)}
          {" · "}
          {money(ic.currentRecommendedAffectedCapitalAmount, currency)}
          {" potentially affected"}
        </p>

        <small>
          Advisory only. A manager or administrator must approve a proposal before it becomes a
          governance decision.
        </small>
      </section>

      <div className="intervention-source-links">
        <Link href={`/investment-performance/${ic.performanceCaseId}`} className="table-action">
          Step 59 performance evidence
        </Link>

        <Link href={`/funding-execution/${ic.fundingCommitmentId}`} className="table-action">
          Step 58 funding evidence
        </Link>

        <Link href={`/strategic-value/${ic.valueCaseId}`} className="table-action">
          Step 56 value baseline
        </Link>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Immutable governance history</span>

            <h2>Intervention proposals</h2>
          </div>

          {canPropose ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setProposing(true)}
            >
              <Plus size={15} />
              Propose intervention
            </button>
          ) : (
            <FileCheck2 size={19} />
          )}
        </div>

        <DataTable
          columns={proposalColumns}
          rows={proposals}
          getRowId={(item) => String(item.id)}
          ariaLabel="Intervention proposals"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No proposals"
              description="No intervention proposal has been created."
              action={
                canPropose ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setProposing(true)}
                  >
                    <Plus size={15} />
                    Propose intervention
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {approved ? (
        <section className="intervention-approved-record">
          <strong>Approved governance action</strong>

          <p>
            {ic.approvedAction ? readable(String(ic.approvedAction)) : "—"}
            {" · "}
            {money(ic.approvedAffectedCapitalAmount, currency)}
          </p>

          {ic.approvedTargetValueCaseNumber ? (
            <small>Target: {ic.approvedTargetValueCaseNumber}</small>
          ) : null}
        </section>
      ) : null}

      <section className="intervention-method-note">
        <Goal size={18} />

        <div>
          <strong>Released capital can never be retroactively reallocated</strong>

          <p>
            Every intervention amount is bounded by current unreleased Step 58 committed capital.
            Approved intervention evidence does not alter the historical release ledger or execute
            a reallocation automatically.
          </p>
        </div>
      </section>

      {proposing ? (
        <ProposeModal
          caseId={params.id}
          interventionCase={ic}
          targets={reallocationTargets}
          onClose={() => setProposing(false)}
          onSaved={handleProposed}
        />
      ) : null}

      {submitting ? (
        <ActionDialog
          eyebrow="Governance gate"
          title="Submit proposal for review?"
          description={
            pendingProposal
              ? `${ic.interventionNumber} will go to manager review with ${readable(String(pendingProposal.actionType))} affecting ${money(pendingProposal.affectedCapitalAmount, currency)}. A new proposal cannot be created while it is under review.`
              : `${ic.interventionNumber} will go to manager review.`
          }
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
          cancelLabel={rationaleInfo.cancelLabel}
          tone={rationaleInfo.tone}
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
