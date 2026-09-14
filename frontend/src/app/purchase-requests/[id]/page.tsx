"use client";

import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CircleAlert,
  FileText,
  Send,
  UserRound,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  ApprovalHistory,
} from "@/components/purchase-requests/approval-history";

import {
  PurchaseRequestForm,
} from "@/components/purchase-requests/purchase-request-form";

import {
  cancelPurchaseRequest,
  getPurchaseRequest,
  submitPurchaseRequest,
  updatePurchaseRequest,
} from "@/lib/api";

import type {
  PurchaseRequest,
  PurchaseRequestInput,
} from "@/types/purchase-request";

function toFormValue(
  request: PurchaseRequest,
): PurchaseRequestInput {
  return {
    title:
      request.title,

    description:
      request.description ??
      "",

    businessJustification:
      request
        .businessJustification,

    costCenter:
      request.costCenter,

    currency:
      request.currency,

    desiredDeliveryDate:
      request
        .desiredDeliveryDate,

    items:
      request.items.map(
        item => ({
          itemName:
            item.itemName,

          description:
            item.description ??
            "",

          category:
            item.category,

          quantity:
            item.quantity,

          unit:
            item.unit,

          estimatedUnitPrice:
            item
              .estimatedUnitPrice,
        }),
      ),
  };
}

export default function PurchaseRequestDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    request,
    setRequest,
  ] =
    useState<
      PurchaseRequest |
      null
    >(null);

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
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response =
          await getPurchaseRequest(
            params.id,
          );

        if (mounted) {
          setRequest(
            response,
          );
        }
      } catch (
        caughtError
      ) {
        if (mounted) {
          setError(
            caughtError instanceof
              Error
              ? caughtError
                  .message
              : "Unable to load purchase request.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [
    params.id,
  ]);

  const owner =
    user !== null &&
    request !== null &&
    user.id ===
      request.requesterId;

  const manager =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  const canModify =
    request !== null &&
    (
      owner ||
      manager
    );

  const canEdit =
    canModify &&
    request?.status ===
      "DRAFT";

  const canSubmit =
    canModify &&
    request?.status ===
      "DRAFT";

  const canCancel =
    canModify &&
    (
      request?.status ===
        "DRAFT" ||
      request?.status ===
        "SUBMITTED"
    );

  async function handleSave(
    value:
      PurchaseRequestInput,
  ) {
    if (!request) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const updated =
        await updatePurchaseRequest(
          request.id,
          value,
        );

      setRequest(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save purchase request.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitRequest() {
    if (!request) {
      return;
    }

    try {
      setActionRunning(
        true,
      );

      setError(
        null,
      );

      const updated =
        await submitPurchaseRequest(
          request.id,
        );

      setRequest(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to submit purchase request.",
      );
    } finally {
      setActionRunning(
        false,
      );
    }
  }

  async function handleCancelRequest() {
    if (!request) {
      return;
    }

    try {
      setActionRunning(
        true,
      );

      setError(
        null,
      );

      const updated =
        await cancelPurchaseRequest(
          request.id,
        );

      setRequest(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel purchase request.",
      );
    } finally {
      setActionRunning(
        false,
      );
    }
  }

  if (loading) {
    return (
      <div
        className={
          "request-detail-loading"
        }
      >
        Loading purchase
        request...
      </div>
    );
  }

  if (!request) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href={
            "/purchase-requests"
          }
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />
          Purchase requests
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
            "Purchase request not found."}
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
        href={
          "/purchase-requests"
        }
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />
        Purchase requests
      </Link>

      <section
        className={
          "request-detail-heading"
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
                request
                  .requestNumber
              }
            </span>

            <span
              className={
                `request-status request-status--${
                  request.status
                    .toLowerCase()
                }`
              }
            >
              {
                request.status
              }
            </span>
          </div>

          <h1>
            {request.title}
          </h1>

          <p>
            {
              request.description ??
              "No additional request description."
            }
          </p>
        </div>

        <div
          className={
            "request-detail-actions"
          }
        >
          {canCancel ? (
            <button
              type="button"
              className={
                "button button--secondary request-cancel-button"
              }
              disabled={
                actionRunning
              }
              onClick={
                handleCancelRequest
              }
            >
              <Ban size={16} />
              Cancel request
            </button>
          ) : null}

          {canSubmit ? (
            <button
              type="button"
              className={
                "button button--primary"
              }
              disabled={
                actionRunning
              }
              onClick={
                handleSubmitRequest
              }
            >
              <Send size={16} />

              {actionRunning
                ? "Processing..."
                : "Submit request"}
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
          "request-detail-summary-grid"
        }
      >
        <article
          className={
            "request-detail-summary-card"
          }
        >
          <UserRound
            size={18}
          />

          <div>
            <span>
              Requester
            </span>

            <strong>
              {
                request
                  .requesterName
              }
            </strong>

            <small>
              {
                request
                  .departmentName
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <CalendarDays
            size={18}
          />

          <div>
            <span>
              Desired delivery
            </span>

            <strong>
              {
                new Date(
                  `${request.desiredDeliveryDate}T00:00:00`,
                )
                  .toLocaleDateString()
              }
            </strong>

            <small>
              {
                request
                  .costCenter
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <FileText
            size={18}
          />

          <div>
            <span>
              Estimated value
            </span>

            <strong>
              {
                new Intl.NumberFormat(
                  "en-US",
                  {
                    style:
                      "currency",
                    currency:
                      request.currency,
                    maximumFractionDigits:
                      2,
                  },
                ).format(
                  request
                    .estimatedTotalAmount,
                )
              }
            </strong>

            <small>
              {
                request.items
                  .length
              }
              {" line"}
              {
                request.items
                  .length === 1
                  ? ""
                  : "s"
              }
            </small>
          </div>
        </article>
      </section>

      <ApprovalHistory
        purchaseRequestId={
          request.id
        }
      />

      {canEdit ? (
        <PurchaseRequestForm
          key={
            request.version
          }
          initialValue={
            toFormValue(
              request,
            )
          }
          submitLabel={
            "Save draft"
          }
          submitting={
            saving
          }
          onSubmit={
            handleSave
          }
        />
      ) : (
        <>
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
                  Business requirement
                </span>

                <h2>
                  Request justification
                </h2>
              </div>
            </div>

            <div
              className={
                "request-readonly-copy"
              }
            >
              <p>
                {
                  request
                    .businessJustification
                }
              </p>
            </div>
          </section>

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
                  Requested goods & services
                </span>

                <h2>
                  Line items
                </h2>
              </div>
            </div>

            <div
              className={
                "table-scroll"
              }
            >
              <table
                className={
                  "data-table request-lines-table"
                }
              >
                <thead>
                  <tr>
                    <th>
                      Line
                    </th>

                    <th>
                      Item
                    </th>

                    <th>
                      Category
                    </th>

                    <th>
                      Qty
                    </th>

                    <th>
                      Unit
                    </th>

                    <th>
                      Unit price
                    </th>

                    <th>
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {
                    request
                      .items
                      .map(
                        item => (
                          <tr
                            key={
                              item.id ??
                              item.lineNumber
                            }
                          >
                            <td>
                              {
                                item
                                  .lineNumber
                              }
                            </td>

                            <td>
                              <div
                                className={
                                  "request-primary-cell"
                                }
                              >
                                <strong>
                                  {
                                    item
                                      .itemName
                                  }
                                </strong>

                                <span>
                                  {
                                    item
                                      .description ??
                                    "No description"
                                  }
                                </span>
                              </div>
                            </td>

                            <td>
                              {
                                item
                                  .category
                              }
                            </td>

                            <td>
                              {
                                item
                                  .quantity
                              }
                            </td>

                            <td>
                              {
                                item.unit
                              }
                            </td>

                            <td>
                              {
                                new Intl.NumberFormat(
                                  "en-US",
                                  {
                                    style:
                                      "currency",
                                    currency:
                                      request
                                        .currency,
                                  },
                                ).format(
                                  item
                                    .estimatedUnitPrice,
                                )
                              }
                            </td>

                            <td>
                              <strong>
                                {
                                  new Intl.NumberFormat(
                                    "en-US",
                                    {
                                      style:
                                        "currency",
                                      currency:
                                        request
                                          .currency,
                                    },
                                  ).format(
                                    item
                                      .estimatedLineTotal,
                                  )
                                }
                              </strong>
                            </td>
                          </tr>
                        ),
                      )
                  }
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
