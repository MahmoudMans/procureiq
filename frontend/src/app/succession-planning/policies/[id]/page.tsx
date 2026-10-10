"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CircleAlert,
  Gauge,
  Info,
  Play,
  RefreshCw,
  ShieldAlert,
  Target,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
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
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  declineSuccessionCandidate,
  getSuccessionPlanningDashboard,
  getSuccessionPolicy,
  markSuccessionCandidateReady,
  nominateSuccessionCandidate,
  startSuccessionCandidateDevelopment,
} from "@/lib/api";
import type {
  SuccessionPlanningDashboard,
  SuccessionPolicyDetail,
} from "@/types/succession-planning";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Policy = SuccessionPolicyDetail["policy"];
type Candidate = SuccessionPolicyDetail["candidates"][number];
type WorkItem = SuccessionPolicyDetail["impactedWorkItems"][number];
type TeamUser = SuccessionPlanningDashboard["users"][number];
type NominateField = "member" | "date" | "rationale";
type RationaleRequest =
  | { kind: "READY"; candidateId: string }
  | { kind: "DECLINE"; candidateId: string };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const FINALIZE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function formatLocalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  return formatLocalDate(date);
}

/** Local calendar date as YYYY-MM-DD, offset by a number of months. */
function isoDateMonths(months: number): string {
  const date = new Date();

  date.setMonth(date.getMonth() + months);

  return formatLocalDate(date);
}

function isPending(candidate: Candidate): boolean {
  const status = String(candidate.status);

  return status === "IDENTIFIED" || status === "DEVELOPING";
}

function CandidateStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "READY":
      return <StatusBadge value="COMPLETED" label="Ready" />;

    case "DECLINED":
      return <StatusBadge value="REJECTED" label="Declined" />;

    case "DEVELOPING":
      return <StatusBadge value="IN_PROGRESS" label="Developing" />;

    default:
      return <StatusBadge value={status} label={readable(status)} />;
  }
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  if (readiness === "READY") {
    return <StatusBadge value="COMPLETED" label="Ready" />;
  }

  return <StatusBadge value={readiness} label={readable(readiness)} />;
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
  tone: "primary" | "danger";
  done: string;
  reference: string;
}

function rationaleCopy(
  request: RationaleRequest,
  policy: Policy,
  candidates: Candidate[],
): RationaleCopy {
  const candidate = candidates.find((item) => String(item.id) === request.candidateId) ?? null;
  const name = candidate ? String(candidate.userName) : "The candidate";

  switch (request.kind) {
    case "READY": {
      const below =
        candidate !== null &&
        typeof candidate.currentProficiency === "number" &&
        candidate.currentProficiency < Number(policy.requiredProficiency);

      return {
        eyebrow: "Succession governance",
        title: "Mark candidate ready",
        description: `${name} will be marked ready as a successor for ${policy.skillName}${
          candidate ? `, with an evidence score of ${candidate.evidenceScore.toFixed(1)}` : ""
        }. The decision is recorded for governance. It does not appoint anyone or change assignments.${
          below
            ? ` Their recorded proficiency is below the required L${policy.requiredProficiency}, so the note should explain why.`
            : ""
        }`,
        label: "Governed decision note",
        placeholder: "Why is this candidate ready to succeed?",
        confirm: "Mark ready",
        busy: "Recording…",
        tone: "primary",
        done: "Candidate marked ready",
        reference: name,
      };
    }

    case "DECLINE":
      return {
        eyebrow: "Succession governance",
        title: "Decline candidate",
        description: `${name} will be declined as a successor for ${policy.skillName}. The decision and note are recorded in the pipeline, and a declined candidate is not offered for nomination again.`,
        label: "Governed decision note",
        placeholder: "Why is this candidate declined?",
        confirm: "Decline candidate",
        busy: "Declining…",
        cancelLabel: "Keep candidate",
        tone: "danger",
        done: "Candidate declined",
        reference: name,
      };
  }
}

async function performRationale(request: RationaleRequest, note: string): Promise<void> {
  switch (request.kind) {
    case "READY":
      await markSuccessionCandidateReady(request.candidateId, note);
      return;

    case "DECLINE":
      await declineSuccessionCandidate(request.candidateId, note);
      return;
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface CandidateColumnOptions {
  requiredProficiency: number;
  canManage: boolean;
  canFinalize: boolean;
  busy: boolean;
  onDevelop: (candidate: Candidate) => void;
  onReady: (candidate: Candidate) => void;
  onDecline: (candidate: Candidate) => void;
}

function buildCandidateColumns(options: CandidateColumnOptions): Column<Candidate>[] {
  return [
    {
      id: "candidate",
      header: "Candidate",
      sortValue: (item) => String(item.userName).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.userName}</strong>

          <small>{readable(String(item.role))}</small>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.status),
      cell: (item) => <CandidateStatusBadge status={String(item.status)} />,
    },
    {
      id: "readiness",
      header: "Readiness",
      sortValue: (item) => String(item.readiness),
      cell: (item) => <ReadinessBadge readiness={String(item.readiness)} />,
    },
    {
      id: "score",
      header: "Evidence score",
      align: "right",
      sortValue: (item) => item.evidenceScore,
      cell: (item) => <strong>{item.evidenceScore.toFixed(1)}</strong>,
    },
    {
      id: "proficiency",
      header: "Proficiency",
      align: "right",
      sortValue: (item) =>
        typeof item.currentProficiency === "number" ? item.currentProficiency : null,
      cell: (item) =>
        typeof item.currentProficiency === "number" ? (
          <span
            className={
              item.currentProficiency < options.requiredProficiency
                ? "kit-text-warning"
                : undefined
            }
          >
            L{item.currentProficiency}
          </span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "fit",
      header: "Skill fit",
      align: "right",
      sortValue: (item) => item.proficiencyFitPct,
      cell: (item) => `${item.proficiencyFitPct.toFixed(1)}%`,
    },
    {
      id: "utilization",
      header: "Utilization",
      align: "right",
      sortValue: (item) => item.capacityUtilizationPct,
      cell: (item) => (
        <span className={item.capacityUtilizationPct > 100.005 ? "kit-text-warning" : undefined}>
          {item.capacityUtilizationPct.toFixed(1)}%
        </span>
      ),
    },
    {
      id: "development",
      header: "Open development",
      align: "right",
      sortValue: (item) => item.openDevelopmentActionCount,
      cell: (item) => item.openDevelopmentActionCount,
    },
    {
      id: "rationale",
      header: "Nomination rationale",
      cell: (item) => <span>{item.rationale}</span>,
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 300,
      cell: (item) => {
        const status = String(item.status);
        const pending = isPending(item);
        const showDevelop = options.canManage && status === "IDENTIFIED";
        const showDecide = options.canFinalize && pending;

        if (!showDevelop && !showDecide) {
          return null;
        }

        const readyNow = String(item.readiness) === "READY";

        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            {showDevelop ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onDevelop(item)}
              >
                <Play size={14} />
                Start development
              </button>
            ) : null}

            {showDecide ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy || !readyNow}
                title={
                  readyNow
                    ? undefined
                    : "Only a candidate whose readiness is Ready can be marked ready"
                }
                onClick={() => options.onReady(item)}
              >
                <BadgeCheck size={14} />
                Mark ready
              </button>
            ) : null}

            {showDecide ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onDecline(item)}
              >
                <XCircle size={14} />
                Decline
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

function buildWorkColumns(currency: string, fiscalYear: number): Column<WorkItem>[] {
  return [
    {
      id: "work",
      header: "Work item",
      sortValue: (item) => String(item.sourceTitle).toLowerCase(),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.sourceTitle}</strong>

          <small>{item.sourceReference}</small>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortValue: (item) => String(item.sourceType),
      cell: (item) => readable(String(item.sourceType)),
    },
    {
      id: "members",
      header: "Assigned members",
      align: "right",
      sortValue: (item) => item.assignedMemberCount,
      cell: (item) => item.assignedMemberCount,
    },
    {
      id: "requirements",
      header: "Requirements",
      align: "right",
      sortValue: (item) => item.requirementCount,
      cell: (item) => item.requirementCount,
    },
    {
      id: "fit",
      header: "Assigned fit",
      align: "right",
      sortValue: (item) => (item.requirementCount > 0 ? item.assignedFitPct : null),
      cell: (item) =>
        item.requirementCount > 0 ? (
          `${item.assignedFitPct.toFixed(1)}%`
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "readiness",
      header: "Readiness",
      sortValue: (item) => String(item.readiness),
      cell: (item) => (
        <StatusBadge value={String(item.readiness)} label={readable(String(item.readiness))} />
      ),
    },
    {
      id: "open",
      header: <span className="kit-sr-only">Open</span>,
      align: "right",
      width: 90,
      cell: (item) => (
        <Link
          href={`/capability-planning/work/${encodeURIComponent(String(item.sourceType))}/${encodeURIComponent(String(item.sourceEntityId))}?currency=${encodeURIComponent(currency)}&fiscalYear=${fiscalYear}`}
          className="table-action"
        >
          Open
        </Link>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Nominate candidate modal                                            */
/* ------------------------------------------------------------------ */

interface NominateModalProps {
  policyId: string;
  policy: Policy;
  users: TeamUser[];
  onClose: () => void;
  onSaved: (label: string) => Promise<void>;
}

function NominateModal({ policyId, policy, users, onClose, onSaved }: NominateModalProps) {
  const [userId, setUserId] = useState(() => users.at(0)?.id ?? "");
  const [targetDate, setTargetDate] = useState(() => isoDateMonths(6));
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<NominateField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: NominateField) {
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

    const next: Partial<Record<NominateField, string>> = {};

    if (!userId) {
      next.member = "Select a team member to nominate.";
    }

    if (targetDate && targetDate < isoDate(0)) {
      next.date = "The target readiness date cannot be in the past.";
    }

    if (!rationale.trim()) {
      next.rationale = "Explain why this person is a credible successor.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await nominateSuccessionCandidate(policyId, {
        userId,
        rationale: rationale.trim(),
        targetDate: targetDate || undefined,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to nominate succession candidate.",
      );
      setSaving(false);

      return;
    }

    const member = users.find((candidate) => candidate.id === userId);

    await onSaved(member ? member.fullName : "Team member");
  }

  return (
    <Modal
      eyebrow="Evidence-based nomination"
      title="Nominate candidate"
      description={`Nominate a successor for ${policy.skillName}. The evidence score is calculated from recorded assessments and capacity, and a nomination does not appoint anyone.`}
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
            form="succession-nomination-form"
            className="button button--primary"
            disabled={saving}
          >
            <UserPlus size={16} />
            {saving ? "Nominating…" : "Nominate candidate"}
          </button>
        </>
      }
    >
      <form id="succession-nomination-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Team member" htmlFor="succession-member" error={errors.member}>
              <select
                id="succession-member"
                className="kit-field-input"
                value={userId}
                aria-invalid={errors.member ? true : undefined}
                onChange={(event) => {
                  setUserId(event.target.value);
                  clearError("member");
                }}
              >
                <option value="">Select candidate</option>

                {users.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} — {candidate.role}
                  </option>
                ))}
              </select>
            </Field>

            <p className="kit-meta-line">
              Only team members who are not already in this pipeline are listed.
            </p>
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Target readiness date"
              htmlFor="succession-target-date"
              error={errors.date}
            >
              <input
                id="succession-target-date"
                className="kit-field-input"
                type="date"
                value={targetDate}
                aria-invalid={errors.date ? true : undefined}
                onChange={(event) => {
                  setTargetDate(event.target.value);
                  clearError("date");
                }}
              />
            </Field>

            <p className="kit-meta-line">Optional. It defaults to six months from today.</p>
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Nomination rationale"
              htmlFor="succession-rationale"
              error={errors.rationale}
            >
              <textarea
                id="succession-rationale"
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

interface PolicyData {
  id: string;
  detail: SuccessionPolicyDetail;
  dashboard: SuccessionPlanningDashboard;
}

export default function SuccessionPolicyPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canFinalize = user !== null && FINALIZE_ROLES.includes(user.role);

  const [result, setResult] = useState<PolicyData | null>(null);
  const [nominating, setNominating] = useState(false);
  const [developId, setDevelopId] = useState<string | null>(null);
  const [developRunning, setDevelopRunning] = useState(false);
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
        const policyResponse = await getSuccessionPolicy(id);
        const context = await getSuccessionPlanningDashboard(
          policyResponse.policy.currency,
          policyResponse.policy.fiscalYear,
        );

        if (active) {
          setResult({ id, detail: policyResponse, dashboard: context });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load succession policy.");
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

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getSuccessionPolicy(id);

      setResult((current) =>
        current && current.id === id ? { ...current, detail: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the policy.");
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
        <Link href="/succession-planning" className="request-back-link">
          <ArrowLeft size={16} />
          Succession planning
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

  const { detail, dashboard } = data;
  const { policy, candidates, impactedWorkItems } = detail;

  const availableUsers = dashboard.users.filter(
    (candidate) => !candidates.some((existing) => existing.userId === candidate.id),
  );
  const canAdd = canManage && availableUsers.length > 0;
  const addBlocked =
    availableUsers.length === 0 ? "Every team member is already in this pipeline" : undefined;
  const hasCandidates = candidates.length > 0;
  const pending = candidates.filter(isPending);
  const readyToMark = pending.filter((candidate) => String(candidate.readiness) === "READY");
  const developing = candidates.find((candidate) => String(candidate.id) === developId) ?? null;
  const busyAny = developRunning || rationaleRunning;

  const target = policy.targetReadyPeople;
  const ready = policy.readyPeopleCount;
  const gap = Math.max(0, target - ready);
  const spof = Boolean(policy.singlePointFailure);
  const readyPct = target > 0 ? (ready / target) * 100 : 100;

  const orderedCandidates = [...candidates].sort((a, b) => b.evidenceScore - a.evidenceScore);
  const orderedWork = [...impactedWorkItems].sort((a, b) => a.assignedFitPct - b.assignedFitPct);

  const rationaleInfo =
    rationale !== null ? rationaleCopy(rationale, policy, candidates) : null;

  async function confirmDevelop() {
    if (developing === null) {
      return;
    }

    const name = String(developing.userName);

    setDevelopRunning(true);

    try {
      await startSuccessionCandidateDevelopment(developing.id);

      await refresh();

      setDevelopId(null);

      toast.success("Development started", name);
    } catch (caught) {
      setDevelopId(null);

      toast.error(
        "Could not start development",
        caught instanceof Error ? caught.message : "Unable to update succession candidate.",
      );
    } finally {
      setDevelopRunning(false);
    }
  }

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, policy, candidates);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      await performRationale(request, note.trim());

      await refresh();

      setRationale(null);

      toast.success(copy.done, copy.reference);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to update succession candidate.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(request: RationaleRequest) {
    setRationaleError(null);
    setRationale(request);
  }

  async function handleNominated(label: string) {
    await refresh();

    setNominating(false);

    toast.success("Candidate nominated", label);
  }

  const kpis: KpiItem[] = [
    {
      label: "Target depth",
      icon: Target,
      value: String(target),
      note: "Ready people wanted",
    },
    {
      label: "Ready people",
      icon: UserCheck,
      value: String(ready),
      note: gap > 0 ? `${gap} short of the target` : "Target depth reached",
      tone: gap > 0 ? "warning" : "default",
    },
    {
      label: "Ready bench",
      icon: Users,
      value: String(policy.readyBenchCount),
      note: "Ready members on the bench",
    },
    {
      label: "Strategic work",
      icon: Briefcase,
      value: String(policy.strategicWorkCount),
      note: "Work items using this capability",
    },
    {
      label: "Coverage",
      icon: Gauge,
      value: `${policy.coveragePct.toFixed(1)}%`,
      note: "Policy coverage",
    },
    {
      label: "Single point of failure",
      icon: ShieldAlert,
      value: spof ? "Yes" : "No",
      note: spof ? "One person carries this capability" : "No single dependency",
      tone: spof ? "warning" : "default",
    },
  ];

  const candidateColumns = buildCandidateColumns({
    requiredProficiency: Number(policy.requiredProficiency),
    canManage,
    canFinalize,
    busy: busyAny,
    onDevelop: (candidate) => setDevelopId(String(candidate.id)),
    onReady: (candidate) => openRationale({ kind: "READY", candidateId: String(candidate.id) }),
    onDecline: (candidate) =>
      openRationale({ kind: "DECLINE", candidateId: String(candidate.id) }),
  });

  const workColumns = buildWorkColumns(String(policy.currency), Number(policy.fiscalYear));

  return (
    <div className="page-stack">
      <Link href="/succession-planning" className="request-back-link">
        <ArrowLeft size={16} />
        Succession planning
      </Link>

      <section className="succession-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{policy.skillCode}</span>

            <StatusBadge value={String(policy.health)} label={readable(String(policy.health))} />
          </div>

          <span className="eyebrow">Critical capability</span>

          <h1>{policy.skillName}</h1>

          <p>
            {policy.skillCategory}
            {" · Required L"}
            {policy.requiredProficiency}
            {" · FY "}
            {policy.fiscalYear}
            {" · "}
            {policy.currency}
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

          {canManage ? (
            <button
              type="button"
              className={`button ${hasCandidates ? "button--secondary" : "button--primary"}`}
              disabled={busyAny || !canAdd}
              title={addBlocked}
              onClick={() => setNominating(true)}
            >
              <UserPlus size={15} />
              Nominate candidate
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

      {spof ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This capability is a single point of failure.</strong> It has{" "}
            {plural(ready, "ready person", "ready people")} against a target depth of {target}.
            Building the pipeline below reduces the dependency.
          </div>
        </div>
      ) : null}

      {!spof && gap > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The ready depth is below the target.</strong>{" "}
            {plural(gap, "more ready person is", "more ready people are")} needed to reach {target}.{" "}
            {pending.length > 0
              ? `${plural(pending.length, "candidate is", "candidates are")} still in the pipeline.`
              : "No candidate is in the pipeline yet."}
          </div>
        </div>
      ) : null}

      {impactedWorkItems.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No active strategic work uses this capability yet.</strong> The policy is
            still tracked, but there is no dependency to protect until a work requirement links to
            it.
          </div>
        </div>
      ) : null}

      {!hasCandidates && canManage && canAdd ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Next step: nominate the first candidate.</strong> No governed succession
            candidate has been nominated for this capability.
          </div>
        </div>
      ) : null}

      {!hasCandidates && !canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No candidates have been nominated.</strong> A buyer or manager needs to
            nominate them.
          </div>
        </div>
      ) : null}

      {canFinalize && readyToMark.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(readyToMark.length, "candidate shows", "candidates show")} readiness Ready.
            </strong>{" "}
            Use Mark ready on the row to record the governed decision.
          </div>
        </div>
      ) : null}

      {!canFinalize && pending.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {plural(pending.length, "candidate is", "candidates are")} awaiting a decision.
            </strong>{" "}
            A procurement manager or administrator decides whether a candidate is ready or
            declined.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Succession policy summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Progress</span>

            <h2>Depth and coverage</h2>
          </div>

          <Gauge size={19} />
        </div>

        {target > 0 ? (
          <ProgressLine
            pct={readyPct}
            tone={ready >= target ? meterToneFor("success") : "primary"}
            caption={`${ready} of ${target} ready people against the target depth`}
            label="Ready people against the target depth"
          />
        ) : null}

        <ProgressLine
          pct={policy.coveragePct}
          tone={policy.coveragePct >= 100 ? meterToneFor("success") : "primary"}
          caption={`Policy coverage ${policy.coveragePct.toFixed(1)}%`}
          label="Policy coverage"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Dependency context</span>

            <h2>Strategic work using this capability</h2>
          </div>

          <ShieldAlert size={19} />
        </div>

        {impactedWorkItems.length > 0 ? (
          <p className="kit-meta-line">
            Weakest assigned fit first, across {plural(impactedWorkItems.length, "work item", "work items")}.
          </p>
        ) : null}

        <DataTable
          columns={workColumns}
          rows={orderedWork}
          getRowId={(work) => `${String(work.sourceType)}:${String(work.sourceEntityId)}`}
          ariaLabel="Strategic work using this capability"
          busy={fetching}
          empty={
            <EmptyState
              icon={ShieldAlert}
              title="No linked strategic work"
              description="This critical capability is not yet linked to an active strategic-work requirement."
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Succession pipeline</span>

            <h2>Governed candidates</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny || !canAdd}
              title={addBlocked}
              onClick={() => setNominating(true)}
            >
              <UserPlus size={15} />
              Nominate candidate
            </button>
          ) : (
            <UserPlus size={19} />
          )}
        </div>

        <DataTable
          columns={candidateColumns}
          rows={orderedCandidates}
          getRowId={(candidate) => String(candidate.id)}
          ariaLabel="Governed succession candidates"
          busy={fetching}
          empty={
            <EmptyState
              icon={UsersRound}
              title="No candidates"
              description="No governed succession candidates have been nominated."
              action={
                canAdd ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setNominating(true)}
                  >
                    <UserPlus size={15} />
                    Nominate candidate
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      <section className="succession-method-note">
        <UsersRound size={18} />

        <div>
          <strong>No automatic successor selection</strong>

          <p>
            Evidence score combines recorded Step 48 proficiency with current Step 47 capacity
            headroom only. It is advisory and never appoints a person or modifies assignments.
          </p>
        </div>
      </section>

      {nominating ? (
        <NominateModal
          policyId={params.id}
          policy={policy}
          users={availableUsers}
          onClose={() => setNominating(false)}
          onSaved={handleNominated}
        />
      ) : null}

      {developing !== null ? (
        <ActionDialog
          eyebrow="Succession pipeline"
          title="Start development?"
          description={`${developing.userName} moves into development for ${policy.skillName}. ${plural(developing.openDevelopmentActionCount, "development action is", "development actions are")} currently open. Once developing, a manager can mark the candidate ready or decline them.`}
          confirmLabel="Start development"
          busyLabel="Starting…"
          cancelLabel="Not yet"
          busy={developRunning}
          onConfirm={() => void confirmDevelop()}
          onCancel={() => setDevelopId(null)}
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
