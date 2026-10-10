"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  FileCheck2,
  Gauge,
  Goal,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
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
  cancelOutcomePersistenceControl,
  closeOutcomePersistencePlan,
  completeOutcomePersistenceControl,
  createOutcomePersistenceControl,
  getOutcomePersistencePlan,
  recordOutcomePersistenceObservation,
  startOutcomePersistenceControl,
  submitOutcomePersistenceForReview,
  validateOutcomePersistenceObservation,
  verifyOutcomePersistence,
} from "@/lib/api";
import type {
  PersistencePlanDetail,
  PersistenceValidationDecision,
  PersistenceVerificationDecision,
} from "@/types/outcome-persistence";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Plan = PersistencePlanDetail["plan"];
type Observation = PersistencePlanDetail["observations"][number];
type Control = PersistencePlanDetail["controls"][number];
type Verification = PersistencePlanDetail["verifications"][number];
type PersistUser = PersistencePlanDetail["users"][number];
type ObservationField = "date" | "points" | "evidence";
type ControlField = "title" | "owner";
type ReviewField = "points" | "note";

interface ObservationReview {
  observation: Observation;
  decision: PersistenceValidationDecision;
}

interface ControlRequest {
  kind: "COMPLETE" | "CANCEL";
  control: Control;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const VALIDATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const VERIFICATION_OPTIONS: { value: string; label: string; hint: string }[] = [
  {
    value: "SUSTAINED",
    label: "Sustained",
    hint: "The benefit is holding. The plan can then be closed.",
  },
  {
    value: "REMEDIATION_REQUIRED",
    label: "Remediation required",
    hint: "The benefit has decayed. The plan goes into remediation and can be observed again.",
  },
];

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

function isoOf(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isOpenControl(control: Control): boolean {
  return control.status === "PLANNED" || control.status === "IN_PROGRESS";
}

function PlanBadge({ status }: { status: string }) {
  if (status === "READY_FOR_REVIEW") {
    return <StatusBadge value="READY" label="Ready for review" />;
  }

  if (status === "SUSTAINED") {
    return <StatusBadge value="ACHIEVED" label="Sustained" />;
  }

  return <StatusBadge value={status} />;
}

function VerificationBadge({ decision }: { decision: string }) {
  if (decision === "SUSTAINED") {
    return <StatusBadge value="ACHIEVED" label="Sustained" />;
  }

  if (decision === "REMEDIATION_REQUIRED") {
    return <StatusBadge value="AT_RISK" label="Remediation required" />;
  }

  return <StatusBadge value={decision} />;
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

interface ObservationColumnOptions {
  canValidate: boolean;
  busy: boolean;
  onReview: (observation: Observation, decision: PersistenceValidationDecision) => void;
}

function buildObservationColumns(options: ObservationColumnOptions): Column<Observation>[] {
  return [
    {
      id: "observed",
      header: "Observed on",
      sortValue: (observation) => observation.observedOn,
      cell: (observation) => formatDate(observation.observedOn),
    },
    {
      id: "reported",
      header: "Reported",
      align: "right",
      sortValue: (observation) => observation.reportedContributionPoints,
      cell: (observation) => `${observation.reportedContributionPoints.toFixed(1)} pts`,
    },
    {
      id: "validated",
      header: "Validated",
      align: "right",
      sortValue: (observation) =>
        typeof observation.validatedContributionPoints === "number"
          ? observation.validatedContributionPoints
          : null,
      cell: (observation) =>
        typeof observation.validatedContributionPoints === "number" ? (
          `${observation.validatedContributionPoints.toFixed(1)} pts`
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "decision",
      header: "Decision",
      sortValue: (observation) => observation.validationDecision ?? "",
      cell: (observation) =>
        observation.validationDecision ? (
          <StatusBadge value={String(observation.validationDecision)} />
        ) : (
          <StatusBadge value="PENDING" label="Awaiting validation" />
        ),
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: (observation) => (
        <div className="kit-cell-stack">
          <span>{observation.evidenceNote}</span>

          <small>
            {observation.reportedByName}
            {" · "}
            {formatDateTime(observation.reportedAt)}
          </small>
        </div>
      ),
    },
    {
      id: "validation",
      header: "Validation note",
      cell: (observation) =>
        observation.validationNote ? (
          <div className="kit-cell-stack">
            <span>{observation.validationNote}</span>

            {observation.validatedByName ? <small>— {observation.validatedByName}</small> : null}
          </div>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 190,
      cell: (observation) =>
        options.canValidate && observation.validationDecision === null ? (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onReview(observation, "VALIDATED")}
            >
              <BadgeCheck size={14} />
              Validate
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onReview(observation, "REJECTED")}
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>
        ) : null,
    },
  ];
}

interface ControlColumnOptions {
  canManage: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (control: Control) => void;
  onComplete: (control: Control) => void;
  onCancel: (control: Control) => void;
}

function buildControlColumns(options: ControlColumnOptions): Column<Control>[] {
  return [
    {
      id: "control",
      header: "Control",
      sortValue: (control) => control.title.toLowerCase(),
      cell: (control) => (
        <div className="request-primary-cell">
          <strong>{control.title}</strong>

          {control.description ? <span>{control.description}</span> : null}
        </div>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (control) => (control.ownerName ?? "").toLowerCase(),
      cell: (control) => control.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (control) => control.dueDate,
      cell: (control) => (
        <div className="kit-cell-stack">
          <span>{formatDate(control.dueDate)}</span>

          {control.overdue && isOpenControl(control) ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (control) => String(control.status),
      cell: (control) => <StatusBadge value={String(control.status)} />,
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: (control) =>
        control.completionEvidence ? (
          <span>{control.completionEvidence}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 260,
      cell: (control) => {
        if (!options.canManage || !isOpenControl(control)) {
          return null;
        }

        const starting = options.workingId === String(control.id);

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {control.status === "PLANNED" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onStart(control)}
              >
                {starting ? "Starting…" : "Start"}
              </button>
            ) : null}

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onComplete(control)}
            >
              <BadgeCheck size={14} />
              Complete
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onCancel(control)}
            >
              <XCircle size={14} />
              Cancel
            </button>
          </div>
        );
      },
    },
  ];
}

function buildVerificationColumns(): Column<Verification>[] {
  return [
    {
      id: "decision",
      header: "Decision",
      sortValue: (verification) => String(verification.decision),
      cell: (verification) => <VerificationBadge decision={String(verification.decision)} />,
    },
    {
      id: "persistence",
      header: "Persistence",
      align: "right",
      sortValue: (verification) => verification.persistencePct,
      cell: (verification) => `${verification.persistencePct.toFixed(1)}%`,
    },
    {
      id: "decay",
      header: "Decay",
      align: "right",
      sortValue: (verification) => verification.decayPoints,
      cell: (verification) => `${verification.decayPoints.toFixed(1)} pts`,
    },
    {
      id: "note",
      header: "Verification note",
      cell: (verification) => <span>{verification.verificationNote}</span>,
    },
    {
      id: "verified",
      header: "Verified",
      sortValue: (verification) => verification.verifiedAt,
      cell: (verification) => (
        <div className="kit-cell-stack">
          <span>{formatDateTime(verification.verifiedAt)}</span>

          <small>{verification.verifiedByName}</small>
        </div>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Record observation modal                                            */
/* ------------------------------------------------------------------ */

interface RecordModalProps {
  planId: string;
  plan: Plan;
  onClose: () => void;
  onSaved: (updated: PersistencePlanDetail) => void;
}

function RecordModal({ planId, plan, onClose, onSaved }: RecordModalProps) {
  const [observedOn, setObservedOn] = useState(() => isoDate(0));
  const [points, setPoints] = useState(() => String(plan.baselineValidatedContributionPoints));
  const [evidence, setEvidence] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ObservationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const outsideWindow =
    observedOn !== "" &&
    (observedOn < plan.observationStartDate || observedOn > plan.observationEndDate);

  function clearError(field: ObservationField) {
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

    const next: Partial<Record<ObservationField, string>> = {};

    if (!observedOn) {
      next.date = "Choose the observation date.";
    } else if (observedOn > isoDate(0)) {
      next.date = "An observation cannot be dated in the future.";
    }

    const pointsProblem = numberError(points, { min: 0, max: 100 });

    if (pointsProblem) {
      next.points = pointsProblem;
    }

    if (!evidence.trim()) {
      next.evidence = "Describe the evidence for this observation.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await recordOutcomePersistenceObservation(planId, {
        observedOn,
        reportedContributionPoints: Number(points),
        evidenceNote: evidence.trim(),
      });

      onSaved(updated);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record persistence observation.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Persistence evidence"
      title="Record observation"
      description="Observations are immutable once recorded."
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
            form="persistence-observation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Recording…" : "Record observation"}
          </button>
        </>
      }
    >
      <form id="persistence-observation-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Observed on" htmlFor="observation-date" error={errors.date}>
            <input
              id="observation-date"
              className="kit-field-input"
              type="date"
              value={observedOn}
              aria-invalid={errors.date ? true : undefined}
              onChange={(event) => {
                setObservedOn(event.target.value);
                clearError("date");
              }}
            />
          </Field>

          <NumberField
            id="observation-points"
            label="Reported contribution (pts)"
            min={0}
            max={100}
            step="0.1"
            value={points}
            error={errors.points}
            onChange={(value) => {
              setPoints(value);
              clearError("points");
            }}
          />

          <div className="kit-pair-wide">
            <Field label="Evidence" htmlFor="observation-evidence" error={errors.evidence}>
              <textarea
                id="observation-evidence"
                className="kit-field-input"
                rows={5}
                value={evidence}
                aria-invalid={errors.evidence ? true : undefined}
                onChange={(event) => {
                  setEvidence(event.target.value);
                  clearError("evidence");
                }}
              />
            </Field>
          </div>
        </div>

        {outsideWindow ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This date is outside the observation window of {formatDate(plan.observationStartDate)}{" "}
            to {formatDate(plan.observationEndDate)}.
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
/* Validate / reject observation modal                                 */
/* ------------------------------------------------------------------ */

interface ReviewModalProps {
  review: ObservationReview;
  onClose: () => void;
  onSaved: (updated: PersistencePlanDetail, message: string) => void;
}

function ReviewModal({ review, onClose, onSaved }: ReviewModalProps) {
  const { observation, decision } = review;
  const validating = decision === "VALIDATED";

  const [points, setPoints] = useState(() => String(observation.reportedContributionPoints));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ReviewField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pointsValid =
    numberError(points, { min: 0, max: observation.reportedContributionPoints }) === undefined;
  const belowReported =
    validating && pointsValid && Number(points) < observation.reportedContributionPoints;

  function clearError(field: ReviewField) {
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

    const next: Partial<Record<ReviewField, string>> = {};

    if (validating) {
      const problem = numberError(points, {
        min: 0,
        max: observation.reportedContributionPoints,
      });

      if (problem) {
        next.points = problem;
      }
    }

    if (!note.trim()) {
      next.note = "Observation validation note is required.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await validateOutcomePersistenceObservation(observation.id, {
        decision,
        validatedContributionPoints: validating ? Number(points) : undefined,
        validationNote: note.trim(),
      });

      onSaved(updated, validating ? "Observation validated" : "Observation rejected");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to validate persistence observation.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Observation review"
      title={validating ? "Validate observation" : "Reject observation"}
      description={`Observed on ${formatDate(observation.observedOn)} — ${observation.reportedContributionPoints.toFixed(1)} pts reported.`}
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
            form="persistence-review-form"
            className={
              validating ? "button button--primary" : "button button--primary kit-button-danger"
            }
            disabled={saving}
          >
            {saving
              ? validating
                ? "Validating…"
                : "Rejecting…"
              : validating
                ? "Validate observation"
                : "Reject observation"}
          </button>
        </>
      }
    >
      <form id="persistence-review-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          {validating ? (
            <div className="kit-pair-wide">
              <NumberField
                id="review-points"
                label="Validated contribution (pts)"
                min={0}
                max={observation.reportedContributionPoints}
                step="0.1"
                value={points}
                error={errors.points}
                onChange={(value) => {
                  setPoints(value);
                  clearError("points");
                }}
              />
            </div>
          ) : null}

          <div className="kit-pair-wide">
            <Field label="Validation note" htmlFor="review-note" error={errors.note}>
              <textarea
                id="review-note"
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

        {belowReported ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The validated value is below what was reported.
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
/* Add sustainability control modal                                    */
/* ------------------------------------------------------------------ */

interface ControlModalProps {
  planId: string;
  plan: Plan;
  users: PersistUser[];
  onClose: () => void;
  onSaved: (updated: PersistencePlanDetail, title: string) => void;
}

function ControlModal({ planId, plan, users, onClose, onSaved }: ControlModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(plan.observationEndDate);
  const [errors, setErrors] = useState<Partial<Record<ControlField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dueInPast = dueDate !== "" && dueDate < isoDate(0);

  function clearError(field: ControlField) {
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

    const next: Partial<Record<ControlField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter a control title.";
    }

    if (!ownerId) {
      next.owner = "Choose an owner.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await createOutcomePersistenceControl(planId, {
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId: ownerId,
        dueDate,
      });

      onSaved(updated, title.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create sustainability control.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Value protection"
      title="Add sustainability control"
      description="A control that protects the benefit after implementation."
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
            form="persistence-control-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add control"}
          </button>
        </>
      }
    >
      <form id="persistence-control-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Control title" htmlFor="control-title" error={errors.title}>
              <input
                id="control-title"
                className="kit-field-input"
                maxLength={220}
                value={title}
                aria-invalid={errors.title ? true : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearError("title");
                }}
              />
            </Field>
          </div>

          <Field label="Owner" htmlFor="control-owner" error={errors.owner}>
            <select
              id="control-owner"
              className="kit-field-input"
              value={ownerId}
              aria-invalid={errors.owner ? true : undefined}
              onChange={(event) => {
                setOwnerId(event.target.value);
                clearError("owner");
              }}
            >
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName} — {candidate.role}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="control-due">
            <input
              id="control-due"
              className="kit-field-input"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Description" htmlFor="control-description">
              <textarea
                id="control-description"
                className="kit-field-input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {dueInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The due date is in the past, so this control will be flagged as overdue.
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
/* Persistence decision modal                                          */
/* ------------------------------------------------------------------ */

interface VerifyModalProps {
  planId: string;
  plan: Plan;
  onClose: () => void;
  onSaved: (updated: PersistencePlanDetail, message: string) => void;
}

function VerifyModal({ planId, plan, onClose, onSaved }: VerifyModalProps) {
  const [decision, setDecision] = useState<PersistenceVerificationDecision>("SUSTAINED");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choice =
    VERIFICATION_OPTIONS.find((item) => item.value === String(decision)) ?? VERIFICATION_OPTIONS[0];
  const remediation = String(decision) === "REMEDIATION_REQUIRED";
  const belowMinimum = plan.assessed && plan.persistencePct < plan.minimumPersistencePct;
  const contradicts = String(decision) === "SUSTAINED" && belowMinimum;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!note.trim()) {
      setNoteError("A verification note is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await verifyOutcomePersistence(planId, {
        decision,
        verificationNote: note.trim(),
      });

      onSaved(updated, remediation ? "Remediation required" : "Outcome sustained");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to verify persistent outcome.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Independent value verification"
      title="Persistence decision"
      description={`${plan.planNumber} — ${plan.persistencePct.toFixed(1)}% persistence against a minimum of ${plan.minimumPersistencePct.toFixed(1)}%.`}
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
            form="persistence-verify-form"
            className={
              remediation ? "button button--primary kit-button-danger" : "button button--primary"
            }
            disabled={saving}
          >
            {saving ? "Recording…" : "Record decision"}
          </button>
        </>
      }
    >
      <form id="persistence-verify-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Decision" htmlFor="verify-decision">
              <select
                id="verify-decision"
                className="kit-field-input"
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as PersistenceVerificationDecision)
                }
              >
                {VERIFICATION_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <p className="kit-meta-line">{choice.hint}</p>
          </div>

          <div className="kit-pair-wide">
            <Field label="Verification note" htmlFor="verify-note" error={noteError}>
              <textarea
                id="verify-note"
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

        {contradicts ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            Persistence is below the required minimum, so a sustained decision needs a clear
            justification in the note.
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

interface PlanData {
  id: string;
  detail: PersistencePlanDetail;
}

export default function OutcomePersistencePlanPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canValidate = user !== null && VALIDATE_ROLES.includes(user.role);

  const [result, setResult] = useState<PlanData | null>(null);
  const [recording, setRecording] = useState(false);
  const [reviewing, setReviewing] = useState<ObservationReview | null>(null);
  const [addingControl, setAddingControl] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [controlRequest, setControlRequest] = useState<ControlRequest | null>(null);
  const [controlRunning, setControlRunning] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitRunning, setSubmitRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeRunning, setCloseRunning] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getOutcomePersistencePlan(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load persistence plan.",
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

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);

    return () => window.clearTimeout(timer);
  }, [result]);

  const data = result !== null && result.id === params.id ? result : null;
  const detail = data?.detail ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function applyDetail(updated: PersistencePlanDetail) {
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
        <Link href="/outcome-persistence" className="request-back-link">
          <ArrowLeft size={16} />
          Outcome persistence
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

  const { plan, observations, controls, verifications, users } = detail;
  const status = plan.status;
  const observationMutable = status === "ACTIVE" || status === "IN_REMEDIATION";
  const busyAny = controlRunning || submitRunning || closeRunning || workingId !== null;

  async function startControl(control: Control) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(control.id));

    try {
      applyDetail(await startOutcomePersistenceControl(control.id));

      toast.success("Control started", control.title);
    } catch (caught) {
      toast.error(
        "Could not start the control",
        caught instanceof Error ? caught.message : "Unable to update sustainability control.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmControl(note: string) {
    if (controlRequest === null) {
      return;
    }

    const request = controlRequest;

    setControlRunning(true);
    setControlError(null);

    try {
      const updated =
        request.kind === "COMPLETE"
          ? await completeOutcomePersistenceControl(request.control.id, note)
          : await cancelOutcomePersistenceControl(request.control.id, note);

      applyDetail(updated);
      setControlRequest(null);

      toast.success(
        request.kind === "COMPLETE" ? "Control completed" : "Control cancelled",
        request.control.title,
      );
    } catch (caught) {
      setControlError(
        caught instanceof Error ? caught.message : "Unable to update sustainability control.",
      );
    } finally {
      setControlRunning(false);
    }
  }

  async function confirmSubmit() {
    setSubmitRunning(true);

    try {
      applyDetail(await submitOutcomePersistenceForReview(params.id));

      setSubmitOpen(false);

      toast.success("Submitted for review", plan.planNumber);
    } catch (caught) {
      setSubmitOpen(false);

      toast.error(
        "Could not submit the plan",
        caught instanceof Error
          ? caught.message
          : "Unable to submit persistence plan for review.",
      );
    } finally {
      setSubmitRunning(false);
    }
  }

  async function confirmClose(note: string) {
    setCloseRunning(true);
    setCloseError(null);

    try {
      applyDetail(await closeOutcomePersistencePlan(params.id, note));

      setClosing(false);

      toast.success("Persistence plan closed", plan.planNumber);
    } catch (caught) {
      setCloseError(
        caught instanceof Error ? caught.message : "Unable to close persistence plan.",
      );
    } finally {
      setCloseRunning(false);
    }
  }

  function handleRecorded(updated: PersistencePlanDetail) {
    applyDetail(updated);
    setRecording(false);
    toast.success("Observation recorded", plan.planNumber);
  }

  function handleReviewed(updated: PersistencePlanDetail, message: string) {
    applyDetail(updated);
    setReviewing(null);
    toast.success(message, plan.planNumber);
  }

  function handleControlAdded(updated: PersistencePlanDetail, title: string) {
    applyDetail(updated);
    setAddingControl(false);
    toast.success("Sustainability control added", title);
  }

  function handleVerified(updated: PersistencePlanDetail, message: string) {
    applyDetail(updated);
    setVerifying(false);
    toast.success(message, plan.planNumber);
  }

  const today = now !== null ? isoOf(now) : null;
  const windowEnded = today !== null && today >= plan.observationEndDate;
  const validatedAfterEnd = observations.some(
    (observation) =>
      observation.validationDecision === "VALIDATED" &&
      observation.observedOn >= plan.observationEndDate,
  );
  const openControls = controls.filter(isOpenControl);
  const overdueControls = openControls.filter((control) => control.overdue);
  const undecided = observations.filter((observation) => observation.validationDecision === null);

  const orderedObservations = [...observations].sort((a, b) => {
    const left = a.validationDecision === null ? 0 : 1;
    const right = b.validationDecision === null ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    return b.observedOn.localeCompare(a.observedOn);
  });

  const orderedControls = [...controls].sort((a, b) => {
    const left = isOpenControl(a) ? 0 : 1;
    const right = isOpenControl(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return a.dueDate.localeCompare(b.dueDate);
  });

  const orderedVerifications = [...verifications].sort((a, b) =>
    b.verifiedAt.localeCompare(a.verifiedAt),
  );

  const belowMinimum = plan.assessed && plan.persistencePct < plan.minimumPersistencePct;

  const kpis: KpiItem[] = [
    {
      label: "Step 53 baseline",
      icon: Goal,
      value: plan.baselineValidatedContributionPoints.toFixed(1),
      note: "Validated contribution points",
    },
    {
      label: "Current validated",
      icon: BadgeCheck,
      value: plan.assessed ? plan.currentValidatedContributionPoints.toFixed(1) : "—",
      note: plan.assessed ? "Latest validated observation" : "Not assessed yet",
    },
    {
      label: "Persistence",
      icon: Gauge,
      value: plan.assessed ? `${plan.persistencePct.toFixed(1)}%` : "—",
      note: readable(String(plan.persistenceHealth)),
      tone: belowMinimum ? "warning" : "default",
    },
    {
      label: "Benefit decay",
      icon: AlertTriangle,
      value: `${plan.decayPoints.toFixed(1)} pts`,
      note: "Lost since the baseline",
      tone: plan.decayPoints > 0 ? "warning" : "default",
    },
    {
      label: "Minimum required",
      icon: ShieldCheck,
      value: `${plan.minimumPersistencePct.toFixed(1)}%`,
      note: "Persistence threshold",
    },
    {
      label: "Verification eligible",
      icon: FileCheck2,
      value: plan.verificationEligible ? "Yes" : "No",
      note: plan.verificationEligible ? "Ready to submit" : "Requirements still open",
    },
  ];

  const observationColumns = buildObservationColumns({
    canValidate: canValidate && observationMutable,
    busy: busyAny,
    onReview: (observation, decision) => setReviewing({ observation, decision }),
  });

  const controlColumns = buildControlColumns({
    canManage: canManage && observationMutable,
    workingId,
    busy: busyAny,
    onStart: (control) => void startControl(control),
    onComplete: (control) => {
      setControlError(null);
      setControlRequest({ kind: "COMPLETE", control });
    },
    onCancel: (control) => {
      setControlError(null);
      setControlRequest({ kind: "CANCEL", control });
    },
  });

  const verificationColumns = buildVerificationColumns();

  const checks: { done: boolean; text: string }[] = [
    { done: windowEnded, text: `The observation window has ended (${formatDate(plan.observationEndDate)})` },
    { done: validatedAfterEnd, text: "A validated observation exists on or after the end date" },
    {
      done: openControls.length === 0,
      text:
        openControls.length === 0
          ? "Every sustainability control is resolved"
          : `${openControls.length} sustainability ${openControls.length === 1 ? "control is" : "controls are"} still open`,
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/outcome-persistence" className="request-back-link">
        <ArrowLeft size={16} />
        Outcome persistence
      </Link>

      <section className="persistence-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{plan.planNumber}</span>

            <PlanBadge status={String(status)} />
          </div>

          <span className="eyebrow">Post-implementation value observation</span>

          <h1>{plan.initiativeTitle}</h1>

          <p>
            {plan.commitmentNumber}
            {" · "}
            {plan.roadmapNumber}
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
            href={`/strategy-execution/${plan.commitmentId}`}
            className="button button--secondary"
          >
            Step 53 evidence
          </Link>

          {canManage && observationMutable ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record observation
            </button>
          ) : null}

          {canManage && observationMutable ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny || !plan.verificationEligible}
              title={
                plan.verificationEligible
                  ? undefined
                  : "The plan is not eligible for review yet"
              }
              onClick={() => setSubmitOpen(true)}
            >
              <FileCheck2 size={16} />
              Submit for review
            </button>
          ) : null}

          {canValidate && status === "READY_FOR_REVIEW" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => setVerifying(true)}
            >
              <ShieldCheck size={16} />
              Record decision
            </button>
          ) : null}

          {canValidate && status === "SUSTAINED" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => {
                setCloseError(null);
                setClosing(true);
              }}
            >
              Close plan
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

      {status === "IN_REMEDIATION" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This plan is in remediation.</strong> The benefit decayed. Complete the
            sustainability controls and record fresh observations.
          </div>
        </div>
      ) : null}

      {canManage && observationMutable && plan.observationDue ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>An observation is due.</strong> Record the current contribution with its
            evidence.
          </div>
        </div>
      ) : null}

      {belowMinimum && observationMutable ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Persistence is below the minimum.</strong> It is {plan.persistencePct.toFixed(1)}%
            against a required {plan.minimumPersistencePct.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {canValidate && observationMutable && undecided.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {undecided.length} {undecided.length === 1 ? "observation is" : "observations are"}{" "}
              waiting for validation.
            </strong>{" "}
            Use Validate or Reject in the observations table.
          </div>
        </div>
      ) : null}

      {overdueControls.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueControls.length}{" "}
              {overdueControls.length === 1 ? "sustainability control is" : "sustainability controls are"}{" "}
              overdue.
            </strong>{" "}
            Complete or cancel {overdueControls.length === 1 ? "it" : "them"} below.
          </div>
        </div>
      ) : null}

      {status === "READY_FOR_REVIEW" ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Awaiting the independent persistence decision.</strong>{" "}
            {canValidate
              ? "Use Record decision above."
              : "A procurement manager or administrator needs to record it."}
          </div>
        </div>
      ) : null}

      {status === "SUSTAINED" && canValidate ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>The outcome was verified as sustained.</strong> Close the plan to finish
            persistence governance.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Persistence summary" />

      {plan.assessed ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Persistence against threshold</span>

              <h2>Is the benefit holding?</h2>
            </div>

            <Gauge size={19} />
          </div>

          <ProgressLine
            pct={plan.persistencePct}
            tone={belowMinimum ? meterToneFor("danger") : meterToneFor("success")}
            caption={`Persistence ${plan.persistencePct.toFixed(1)}% against a minimum of ${plan.minimumPersistencePct.toFixed(1)}%`}
            label="Persistence against the required minimum"
          />

          {controls.length > 0 ? (
            <ProgressLine
              pct={((controls.length - openControls.length) / controls.length) * 100}
              tone={openControls.length === 0 ? meterToneFor("success") : "primary"}
              caption={`${controls.length - openControls.length} of ${controls.length} sustainability controls resolved`}
              label="Sustainability controls resolved"
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel persistence-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Persistence governance</span>

            <h2>Observation objective</h2>
          </div>

          <Goal size={19} />
        </div>

        <p>{plan.persistenceObjective}</p>

        <div className="persistence-context-grid">
          <div>
            <span>Persistence owner</span>

            <strong>{plan.persistenceOwnerName}</strong>
          </div>

          <div>
            <span>Execution owner</span>

            <strong>{plan.executionOwnerName}</strong>
          </div>

          <div>
            <span>Observation window</span>

            <strong>
              {formatDate(plan.observationStartDate)}
              {" → "}
              {formatDate(plan.observationEndDate)}
            </strong>
          </div>

          <div>
            <span>Observation due</span>

            <strong>{plan.observationDue ? "Yes" : "No"}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Post-implementation evidence</span>

            <h2>Observations</h2>
          </div>

          {canManage && observationMutable ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setRecording(true)}
            >
              <Plus size={15} />
              Record observation
            </button>
          ) : (
            <FileCheck2 size={19} />
          )}
        </div>

        <DataTable
          columns={observationColumns}
          rows={orderedObservations}
          getRowId={(observation) => String(observation.id)}
          ariaLabel="Persistence observations"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No observations"
              description="No persistence observation has been recorded."
              action={
                canManage && observationMutable ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setRecording(true)}
                  >
                    <Plus size={15} />
                    Record observation
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
            <span className="eyebrow">Benefit protection</span>

            <h2>Sustainability controls</h2>
          </div>

          {canManage && observationMutable ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingControl(true)}
            >
              <Plus size={15} />
              Add control
            </button>
          ) : (
            <ShieldCheck size={19} />
          )}
        </div>

        <DataTable
          columns={controlColumns}
          rows={orderedControls}
          getRowId={(control) => String(control.id)}
          ariaLabel="Sustainability controls"
          busy={fetching}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="No controls"
              description="No sustainability controls have been added."
              action={
                canManage && observationMutable ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingControl(true)}
                  >
                    <Plus size={15} />
                    Add control
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {canManage && observationMutable ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Persistence review gate</span>

              <h2>Readiness for independent review</h2>
            </div>

            <FileCheck2 size={19} />
          </div>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {checks.map((check) => (
              <li
                key={check.text}
                className={check.done ? undefined : "kit-text-muted"}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                {check.done ? <BadgeCheck size={16} /> : <XCircle size={16} />}
                {check.text}
              </li>
            ))}
          </ul>

          <p className="kit-meta-line" style={{ marginTop: 12 }}>
            {plan.verificationEligible
              ? "ProcureIQ confirms this plan is eligible. Use Submit for review above."
              : "Submit for review unlocks once ProcureIQ confirms the plan is eligible."}
          </p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Independent governance history</span>

            <h2>Persistence verifications</h2>
          </div>

          <BadgeCheck size={19} />
        </div>

        <DataTable
          columns={verificationColumns}
          rows={orderedVerifications}
          getRowId={(verification) => String(verification.id)}
          ariaLabel="Persistence verifications"
          busy={fetching}
          empty={
            <EmptyState
              icon={BadgeCheck}
              title="No verification yet"
              description="No independent persistence verification has been recorded."
            />
          }
        />
      </section>

      {plan.closeNote ? (
        <section className="persistence-closure-note">
          <strong>Persistence governance closed</strong>

          <p>{plan.closeNote}</p>

          <small>{plan.closedByName}</small>
        </section>
      ) : null}

      <section className="persistence-method-note">
        <Goal size={18} />

        <div>
          <strong>Remediation never rewrites the historical Step 53 outcome</strong>

          <p>
            A decayed benefit can enter sustainability remediation and be observed again. Every
            observation and verification remains immutable, preserving the difference between
            initial validated delivery and durable post-implementation value.
          </p>
        </div>
      </section>

      {recording ? (
        <RecordModal
          planId={params.id}
          plan={plan}
          onClose={() => setRecording(false)}
          onSaved={handleRecorded}
        />
      ) : null}

      {reviewing !== null ? (
        <ReviewModal
          review={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={handleReviewed}
        />
      ) : null}

      {addingControl ? (
        <ControlModal
          planId={params.id}
          plan={plan}
          users={users}
          onClose={() => setAddingControl(false)}
          onSaved={handleControlAdded}
        />
      ) : null}

      {verifying ? (
        <VerifyModal
          planId={params.id}
          plan={plan}
          onClose={() => setVerifying(false)}
          onSaved={handleVerified}
        />
      ) : null}

      {submitOpen ? (
        <ActionDialog
          eyebrow="Persistence review gate"
          title="Submit for independent review?"
          description={`${plan.planNumber} will be sent for an independent persistence decision. Observations and controls can no longer be changed while it is under review.`}
          confirmLabel="Submit for review"
          busyLabel="Submitting…"
          cancelLabel="Not yet"
          busy={submitRunning}
          onConfirm={() => void confirmSubmit()}
          onCancel={() => setSubmitOpen(false)}
        />
      ) : null}

      {controlRequest !== null ? (
        <RationaleDialog
          eyebrow="Sustainability control"
          title={
            controlRequest.kind === "COMPLETE" ? "Complete this control" : "Cancel this control"
          }
          description={
            controlRequest.kind === "COMPLETE"
              ? `Record the evidence that “${controlRequest.control.title}” is in place.`
              : `“${controlRequest.control.title}” will be cancelled and no longer protect the benefit.`
          }
          label={
            controlRequest.kind === "COMPLETE" ? "Completion evidence" : "Cancellation evidence"
          }
          placeholder={
            controlRequest.kind === "COMPLETE"
              ? "What is in place, and how can it be verified?"
              : "Why is this control being cancelled?"
          }
          confirmLabel={controlRequest.kind === "COMPLETE" ? "Complete control" : "Cancel control"}
          busyLabel={controlRequest.kind === "COMPLETE" ? "Completing…" : "Cancelling…"}
          cancelLabel={controlRequest.kind === "COMPLETE" ? "Cancel" : "Keep control"}
          tone={controlRequest.kind === "COMPLETE" ? "primary" : "danger"}
          maxLength={2000}
          busy={controlRunning}
          error={controlError}
          onConfirm={(note) => void confirmControl(note)}
          onCancel={() => setControlRequest(null)}
        />
      ) : null}

      {closing ? (
        <RationaleDialog
          eyebrow="Governance closure"
          title="Close persistence plan"
          description={`${plan.planNumber} was verified as sustained. Closing it finishes persistence governance.`}
          label="Closure note"
          placeholder="Summarise why this plan can be closed."
          confirmLabel="Close sustained plan"
          busyLabel="Closing…"
          maxLength={2000}
          busy={closeRunning}
          error={closeError}
          onConfirm={(note) => void confirmClose(note)}
          onCancel={() => setClosing(false)}
        />
      ) : null}
    </div>
  );
}
