"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Gauge,
  Info,
  Plus,
  RefreshCw,
  Send,
  Target,
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
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addSavingsRealization,
  closeSavingsInitiative,
  getSavingsContextOptions,
  getSavingsInitiative,
  rejectSavingsInitiative,
  submitSavingsInitiative,
  validateSavingsInitiative,
} from "@/lib/api";
import type { SavingsContextOptions, SavingsInitiative } from "@/types/savings";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Realization = SavingsInitiative["realizations"][number];
type Flow = "SUBMIT" | "CLOSE";
type RationaleKind = "VALIDATE" | "REJECT";
type RealizationField = "amount" | "date";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const VALIDATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
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

function SavingsBadge({ status }: { status: string }) {
  return <StatusBadge value={status} label={readable(status)} />;
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
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
}

const FLOWS: Record<Flow, FlowCopy> = {
  SUBMIT: {
    eyebrow: "Value assurance",
    title: "Submit for validation?",
    confirm: "Submit for validation",
    busy: "Submitting…",
    keep: "Not yet",
    done: "Submitted for validation",
    failed: "Could not submit the initiative",
  },
  CLOSE: {
    eyebrow: "Initiative lifecycle",
    title: "Close this initiative?",
    confirm: "Close initiative",
    busy: "Closing…",
    keep: "Keep open",
    done: "Initiative closed",
    failed: "Could not close the initiative",
  },
};

function flowDescription(flow: Flow, initiative: SavingsInitiative): string {
  switch (flow) {
    case "SUBMIT":
      return `${initiative.savingsNumber} will be submitted to value assurance with a target of ${money(initiative.targetSavings, initiative.currency)}. A manager then validates or rejects the savings.`;

    case "CLOSE":
      return initiative.remainingSavings > 0.005
        ? `${initiative.savingsNumber} will be closed with ${money(initiative.remainingSavings, initiative.currency)} of the ${money(initiative.targetSavings, initiative.currency)} target not realized. No further realizations can be recorded.`
        : `${initiative.savingsNumber} will be closed. The target has been realized in full.`;
  }
}

function performFlow(flow: Flow, initiativeId: string): Promise<SavingsInitiative> {
  switch (flow) {
    case "SUBMIT":
      return submitSavingsInitiative(initiativeId);

    case "CLOSE":
      return closeSavingsInitiative(initiativeId);
  }
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

function rationaleCopy(kind: RationaleKind, initiative: SavingsInitiative): RationaleCopy {
  switch (kind) {
    case "VALIDATE":
      return {
        eyebrow: "Value assurance",
        title: "Validate savings",
        description: `${initiative.savingsNumber} will be validated with a target of ${money(initiative.targetSavings, initiative.currency)} against a baseline of ${money(initiative.baselineValue, initiative.currency)}. Realized savings can then be recorded against it.`,
        label: "Validation rationale",
        placeholder: "Why are these savings validated?",
        confirm: "Validate savings",
        busy: "Validating…",
        tone: "primary",
        done: "Savings validated",
      };

    case "REJECT":
      return {
        eyebrow: "Value assurance",
        title: "Reject savings",
        description: `${initiative.savingsNumber} will be rejected. No savings can be realized against it.`,
        label: "Rejection rationale",
        placeholder: "Why are these savings rejected?",
        confirm: "Reject savings",
        busy: "Rejecting…",
        cancelLabel: "Keep for review",
        tone: "danger",
        done: "Savings rejected",
      };
  }
}

function performRationale(
  kind: RationaleKind,
  initiativeId: string,
  note: string,
): Promise<SavingsInitiative> {
  switch (kind) {
    case "VALIDATE":
      return validateSavingsInitiative(initiativeId, note);

    case "REJECT":
      return rejectSavingsInitiative(initiativeId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildRealizationColumns(currency: string): Column<Realization>[] {
  return [
    {
      id: "date",
      header: "Date",
      sortValue: (item) => String(item.realizationDate ?? ""),
      cell: (item) => showDate(item.realizationDate),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (item) => item.amount,
      cell: (item) => <strong>{money(item.amount, currency)}</strong>,
    },
    {
      id: "source",
      header: "Source",
      sortValue: (item) => String(item.sourceType),
      cell: (item) => readable(String(item.sourceType)),
    },
    {
      id: "po",
      header: "Purchase order",
      sortValue: (item) => String(item.purchaseOrderNumber ?? "").toLowerCase(),
      cell: (item) => item.purchaseOrderNumber ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "by",
      header: "Recorded by",
      sortValue: (item) => String(item.createdByName ?? "").toLowerCase(),
      cell: (item) => item.createdByName ?? <span className="kit-text-muted">—</span>,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Record realization modal                                            */
/* ------------------------------------------------------------------ */

interface RealizationModalProps {
  initiative: SavingsInitiative;
  options: SavingsContextOptions;
  onClose: () => void;
  onSaved: (amountText: string) => Promise<void>;
}

function RealizationModal({ initiative, options, onClose, onSaved }: RealizationModalProps) {
  const currency = initiative.currency;
  const remaining = initiative.remainingSavings;

  const [amount, setAmount] = useState(() => String(Math.max(0, remaining)));
  const [date, setDate] = useState(() => isoDate(0));
  const [poId, setPoId] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<RealizationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const purchaseOrders = options.purchaseOrders.filter(
    (order) =>
      (!initiative.supplierId || order.supplierId === initiative.supplierId) &&
      order.currency === currency,
  );

  const amountValid = numberError(amount, { min: 0.01 }) === undefined;
  const aboveRemaining = amountValid && Number(amount) > remaining + 0.005;

  function clearError(field: RealizationField) {
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

    const next: Partial<Record<RealizationField, string>> = {};

    const problem = numberError(amount, { min: 0.01 });

    if (problem) {
      next.amount = problem;
    }

    if (!date) {
      next.date = "Choose the realization date.";
    } else if (date > isoDate(0)) {
      next.date = "The realization date cannot be in the future.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addSavingsRealization(initiative.id, {
        amount: Number(amount),
        realizationDate: date,
        purchaseOrderId: poId || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record savings realization.",
      );
      setSaving(false);

      return;
    }

    await onSaved(money(Number(amount), currency));
  }

  return (
    <Modal
      eyebrow="Realization entry"
      title="Record realized value"
      description={`Record savings realized against ${initiative.savingsNumber}.`}
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
            form="savings-realization-form"
            className="button button--primary"
            disabled={saving}
          >
            <Plus size={16} />
            {saving ? "Recording…" : "Record realization"}
          </button>
        </>
      }
    >
      <form id="savings-realization-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div>
            <NumberField
              id="savings-amount"
              label={`Amount (${currency})`}
              min={0.01}
              step="0.01"
              value={amount}
              error={errors.amount}
              onChange={(value) => {
                setAmount(value);
                clearError("amount");
              }}
            />

            <p className="kit-meta-line">Still to be realized: {money(remaining, currency)}</p>
          </div>

          <Field label="Realization date" htmlFor="savings-date" error={errors.date}>
            <input
              id="savings-date"
              className="kit-field-input"
              type="date"
              value={date}
              aria-invalid={errors.date ? true : undefined}
              onChange={(event) => {
                setDate(event.target.value);
                clearError("date");
              }}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Purchase order" htmlFor="savings-po">
              <select
                id="savings-po"
                className="kit-field-input"
                value={poId}
                onChange={(event) => setPoId(event.target.value)}
              >
                <option value="">No purchase order</option>

                {purchaseOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.purchaseOrderNumber} — {money(order.totalAmount, order.currency)}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              {purchaseOrders.length === 0
                ? `No purchase order matches ${initiative.supplierName ? initiative.supplierName : "this initiative"} in ${currency}.`
                : `Only purchase orders ${initiative.supplierName ? `from ${initiative.supplierName} ` : ""}in ${currency} are listed.`}
            </p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Notes" htmlFor="savings-notes">
              <textarea
                id="savings-notes"
                className="kit-field-input"
                rows={4}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {aboveRemaining ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This is above the {money(Math.max(remaining, 0), currency)} still to be realized, so
            realized savings would exceed the {money(initiative.targetSavings, currency)} target.
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

interface InitiativeData {
  id: string;
  initiative: SavingsInitiative;
  options: SavingsContextOptions;
}

export default function SavingsDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canValidate = user !== null && VALIDATE_ROLES.includes(user.role);

  const [result, setResult] = useState<InitiativeData | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [recording, setRecording] = useState(false);
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
        const [initiativeResponse, optionsResponse] = await Promise.all([
          getSavingsInitiative(id),
          getSavingsContextOptions(),
        ]);

        if (active) {
          setResult({ id, initiative: initiativeResponse, options: optionsResponse });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load savings initiative.");
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

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyInitiative(updated: SavingsInitiative) {
    setResult((current) => (current ? { ...current, initiative: updated } : current));
  }

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getSavingsInitiative(id);

      setResult((current) =>
        current && current.id === id ? { ...current, initiative: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the initiative.");
    }
  }

  if (data === null) {
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
        <Link href="/savings" className="request-back-link">
          <ArrowLeft size={16} />
          Savings & value
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

  const { initiative, options } = data;
  const currency = initiative.currency;
  const status = String(initiative.status);
  const draft = status === "DRAFT";
  const submitted = status === "SUBMITTED";
  const validated = status === "VALIDATED";
  const rejected = status === "REJECTED";
  const closed = status === "CLOSED";
  const busyAny = flowRunning || rationaleRunning;
  const fullyRealized = initiative.remainingSavings <= 0.005;
  const showProgress =
    initiative.targetSavings > 0 && (validated || closed || initiative.realizations.length > 0);

  async function confirmFlow() {
    if (flow === null) {
      return;
    }

    const action = flow;

    setFlowRunning(true);

    try {
      applyInitiative(await performFlow(action, params.id));

      setFlow(null);

      toast.success(FLOWS[action].done, initiative.savingsNumber);
    } catch (caught) {
      setFlow(null);

      toast.error(
        FLOWS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update savings workflow.",
      );
    } finally {
      setFlowRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const kind = rationale;
    const copy = rationaleCopy(kind, initiative);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      applyInitiative(await performRationale(kind, params.id, note.trim()));

      setRationale(null);

      toast.success(copy.done, initiative.savingsNumber);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to record the decision.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(kind: RationaleKind) {
    setRationaleError(null);
    setRationale(kind);
  }

  async function handleRecorded(amountText: string) {
    await refresh();

    setRecording(false);

    toast.success("Realization recorded", amountText);
  }

  const orderedRealizations = [...initiative.realizations].sort((a, b) =>
    String(b.realizationDate ?? "").localeCompare(String(a.realizationDate ?? "")),
  );

  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, initiative) : null;

  const kpis: KpiItem[] = [
    {
      label: "Target savings",
      icon: Target,
      value: money(initiative.targetSavings, currency),
      note: `Baseline ${money(initiative.baselineValue, currency)}`,
    },
    {
      label: "Realized",
      icon: Banknote,
      value: money(initiative.realizedSavings, currency),
      note: `${initiative.realizationRate.toFixed(1)}% realization`,
    },
    {
      label: "Remaining",
      icon: BadgeDollarSign,
      value: money(initiative.remainingSavings, currency),
      note: "Target less realized",
    },
    {
      label: "Negotiated",
      icon: FileCheck2,
      value: money(initiative.negotiatedValue, currency),
      note: "Commercial value",
    },
  ];

  const realizationColumns = buildRealizationColumns(currency);

  return (
    <div className="page-stack">
      <Link href="/savings" className="request-back-link">
        <ArrowLeft size={16} />
        Savings & value
      </Link>

      <section className="savings-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{initiative.savingsNumber}</span>

            <SavingsBadge status={status} />

            <span>{readable(String(initiative.origin))}</span>
          </div>

          <h1>{initiative.title}</h1>

          <p>
            {readable(String(initiative.savingsType))}
            {" · "}
            {initiative.category ?? "Uncategorized"}
            {" · Owner: "}
            {initiative.ownerName}
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

          {canManage && validated ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record realization
            </button>
          ) : null}

          {canValidate && submitted ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => openRationale("REJECT")}
            >
              <XCircle size={15} />
              Reject
            </button>
          ) : null}

          {canValidate && submitted ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale("VALIDATE")}
            >
              <CheckCircle2 size={16} />
              Validate savings
            </button>
          ) : null}

          {canManage && draft ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setFlow("SUBMIT")}
            >
              <Send size={16} />
              Submit
            </button>
          ) : null}

          {canValidate && validated ? (
            <button
              type="button"
              className={`button ${fullyRealized ? "button--primary" : "button--secondary"}`}
              disabled={busyAny}
              onClick={() => setFlow("CLOSE")}
            >
              <CheckCircle2 size={16} />
              Close initiative
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

      {rejected ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>These savings were rejected.</strong> No savings can be realized against the
            initiative. The decision rationale is shown below.
          </div>
        </div>
      ) : null}

      {draft && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Submit when the baseline and target are final.</strong> A manager then
            validates or rejects the savings.
          </div>
        </div>
      ) : null}

      {submitted ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting value assurance.</strong>{" "}
            {canValidate
              ? "Use Validate savings or Reject above."
              : "A procurement manager or administrator needs to decide."}
          </div>
        </div>
      ) : null}

      {validated && canManage && !fullyRealized ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>{money(initiative.remainingSavings, currency)} is still to be realized.</strong>{" "}
            Record realizations as the savings are achieved
            {canValidate ? ", and close the initiative when it is finished." : "."}
          </div>
        </div>
      ) : null}

      {validated && fullyRealized ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The target is fully realized.</strong>{" "}
            {canValidate
              ? "Close the initiative to finish the lifecycle."
              : "A procurement manager or administrator can close the initiative."}
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Savings summary" />

      {showProgress ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Progress</span>

              <h2>Realization against the target</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={initiative.realizationRate}
            tone={initiative.realizationRate >= 100 ? meterToneFor("success") : "primary"}
            caption={`${money(initiative.realizedSavings, currency)} of ${money(initiative.targetSavings, currency)} target realized (${initiative.realizationRate.toFixed(1)}%)`}
            label="Realized savings against the target"
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Procurement context</span>

            <h2>Value attribution</h2>
          </div>
        </div>

        <div className="savings-context-grid">
          <div>
            <span>Supplier</span>

            {initiative.supplierId ? (
              <Link href={`/suppliers/${initiative.supplierId}`}>{initiative.supplierName}</Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>RFQ</span>

            {initiative.rfqId ? (
              <Link href={`/rfqs/${initiative.rfqId}`}>{initiative.rfqNumber}</Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>Purchase order</span>

            {initiative.purchaseOrderId ? (
              <Link href={`/purchase-orders/${initiative.purchaseOrderId}`}>
                {initiative.purchaseOrderNumber}
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>Fiscal year</span>

            <strong>
              {initiative.fiscalYear}
              {" · "}
              {currency}
            </strong>
          </div>
        </div>
      </section>

      {initiative.decisionNote ? (
        <section className="savings-decision-card">
          <FileCheck2 size={19} />

          <div>
            <span>Value assurance decision</span>

            <strong>{initiative.decisionNote}</strong>

            <small>
              {initiative.decidedByName ?? "Management"}
              {initiative.decisionAt ? ` · ${formatDateTime(initiative.decisionAt)}` : ""}
            </small>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Value realization</span>

            <h2>Realization history</h2>
          </div>

          {canManage && validated ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record realization
            </button>
          ) : (
            <Banknote size={19} />
          )}
        </div>

        <DataTable
          columns={realizationColumns}
          rows={orderedRealizations}
          getRowId={(item) => String(item.id)}
          ariaLabel="Savings realization history"
          busy={fetching}
          empty={
            <EmptyState
              icon={Banknote}
              title="No realizations"
              description="No savings realization has been recorded."
              action={
                canManage && validated ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setRecording(true)}
                  >
                    <Plus size={15} />
                    Record realization
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {recording ? (
        <RealizationModal
          initiative={initiative}
          options={options}
          onClose={() => setRecording(false)}
          onSaved={handleRecorded}
        />
      ) : null}

      {flow !== null ? (
        <ActionDialog
          eyebrow={FLOWS[flow].eyebrow}
          title={FLOWS[flow].title}
          description={flowDescription(flow, initiative)}
          confirmLabel={FLOWS[flow].confirm}
          busyLabel={FLOWS[flow].busy}
          cancelLabel={FLOWS[flow].keep}
          busy={flowRunning}
          onConfirm={() => void confirmFlow()}
          onCancel={() => setFlow(null)}
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
          maxLength={2000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
