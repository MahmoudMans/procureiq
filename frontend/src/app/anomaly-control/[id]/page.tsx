"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock,
  FilePlus2,
  FileWarning,
  Gauge,
  Info,
  Play,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
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
  formatDate,
  formatDateTime,
  readable,
  useToast,
} from "@/components/kit";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addAnomalyInvestigationEvidence,
  cancelAnomalyInvestigation,
  closeAnomalyInvestigation,
  createAnomalyInvestigation,
  getAnomalyControlContext,
  getAnomalyControlFinding,
  startAnomalyInvestigation,
} from "@/lib/api";
import type {
  AnomalyContext,
  AnomalyFindingDetail,
  Investigation,
  InvestigationDisposition,
  InvestigationEvidenceType,
  InvestigationPriority,
} from "@/types/anomaly-control";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ContextUser = AnomalyContext["users"][number];
type Evidence = Investigation["evidence"][number];

const INVESTIGATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const DISPOSE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const EVIDENCE_TYPES = [
  { value: "NOTE", label: "Note" },
  { value: "TRANSACTION_REFERENCE", label: "Transaction reference" },
  { value: "DOCUMENT_REFERENCE", label: "Document reference" },
  { value: "CONTROL_TEST", label: "Control test" },
];

const DISPOSITIONS = [
  {
    value: "CONFIRMED",
    label: "Confirm anomaly",
    hint: "The investigation confirms the signal as a genuine control anomaly.",
  },
  {
    value: "DISMISSED",
    label: "Dismiss signal",
    hint: "The investigation finds no control concern, so the signal is dismissed.",
  },
  {
    value: "RESOLVED",
    label: "Resolved control issue",
    hint: "The underlying control issue has been addressed.",
  },
];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Local calendar date as YYYY-MM-DD, offset by a number of days. */
function isoDate(offsetDays: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offsetDays);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isActive(investigation: Investigation): boolean {
  return investigation.status === "OPEN" || investigation.status === "IN_PROGRESS";
}

function LevelBadge({ level }: { level: string }) {
  return <StatusBadge value={level} label={readable(level)} />;
}

function InvestigationBadge({ status }: { status: string }) {
  if (status === "IN_PROGRESS") {
    return <StatusBadge value="IN_PROGRESS" label="In progress" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildEvidenceColumns(): Column<Evidence>[] {
  return [
    {
      id: "type",
      header: "Type",
      sortValue: (item) => String(item.evidenceType),
      cell: (item) => readable(String(item.evidenceType)),
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: (item) => <span>{item.referenceText}</span>,
    },
    {
      id: "by",
      header: "Added by",
      sortValue: (item) => (item.addedByName ?? "").toLowerCase(),
      cell: (item) => item.addedByName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "added",
      header: "Added",
      sortValue: (item) => item.createdAt,
      cell: (item) => formatDateTime(item.createdAt),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Open investigation modal                                            */
/* ------------------------------------------------------------------ */

interface OpenModalProps {
  findingId: string;
  owners: ContextUser[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function OpenInvestigationModal({ findingId, owners, onClose, onSaved }: OpenModalProps) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [priority, setPriority] = useState<InvestigationPriority>("HIGH");
  const [dueDate, setDueDate] = useState(() => isoDate(14));
  const [dueError, setDueError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dueInPast = dueDate !== "" && dueDate < isoDate(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!dueDate) {
      setDueError("Choose a due date.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createAnomalyInvestigation(findingId, {
        ownerUserId: ownerId || undefined,
        priority,
        dueDate,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create investigation.");
      setSaving(false);

      return;
    }

    await onSaved();
  }

  return (
    <Modal
      eyebrow="Investigation workflow"
      title="Open investigation"
      description="Assign an owner, a priority and a due date for the case."
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
            form="anomaly-open-form"
            className="button button--primary"
            disabled={saving}
          >
            <SearchCheck size={16} />
            {saving ? "Opening…" : "Open investigation"}
          </button>
        </>
      }
    >
      <form id="anomaly-open-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          {owners.length > 0 ? (
            <div className="kit-pair-wide">
              <Field label="Owner" htmlFor="anomaly-owner">
                <select
                  id="anomaly-owner"
                  className="kit-field-input"
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                >
                  {owners.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} — {candidate.role}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          <Field label="Priority" htmlFor="anomaly-priority">
            <select
              id="anomaly-priority"
              className="kit-field-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as InvestigationPriority)}
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date" htmlFor="anomaly-due" error={dueError}>
            <input
              id="anomaly-due"
              className="kit-field-input"
              type="date"
              value={dueDate}
              aria-invalid={dueError ? true : undefined}
              onChange={(event) => {
                setDueDate(event.target.value);
                setDueError(undefined);
              }}
            />
          </Field>
        </div>

        {dueInPast ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            The due date is in the past, so the case will be flagged as overdue immediately.
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
/* Add evidence modal                                                  */
/* ------------------------------------------------------------------ */

interface EvidenceModalProps {
  investigation: Investigation;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function AddEvidenceModal({ investigation, onClose, onSaved }: EvidenceModalProps) {
  const [evidenceType, setEvidenceType] = useState<InvestigationEvidenceType>("NOTE");
  const [text, setText] = useState("");
  const [textError, setTextError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!text.trim()) {
      setTextError("Enter the investigation evidence.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addAnomalyInvestigationEvidence(investigation.id, {
        evidenceType,
        referenceText: text.trim(),
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to add investigation evidence.",
      );
      setSaving(false);

      return;
    }

    await onSaved();
  }

  return (
    <Modal
      eyebrow={investigation.caseNumber}
      title="Add investigation evidence"
      description="Record a note, a reference or a control test that supports the conclusion."
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
            form="anomaly-evidence-form"
            className="button button--primary"
            disabled={saving}
          >
            <FilePlus2 size={16} />
            {saving ? "Adding…" : "Add evidence"}
          </button>
        </>
      }
    >
      <form id="anomaly-evidence-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Evidence type" htmlFor="anomaly-evidence-type">
              <select
                id="anomaly-evidence-type"
                className="kit-field-input"
                value={evidenceType}
                onChange={(event) =>
                  setEvidenceType(event.target.value as InvestigationEvidenceType)
                }
              >
                {EVIDENCE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field label="Investigation evidence" htmlFor="anomaly-evidence-text" error={textError}>
              <textarea
                id="anomaly-evidence-text"
                className="kit-field-input"
                rows={5}
                value={text}
                aria-invalid={textError ? true : undefined}
                onChange={(event) => {
                  setText(event.target.value);
                  setTextError(undefined);
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
/* Close and dispose modal                                             */
/* ------------------------------------------------------------------ */

interface CloseModalProps {
  investigation: Investigation;
  onClose: () => void;
  onSaved: (label: string) => Promise<void>;
}

function CloseCaseModal({ investigation, onClose, onSaved }: CloseModalProps) {
  const [disposition, setDisposition] = useState<InvestigationDisposition>("RESOLVED");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = DISPOSITIONS.find((option) => option.value === disposition);
  const noEvidence = investigation.evidence.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!note.trim()) {
      setNoteError("An investigation conclusion is required.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await closeAnomalyInvestigation(investigation.id, {
        disposition,
        note: note.trim(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to close investigation.");
      setSaving(false);

      return;
    }

    await onSaved(selected ? selected.label : "Case closed");
  }

  return (
    <Modal
      eyebrow="Controlled disposition"
      title="Close and dispose"
      description={`${investigation.caseNumber} will be closed and the finding will receive the disposition you choose.`}
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
            form="anomaly-close-form"
            className="button button--primary"
            disabled={saving}
          >
            <BadgeCheck size={16} />
            {saving ? "Closing…" : "Close & dispose"}
          </button>
        </>
      }
    >
      <form id="anomaly-close-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Disposition" htmlFor="anomaly-disposition">
              <select
                id="anomaly-disposition"
                className="kit-field-input"
                value={disposition}
                onChange={(event) =>
                  setDisposition(event.target.value as InvestigationDisposition)
                }
              >
                {DISPOSITIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {selected ? <p className="kit-meta-line">{selected.hint}</p> : null}
          </div>

          <div className="kit-pair-wide">
            <Field
              label="Investigation conclusion / rationale"
              htmlFor="anomaly-conclusion"
              error={noteError}
            >
              <textarea
                id="anomaly-conclusion"
                className="kit-field-input"
                rows={5}
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

        {noEvidence ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            No evidence has been added to this case. A conclusion normally cites supporting
            evidence.
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

interface FindingData {
  id: string;
  detail: AnomalyFindingDetail;
  context: AnomalyContext;
}

export default function AnomalyFindingPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canInvestigate = user !== null && INVESTIGATE_ROLES.includes(user.role);
  const canDispose = user !== null && DISPOSE_ROLES.includes(user.role);

  const [result, setResult] = useState<FindingData | null>(null);
  const [opening, setOpening] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelRunning, setCancelRunning] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
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
        const [findingResponse, contextResponse] = await Promise.all([
          getAnomalyControlFinding(id),
          getAnomalyControlContext(),
        ]);

        if (active) {
          setResult({ id, detail: findingResponse, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load anomaly finding.");
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
  const context = data?.context ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getAnomalyControlFinding(id);

      setResult((current) =>
        current && current.id === id ? { ...current, detail: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the finding.");
    }
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
        <Link href="/anomaly-control" className="request-back-link">
          <ArrowLeft size={16} />
          Anomaly control
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

  const { finding, investigations } = detail;
  const owners = (context?.users ?? []).filter((candidate) => candidate.role !== "REQUESTER");

  const activeInvestigation = investigations.find(isActive);
  const activeCount = investigations.filter(isActive).length;
  const overdueCount = investigations.filter(
    (investigation) => investigation.overdue && isActive(investigation),
  ).length;
  const findingOpen = finding.status === "OPEN";
  const busyAny = workingId !== null || cancelRunning;

  const evidenceTarget =
    investigations.find((investigation) => String(investigation.id) === evidenceId) ?? null;
  const closeTarget =
    investigations.find((investigation) => String(investigation.id) === closeId) ?? null;
  const cancelTarget =
    investigations.find((investigation) => String(investigation.id) === cancelId) ?? null;

  async function afterChange(title: string, detailText: string) {
    await refresh();

    toast.success(title, detailText);
  }

  async function handleOpened() {
    await afterChange("Investigation opened", finding.ruleCode);

    setOpening(false);
  }

  async function handleEvidenceAdded(investigation: Investigation) {
    await afterChange("Evidence added", investigation.caseNumber);

    setEvidenceId(null);
  }

  async function handleClosed(investigation: Investigation, label: string) {
    await afterChange("Case closed", `${investigation.caseNumber} — ${label}`);

    setCloseId(null);
  }

  async function startInvestigation(investigation: Investigation) {
    if (workingId !== null) {
      return;
    }

    setWorkingId(String(investigation.id));

    try {
      await startAnomalyInvestigation(investigation.id);

      await afterChange("Investigation started", investigation.caseNumber);
    } catch (caught) {
      toast.error(
        "Could not start the investigation",
        caught instanceof Error ? caught.message : "Unable to start investigation.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmCancel(note: string) {
    if (cancelTarget === null) {
      return;
    }

    const target = cancelTarget;

    setCancelRunning(true);
    setCancelError(null);

    try {
      await cancelAnomalyInvestigation(target.id, note.trim());

      await afterChange("Case cancelled", target.caseNumber);

      setCancelId(null);
    } catch (caught) {
      setCancelError(
        caught instanceof Error ? caught.message : "Unable to cancel investigation.",
      );
    } finally {
      setCancelRunning(false);
    }
  }

  const orderedInvestigations = [...investigations].sort((a, b) => {
    const left = isActive(a) ? 0 : 1;
    const right = isActive(b) ? 0 : 1;

    if (left !== right) {
      return left - right;
    }

    return String(a.dueDate).localeCompare(String(b.dueDate));
  });

  const exposureText =
    finding.exposureValue !== null
      ? finding.currency
        ? money(finding.exposureValue, finding.currency)
        : finding.exposureValue.toFixed(2)
      : "—";

  const kpis: KpiItem[] = [
    {
      label: "Metric",
      icon: Gauge,
      value: finding.metricValue !== null ? finding.metricValue.toFixed(2) : "—",
      note: readable(String(finding.signalType)),
    },
    {
      label: "Exposure",
      icon: AlertTriangle,
      value: exposureText,
      note: "Value at stake",
    },
    {
      label: "Investigations",
      icon: SearchCheck,
      value: String(investigations.length),
      note: activeCount > 0 ? `${activeCount} active` : "None active",
    },
    {
      label: "Overdue",
      icon: Clock,
      value: String(overdueCount),
      note: overdueCount > 0 ? "Active cases past their due date" : "No overdue case",
      tone: overdueCount > 0 ? "warning" : "default",
    },
  ];

  const evidenceColumns = buildEvidenceColumns();

  return (
    <div className="page-stack">
      <Link href="/anomaly-control" className="request-back-link">
        <ArrowLeft size={16} />
        Anomaly control
      </Link>

      <section className="anomaly-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{finding.ruleCode}</span>

            <LevelBadge level={String(finding.severity)} />

            <StatusBadge value={String(finding.status)} label={readable(String(finding.status))} />
          </div>

          <h1>{finding.ruleTitle}</h1>

          <p>
            {readable(String(finding.signalType))}
            {" · "}
            {finding.entityReference ?? finding.entityId}
          </p>
        </div>

        <div className="anomaly-score-card">
          <span>Anomaly score</span>

          <strong>{finding.anomalyScore.toFixed(0)}</strong>
        </div>
      </section>

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

        {canInvestigate && findingOpen && !activeInvestigation ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busyAny}
            onClick={() => setOpening(true)}
          >
            <SearchCheck size={16} />
            Open investigation
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

      {canInvestigate && findingOpen && !activeInvestigation ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No investigation is open.</strong> Open an investigation to confirm, dismiss or
            resolve this signal. Otherwise it stays open until a future scan resolves it.
          </div>
        </div>
      ) : null}

      {overdueCount > 0 ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {overdueCount} {overdueCount === 1 ? "investigation is" : "investigations are"}{" "}
              overdue.
            </strong>{" "}
            Add the missing evidence and close or cancel {overdueCount === 1 ? "it" : "them"}.
          </div>
        </div>
      ) : null}

      {activeInvestigation && canInvestigate && !canDispose ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>You can add evidence to the active case.</strong> A procurement manager or
            administrator needs to close and dispose it.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Finding summary" />

      <section className="anomaly-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Control evidence</span>

              <h2>Detection details</h2>
            </div>

            <SearchCheck size={19} />
          </div>

          <div className="anomaly-evidence-grid">
            <div>
              <span>Entity type</span>

              <strong>{readable(String(finding.entityType))}</strong>
            </div>

            <div>
              <span>Reference</span>

              <strong>{finding.entityReference ?? "—"}</strong>
            </div>

            <div>
              <span>First detected</span>

              <strong>{formatDateTime(finding.detectedAt)}</strong>
            </div>

            <div>
              <span>Last detected</span>

              <strong>{formatDateTime(finding.lastSeenAt)}</strong>
            </div>
          </div>

          <div className="anomaly-details-text">{finding.details}</div>

          <div className="anomaly-not-proof">
            <ShieldAlert size={15} />

            <span>
              This anomaly is a control indicator, not a conclusion of fraud or misconduct.
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Disposition</span>

              <h2>Control status</h2>
            </div>

            <FileWarning size={19} />
          </div>

          <div className="anomaly-disposition-card">
            <StatusBadge value={String(finding.status)} label={readable(String(finding.status))} />

            {finding.dispositionNote ? (
              <>
                <strong>{finding.dispositionNote}</strong>

                <small>
                  {finding.disposedByName ?? "Automated control engine"}
                  {finding.disposedAt ? ` · ${formatDateTime(finding.disposedAt)}` : ""}
                </small>
              </>
            ) : (
              <p>
                The finding remains open until automatically resolved by a future scan or
                explicitly investigated and disposed.
              </p>
            )}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Case management</span>

            <h2>Investigations</h2>
          </div>

          {canInvestigate && findingOpen && !activeInvestigation ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setOpening(true)}
            >
              <SearchCheck size={15} />
              Open investigation
            </button>
          ) : (
            <SearchCheck size={19} />
          )}
        </div>

        {orderedInvestigations.length === 0 ? (
          <EmptyState
            icon={SearchCheck}
            title="No investigations"
            description="No investigation has been opened for this signal."
          />
        ) : (
          <div className="anomaly-investigation-list">
            {orderedInvestigations.map((investigation) => {
              const active = isActive(investigation);
              const starting = workingId === String(investigation.id);

              const evidenceRows = [...investigation.evidence].sort((a, b) =>
                b.createdAt.localeCompare(a.createdAt),
              );

              return (
                <article
                  key={investigation.id}
                  className={
                    investigation.overdue
                      ? "anomaly-investigation anomaly-investigation--overdue"
                      : "anomaly-investigation"
                  }
                >
                  <div className="anomaly-investigation-heading">
                    <div>
                      <div className="request-detail-heading__meta">
                        <InvestigationBadge status={String(investigation.status)} />

                        <LevelBadge level={String(investigation.priority)} />
                      </div>

                      <strong>{investigation.caseNumber}</strong>

                      <small>Owner: {investigation.ownerName}</small>
                    </div>

                    <div>
                      <span>Due</span>

                      <strong className={investigation.overdue ? "kit-text-danger" : undefined}>
                        {formatDate(investigation.dueDate)}
                      </strong>
                    </div>
                  </div>

                  {investigation.conclusion ? (
                    <div className="anomaly-conclusion">{investigation.conclusion}</div>
                  ) : null}

                  {evidenceRows.length > 0 ? (
                    <DataTable
                      columns={evidenceColumns}
                      rows={evidenceRows}
                      getRowId={(item) => String(item.id)}
                      ariaLabel={`Evidence for ${investigation.caseNumber}`}
                      busy={fetching}
                    />
                  ) : (
                    <p className="kit-meta-line">No evidence has been added to this case yet.</p>
                  )}

                  {active && canInvestigate ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        alignItems: "center",
                        marginTop: 12,
                      }}
                    >
                      {investigation.status === "OPEN" ? (
                        <button
                          type="button"
                          className="button button--secondary"
                          disabled={busyAny}
                          onClick={() => void startInvestigation(investigation)}
                        >
                          <Play size={14} />
                          {starting ? "Starting…" : "Start"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="button button--secondary"
                        disabled={busyAny}
                        onClick={() => setEvidenceId(String(investigation.id))}
                      >
                        <FilePlus2 size={14} />
                        Add evidence
                      </button>

                      {canDispose ? (
                        <>
                          <button
                            type="button"
                            className="button button--secondary request-cancel-button"
                            disabled={busyAny}
                            onClick={() => {
                              setCancelError(null);
                              setCancelId(String(investigation.id));
                            }}
                          >
                            <XCircle size={14} />
                            Cancel case
                          </button>

                          <button
                            type="button"
                            className="button button--primary"
                            disabled={busyAny}
                            onClick={() => setCloseId(String(investigation.id))}
                          >
                            <BadgeCheck size={14} />
                            Close & dispose
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="anomaly-control-note">
        <AlertTriangle size={18} />

        <div>
          <strong>Governed interpretation</strong>

          <p>
            A deterministic anomaly score is a prioritization signal. Confirmation requires an
            explicit investigation, supporting evidence and a controlled disposition.
          </p>
        </div>
      </section>

      {opening ? (
        <OpenInvestigationModal
          findingId={params.id}
          owners={owners}
          onClose={() => setOpening(false)}
          onSaved={handleOpened}
        />
      ) : null}

      {evidenceTarget !== null ? (
        <AddEvidenceModal
          investigation={evidenceTarget}
          onClose={() => setEvidenceId(null)}
          onSaved={() => handleEvidenceAdded(evidenceTarget)}
        />
      ) : null}

      {closeTarget !== null ? (
        <CloseCaseModal
          investigation={closeTarget}
          onClose={() => setCloseId(null)}
          onSaved={(label) => handleClosed(closeTarget, label)}
        />
      ) : null}

      {cancelTarget !== null ? (
        <RationaleDialog
          eyebrow="Case management"
          title="Cancel this case"
          description={`${cancelTarget.caseNumber} will be cancelled without a disposition.`}
          label="Cancellation rationale"
          placeholder="Why is this case being cancelled?"
          confirmLabel="Cancel case"
          busyLabel="Cancelling…"
          cancelLabel="Keep case"
          tone="danger"
          maxLength={2000}
          busy={cancelRunning}
          error={cancelError}
          onConfirm={(note) => void confirmCancel(note)}
          onCancel={() => setCancelId(null)}
        />
      ) : null}
    </div>
  );
}
