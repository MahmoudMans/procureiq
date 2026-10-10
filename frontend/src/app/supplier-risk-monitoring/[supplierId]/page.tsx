"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  Info,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserRoundSearch,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
  SegmentedFilter,
  type SegmentedOption,
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  meterToneFor,
  readable,
  useToast,
} from "@/components/kit";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  acknowledgeSupplierRiskAlert,
  addSupplierToRiskWatchlist,
  cancelSupplierRiskEscalation,
  closeSupplierRiskEscalation,
  createSupplierRiskEscalation,
  getSupplierRiskContext,
  getSupplierRiskDetail,
  releaseSupplierFromRiskWatchlist,
  startSupplierRiskEscalation,
} from "@/lib/api";
import type {
  SupplierRiskContext,
  SupplierRiskDetail,
  SupplierRiskEscalation,
  SupplierRiskEscalationPriority,
} from "@/types/supplier-risk-monitoring";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RiskAlert = SupplierRiskDetail["alerts"][number];
type HistoryEntry = SupplierRiskDetail["history"][number];
type HistoryRow = HistoryEntry & { delta: number | null };
type RiskUser = SupplierRiskContext["users"][number];
type WatchlistAction = "ADD" | "RELEASE";
type FinishKind = "CLOSE" | "CANCEL";
type EscalationField = "dueDate" | "rationale";

interface FinishRequest {
  kind: FinishKind;
  escalation: SupplierRiskEscalation;
}

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const CLOSE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const EMPTY_USERS: RiskUser[] = [];
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const PRIORITIES: { value: SupplierRiskEscalationPriority; label: string }[] = [
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

function severityRank(value: string): number {
  return SEVERITY_ORDER[value] ?? 4;
}

function isLiveCase(escalation: SupplierRiskEscalation): boolean {
  return escalation.status === "OPEN" || escalation.status === "IN_PROGRESS";
}

function factorTone(score: number) {
  return meterToneFor(score >= 60 ? "danger" : score >= 40 ? "warning" : "success");
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function signedChange(value: number): string {
  const rounded = Math.round(value * 10) / 10;

  if (rounded === 0) {
    return "0.0";
  }

  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface WatchlistCopy {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  tone: "primary" | "danger";
  done: string;
}

function watchlistCopy(action: WatchlistAction, supplierName: string): WatchlistCopy {
  if (action === "ADD") {
    return {
      title: "Add to watchlist",
      description: `${supplierName} will be flagged on the supplier risk watchlist.`,
      label: "Watchlist rationale",
      placeholder: "Why should this supplier be watched?",
      confirm: "Add to watchlist",
      busy: "Adding…",
      tone: "primary",
      done: "Added to watchlist",
    };
  }

  return {
    title: "Release from watchlist",
    description: `${supplierName} will be removed from the supplier risk watchlist.`,
    label: "Release rationale",
    placeholder: "Why is this supplier no longer on watch?",
    confirm: "Release supplier",
    busy: "Releasing…",
    tone: "primary",
    done: "Released from watchlist",
  };
}

function finishCopy(request: FinishRequest) {
  if (request.kind === "CLOSE") {
    return {
      title: "Close this case",
      description: `${request.escalation.caseNumber} will be closed as resolved.`,
      label: "Resolution note",
      placeholder: "How was the risk resolved?",
      confirm: "Close case",
      busy: "Closing…",
      tone: "primary" as const,
      done: "Case closed",
    };
  }

  return {
    title: "Cancel this case",
    description: `${request.escalation.caseNumber} will be cancelled without a resolution.`,
    label: "Cancellation note",
    placeholder: "Why is this case being cancelled?",
    confirm: "Cancel case",
    busy: "Cancelling…",
    tone: "danger" as const,
    done: "Case cancelled",
  };
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

interface AlertColumnOptions {
  canManage: boolean;
  busy: boolean;
  onAcknowledge: (alert: RiskAlert) => void;
  onEscalate: (alert: RiskAlert) => void;
}

function buildAlertColumns(options: AlertColumnOptions): Column<RiskAlert>[] {
  return [
    {
      id: "alert",
      header: "Alert",
      sortValue: (alert) => alert.title.toLowerCase(),
      cell: (alert) => (
        <div className="request-primary-cell">
          <strong>{alert.title}</strong>

          <span>
            {readable(alert.alertType)}
            {" · "}
            {alert.details}
          </span>
        </div>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      sortValue: (alert) => severityRank(alert.severity),
      cell: (alert) => <StatusBadge value={alert.severity} />,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (alert) => alert.status,
      cell: (alert) => <StatusBadge value={alert.status} />,
    },
    {
      id: "acknowledgement",
      header: "Acknowledgement",
      sortValue: (alert) => (alert.acknowledgementNote ?? "").toLowerCase(),
      cell: (alert) =>
        alert.acknowledgementNote ? (
          <div className="kit-cell-stack">
            <span>{alert.acknowledgementNote}</span>

            {alert.acknowledgedByName ? <small>— {alert.acknowledgedByName}</small> : null}
          </div>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 230,
      cell: (alert) => {
        if (!options.canManage) {
          return null;
        }

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {alert.status === "OPEN" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onAcknowledge(alert)}
              >
                <BadgeCheck size={14} />
                Acknowledge
              </button>
            ) : null}

            {alert.status !== "RESOLVED" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onEscalate(alert)}
              >
                <AlertTriangle size={14} />
                Escalate
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

interface CaseColumnOptions {
  canManage: boolean;
  canClose: boolean;
  workingId: string | null;
  busy: boolean;
  onStart: (escalation: SupplierRiskEscalation) => void;
  onFinish: (kind: FinishKind, escalation: SupplierRiskEscalation) => void;
}

function buildCaseColumns(options: CaseColumnOptions): Column<SupplierRiskEscalation>[] {
  return [
    {
      id: "case",
      header: "Case",
      sortValue: (escalation) => escalation.caseNumber,
      cell: (escalation) => (
        <div className="request-primary-cell">
          <strong>{escalation.caseNumber}</strong>

          <span>{escalation.rationale}</span>
        </div>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (escalation) => severityRank(escalation.priority),
      cell: (escalation) => <StatusBadge value={escalation.priority} />,
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (escalation) => (escalation.ownerName ?? "").toLowerCase(),
      cell: (escalation) => escalation.ownerName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (escalation) => escalation.dueDate,
      cell: (escalation) => (
        <div className="kit-cell-stack">
          <span>{formatDate(escalation.dueDate)}</span>

          {escalation.overdue && isLiveCase(escalation) ? (
            <small className="kit-cell-flag">Overdue</small>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (escalation) => escalation.status,
      cell: (escalation) => <StatusBadge value={escalation.status} />,
    },
    {
      id: "resolution",
      header: "Resolution",
      sortValue: (escalation) => (escalation.resolutionNote ?? "").toLowerCase(),
      cell: (escalation) =>
        escalation.resolutionNote ? (
          <span>{escalation.resolutionNote}</span>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
    {
      id: "controls",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 260,
      cell: (escalation) => {
        if (!isLiveCase(escalation)) {
          return null;
        }

        const starting = options.workingId === String(escalation.id);

        return (
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {options.canManage && escalation.status === "OPEN" ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onStart(escalation)}
              >
                <Play size={14} />
                {starting ? "Starting…" : "Start case"}
              </button>
            ) : null}

            {options.canClose ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onFinish("CLOSE", escalation)}
              >
                <BadgeCheck size={14} />
                Close
              </button>
            ) : null}

            {options.canClose ? (
              <button
                type="button"
                className="kit-row-button"
                disabled={options.busy}
                onClick={() => options.onFinish("CANCEL", escalation)}
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

function buildHistoryColumns(): Column<HistoryRow>[] {
  return [
    {
      id: "evaluated",
      header: "Evaluated",
      sortValue: (item) => item.evaluatedAt,
      cell: (item) => formatDateTime(item.evaluatedAt),
    },
    {
      id: "score",
      header: "Score",
      align: "right",
      sortValue: (item) => item.overallScore,
      cell: (item) => <strong>{item.overallScore.toFixed(1)}</strong>,
    },
    {
      id: "change",
      header: "Change",
      align: "right",
      sortValue: (item) => item.delta,
      cell: (item) => {
        if (item.delta === null) {
          return <span className="kit-text-muted">—</span>;
        }

        const text = signedChange(item.delta);

        return text === "0.0" ? (
          <span className="kit-text-muted">{text}</span>
        ) : (
          <span className={item.delta > 0 ? "kit-text-danger" : undefined}>{text}</span>
        );
      },
    },
    {
      id: "band",
      header: "Risk band",
      sortValue: (item) => item.riskBand,
      cell: (item) => <StatusBadge value={item.riskBand} />,
    },
    {
      id: "recommendation",
      header: "Recommendation",
      sortValue: (item) => item.recommendation,
      cell: (item) => readable(item.recommendation),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Open escalation modal                                               */
/* ------------------------------------------------------------------ */

interface EscalationModalProps {
  supplierId: string;
  supplierName: string;
  alerts: RiskAlert[];
  users: RiskUser[];
  initialAlertId: string;
  onClose: () => void;
  onSaved: () => void;
}

function EscalationModal({
  supplierId,
  supplierName,
  alerts,
  users,
  initialAlertId,
  onClose,
  onSaved,
}: EscalationModalProps) {
  const [alertId, setAlertId] = useState(initialAlertId);
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [priority, setPriority] = useState<SupplierRiskEscalationPriority>("HIGH");
  const [dueDate, setDueDate] = useState(() => isoDate(14));
  const [rationale, setRationale] = useState("");
  const [errors, setErrors] = useState<Partial<Record<EscalationField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const linkable = alerts.filter((alert) => alert.status !== "RESOLVED");

  function clearError(field: EscalationField) {
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

    const next: Partial<Record<EscalationField, string>> = {};

    if (!rationale.trim()) {
      next.rationale = "Explain why this risk is being escalated.";
    }

    if (!dueDate) {
      next.dueDate = "Choose a due date.";
    } else if (dueDate < isoDate(0)) {
      next.dueDate = "The due date cannot be in the past.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createSupplierRiskEscalation(supplierId, {
        alertId: alertId || undefined,
        ownerUserId: ownerId || undefined,
        priority,
        dueDate,
        rationale: rationale.trim(),
      });

      onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to open supplier-risk escalation.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="New governance case"
      title="Open risk escalation"
      description={`A tracked escalation case for ${supplierName}.`}
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
            form="risk-escalation-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Opening…" : "Open escalation case"}
          </button>
        </>
      }
    >
      <form id="risk-escalation-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Related alert" htmlFor="escalation-alert">
              <select
                id="escalation-alert"
                className="kit-field-input"
                value={alertId}
                onChange={(event) => setAlertId(event.target.value)}
              >
                <option value="">No direct alert link</option>

                {linkable.map((alert) => (
                  <option key={alert.id} value={alert.id}>
                    {readable(alert.alertType)} — {alert.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Owner" htmlFor="escalation-owner">
            <select
              id="escalation-owner"
              className="kit-field-input"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName} — {candidate.role}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" htmlFor="escalation-priority">
            <select
              id="escalation-priority"
              className="kit-field-input"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as SupplierRiskEscalationPriority)
              }
            >
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="kit-pair-wide">
            <Field label="Due date" htmlFor="escalation-due" error={errors.dueDate}>
              <input
                id="escalation-due"
                className="kit-field-input"
                type="date"
                value={dueDate}
                aria-invalid={errors.dueDate ? true : undefined}
                onChange={(event) => {
                  setDueDate(event.target.value);
                  clearError("dueDate");
                }}
              />
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Escalation rationale"
              htmlFor="escalation-rationale"
              error={errors.rationale}
            >
              <textarea
                id="escalation-rationale"
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

interface RiskData {
  key: string;
  detail: SupplierRiskDetail;
  users: RiskUser[];
}

export default function SupplierRiskDetailPage() {
  const params = useParams<{ supplierId: string }>();
  const searchParams = useSearchParams();
  const currency = searchParams.get("currency") ?? "EUR";
  const supplierId = params.supplierId;
  const dataKey = `${supplierId}|${currency}`;

  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canClose = user !== null && CLOSE_ROLES.includes(user.role);

  const [result, setResult] = useState<RiskData | null>(null);
  const [watchlistAction, setWatchlistAction] = useState<WatchlistAction | null>(null);
  const [watchlistRunning, setWatchlistRunning] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<RiskAlert | null>(null);
  const [ackRunning, setAckRunning] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [escalateAlertId, setEscalateAlertId] = useState("");
  const [finishing, setFinishing] = useState<FinishRequest | null>(null);
  const [finishRunning, setFinishRunning] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [alertView, setAlertView] = useState("ALL");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const [detailResponse, contextResponse] = await Promise.all([
          getSupplierRiskDetail(supplierId, currency),
          getSupplierRiskContext(),
        ]);

        if (active) {
          setResult({
            key: `${supplierId}|${currency}`,
            detail: detailResponse,
            users: contextResponse.users.filter((candidate) => candidate.role !== "REQUESTER"),
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load supplier-risk detail.",
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
  }, [supplierId, currency, reloadKey]);

  const data = result !== null && result.key === dataKey ? result : null;
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
        <Link href="/supplier-risk-monitoring" className="request-back-link">
          <ArrowLeft size={16} />
          Supplier risk monitoring
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

  const { watchlist, alerts, escalationCases, history } = detail;
  const latest = detail.latestEvaluation;
  const supplierName = detail.supplierName;

  const busyAny = watchlistRunning || ackRunning || finishRunning || workingId !== null;

  async function confirmWatchlist(note: string) {
    if (watchlistAction === null) {
      return;
    }

    const action = watchlistAction;

    setWatchlistRunning(true);
    setWatchlistError(null);

    try {
      if (action === "ADD") {
        await addSupplierToRiskWatchlist(supplierId, note);
      } else {
        await releaseSupplierFromRiskWatchlist(supplierId, note);
      }

      setWatchlistAction(null);

      toast.success(watchlistCopy(action, supplierName).done, supplierName);
      reload();
    } catch (caught) {
      setWatchlistError(
        caught instanceof Error ? caught.message : "Unable to update supplier-risk watchlist.",
      );
    } finally {
      setWatchlistRunning(false);
    }
  }

  async function confirmAcknowledge(note: string) {
    if (acknowledging === null) {
      return;
    }

    const alert = acknowledging;

    setAckRunning(true);
    setAckError(null);

    try {
      await acknowledgeSupplierRiskAlert(alert.id, note);

      setAcknowledging(null);

      toast.success("Alert acknowledged", alert.title);
      reload();
    } catch (caught) {
      setAckError(
        caught instanceof Error ? caught.message : "Unable to acknowledge supplier-risk alert.",
      );
    } finally {
      setAckRunning(false);
    }
  }

  async function startCase(escalation: SupplierRiskEscalation) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(escalation.id));

    try {
      await startSupplierRiskEscalation(escalation.id);

      toast.success("Case started", escalation.caseNumber);
      reload();
    } catch (caught) {
      toast.error(
        "Could not start the case",
        caught instanceof Error ? caught.message : "Unable to start supplier-risk escalation.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmFinish(note: string) {
    if (finishing === null) {
      return;
    }

    const request = finishing;

    setFinishRunning(true);
    setFinishError(null);

    try {
      if (request.kind === "CLOSE") {
        await closeSupplierRiskEscalation(request.escalation.id, note);
      } else {
        await cancelSupplierRiskEscalation(request.escalation.id, note);
      }

      setFinishing(null);

      toast.success(finishCopy(request).done, request.escalation.caseNumber);
      reload();
    } catch (caught) {
      setFinishError(
        caught instanceof Error ? caught.message : "Unable to update supplier-risk escalation.",
      );
    } finally {
      setFinishRunning(false);
    }
  }

  function openEscalation(alertId: string) {
    setEscalateAlertId(alertId);
    setEscalating(true);
  }

  function handleEscalated() {
    setEscalating(false);
    toast.success("Escalation case opened", supplierName);
    reload();
  }

  const openAlerts = alerts.filter((alert) => alert.status === "OPEN");

  const sortedAlerts = [...alerts].sort((a, b) => {
    const left = a.status === "OPEN" ? 0 : 1;
    const right = b.status === "OPEN" ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    return severityRank(a.severity) - severityRank(b.severity);
  });

  const shownAlerts = alertView === "OPEN" ? sortedAlerts.filter((alert) => alert.status === "OPEN") : sortedAlerts;

  const alertOptions: SegmentedOption[] = [
    { value: "ALL", label: `All · ${alerts.length}` },
    { value: "OPEN", label: `Open · ${openAlerts.length}` },
  ];

  const liveCases = escalationCases.filter(isLiveCase);
  const overdueCases = liveCases.filter((escalation) => escalation.overdue);

  const orderedCases = [...escalationCases].sort((a, b) => {
    const left = isLiveCase(a) ? 0 : 1;
    const right = isLiveCase(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    return a.dueDate.localeCompare(b.dueDate);
  });

  const sortedHistory = [...history].sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));

  const historyRows: HistoryRow[] = sortedHistory.map((item, index) => {
    const previous = sortedHistory[index + 1];

    return { ...item, delta: previous ? item.overallScore - previous.overallScore : null };
  });

  const factors = latest ? [...latest.factors].sort((a, b) => b.contribution - a.contribution) : [];
  const topFactor = factors.length > 0 ? factors[0] : null;
  const highRisk = latest ? ["HIGH", "CRITICAL"].includes(String(latest.riskBand)) : false;

  const kpis: KpiItem[] = latest
    ? [
        {
          label: "Recommendation",
          icon: ClipboardCheck,
          value: readable(latest.recommendation),
          note: `Risk band ${readable(latest.riskBand)}`,
        },
        {
          label: "Score change",
          icon: AlertTriangle,
          value: latest.deltaScore === null ? "First evaluation" : signedChange(latest.deltaScore),
          note: latest.deterioration ? "Deteriorating" : "Compared with the previous evaluation",
          tone: latest.deterioration ? "warning" : "default",
        },
        {
          label: "Category dependency",
          icon: UserRoundSearch,
          value: `${latest.categorySpendShare.toFixed(1)}%`,
          note: "Share of category spend",
        },
        {
          label: "Currency",
          icon: Info,
          value: latest.currency,
          note: "Evaluation currency",
        },
      ]
    : [];

  const alertColumns = buildAlertColumns({
    canManage,
    busy: busyAny,
    onAcknowledge: (alert) => {
      setAckError(null);
      setAcknowledging(alert);
    },
    onEscalate: (alert) => openEscalation(String(alert.id)),
  });

  const caseColumns = buildCaseColumns({
    canManage,
    canClose,
    workingId,
    busy: busyAny,
    onStart: (escalation) => void startCase(escalation),
    onFinish: (kind, escalation) => {
      setFinishError(null);
      setFinishing({ kind, escalation });
    },
  });

  const watchlistInfo = watchlistAction !== null ? watchlistCopy(watchlistAction, supplierName) : null;
  const finishInfo = finishing !== null ? finishCopy(finishing) : null;

  return (
    <div className="page-stack">
      <Link href="/supplier-risk-monitoring" className="request-back-link">
        <ArrowLeft size={16} />
        Supplier risk monitoring
      </Link>

      <section className="supplier-risk-detail-heading">
        <div>
          <span className="eyebrow">Continuous supplier assurance</span>

          <h1>{supplierName}</h1>

          <p>
            {detail.supplierCode}
            {" · "}
            {detail.supplierCategory ?? "Uncategorized"}
            {" · "}
            {detail.supplierCountry ?? "Unknown country"}
          </p>
        </div>

        {latest ? (
          <div
            className={`supplier-risk-score-card supplier-risk-score-card--${latest.riskBand.toLowerCase()}`}
          >
            <span>Continuous risk</span>

            <strong>{latest.overallScore.toFixed(1)}</strong>

            <small>{latest.riskBand}</small>
          </div>
        ) : null}
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

        <Link href={`/suppliers/${supplierId}`} className="button button--secondary">
          Supplier 360
        </Link>

        {canManage ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busyAny}
            onClick={() => openEscalation("")}
          >
            <Plus size={16} />
            Open escalation
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

      {latest && latest.deterioration ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This supplier&apos;s risk has deteriorated.</strong>
            {latest.deltaScore !== null
              ? ` The score moved ${signedChange(latest.deltaScore)} points since the previous evaluation.`
              : ""}{" "}
            Review the alerts below and escalate if needed.
          </div>
        </div>
      ) : null}

      {canManage && openAlerts.length > 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>
              {openAlerts.length} {openAlerts.length === 1 ? "alert is" : "alerts are"} waiting for
              acknowledgement.
            </strong>{" "}
            Acknowledge each one once it has been reviewed.
          </div>
        </div>
      ) : null}

      {overdueCases.length > 0 ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueCases.length} escalation {overdueCases.length === 1 ? "case is" : "cases are"}{" "}
              overdue.
            </strong>{" "}
            Close or cancel {overdueCases.length === 1 ? "it" : "them"} in the cases table below.
          </div>
        </div>
      ) : null}

      {canManage && highRisk && liveCases.length === 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>No active escalation for a high-risk supplier.</strong> Use Open escalation to
            start a tracked case.
          </div>
        </div>
      ) : null}

      {latest ? (
        <>
          <KpiGrid items={kpis} ariaLabel="Risk summary" />

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Explainable scoring</span>

                <h2>Risk factor decomposition</h2>
              </div>

              <UserRoundSearch size={19} />
            </div>

            {topFactor !== null ? (
              <p className="kit-meta-line" style={{ marginBottom: 12 }}>
                Largest driver: {readable(topFactor.factorCode)} ({topFactor.contribution.toFixed(1)}{" "}
                points of {latest.overallScore.toFixed(1)})
              </p>
            ) : null}

            <div className="supplier-risk-factor-list">
              {factors.map((factor) => (
                <article key={factor.factorCode}>
                  <div className="supplier-risk-factor-heading">
                    <div>
                      <strong>{readable(factor.factorCode)}</strong>

                      <span>{factor.weightPct.toFixed(0)}% weight</span>
                    </div>

                    <div>
                      <strong>{factor.factorScore.toFixed(1)}</strong>

                      <span>{factor.contribution.toFixed(1)} points</span>
                    </div>
                  </div>

                  <Meter
                    value={clampPercent(factor.factorScore)}
                    max={100}
                    tone={factorTone(factor.factorScore)}
                    ariaLabel={`${readable(factor.factorCode)} risk factor score`}
                  />

                  <p>{factor.details}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="No risk evaluation yet"
            description="No risk evaluation exists for this supplier and currency. Run the portfolio evaluation first."
          />
        </section>
      )}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Early warning</span>

            <h2>Risk alerts</h2>
          </div>

          <ShieldAlert size={19} />
        </div>

        {alerts.length > 0 ? (
          <div className="kit-toolbar" style={{ marginBottom: 14 }}>
            <SegmentedFilter
              options={alertOptions}
              value={alertView}
              onChange={setAlertView}
              ariaLabel="Filter alerts"
            />
          </div>
        ) : null}

        <DataTable
          columns={alertColumns}
          rows={shownAlerts}
          getRowId={(alert) => String(alert.id)}
          ariaLabel="Supplier risk alerts"
          busy={fetching}
          empty={
            <EmptyState
              compact
              icon={ShieldAlert}
              title={alerts.length === 0 ? "No alerts" : "Nothing in this view"}
              description={
                alerts.length === 0
                  ? "No supplier-risk alerts."
                  : "No open alerts. Switch to All to see acknowledged ones."
              }
            />
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Governance</span>

            <h2>Risk watchlist</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className={watchlist ? "button button--secondary" : "button button--primary"}
              disabled={busyAny}
              onClick={() => {
                setWatchlistError(null);
                setWatchlistAction(watchlist ? "RELEASE" : "ADD");
              }}
            >
              {watchlist ? "Release from watchlist" : "Add to watchlist"}
            </button>
          ) : (
            <AlertTriangle size={19} />
          )}
        </div>

        {watchlist ? (
          <div className="supplier-risk-watchlist-card">
            <span>ACTIVE WATCHLIST</span>

            <strong>{watchlist.reason}</strong>

            <small>
              Added by {watchlist.addedByName}
              {" · "}
              {formatDateTime(watchlist.addedAt)}
            </small>
          </div>
        ) : (
          <div className="supplier-risk-watchlist-card supplier-risk-watchlist-card--clear">
            <BadgeCheck size={18} />

            <strong>Supplier is not manually watchlisted.</strong>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Escalation governance</span>

            <h2>Risk escalation cases</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => openEscalation("")}
            >
              <Plus size={15} />
              Open escalation
            </button>
          ) : (
            <ClipboardCheck size={19} />
          )}
        </div>

        <DataTable
          columns={caseColumns}
          rows={orderedCases}
          getRowId={(escalation) => String(escalation.id)}
          ariaLabel="Risk escalation cases"
          busy={fetching}
          empty={
            <EmptyState
              icon={ClipboardCheck}
              title="No escalation cases"
              description="No escalation cases have been opened."
              action={
                canManage ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => openEscalation("")}
                  >
                    <Plus size={15} />
                    Open escalation
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {history.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Risk trajectory</span>

              <h2>Evaluation history</h2>
            </div>
          </div>

          <DataTable
            columns={buildHistoryColumns()}
            rows={historyRows}
            getRowId={(item) => String(item.id)}
            ariaLabel="Evaluation history"
          />
        </section>
      ) : null}

      {escalating ? (
        <EscalationModal
          supplierId={supplierId}
          supplierName={supplierName}
          alerts={alerts}
          users={users}
          initialAlertId={escalateAlertId}
          onClose={() => setEscalating(false)}
          onSaved={handleEscalated}
        />
      ) : null}

      {watchlistAction !== null && watchlistInfo !== null ? (
        <RationaleDialog
          eyebrow="Risk watchlist"
          title={watchlistInfo.title}
          description={watchlistInfo.description}
          label={watchlistInfo.label}
          placeholder={watchlistInfo.placeholder}
          confirmLabel={watchlistInfo.confirm}
          busyLabel={watchlistInfo.busy}
          tone={watchlistInfo.tone}
          maxLength={2000}
          busy={watchlistRunning}
          error={watchlistError}
          onConfirm={(note) => void confirmWatchlist(note)}
          onCancel={() => setWatchlistAction(null)}
        />
      ) : null}

      {acknowledging !== null ? (
        <RationaleDialog
          eyebrow="Risk alert"
          title="Acknowledge alert"
          description={`Confirm that you have reviewed “${acknowledging.title}”.`}
          label="Acknowledgement note"
          placeholder="What was reviewed, and what happens next?"
          confirmLabel="Acknowledge"
          busyLabel="Acknowledging…"
          maxLength={2000}
          busy={ackRunning}
          error={ackError}
          onConfirm={(note) => void confirmAcknowledge(note)}
          onCancel={() => setAcknowledging(null)}
        />
      ) : null}

      {finishing !== null && finishInfo !== null ? (
        <RationaleDialog
          eyebrow="Escalation governance"
          title={finishInfo.title}
          description={finishInfo.description}
          label={finishInfo.label}
          placeholder={finishInfo.placeholder}
          confirmLabel={finishInfo.confirm}
          busyLabel={finishInfo.busy}
          tone={finishInfo.tone}
          maxLength={2000}
          busy={finishRunning}
          error={finishError}
          onConfirm={(note) => void confirmFinish(note)}
          onCancel={() => setFinishing(null)}
        />
      ) : null}
    </div>
  );
}
