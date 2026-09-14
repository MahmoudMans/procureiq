"use client";

import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CircleAlert,
  FileText,
  LockKeyhole,
  Send,
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
  RfqForm,
} from "@/components/rfqs/rfq-form";

import {
  cancelRfq,
  closeRfq,
  getRfq,
  getSuppliers,
  publishRfq,
  updateRfq,
} from "@/lib/api";

import type {
  Rfq,
  RfqUpdateInput,
} from "@/types/rfq";

import type {
  Supplier,
} from "@/types/supplier";

function toFormValue(
  rfq: Rfq,
): RfqUpdateInput {
  return {
    title:
      rfq.title,

    description:
      rfq.description ??
      "",

    responseDeadline:
      rfq.responseDeadline
        .slice(
          0,
          16,
        ),

    supplierIds:
      rfq.invitations
        .map(
          invitation =>
            invitation
              .supplierId,
        ),
  };
}

export default function RfqDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    rfq,
    setRfq,
  ] =
    useState<Rfq | null>(
      null,
    );

  const [
    suppliers,
    setSuppliers,
  ] =
    useState<Supplier[]>(
      [],
    );

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

  const allowed =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let mounted = true;

    async function load() {
      try {
        const [
          rfqResponse,
          supplierResponse,
        ] =
          await Promise.all([
            getRfq(
              params.id,
            ),

            getSuppliers({
              status:
                "ACTIVE",
            }),
          ]);

        if (!mounted) {
          return;
        }

        setRfq(
          rfqResponse,
        );

        setSuppliers(
          supplierResponse,
        );
      } catch (
        caughtError
      ) {
        if (mounted) {
          setError(
            caughtError instanceof
              Error
              ? caughtError
                  .message
              : "Unable to load RFQ.",
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
    allowed,
    params.id,
  ]);

  async function handleSave(
    value:
      RfqUpdateInput,
  ) {
    if (!rfq) {
      return;
    }

    try {
      setSaving(
        true,
      );

      setError(
        null,
      );

      const updated =
        await updateRfq(
          rfq.id,
          value,
        );

      setRfq(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to update RFQ.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function runAction(
    action:
      "PUBLISH" |
      "CLOSE" |
      "CANCEL",
  ) {
    if (!rfq) {
      return;
    }

    try {
      setActionRunning(
        true,
      );

      setError(
        null,
      );

      let updated: Rfq;

      if (
        action ===
          "PUBLISH"
      ) {
        updated =
          await publishRfq(
            rfq.id,
          );
      } else if (
        action ===
          "CLOSE"
      ) {
        updated =
          await closeRfq(
            rfq.id,
          );
      } else {
        updated =
          await cancelRfq(
            rfq.id,
          );
      }

      setRfq(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to update RFQ status.",
      );
    } finally {
      setActionRunning(
        false,
      );
    }
  }

  if (!allowed) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <div
          className={
            "error-banner"
          }
        >
          Your role cannot
          access this sourcing event.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={
          "request-detail-loading"
        }
      >
        Loading RFQ...
      </div>
    );
  }

  if (!rfq) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href="/rfqs"
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />

          RFQs & sourcing
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
            "RFQ not found."}
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
        href="/rfqs"
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        RFQs & sourcing
      </Link>

      <section
        className={
          "rfq-detail-heading"
        }
      >
        <div>
          <div
            className={
              "request-detail-heading__meta"
            }
          >
            <span>
              {rfq.rfqNumber}
            </span>

            <span
              className={
                `rfq-status rfq-status--${
                  rfq.status
                    .toLowerCase()
                }`
              }
            >
              {rfq.status}
            </span>
          </div>

          <h1>
            {rfq.title}
          </h1>

          <p>
            {rfq.description ??
              "No sourcing instructions have been provided."}
          </p>
        </div>

        <div
          className={
            "rfq-detail-actions"
          }
        >
          {rfq.status ===
            "DRAFT" ? (
            <>
              <button
                type="button"
                className={
                  "button button--secondary request-cancel-button"
                }
                disabled={
                  actionRunning
                }
                onClick={
                  () =>
                    void runAction(
                      "CANCEL",
                    )
                }
              >
                <Ban size={16} />
                Cancel
              </button>

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
                      "PUBLISH",
                    )
                }
              >
                <Send size={16} />

                Publish RFQ
              </button>
            </>
          ) : null}

          {rfq.status ===
            "PUBLISHED" ? (
            <>
              <button
                type="button"
                className={
                  "button button--secondary request-cancel-button"
                }
                disabled={
                  actionRunning
                }
                onClick={
                  () =>
                    void runAction(
                      "CANCEL",
                    )
                }
              >
                <Ban size={16} />
                Cancel
              </button>

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
                      "CLOSE",
                    )
                }
              >
                <LockKeyhole
                  size={16}
                />
                Close RFQ
              </button>
            </>
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
          "rfq-detail-summary-grid"
        }
      >
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
              Source request
            </span>

            <strong>
              {
                rfq
                  .purchaseRequestNumber
              }
            </strong>

            <small>
              {
                rfq
                  .purchaseRequestTitle
              }
            </small>
          </div>
        </article>

        <article
          className={
            "request-detail-summary-card"
          }
        >
          <Building2
            size={18}
          />

          <div>
            <span>
              Suppliers invited
            </span>

            <strong>
              {
                rfq
                  .invitations
                  .length
              }
            </strong>

            <small>
              {
                rfq
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
              Response deadline
            </span>

            <strong>
              {
                new Date(
                  rfq
                    .responseDeadline,
                )
                  .toLocaleDateString()
              }
            </strong>

            <small>
              {
                new Date(
                  rfq
                    .responseDeadline,
                )
                  .toLocaleTimeString(
                    [],
                    {
                      hour:
                        "2-digit",
                      minute:
                        "2-digit",
                    },
                  )
              }
            </small>
          </div>
        </article>
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
              Approved requirement
            </span>

            <h2>
              RFQ line items
            </h2>
          </div>

          <strong
            className={
              "rfq-approved-value"
            }
          >
            {
              new Intl
                .NumberFormat(
                  "en-US",
                  {
                    style:
                      "currency",
                    currency:
                      rfq.currency,
                  },
                )
                .format(
                  rfq
                    .purchaseRequestValue,
                )
            }
          </strong>
        </div>

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
                  Quantity
                </th>

                <th>
                  Unit
                </th>
              </tr>
            </thead>

            <tbody>
              {rfq.lineItems.map(
                line => (
                  <tr
                    key={
                      line.id ??
                      line.lineNumber
                    }
                  >
                    <td>
                      {
                        line
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
                            line
                              .itemName
                          }
                        </strong>

                        <span>
                          {
                            line
                              .description ??
                            "No description"
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      {
                        line.category
                      }
                    </td>

                    <td>
                      {
                        line.quantity
                      }
                    </td>

                    <td>
                      {
                        line.unit
                      }
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {rfq.status ===
        "DRAFT" ? (
        <RfqForm
          key={
            rfq.version
          }
          suppliers={
            suppliers
          }
          initialValue={
            toFormValue(
              rfq,
            )
          }
          submitting={
            saving
          }
          submitLabel={
            "Save RFQ draft"
          }
          error={null}
          onSubmit={
            handleSave
          }
        />
      ) : (
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
                Supplier competition
              </span>

              <h2>
                Invited suppliers
              </h2>
            </div>
          </div>

          <div
            className={
              "rfq-invitation-list"
            }
          >
            {rfq.invitations.map(
              invitation => (
                <article
                  key={
                    invitation.id ??
                    invitation
                      .supplierId
                  }
                  className={
                    "rfq-invitation-card"
                  }
                >
                  <div
                    className={
                      "rfq-invitation-card__icon"
                    }
                  >
                    <Building2
                      size={18}
                    />
                  </div>

                  <div
                    className={
                      "rfq-invitation-card__content"
                    }
                  >
                    <strong>
                      {
                        invitation
                          .supplierName
                      }
                    </strong>

                    <span>
                      {
                        invitation
                          .supplierCode
                      }
                      {" · "}
                      {
                        invitation
                          .country
                      }
                    </span>

                    <small>
                      {
                        invitation
                          .category
                      }
                    </small>
                  </div>

                  <span
                    className={
                      `rfq-invitation-status rfq-invitation-status--${
                        invitation
                          .status
                          .toLowerCase()
                      }`
                    }
                  >
                    {
                      invitation
                        .status
                    }
                  </span>
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
