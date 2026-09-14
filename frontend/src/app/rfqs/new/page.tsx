"use client";

import {
  ArrowLeft,
  CircleAlert,
  ClipboardCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  RfqForm,
} from "@/components/rfqs/rfq-form";

import {
  createRfq,
  getPurchaseRequests,
  getSuppliers,
} from "@/lib/api";

import type {
  PurchaseRequest,
} from "@/types/purchase-request";

import type {
  RfqUpdateInput,
} from "@/types/rfq";

import type {
  Supplier,
} from "@/types/supplier";

function defaultDeadline():
string {
  const date =
    new Date();

  date.setDate(
    date.getDate() + 7,
  );

  date.setHours(
    17,
    0,
    0,
    0,
  );

  const pad =
    (value: number) =>
      String(value)
        .padStart(
          2,
          "0",
        );

  return `${
    date.getFullYear()
  }-${
    pad(
      date.getMonth() + 1,
    )
  }-${
    pad(
      date.getDate(),
    )
  }T${
    pad(
      date.getHours(),
    )
  }:${
    pad(
      date.getMinutes(),
    )
  }`;
}

export default function NewRfqPage() {
  const router =
    useRouter();

  const {
    user,
  } = useAuth();

  const [
    requests,
    setRequests,
  ] =
    useState<
      PurchaseRequest[]
    >([]);

  const [
    suppliers,
    setSuppliers,
  ] =
    useState<Supplier[]>(
      [],
    );

  const [
    purchaseRequestId,
    setPurchaseRequestId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
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
          approvedRequests,
          activeSuppliers,
        ] =
          await Promise.all([
            getPurchaseRequests({
              status:
                "APPROVED",
            }),

            getSuppliers({
              status:
                "ACTIVE",
            }),
          ]);

        if (!mounted) {
          return;
        }

        setRequests(
          approvedRequests,
        );

        setSuppliers(
          activeSuppliers,
        );

        if (
          approvedRequests
            .length > 0
        ) {
          setPurchaseRequestId(
            approvedRequests[0]
              .id,
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
              : "Unable to load sourcing data.",
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
  ]);

  const selectedRequest =
    useMemo(
      () =>
        requests.find(
          request =>
            request.id ===
            purchaseRequestId,
        ) ??
        null,
      [
        requests,
        purchaseRequestId,
      ],
    );

  const initialValue:
  RfqUpdateInput = {
    title:
      selectedRequest
        ? `${selectedRequest.title} — Supplier RFQ`
        : "",

    description:
      selectedRequest
        ? `Competitive sourcing event for approved request ${selectedRequest.requestNumber}.`
        : "",

    responseDeadline:
      defaultDeadline(),

    supplierIds: [],
  };

  async function handleSubmit(
    value:
      RfqUpdateInput,
  ) {
    if (
      !purchaseRequestId
    ) {
      setError(
        "Select an approved purchase request.",
      );

      return;
    }

    try {
      setSubmitting(
        true,
      );

      setError(
        null,
      );

      const created =
        await createRfq({
          purchaseRequestId,
          ...value,
        });

      router.push(
        `/rfqs/${created.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to create RFQ.",
      );
    } finally {
      setSubmitting(
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
          <CircleAlert
            size={18}
          />

          Your role cannot
          create RFQs.
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
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            New sourcing event
          </span>

          <h1>
            Create RFQ
          </h1>

          <p>
            Select an approved purchase
            request, invite suppliers and
            prepare the sourcing event
            before publication.
          </p>
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
              Approved demand
            </span>

            <h2>
              Source purchase request
            </h2>
          </div>
        </div>

        {loading ? (
          <div
            className={
              "rfq-empty-state"
            }
          >
            Loading approved
            purchase requests...
          </div>
        ) : requests.length ===
          0 ? (
          <div
            className={
              "rfq-empty-state"
            }
          >
            <ClipboardCheck
              size={28}
            />

            <strong>
              No approved requests
              available
            </strong>

            <span>
              A purchase request must be
              approved before sourcing
              can begin.
            </span>
          </div>
        ) : (
          <>
            <label
              className={
                "request-field"
              }
            >
              <span>
                Approved purchase request
              </span>

              <select
                value={
                  purchaseRequestId
                }
                onChange={
                  event =>
                    setPurchaseRequestId(
                      event
                        .target
                        .value,
                    )
                }
              >
                {requests.map(
                  request => (
                    <option
                      key={
                        request.id
                      }
                      value={
                        request.id
                      }
                    >
                      {
                        request
                          .requestNumber
                      }
                      {" — "}
                      {
                        request
                          .title
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            {selectedRequest ? (
              <div
                className={
                  "rfq-source-preview"
                }
              >
                <div>
                  <span>
                    Request
                  </span>

                  <strong>
                    {
                      selectedRequest
                        .requestNumber
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Department
                  </span>

                  <strong>
                    {
                      selectedRequest
                        .departmentName
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Lines
                  </span>

                  <strong>
                    {
                      selectedRequest
                        .items
                        .length
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Approved value
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
                              selectedRequest
                                .currency,
                          },
                        )
                        .format(
                          selectedRequest
                            .estimatedTotalAmount,
                        )
                    }
                  </strong>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {!loading &&
      requests.length > 0 ? (
        <RfqForm
          key={
            purchaseRequestId
          }
          suppliers={
            suppliers
          }
          initialValue={
            initialValue
          }
          submitting={
            submitting
          }
          submitLabel={
            "Create RFQ draft"
          }
          error={null}
          onSubmit={
            handleSubmit
          }
        />
      ) : null}
    </div>
  );
}
