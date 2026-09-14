"use client";

import {
  BadgeCheck,
  CircleAlert,
  Download,
  FileClock,
  FilePlus2,
  Files,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  approveSupplierDocumentVersion,
  createSupplierDocumentRequirement,
  getSupplierDocumentContent,
  getSupplierDocumentVaultDashboard,
  rejectSupplierDocumentVersion,
} from "@/lib/api";

import type {
  SupplierComplianceItem,
  SupplierDocumentContent,
  SupplierDocumentEffectiveStatus,
  SupplierDocumentType,
  SupplierDocumentVaultDashboard,
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

export default function SupplierDocumentVaultPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      SupplierDocumentVaultDashboard |
      null
    >(null);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("");

  const [
    requirementCode,
    setRequirementCode,
  ] =
    useState("");

  const [
    requirementName,
    setRequirementName,
  ] =
    useState("");

  const [
    requirementDescription,
    setRequirementDescription,
  ] =
    useState("");

  const [
    documentType,
    setDocumentType,
  ] =
    useState<SupplierDocumentType>(
      "OTHER",
    );

  const [
    categoryScope,
    setCategoryScope,
  ] =
    useState("");

  const [
    mandatory,
    setMandatory,
  ] =
    useState(true);

  const [
    expiryRequired,
    setExpiryRequired,
  ] =
    useState(true);

  const [
    renewalLeadDays,
    setRenewalLeadDays,
  ] =
    useState(30);

  const [
    onboardingRelevant,
    setOnboardingRelevant,
  ] =
    useState(false);

  const [
    sustainabilityRelevant,
    setSustainabilityRelevant,
  ] =
    useState(false);

  const [
    reviewNotes,
    setReviewNotes,
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

  const canConfigure =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  const canReview =
    canConfigure
    ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    getSupplierDocumentVaultDashboard()
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
              : "Unable to load supplier document vault.",
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
  }, []);

  async function reload() {
    setDashboard(
      await getSupplierDocumentVaultDashboard(),
    );
  }

  async function createRequirement(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createSupplierDocumentRequirement({
        requirementCode:
          requirementCode.trim(),
        name:
          requirementName.trim(),
        description:
          requirementDescription.trim(),
        documentType,
        categoryScope:
          categoryScope.trim()
          ||
          undefined,
        mandatory,
        expiryRequired,
        renewalLeadDays,
        onboardingRelevant,
        sustainabilityRelevant,
      });

      setRequirementCode("");
      setRequirementName("");
      setRequirementDescription("");
      setCategoryScope("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create document requirement.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function review(
    item:
      SupplierComplianceItem,
    action:
      "APPROVE"
      |
      "REJECT",
  ) {
    if (!item.latestVersionId) {
      return;
    }

    const note =
      reviewNotes[
        item.latestVersionId
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A document review note is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "APPROVE"
      ) {
        await approveSupplierDocumentVersion(
          item.latestVersionId,
          note,
        );
      } else {
        await rejectSupplierDocumentVersion(
          item.latestVersionId,
          note,
        );
      }

      setReviewNotes(
        current => ({
          ...current,
          [item.latestVersionId!]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to review document.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function download(
    versionId: string,
  ) {
    try {
      setError(null);

      const content =
        await getSupplierDocumentContent(
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

  const filtered =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return (
          dashboard
            ?.items
            .filter(
              item =>
                !statusFilter
                ||
                item.effectiveStatus ===
                  statusFilter,
            )
            .filter(
              item => {
                if (!normalized) {
                  return true;
                }

                return [
                  item.supplierCode,
                  item.supplierName,
                  item.supplierCategory ??
                    "",
                  item.requirementCode,
                  item.requirementName,
                ]
                  .join(
                    " ",
                  )
                  .toLowerCase()
                  .includes(
                    normalized,
                  );
              },
            )
          ??
          []
        );
      },
      [
        dashboard,
        query,
        statusFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supplier compliance
          </span>

          <h1>
            Document vault
          </h1>

          <p>
            Govern supplier compliance
            documents, immutable version
            history, expiry, renewal,
            category-specific
            requirements and onboarding /
            ESG readiness.
          </p>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="document-vault-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Missing
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .missingDocuments ??
              0}
          </strong>

          <p>
            Required documents not yet
            supplied.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Pending review
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .submittedDocuments ??
              0}
          </strong>

          <p>
            Supplier submissions awaiting
            validation.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Renewal / expired
          </span>

          <strong className="kpi-card__value">
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

          <p>
            Time-sensitive compliance
            documents.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Fully compliant suppliers
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .fullyCompliantSuppliers ??
              0}
          </strong>

          <p>
            All mandatory requirements
            currently satisfied.
          </p>
        </article>
      </section>

      <section className="document-vault-link-grid">
        <article>
          <span>
            Onboarding gaps
          </span>

          <strong>
            {dashboard
              ?.summary
              .onboardingRelevantGaps ??
              0}
          </strong>
        </article>

        <article>
          <span>
            ESG gaps
          </span>

          <strong>
            {dashboard
              ?.summary
              .sustainabilityRelevantGaps ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Rejected documents
          </span>

          <strong>
            {dashboard
              ?.summary
              .rejectedDocuments ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Compliance portfolio
            </span>

            <h2>
              Supplier documents
            </h2>
          </div>

          <Files
            size={19}
          />
        </div>

        <div className="document-vault-toolbar">
          <input
            value={query}
            placeholder={
              "Search supplier, category or requirement"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="MISSING">
              Missing
            </option>

            <option value="SUBMITTED">
              Pending review
            </option>

            <option value="VALID">
              Valid
            </option>

            <option value="RENEWAL_REQUIRED">
              Renewal required
            </option>

            <option value="EXPIRED">
              Expired
            </option>

            <option value="REJECTED">
              Rejected
            </option>
          </select>
        </div>

        <div className="document-vault-list">
          {!loading &&
            filtered.map(
              item => (
                <article
                  key={
                    `${item.supplierId}:${item.requirementId}`
                  }
                  className="document-vault-item"
                >
                  <div className="document-vault-item-heading">
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
                        {item.supplierName}
                        {" · "}
                        {item.supplierCode}
                        {" · "}
                        {item.supplierCategory ??
                          "Uncategorized"}
                      </small>
                    </div>

                    <div>
                      <span>
                        {item.mandatory
                          ? "Mandatory"
                          : "Optional"}
                      </span>

                      <strong>
                        {item.categoryScope ??
                          "All categories"}
                      </strong>
                    </div>
                  </div>

                  <div className="document-vault-meta">
                    <span>
                      Latest:
                      {" "}
                      <strong>
                        {item.latestFileName ??
                          "No submission"}
                      </strong>
                    </span>

                    <span>
                      Version:
                      {" "}
                      <strong>
                        {item.latestVersionNumber ??
                          "—"}
                      </strong>
                    </span>

                    <span>
                      Expiry:
                      {" "}
                      <strong>
                        {item.latestExpiryDate
                          ? new Date(
                              `${item.latestExpiryDate}T00:00:00`,
                            )
                              .toLocaleDateString()
                          : "—"}
                      </strong>
                    </span>

                    <span>
                      History:
                      {" "}
                      <strong>
                        {item.versionCount}
                      </strong>
                    </span>
                  </div>

                  {item.latestVersionId ? (
                    <div className="document-vault-review-row">
                      <button
                        type="button"
                        onClick={
                          () =>
                            void download(
                              item.latestVersionId!,
                            )
                        }
                      >
                        <Download
                          size={14}
                        />
                        Download
                      </button>

                      {canReview &&
                      item.effectiveStatus ===
                        "SUBMITTED" ? (
                        <>
                          <input
                            value={
                              reviewNotes[
                                item.latestVersionId
                              ]
                              ??
                              ""
                            }
                            placeholder={
                              "Review note"
                            }
                            onChange={
                              event =>
                                setReviewNotes(
                                  current => ({
                                    ...current,
                                    [item.latestVersionId!]:
                                      event.target.value,
                                  }),
                                )
                            }
                          />

                          <button
                            type="button"
                            disabled={
                              running
                              ||
                              !(
                                reviewNotes[
                                  item.latestVersionId
                                ]
                                ??
                                ""
                              )
                                .trim()
                            }
                            onClick={
                              () =>
                                void review(
                                  item,
                                  "APPROVE",
                                )
                            }
                          >
                            <BadgeCheck
                              size={14}
                            />
                            Validate
                          </button>

                          <button
                            type="button"
                            className="document-danger-button"
                            disabled={
                              running
                              ||
                              !(
                                reviewNotes[
                                  item.latestVersionId
                                ]
                                ??
                                ""
                              )
                                .trim()
                            }
                            onClick={
                              () =>
                                void review(
                                  item,
                                  "REJECT",
                                )
                            }
                          >
                            <XCircle
                              size={14}
                            />
                            Reject
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {item.versions.length >
                  0 ? (
                    <details className="document-version-history">
                      <summary>
                        Version history
                      </summary>

                      <div>
                        {item.versions.map(
                          version => (
                            <div
                              key={version.id}
                              className="document-version-row"
                            >
                              <div>
                                <strong>
                                  v{version.versionNumber}
                                  {" · "}
                                  {version.originalFileName}
                                </strong>

                                <span>
                                  {new Date(
                                    version.createdAt,
                                  )
                                    .toLocaleString()}
                                  {" · "}
                                  {Math.round(
                                    version.fileSizeBytes /
                                      1024,
                                  )}
                                  {" KB"}
                                </span>
                              </div>

                              <span>
                                {version.status}
                              </span>

                              <code>
                                {version.sha256Checksum.slice(
                                  0,
                                  16,
                                )}
                                …
                              </code>

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

          {!loading &&
          filtered.length ===
            0 ? (
            <div className="document-vault-empty">
              No compliance documents
              match the selected filters.
            </div>
          ) : null}
        </div>
      </section>

      {canConfigure ? (
        <form
          className="panel"
          onSubmit={createRequirement}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Requirement governance
              </span>

              <h2>
                Add compliance requirement
              </h2>
            </div>

            <FilePlus2
              size={19}
            />
          </div>

          <div className="document-requirement-form">
            <label className="request-field">
              <span>
                Requirement code
              </span>

              <input
                required
                value={requirementCode}
                onChange={
                  event =>
                    setRequirementCode(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Name
              </span>

              <input
                required
                value={requirementName}
                onChange={
                  event =>
                    setRequirementName(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Document type
              </span>

              <select
                value={documentType}
                onChange={
                  event =>
                    setDocumentType(
                      event.target.value as
                        SupplierDocumentType,
                    )
                }
              >
                <option value="COMPANY_REGISTRATION">
                  Company registration
                </option>

                <option value="TAX_CERTIFICATE">
                  Tax certificate
                </option>

                <option value="INSURANCE_CERTIFICATE">
                  Insurance certificate
                </option>

                <option value="BANK_INFORMATION">
                  Bank information
                </option>

                <option value="CODE_OF_CONDUCT">
                  Code of conduct
                </option>

                <option value="ESG_POLICY">
                  ESG policy
                </option>

                <option value="QUALITY_CERTIFICATE">
                  Quality certificate
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Category scope
              </span>

              <input
                value={categoryScope}
                placeholder={
                  "Blank = all categories"
                }
                onChange={
                  event =>
                    setCategoryScope(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Renewal lead days
              </span>

              <input
                type="number"
                min="0"
                max="730"
                value={renewalLeadDays}
                onChange={
                  event =>
                    setRenewalLeadDays(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="document-checkbox-field">
              <input
                type="checkbox"
                checked={mandatory}
                onChange={
                  event =>
                    setMandatory(
                      event.target.checked,
                    )
                }
              />
              Mandatory
            </label>

            <label className="document-checkbox-field">
              <input
                type="checkbox"
                checked={expiryRequired}
                onChange={
                  event =>
                    setExpiryRequired(
                      event.target.checked,
                    )
                }
              />
              Expiry required
            </label>

            <label className="document-checkbox-field">
              <input
                type="checkbox"
                checked={onboardingRelevant}
                onChange={
                  event =>
                    setOnboardingRelevant(
                      event.target.checked,
                    )
                }
              />
              Onboarding relevant
            </label>

            <label className="document-checkbox-field">
              <input
                type="checkbox"
                checked={sustainabilityRelevant}
                onChange={
                  event =>
                    setSustainabilityRelevant(
                      event.target.checked,
                    )
                }
              />
              ESG relevant
            </label>

            <label className="request-field document-form-wide">
              <span>
                Description
              </span>

              <textarea
                required
                rows={4}
                value={requirementDescription}
                onChange={
                  event =>
                    setRequirementDescription(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="document-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !requirementCode.trim()
                ||
                !requirementName.trim()
                ||
                !requirementDescription.trim()
              }
            >
              <FilePlus2
                size={16}
              />
              Add requirement
            </button>
          </div>
        </form>
      ) : null}

      <section className="document-security-note">
        <ShieldCheck
          size={18}
        />

        <div>
          <strong>
            Versioned compliance evidence
          </strong>

          <p>
            Every supplier submission is
            preserved as a separate
            version with its SHA-256
            checksum. New submissions do
            not overwrite historical
            evidence, and only the latest
            submitted version can receive
            a new review decision.
          </p>
        </div>
      </section>
    </div>
  );
}
