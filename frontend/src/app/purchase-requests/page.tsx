"use client";

import {
  Banknote,
  CircleAlert,
  ClipboardList,
  FileClock,
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
  getPurchaseRequests,
  getPurchaseRequestSummary,
} from "@/lib/api";

import type {
  PurchaseRequest,
  PurchaseRequestStatus,
  PurchaseRequestSummary,
} from "@/types/purchase-request";

const moneyFormatter =
  new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  );

function statusLabel(
  status: PurchaseRequestStatus,
): string {
  return status
    .replaceAll(
      "_",
      " ",
    );
}

export default function PurchaseRequestsPage() {
  const {
    user,
  } = useAuth();

  const [
    requests,
    setRequests,
  ] =
    useState<PurchaseRequest[]>(
      [],
    );

  const [
    summary,
    setSummary,
  ] =
    useState<
      PurchaseRequestSummary |
      null
    >(null);

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

  const canCreate =
    user !== null &&
    [
      "ADMIN",
      "PROCUREMENT_MANAGER",
      "BUYER",
      "REQUESTER",
    ].includes(
      user.role,
    );

  useEffect(() => {
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
              requestResponse,
              summaryResponse,
            ] =
              await Promise.all([
                getPurchaseRequests({
                  query:
                    query ||
                    undefined,

                  status:
                    (
                      status as
                        PurchaseRequestStatus
                    ) ||
                    undefined,
                }),

                getPurchaseRequestSummary(),
              ]);

            if (!mounted) {
              return;
            }

            setRequests(
              requestResponse,
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
                : "Unable to load purchase requests.",
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
    query,
    status,
  ]);

  return (
    <div className="page-stack">

      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span className="eyebrow">
            Procure-to-request
          </span>

          <h1>
            Purchase requests
          </h1>

          <p>
            Capture purchasing demand,
            estimate cost and submit
            requirements into the
            ProcureIQ governance flow.
          </p>
        </div>

        {canCreate ? (
          <Link
            href={
              "/purchase-requests/new"
            }
            className={
              "button button--primary"
            }
          >
            <Plus size={17} />
            New request
          </Link>
        ) : null}
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
          "request-kpi-grid"
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
              <ClipboardList
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Total requests
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.totalRequests ??
              "—"}
          </strong>

          <p>
            Requests visible to your
            ProcureIQ role.
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
              <FileClock
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Draft requests
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.draftRequests ??
              "—"}
          </strong>

          <p>
            Requirements still being
            prepared.
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
            Submitted
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {summary
              ?.submittedRequests ??
              "—"}
          </strong>

          <p>
            Requests awaiting the next
            governance stage.
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
            Submitted value
          </span>

          <strong
            className={
              "kpi-card__value request-value"
            }
          >
            {
              summary
                ? moneyFormatter
                    .format(
                      summary
                        .totalSubmittedValue,
                    )
                : "—"
            }
          </strong>

          <p>
            Submitted and approved
            estimated request value.
          </p>
        </article>
      </section>

      <section
        className={
          "request-toolbar"
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
              "Search number, title, description or cost center"
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

            <option value="SUBMITTED">
              Submitted
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="REJECTED">
              Rejected
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </section>

      <section
        className={
          "panel request-list-panel"
        }
      >
        <div
          className={
            "supplier-panel__summary"
          }
        >
          <div>
            <ClipboardList
              size={18}
            />

            <span>
              {loading
                ? "Loading purchase requests..."
                : `${
                    requests.length
                  } requests found`}
            </span>
          </div>

          <span>
            ProcureIQ purchase demand
          </span>
        </div>

        <div
          className={
            "table-scroll"
          }
        >
          <table
            className={
              "data-table request-table"
            }
          >
            <thead>
              <tr>
                <th>
                  Request
                </th>

                <th>
                  Requester
                </th>

                <th>
                  Department
                </th>

                <th>
                  Cost center
                </th>

                <th>
                  Delivery
                </th>

                <th>
                  Status
                </th>

                <th>
                  Amount
                </th>

                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                requests.map(
                  request => (
                    <tr
                      key={
                        request.id
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
                              request
                                .title
                            }
                          </strong>

                          <span>
                            {
                              request
                                .requestNumber
                            }
                            {" · "}
                            {
                              request
                                .items
                                .length
                            }
                            {" line"}
                            {
                              request
                                .items
                                .length === 1
                                ? ""
                                : "s"
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          request
                            .requesterName
                        }
                      </td>

                      <td>
                        {
                          request
                            .departmentName
                        }
                      </td>

                      <td>
                        {
                          request
                            .costCenter
                        }
                      </td>

                      <td>
                        {
                          new Date(
                            `${request.desiredDeliveryDate}T00:00:00`,
                          )
                            .toLocaleDateString()
                        }
                      </td>

                      <td>
                        <span
                          className={
                            `request-status request-status--${
                              request
                                .status
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            statusLabel(
                              request
                                .status,
                            )
                          }
                        </span>
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
                                maximumFractionDigits:
                                  0,
                              },
                            ).format(
                              request
                                .estimatedTotalAmount,
                            )
                          }
                        </strong>
                      </td>

                      <td>
                        <Link
                          href={
                            `/purchase-requests/${request.id}`
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
              requests.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={8}
                      className={
                        "table-empty-state"
                      }
                    >
                      No purchase requests
                      match the current
                      filters.
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
