"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type BadgeTone,
  type Column,
  DataTable,
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
  formatDate,
  formatMoney,
  meterToneFor,
  toneFor,
  useToast,
} from "@/components/kit";
import { ActionDialog } from "@/components/kit/action-dialog";
import {
  activateContract,
  createComplianceDocument,
  getContract,
  getSupplierCompliance,
  terminateContract,
  updateContract,
} from "@/lib/api";
import type { SupplierCompliance, SupplierContract } from "@/types/contract";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type ComplianceDocument = SupplierCompliance["documents"][number];
type ContractAction = "ACTIVATE" | "TERMINATE";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const TERMINATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const DAY_MS = 86400000;

const DOCUMENT_TYPES = [
  "Insurance Certificate",
  "Tax Clearance",
  "Business License",
  "Quality Certification",
  "Bank Confirmation",
];

const DOCUMENT_STATUS_RANK: Record<string, number> = {
  EXPIRED: 0,
  MISSING: 1,
  EXPIRING_SOON: 2,
  PENDING: 3,
  VALID: 4,
};

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

const ACTIONS: Record<ContractAction, ActionCopy> = {
  ACTIVATE: {
    eyebrow: "Activate contract",
    title: "Activate this contract?",
    confirm: "Activate contract",
    busy: "Activating…",
    keep: "Not yet",
    done: "Contract activated",
    failed: "Could not activate the contract",
    tone: "primary",
  },
  TERMINATE: {
    eyebrow: "Terminate contract",
    title: "Terminate this contract?",
    confirm: "Terminate contract",
    busy: "Terminating…",
    keep: "Keep contract",
    done: "Contract terminated",
    failed: "Could not terminate the contract",
    tone: "danger",
  },
};

function actionDescription(action: ContractAction, contract: SupplierContract): string {
  if (action === "ACTIVATE") {
    return `${contract.contractNumber} with ${contract.supplierName} will become active for its term.`;
  }

  return `${contract.contractNumber} with ${contract.supplierName} will be terminated.`;
}

function complianceTone(status: string): BadgeTone {
  if (status === "VALID") {
    return "success";
  }

  if (status === "EXPIRING_SOON") {
    return "warning";
  }

  if (status === "EXPIRED") {
    return "danger";
  }

  return toneFor(status);
}

/** Share of the contract term already elapsed, derived from the API's days-until-expiry. */
function termProgress(contract: SupplierContract): number | null {
  const start = Date.parse(`${contract.startDate}T00:00:00`);
  const end = Date.parse(`${contract.endDate}T00:00:00`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  const total = Math.round((end - start) / DAY_MS);

  if (total <= 0) {
    return null;
  }

  const left = Math.max(0, Math.min(total, contract.daysUntilExpiry));

  return ((total - left) / total) * 100;
}

const DOCUMENT_COLUMNS: Column<ComplianceDocument>[] = [
  {
    id: "document",
    header: "Document",
    sortValue: (document) => document.documentName.toLowerCase(),
    cell: (document) => <strong>{document.documentName}</strong>,
  },
  {
    id: "type",
    header: "Type",
    sortValue: (document) => document.documentType.toLowerCase(),
    cell: (document) => document.documentType,
  },
  {
    id: "reference",
    header: "Reference",
    sortValue: (document) => (document.documentReference ?? "").toLowerCase(),
    cell: (document) =>
      document.documentReference ?? <span className="kit-text-muted">—</span>,
  },
  {
    id: "required",
    header: "Required",
    sortValue: (document) => (document.required ? 0 : 1),
    cell: (document) =>
      document.required ? "Yes" : <span className="kit-text-muted">No</span>,
  },
  {
    id: "expiry",
    header: "Expiry",
    sortValue: (document) => document.expiryDate ?? null,
    cell: (document) =>
      document.expiryDate ? (
        formatDate(document.expiryDate)
      ) : (
        <span className="kit-text-muted">No expiry</span>
      ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (document) => DOCUMENT_STATUS_RANK[document.status] ?? 5,
    cell: (document) => (
      <StatusBadge value={document.status} tone={complianceTone(document.status)} />
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Agreement form                                                      */
/* ------------------------------------------------------------------ */

type FormField =
  | "title"
  | "contractType"
  | "currency"
  | "startDate"
  | "endDate"
  | "value"
  | "notice";

type FormErrors = Partial<Record<FormField, string>>;

interface ContractFormProps {
  contract: SupplierContract;
  onSaved: (updated: SupplierContract) => void;
}

function ContractForm({ contract, onSaved }: ContractFormProps) {
  const toast = useToast();

  const [title, setTitle] = useState(contract.title);
  const [contractType, setContractType] = useState(contract.contractType);
  const [startDate, setStartDate] = useState(contract.startDate);
  const [endDate, setEndDate] = useState(contract.endDate);
  const [currency, setCurrency] = useState(contract.currency);
  const [value, setValue] = useState(String(contract.contractValue));
  const [notice, setNotice] = useState(String(contract.noticePeriodDays));
  const [autoRenew, setAutoRenew] = useState(contract.autoRenew);
  const [notes, setNotes] = useState(contract.notes ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    title.trim() !== contract.title ||
    contractType.trim() !== contract.contractType ||
    startDate !== contract.startDate ||
    endDate !== contract.endDate ||
    currency.trim().toUpperCase() !== contract.currency ||
    Number(value) !== contract.contractValue ||
    Number(notice) !== contract.noticePeriodDays ||
    autoRenew !== contract.autoRenew ||
    notes.trim() !== (contract.notes ?? "").trim();

  function clearError(field: FormField) {
    setErrors((current) => {
      const next = { ...current };

      delete next[field];

      return next;
    });
  }

  function reset() {
    setTitle(contract.title);
    setContractType(contract.contractType);
    setStartDate(contract.startDate);
    setEndDate(contract.endDate);
    setCurrency(contract.currency);
    setValue(String(contract.contractValue));
    setNotice(String(contract.noticePeriodDays));
    setAutoRenew(contract.autoRenew);
    setNotes(contract.notes ?? "");
    setErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const valueNumber = Number(value);
    const noticeNumber = Number(notice);
    const next: FormErrors = {};

    if (!title.trim()) {
      next.title = "Enter a contract title.";
    }

    if (!contractType.trim()) {
      next.contractType = "Enter a contract type.";
    }

    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      next.currency = "Use a 3-letter currency code.";
    }

    if (!startDate) {
      next.startDate = "Choose a start date.";
    }

    if (!endDate) {
      next.endDate = "Choose an end date.";
    } else if (startDate && endDate < startDate) {
      next.endDate = "The end date cannot be before the start date.";
    }

    if (value.trim() === "" || !Number.isFinite(valueNumber) || valueNumber < 0) {
      next.value = "Enter a value of 0 or more.";
    }

    if (notice.trim() === "" || !Number.isInteger(noticeNumber) || noticeNumber < 0) {
      next.notice = "Enter whole days (0 or more).";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const updated = await updateContract(contract.id, {
        title: title.trim(),
        contractType: contractType.trim(),
        startDate,
        endDate,
        currency: currency.trim().toUpperCase(),
        contractValue: valueNumber,
        autoRenew,
        noticePeriodDays: noticeNumber,
        notes: notes.trim() || undefined,
      });

      onSaved(updated);

      toast.success("Contract saved", updated.contractNumber);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to update contract.";

      setFormError(message);
      toast.error("Could not save the contract", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div className="panel__header">
        <div>
          <span className="eyebrow">Contract administration</span>

          <h2>Agreement details</h2>
        </div>
      </div>

      <div className="kit-pair-grid">
        <div className="kit-pair-wide">
          <Field label="Title" htmlFor="contract-title" error={errors.title}>
            <input
              id="contract-title"
              className="kit-field-input"
              maxLength={200}
              value={title}
              aria-invalid={errors.title ? true : undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                clearError("title");
              }}
            />
          </Field>
        </div>

        <Field label="Type" htmlFor="contract-type" error={errors.contractType}>
          <input
            id="contract-type"
            className="kit-field-input"
            maxLength={100}
            value={contractType}
            aria-invalid={errors.contractType ? true : undefined}
            onChange={(event) => {
              setContractType(event.target.value);
              clearError("contractType");
            }}
          />
        </Field>

        <Field label="Currency" htmlFor="contract-currency" error={errors.currency}>
          <input
            id="contract-currency"
            className="kit-field-input"
            maxLength={3}
            value={currency}
            aria-invalid={errors.currency ? true : undefined}
            onChange={(event) => {
              setCurrency(event.target.value.toUpperCase());
              clearError("currency");
            }}
          />
        </Field>

        <Field label="Start date" htmlFor="contract-start" error={errors.startDate}>
          <input
            id="contract-start"
            className="kit-field-input"
            type="date"
            value={startDate}
            aria-invalid={errors.startDate ? true : undefined}
            onChange={(event) => {
              setStartDate(event.target.value);
              clearError("startDate");
              clearError("endDate");
            }}
          />
        </Field>

        <Field label="End date" htmlFor="contract-end" error={errors.endDate}>
          <input
            id="contract-end"
            className="kit-field-input"
            type="date"
            value={endDate}
            aria-invalid={errors.endDate ? true : undefined}
            onChange={(event) => {
              setEndDate(event.target.value);
              clearError("endDate");
            }}
          />
        </Field>

        <Field label="Value" htmlFor="contract-value" error={errors.value}>
          <input
            id="contract-value"
            className="kit-field-input"
            type="number"
            min="0"
            step="0.01"
            value={value}
            aria-invalid={errors.value ? true : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              clearError("value");
            }}
          />
        </Field>

        <Field label="Notice days" htmlFor="contract-notice" error={errors.notice}>
          <input
            id="contract-notice"
            className="kit-field-input"
            type="number"
            min="0"
            step="1"
            value={notice}
            aria-invalid={errors.notice ? true : undefined}
            onChange={(event) => {
              setNotice(event.target.value);
              clearError("notice");
            }}
          />
        </Field>

        <div style={{ alignSelf: "end" }}>
          <label className="kit-check">
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(event) => setAutoRenew(event.target.checked)}
            />

            <span>Auto-renewal</span>
          </label>
        </div>

        <div className="kit-pair-wide">
          <Field label="Notes" htmlFor="contract-notes">
            <textarea
              id="contract-notes"
              className="kit-field-input"
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      </div>

      {formError ? (
        <div className="error-banner" role="alert" style={{ marginTop: 16 }}>
          <CircleAlert size={18} />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="kit-form-footer">
        {dirty ? <span className="kit-form-state">Unsaved changes</span> : null}

        {dirty ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={reset}
            disabled={saving}
          >
            Discard changes
          </button>
        ) : null}

        <button type="submit" className="button button--primary" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save contract"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Add compliance document                                             */
/* ------------------------------------------------------------------ */

interface AddDocumentModalProps {
  contract: SupplierContract;
  onClose: () => void;
  onSaved: (name: string) => void;
}

function AddDocumentModal({ contract, onClose, onSaved }: AddDocumentModalProps) {
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [documentName, setDocumentName] = useState("");
  const [documentReference, setDocumentReference] = useState("");
  const [required, setRequired] = useState(true);
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [documentNotes, setDocumentNotes] = useState("");
  const [errors, setErrors] = useState<{ type?: string; name?: string; expiry?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const next: { type?: string; name?: string; expiry?: string } = {};

    if (!documentType.trim()) {
      next.type = "Enter a document type.";
    }

    if (!documentName.trim()) {
      next.name = "Enter a document name.";
    }

    if (issueDate && expiryDate && expiryDate < issueDate) {
      next.expiry = "The expiry date cannot be before the issue date.";
    }

    setErrors(next);

    if (next.type || next.name || next.expiry) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createComplianceDocument(contract.supplierId, {
        contractId: contract.id,
        documentType: documentType.trim(),
        documentName: documentName.trim(),
        documentReference: documentReference.trim() || undefined,
        required,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: documentNotes.trim() || undefined,
      });

      onSaved(documentName.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to add compliance document.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Compliance register"
      title="Add compliance document"
      description={`Registered against ${contract.supplierName} and linked to ${contract.contractNumber}.`}
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
            form="contract-document-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add document"}
          </button>
        </>
      }
    >
      <form id="contract-document-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field label="Type" htmlFor="document-type" error={errors.type}>
            <input
              id="document-type"
              className="kit-field-input"
              list="contract-document-types"
              maxLength={120}
              value={documentType}
              aria-invalid={errors.type ? true : undefined}
              onChange={(event) => {
                setDocumentType(event.target.value);
                setErrors((current) => ({ ...current, type: undefined }));
              }}
            />

            <datalist id="contract-document-types">
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </Field>

          <Field label="Name" htmlFor="document-name" error={errors.name}>
            <input
              id="document-name"
              className="kit-field-input"
              maxLength={200}
              placeholder="2026 liability insurance"
              value={documentName}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => {
                setDocumentName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
            />
          </Field>

          <Field label="Reference" htmlFor="document-reference">
            <input
              id="document-reference"
              className="kit-field-input"
              maxLength={200}
              value={documentReference}
              onChange={(event) => setDocumentReference(event.target.value)}
            />
          </Field>

          <div style={{ alignSelf: "end" }}>
            <label className="kit-check">
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
              />

              <span>Required document</span>
            </label>
          </div>

          <Field label="Issue date" htmlFor="document-issue">
            <input
              id="document-issue"
              className="kit-field-input"
              type="date"
              value={issueDate}
              onChange={(event) => {
                setIssueDate(event.target.value);
                setErrors((current) => ({ ...current, expiry: undefined }));
              }}
            />
          </Field>

          <Field label="Expiry date" htmlFor="document-expiry" error={errors.expiry}>
            <input
              id="document-expiry"
              className="kit-field-input"
              type="date"
              value={expiryDate}
              aria-invalid={errors.expiry ? true : undefined}
              onChange={(event) => {
                setExpiryDate(event.target.value);
                setErrors((current) => ({ ...current, expiry: undefined }));
              }}
            />
          </Field>

          <div className="kit-pair-wide">
            <Field label="Document notes" htmlFor="document-notes">
              <textarea
                id="document-notes"
                className="kit-field-input"
                rows={3}
                maxLength={2000}
                value={documentNotes}
                onChange={(event) => setDocumentNotes(event.target.value)}
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

interface ContractData {
  id: string;
  contract: SupplierContract;
  compliance: SupplierCompliance;
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canTerminate = user !== null && TERMINATE_ROLES.includes(user.role);

  const [result, setResult] = useState<ContractData | null>(null);
  const [pendingAction, setPendingAction] = useState<ContractAction | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [adding, setAdding] = useState(false);
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
        const loaded = await getContract(id);
        const loadedCompliance = await getSupplierCompliance(loaded.supplierId);

        if (active) {
          setResult({ id, contract: loaded, compliance: loadedCompliance });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load contract.",
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
  const contract = data?.contract ?? null;
  const compliance = data?.compliance ?? null;

  async function confirmAction() {
    if (!contract || pendingAction === null) {
      return;
    }

    const action = pendingAction;

    setActionRunning(true);

    try {
      const updated =
        action === "ACTIVATE"
          ? await activateContract(contract.id)
          : await terminateContract(contract.id);

      setResult((current) => (current ? { ...current, contract: updated } : current));
      setPendingAction(null);

      toast.success(ACTIONS[action].done, updated.contractNumber);
    } catch (caught) {
      setPendingAction(null);

      toast.error(
        ACTIONS[action].failed,
        caught instanceof Error ? caught.message : "Unable to update contract status.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  function handleSaved(updated: SupplierContract) {
    setResult((current) => (current ? { ...current, contract: updated } : current));
  }

  function handleDocumentSaved(name: string) {
    setAdding(false);
    toast.success("Document added", name);
    setReloadKey((key) => key + 1);
  }

  if (contract === null || compliance === null) {
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
        <Link href="/contracts" className="request-back-link">
          <ArrowLeft size={16} />
          Contracts
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

  const expired = contract.daysUntilExpiry < 0;
  const inNotice =
    contract.status === "ACTIVE" &&
    !expired &&
    contract.daysUntilExpiry <= contract.noticePeriodDays;
  const pastEnd = contract.status === "ACTIVE" && expired;
  const progress =
    contract.status === "ACTIVE" || contract.status === "EXPIRED"
      ? termProgress(contract)
      : null;
  const complianceGap =
    compliance.expiredDocuments > 0 ||
    compliance.validRequiredDocuments < compliance.requiredDocuments;
  const score = compliance.complianceScore;

  const kpis: KpiItem[] = [
    {
      label: "Term",
      icon: CalendarDays,
      value: formatDate(contract.startDate),
      note: `to ${formatDate(contract.endDate)}`,
    },
    {
      label: "Contract value",
      icon: FileCheck2,
      value: formatMoney(contract.contractValue, contract.currency, true),
      note: contract.autoRenew ? "Auto-renewal" : "Manual renewal",
    },
    {
      label: "Expiry",
      icon: AlertTriangle,
      value: expired ? "Expired" : `${contract.daysUntilExpiry} days`,
      note: `${contract.noticePeriodDays}-day notice`,
      tone: expired || inNotice ? "warning" : "default",
    },
    {
      label: "Compliance score",
      icon: ShieldCheck,
      value: `${score.toFixed(1)}%`,
      note: `${compliance.requiredDocuments} required docs`,
      tone: compliance.expiredDocuments > 0 ? "warning" : "default",
    },
  ];

  const stats: StatItem[] = [
    { label: "Compliance", value: `${score.toFixed(1)}%` },
    {
      label: "Valid required",
      value: `${compliance.validRequiredDocuments} / ${compliance.requiredDocuments}`,
    },
    { label: "Expiring soon", value: String(compliance.expiringSoonDocuments) },
    {
      label: "Expired",
      value: String(compliance.expiredDocuments),
      tone: compliance.expiredDocuments > 0 ? "danger" : "default",
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/contracts" className="request-back-link">
        <ArrowLeft size={16} />
        Contracts
      </Link>

      <section className="contract-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>{contract.contractNumber}</span>

            <StatusBadge value={contract.status} />
          </div>

          <h1>{contract.title}</h1>

          <p>
            <Link href={`/suppliers/${contract.supplierId}`} className="contract-table-link">
              {contract.supplierName}
            </Link>

            {" · "}
            {contract.contractType}
          </p>
        </div>

        <div className="contract-detail-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          {canTerminate && contract.status !== "TERMINATED" ? (
            <button
              type="button"
              className="button button--secondary request-cancel-button"
              disabled={actionRunning}
              onClick={() => setPendingAction("TERMINATE")}
            >
              <XCircle size={16} />
              Terminate
            </button>
          ) : null}

          {canManage && contract.status === "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={actionRunning}
              onClick={() => setPendingAction("ACTIVATE")}
            >
              <CheckCircle2 size={16} />
              Activate contract
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

      {pastEnd ? (
        <div className="kit-callout kit-callout--danger" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Past its end date.</strong> This contract ended on{" "}
            {formatDate(contract.endDate)} but is still marked active. Extend the end date or
            terminate it.
          </div>
        </div>
      ) : null}

      {inNotice ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>Notice window open.</strong> This contract ends in{" "}
            {contract.daysUntilExpiry} {contract.daysUntilExpiry === 1 ? "day" : "days"}, inside
            its {contract.noticePeriodDays}-day notice period.{" "}
            {contract.autoRenew
              ? "Auto-renewal is on, so review the terms before the window closes."
              : "Decide whether to renew or re-source before it lapses."}
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Contract totals" />

      {progress !== null ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Contract lifecycle</span>

              <h2>Term progress</h2>
            </div>

            <CalendarDays size={19} />
          </div>

          <div className="kit-meter-wrap">
            <Meter
              value={progress}
              max={100}
              tone={meterToneFor(expired ? "danger" : inNotice ? "warning" : "success")}
              ariaLabel="Share of the contract term elapsed"
            />
          </div>

          <p className="kit-month-summary">
            <span>
              <strong>{progress.toFixed(0)}%</strong> of the term elapsed
            </span>

            <span>
              Started <strong>{formatDate(contract.startDate)}</strong>
            </span>

            <span>
              Ends <strong>{formatDate(contract.endDate)}</strong>
            </span>
          </p>
        </section>
      ) : null}

      {canManage && contract.status !== "TERMINATED" ? (
        <ContractForm key={String(contract.id)} contract={contract} onSaved={handleSaved} />
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Supplier compliance</span>

            <h2>Compliance documents</h2>
          </div>

          {canManage ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
              Add document
            </button>
          ) : (
            <ShieldCheck size={19} />
          )}
        </div>

        <StatStrip items={stats} />

        <div className="kit-meter-wrap">
          <Meter
            value={score}
            max={100}
            tone={meterToneFor(score >= 90 ? "success" : score >= 70 ? "warning" : "danger")}
            ariaLabel="Supplier compliance score"
          />
        </div>

        <DataTable
          columns={DOCUMENT_COLUMNS}
          rows={compliance.documents}
          getRowId={(document) => String(document.id)}
          ariaLabel="Compliance documents"
          busy={fetching}
          defaultSort={{ id: "status", dir: "asc" }}
          persistKey="contract-compliance"
          empty={
            <EmptyState
              icon={ShieldAlert}
              title="No compliance documents"
              description="No compliance documents have been registered for this supplier."
              action={
                canManage ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={15} />
                    Add document
                  </button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {adding ? (
        <AddDocumentModal
          contract={contract}
          onClose={() => setAdding(false)}
          onSaved={handleDocumentSaved}
        />
      ) : null}

      {pendingAction !== null ? (
        <ActionDialog
          eyebrow={ACTIONS[pendingAction].eyebrow}
          title={ACTIONS[pendingAction].title}
          description={actionDescription(pendingAction, contract)}
          confirmLabel={ACTIONS[pendingAction].confirm}
          busyLabel={ACTIONS[pendingAction].busy}
          cancelLabel={ACTIONS[pendingAction].keep}
          tone={ACTIONS[pendingAction].tone}
          busy={actionRunning}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        >
          {pendingAction === "ACTIVATE" && complianceGap ? (
            <p className="kit-dialog-note kit-dialog-note--warning">
              Only {compliance.validRequiredDocuments} of {compliance.requiredDocuments}{" "}
              required compliance documents are currently valid.
            </p>
          ) : null}

          {pendingAction === "TERMINATE" ? (
            <p className="kit-dialog-note">
              A terminated contract cannot be reactivated from this screen.
            </p>
          ) : null}
        </ActionDialog>
      ) : null}
    </div>
  );
}
