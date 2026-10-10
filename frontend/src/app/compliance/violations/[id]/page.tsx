"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Info,
  Plus,
  RefreshCw,
  ShieldAlert,
  TicketCheck,
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
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  addPolicyEvidence,
  approvePolicyWaiver,
  getPolicyViolation,
  rejectPolicyWaiver,
  requestPolicyWaiver,
  resolvePolicyViolation,
} from "@/lib/api";
import type { PolicyEvidenceType, PolicyViolationDetail } from "@/types/policy-compliance";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type Violation = PolicyViolationDetail["violation"];
type Waiver = PolicyViolationDetail["waivers"][number];
type Evidence = PolicyViolationDetail["evidence"][number];
type RationaleRequest =
  | { kind: "APPROVE_WAIVER"; waiverId: string }
  | { kind: "REJECT_WAIVER"; waiverId: string }
  | { kind: "RESOLVE" };

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const APPROVE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function EvidenceContent({ content }: { content: string }) {
  const trimmed = content.trim();

  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return (
      <a href={trimmed} target="_blank" rel="noopener noreferrer">
        {trimmed}
      </a>
    );
  }

  return <span>{content}</span>;
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
  violation: Violation,
  waivers: Waiver[],
  evidenceCount: number,
): RationaleCopy {
  switch (request.kind) {
    case "APPROVE_WAIVER": {
      const waiver = waivers.find((candidate) => String(candidate.id) === request.waiverId);
      const number = waiver ? String(waiver.waiverNumber) : "The waiver";

      return {
        eyebrow: "Exception governance",
        title: "Approve waiver",
        description: `${number}${waiver ? `, requested by ${waiver.requestedByName},` : ""} will be approved for ${violation.policyCode}. The decision and rationale are recorded in the waiver history.`,
        label: "Waiver decision rationale",
        placeholder: "Why is this exception approved?",
        confirm: "Approve waiver",
        busy: "Approving…",
        tone: "primary",
        done: "Waiver approved",
        reference: number,
      };
    }

    case "REJECT_WAIVER": {
      const waiver = waivers.find((candidate) => String(candidate.id) === request.waiverId);
      const number = waiver ? String(waiver.waiverNumber) : "The waiver";

      return {
        eyebrow: "Exception governance",
        title: "Reject waiver",
        description: `${number} will be rejected. A rejected waiver does not clear ${violation.policyCode}, so the violation still needs remediation.`,
        label: "Waiver decision rationale",
        placeholder: "Why is this exception rejected?",
        confirm: "Reject waiver",
        busy: "Rejecting…",
        cancelLabel: "Keep pending",
        tone: "danger",
        done: "Waiver rejected",
        reference: number,
      };
    }

    case "RESOLVE":
      return {
        eyebrow: "Remediation",
        title: "Resolve violation",
        description: `${violation.policyCode} will be marked resolved. ${
          evidenceCount === 0
            ? "No compliance evidence has been added yet, so the resolution note is the only record."
            : `${plural(evidenceCount, "evidence item is", "evidence items are")} on file.`
        }`,
        label: "Resolution evidence",
        placeholder: "What remediation resolved the violation?",
        confirm: "Mark resolved",
        busy: "Resolving…",
        tone: "primary",
        done: "Violation resolved",
        reference: violation.policyCode,
      };
  }
}

async function performRationale(
  request: RationaleRequest,
  violationId: string,
  note: string,
): Promise<void> {
  switch (request.kind) {
    case "APPROVE_WAIVER":
      await approvePolicyWaiver(request.waiverId, note);
      return;

    case "REJECT_WAIVER":
      await rejectPolicyWaiver(request.waiverId, note);
      return;

    case "RESOLVE":
      await resolvePolicyViolation(violationId, note);
      return;
  }
}

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

function buildWaiverColumns(): Column<Waiver>[] {
  return [
    {
      id: "waiver",
      header: "Waiver",
      sortValue: (item) => String(item.waiverNumber).toLowerCase(),
      cell: (item) => <strong>{item.waiverNumber}</strong>,
    },
    {
      id: "requested",
      header: "Requested",
      sortValue: (item) => String(item.requestedAt ?? ""),
      cell: (item) => (
        <div className="kit-cell-stack">
          <strong>{item.requestedAt ? formatDateTime(item.requestedAt) : "—"}</strong>

          {item.requestedByName ? <small>By {item.requestedByName}</small> : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (item) => String(item.status),
      cell: (item) => (
        <StatusBadge value={String(item.status)} label={readable(String(item.status))} />
      ),
    },
    {
      id: "rationale",
      header: "Business rationale",
      cell: (item) => <span>{item.rationale}</span>,
    },
    {
      id: "decision",
      header: "Decision",
      cell: (item) =>
        item.decisionNote ? (
          <div className="kit-cell-stack">
            <span>{item.decisionNote}</span>

            {item.decidedByName ? <small>By {item.decidedByName}</small> : null}
          </div>
        ) : (
          <span className="kit-text-muted">—</span>
        ),
    },
  ];
}

function buildEvidenceColumns(): Column<Evidence>[] {
  return [
    {
      id: "type",
      header: "Type",
      sortValue: (item) => String(item.evidenceType),
      cell: (item) => (
        <StatusBadge
          value={String(item.evidenceType)}
          label={readable(String(item.evidenceType))}
        />
      ),
    },
    {
      id: "content",
      header: "Evidence",
      cell: (item) => <EvidenceContent content={String(item.content)} />,
    },
    {
      id: "by",
      header: "Added by",
      sortValue: (item) => String(item.addedByName ?? "").toLowerCase(),
      cell: (item) => item.addedByName ?? <span className="kit-text-muted">—</span>,
    },
    {
      id: "added",
      header: "Added",
      sortValue: (item) => String(item.createdAt ?? ""),
      cell: (item) => (item.createdAt ? formatDateTime(item.createdAt) : "—"),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Request waiver modal                                                */
/* ------------------------------------------------------------------ */

interface WaiverModalProps {
  violation: Violation;
  hasPending: boolean;
  onClose: () => void;
  onSaved: (label: string) => Promise<void>;
}

function WaiverModal({ violation, hasPending, onClose, onSaved }: WaiverModalProps) {
  const [rationale, setRationale] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!rationale.trim()) {
      setFieldError("Describe the business rationale for the exception.");

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await requestPolicyWaiver(violation.id, rationale.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request policy waiver.");
      setSaving(false);

      return;
    }

    await onSaved(violation.policyCode);
  }

  return (
    <Modal
      eyebrow="Exception request"
      title="Request policy waiver"
      description={`Ask for an exception to ${violation.policyName}. A manager decides the request.`}
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
            form="compliance-waiver-form"
            className="button button--primary"
            disabled={saving}
          >
            <TicketCheck size={16} />
            {saving ? "Submitting…" : "Submit waiver request"}
          </button>
        </>
      }
    >
      <form id="compliance-waiver-form" onSubmit={handleSubmit} noValidate>
        <Field label="Business rationale" htmlFor="compliance-waiver-rationale" error={fieldError}>
          <textarea
            id="compliance-waiver-rationale"
            className="kit-field-input"
            rows={5}
            maxLength={3000}
            value={rationale}
            aria-invalid={fieldError ? true : undefined}
            onChange={(event) => {
              setRationale(event.target.value);
              setFieldError(undefined);
            }}
          />
        </Field>

        {hasPending ? (
          <p className="kit-dialog-note kit-dialog-note--warning" style={{ marginTop: 14 }}>
            A waiver request is already awaiting a decision on this violation.
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
  violation: Violation;
  onClose: () => void;
  onSaved: (label: string) => Promise<void>;
}

function EvidenceModal({ violation, onClose, onSaved }: EvidenceModalProps) {
  const [evidenceType, setEvidenceType] = useState<PolicyEvidenceType>("NOTE");
  const [content, setContent] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isReference = String(evidenceType) === "REFERENCE";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!content.trim()) {
      setFieldError(
        isReference ? "Enter the reference or link." : "Describe the remediation evidence.",
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addPolicyEvidence(violation.id, {
        evidenceType,
        content: content.trim(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add compliance evidence.");
      setSaving(false);

      return;
    }

    await onSaved(readable(String(evidenceType)));
  }

  return (
    <Modal
      eyebrow="Audit evidence"
      title="Add compliance evidence"
      description={`Evidence recorded against ${violation.policyCode} stays on the violation record.`}
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
            form="compliance-evidence-form"
            className="button button--primary"
            disabled={saving}
          >
            <Plus size={16} />
            {saving ? "Adding…" : "Add evidence"}
          </button>
        </>
      }
    >
      <form id="compliance-evidence-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <div className="kit-pair-wide">
            <Field label="Type" htmlFor="compliance-evidence-type">
              <select
                id="compliance-evidence-type"
                className="kit-field-input"
                value={evidenceType}
                onChange={(event) => {
                  setEvidenceType(event.target.value as PolicyEvidenceType);
                  setFieldError(undefined);
                }}
              >
                <option value="NOTE">Note</option>

                <option value="REFERENCE">Reference</option>
              </select>
            </Field>
          </div>

          <div className="kit-pair-wide">
            <Field
              label={isReference ? "Reference or link" : "Remediation evidence"}
              htmlFor="compliance-evidence-content"
              error={fieldError}
            >
              <textarea
                id="compliance-evidence-content"
                className="kit-field-input"
                rows={4}
                maxLength={3000}
                value={content}
                placeholder={
                  isReference
                    ? "Paste a link or a ticket reference"
                    : "Describe the remediation that was carried out"
                }
                aria-invalid={fieldError ? true : undefined}
                onChange={(event) => {
                  setContent(event.target.value);
                  setFieldError(undefined);
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

interface ViolationData {
  id: string;
  detail: PolicyViolationDetail;
}

export default function PolicyViolationDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canApprove = user !== null && APPROVE_ROLES.includes(user.role);

  const [result, setResult] = useState<ViolationData | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);
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
        const response = await getPolicyViolation(id);

        if (active) {
          setResult({ id, detail: response });
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load policy violation.");
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

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getPolicyViolation(id);

      setResult((current) => (current && current.id === id ? { ...current, detail: fresh } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the violation.");
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
        <Link href="/compliance" className="request-back-link">
          <ArrowLeft size={16} />
          Policy & compliance
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

  const { violation, waivers, evidence } = detail;
  const status = String(violation.status);
  const severity = String(violation.severity);
  const open = status === "OPEN";
  const severe = severity === "HIGH" || severity === "CRITICAL";
  const pendingWaiver = waivers.find((waiver) => String(waiver.status) === "SUBMITTED") ?? null;
  const approvedWaiver = waivers.some((waiver) => String(waiver.status) === "APPROVED");
  const busyAny = rationaleRunning;

  const orderedWaivers = [...waivers].sort((a, b) =>
    String(b.requestedAt ?? "").localeCompare(String(a.requestedAt ?? "")),
  );
  const orderedEvidence = [...evidence].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );

  const latestWaiver = orderedWaivers.length > 0 ? orderedWaivers[0] : null;
  const lastRejected =
    open &&
    pendingWaiver === null &&
    latestWaiver !== null &&
    String(latestWaiver.status) === "REJECTED";

  const rationaleInfo =
    rationale !== null ? rationaleCopy(rationale, violation, waivers, evidence.length) : null;

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const request = rationale;
    const copy = rationaleCopy(request, violation, waivers, evidence.length);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      await performRationale(request, violation.id, note.trim());

      await refresh();

      setRationale(null);

      toast.success(copy.done, copy.reference);
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

  async function handleWaiverRequested(label: string) {
    await refresh();

    setRequesting(false);

    toast.success("Waiver requested", label);
  }

  async function handleEvidenceAdded(label: string) {
    await refresh();

    setAddingEvidence(false);

    toast.success("Evidence added", label);
  }

  const kpis: KpiItem[] = [
    {
      label: "Violation status",
      icon: ShieldAlert,
      value: readable(status),
      note: `${readable(severity)} severity`,
      tone: open && severe ? "warning" : "default",
    },
    {
      label: "Source record",
      icon: FileCheck2,
      value: violation.sourceReference ?? "—",
      note: readable(String(violation.sourceType)),
    },
    {
      label: "Waivers",
      icon: TicketCheck,
      value: String(waivers.length),
      note: pendingWaiver ? "Decision pending" : "No pending waiver",
    },
    {
      label: "Evidence",
      icon: BadgeCheck,
      value: String(evidence.length),
      note: "Compliance evidence items",
    },
  ];

  const waiverColumns = buildWaiverColumns();
  const evidenceColumns = buildEvidenceColumns();

  return (
    <div className="page-stack">
      <Link href="/compliance" className="request-back-link">
        <ArrowLeft size={16} />
        Policy & compliance
      </Link>

      <section className="compliance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{violation.policyCode}</span>

            <StatusBadge value={severity} label={readable(severity)} />

            <StatusBadge value={status} label={readable(status)} />
          </div>

          <h1>{violation.policyName}</h1>

          <p>{violation.details}</p>
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

          <Link href={violation.sourceHref} className="button button--secondary">
            <ExternalLink size={15} />
            Open source record
          </Link>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAddingEvidence(true)}
            >
              <Plus size={15} />
              Add evidence
            </button>
          ) : null}

          {canManage && open ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRequesting(true)}
            >
              <TicketCheck size={15} />
              Request waiver
            </button>
          ) : null}

          {canApprove && pendingWaiver ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={busyAny}
              onClick={() =>
                openRationale({ kind: "REJECT_WAIVER", waiverId: String(pendingWaiver.id) })
              }
            >
              <XCircle size={15} />
              Reject waiver
            </button>
          ) : null}

          {canApprove && pendingWaiver ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() =>
                openRationale({ kind: "APPROVE_WAIVER", waiverId: String(pendingWaiver.id) })
              }
            >
              <BadgeCheck size={16} />
              Approve waiver
            </button>
          ) : null}

          {canManage && open ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busyAny}
              onClick={() => openRationale({ kind: "RESOLVE" })}
            >
              <BadgeCheck size={16} />
              Mark resolved
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

      {open && severe ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>This is a {readable(severity).toLowerCase()} severity violation.</strong> It
            is still open, so it needs remediation or an approved waiver.
          </div>
        </div>
      ) : null}

      {pendingWaiver !== null ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>A waiver request is awaiting a decision.</strong>{" "}
            {canApprove
              ? "Use Approve waiver or Reject waiver above."
              : "A procurement manager or administrator needs to decide it."}
          </div>
        </div>
      ) : null}

      {lastRejected ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The latest waiver request was rejected.</strong> The violation still needs
            remediation.
          </div>
        </div>
      ) : null}

      {approvedWaiver ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>A waiver has been approved for this violation.</strong> The decision is in the
            waiver history below.
          </div>
        </div>
      ) : null}

      {open && canManage && waivers.length === 0 ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Add remediation evidence, then resolve the violation.</strong> If the
            exception is justified, request a policy waiver instead.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Violation summary" />

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Violation context</span>

            <h2>Policy & transaction</h2>
          </div>
        </div>

        <div className="compliance-detail-context">
          <div>
            <span>Policy type</span>

            <strong>{readable(String(violation.policyType))}</strong>
          </div>

          <div>
            <span>Policy owner</span>

            <strong>{violation.policyOwnerName}</strong>
          </div>

          <div>
            <span>Source amount</span>

            <strong>
              {typeof violation.sourceAmount === "number"
                ? violation.currency
                  ? money(violation.sourceAmount, violation.currency)
                  : String(violation.sourceAmount)
                : "—"}
            </strong>
          </div>

          <div>
            <span>Detected</span>

            <strong>{formatDateTime(violation.detectedAt)}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Exception governance</span>

            <h2>Waiver history</h2>
          </div>

          {canManage && open ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setRequesting(true)}
            >
              <TicketCheck size={15} />
              Request waiver
            </button>
          ) : (
            <TicketCheck size={19} />
          )}
        </div>

        <DataTable
          columns={waiverColumns}
          rows={orderedWaivers}
          getRowId={(waiver) => String(waiver.id)}
          ariaLabel="Waiver history"
          busy={fetching}
          empty={
            <EmptyState
              icon={TicketCheck}
              title="No waivers"
              description="No waiver has been requested."
              action={
                canManage && open ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setRequesting(true)}
                  >
                    <TicketCheck size={15} />
                    Request waiver
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
            <span className="eyebrow">Audit evidence</span>

            <h2>Compliance evidence</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busyAny}
              onClick={() => setAddingEvidence(true)}
            >
              <Plus size={15} />
              Add evidence
            </button>
          ) : (
            <FileCheck2 size={19} />
          )}
        </div>

        <DataTable
          columns={evidenceColumns}
          rows={orderedEvidence}
          getRowId={(item) => String(item.id)}
          ariaLabel="Compliance evidence"
          busy={fetching}
          empty={
            <EmptyState
              icon={FileCheck2}
              title="No evidence"
              description="No evidence has been added."
              action={
                canManage ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAddingEvidence(true)}
                  >
                    <Plus size={15} />
                    Add evidence
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {violation.resolutionNote ? (
        <section className="compliance-resolution-card">
          <BadgeCheck size={19} />

          <div>
            <span>Resolution</span>

            <strong>{violation.resolutionNote}</strong>

            <small>
              {violation.resolvedByName ?? "Procurement"}
              {violation.resolvedAt ? ` · ${formatDateTime(violation.resolvedAt)}` : ""}
            </small>
          </div>
        </section>
      ) : null}

      {requesting ? (
        <WaiverModal
          violation={violation}
          hasPending={pendingWaiver !== null}
          onClose={() => setRequesting(false)}
          onSaved={handleWaiverRequested}
        />
      ) : null}

      {addingEvidence ? (
        <EvidenceModal
          violation={violation}
          onClose={() => setAddingEvidence(false)}
          onSaved={handleEvidenceAdded}
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
