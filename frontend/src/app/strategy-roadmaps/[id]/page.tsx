"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CircleAlert,
  Flag,
  Gauge,
  Goal,
  Info,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
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
  activateStrategyRoadmap,
  archiveStrategyRoadmap,
  cancelRoadmapInitiative,
  cancelRoadmapMilestone,
  captureStrategyRoadmapSnapshot,
  completeRoadmapInitiative,
  completeRoadmapMilestone,
  completeStrategyRoadmap,
  createRoadmapDependency,
  createRoadmapGate,
  createRoadmapInitiative,
  createRoadmapMilestone,
  decideRoadmapGate,
  deleteRoadmapDependency,
  getStrategyRoadmap,
  holdStrategyRoadmap,
  startRoadmapInitiative,
} from "@/lib/api";
import type { BoardDimensionKey } from "@/types/strategy-cockpit";
import type {
  RoadmapDependencyType,
  RoadmapGateStatus,
  RoadmapPriority,
  StrategyRoadmapDetail,
} from "@/types/strategy-roadmap";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Roadmap = StrategyRoadmapDetail["roadmap"];
type Initiative = StrategyRoadmapDetail["initiatives"][number];
type Dependency = StrategyRoadmapDetail["dependencies"][number];
type Milestone = StrategyRoadmapDetail["milestones"][number];
type Gate = StrategyRoadmapDetail["gates"][number];
type RoadmapSnapshot = StrategyRoadmapDetail["snapshots"][number];
type RoadmapUser = StrategyRoadmapDetail["users"][number];
type RoadmapAction = "ACTIVATE" | "HOLD" | "COMPLETE" | "ARCHIVE" | "SNAPSHOT";
type GateDecision = Exclude<RoadmapGateStatus, "PENDING">;
type CheckpointKind = "MILESTONE" | "GATE";
type InitiativeField = "title" | "owner" | "contribution" | "dates";
type DependencyField = "pair";
type CheckpointField = "initiative" | "name" | "due";

interface InitiativeRequest {
  kind: "COMPLETE" | "CANCEL";
  initiative: Initiative;
}

interface GateRequest {
  gate: Gate;
  decision: GateDecision;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const dimensionOptions: Array<{ key: BoardDimensionKey; label: string }> = [
  { key: "OBJECTIVE_EXECUTION", label: "Objective execution" },
  { key: "STRATEGIC_ALIGNMENT", label: "Strategic alignment" },
  { key: "CAPACITY_READINESS", label: "Capacity readiness" },
  { key: "CAPABILITY_READINESS", label: "Capability readiness" },
  { key: "SUCCESSION_RESILIENCE", label: "Succession resilience" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const DEPENDENCY_TYPES: { value: string; label: string }[] = [
  { value: "FINISH_TO_START", label: "Finish to start" },
  { value: "START_TO_START", label: "Start to start" },
  { value: "FINISH_TO_FINISH", label: "Finish to finish" },
];

function signed(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function showDate(value?: string | null): string {
  return value ? formatDate(value) : "—";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function healthPctTone(value: number) {
  return meterToneFor(value >= 80 ? "success" : value >= 50 ? "warning" : "danger");
}

function isLiveInitiative(initiative: Initiative): boolean {
  return initiative.status !== "COMPLETED" && initiative.status !== "CANCELLED";
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

const ACTIONS: Record<RoadmapAction, ActionCopy> = {
  ACTIVATE: {
    eyebrow: "Activate roadmap",
    title: "Activate this roadmap?",
    confirm: "Activate roadmap",
    busy: "Activating…",
    keep: "Not yet",
    done: "Roadmap activated",
    failed: "Could not activate the roadmap",
    tone: "primary",
  },
  HOLD: {
    eyebrow: "Put on hold",
    title: "Put this roadmap on hold?",
    confirm: "Put on hold",
    busy: "Updating…",
    keep: "Keep active",
    done: "Roadmap put on hold",
    failed: "Could not put the roadmap on hold",
    tone: "primary",
  },
  COMPLETE: {
    eyebrow: "Complete roadmap",
    title: "Complete this roadmap?",
    confirm: "Complete roadmap",
    busy: "Completing…",
    keep: "Not yet",
    done: "Roadmap completed",
    failed: "Could not complete the roadmap",
    tone: "primary",
  },
  ARCHIVE: {
    eyebrow: "Archive roadmap",
    title: "Archive this roadmap?",
    confirm: "Archive roadmap",
    busy: "Archiving…",
    keep: "Not yet",
    done: "Roadmap archived",
    failed: "Could not archive the roadmap",
    tone: "danger",
  },
  SNAPSHOT: {
    eyebrow: "Executive evidence",
    title: "Capture a roadmap snapshot?",
    confirm: "Capture snapshot",
    busy: "Capturing…",
    keep: "Not yet",
    done: "Snapshot captured",
    failed: "Could not capture the snapshot",
    tone: "primary",
  },
};

function actionDescription(action: RoadmapAction, roadmap: Roadmap): string {
  const name = `${roadmap.roadmapNumber} (${roadmap.title})`;

  switch (action) {
    case "ACTIVATE":
      return `${name} will become active, and initiatives can then be started.`;

    case "HOLD":
      return `${name} will be put on hold. You can activate it again later.`;

    case "COMPLETE":
      return `${name} will be marked as completed.`;

    case "ARCHIVE":
      return `${name} will be archived.`;

    case "SNAPSHOT":
      return `The current readiness of ${name} is recorded. A snapshot cannot be changed afterwards.`;
  }
}

function gateCopy(decision: GateDecision, gate: Gate) {
  const value = String(decision);

  if (value === "APPROVED") {
    return {
      title: "Approve this gate",
      description: `“${gate.gateName}” will be approved.`,
      confirm: "Approve gate",
      busy: "Approving…",
      tone: "primary" as const,
      done: "Gate approved",
    };
  }

  if (value === "WAIVED") {
    return {
      title: "Waive this gate",
      description: `“${gate.gateName}” will be waived and no longer block execution.`,
      confirm: "Waive gate",
      busy: "Waiving…",
      tone: "primary" as const,
      done: "Gate waived",
    };
  }

  return {
    title: "Reject this gate",
    description: `“${gate.gateName}” will be rejected. Rejected decision gates block execution.`,
    confirm: "Reject gate",
    busy: "Rejecting…",
    tone: "danger" as const,
    done: "Gate rejected",
  };
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface InitiativeColumnOptions {
  canManage: boolean;
  roadmapActive: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (initiative: Initiative) => void;
  onComplete: (initiative: Initiative) => void;
  onCancel: (initiative: Initiative) => void;
}

function buildInitiativeColumns(options: InitiativeColumnOptions): Column<Initiative>[] {
  return [
    {
      id: "initiative",
      header: "Initiative",
      sortValue: (initiative) => initiative.title.toLowerCase(),
      cell: (initiative) => (
        <div className="request-primary-cell">
          <strong>{initiative.title}</strong>

          <span>
            {initiative.initiativeNumber}
            {" · "}
            {showDate(initiative.plannedStartDate)}
            {" → "}
            {showDate(initiative.plannedEndDate)}
          </span>
        </div>
      ),
    },
    {
      id: "dimension",
      header: "Dimension",
      sortValue: (initiative) => initiative.dimensionKey,
      cell: (initiative) => readable(initiative.dimensionKey),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (initiative) => initiative.priority,
      cell: (initiative) => <StatusBadge value={initiative.priority} />,
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (initiative) => (initiative.ownerName ?? "").toLowerCase(),
      cell: (initiative) => initiative.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (initiative) => initiative.status,
      cell: (initiative) => (
        <div className="kit-cell-stack">
          <StatusBadge value={initiative.status} />

          {initiative.blocked ? <small className="kit-cell-flag">Blocked</small> : null}
        </div>
      ),
    },
    {
      id: "contribution",
      header: "Contribution",
      align: "right",
      sortValue: (initiative) => initiative.plannedContributionPoints,
      cell: (initiative) => `${initiative.plannedContributionPoints.toFixed(1)} pts`,
    },
    {
      id: "checks",
      header: "Checks",
      cell: (initiative) => (
        <div className="kit-cell-stack">
          <small className={initiative.blockedDependencyCount > 0 ? "kit-cell-flag" : undefined}>
            {initiative.blockedDependencyCount} blocking dependencies
          </small>

          <small className={initiative.overdueMilestoneCount > 0 ? "kit-cell-flag" : undefined}>
            {initiative.overdueMilestoneCount} overdue milestones
          </small>

          <small className={initiative.rejectedGateCount > 0 ? "kit-cell-flag" : undefined}>
            {initiative.pendingGateCount} pending · {initiative.rejectedGateCount} rejected gates
          </small>
        </div>
      ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 240,
      cell: (initiative) => {
        if (!options.canManage || !isLiveInitiative(initiative)) {
          return null;
        }

        const starting = options.workingId === String(initiative.id);

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {options.roadmapActive && initiative.status === "PLANNED" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onStart(initiative)}
              >
                {starting ? "Starting…" : "Start"}
              </button>
            ) : null}

            {initiative.status === "IN_PROGRESS" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onComplete(initiative)}
              >
                Complete
              </button>
            ) : null}

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onCancel(initiative)}
            >
              Cancel
            </button>
          </div>
        );
      },
    },
  ];
}

interface DependencyColumnOptions {
  canRemove: boolean;
  busy: boolean;
  onRemove: (dependency: Dependency) => void;
}

function buildDependencyColumns(options: DependencyColumnOptions): Column<Dependency>[] {
  return [
    {
      id: "sequence",
      header: "Sequence",
      sortValue: (dependency) => dependency.predecessorNumber,
      cell: (dependency) => (
        <strong>
          {dependency.predecessorNumber}
          {" → "}
          {dependency.successorNumber}
        </strong>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortValue: (dependency) => dependency.dependencyType,
      cell: (dependency) => readable(dependency.dependencyType),
    },
    {
      id: "state",
      header: "State",
      sortValue: (dependency) => (dependency.satisfied ? 1 : 0),
      cell: (dependency) => (
        <StatusBadge
          value={dependency.satisfied ? "ACHIEVED" : "BLOCKED"}
          label={dependency.satisfied ? "Satisfied" : "Blocking"}
        />
      ),
    },
    {
      id: "rationale",
      header: "Rationale",
      cell: (dependency) =>
        dependency.rationale ? (
          <span>{dependency.rationale}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "remove",
      header: <span className="kit-sr-only">Remove</span>,
      align: "right",
      width: 120,
      cell: (dependency) =>
        options.canRemove ? (
          <button
            type="button"
            className="kit-row-button"
            disabled={options.busy}
            onClick={() => options.onRemove(dependency)}
          >
            <Trash2 size={13} />
            Remove
          </button>
        ) : null,
    },
  ];
}

interface MilestoneColumnOptions {
  canManage: boolean;
  workingId: string | null;
  busy: boolean;
  onComplete: (milestone: Milestone) => void;
  onCancel: (milestone: Milestone) => void;
}

function buildMilestoneColumns(options: MilestoneColumnOptions): Column<Milestone>[] {
  return [
    {
      id: "milestone",
      header: "Milestone",
      sortValue: (milestone) => milestone.title.toLowerCase(),
      cell: (milestone) => <strong>{milestone.title}</strong>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (milestone) => milestone.dueDate,
      cell: (milestone) => (
        <div className="kit-cell-stack">
          <span>{showDate(milestone.dueDate)}</span>

          {milestone.overdue && milestone.status === "PLANNED" ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (milestone) => milestone.status,
      cell: (milestone) => <StatusBadge value={milestone.status} />,
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 190,
      cell: (milestone) => {
        if (!options.canManage || milestone.status !== "PLANNED") {
          return null;
        }

        const completing = options.workingId === String(milestone.id);

        return (
          <div style={{ display: "inline-flex", gap: 8 }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onComplete(milestone)}
            >
              {completing ? "Completing…" : "Complete"}
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onCancel(milestone)}
            >
              Cancel
            </button>
          </div>
        );
      },
    },
  ];
}

interface GateColumnOptions {
  canDecide: boolean;
  busy: boolean;
  onDecide: (gate: Gate, decision: GateDecision) => void;
}

function buildGateColumns(options: GateColumnOptions): Column<Gate>[] {
  return [
    {
      id: "gate",
      header: "Gate",
      sortValue: (gate) => gate.gateName.toLowerCase(),
      cell: (gate) => <strong>{gate.gateName}</strong>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (gate) => gate.dueDate,
      cell: (gate) => (
        <div className="kit-cell-stack">
          <span>{showDate(gate.dueDate)}</span>

          {gate.overdue && gate.status === "PENDING" ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (gate) => gate.status,
      cell: (gate) => <StatusBadge value={gate.status} />,
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 260,
      cell: (gate) => {
        if (!options.canDecide || gate.status !== "PENDING") {
          return null;
        }

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onDecide(gate, "APPROVED")}
            >
              Approve
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onDecide(gate, "WAIVED")}
            >
              Waive
            </button>

            <button
              type="button"
              className="kit-row-button"
              disabled={options.busy}
              onClick={() => options.onDecide(gate, "REJECTED")}
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];
}

function buildSnapshotColumns(): Column<RoadmapSnapshot>[] {
  return [
    {
      id: "snapshot",
      header: "Snapshot",
      sortValue: (item) => item.snapshotNumber,
      cell: (item) => <strong>{item.snapshotNumber}</strong>,
    },
    {
      id: "status",
      header: "Roadmap status",
      sortValue: (item) => item.roadmapStatus,
      cell: (item) => <StatusBadge value={item.roadmapStatus} />,
    },
    {
      id: "readiness",
      header: "Readiness",
      align: "right",
      sortValue: (item) => item.readinessScore,
      cell: (item) => item.readinessScore.toFixed(1),
    },
    {
      id: "health",
      header: "Health",
      sortValue: (item) => item.readinessHealth,
      cell: (item) => <StatusBadge value={item.readinessHealth} />,
    },
    {
      id: "initiatives",
      header: "Initiatives",
      align: "right",
      sortValue: (item) => item.initiativeCount,
      cell: (item) => item.initiativeCount,
    },
    {
      id: "blocked",
      header: "Blocked",
      align: "right",
      sortValue: (item) => item.blockedInitiativeCount,
      cell: (item) => item.blockedInitiativeCount,
    },
    {
      id: "overdue",
      header: "Overdue",
      align: "right",
      sortValue: (item) => item.overdueMilestoneCount,
      cell: (item) => item.overdueMilestoneCount,
    },
    {
      id: "captured",
      header: "Captured",
      sortValue: (item) => item.capturedAt,
      cell: (item) => formatDateTime(item.capturedAt),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link href={`/strategy-roadmaps/snapshots/${item.id}`} className="table-action">
          Open
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Add initiative modal                                                */
/* ------------------------------------------------------------------ */

interface InitiativeModalProps {
  roadmapId: string;
  roadmap: Roadmap;
  users: RoadmapUser[];
  onClose: () => void;
  onSaved: (updated: StrategyRoadmapDetail, title: string) => void;
}

function InitiativeModal({ roadmapId, roadmap, users, onClose, onSaved }: InitiativeModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dimensionKey, setDimensionKey] = useState<BoardDimensionKey>("OBJECTIVE_EXECUTION");
  const [priority, setPriority] = useState<RoadmapPriority>("HIGH");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [contribution, setContribution] = useState("5");
  const [start, setStart] = useState(roadmap.startDate);
  const [end, setEnd] = useState(roadmap.targetEndDate);
  const [errors, setErrors] = useState<Partial<Record<InitiativeField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const outsideWindow =
    (start !== "" && start < roadmap.startDate) || (end !== "" && end > roadmap.targetEndDate);

  function clearError(field: InitiativeField) {
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

    const next: Partial<Record<InitiativeField, string>> = {};

    if (!title.trim()) {
      next.title = "Enter an initiative title.";
    }

    if (!ownerId) {
      next.owner = "Choose an owner.";
    }

    const contributionProblem = numberError(contribution, { min: 0, max: 100 });

    if (contributionProblem) {
      next.contribution = contributionProblem;
    }

    if (!start || !end) {
      next.dates = "Choose a start and an end date.";
    } else if (end < start) {
      next.dates = "The end date cannot be before the start date.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await createRoadmapInitiative(roadmapId, {
        title: title.trim(),
        description: description.trim() || undefined,
        dimensionKey,
        priority,
        ownerUserId: ownerId,
        plannedStartDate: start,
        plannedEndDate: end,
        plannedContributionPoints: Number(contribution),
      });

      onSaved(updated, title.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add roadmap initiative.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Proposed execution"
      title="Add roadmap initiative"
      description={`The roadmap runs from ${showDate(roadmap.startDate)} to ${showDate(roadmap.targetEndDate)}.`}
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
            form="roadmap-initiative-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add initiative"}
          </button>
        </>
      }
    >
      <form id="roadmap-initiative-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Initiative title" htmlFor="rm-title" error={errors.title}>
              <input
                id="rm-title"
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

          <Field label="Board dimension" htmlFor="rm-dimension">
            <select
              id="rm-dimension"
              className="kit-field-input"
              value={dimensionKey}
              onChange={(event) => setDimensionKey(event.target.value as BoardDimensionKey)}
            >
              {dimensionOptions.map((dimension) => (
                <option key={dimension.key} value={dimension.key}>
                  {dimension.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" htmlFor="rm-priority">
            <select
              id="rm-priority"
              className="kit-field-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as RoadmapPriority)}
            >
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Owner" htmlFor="rm-owner" error={errors.owner}>
            <select
              id="rm-owner"
              className="kit-field-input"
              value={ownerId}
              aria-invalid={errors.owner ? true : undefined}
              onChange={(event) => {
                setOwnerId(event.target.value);
                clearError("owner");
              }}
            >
              {users.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.fullName} — {owner.role}
                </option>
              ))}
            </select>
          </Field>

          <NumberField
            id="rm-contribution"
            label="Planned contribution (pts)"
            min={0}
            max={100}
            step="0.1"
            value={contribution}
            error={errors.contribution}
            onChange={(value) => {
              setContribution(value);
              clearError("contribution");
            }}
          />

          <Field label="Start" htmlFor="rm-start" error={errors.dates}>
            <input
              id="rm-start"
              className="kit-field-input"
              type="date"
              value={start}
              aria-invalid={errors.dates ? true : undefined}
              onChange={(event) => {
                setStart(event.target.value);
                clearError("dates");
              }}
            />
          </Field>

          <Field label="End" htmlFor="rm-end">
            <input
              id="rm-end"
              className="kit-field-input"
              type="date"
              value={end}
              onChange={(event) => {
                setEnd(event.target.value);
                clearError("dates");
              }}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Description" htmlFor="rm-description">
              <textarea
                id="rm-description"
                className="kit-field-input"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </div>

        {outsideWindow ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            These dates fall outside the roadmap window.
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
/* Add dependency modal                                                */
/* ------------------------------------------------------------------ */

interface DependencyModalProps {
  roadmapId: string;
  initiatives: Initiative[];
  dependencies: Dependency[];
  onClose: () => void;
  onSaved: (updated: StrategyRoadmapDetail) => void;
}

function DependencyModal({
  roadmapId,
  initiatives,
  dependencies,
  onClose,
  onSaved,
}: DependencyModalProps) {
  const [predecessorId, setPredecessorId] = useState(initiatives[0]?.id ?? "");
  const [successorId, setSuccessorId] = useState(initiatives[1]?.id ?? "");
  const [type, setType] = useState<RoadmapDependencyType>("FINISH_TO_START");
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DependencyField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const predecessor = initiatives.find((item) => item.id === predecessorId);
    const successor = initiatives.find((item) => item.id === successorId);

    let problem: string | undefined;

    if (!predecessor || !successor) {
      problem = "Choose a predecessor and a successor.";
    } else if (predecessorId === successorId) {
      problem = "An initiative cannot depend on itself.";
    } else if (
      dependencies.some(
        (item) =>
          item.predecessorNumber === predecessor.initiativeNumber &&
          item.successorNumber === successor.initiativeNumber,
      )
    ) {
      problem = "This dependency already exists.";
    } else if (
      dependencies.some(
        (item) =>
          item.predecessorNumber === successor.initiativeNumber &&
          item.successorNumber === predecessor.initiativeNumber,
      )
    ) {
      problem = "The reverse dependency already exists, so this one would create a cycle.";
    }

    if (problem) {
      setErrors({ pair: problem });

      return;
    }

    setErrors({});
    setSaving(true);
    setError(null);

    try {
      const updated = await createRoadmapDependency(roadmapId, {
        predecessorInitiativeId: predecessorId,
        successorInitiativeId: successorId,
        dependencyType: type,
        rationale: rationale.trim() || undefined,
      });

      onSaved(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create roadmap dependency.");
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Dependency governance"
      title="Add sequencing dependency"
      description="Sequencing edges that would create a cycle are rejected."
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
            form="roadmap-dependency-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add dependency"}
          </button>
        </>
      }
    >
      <form id="roadmap-dependency-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Predecessor" htmlFor="dep-predecessor">
            <select
              id="dep-predecessor"
              className="kit-field-input"
              value={predecessorId}
              onChange={(event) => {
                setPredecessorId(event.target.value);
                setErrors({});
              }}
            >
              {initiatives.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.initiativeNumber} — {item.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Successor" htmlFor="dep-successor" error={errors.pair}>
            <select
              id="dep-successor"
              className="kit-field-input"
              value={successorId}
              aria-invalid={errors.pair ? true : undefined}
              onChange={(event) => {
                setSuccessorId(event.target.value);
                setErrors({});
              }}
            >
              {initiatives.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.initiativeNumber} — {item.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="kit-pair-wide">
            <Field label="Dependency type" htmlFor="dep-type">
              <select
                id="dep-type"
                className="kit-field-input"
                value={type}
                onChange={(event) => setType(event.target.value as RoadmapDependencyType)}
              >
                {DEPENDENCY_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Rationale" htmlFor="dep-rationale">
              <textarea
                id="dep-rationale"
                className="kit-field-input"
                rows={4}
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
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
/* Add milestone / gate modal                                          */
/* ------------------------------------------------------------------ */

interface CheckpointModalProps {
  kind: CheckpointKind;
  roadmap: Roadmap;
  initiatives: Initiative[];
  onClose: () => void;
  onSaved: (updated: StrategyRoadmapDetail, name: string, kind: CheckpointKind) => void;
}

function CheckpointModal({ kind, roadmap, initiatives, onClose, onSaved }: CheckpointModalProps) {
  const isMilestone = kind === "MILESTONE";

  const [initiativeId, setInitiativeId] = useState(initiatives[0]?.id ?? "");
  const [name, setName] = useState("");
  const [due, setDue] = useState(roadmap.targetEndDate);
  const [errors, setErrors] = useState<Partial<Record<CheckpointField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const afterEnd = due !== "" && due > roadmap.targetEndDate;

  function clearError(field: CheckpointField) {
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

    const next: Partial<Record<CheckpointField, string>> = {};

    if (!initiativeId) {
      next.initiative = "Choose an initiative.";
    }

    if (!name.trim()) {
      next.name = isMilestone ? "Enter a milestone title." : "Enter a gate name.";
    }

    if (!due) {
      next.due = "Choose a due date.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = isMilestone
        ? await createRoadmapMilestone(initiativeId, { title: name.trim(), dueDate: due })
        : await createRoadmapGate(initiativeId, { gateName: name.trim(), dueDate: due });

      onSaved(updated, name.trim(), kind);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : isMilestone
            ? "Unable to create roadmap milestone."
            : "Unable to create roadmap gate.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow={isMilestone ? "Delivery checkpoints" : "Decision governance"}
      title={isMilestone ? "Add milestone" : "Add decision gate"}
      description={
        isMilestone
          ? "A dated delivery checkpoint for an initiative."
          : "A decision an initiative must pass. Rejected gates block execution."
      }
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
            form="roadmap-checkpoint-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : isMilestone ? "Add milestone" : "Add gate"}
          </button>
        </>
      }
    >
      <form id="roadmap-checkpoint-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Initiative" htmlFor="cp-initiative" error={errors.initiative}>
              <select
                id="cp-initiative"
                className="kit-field-input"
                value={initiativeId}
                aria-invalid={errors.initiative ? true : undefined}
                onChange={(event) => {
                  setInitiativeId(event.target.value);
                  clearError("initiative");
                }}
              >
                {initiatives.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.initiativeNumber} — {item.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label={isMilestone ? "Milestone" : "Gate name"} htmlFor="cp-name" error={errors.name}>
              <input
                id="cp-name"
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

          <div className="kit-pair-wide">
            <Field label="Due date" htmlFor="cp-due" error={errors.due}>
              <input
                id="cp-due"
                className="kit-field-input"
                type="date"
                value={due}
                aria-invalid={errors.due ? true : undefined}
                onChange={(event) => {
                  setDue(event.target.value);
                  clearError("due");
                }}
              />
            </Field>
          </div>
        </div>

        {afterEnd ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            This date is after the roadmap target end of {showDate(roadmap.targetEndDate)}.
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

interface RoadmapData {
  id: string;
  detail: StrategyRoadmapDetail;
}

export default function StrategyRoadmapPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<RoadmapData | null>(null);
  const [pendingAction, setPendingAction] = useState<RoadmapAction | null>(null);
  const [pendingRunning, setPendingRunning] = useState(false);
  const [addingInitiative, setAddingInitiative] = useState(false);
  const [addingDependency, setAddingDependency] = useState(false);
  const [checkpoint, setCheckpoint] = useState<CheckpointKind | null>(null);
  const [initiativeRequest, setInitiativeRequest] = useState<InitiativeRequest | null>(null);
  const [initiativeRunning, setInitiativeRunning] = useState(false);
  const [removing, setRemoving] = useState<Dependency | null>(null);
  const [removeRunning, setRemoveRunning] = useState(false);
  const [cancellingMilestone, setCancellingMilestone] = useState<Milestone | null>(null);
  const [cancelMilestoneRunning, setCancelMilestoneRunning] = useState(false);
  const [gateRequest, setGateRequest] = useState<GateRequest | null>(null);
  const [gateRunning, setGateRunning] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
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
        const response = await getStrategyRoadmap(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load strategy roadmap.");
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

  function applyDetail(updated: StrategyRoadmapDetail) {
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
        <Link href="/strategy-roadmaps" className="request-back-link">
          <ArrowLeft size={16} />
          Strategy roadmaps
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

  const { roadmap, users, initiatives, dependencies, milestones, gates, snapshots } = detail;

  const status = roadmap.status;
  const mutable = status !== "COMPLETED" && status !== "ARCHIVED";
  const roadmapActive = status === "ACTIVE";
  const busyAny =
    pendingRunning ||
    initiativeRunning ||
    removeRunning ||
    cancelMilestoneRunning ||
    gateRunning ||
    workingId !== null;

  const liveInitiatives = initiatives.filter(isLiveInitiative);
  const pendingGates = gates.filter((gate) => gate.status === "PENDING");
  const overdueMilestones = milestones.filter(
    (milestone) => milestone.overdue && milestone.status === "PLANNED",
  );
  const rejectedGates = gates.filter((gate) => gate.status === "REJECTED");

  async function confirmAction() {
    if (pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setPendingRunning(true);

    try {
      if (action === "ACTIVATE") {
        applyDetail(await activateStrategyRoadmap(params.id));
      } else if (action === "HOLD") {
        applyDetail(await holdStrategyRoadmap(params.id));
      } else if (action === "COMPLETE") {
        applyDetail(await completeStrategyRoadmap(params.id));
      } else if (action === "ARCHIVE") {
        applyDetail(await archiveStrategyRoadmap(params.id));
      } else {
        await captureStrategyRoadmapSnapshot(params.id);
        reload();
      }

      setPendingAction(null);

      toast.success(ACTIONS[action].done, roadmap.roadmapNumber);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update roadmap status.",
      );
    } finally {
      setPendingRunning(false);
    }
  }

  async function startInitiative(initiative: Initiative) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(initiative.id));

    try {
      applyDetail(await startRoadmapInitiative(initiative.id));

      toast.success("Initiative started", initiative.title);
    } catch (caught) {
      toast.error(
        "Could not start the initiative",
        caught instanceof Error ? caught.message : "Unable to update roadmap initiative.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmInitiative() {
    if (initiativeRequest === null) {
      return;
    }

    const request = initiativeRequest;

    setInitiativeRunning(true);

    try {
      if (request.kind === "COMPLETE") {
        applyDetail(await completeRoadmapInitiative(request.initiative.id));
      } else {
        applyDetail(await cancelRoadmapInitiative(request.initiative.id));
      }

      setInitiativeRequest(null);

      toast.success(
        request.kind === "COMPLETE" ? "Initiative completed" : "Initiative cancelled",
        request.initiative.title,
      );
    } catch (caught) {
      setInitiativeRequest(null);

      toast.error(
        request.kind === "COMPLETE"
          ? "Could not complete the initiative"
          : "Could not cancel the initiative",
        caught instanceof Error ? caught.message : "Unable to update roadmap initiative.",
      );
    } finally {
      setInitiativeRunning(false);
    }
  }

  async function confirmRemove() {
    if (removing === null) {
      return;
    }

    const dependency = removing;

    setRemoveRunning(true);

    try {
      await deleteRoadmapDependency(dependency.id);

      setRemoving(null);

      toast.success(
        "Dependency removed",
        `${dependency.predecessorNumber} → ${dependency.successorNumber}`,
      );
      reload();
    } catch (caught) {
      setRemoving(null);

      toast.error(
        "Could not remove the dependency",
        caught instanceof Error ? caught.message : "Unable to remove roadmap dependency.",
      );
    } finally {
      setRemoveRunning(false);
    }
  }

  async function completeMilestone(milestone: Milestone) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(milestone.id));

    try {
      applyDetail(await completeRoadmapMilestone(milestone.id));

      toast.success("Milestone completed", milestone.title);
    } catch (caught) {
      toast.error(
        "Could not complete the milestone",
        caught instanceof Error ? caught.message : "Unable to update roadmap milestone.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmCancelMilestone() {
    if (cancellingMilestone === null) {
      return;
    }

    const milestone = cancellingMilestone;

    setCancelMilestoneRunning(true);

    try {
      applyDetail(await cancelRoadmapMilestone(milestone.id));

      setCancellingMilestone(null);

      toast.success("Milestone cancelled", milestone.title);
    } catch (caught) {
      setCancellingMilestone(null);

      toast.error(
        "Could not cancel the milestone",
        caught instanceof Error ? caught.message : "Unable to update roadmap milestone.",
      );
    } finally {
      setCancelMilestoneRunning(false);
    }
  }

  async function confirmGate(note: string) {
    if (gateRequest === null) {
      return;
    }

    const request = gateRequest;

    setGateRunning(true);
    setGateError(null);

    try {
      applyDetail(await decideRoadmapGate(request.gate.id, request.decision, note));

      setGateRequest(null);

      toast.success(gateCopy(request.decision, request.gate).done, request.gate.gateName);
    } catch (caught) {
      setGateError(caught instanceof Error ? caught.message : "Unable to decide roadmap gate.");
    } finally {
      setGateRunning(false);
    }
  }

  function handleInitiativeAdded(updated: StrategyRoadmapDetail, title: string) {
    applyDetail(updated);
    setAddingInitiative(false);
    toast.success("Initiative added", title);
  }

  function handleDependencyAdded(updated: StrategyRoadmapDetail) {
    applyDetail(updated);
    setAddingDependency(false);
    toast.success("Dependency added", roadmap.roadmapNumber);
  }

  function handleCheckpointAdded(
    updated: StrategyRoadmapDetail,
    name: string,
    kind: CheckpointKind,
  ) {
    applyDetail(updated);
    setCheckpoint(null);
    toast.success(kind === "MILESTONE" ? "Milestone added" : "Gate added", name);
  }

  const canEditPlan = canManage && mutable;
  const canAddCheckpoints = canEditPlan && initiatives.length > 0;
  const canAddDependency = canEditPlan && initiatives.length >= 2;

  const kpis: KpiItem[] = [
    {
      label: "Readiness score",
      icon: Gauge,
      value: roadmap.readinessScore.toFixed(1),
      note: readable(roadmap.readinessHealth),
    },
    {
      label: "Dependency health",
      icon: Network,
      value: `${roadmap.dependencyHealthPct.toFixed(1)}%`,
      note: "Satisfied sequencing",
    },
    {
      label: "Milestone health",
      icon: Flag,
      value: `${roadmap.milestoneHealthPct.toFixed(1)}%`,
      note: "On-time delivery checkpoints",
    },
    {
      label: "Gate health",
      icon: ShieldCheck,
      value: `${roadmap.gateHealthPct.toFixed(1)}%`,
      note: "Decision gates passed",
    },
    {
      label: "Blocked initiatives",
      icon: AlertTriangle,
      value: String(roadmap.blockedInitiativeCount),
      note: "Cannot progress",
      tone: roadmap.blockedInitiativeCount > 0 ? "warning" : "default",
    },
    {
      label: "Scenario uplift",
      icon: Target,
      value: signed(roadmap.scenarioDelta),
      note: "Against the source scenario",
      tone: roadmap.scenarioDelta < 0 ? "warning" : "default",
    },
  ];

  const initiativeColumns = buildInitiativeColumns({
    canManage,
    roadmapActive,
    workingId,
    busy: busyAny,
    onStart: (initiative) => void startInitiative(initiative),
    onComplete: (initiative) => setInitiativeRequest({ kind: "COMPLETE", initiative }),
    onCancel: (initiative) => setInitiativeRequest({ kind: "CANCEL", initiative }),
  });

  const dependencyColumns = buildDependencyColumns({
    canRemove: canEditPlan,
    busy: busyAny,
    onRemove: (dependency) => setRemoving(dependency),
  });

  const milestoneColumns = buildMilestoneColumns({
    canManage,
    workingId,
    busy: busyAny,
    onComplete: (milestone) => void completeMilestone(milestone),
    onCancel: (milestone) => setCancellingMilestone(milestone),
  });

  const gateColumns = buildGateColumns({
    canDecide: canFinalize,
    busy: busyAny,
    onDecide: (gate, decision) => {
      setGateError(null);
      setGateRequest({ gate, decision });
    },
  });

  const snapshotColumns = buildSnapshotColumns();
  const gateInfo = gateRequest !== null ? gateCopy(gateRequest.decision, gateRequest.gate) : null;

  const completeOpenInitiatives =
    pendingAction === "COMPLETE" ? liveInitiatives.length : 0;
  const completePendingGates = pendingAction === "COMPLETE" ? pendingGates.length : 0;

  const requestPendingGates =
    initiativeRequest !== null && initiativeRequest.kind === "COMPLETE"
      ? initiativeRequest.initiative.pendingGateCount
      : 0;
  const requestOverdueMilestones =
    initiativeRequest !== null && initiativeRequest.kind === "COMPLETE"
      ? initiativeRequest.initiative.overdueMilestoneCount
      : 0;

  return (
    <div className="page-stack">
      <Link href="/strategy-roadmaps" className="request-back-link">
        <ArrowLeft size={16} />
        Strategy roadmaps
      </Link>

      <section className="roadmap-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{roadmap.roadmapNumber}</span>

            <StatusBadge value={status} />

            <StatusBadge value={roadmap.readinessHealth} />
          </div>

          <span className="eyebrow">Governed strategy implementation</span>

          <h1>{roadmap.title}</h1>

          <p>
            {roadmap.sourceScenarioNumber}
            {" · FY "}
            {roadmap.fiscalYear}
          </p>
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="button button--secondary"
          onClick={reload}
          disabled={fetching}
        >
          <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
          Refresh
        </button>

        {canManage ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busyAny}
            onClick={() => setPendingAction("SNAPSHOT")}
          >
            <Camera size={15} />
            Capture snapshot
          </button>
        ) : null}

        {canFinalize && status !== "ARCHIVED" ? (
          <button
            type="button"
            className="button button--secondary request-cancel-button"
            disabled={busyAny}
            onClick={() => setPendingAction("ARCHIVE")}
          >
            Archive
          </button>
        ) : null}

        {canManage && roadmapActive ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busyAny}
            onClick={() => setPendingAction("HOLD")}
          >
            Put on hold
          </button>
        ) : null}

        {canManage && (status === "DRAFT" || status === "ON_HOLD") ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busyAny}
            onClick={() => setPendingAction("ACTIVATE")}
          >
            {status === "ON_HOLD" ? "Resume roadmap" : "Activate"}
          </button>
        ) : null}

        {canFinalize && (roadmapActive || status === "ON_HOLD") ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busyAny}
            onClick={() => setPendingAction("COMPLETE")}
          >
            Complete roadmap
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {status === "DRAFT" && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: plan the initiatives, then activate.</strong>{" "}
            {initiatives.length === 0
              ? "No initiatives have been added yet."
              : `${initiatives.length} ${initiatives.length === 1 ? "initiative is" : "initiatives are"} planned.`}{" "}
            Initiatives can only be started while the roadmap is active.
          </div>
        </div>
      ) : null}

      {status === "ON_HOLD" ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This roadmap is on hold.</strong> Resume it to start initiatives again.
          </div>
        </div>
      ) : null}

      {roadmap.blockedInitiativeCount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {roadmap.blockedInitiativeCount}{" "}
              {roadmap.blockedInitiativeCount === 1 ? "initiative is" : "initiatives are"} blocked.
            </strong>{" "}
            Check the unsatisfied dependencies and rejected gates in the initiative table.
          </div>
        </div>
      ) : null}

      {rejectedGates.length > 0 ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {rejectedGates.length} decision {rejectedGates.length === 1 ? "gate was" : "gates were"}{" "}
              rejected.
            </strong>{" "}
            Rejected gates block execution of their initiatives.
          </div>
        </div>
      ) : null}

      {overdueMilestones.length > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueMilestones.length}{" "}
              {overdueMilestones.length === 1 ? "milestone is" : "milestones are"} overdue.
            </strong>{" "}
            Complete or cancel {overdueMilestones.length === 1 ? "it" : "them"} below.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Roadmap readiness" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Readiness breakdown</span>

            <h2>Health of the plan</h2>
          </div>

          <Gauge size={19} />
        </div>

        <div className="kit-meter-wrap">
          <Meter
            value={clampPercent(roadmap.dependencyHealthPct)}
            max={100}
            tone={healthPctTone(roadmap.dependencyHealthPct)}
            ariaLabel="Dependency health"
          />

          <span className="kit-meter-caption">
            Dependencies {roadmap.dependencyHealthPct.toFixed(1)}%
          </span>
        </div>

        <div className="kit-meter-wrap">
          <Meter
            value={clampPercent(roadmap.milestoneHealthPct)}
            max={100}
            tone={healthPctTone(roadmap.milestoneHealthPct)}
            ariaLabel="Milestone health"
          />

          <span className="kit-meter-caption">
            Milestones {roadmap.milestoneHealthPct.toFixed(1)}%
          </span>
        </div>

        <div className="kit-meter-wrap">
          <Meter
            value={clampPercent(roadmap.gateHealthPct)}
            max={100}
            tone={healthPctTone(roadmap.gateHealthPct)}
            ariaLabel="Gate health"
          />

          <span className="kit-meter-caption">Gates {roadmap.gateHealthPct.toFixed(1)}%</span>
        </div>
      </section>

      <section className="panel roadmap-objective">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Implementation objective</span>

            <h2>Scenario commitment</h2>
          </div>

          <Goal size={19} />
        </div>

        <p>{roadmap.objective}</p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Initiative sequencing</span>

            <h2>Proposed roadmap initiatives</h2>
          </div>

          {canEditPlan ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAddingInitiative(true)}
            >
              <Plus size={15} />
              Add initiative
            </button>
          ) : (
            <Flag size={19} />
          )}
        </div>

        <DataTable
          columns={initiativeColumns}
          rows={initiatives}
          getRowId={(initiative) => String(initiative.id)}
          ariaLabel="Roadmap initiatives"
          busy={fetching}
          empty={
            <EmptyState
              icon={Flag}
              title="No initiatives"
              description="No proposed roadmap initiatives exist yet."
              action={
                canEditPlan ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingInitiative(true)}
                  >
                    <Plus size={15} />
                    Add initiative
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {dependencies.length > 0 || canAddDependency ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Sequence</span>

              <h2>Dependencies</h2>
            </div>

            {canAddDependency ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setAddingDependency(true)}
              >
                <Plus size={15} />
                Add dependency
              </button>
            ) : (
              <Network size={19} />
            )}
          </div>

          <DataTable
            columns={dependencyColumns}
            rows={dependencies}
            getRowId={(dependency) => String(dependency.id)}
            ariaLabel="Roadmap dependencies"
            busy={fetching}
            empty={
              <EmptyState
                compact
                icon={Network}
                title="No dependencies"
                description="No sequencing dependencies have been defined."
              />
            }
          />
        </section>
      ) : null}

      <section className="roadmap-form-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Schedule evidence</span>

              <h2>Milestones</h2>
            </div>

            {canAddCheckpoints ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setCheckpoint("MILESTONE")}
              >
                <Plus size={15} />
                Add milestone
              </button>
            ) : (
              <Flag size={19} />
            )}
          </div>

          <DataTable
            columns={milestoneColumns}
            rows={milestones}
            getRowId={(milestone) => String(milestone.id)}
            ariaLabel="Roadmap milestones"
            busy={fetching}
            empty={
              <EmptyState
                compact
                icon={Flag}
                title="No milestones"
                description="No delivery milestones have been added."
              />
            }
          />
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Decision evidence</span>

              <h2>Gates</h2>
            </div>

            {canAddCheckpoints ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setCheckpoint("GATE")}
              >
                <Plus size={15} />
                Add gate
              </button>
            ) : (
              <ShieldCheck size={19} />
            )}
          </div>

          <DataTable
            columns={gateColumns}
            rows={gates}
            getRowId={(gate) => String(gate.id)}
            ariaLabel="Roadmap decision gates"
            busy={fetching}
            empty={
              <EmptyState
                compact
                icon={ShieldCheck}
                title="No decision gates"
                description="No decision gates have been added."
              />
            }
          />
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Executive evidence</span>

            <h2>Immutable roadmap snapshots</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setPendingAction("SNAPSHOT")}
            >
              <Camera size={15} />
              Capture snapshot
            </button>
          ) : (
            <Camera size={19} />
          )}
        </div>

        <DataTable
          columns={snapshotColumns}
          rows={snapshots}
          getRowId={(item) => String(item.id)}
          ariaLabel="Roadmap snapshots"
          busy={fetching}
          empty={
            <EmptyState
              icon={Camera}
              title="No snapshots"
              description="No roadmap snapshots have been captured."
            />
          }
        />
      </section>

      <section className="roadmap-method-note">
        <Goal size={18} />

        <div>
          <strong>Dependencies are cycle-protected</strong>

          <p>
            ProcureIQ rejects sequencing edges that would create a dependency cycle. Starting an
            initiative also requires its incoming sequencing dependencies to be satisfied, while
            rejected decision gates block execution.
          </p>
        </div>
      </section>

      {addingInitiative ? (
        <InitiativeModal
          roadmapId={params.id}
          roadmap={roadmap}
          users={users}
          onClose={() => setAddingInitiative(false)}
          onSaved={handleInitiativeAdded}
        />
      ) : null}

      {addingDependency ? (
        <DependencyModal
          roadmapId={params.id}
          initiatives={initiatives}
          dependencies={dependencies}
          onClose={() => setAddingDependency(false)}
          onSaved={handleDependencyAdded}
        />
      ) : null}

      {checkpoint !== null ? (
        <CheckpointModal
          kind={checkpoint}
          roadmap={roadmap}
          initiatives={initiatives}
          onClose={() => setCheckpoint(null)}
          onSaved={handleCheckpointAdded}
        />
      ) : null}

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={ACTIONS[pendingAction].eyebrow}
          title={ACTIONS[pendingAction].title}
          description={actionDescription(pendingAction, roadmap)}
          confirmLabel={ACTIONS[pendingAction].confirm}
          busyLabel={ACTIONS[pendingAction].busy}
          cancelLabel={ACTIONS[pendingAction].keep}
          tone={ACTIONS[pendingAction].tone}
          busy={pendingRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        >
          {pendingAction === "ACTIVATE" && initiatives.length === 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              This roadmap has no initiatives yet.
            </p>
          ) : null}

          {completeOpenInitiatives > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {completeOpenInitiatives}{" "}
              {completeOpenInitiatives === 1 ? "initiative is" : "initiatives are"} not completed
              or cancelled yet.
            </p>
          ) : null}

          {completePendingGates > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {completePendingGates} decision {completePendingGates === 1 ? "gate is" : "gates are"}{" "}
              still pending.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {initiativeRequest !== null ? (
        <ActionDialog
          eyebrow="Roadmap initiative"
          title={
            initiativeRequest.kind === "COMPLETE"
              ? "Complete this initiative?"
              : "Cancel this initiative?"
          }
          description={
            initiativeRequest.kind === "COMPLETE"
              ? `“${initiativeRequest.initiative.title}” will be marked as completed.`
              : `“${initiativeRequest.initiative.title}” will be cancelled and removed from the plan.`
          }
          confirmLabel={
            initiativeRequest.kind === "COMPLETE" ? "Complete initiative" : "Cancel initiative"
          }
          busyLabel={initiativeRequest.kind === "COMPLETE" ? "Completing…" : "Cancelling…"}
          cancelLabel={initiativeRequest.kind === "COMPLETE" ? "Not yet" : "Keep initiative"}
          tone={initiativeRequest.kind === "COMPLETE" ? "primary" : "danger"}
          busy={initiativeRunning}
          onConfirm={() => void confirmInitiative()}
          onCancel={() => setInitiativeRequest(null)}
        >
          {requestPendingGates > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {requestPendingGates} decision {requestPendingGates === 1 ? "gate is" : "gates are"}{" "}
              still pending.
            </p>
          ) : null}

          {requestOverdueMilestones > 0 ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              {requestOverdueMilestones}{" "}
              {requestOverdueMilestones === 1 ? "milestone is" : "milestones are"} overdue.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}

      {removing !== null ? (
        <ActionDialog
          eyebrow="Dependency governance"
          title="Remove this dependency?"
          description={`The sequencing edge ${removing.predecessorNumber} → ${removing.successorNumber} will be removed.`}
          confirmLabel="Remove dependency"
          busyLabel="Removing…"
          cancelLabel="Keep dependency"
          tone="danger"
          busy={removeRunning}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoving(null)}
        />
      ) : null}

      {cancellingMilestone !== null ? (
        <ActionDialog
          eyebrow="Milestone"
          title="Cancel this milestone?"
          description={`“${cancellingMilestone.title}” will be cancelled.`}
          confirmLabel="Cancel milestone"
          busyLabel="Cancelling…"
          cancelLabel="Keep milestone"
          tone="danger"
          busy={cancelMilestoneRunning}
          onConfirm={() => void confirmCancelMilestone()}
          onCancel={() => setCancellingMilestone(null)}
        />
      ) : null}

      {gateRequest !== null && gateInfo !== null ? (
        <RationaleDialog
          eyebrow="Decision gate"
          title={gateInfo.title}
          description={gateInfo.description}
          label="Decision note"
          placeholder="What is the basis for this decision?"
          confirmLabel={gateInfo.confirm}
          busyLabel={gateInfo.busy}
          tone={gateInfo.tone}
          maxLength={2000}
          busy={gateRunning}
          error={gateError}
          onConfirm={(note) => void confirmGate(note)}
          onCancel={() => setGateRequest(null)}
        />
      ) : null}
    </div>
  );
}
