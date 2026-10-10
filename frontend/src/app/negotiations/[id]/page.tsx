"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Coins,
  ExternalLink,
  Flag,
  Handshake,
  History,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  EmptyState,
  Field,
  KpiGrid,
  type KpiItem,
  Meter,
  Modal,
  Skeleton,
  type StatItem,
  StatStrip,
  StatusBadge,
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { NumberField, numberError } from "@/components/kit/number-field";
import {
  activateNegotiationWorkspace,
  addNegotiationRound,
  addNegotiationScenario,
  agreeNegotiationScenario,
  cancelNegotiationWorkspace,
  closeNegotiationWorkspace,
  getNegotiationWorkspace,
} from "@/lib/api";
import type {
  NegotiationRoundSide,
  NegotiationScenario,
  NegotiationScenarioType,
  NegotiationWorkspace,
} from "@/types/negotiation";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Round = NegotiationWorkspace["rounds"][number];
type WorkspaceAction = "ACTIVATE" | "CLOSE" | "CANCEL";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const AGREE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const SCENARIO_TYPES: { value: NegotiationScenarioType; label: string }[] = [
  { value: "TARGET", label: "Target" },
  { value: "WALK_AWAY", label: "Walk-away" },
  { value: "OPTION", label: "Option" },
  { value: "FINAL", label: "Final" },
];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The most recent round overall, or for one side. */
function latestRound(rounds: Round[], side?: NegotiationRoundSide): Round | null {
  let best: Round | null = null;

  for (const item of rounds) {
    if (side !== undefined && item.actorSide !== side) {
      continue;
    }

    if (best === null || item.roundNumber > best.roundNumber) {
      best = item;
    }
  }

  return best;
}

interface ActionCopy {
  eyebrow: string;
  title: string;
  confirm: string;
  busy: string;
  keep: string;
  done: string;
  failed: string;
  tone: "primary" | "danger";
}

const ACTIONS: Record<WorkspaceAction, ActionCopy> = {
  ACTIVATE: {
    eyebrow: "Activate negotiation",
    title: "Activate this negotiation?",
    confirm: "Activate",
    busy: "Activating…",
    keep: "Not yet",
    done: "Negotiation activated",
    failed: "Could not activate the negotiation",
    tone: "primary",
  },
  CLOSE: {
    eyebrow: "Close negotiation",
    title: "Close this negotiation?",
    confirm: "Close negotiation",
    busy: "Closing…",
    keep: "Keep open",
    done: "Negotiation closed",
    failed: "Could not close the negotiation",
    tone: "primary",
  },
  CANCEL: {
    eyebrow: "Cancel negotiation",
    title: "Cancel this negotiation?",
    confirm: "Cancel negotiation",
    busy: "Cancelling…",
    keep: "Keep negotiation",
    done: "Negotiation cancelled",
    failed: "Could not cancel the negotiation",
    tone: "danger",
  },
};

function actionDescription(action: WorkspaceAction, workspace: NegotiationWorkspace): string {
  switch (action) {
    case "ACTIVATE":
      return `${workspace.negotiationNumber} with ${workspace.supplierName} will open for recording commercial rounds and finalizing a scenario.`;

    case "CLOSE":
      return `${workspace.negotiationNumber} will be closed. The agreed outcome stays on record for comparison with the award.`;

    case "CANCEL":
      return `${workspace.negotiationNumber} with ${workspace.supplierName} will be cancelled.`;
  }
}

/* ------------------------------------------------------------------ */
/* Scenario modal                                                      */
/* ------------------------------------------------------------------ */

type ScenarioField = "name" | "value" | "payment" | "lead" | "warranty" | "volume";

interface ScenarioModalProps {
  workspace: NegotiationWorkspace;
  onClose: () => void;
  onSaved: (name: string) => void;
}

function ScenarioModal({ workspace, onClose, onSaved }: ScenarioModalProps) {
  const [name, setName] = useState("Target scenario");
  const [type, setType] = useState<NegotiationScenarioType>("TARGET");
  const [value, setValue] = useState(() =>
    String(round2(workspace.targetValue ?? Math.max(0, workspace.baselineValue * 0.9))),
  );
  const [payment, setPayment] = useState("30");
  const [lead, setLead] = useState("30");
  const [warranty, setWarranty] = useState("12");
  const [volume, setVolume] = useState("");
  const [preferred, setPreferred] = useState(false);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ScenarioField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const overWalkAway =
    type !== "WALK_AWAY" &&
    workspace.walkAwayValue !== null &&
    Number(value) > workspace.walkAwayValue;

  function clearError(field: ScenarioField) {
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

    const next: Partial<Record<ScenarioField, string>> = {};

    if (!name.trim()) {
      next.name = "Enter a scenario name.";
    }

    const checks: [ScenarioField, string, boolean][] = [
      ["value", value, false],
      ["payment", payment, true],
      ["lead", lead, true],
      ["warranty", warranty, true],
    ];

    for (const [field, raw, integer] of checks) {
      const problem = numberError(raw, { min: 0, integer });

      if (problem) {
        next[field] = problem;
      }
    }

    if (volume.trim() !== "") {
      const problem = numberError(volume, { min: 0 });

      if (problem) {
        next.volume = problem;
      }
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addNegotiationScenario(workspace.id, {
        name: name.trim(),
        scenarioType: type,
        totalValue: Number(value),
        paymentTermsDays: Number(payment),
        leadTimeDays: Number(lead),
        warrantyMonths: Number(warranty),
        volumeCommitment:
          volume.trim() !== "" && Number(volume) > 0 ? Number(volume) : undefined,
        preferred,
        notes: notes.trim() || undefined,
      });

      onSaved(name.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create negotiation scenario.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Scenario builder"
      title="Model negotiation position"
      description={`Baseline ${money(workspace.baselineValue, workspace.currency)}. The scenario score and savings are calculated on save.`}
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
            form="negotiation-scenario-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Modeling…" : "Add scenario"}
          </button>
        </>
      }
    >
      <form id="negotiation-scenario-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Scenario name" htmlFor="scenario-name" error={errors.name}>
              <input
                id="scenario-name"
                className="kit-field-input"
                maxLength={220}
                value={name}
                aria-invalid={errors.name ? true : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  clearError("name");
                }}
              />
            </Field>
          </div>

          <Field label="Scenario type" htmlFor="scenario-type">
            <select
              id="scenario-type"
              className="kit-field-input"
              value={type}
              onChange={(event) => setType(event.target.value as NegotiationScenarioType)}
            >
              {SCENARIO_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <NumberField
            id="scenario-value"
            label={`Total value (${workspace.currency})`}
            min={0}
            step="0.01"
            value={value}
            error={errors.value}
            onChange={(next) => {
              setValue(next);
              clearError("value");
            }}
          />

          <NumberField
            id="scenario-payment"
            label="Payment terms (days)"
            min={0}
            step={1}
            value={payment}
            error={errors.payment}
            onChange={(next) => {
              setPayment(next);
              clearError("payment");
            }}
          />

          <NumberField
            id="scenario-lead"
            label="Lead time (days)"
            min={0}
            step={1}
            value={lead}
            error={errors.lead}
            onChange={(next) => {
              setLead(next);
              clearError("lead");
            }}
          />

          <NumberField
            id="scenario-warranty"
            label="Warranty (months)"
            min={0}
            step={1}
            value={warranty}
            error={errors.warranty}
            onChange={(next) => {
              setWarranty(next);
              clearError("warranty");
            }}
          />

          <NumberField
            id="scenario-volume"
            label="Volume commitment (optional)"
            min={0}
            value={volume}
            error={errors.volume}
            onChange={(next) => {
              setVolume(next);
              clearError("volume");
            }}
          />

          <div className="kit-pair-wide">
            <label className="kit-check">
              <input
                type="checkbox"
                checked={preferred}
                onChange={(event) => setPreferred(event.target.checked)}
              />

              <span>Mark as preferred negotiation scenario</span>
            </label>
          </div>

          <div className="kit-pair-wide">
            <Field label="Scenario notes" htmlFor="scenario-notes">
              <textarea
                id="scenario-notes"
                className="kit-field-input"
                rows={4}
                maxLength={3000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {overWalkAway && workspace.walkAwayValue !== null ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This value is above the walk-away value of{" "}
            {money(workspace.walkAwayValue, workspace.currency)}.
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
/* Round modal                                                         */
/* ------------------------------------------------------------------ */

type RoundField = "offer" | "payment" | "lead" | "warranty" | "volume";

interface RoundModalProps {
  workspace: NegotiationWorkspace;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function RoundModal({ workspace, onClose, onSaved }: RoundModalProps) {
  const last = latestRound(workspace.rounds);

  const [side, setSide] = useState<NegotiationRoundSide>(() =>
    last !== null && last.actorSide === "SUPPLIER" ? "BUYER" : "SUPPLIER",
  );
  const [offer, setOffer] = useState(() =>
    String(last !== null ? last.offerValue : workspace.baselineValue),
  );
  const [payment, setPayment] = useState(() =>
    String(last !== null ? last.paymentTermsDays : 30),
  );
  const [lead, setLead] = useState(() => String(last !== null ? last.leadTimeDays : 30));
  const [warranty, setWarranty] = useState(() =>
    String(last !== null ? last.warrantyMonths : 12),
  );
  const [volume, setVolume] = useState(() =>
    last !== null && last.volumeCommitment !== null ? String(last.volumeCommitment) : "",
  );
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<RoundField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const buyerOverWalkAway =
    side === "BUYER" &&
    workspace.walkAwayValue !== null &&
    Number(offer) > workspace.walkAwayValue;

  function clearError(field: RoundField) {
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

    const next: Partial<Record<RoundField, string>> = {};

    const checks: [RoundField, string, boolean][] = [
      ["offer", offer, false],
      ["payment", payment, true],
      ["lead", lead, true],
      ["warranty", warranty, true],
    ];

    for (const [field, raw, integer] of checks) {
      const problem = numberError(raw, { min: 0, integer });

      if (problem) {
        next[field] = problem;
      }
    }

    if (volume.trim() !== "") {
      const problem = numberError(volume, { min: 0 });

      if (problem) {
        next.volume = problem;
      }
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addNegotiationRound(workspace.id, {
        actorSide: side,
        offerValue: Number(offer),
        paymentTermsDays: Number(payment),
        leadTimeDays: Number(lead),
        warrantyMonths: Number(warranty),
        volumeCommitment:
          volume.trim() !== "" && Number(volume) > 0 ? Number(volume) : undefined,
        notes: notes.trim() || undefined,
      });

      onSaved(`${readable(side)} offer of ${money(Number(offer), workspace.currency)}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record negotiation round.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Negotiation log"
      title="Record commercial round"
      description={
        last !== null
          ? `Round ${last.roundNumber + 1}. The fields start from the previous round.`
          : "Round 1. The offer starts from the baseline quotation."
      }
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
            form="negotiation-round-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record round"}
          </button>
        </>
      }
    >
      <form id="negotiation-round-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Offer side" htmlFor="round-side">
            <select
              id="round-side"
              className="kit-field-input"
              value={side}
              onChange={(event) => setSide(event.target.value as NegotiationRoundSide)}
            >
              <option value="SUPPLIER">Supplier</option>

              <option value="BUYER">Buyer</option>
            </select>
          </Field>

          <NumberField
            id="round-offer"
            label={`Offer value (${workspace.currency})`}
            min={0}
            step="0.01"
            value={offer}
            error={errors.offer}
            onChange={(next) => {
              setOffer(next);
              clearError("offer");
            }}
          />

          <NumberField
            id="round-payment"
            label="Payment terms (days)"
            min={0}
            step={1}
            value={payment}
            error={errors.payment}
            onChange={(next) => {
              setPayment(next);
              clearError("payment");
            }}
          />

          <NumberField
            id="round-lead"
            label="Lead time (days)"
            min={0}
            step={1}
            value={lead}
            error={errors.lead}
            onChange={(next) => {
              setLead(next);
              clearError("lead");
            }}
          />

          <NumberField
            id="round-warranty"
            label="Warranty (months)"
            min={0}
            step={1}
            value={warranty}
            error={errors.warranty}
            onChange={(next) => {
              setWarranty(next);
              clearError("warranty");
            }}
          />

          <NumberField
            id="round-volume"
            label="Volume commitment (optional)"
            min={0}
            value={volume}
            error={errors.volume}
            onChange={(next) => {
              setVolume(next);
              clearError("volume");
            }}
          />

          <div className="kit-pair-wide">
            <Field label="Round notes" htmlFor="round-notes">
              <textarea
                id="round-notes"
                className="kit-field-input"
                rows={4}
                maxLength={3000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {buyerOverWalkAway && workspace.walkAwayValue !== null ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This buyer offer is above the walk-away value of{" "}
            {money(workspace.walkAwayValue, workspace.currency)}.
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

interface WorkspaceData {
  id: string;
  workspace: NegotiationWorkspace;
}

export default function NegotiationDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canAgree = user !== null && AGREE_ROLES.includes(user.role);

  const [result, setResult] = useState<WorkspaceData | null>(null);
  const [pendingAction, setPendingAction] = useState<WorkspaceAction | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [agreeing, setAgreeing] = useState<NegotiationScenario | null>(null);
  const [agreeRunning, setAgreeRunning] = useState(false);
  const [adding, setAdding] = useState<"SCENARIO" | "ROUND" | null>(null);
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
        const response = await getNegotiationWorkspace(id);

        if (active) {
          setResult({ id, workspace: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load negotiation workspace.",
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
  const workspace = data?.workspace ?? null;

  async function confirmAction() {
    if (!workspace || pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setActionRunning(true);

    try {
      if (action === "ACTIVATE") {
        await activateNegotiationWorkspace(workspace.id);
      } else if (action === "CLOSE") {
        await closeNegotiationWorkspace(workspace.id);
      } else {
        await cancelNegotiationWorkspace(workspace.id);
      }

      setPendingAction(null);

      toast.success(ACTIONS[action].done, workspace.negotiationNumber);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update the negotiation.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function confirmAgree() {
    if (!workspace || agreeing === null) {
      return;
    }

    const scenario = agreeing;

    setAgreeRunning(true);

    try {
      await agreeNegotiationScenario(workspace.id, scenario.id);

      setAgreeing(null);

      toast.success("Scenario finalized", scenario.name);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setAgreeing(null);

      toast.error(
        "Could not finalize the scenario",
        caught instanceof Error
          ? caught.message
          : "Unable to finalize negotiated agreement.",
      );
    } finally {
      setAgreeRunning(false);
    }
  }

  function handleScenarioSaved(name: string) {
    setAdding(null);
    toast.success("Scenario added", name);
    setReloadKey((key) => key + 1);
  }

  function handleRoundSaved(message: string) {
    setAdding(null);
    toast.success("Round recorded", message);
    setReloadKey((key) => key + 1);
  }

  if (workspace === null) {
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
        <Link href="/negotiations" className="request-back-link">
          <ArrowLeft size={16} />
          Negotiations
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

  const currency = workspace.currency;
  const busyAny = actionRunning || agreeRunning;
  const isActive = workspace.status === "ACTIVE";
  const canModel = canManage && (workspace.status === "DRAFT" || isActive);

  const supplierOffer = latestRound(workspace.rounds, "SUPPLIER");
  const buyerOffer = latestRound(workspace.rounds, "BUYER");
  const gap =
    supplierOffer !== null && buyerOffer !== null
      ? supplierOffer.offerValue - buyerOffer.offerValue
      : null;

  const supplierAboveWalkAway =
    isActive &&
    supplierOffer !== null &&
    workspace.walkAwayValue !== null &&
    supplierOffer.offerValue > workspace.walkAwayValue;

  const targetSpan = workspace.targetValue !== null ? workspace.baselineValue - workspace.targetValue : 0;
  const captured =
    workspace.agreedValue !== null && targetSpan > 0
      ? ((workspace.baselineValue - workspace.agreedValue) / targetSpan) * 100
      : null;

  const kpis: KpiItem[] = [
    {
      label: "Baseline",
      icon: Coins,
      value: money(workspace.baselineValue, currency),
      note: "Submitted supplier quotation",
    },
    {
      label: "Target",
      icon: Target,
      value: workspace.targetValue !== null ? money(workspace.targetValue, currency) : "—",
      note: `${money(workspace.targetSavings, currency)} target savings`,
    },
    {
      label: "Walk-away",
      icon: Flag,
      value: workspace.walkAwayValue !== null ? money(workspace.walkAwayValue, currency) : "—",
      note: "Maximum acceptable commercial value",
    },
    {
      label: "Agreed value",
      icon: Handshake,
      value: workspace.agreedValue !== null ? money(workspace.agreedValue, currency) : "—",
      note: `${workspace.agreedSavingsPct.toFixed(1)}% savings`,
    },
  ];

  const positionStats: StatItem[] = [
    { label: "Rounds recorded", value: String(workspace.rounds.length) },
    {
      label: "Latest supplier offer",
      value: supplierOffer !== null ? money(supplierOffer.offerValue, currency) : "—",
    },
    {
      label: "Latest buyer offer",
      value: buyerOffer !== null ? money(buyerOffer.offerValue, currency) : "—",
    },
    {
      label: "Remaining gap",
      value: gap === null ? "—" : gap <= 0 ? "Converged" : money(gap, currency),
    },
  ];

  const agreeOverWalkAway =
    agreeing !== null &&
    workspace.walkAwayValue !== null &&
    agreeing.totalValue > workspace.walkAwayValue;
  const agreeNoSavings = agreeing !== null && agreeing.totalValue >= workspace.baselineValue;

  return (
    <div className="page-stack">
      <Link href="/negotiations" className="request-back-link">
        <ArrowLeft size={16} />
        Negotiations
      </Link>

      <section className="negotiation-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{workspace.negotiationNumber}</span>

            <StatusBadge value={workspace.status} />
          </div>

          <h1>{workspace.supplierName}</h1>

          <p>
            {workspace.rfqNumber}
            {" · "}
            {workspace.rfqTitle}
            {" · Owner: "}
            {workspace.ownerName}
          </p>
        </div>

        <div className="negotiation-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canAgree && (workspace.status === "DRAFT" || isActive) ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() => setPendingAction("CANCEL")}
            >
              <XCircle size={16} />
              Cancel
            </button>
          ) : null}

          {canManage && workspace.status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingAction("ACTIVATE")}
            >
              <Handshake size={16} />
              Activate
            </button>
          ) : null}

          {canManage && workspace.status === "AGREED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setPendingAction("CLOSE")}
            >
              <BadgeCheck size={16} />
              Close negotiation
            </button>
          ) : null}
        </div>
      </section>

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

      {workspace.supplierRiskLevel === "HIGH" || workspace.supplierRiskLevel === "CRITICAL" ? (
        <section className="negotiation-risk-banner">
          <ShieldAlert size={18} />

          <div>
            <strong>Elevated supplier risk</strong>

            <span>
              Supplier risk is currently {workspace.supplierRiskLevel}. Commercial concessions
              should be assessed together with risk mitigation.
            </span>
          </div>
        </section>
      ) : null}

      {supplierAboveWalkAway && supplierOffer !== null && workspace.walkAwayValue !== null ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The supplier is above your walk-away value.</strong> Their latest offer of{" "}
            {money(supplierOffer.offerValue, currency)} exceeds the walk-away value of{" "}
            {money(workspace.walkAwayValue, currency)}.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Negotiation summary" />

      {workspace.rounds.length > 0 ? <StatStrip items={positionStats} /> : null}

      {captured !== null ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Agreed outcome</span>

              <h2>Target savings captured</h2>
            </div>

            <Handshake size={19} />
          </div>

          <div className="kit-meter-wrap">
            <Meter
              value={Math.max(0, Math.min(captured, 100))}
              max={100}
              tone={meterToneFor(captured >= 100 ? "success" : "warning")}
              ariaLabel="Share of the target savings captured"
            />

            <span className="kit-meter-caption">
              {captured.toFixed(0)}% of the target savings captured against the baseline
            </span>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Scenario modeling</span>

            <h2>Commercial scenarios</h2>
          </div>

          {canModel ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAdding("SCENARIO")}
            >
              <Plus size={15} />
              Add scenario
            </button>
          ) : (
            <Target size={19} />
          )}
        </div>

        {workspace.scenarios.length === 0 ? (
          <EmptyState
            compact
            icon={Target}
            title="No scenarios yet"
            description="Model a target, walk-away or option scenario to compare positions."
            action={
              canModel ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setAdding("SCENARIO")}
                >
                  <Plus size={15} />
                  Add scenario
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="negotiation-scenario-grid">
            {workspace.scenarios.map((scenario) => (
              <article
                key={scenario.id}
                className={
                  scenario.preferred
                    ? "negotiation-scenario-card negotiation-scenario-card--preferred"
                    : "negotiation-scenario-card"
                }
              >
                <div className="negotiation-scenario-heading">
                  <div>
                    <span>{readable(scenario.scenarioType)}</span>

                    <strong>{scenario.name}</strong>
                  </div>

                  <div>
                    {scenario.preferred ? (
                      <span className="negotiation-preferred-chip">Preferred</span>
                    ) : null}

                    <strong className="negotiation-score">
                      {scenario.scenarioScore.toFixed(1)}
                    </strong>
                  </div>
                </div>

                <div className="negotiation-scenario-value">
                  <strong>{money(scenario.totalValue, currency)}</strong>

                  <span>
                    {money(scenario.priceSavings, currency)}
                    {" savings · "}
                    {scenario.savingsPct.toFixed(1)}%
                  </span>
                </div>

                <div className="negotiation-term-grid">
                  <div>
                    <span>Payment</span>

                    <strong>{scenario.paymentTermsDays} days</strong>
                  </div>

                  <div>
                    <span>Lead time</span>

                    <strong>{scenario.leadTimeDays} days</strong>
                  </div>

                  <div>
                    <span>Warranty</span>

                    <strong>{scenario.warrantyMonths} months</strong>
                  </div>

                  <div>
                    <span>Volume</span>

                    <strong>{scenario.volumeCommitment ?? "—"}</strong>
                  </div>
                </div>

                {scenario.notes ? <p>{scenario.notes}</p> : null}

                {canAgree && isActive ? (
                  <button
                    type="button"
                    className="negotiation-agree-button"
                    disabled={busyAny}
                    onClick={() => setAgreeing(scenario)}
                  >
                    <Handshake size={14} />
                    Finalize this scenario
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Negotiation history</span>

            <h2>Commercial rounds</h2>
          </div>

          {canManage && isActive ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAdding("ROUND")}
            >
              <Plus size={15} />
              Record round
            </button>
          ) : (
            <History size={19} />
          )}
        </div>

        {workspace.rounds.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title="No rounds recorded"
            description={
              isActive
                ? "Record each offer and counter-offer as the negotiation progresses."
                : "Rounds can be recorded once the negotiation is active."
            }
            action={
              canManage && isActive ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setAdding("ROUND")}
                >
                  <Plus size={15} />
                  Record round
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="negotiation-round-list">
            {workspace.rounds.map((round) => (
              <article
                key={round.id}
                className={`negotiation-round negotiation-round--${round.actorSide.toLowerCase()}`}
              >
                <div className="negotiation-round-number">{round.roundNumber}</div>

                <div>
                  <div className="negotiation-round-heading">
                    <strong>
                      {readable(round.actorSide)}
                      {" offer"}
                    </strong>

                    <span>{formatDateTime(round.roundAt)}</span>
                  </div>

                  <strong className="negotiation-round-value">
                    {money(round.offerValue, currency)}
                  </strong>

                  <div className="negotiation-round-terms">
                    <span>Payment {round.paymentTermsDays}d</span>

                    <span>Lead {round.leadTimeDays}d</span>

                    <span>Warranty {round.warrantyMonths}m</span>

                    {round.volumeCommitment !== null ? (
                      <span>Volume {round.volumeCommitment}</span>
                    ) : null}
                  </div>

                  {round.notes ? <p>{round.notes}</p> : null}

                  <small>Recorded by {round.createdByName}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="negotiation-comparison-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Award comparison</span>

              <h2>Negotiated vs awarded</h2>
            </div>

            <Coins size={19} />
          </div>

          {workspace.awardedValue === null ? (
            <EmptyState
              compact
              icon={Coins}
              title="No award outcome yet"
              description="The comparison appears once this RFQ has been awarded."
            />
          ) : (
            <div className="negotiation-award-grid">
              <div>
                <span>Awarded supplier</span>

                <strong>{workspace.awardedSupplierName}</strong>
              </div>

              <div>
                <span>Award value</span>

                <strong>{money(workspace.awardedValue, currency)}</strong>
              </div>

              <div>
                <span>Award savings</span>

                <strong>{money(workspace.awardSavingsFromBaseline ?? 0, currency)}</strong>
              </div>

              <div>
                <span>Agreement → award delta</span>

                <strong>
                  {workspace.agreementToAwardDelta !== null
                    ? money(workspace.agreementToAwardDelta, currency)
                    : "—"}
                </strong>
              </div>

              <div className="negotiation-award-wide">
                <span>Supplier match</span>

                <strong>
                  {workspace.agreementSupplierMatchesAward === null
                    ? "—"
                    : workspace.agreementSupplierMatchesAward
                      ? "Negotiated supplier won the award"
                      : "Award was made to another supplier"}
                </strong>
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Sourcing context</span>

              <h2>RFQ &amp; supplier</h2>
            </div>

            <Handshake size={19} />
          </div>

          <div className="negotiation-context-grid">
            <div>
              <span>RFQ</span>

              <strong>{workspace.rfqNumber}</strong>

              <Link href={`/rfqs/${workspace.rfqId}`} className="table-action">
                Open RFQ
                <ExternalLink size={12} />
              </Link>
            </div>

            <div>
              <span>Supplier</span>

              <strong>{workspace.supplierName}</strong>

              <Link href={`/suppliers/${workspace.supplierId}`} className="table-action">
                Supplier 360
                <ExternalLink size={12} />
              </Link>
            </div>

            <div>
              <span>Supplier risk</span>

              <strong>{workspace.supplierRiskLevel ?? "—"}</strong>
            </div>

            <div>
              <span>Scenarios / rounds</span>

              <strong>
                {workspace.scenarios.length}
                {" / "}
                {workspace.rounds.length}
              </strong>
            </div>
          </div>

          {workspace.notes ? <div className="negotiation-notes">{workspace.notes}</div> : null}
        </section>
      </section>

      {adding === "SCENARIO" ? (
        <ScenarioModal
          workspace={workspace}
          onClose={() => setAdding(null)}
          onSaved={handleScenarioSaved}
        />
      ) : null}

      {adding === "ROUND" ? (
        <RoundModal
          workspace={workspace}
          onClose={() => setAdding(null)}
          onSaved={handleRoundSaved}
        />
      ) : null}

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={ACTIONS[pendingAction].eyebrow}
          title={ACTIONS[pendingAction].title}
          description={actionDescription(pendingAction, workspace)}
          confirmLabel={ACTIONS[pendingAction].confirm}
          busyLabel={ACTIONS[pendingAction].busy}
          cancelLabel={ACTIONS[pendingAction].keep}
          tone={ACTIONS[pendingAction].tone}
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        >
          {pendingAction === "ACTIVATE" && workspace.scenarios.length === 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              No scenarios have been modeled yet. You can add them after activating.
            </p>
          ) : null}

          {pendingAction === "CANCEL" && workspace.rounds.length > 0 ? (
            <p className="kit-dialog-note">
              {workspace.rounds.length} recorded {workspace.rounds.length === 1 ? "round" : "rounds"}{" "}
              will stay on record.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {agreeing !== null ? (
        <ActionDialog
          eyebrow="Finalize agreement"
          title="Finalize this scenario?"
          description={`“${agreeing.name}” at ${money(agreeing.totalValue, currency)} will be recorded as the agreed outcome with ${workspace.supplierName}.`}
          confirmLabel="Finalize scenario"
          busyLabel="Finalizing…"
          cancelLabel="Not yet"
          busy={agreeRunning}
          onConfirm={() => void confirmAgree()}
          onCancel={() => setAgreeing(null)}
        >
          {agreeOverWalkAway && workspace.walkAwayValue !== null ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              This scenario is above the walk-away value of{" "}
              {money(workspace.walkAwayValue, currency)}.
            </p>
          ) : null}

          {agreeNoSavings ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              This scenario does not save anything against the baseline of{" "}
              {money(workspace.baselineValue, currency)}.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}
    </div>
  );
}
