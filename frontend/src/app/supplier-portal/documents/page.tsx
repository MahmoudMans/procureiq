"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Download,
  FileClock,
  Files,
  LogOut,
  ShieldCheck,
  Upload,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getSupplierPortalDocumentContent,
  getSupplierPortalDocumentDashboard,
  supplierPortalLogout,
  uploadSupplierPortalDocument,
} from "@/lib/api";

import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";

import type {
  SupplierComplianceItem,
  SupplierDocumentContent,
  SupplierPortalDocumentDashboard,
} from "@/types/supplier-document-vault";

function readable(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase(),
    );
}

function downloadContent(
  content:
    SupplierDocumentContent,
) {
  const binary =
    window.atob(
      content.base64Content,
    );

  const bytes =
    new Uint8Array(
      binary.length,
    );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index,
      );
  }

  const blob =
    new Blob(
      [
        bytes,
      ],
      {
        type:
          content.contentType,
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href =
    url;

  anchor.download =
    content.fileName;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url,
  );
}

export default function SupplierPortalDocumentsPage() {
  const router =
    useRouter();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      SupplierPortalDocumentDashboard |
      null
    >(null);

  const [
    files,
    setFiles,
  ] =
    useState<
      Record<
        string,
        File |
        undefined
      >
    >({});

  const [
    expiryDates,
    setExpiryDates,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  useEffect(() => {
    let active = true;

    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    getSupplierPortalDocumentDashboard(
      token,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load supplier compliance documents.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(false);
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    router,
  ]);

  async function reload() {
    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    setDashboard(
      await getSupplierPortalDocumentDashboard(
        token,
      ),
    );
  }

  async function upload(
    event:
      FormEvent<HTMLFormElement>,
    item:
      SupplierComplianceItem,
  ) {
    event.preventDefault();

    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    const file =
      files[
        item.requirementId
      ];

    if (!file) {
      setError(
        "Select a compliance document file.",
      );

      return;
    }

    if (
      item.expiryRequired
      &&
      !expiryDates[
        item.requirementId
      ]
    ) {
      setError(
        "This requirement needs an expiry date.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      const result =
        await uploadSupplierPortalDocument(
          token,
          item.requirementId,
          file,
          expiryDates[
            item.requirementId
          ]
          ||
          undefined,
        );

      setDashboard(
        result,
      );

      setFiles(
        current => ({
          ...current,
          [item.requirementId]:
            undefined,
        }),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to upload compliance document.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function download(
    versionId: string,
  ) {
    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    try {
      setError(null);

      const content =
        await getSupplierPortalDocumentContent(
          token,
          versionId,
        );

      downloadContent(
        content,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to download compliance document.",
      );
    }
  }

  async function logout() {
    const token =
      getSupplierPortalToken();

    clearSupplierPortalToken();

    if (token) {
      await supplierPortalLogout(
        token,
      )
        .catch(
          () => undefined,
        );
    }

    router.replace(
      "/supplier-portal/login",
    );
  }

  if (
    loading
    &&
    !dashboard
  ) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">
          Loading compliance documents...
        </div>
      </main>
    );
  }

  return (
    <main className="supplier-portal-shell">
      <header className="supplier-portal-header">
        <div className="supplier-portal-brand">
          <ShieldCheck
            size={25}
          />

          <div>
            <span>
              ProcureIQ
            </span>

            <strong>
              Supplier Portal
            </strong>
          </div>
        </div>

        <div className="supplier-portal-header-actions">
          <Link href="/supplier-portal/home">
            Workspaces
          </Link>

          <button
            type="button"
            onClick={
              () =>
                void logout()
            }
          >
            <LogOut
              size={15}
            />
            Sign out
          </button>
        </div>
      </header>

      <div className="supplier-portal-content">
        <Link
          href="/supplier-portal/home"
          className="supplier-portal-back-link"
        >
          <ArrowLeft
            size={15}
          />
          Supplier portal
        </Link>

        {error ? (
          <div className="portal-auth-error">
            <CircleAlert
              size={17}
            />
            {error}
          </div>
        ) : null}

        <section className="supplier-document-portal-heading">
          <div>
            <span>
              Compliance vault
            </span>

            <h1>
              Your documents
            </h1>

            <p>
              Submit required compliance
              documents, renew expiring
              evidence and review your
              complete version history.
            </p>
          </div>

          <Files
            size={30}
          />
        </section>

        <section className="supplier-document-portal-kpis">
          <article>
            <span>
              Current
            </span>

            <strong>
              {dashboard
                ?.summary
                .currentDocuments ??
                0}
            </strong>
          </article>

          <article>
            <span>
              Pending review
            </span>

            <strong>
              {dashboard
                ?.summary
                .submittedDocuments ??
                0}
            </strong>
          </article>

          <article>
            <span>
              Missing
            </span>

            <strong>
              {dashboard
                ?.summary
                .missingDocuments ??
                0}
            </strong>
          </article>

          <article>
            <span>
              Renewal / expired
            </span>

            <strong>
              {(
                dashboard
                  ?.summary
                  .renewalRequired ??
                  0
              )
              +
              (
                dashboard
                  ?.summary
                  .expiredDocuments ??
                  0
              )}
            </strong>
          </article>
        </section>

        <section className="supplier-document-gate-grid">
          <article
            className={
              dashboard
                ?.summary
                .onboardingDocumentReady
                ? "supplier-document-gate supplier-document-gate--ready"
                : "supplier-document-gate"
            }
          >
            <BadgeCheck
              size={18}
            />

            <div>
              <span>
                Onboarding documents
              </span>

              <strong>
                {dashboard
                  ?.summary
                  .onboardingDocumentReady
                  ? "Ready"
                  : "Incomplete"}
              </strong>
            </div>
          </article>

          <article
            className={
              dashboard
                ?.summary
                .sustainabilityDocumentReady
                ? "supplier-document-gate supplier-document-gate--ready"
                : "supplier-document-gate"
            }
          >
            <BadgeCheck
              size={18}
            />

            <div>
              <span>
                ESG documents
              </span>

              <strong>
                {dashboard
                  ?.summary
                  .sustainabilityDocumentReady
                  ? "Ready"
                  : "Incomplete"}
              </strong>
            </div>
          </article>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>
                Requirements
              </span>

              <h2>
                Compliance documents
              </h2>
            </div>

            <FileClock
              size={18}
            />
          </div>

          <div className="supplier-document-portal-list">
            {dashboard
              ?.documents
              .map(
                item => (
                  <article
                    key={
                      item.requirementId
                    }
                    className="supplier-document-portal-item"
                  >
                    <div className="supplier-document-portal-item-heading">
                      <div>
                        <span
                          className={
                            `document-status document-status--${item.effectiveStatus.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            item.effectiveStatus,
                          )}
                        </span>

                        <strong>
                          {item.requirementName}
                        </strong>

                        <small>
                          {item.mandatory
                            ? "Mandatory"
                            : "Optional"}
                          {item.categoryScope
                            ? ` · ${item.categoryScope}`
                            : ""}
                        </small>
                      </div>

                      <span>
                        {item.versionCount}
                        {" versions"}
                      </span>
                    </div>

                    <form
                      className="supplier-document-upload-form"
                      onSubmit={
                        event =>
                          void upload(
                            event,
                            item,
                          )
                      }
                    >
                      <label>
                        <span>
                          Document file
                        </span>

                        <input
                          required
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={
                            event =>
                              setFiles(
                                current => ({
                                  ...current,
                                  [item.requirementId]:
                                    event.target.files?.[0],
                                }),
                              )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Expiry date
                          {item.expiryRequired
                            ? " *"
                            : ""}
                        </span>

                        <input
                          type="date"
                          required={
                            item.expiryRequired
                          }
                          value={
                            expiryDates[
                              item.requirementId
                            ]
                            ??
                            ""
                          }
                          onChange={
                            event =>
                              setExpiryDates(
                                current => ({
                                  ...current,
                                  [item.requirementId]:
                                    event.target.value,
                                }),
                              )
                          }
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={
                          running
                          ||
                          !files[
                            item.requirementId
                          ]
                        }
                      >
                        <Upload
                          size={14}
                        />
                        {item.versionCount >
                        0
                          ? "Upload new version"
                          : "Submit document"}
                      </button>
                    </form>

                    {item.latestFileName ? (
                      <div className="supplier-document-latest">
                        <span>
                          Latest
                        </span>

                        <strong>
                          {item.latestFileName}
                        </strong>

                        {item.latestExpiryDate ? (
                          <small>
                            Expires
                            {" "}
                            {new Date(
                              `${item.latestExpiryDate}T00:00:00`,
                            )
                              .toLocaleDateString()}
                          </small>
                        ) : null}
                      </div>
                    ) : null}

                    {item.versions.length >
                    0 ? (
                      <details className="supplier-document-history">
                        <summary>
                          Version history
                        </summary>

                        <div>
                          {item.versions.map(
                            version => (
                              <div
                                key={version.id}
                              >
                                <div>
                                  <strong>
                                    v{version.versionNumber}
                                    {" · "}
                                    {version.originalFileName}
                                  </strong>

                                  <span>
                                    {readable(
                                      version.status,
                                    )}
                                    {" · "}
                                    {new Date(
                                      version.createdAt,
                                    )
                                      .toLocaleString()}
                                  </span>

                                  {version.reviewNote ? (
                                    <small>
                                      Review:
                                      {" "}
                                      {version.reviewNote}
                                    </small>
                                  ) : null}
                                </div>

                                <button
                                  type="button"
                                  onClick={
                                    () =>
                                      void download(
                                        version.id,
                                      )
                                  }
                                >
                                  <Download
                                    size={13}
                                  />
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      </details>
                    ) : null}
                  </article>
                ),
              )}

            {dashboard
              &&
            dashboard.documents.length ===
              0 ? (
              <div className="supplier-portal-empty">
                No compliance-document
                requirements currently
                apply to your supplier
                organization.
              </div>
            ) : null}
          </div>
        </section>

        <section className="supplier-document-security-note">
          <ShieldCheck
            size={18}
          />

          <div>
            <strong>
              Secure version history
            </strong>

            <p>
              Each submission creates a
              new immutable file version
              with a SHA-256 checksum.
              Historical versions remain
              available even after a
              replacement is submitted.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
