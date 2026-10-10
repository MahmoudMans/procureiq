"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Gauge,
  Info,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
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
  Meter,
  type MeterTone,
  Modal,
  Skeleton,
  StatusBadge,
  formatDate,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  archiveExecutionPortfolio,
  cancelBenefitItem,
  closeExecutionPortfolio,
  confirmBenefitAssumption,
  createBenefitAssumption,
  createBenefitLeakage,
  getBenefitsGovernanceContext,
  getExecutionPortfolio,
  invalidateBenefitAssumption,
  requestBenefitValidation,
  resolveBenefitLeakage,
  startBenefitItem,
  startExecutionPortfolio,
  updateBenefitForecast,
  updateBenefitOwner,
  validateBenefitItem,
} from "@/lib/api";
import type {
  BenefitAssumptionType,
  BenefitLeakageStatus,
  BenefitLeakageType,
  BenefitsGovernanceContext,
  ExecutionPortfolioDetail,
} from "@/types/benefits-governance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Portfolio = ExecutionPortfolioDetail["portfolio"];
type BenefitItem = ExecutionPortfolioDetail["benefitItems"][number];
type Assumption = ExecutionPortfolioDetail["assumptions"][number];
type Leakage = ExecutionPortfolioDetail["leakage"][number];
type BenefitUser = BenefitsGovernanceContext["users"][number];
type PortfolioAction = "START" | "CLOSE" | "ARCHIVE";
type ValidationMode = "REQUEST" | "VALIDATE";
type AssumptionKind = "CONFIRM" | "INVALIDATE";
type ValidationField = "amount" | "note";
type AssumptionField = "impact" | "description";
type LeakageField = "item" | "amount" | "description" | "due";

interface AssumptionRequest {
  kind: AssumptionKind;
  assumption: Assumption;
}

interface ValidationRequest {
  mode: ValidationMode;
  item: BenefitItem;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const VALIDATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: BenefitUser[] = [];
const ANY_NUMBER = { min: -1e12 };

const ASSUMPTION_TYPES: { value: string; label: string }[] = [
  { value: "DEMAND", label: "Demand" },
  { value: "PRICE", label: "Price" },
  { value: "VOLUME", label: "Volume" },
  { value: "TIMING", label: "Timing" },
  { value: "FX", label: "FX" },
  { value: "SCOPE", label: "Scope" },
  { value: "OTHER", label: "Other" },
];

const LEAKAGE_TYPES: { value: string; label: string }[] = [
  { value: "DEMAND_EROSION", label: "Demand erosion" },
  { value: "PRICE_VARIANCE", label: "Price variance" },
  { value: "SCOPE_CHANGE", label: "Scope change" },
  { value: "TIMING_SLIPPAGE", label: "Timing slippage" },
  { value: "FX_IMPACT", label: "FX impact" },
  { value: "OTHER", label: "Other" },
];

const LEAKAGE_RESOLUTIONS: { value: string; label: string; done: string }[] = [
  { value: "MITIGATED", label: "Mitigated", done: "Leakage mitigated" },
  { value: "ACCEPTED", label: "Accepted", done: "Leakage accepted" },
  { value: "RESOLVED", label: "Resolved", done: "Leakage resolved" },
];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function itemRank(status: string): number {
  switch (status) {
    case "VALIDATION_PENDING":
      return 0;
    case "IN_PROGRESS":
      return 1;
    case "PLANNED":
      return 2;
    case "VALIDATED":
      return 3;
    default:
      return 4;
  }
}

function PortfolioBadge({ status }: { status: string }) {
  if (status === "AUTHORIZED") {
    return <StatusBadge value="APPROVED" label="Authorized" />;
  }

  if (status === "IN_EXECUTION") {
    return <StatusBadge value="IN_PROGRESS" label="In execution" />;
  }

  return <StatusBadge value={status} />;
}

function ItemBadge({ status }: { status: string }) {
  if (status === "VALIDATION_PENDING") {
    return <StatusBadge value="PENDING_VALIDATION" label="Validation pending" />;
  }

  return <StatusBadge value={status} />;
}

function AssumptionBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return <StatusBadge value="IN_REVIEW" label="Active" />;
  }

  if (status === "CONFIRMED") {
    return <StatusBadge value="VALIDATED" label="Confirmed" />;
  }

  if (status === "INVALIDATED") {
    return <StatusBadge value="REJECTED" label="Invalidated" />;
  }

  return <StatusBadge value={status} />;
}

function LeakageBadge({ status }: { status: string }) {
  if (status === "OPEN") {
    return <StatusBadge value="AT_RISK" label="Open" />;
  }

  return <StatusBadge value={status} />;
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

interface ActionCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const PORTFOLIO_ACTIONS: Record<PortfolioAction, ActionCopy> = {
  START: {
    eyebrow: "Start execution",
    title: "Start execution?",
    confirm: "Start execution",
    busy: "Starting…",
    keep: "Not yet",
    done: "Execution started",
    failed: "Could not start execution",
  },
  CLOSE: {
    eyebrow: "Close portfolio",
    title: "Close this portfolio?",
    confirm: "Close portfolio",
    busy: "Closing…",
    keep: "Keep open",
    done: "Portfolio closed",
    failed: "Could not close the portfolio",
  },
  ARCHIVE: {
    eyebrow: "Archive portfolio",
    title: "Archive this portfolio?",
    confirm: "Archive portfolio",
    busy: "Archiving…",
    keep: "Not yet",
    done: "Portfolio archived",
    failed: "Could not archive the portfolio",
  },
};

function portfolioDescription(action: PortfolioAction, portfolio: Portfolio): string {
  const name = `${portfolio.portfolioNumber} (${portfolio.sourceScenarioName})`;

  switch (action) {
    case "START":
      return `${name} will move into execution so benefit forecasts and validations can be tracked.`;

    case "CLOSE":
      return `${name} will be closed. Benefits can no longer be changed afterwards.`;

    case "ARCHIVE":
      return `${name} will be archived.`;
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface ItemColumnOptions {
  currency: string;
  canEdit: boolean;
  canApprove: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (item: BenefitItem) => void;
  onForecast: (item: BenefitItem) => void;
  onRequest: (item: BenefitItem) => void;
  onValidate: (item: BenefitItem) => void;
  onOwner: (item: BenefitItem) => void;
  onCancel: (item: BenefitItem) => void;
}

function buildItemColumns(options: ItemColumnOptions): Column<BenefitItem>[] {
  const { currency } = options;

  return [
    {
      id: "item",
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
      id: "status",
      header: "Status",
      sortValue: (item) => itemRank(String(item.status)),
      cell: (item) => <ItemBadge status={String(item.status)} />,
    },
    {
      id: "owner",
      header: "Benefit owner",
      sortValue: (item) => (item.benefitOwnerName ?? "").toLowerCase(),
      cell: (item) => item.benefitOwnerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "target",
      header: "Target",
      align: "right",
      sortValue: (item) => item.baselineTargetSavings,
      cell: (item) => money(item.baselineTargetSavings, currency),
    },
    {
      id: "forecast",
      header: "Forecast",
      align: "right",
      sortValue: (item) => item.forecastSavings,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span>{money(item.forecastSavings, currency)}</span>

          {item.expectedRealizationDate ? (
            <small>by {showDate(item.expectedRealizationDate)}</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "operational",
      header: "Operational",
      align: "right",
      sortValue: (item) => item.operationalReportedSavings,
      cell: (item) => money(item.operationalReportedSavings, currency),
    },
    {
      id: "validated",
      header: "Validated",
      align: "right",
      sortValue: (item) => item.validatedSavings,
      cell: (item) => money(item.validatedSavings, currency),
    },
    {
      id: "risk",
      header: "At risk",
      align: "right",
      sortValue: (item) => item.atRiskAmount,
      cell: (item) => (
        <div className="kit-cell-stack">
          <span className={item.atRiskAmount > 0 ? "kit-text-danger" : undefined}>
            {money(item.atRiskAmount, currency)}
          </span>

          {item.activeLeakageAmount > 0 ? (
            <small>Leakage {money(item.activeLeakageAmount, currency)}</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "validation",
      header: "Validation",
      cell: (item) => {
        if (item.status === "VALIDATION_PENDING") {
          return (
            <div className="kit-cell-stack">
              <span>Requested {money(item.validationRequestedAmount ?? 0, currency)}</span>

              {item.validationRequestNote ? <small>{item.validationRequestNote}</small> : null}
            </div>
          );
        }

        if (item.validationNote) {
          return (
            <div className="kit-cell-stack">
              <span>{item.validationNote}</span>

              {item.validatedByName ? <small>— {item.validatedByName}</small> : null}
            </div>
          );
        }

        return <span className="kit-text-muted">—</span>;
      },
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 340,
      cell: (item) => {
        if (!options.canEdit && !options.canApprove) {
          return null;
        }

        const live = item.status === "PLANNED" || item.status === "IN_PROGRESS";
        const finished = item.status === "VALIDATED" || item.status === "CANCELLED";
        const starting = options.workingId === String(item.id);

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {options.canEdit && item.status === "PLANNED" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onStart(item)}
              >
                <Play size={14} />
                {starting ? "Starting…" : "Start"}
              </button>
            ) : null}

            {options.canEdit && live ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onForecast(item)}
              >
                Forecast
              </button>
            ) : null}

            {options.canEdit && item.status === "IN_PROGRESS" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onRequest(item)}
              >
                Request validation
              </button>
            ) : null}

            {options.canApprove && item.status === "VALIDATION_PENDING" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onValidate(item)}
              >
                <BadgeCheck size={14} />
                Validate
              </button>
            ) : null}

            {options.canEdit ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onOwner(item)}
              >
                Owner
              </button>
            ) : null}

            {options.canApprove && !finished ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onCancel(item)}
              >
                <XCircle size={14} />
                Cancel
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

interface AssumptionColumnOptions {
  currency: string;
  canResolve: boolean;
  busy: boolean;
  onResolve: (kind: AssumptionKind, assumption: Assumption) => void;
}

function buildAssumptionColumns(options: AssumptionColumnOptions): Column<Assumption>[] {
  return [
    {
      id: "assumption",
      header: "Assumption",
      sortValue: (assumption) => String(assumption.assumptionType),
      cell: (assumption) => (
        <div className="request-primary-cell">
          <strong>{readable(String(assumption.assumptionType))}</strong>

          <span>{assumption.description}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (assumption) => String(assumption.status),
      cell: (assumption) => <AssumptionBadge status={String(assumption.status)} />,
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (assumption) => (assumption.ownerName ?? "").toLowerCase(),
      cell: (assumption) => assumption.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "impact",
      header: "Financial impact",
      align: "right",
      sortValue: (assumption) => assumption.financialImpact,
      cell: (assumption) => money(assumption.financialImpact, options.currency),
    },
    {
      id: "review",
      header: "Review",
      sortValue: (assumption) => assumption.reviewDate ?? null,
      cell: (assumption) => (
        <div className="kit-cell-stack">
          <span>{showDate(assumption.reviewDate)}</span>

          {assumption.reviewOverdue && assumption.status === "ACTIVE" ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "resolution",
      header: "Resolution",
      cell: (assumption) =>
        assumption.resolutionNote ? (
          <span>{assumption.resolutionNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 210,
      cell: (assumption) =>
        options.canResolve && assumption.status === "ACTIVE" ? (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onResolve("CONFIRM", assumption)}
            >
              <BadgeCheck size={14} />
              Confirm
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onResolve("INVALIDATE", assumption)}
            >
              <XCircle size={14} />
              Invalidate
            </button>
          </div>
        ) : null,
    },
  ];
}

interface LeakageColumnOptions {
  currency: string;
  canResolve: boolean;
  busy: boolean;
  onResolve: (leakage: Leakage) => void;
}

function buildLeakageColumns(options: LeakageColumnOptions): Column<Leakage>[] {
  return [
    {
      id: "leakage",
      header: "Leakage",
      sortValue: (leakage) => String(leakage.leakageType),
      cell: (leakage) => (
        <div className="request-primary-cell">
          <strong>{readable(String(leakage.leakageType))}</strong>

          <span>
            {leakage.initiativeNumber}
            {" · "}
            {leakage.initiativeTitle}
          </span>

          <span>{leakage.description}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (leakage) => String(leakage.status),
      cell: (leakage) => <LeakageBadge status={String(leakage.status)} />,
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (leakage) => leakage.amount,
      cell: (leakage) => money(leakage.amount, options.currency),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (leakage) => (leakage.ownerName ?? "").toLowerCase(),
      cell: (leakage) => leakage.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (leakage) => leakage.dueDate ?? null,
      cell: (leakage) => (
        <div className="kit-cell-stack">
          <span>{showDate(leakage.dueDate)}</span>

          {leakage.overdue && leakage.status === "OPEN" ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "resolution",
      header: "Resolution",
      cell: (leakage) =>
        leakage.resolutionNote ? (
          <span>{leakage.resolutionNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 120,
      cell: (leakage) =>
        options.canResolve && (leakage.status === "OPEN" || leakage.status === "ACCEPTED") ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onResolve(leakage)}
          >
            Resolve
          </button>
        ) : null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Forecast modal                                                      */
/* ------------------------------------------------------------------ */

interface ForecastModalProps {
  item: BenefitItem;
  currency: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}

function ForecastModal({ item, currency, onClose, onSaved }: ForecastModalProps) {
  const [forecast, setForecast] = useState(String(item.forecastSavings));
  const [date, setDate] = useState(item.expectedRealizationDate ?? "");
  const [forecastError, setForecastError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = numberError(forecast, { min: 0 }) === undefined;
  const aboveTarget = valid && Number(forecast) > item.baselineTargetSavings;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const problem = numberError(forecast, { min: 0 });

    if (problem) {
      setForecastError(problem);

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateBenefitForecast(item.id, {
        forecastSavings: Number(forecast),
        expectedRealizationDate: date || undefined,
      });

      onSaved(item.initiativeTitle);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update benefit forecast.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Benefit forecast"
      title="Update forecast"
      description={`${item.initiativeNumber} — decision target ${money(item.baselineTargetSavings, currency)}.`}
      size="sm"
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
            form="benefit-forecast-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save forecast"}
          </button>
        </>
      }
    >
      <form id="benefit-forecast-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <NumberField
              id="forecast-amount"
              label="Forecast savings"
              min={0}
              step="0.01"
              value={forecast}
              error={forecastError}
              onChange={(value) => {
                setForecast(value);
                setForecastError(undefined);
              }}
            />
          </div>

          <div className="kit-pair-wide">
            <Field label="Expected realization date" htmlFor="forecast-date">
              <input
                id="forecast-date"
                className="kit-field-input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {aboveTarget ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This forecast is above the approved decision target.
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
/* Validation modal                                                    */
/* ------------------------------------------------------------------ */

interface ValidationModalProps {
  request: ValidationRequest;
  currency: string;
  onClose: () => void;
  onSaved: (message: string, title: string) => void;
}

function ValidationModal({ request, currency, onClose, onSaved }: ValidationModalProps) {
  const { mode, item } = request;
  const isRequest = mode === "REQUEST";

  const [amount, setAmount] = useState(() =>
    String(isRequest ? item.forecastSavings : (item.validationRequestedAmount ?? 0)),
  );
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ValidationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = numberError(amount, { min: 0 }) === undefined;
  const aboveForecast = isRequest && valid && Number(amount) > item.forecastSavings;
  const differsFromRequest =
    !isRequest && valid && Number(amount) !== (item.validationRequestedAmount ?? 0);

  function clearError(field: ValidationField) {
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

    const next: Partial<Record<ValidationField, string>> = {};

    const problem = numberError(amount, { min: 0 });

    if (problem) {
      next.amount = problem;
    }

    if (!note.trim()) {
      next.note = isRequest
        ? "Explain the evidence behind the validation request."
        : "A formal validation note is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isRequest) {
        await requestBenefitValidation(item.id, {
          proposedValidatedSavings: Number(amount),
          note: note.trim(),
        });
      } else {
        await validateBenefitItem(item.id, {
          validatedSavings: Number(amount),
          note: note.trim(),
        });
      }

      onSaved(isRequest ? "Validation requested" : "Benefit validated", item.initiativeTitle);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : isRequest
            ? "Unable to submit benefit validation."
            : "Unable to validate benefit.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow={isRequest ? "Benefit validation" : "Formal validation"}
      title={isRequest ? "Request validation" : "Validate benefit"}
      description={`${item.initiativeNumber} — ${item.initiativeTitle}`}
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
            form="benefit-validation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving
              ? isRequest
                ? "Submitting…"
                : "Validating…"
              : isRequest
                ? "Submit request"
                : "Validate benefit"}
          </button>
        </>
      }
    >
      <form id="benefit-validation-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          {!isRequest ? (
            <div className="kit-pair-wide">
              <p className="kit-meta-line">
                Requested {money(item.validationRequestedAmount ?? 0, currency)}
                {item.validationRequestNote ? ` — ${item.validationRequestNote}` : ""}
              </p>
            </div>
          ) : null}

          <div className="kit-pair-wide">
            <NumberField
              id="validation-amount"
              label={isRequest ? "Proposed validated savings" : "Validated savings"}
              min={0}
              step="0.01"
              value={amount}
              error={errors.amount}
              onChange={(value) => {
                setAmount(value);
                clearError("amount");
              }}
            />
          </div>

          <div className="kit-pair-wide">
            <Field
              label={isRequest ? "Validation request evidence / rationale" : "Formal validation note"}
              htmlFor="validation-note"
              error={errors.note}
            >
              <textarea
                id="validation-note"
                className="kit-field-input"
                rows={5}
                maxLength={2000}
                value={note}
                aria-invalid={errors.note ? true : undefined}
                onChange={(event) => {
                  setNote(event.target.value);
                  clearError("note");
                }}
              />
            </Field>
          </div>
        </div>

        {aboveForecast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The proposed amount is above the current forecast of{" "}
            {money(item.forecastSavings, currency)}.
          </p>
        ) : null}

        {differsFromRequest ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The validated amount differs from the requested{" "}
            {money(item.validationRequestedAmount ?? 0, currency)}.
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
/* Reassign owner modal                                                */
/* ------------------------------------------------------------------ */

interface OwnerModalProps {
  item: BenefitItem;
  users: BenefitUser[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

function OwnerModal({ item, users, onClose, onSaved }: OwnerModalProps) {
  const [ownerId, setOwnerId] = useState(item.benefitOwnerUserId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const unchanged = ownerId === item.benefitOwnerUserId;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || unchanged) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateBenefitOwner(item.id, ownerId);

      onSaved(item.initiativeTitle);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reassign benefit owner.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Benefit ownership"
      title="Reassign benefit owner"
      description={`${item.initiativeNumber} — ${item.initiativeTitle}`}
      size="sm"
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
            form="benefit-owner-form"
            className="button button--primary"
            disabled={saving || unchanged}
          >
            {saving ? "Saving…" : "Reassign owner"}
          </button>
        </>
      }
    >
      <form id="benefit-owner-form" onSubmit={handleSubmit} noValidate>
        <Field label="Benefit owner" htmlFor="benefit-owner">
          <select
            id="benefit-owner"
            className="kit-field-input"
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
          >
            {users.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName}
              </option>
            ))}
          </select>
        </Field>

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
/* Add assumption modal                                                */
/* ------------------------------------------------------------------ */

interface AssumptionModalProps {
  portfolioId: string;
  users: BenefitUser[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

function AssumptionModal({ portfolioId, users, onClose, onSaved }: AssumptionModalProps) {
  const [type, setType] = useState<BenefitAssumptionType>("DEMAND");
  const [impact, setImpact] = useState("0");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [reviewDate, setReviewDate] = useState(() => isoDate(30));
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AssumptionField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reviewInPast = reviewDate !== "" && reviewDate < isoDate(0);

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

    const impactProblem = numberError(impact, ANY_NUMBER);

    if (impactProblem) {
      next.impact = impactProblem;
    }

    if (!description.trim()) {
      next.description = "Describe the assumption.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createBenefitAssumption(portfolioId, {
        assumptionType: type,
        description: description.trim(),
        financialImpact: Number(impact),
        ownerUserId: ownerId || undefined,
        reviewDate: reviewDate || undefined,
      });

      onSaved(readable(type));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create benefit assumption.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Assumption register"
      title="Add assumption"
      description="An assumption the approved benefits depend on."
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
            form="benefit-assumption-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add assumption"}
          </button>
        </>
      }
    >
      <form id="benefit-assumption-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Type" htmlFor="assumption-type">
            <select
              id="assumption-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as BenefitAssumptionType)}
            >
              {ASSUMPTION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <NumberField
            id="assumption-impact"
            label="Financial impact"
            step="0.01"
            value={impact}
            error={errors.impact}
            onChange={(value) => {
              setImpact(value);
              clearError("impact");
            }}
          />

          <Field label="Owner" htmlFor="assumption-owner">
            <select
              id="assumption-owner"
              className="kit-field-input"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Review date" htmlFor="assumption-review">
            <input
              id="assumption-review"
              className="kit-field-input"
              type="date"
              value={reviewDate}
              onChange={(event) => setReviewDate(event.target.value)}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Assumption" htmlFor="assumption-description" error={errors.description}>
              <textarea
                id="assumption-description"
                className="kit-field-input"
                rows={4}
                value={description}
                aria-invalid={errors.description ? true : undefined}
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearError("description");
                }}
              />
            </Field>
          </div>
        </div>

        {reviewInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The review date is in the past, so this assumption will be flagged as overdue.
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
/* Record leakage modal                                                */
/* ------------------------------------------------------------------ */

interface LeakageModalProps {
  items: BenefitItem[];
  users: BenefitUser[];
  currency: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function LeakageModal({ items, users, currency, onClose, onSaved }: LeakageModalProps) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [type, setType] = useState<BenefitLeakageType>("DEMAND_EROSION");
  const [amount, setAmount] = useState("0");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(() => isoDate(14));
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Partial<Record<LeakageField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = items.find((item) => item.id === itemId);
  const amountValid = numberError(amount, { min: 0 }) === undefined;
  const exceedsForecast =
    selected !== undefined && amountValid && Number(amount) > selected.forecastSavings;

  function clearError(field: LeakageField) {
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

    const next: Partial<Record<LeakageField, string>> = {};

    if (!itemId) {
      next.item = "Select a benefit item for the leakage finding.";
    }

    const amountProblem = numberError(amount, { min: 0 });

    if (amountProblem) {
      next.amount = amountProblem;
    } else if (Number(amount) <= 0) {
      next.amount = "Enter a leakage amount above zero.";
    }

    if (!description.trim()) {
      next.description = "Describe the leakage.";
    }

    if (dueDate && dueDate < isoDate(0)) {
      next.due = "The due date cannot be in the past.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createBenefitLeakage(itemId, {
        leakageType: type,
        amount: Number(amount),
        description: description.trim(),
        ownerUserId: ownerId || undefined,
        dueDate: dueDate || undefined,
      });

      onSaved(readable(type));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record benefit leakage.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Value protection"
      title="Record benefit leakage"
      description={`Amounts are in ${currency}.`}
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
            form="benefit-leakage-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record leakage"}
          </button>
        </>
      }
    >
      <form id="benefit-leakage-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Benefit item" htmlFor="leakage-item" error={errors.item}>
              <select
                id="leakage-item"
                className="kit-field-input"
                value={itemId}
                aria-invalid={errors.item ? true : undefined}
                onChange={(event) => {
                  setItemId(event.target.value);
                  clearError("item");
                }}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.initiativeNumber} — {item.initiativeTitle}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Leakage type" htmlFor="leakage-type">
            <select
              id="leakage-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as BenefitLeakageType)}
            >
              {LEAKAGE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <NumberField
            id="leakage-amount"
            label="Amount"
            min={0}
            step="0.01"
            value={amount}
            error={errors.amount}
            onChange={(value) => {
              setAmount(value);
              clearError("amount");
            }}
          />

          <Field label="Owner" htmlFor="leakage-owner">
            <select
              id="leakage-owner"
              className="kit-field-input"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="leakage-due" error={errors.due}>
            <input
              id="leakage-due"
              className="kit-field-input"
              type="date"
              value={dueDate}
              aria-invalid={errors.due ? true : undefined}
              onChange={(event) => {
                setDueDate(event.target.value);
                clearError("due");
              }}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Description" htmlFor="leakage-description" error={errors.description}>
              <textarea
                id="leakage-description"
                className="kit-field-input"
                rows={4}
                value={description}
                aria-invalid={errors.description ? true : undefined}
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearError("description");
                }}
              />
            </Field>
          </div>
        </div>

        {exceedsForecast && selected ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This leakage is larger than the forecast of {money(selected.forecastSavings, currency)}{" "}
            for the selected item.
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
/* Resolve leakage modal                                               */
/* ------------------------------------------------------------------ */

interface ResolveLeakageModalProps {
  leakage: Leakage;
  onClose: () => void;
  onSaved: (message: string, title: string) => void;
}

function ResolveLeakageModal({ leakage, onClose, onSaved }: ResolveLeakageModalProps) {
  const options = LEAKAGE_RESOLUTIONS.filter((item) => item.value !== String(leakage.status));

  const [status, setStatus] = useState(options[0]?.value ?? "MITIGATED");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choice = LEAKAGE_RESOLUTIONS.find((item) => item.value === status) ?? LEAKAGE_RESOLUTIONS[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!note.trim()) {
      setNoteError("A leakage resolution note is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await resolveBenefitLeakage(leakage.id, status as BenefitLeakageStatus, note.trim());

      onSaved(choice.done, readable(String(leakage.leakageType)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to resolve benefit leakage.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Value protection"
      title="Resolve leakage"
      description={`${leakage.initiativeNumber} — ${readable(String(leakage.leakageType))}`}
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
            form="benefit-resolve-leakage-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Record resolution"}
          </button>
        </>
      }
    >
      <form id="benefit-resolve-leakage-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Outcome" htmlFor="leakage-outcome">
              <select
                id="leakage-outcome"
                className="kit-field-input"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {options.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Resolution note" htmlFor="leakage-note" error={noteError}>
              <textarea
                id="leakage-note"
                className="kit-field-input"
                rows={5}
                maxLength={2000}
                value={note}
                aria-invalid={noteError ? true : undefined}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError(undefined);
                }}
              />
            </Field>
          </div>
        </div>

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

interface BenefitsData {
  id: string;
  detail: ExecutionPortfolioDetail;
  users: BenefitUser[];
}

export default function BenefitsGovernanceDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canValidate = user !== null && VALIDATE_ROLES.includes(user.role);

  const [result, setResult] = useState<BenefitsData | null>(null);
  const [pending, setPending] = useState<PortfolioAction | null>(null);
  const [pendingRunning, setPendingRunning] = useState(false);
  const [forecasting, setForecasting] = useState<BenefitItem | null>(null);
  const [validating, setValidating] = useState<ValidationRequest | null>(null);
  const [reassigning, setReassigning] = useState<BenefitItem | null>(null);
  const [cancellingItem, setCancellingItem] = useState<BenefitItem | null>(null);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [addingAssumption, setAddingAssumption] = useState(false);
  const [addingLeakage, setAddingLeakage] = useState(false);
  const [assumptionRequest, setAssumptionRequest] = useState<AssumptionRequest | null>(null);
  const [assumptionRunning, setAssumptionRunning] = useState(false);
  const [assumptionError, setAssumptionError] = useState<string | null>(null);
  const [resolvingLeakage, setResolvingLeakage] = useState<Leakage | null>(null);
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
        const [detailResponse, contextResponse] = await Promise.all([
          getExecutionPortfolio(id),
          getBenefitsGovernanceContext(),
        ]);

        if (active) {
          setResult({
            id,
            detail: detailResponse,
            users: contextResponse.users.filter((candidate) => candidate.role !== "REQUESTER"),
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load benefits-governance portfolio.",
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
  const users = data?.users ?? EMPTY_USERS;

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
        <Link href="/benefits-governance" className="request-back-link">
          <ArrowLeft size={16} />
          Benefits governance
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

  const { portfolio, benefitItems, assumptions, leakage: leakageRows } = detail;
  const currency = portfolio.currency;
  const status = portfolio.status;
  const mutable = status !== "CLOSED" && status !== "ARCHIVED";
  const canEdit = canManage && mutable;
  const canApprove = canValidate && mutable;
  const busyAny = pendingRunning || cancelRunning || assumptionRunning || workingId !== null;

  async function confirmPortfolio() {
    if (pending === null) {
      return;
    }

    const action = pending;

    setPendingRunning(true);

    try {
      if (action === "START") {
        await startExecutionPortfolio(params.id);
      } else if (action === "CLOSE") {
        await closeExecutionPortfolio(params.id);
      } else {
        await archiveExecutionPortfolio(params.id);
      }

      setPending(null);

      toast.success(PORTFOLIO_ACTIONS[action].done, portfolio.portfolioNumber);
      reload();
    } catch (caught) {
      setPending(null);

      toast.error(
        PORTFOLIO_ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update execution portfolio.",
      );
    } finally {
      setPendingRunning(false);
    }
  }

  async function startItem(item: BenefitItem) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(item.id));

    try {
      await startBenefitItem(item.id);

      toast.success("Benefit item started", item.initiativeTitle);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the benefit item",
        caught instanceof Error ? caught.message : "Unable to start benefit item.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmCancelItem() {
    if (cancellingItem === null) {
      return;
    }

    const item = cancellingItem;

    setCancelRunning(true);

    try {
      await cancelBenefitItem(item.id);

      setCancellingItem(null);

      toast.success("Benefit item cancelled", item.initiativeTitle);
      reload();
    } catch (caught) {
      setCancellingItem(null);

      toast.error(
        "Could not cancel the benefit item",
        caught instanceof Error ? caught.message : "Unable to cancel benefit item.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  async function confirmAssumption(note: string) {
    if (assumptionRequest === null) {
      return;
    }

    const request = assumptionRequest;

    setAssumptionRunning(true);
    setAssumptionError(null);

    try {
      if (request.kind === "CONFIRM") {
        await confirmBenefitAssumption(request.assumption.id, note);
      } else {
        await invalidateBenefitAssumption(request.assumption.id, note);
      }

      setAssumptionRequest(null);

      toast.success(
        request.kind === "CONFIRM" ? "Assumption confirmed" : "Assumption invalidated",
        readable(String(request.assumption.assumptionType)),
      );
      reload();
    } catch (caught) {
      setAssumptionError(
        caught instanceof Error ? caught.message : "Unable to resolve benefit assumption.",
      );
    } finally {
      setAssumptionRunning(false);
    }
  }

  function handleForecastSaved(title: string) {
    setForecasting(null);
    toast.success("Forecast updated", title);
    reload();
  }

  function handleValidationSaved(message: string, title: string) {
    setValidating(null);
    toast.success(message, title);
    reload();
  }

  function handleOwnerSaved(title: string) {
    setReassigning(null);
    toast.success("Benefit owner reassigned", title);
    reload();
  }

  function handleAssumptionAdded(message: string) {
    setAddingAssumption(false);
    toast.success("Assumption added", message);
    reload();
  }

  function handleLeakageAdded(message: string) {
    setAddingLeakage(false);
    toast.success("Leakage recorded", message);
    reload();
  }

  function handleLeakageResolved(message: string, title: string) {
    setResolvingLeakage(null);
    toast.success(message, title);
    reload();
  }

  const pendingValidation = benefitItems.filter((item) => item.status === "VALIDATION_PENDING");
  const activeAssumptions = assumptions.filter((assumption) => assumption.status === "ACTIVE");
  const overdueAssumptions = activeAssumptions.filter((assumption) => assumption.reviewOverdue);
  const openLeakage = leakageRows.filter(
    (leak) => leak.status === "OPEN" || leak.status === "ACCEPTED",
  );
  const overdueLeakage = leakageRows.filter((leak) => leak.status === "OPEN" && leak.overdue);
  const itemsForLeakage = benefitItems.filter((item) => item.status !== "CANCELLED");

  const orderedItems = [...benefitItems].sort((a, b) => {
    const rank = itemRank(String(a.status)) - itemRank(String(b.status));

    if (rank !== 0) {
      return rank;
    }

    return b.atRiskAmount - a.atRiskAmount;
  });

  const orderedAssumptions = [...assumptions].sort((a, b) => {
    const left = a.status === "ACTIVE" ? 0 : 1;
    const right = b.status === "ACTIVE" ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.reviewOverdue !== b.reviewOverdue) {
      return a.reviewOverdue ? -1 : 1;
    }

    return (a.reviewDate ?? "9999-12-31").localeCompare(b.reviewDate ?? "9999-12-31");
  });

  const orderedLeakage = [...leakageRows].sort((a, b) => {
    const left = a.status === "OPEN" || a.status === "ACCEPTED" ? 0 : 1;
    const right = b.status === "OPEN" || b.status === "ACCEPTED" ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });

  const target = portfolio.baselineTargetSavings;
  const pctOf = (value: number) => (target > 0 ? (value / target) * 100 : null);
  const forecastPct = pctOf(portfolio.currentForecastSavings);
  const operationalPct = pctOf(portfolio.operationalReportedSavings);
  const validatedPct = pctOf(portfolio.validatedSavings);

  const kpis: KpiItem[] = [
    {
      label: "Decision target",
      icon: Gauge,
      value: money(portfolio.baselineTargetSavings, currency),
      note: "Approved baseline",
    },
    {
      label: "Forecast",
      icon: TrendingDown,
      value: money(portfolio.currentForecastSavings, currency),
      note: `${portfolio.forecastCoveragePct.toFixed(0)}% coverage`,
    },
    {
      label: "Operationally reported",
      icon: ShieldCheck,
      value: money(portfolio.operationalReportedSavings, currency),
      note: "Category initiative reporting",
    },
    {
      label: "Formally validated",
      icon: BadgeCheck,
      value: money(portfolio.validatedSavings, currency),
      note: `${portfolio.validationCoveragePct.toFixed(0)}% coverage`,
    },
    {
      label: "Leakage",
      icon: AlertTriangle,
      value: money(portfolio.activeLeakageAmount, currency),
      note: "Active leakage",
      tone: portfolio.activeLeakageAmount > 0 ? "warning" : "default",
    },
    {
      label: "Value at risk",
      icon: AlertTriangle,
      value: money(portfolio.atRiskAmount, currency),
      note: "Across benefit items",
      tone: portfolio.atRiskAmount > 0 ? "warning" : "default",
    },
  ];

  const itemColumns = buildItemColumns({
    currency,
    canEdit,
    canApprove,
    workingId,
    busy: busyAny,
    onStart: (item) => void startItem(item),
    onForecast: (item) => setForecasting(item),
    onRequest: (item) => setValidating({ mode: "REQUEST", item }),
    onValidate: (item) => setValidating({ mode: "VALIDATE", item }),
    onOwner: (item) => setReassigning(item),
    onCancel: (item) => setCancellingItem(item),
  });

  const assumptionColumns = buildAssumptionColumns({
    currency,
    canResolve: canEdit,
    busy: busyAny,
    onResolve: (kind, assumption) => {
      setAssumptionError(null);
      setAssumptionRequest({ kind, assumption });
    },
  });

  const leakageColumns = buildLeakageColumns({
    currency,
    canResolve: canEdit,
    busy: busyAny,
    onResolve: (leak) => setResolvingLeakage(leak),
  });

  return (
    <div className="page-stack">
      <Link href="/benefits-governance" className="request-back-link">
        <ArrowLeft size={16} />
        Benefits governance
      </Link>

      <section className="benefit-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{portfolio.portfolioNumber}</span>

            <PortfolioBadge status={String(status)} />
          </div>

          <h1>{portfolio.sourceScenarioName}</h1>

          <p>
            Decision baseline: {portfolio.sourceScenarioCode}
            {" · "}
            {currency}
            {" · Owner: "}
            {portfolio.ownerName}
          </p>
        </div>

        <div className="benefit-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={reload}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canManage && status === "AUTHORIZED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPending("START")}
            >
              <Play size={16} />
              Start execution
            </button>
          ) : null}

          {canValidate && (status === "AUTHORIZED" || status === "IN_EXECUTION") ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny || portfolio.activeBenefitItems > 0}
              title={
                portfolio.activeBenefitItems > 0
                  ? "Validate or cancel the active benefit items first"
                  : undefined
              }
              onClick={() => setPending("CLOSE")}
            >
              Close portfolio
            </button>
          ) : null}

          {canValidate && status === "CLOSED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPending("ARCHIVE")}
            >
              Archive
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

      {canManage && status === "AUTHORIZED" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: start execution.</strong> Do this when delivery begins, then
            forecast and validate each benefit item.
          </div>
        </div>
      ) : null}

      {canValidate && pendingValidation.length > 0 && mutable ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {pendingValidation.length}{" "}
              {pendingValidation.length === 1 ? "benefit item is" : "benefit items are"} waiting
              for formal validation.
            </strong>{" "}
            Use Validate in the benefit table.
          </div>
        </div>
      ) : null}

      {canValidate &&
      (status === "AUTHORIZED" || status === "IN_EXECUTION") &&
      portfolio.activeBenefitItems > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Closing is blocked.</strong> {portfolio.activeBenefitItems} benefit{" "}
            {portfolio.activeBenefitItems === 1 ? "item is" : "items are"} still active. Validate
            or cancel {portfolio.activeBenefitItems === 1 ? "it" : "them"} first.
          </div>
        </div>
      ) : null}

      {portfolio.activeLeakageAmount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {money(portfolio.activeLeakageAmount, currency)} of benefit leakage is active.
            </strong>{" "}
            {openLeakage.length} open {openLeakage.length === 1 ? "finding needs" : "findings need"}{" "}
            a resolution.
          </div>
        </div>
      ) : null}

      {overdueLeakage.length > 0 || overdueAssumptions.length > 0 ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Overdue items.</strong>
            {overdueLeakage.length > 0
              ? ` ${overdueLeakage.length} leakage ${overdueLeakage.length === 1 ? "finding is" : "findings are"} overdue.`
              : ""}
            {overdueAssumptions.length > 0
              ? ` ${overdueAssumptions.length} ${overdueAssumptions.length === 1 ? "assumption review is" : "assumption reviews are"} overdue.`
              : ""}
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Portfolio summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Value-realization bridge</span>

            <h2>Decision → forecast → validation</h2>
          </div>

          <Gauge size={19} />
        </div>

        <div className="benefit-bridge">
          <article>
            <span>1. Approved target</span>

            <strong>{money(portfolio.baselineTargetSavings, currency)}</strong>

            <div>Frozen decision baseline</div>
          </article>

          <article>
            <span>2. Current forecast</span>

            <strong>{money(portfolio.currentForecastSavings, currency)}</strong>

            <div>Execution expectation</div>
          </article>

          <article>
            <span>3. Operational report</span>

            <strong>{money(portfolio.operationalReportedSavings, currency)}</strong>

            <div>Category initiative reporting</div>
          </article>

          <article>
            <span>4. Validated value</span>

            <strong>{money(portfolio.validatedSavings, currency)}</strong>

            <div>Governance-approved benefit</div>
          </article>
        </div>

        {forecastPct !== null && operationalPct !== null && validatedPct !== null ? (
          <>
            <ProgressLine
              pct={forecastPct}
              tone={forecastPct >= 100 ? meterToneFor("success") : meterToneFor("warning")}
              caption={`Forecast is ${forecastPct.toFixed(0)}% of the decision target`}
              label="Forecast against the decision target"
            />

            <ProgressLine
              pct={operationalPct}
              tone="primary"
              caption={`Operationally reported is ${operationalPct.toFixed(0)}% of the decision target`}
              label="Operationally reported against the decision target"
            />

            <ProgressLine
              pct={validatedPct}
              tone={validatedPct >= 100 ? meterToneFor("success") : "primary"}
              caption={`Formally validated is ${validatedPct.toFixed(0)}% of the decision target`}
              label="Validated savings against the decision target"
            />
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Benefit ownership</span>

            <h2>Selected initiative benefits</h2>
          </div>

          <BadgeCheck size={19} />
        </div>

        <DataTable
          columns={itemColumns}
          rows={orderedItems}
          getRowId={(item) => String(item.id)}
          ariaLabel="Benefit items"
          busy={fetching}
          empty={
            <EmptyState
              icon={BadgeCheck}
              title="No benefit items"
              description="No initiative benefits are selected for this portfolio."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Decision assumptions</span>

            <h2>Benefit assumptions</h2>
          </div>

          {canEdit ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingAssumption(true)}
            >
              <Plus size={15} />
              Add assumption
            </button>
          ) : (
            <ShieldCheck size={19} />
          )}
        </div>

        <DataTable
          columns={assumptionColumns}
          rows={orderedAssumptions}
          getRowId={(assumption) => String(assumption.id)}
          ariaLabel="Benefit assumptions"
          busy={fetching}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="No assumptions"
              description="No benefit assumptions have been recorded."
              action={
                canEdit ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingAssumption(true)}
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

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Value protection</span>

            <h2>Benefit leakage</h2>
          </div>

          {canEdit && itemsForLeakage.length > 0 ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingLeakage(true)}
            >
              <Plus size={15} />
              Record leakage
            </button>
          ) : (
            <TrendingDown size={19} />
          )}
        </div>

        <DataTable
          columns={leakageColumns}
          rows={orderedLeakage}
          getRowId={(leak) => String(leak.id)}
          ariaLabel="Benefit leakage"
          busy={fetching}
          empty={
            <EmptyState
              icon={TrendingDown}
              title="No leakage"
              description="No benefit leakage has been recorded."
              action={
                canEdit && itemsForLeakage.length > 0 ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingLeakage(true)}
                  >
                    <Plus size={15} />
                    Record leakage
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="benefit-integrity-note">
        <ShieldCheck size={18} />

        <div>
          <strong>Approved decision baseline remains immutable</strong>

          <p>
            This module references the approved Step 39 scenario and selected category initiatives.
            It does not rewrite the source scenario, its selection decisions, category-strategy
            baselines or initiative target savings.
          </p>
        </div>
      </section>

      {forecasting !== null ? (
        <ForecastModal
          item={forecasting}
          currency={currency}
          onClose={() => setForecasting(null)}
          onSaved={handleForecastSaved}
        />
      ) : null}

      {validating !== null ? (
        <ValidationModal
          request={validating}
          currency={currency}
          onClose={() => setValidating(null)}
          onSaved={handleValidationSaved}
        />
      ) : null}

      {reassigning !== null ? (
        <OwnerModal
          item={reassigning}
          users={users}
          onClose={() => setReassigning(null)}
          onSaved={handleOwnerSaved}
        />
      ) : null}

      {addingAssumption ? (
        <AssumptionModal
          portfolioId={params.id}
          users={users}
          onClose={() => setAddingAssumption(false)}
          onSaved={handleAssumptionAdded}
        />
      ) : null}

      {addingLeakage ? (
        <LeakageModal
          items={itemsForLeakage}
          users={users}
          currency={currency}
          onClose={() => setAddingLeakage(false)}
          onSaved={handleLeakageAdded}
        />
      ) : null}

      {resolvingLeakage !== null ? (
        <ResolveLeakageModal
          leakage={resolvingLeakage}
          onClose={() => setResolvingLeakage(null)}
          onSaved={handleLeakageResolved}
        />
      ) : null}

      {pending !== null ? (
        <ActionDialog
          eyebrow={PORTFOLIO_ACTIONS[pending].eyebrow}
          title={PORTFOLIO_ACTIONS[pending].title}
          description={portfolioDescription(pending, portfolio)}
          confirmLabel={PORTFOLIO_ACTIONS[pending].confirm}
          busyLabel={PORTFOLIO_ACTIONS[pending].busy}
          cancelLabel={PORTFOLIO_ACTIONS[pending].keep}
          busy={pendingRunning}
          onConfirm={() => void confirmPortfolio()}
          onCancel={() => setPending(null)}
        >
          {pending === "START" && benefitItems.length === 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              This portfolio has no benefit items yet.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {cancellingItem !== null ? (
        <ActionDialog
          eyebrow="Benefit item"
          title="Cancel this benefit item?"
          description={`${cancellingItem.initiativeNumber} — ${cancellingItem.initiativeTitle} will be cancelled and its savings no longer count toward the portfolio.`}
          confirmLabel="Cancel benefit item"
          busyLabel="Cancelling…"
          cancelLabel="Keep item"
          tone="danger"
          busy={cancelRunning}
          onConfirm={() => void confirmCancelItem()}
          onCancel={() => setCancellingItem(null)}
        >
          {cancellingItem.activeLeakageAmount > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              This item has {money(cancellingItem.activeLeakageAmount, currency)} of active leakage.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {assumptionRequest !== null ? (
        <RationaleDialog
          eyebrow="Benefit assumption"
          title={
            assumptionRequest.kind === "CONFIRM"
              ? "Confirm this assumption"
              : "Invalidate this assumption"
          }
          description={
            assumptionRequest.kind === "CONFIRM"
              ? `The ${readable(String(assumptionRequest.assumption.assumptionType))} assumption will be recorded as confirmed.`
              : `The ${readable(String(assumptionRequest.assumption.assumptionType))} assumption will be marked as invalid.`
          }
          label="Resolution note"
          placeholder={
            assumptionRequest.kind === "CONFIRM"
              ? "What confirms this assumption still holds?"
              : "Why is this assumption no longer valid?"
          }
          confirmLabel={
            assumptionRequest.kind === "CONFIRM" ? "Confirm assumption" : "Invalidate assumption"
          }
          busyLabel={assumptionRequest.kind === "CONFIRM" ? "Confirming…" : "Invalidating…"}
          tone={assumptionRequest.kind === "CONFIRM" ? "primary" : "danger"}
          maxLength={2000}
          busy={assumptionRunning}
          error={assumptionError}
          onConfirm={(note) => void confirmAssumption(note)}
          onCancel={() => setAssumptionRequest(null)}
        />
      ) : null}
    </div>
  );
}
