"use client";

import "@/app/supplier-portal/portal-extras.css";

import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Download,
  FileClock,
  Files,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { PortalHeader } from "@/components/supplier-portal/portal-header";
import {
  getSupplierPortalDocumentContent,
  getSupplierPortalDocumentDashboard,
  uploadSupplierPortalDocument,
} from "@/lib/api";
import {
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";
import type {
  SupplierComplianceItem,
  SupplierDocumentContent,
  SupplierPortalDocumentDashboard,
} from "@/types/supplier-document-vault";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "docx"];

const ATTENTION_STATUSES = new Set([
  "MISSING",
  "REJECTED",
  "EXPIRED",
  "RENEWAL_REQUIRED",
  "EXPIRING_SOON",
  "CHANGES_REQUESTED",
]);

function readable(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasAllowedExtension(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  return ALLOWED_EXTENSIONS.includes(extension);
}

function needsAction(item: SupplierComplianceItem): boolean {
  return (
    ATTENTION_STATUSES.has(item.effectiveStatus) ||
    (item.mandatory && item.versionCount === 0)
  );
}

interface ExpiryNote {
  text: string;
  late: boolean;
}

function expiryNote(date: string, now: number | null): ExpiryNote | null {
  if (now === null) {
    return null;
  }

  const target = new Date(`${date}T00:00:00`).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  const days = Math.ceil((target - now) / 86400000);

  if (days < 0) {
    return {
      text: `Expired ${-days} ${-days === 1 ? "day" : "days"} ago`,
      late: true,
    };
  }

  if (days === 0) {
    return { text: "Expires today", late: false };
  }

  if (days <= 30) {
    return { text: `Expires in ${days} ${days === 1 ? "day" : "days"}`, late: false };
  }

  return null;
}

function downloadContent(content: SupplierDocumentContent) {
  const binary = window.atob(content.base64Content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: content.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = content.fileName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

interface Feedback {
  /** null = page level, otherwise the requirement id the message belongs to. */
  scope: string | null;
  tone: "error" | "success";
  message: string;
}

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  return feedback.tone === "error" ? (
    <div className="portal-auth-error" role="alert">
      <CircleAlert size={17} />
      {feedback.message}
    </div>
  ) : (
    <div className="portal-notice" role="status">
      <CheckCircle2 size={17} />
      {feedback.message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SupplierPortalDocumentsPage() {
  const router = useRouter();

  const [dashboard, setDashboard] = useState<SupplierPortalDocumentDashboard | null>(null);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [resets, setResets] = useState<Record<string, number>>({});
  const [view, setView] = useState<"ALL" | "ACTION">("ALL");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await getSupplierPortalDocumentDashboard(token);

        if (active) {
          setDashboard(response);
          setLoadError(null);
        }
      } catch (caught) {
        if (active) {
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Unable to load supplier compliance documents.",
          );
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [router, reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);

    return () => window.clearTimeout(timer);
  }, [dashboard]);

  async function upload(event: FormEvent<HTMLFormElement>, item: SupplierComplianceItem) {
    event.preventDefault();

    if (uploadingId !== null) {
      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    const id = item.requirementId;
    const file = files[id];

    if (!file) {
      setFeedback({ scope: id, tone: "error", message: "Select a compliance document file." });

      return;
    }

    if (!hasAllowedExtension(file.name)) {
      setFeedback({
        scope: id,
        tone: "error",
        message: "Upload a PDF, PNG, JPG or DOCX file.",
      });

      return;
    }

    if (item.expiryRequired && !expiryDates[id]) {
      setFeedback({
        scope: id,
        tone: "error",
        message: "This requirement needs an expiry date.",
      });

      return;
    }

    setUploadingId(id);
    setFeedback(null);

    try {
      const result = await uploadSupplierPortalDocument(
        token,
        id,
        file,
        expiryDates[id] || undefined,
      );

      setDashboard(result);
      setFiles((current) => ({ ...current, [id]: undefined }));
      setExpiryDates((current) => ({ ...current, [id]: "" }));
      setResets((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));

      setFeedback({
        scope: id,
        tone: "success",
        message: `“${item.requirementName}” was submitted for review.`,
      });
    } catch (caught) {
      setFeedback({
        scope: id,
        tone: "error",
        message:
          caught instanceof Error ? caught.message : "Unable to upload compliance document.",
      });
    } finally {
      setUploadingId(null);
    }
  }

  async function download(versionId: string, requirementId: string) {
    if (downloadingId !== null) {
      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      router.replace("/supplier-portal/login");

      return;
    }

    setDownloadingId(versionId);
    setFeedback(null);

    try {
      const content = await getSupplierPortalDocumentContent(token, versionId);

      downloadContent(content);
    } catch (caught) {
      setFeedback({
        scope: requirementId,
        tone: "error",
        message:
          caught instanceof Error ? caught.message : "Unable to download compliance document.",
      });
    } finally {
      setDownloadingId(null);
    }
  }

  if (dashboard === null && loadError === null) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">Loading compliance documents...</div>
      </main>
    );
  }

  const documents = dashboard
    ? [...dashboard.documents].sort((a, b) => {
        const left = needsAction(a) ? 0 : 1;
        const right = needsAction(b) ? 0 : 1;

        if (left !== right) {
          return left - right;
        }

        if (a.mandatory !== b.mandatory) {
          return a.mandatory ? -1 : 1;
        }

        return a.requirementName.localeCompare(b.requirementName);
      })
    : [];

  const actionCount = documents.filter(needsAction).length;
  const visible = view === "ACTION" ? documents.filter(needsAction) : documents;
  const pageFeedback = feedback !== null && feedback.scope === null ? feedback : null;

  return (
    <main className="supplier-portal-shell">
      <PortalHeader />

      <div className="supplier-portal-content">
        <Link href="/supplier-portal/home" className="supplier-portal-back-link">
          <ArrowLeft size={15} />
          Supplier portal
        </Link>

        {loadError ? (
          <div className="portal-auth-error" role="alert">
            <CircleAlert size={17} />

            {loadError}

            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        ) : null}

        {pageFeedback ? <FeedbackBanner feedback={pageFeedback} /> : null}

        <section className="supplier-document-portal-heading">
          <div>
            <span>Compliance vault</span>

            <h1>Your documents</h1>

            <p>
              Submit required compliance documents, renew expiring evidence and review your
              complete version history.
            </p>
          </div>

          <Files size={30} />
        </section>

        <section className="supplier-document-portal-kpis">
          <article>
            <span>Current</span>

            <strong>{dashboard?.summary.currentDocuments ?? 0}</strong>
          </article>

          <article>
            <span>Pending review</span>

            <strong>{dashboard?.summary.submittedDocuments ?? 0}</strong>
          </article>

          <article>
            <span>Missing</span>

            <strong>{dashboard?.summary.missingDocuments ?? 0}</strong>
          </article>

          <article>
            <span>Renewal / expired</span>

            <strong>
              {(dashboard?.summary.renewalRequired ?? 0) +
                (dashboard?.summary.expiredDocuments ?? 0)}
            </strong>
          </article>
        </section>

        <section className="supplier-document-gate-grid">
          <article
            className={
              dashboard?.summary.onboardingDocumentReady
                ? "supplier-document-gate supplier-document-gate--ready"
                : "supplier-document-gate"
            }
          >
            <BadgeCheck size={18} />

            <div>
              <span>Onboarding documents</span>

              <strong>
                {dashboard?.summary.onboardingDocumentReady ? "Ready" : "Incomplete"}
              </strong>
            </div>
          </article>

          <article
            className={
              dashboard?.summary.sustainabilityDocumentReady
                ? "supplier-document-gate supplier-document-gate--ready"
                : "supplier-document-gate"
            }
          >
            <BadgeCheck size={18} />

            <div>
              <span>ESG documents</span>

              <strong>
                {dashboard?.summary.sustainabilityDocumentReady ? "Ready" : "Incomplete"}
              </strong>
            </div>
          </article>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>Requirements</span>

              <h2>Compliance documents</h2>
            </div>

            <FileClock size={18} />
          </div>

          {documents.length > 0 ? (
            <div className="portal-panel-tools">
              <div className="portal-filter" role="group" aria-label="Filter requirements">
                <button
                  type="button"
                  aria-pressed={view === "ALL"}
                  onClick={() => setView("ALL")}
                >
                  All · {documents.length}
                </button>

                <button
                  type="button"
                  aria-pressed={view === "ACTION"}
                  onClick={() => setView("ACTION")}
                >
                  Needs action · {actionCount}
                </button>
              </div>
            </div>
          ) : null}

          <div className="supplier-document-portal-list">
            {visible.map((item) => {
              const id = item.requirementId;
              const uploading = uploadingId === id;
              const itemFeedback =
                feedback !== null && feedback.scope === id ? feedback : null;
              const expiry = item.latestExpiryDate
                ? expiryNote(item.latestExpiryDate, now)
                : null;

              return (
                <article key={id} className="supplier-document-portal-item">
                  <div className="supplier-document-portal-item-heading">
                    <div>
                      <span
                        className={`document-status document-status--${item.effectiveStatus
                          .toLowerCase()
                          .replaceAll("_", "-")}`}
                      >
                        {readable(item.effectiveStatus)}
                      </span>

                      <strong>{item.requirementName}</strong>

                      <small>
                        {item.mandatory ? "Mandatory" : "Optional"}
                        {item.categoryScope ? ` · ${item.categoryScope}` : ""}
                      </small>
                    </div>

                    <span>
                      {item.versionCount} {item.versionCount === 1 ? "version" : "versions"}
                    </span>
                  </div>

                  <form
                    key={`${id}-${resets[id] ?? 0}`}
                    className="supplier-document-upload-form"
                    onSubmit={(event) => void upload(event, item)}
                  >
                    <label>
                      <span>Document file</span>

                      <input
                        required
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => {
                          const selected = event.target.files?.[0];

                          setFiles((current) => ({ ...current, [id]: selected }));
                        }}
                      />
                    </label>

                    <label>
                      <span>
                        Expiry date
                        {item.expiryRequired ? " *" : ""}
                      </span>

                      <input
                        type="date"
                        required={item.expiryRequired}
                        value={expiryDates[id] ?? ""}
                        onChange={(event) =>
                          setExpiryDates((current) => ({
                            ...current,
                            [id]: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <button type="submit" disabled={uploadingId !== null || !files[id]}>
                      <Upload size={14} />

                      {uploading
                        ? "Uploading…"
                        : item.versionCount > 0
                          ? "Upload new version"
                          : "Submit document"}
                    </button>
                  </form>

                  <small className="portal-form-hint">
                    Accepted formats: PDF, PNG, JPG or DOCX.
                  </small>

                  {itemFeedback ? (
                    <div className="portal-item-feedback">
                      <FeedbackBanner feedback={itemFeedback} />
                    </div>
                  ) : null}

                  {item.latestFileName ? (
                    <div className="supplier-document-latest">
                      <span>Latest</span>

                      <strong>{item.latestFileName}</strong>

                      {item.latestExpiryDate ? (
                        <small>
                          Expires{" "}
                          {new Date(`${item.latestExpiryDate}T00:00:00`).toLocaleDateString()}
                        </small>
                      ) : null}

                      {expiry ? (
                        <span
                          className={
                            expiry.late
                              ? "portal-expiry-flag portal-expiry-flag--late"
                              : "portal-expiry-flag"
                          }
                        >
                          {expiry.text}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {item.versions.length > 0 ? (
                    <details className="supplier-document-history">
                      <summary>Version history</summary>

                      <div>
                        {item.versions.map((version) => (
                          <div key={version.id}>
                            <div>
                              <strong>
                                v{version.versionNumber}
                                {" · "}
                                {version.originalFileName}
                              </strong>

                              <span>
                                {readable(version.status)}
                                {" · "}
                                {new Date(version.createdAt).toLocaleString()}
                              </span>

                              {version.reviewNote ? (
                                <small>Review: {version.reviewNote}</small>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              aria-label={`Download version ${version.versionNumber}`}
                              title="Download this version"
                              disabled={downloadingId !== null}
                              onClick={() => void download(version.id, id)}
                            >
                              <Download size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}

            {dashboard && documents.length === 0 ? (
              <div className="supplier-portal-empty">
                No compliance-document requirements currently apply to your supplier
                organization.
              </div>
            ) : null}

            {dashboard && documents.length > 0 && visible.length === 0 ? (
              <div className="supplier-portal-empty">
                Nothing needs your attention right now.
              </div>
            ) : null}
          </div>
        </section>

        <section className="supplier-document-security-note">
          <ShieldCheck size={18} />

          <div>
            <strong>Secure version history</strong>

            <p>
              Each submission creates a new immutable file version with a SHA-256 checksum.
              Historical versions remain available even after a replacement is submitted.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
