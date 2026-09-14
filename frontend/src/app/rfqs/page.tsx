"use client";

import {
  Banknote,
  Building2,
  CircleAlert,
  FileClock,
  FileText,
  Plus,
  Search,
  Send,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getRfqs,
  getRfqSummary,
} from "@/lib/api";

import type {
  Rfq,
  RfqStatus,
  RfqSummary,
} from "@/types/rfq";

function statusLabel(
  status: RfqStatus,
): string {
  return status.replaceAll(
    "_",
    " ",
  );
}

export default function RfqsPage() {
  const {
    user,
  } = useAuth();

  const [
    rfqs,
    setRfqs,
  ] =
    useState<Rfq[]>([]);

  const [
    summary,
    setSummary,
  ] =
    useState<RfqSummary | null>(
      null,
    );

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    status,
    setStatus,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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

    const timeout =
      window.setTimeout(
        async () => {
          try {
            setLoading(
              true,
            );

            setError(
              null,
            );

            const [
              rfqResponse,
              summaryResponse,
            ] =
              await Promise.all([
                getRfqs({
                  query:
                    query ||
                    undefined,

                  status:
                    (
                      status as
                        RfqStatus
                    ) ||
                    undefined,
                }),

                getRfqSummary(),
              ]);

            if (!mounted) {
              return;
            }

            setRfqs(
              rfqResponse,
            );

            setSummary(
              summaryResponse,
            );
          } catch (
            caughtError
          ) {
            if (!mounted) {
              return;
            }

            setError(
              caughtError instanceof
                Error
                ? caughtError
                    .message
                : "Unable to load RFQs.",
            );
          } finally {
            if (mounted) {
              setLoading(
                false,
              );
            }
          }
        },
        180,
      );

    return () => {
      mounted = false;

      window.clearTimeout(
        timeout,
      );
    };
  }, [
    allowed,
    query,
    status,
  ]);

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
          <CircleAlert
            size={18}
          />

          Your ProcureIQ role
          cannot access strategic
          sourcing.
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
      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Strategic sourcing
          </span>

          <h1>
            RFQs & sourcing
          </h1>

          <p>
            Convert approved purchasing
            demand into competitive
            sourcing events and invite
            qualified suppliers.
          </p>
        </div>

        <Link
          href="/rfqs/new"
          className={
            "button button--primary"
          }
        >
          <Plus size={17} />
          New RFQ
        </Link>
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
          "rfq-kpi-grid"
        }
      >
        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <FileText
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Total RFQs
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.totalRfqs ??
              "—"}
          </strong>

          <p>
            Sourcing events managed
            by ProcureIQ.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Send size={20} />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Published
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.publishedRfqs ??
              "—"}
          </strong>

          <p>
            RFQs currently open
            for supplier responses.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Building2
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Supplier invitations
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.invitedSuppliers ??
              "—"}
          </strong>

          <p>
            Competitive supplier
            invitations across RFQs.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Banknote
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Active sourcing value
          </span>

          <strong
            className={
              "kpi-card__value rfq-value"
            }
          >
            {summary
              ? new Intl
                  .NumberFormat(
                    "en-US",
                    {
                      style:
                        "currency",
                      currency:
                        "EUR",
                      notation:
                        "compact",
                      maximumFractionDigits:
                        1,
                    },
                  )
                  .format(
                    summary
                      .activeSourcingValue,
                  )
              : "—"}
          </strong>

          <p>
            Approved demand currently
            in active sourcing.
          </p>
        </article>
      </section>

      <section
        className={
          "rfq-toolbar"
        }
      >
        <div
          className={
            "supplier-toolbar__search"
          }
        >
          <Search size={18} />

          <input
            value={query}
            onChange={
              event =>
                setQuery(
                  event
                    .target
                    .value,
                )
            }
            placeholder={
              "Search RFQ number, title or purchase request"
            }
          />
        </div>

        <div
          className={
            "select-wrapper"
          }
        >
          <select
            value={status}
            onChange={
              event =>
                setStatus(
                  event
                    .target
                    .value,
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="PUBLISHED">
              Published
            </option>

            <option value="CLOSED">
              Closed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </section>

      <section
        className={
          "panel rfq-list-panel"
        }
      >
        <div
          className={
            "supplier-panel__summary"
          }
        >
          <div>
            <FileClock
              size={18}
            />

            <span>
              {loading
                ? "Loading sourcing events..."
                : `${
                    rfqs.length
                  } RFQs found`}
            </span>
          </div>

          <span>
            Strategic sourcing workspace
          </span>
        </div>

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table rfq-table"
            }
          >
            <thead>
              <tr>
                <th>
                  RFQ
                </th>

                <th>
                  Source request
                </th>

                <th>
                  Suppliers
                </th>

                <th>
                  Deadline
                </th>

                <th>
                  Value
                </th>

                <th>
                  Status
                </th>

                <th>
                  Owner
                </th>

                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                rfqs.map(
                  rfq => (
                    <tr
                      key={
                        rfq.id
                      }
                    >
                      <td>
                        <div
                          className={
                            "request-primary-cell"
                          }
                        >
                          <strong>
                            {
                              rfq.title
                            }
                          </strong>

                          <span>
                            {
                              rfq.rfqNumber
                            }
                            {" · "}
                            {
                              rfq.lineItems
                                .length
                            }
                            {" lines"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div
                          className={
                            "rfq-source-cell"
                          }
                        >
                          <strong>
                            {
                              rfq.purchaseRequestNumber
                            }
                          </strong>

                          <span>
                            {
                              rfq.departmentName
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          rfq.invitations
                            .length
                        }
                      </td>

                      <td>
                        {
                          new Date(
                            rfq.responseDeadline,
                          )
                            .toLocaleString()
                        }
                      </td>

                      <td>
                        <strong>
                          {
                            new Intl
                              .NumberFormat(
                                "en-US",
                                {
                                  style:
                                    "currency",
                                  currency:
                                    rfq.currency,
                                  maximumFractionDigits:
                                    0,
                                },
                              )
                              .format(
                                rfq.purchaseRequestValue,
                              )
                          }
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `rfq-status rfq-status--${
                              rfq.status
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            statusLabel(
                              rfq.status,
                            )
                          }
                        </span>
                      </td>

                      <td>
                        {
                          rfq.createdByName
                        }
                      </td>

                      <td>
                        <Link
                          href={
                            `/rfqs/${rfq.id}`
                          }
                          className={
                            "table-action"
                          }
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              rfqs.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={8}
                      className={
                        "table-empty-state"
                      }
                    >
                      No RFQs match
                      the current filters.
                    </td>
                  </tr>
                )
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
