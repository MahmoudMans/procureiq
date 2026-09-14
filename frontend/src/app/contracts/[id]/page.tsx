"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Plus,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  activateContract,
  createComplianceDocument,
  getContract,
  getSupplierCompliance,
  terminateContract,
  updateContract,
} from "@/lib/api";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import type {
  SupplierCompliance,
  SupplierContract,
} from "@/types/contract";

export default function ContractDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    contract,
    setContract,
  ] =
    useState<
      SupplierContract |
      null
    >(null);

  const [
    compliance,
    setCompliance,
  ] =
    useState<
      SupplierCompliance |
      null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    contractType,
    setContractType,
  ] =
    useState("");

  const [
    startDate,
    setStartDate,
  ] =
    useState("");

  const [
    endDate,
    setEndDate,
  ] =
    useState("");

  const [
    currency,
    setCurrency,
  ] =
    useState("");

  const [
    contractValue,
    setContractValue,
  ] =
    useState(0);

  const [
    autoRenew,
    setAutoRenew,
  ] =
    useState(false);

  const [
    noticePeriodDays,
    setNoticePeriodDays,
  ] =
    useState(0);

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    documentType,
    setDocumentType,
  ] =
    useState(
      "Insurance Certificate",
    );

  const [
    documentName,
    setDocumentName,
  ] =
    useState("");

  const [
    documentReference,
    setDocumentReference,
  ] =
    useState("");

  const [
    documentRequired,
    setDocumentRequired,
  ] =
    useState(true);

  const [
    documentIssueDate,
    setDocumentIssueDate,
  ] =
    useState("");

  const [
    documentExpiryDate,
    setDocumentExpiryDate,
  ] =
    useState("");

  const [
    documentNotes,
    setDocumentNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    actionRunning,
    setActionRunning,
  ] =
    useState(false);

  const [
    documentSaving,
    setDocumentSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const canManage =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER";

  const canTerminate =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getContract(
      params.id,
    )
      .then(
        async response => {
          const complianceResponse =
            await getSupplierCompliance(
              response.supplierId,
            );

          if (!active) {
            return;
          }

          setContract(
            response,
          );

          setCompliance(
            complianceResponse,
          );

          setTitle(
            response.title,
          );

          setContractType(
            response.contractType,
          );

          setStartDate(
            response.startDate,
          );

          setEndDate(
            response.endDate,
          );

          setCurrency(
            response.currency,
          );

          setContractValue(
            response.contractValue,
          );

          setAutoRenew(
            response.autoRenew,
          );

          setNoticePeriodDays(
            response.noticePeriodDays,
          );

          setNotes(
            response.notes ??
            "",
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
              : "Unable to load contract.",
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
    params.id,
  ]);

  async function reloadCompliance(
    supplierId: string,
  ) {
    setCompliance(
      await getSupplierCompliance(
        supplierId,
      ),
    );
  }

  async function handleSave(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!contract) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const updated =
        await updateContract(
          contract.id,
          {
            title:
              title.trim(),
            contractType:
              contractType.trim(),
            startDate,
            endDate,
            currency:
              currency
                .trim()
                .toUpperCase(),
            contractValue,
            autoRenew,
            noticePeriodDays,
            notes:
              notes.trim() ||
              undefined,
          },
        );

      setContract(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update contract.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    action:
      "ACTIVATE" |
      "TERMINATE",
  ) {
    if (!contract) {
      return;
    }

    try {
      setActionRunning(true);
      setError(null);

      const updated =
        action === "ACTIVATE"
          ? await activateContract(
              contract.id,
            )
          : await terminateContract(
              contract.id,
            );

      setContract(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update contract status.",
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function handleDocumentSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!contract) {
      return;
    }

    try {
      setDocumentSaving(true);
      setError(null);

      await createComplianceDocument(
        contract.supplierId,
        {
          contractId:
            contract.id,
          documentType:
            documentType.trim(),
          documentName:
            documentName.trim(),
          documentReference:
            documentReference
              .trim() ||
            undefined,
          required:
            documentRequired,
          issueDate:
            documentIssueDate ||
            undefined,
          expiryDate:
            documentExpiryDate ||
            undefined,
          notes:
            documentNotes
              .trim() ||
            undefined,
        },
      );

      setDocumentName("");
      setDocumentReference("");
      setDocumentIssueDate("");
      setDocumentExpiryDate("");
      setDocumentNotes("");

      await reloadCompliance(
        contract.supplierId,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add compliance document.",
      );
    } finally {
      setDocumentSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className={
          "request-detail-loading"
        }
      >
        Loading contract...
      </div>
    );
  }

  if (!contract) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href="/contracts"
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />

          Contracts
        </Link>

        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error ??
            "Contract not found."}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <Link
        href="/contracts"
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Contracts
      </Link>

      <section
        className={
          "contract-detail-heading"
        }
      >
        <div>
          <div
            className={
              "request-detail-heading__meta"
            }
          >
            <span>
              {
                contract
                  .contractNumber
              }
            </span>

            <span
              className={
                `contract-status contract-status--${
                  contract.status
                    .toLowerCase()
                }`
              }
            >
              {
                contract.status
              }
            </span>
          </div>

          <h1>
            {contract.title}
          </h1>

          <p>
            <Link
              href={
                `/suppliers/${contract.supplierId}`
              }
              className={
                "contract-table-link"
              }
            >
              {
                contract
                  .supplierName
              }
            </Link>

            {" · "}
            {
              contract
                .contractType
            }
          </p>
        </div>

        <div
          className={
            "contract-detail-actions"
          }
        >
          {canTerminate &&
          contract.status !==
            "TERMINATED" ? (
            <button
              type="button"
              className={
                "button button--secondary"
              }
              disabled={
                actionRunning
              }
              onClick={
                () =>
                  void runAction(
                    "TERMINATE",
                  )
              }
            >
              <XCircle
                size={16}
              />

              Terminate
            </button>
          ) : null}

          {canManage &&
          contract.status ===
            "DRAFT" ? (
            <button
              type="button"
              className={
                "button button--primary"
              }
              disabled={
                actionRunning
              }
              onClick={
                () =>
                  void runAction(
                    "ACTIVATE",
                  )
              }
            >
              <CheckCircle2
                size={16}
              />

              Activate contract
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section
        className={
          "contract-detail-kpis"
        }
      >
        <article
          className={
            "request-detail-summary-card"
          }
        >
          <CalendarDays
            size={18}
          />

          <div>
            <span>Term</span>

            <strong>
              {
                new Date(
                  `${contract.startDate}T00:00:00`,
                )
                  .toLocaleDateString()
              }
            </strong>

            <small>
              {"to "}
              {
                new Date(
                  `${contract.endDate}T00:00:00`,
                )
                  .toLocaleDateString()
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <FileCheck2
            size={18}
          />

          <div>
            <span>
              Contract value
            </span>

            <strong>
              {
                new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        contract.currency,
                    },
                  )
                  .format(
                    contract
                      .contractValue,
                  )
              }
            </strong>

            <small>
              {
                contract
                  .autoRenew
                  ? "Auto-renewal"
                  : "Manual renewal"
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <AlertTriangle
            size={18}
          />

          <div>
            <span>
              Expiry
            </span>

            <strong>
              {contract.daysUntilExpiry <
              0
                ? "Expired"
                : `${contract.daysUntilExpiry} days`}
            </strong>

            <small>
              {
                contract
                  .noticePeriodDays
              }
              {"-day notice"}
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <ShieldCheck
            size={18}
          />

          <div>
            <span>
              Compliance score
            </span>

            <strong>
              {
                compliance
                  ?.complianceScore
                  .toFixed(1) ??
                "—"
              }
              %
            </strong>

            <small>
              {
                compliance
                  ?.requiredDocuments ??
                0
              }
              {" required docs"}
            </small>
          </div>
        </article>
      </section>

      {canManage &&
      contract.status !==
        "TERMINATED" ? (
        <form
          className={
            "panel"
          }
          onSubmit={
            handleSave
          }
        >
          <div
            className={
              "panel__header"
            }
          >
            <div>
              <span
                className={
                  "eyebrow"
                }
              >
                Contract administration
              </span>

              <h2>
                Agreement details
              </h2>
            </div>
          </div>

          <div
            className={
              "contract-form-grid"
            }
          >
            <label
              className={
                "request-field contract-form-wide"
              }
            >
              <span>Title</span>

              <input
                required
                maxLength={200}
                value={title}
                onChange={
                  event =>
                    setTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Type</span>

              <input
                required
                maxLength={100}
                value={
                  contractType
                }
                onChange={
                  event =>
                    setContractType(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Currency</span>

              <input
                required
                maxLength={3}
                value={currency}
                onChange={
                  event =>
                    setCurrency(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Start date
              </span>

              <input
                required
                type="date"
                value={startDate}
                onChange={
                  event =>
                    setStartDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                End date
              </span>

              <input
                required
                type="date"
                value={endDate}
                onChange={
                  event =>
                    setEndDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Value</span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={
                  contractValue
                }
                onChange={
                  event =>
                    setContractValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Notice days
              </span>

              <input
                required
                type="number"
                min="0"
                value={
                  noticePeriodDays
                }
                onChange={
                  event =>
                    setNoticePeriodDays(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label
              className={
                "contract-checkbox"
              }
            >
              <input
                type="checkbox"
                checked={
                  autoRenew
                }
                onChange={
                  event =>
                    setAutoRenew(
                      event.target.checked,
                    )
                }
              />

              <span>
                Auto-renewal
              </span>
            </label>

            <label
              className={
                "request-field contract-form-wide"
              }
            >
              <span>Notes</span>

              <textarea
                rows={4}
                maxLength={2000}
                value={notes}
                onChange={
                  event =>
                    setNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "contract-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save contract"}
            </button>
          </div>
        </form>
      ) : null}

      <section
        className={
          "panel"
        }
      >
        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Supplier compliance
            </span>

            <h2>
              Compliance documents
            </h2>
          </div>

          <ShieldCheck
            size={19}
          />
        </div>

        {compliance ? (
          <div
            className={
              "compliance-summary-grid"
            }
          >
            <div>
              <span>
                Compliance
              </span>

              <strong>
                {
                  compliance
                    .complianceScore
                    .toFixed(1)
                }
                %
              </strong>
            </div>

            <div>
              <span>Valid</span>

              <strong>
                {
                  compliance
                    .validRequiredDocuments
                }
                {" / "}
                {
                  compliance
                    .requiredDocuments
                }
              </strong>
            </div>

            <div>
              <span>
                Expiring soon
              </span>

              <strong>
                {
                  compliance
                    .expiringSoonDocuments
                }
              </strong>
            </div>

            <div>
              <span>Expired</span>

              <strong>
                {
                  compliance
                    .expiredDocuments
                }
              </strong>
            </div>
          </div>
        ) : null}

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table"
            }
          >
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Required</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {compliance
                ?.documents
                .map(
                  document => (
                    <tr
                      key={
                        document.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            document
                              .documentName
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          document
                            .documentType
                        }
                      </td>

                      <td>
                        {
                          document
                            .documentReference ??
                          "—"
                        }
                      </td>

                      <td>
                        {
                          document.required
                            ? "Yes"
                            : "No"
                        }
                      </td>

                      <td>
                        {document.expiryDate
                          ? new Date(
                              `${document.expiryDate}T00:00:00`,
                            )
                              .toLocaleDateString()
                          : "No expiry"}
                      </td>

                      <td>
                        <span
                          className={
                            `compliance-status compliance-status--${
                              document.status
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            document.status
                              .replaceAll(
                                "_",
                                " ",
                              )
                          }
                        </span>
                      </td>
                    </tr>
                  ),
                )}

              {(
                compliance
                  ?.documents
                  .length ??
                0
              ) === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={
                      "table-empty-state"
                    }
                  >
                    No compliance
                    documents have
                    been registered.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <form
          className={
            "panel"
          }
          onSubmit={
            handleDocumentSubmit
          }
        >
          <div
            className={
              "panel__header"
            }
          >
            <div>
              <span
                className={
                  "eyebrow"
                }
              >
                Compliance register
              </span>

              <h2>
                Add document
              </h2>
            </div>

            <Plus size={19} />
          </div>

          <div
            className={
              "contract-form-grid"
            }
          >
            <label
              className={
                "request-field"
              }
            >
              <span>Type</span>

              <input
                required
                maxLength={120}
                value={
                  documentType
                }
                onChange={
                  event =>
                    setDocumentType(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Name</span>

              <input
                required
                maxLength={200}
                value={
                  documentName
                }
                placeholder={
                  "2026 liability insurance"
                }
                onChange={
                  event =>
                    setDocumentName(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>Reference</span>

              <input
                maxLength={200}
                value={
                  documentReference
                }
                onChange={
                  event =>
                    setDocumentReference(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "contract-checkbox"
              }
            >
              <input
                type="checkbox"
                checked={
                  documentRequired
                }
                onChange={
                  event =>
                    setDocumentRequired(
                      event.target.checked,
                    )
                }
              />

              <span>
                Required document
              </span>
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Issue date
              </span>

              <input
                type="date"
                value={
                  documentIssueDate
                }
                onChange={
                  event =>
                    setDocumentIssueDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field"
              }
            >
              <span>
                Expiry date
              </span>

              <input
                type="date"
                value={
                  documentExpiryDate
                }
                onChange={
                  event =>
                    setDocumentExpiryDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field contract-form-wide"
              }
            >
              <span>
                Document notes
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={
                  documentNotes
                }
                onChange={
                  event =>
                    setDocumentNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "contract-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={
                documentSaving
              }
            >
              <Plus size={16} />

              {documentSaving
                ? "Adding..."
                : "Add compliance document"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
