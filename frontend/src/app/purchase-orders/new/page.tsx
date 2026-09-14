"use client";

import {
  ArrowLeft,
  Award,
  CircleAlert,
  PackageOpen,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
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
  createPurchaseOrder,
  getAwardDecision,
  getRfqs,
} from "@/lib/api";

import type {
  AwardDecision,
} from "@/types/evaluation";

import type {
  Rfq,
} from "@/types/rfq";

function defaultDeliveryDate():
string {
  const date =
    new Date();

  date.setDate(
    date.getDate() + 21,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function NewPurchaseOrderPage() {
  const router =
    useRouter();

  const {
    user,
  } = useAuth();

  const [
    awardedRfqs,
    setAwardedRfqs,
  ] =
    useState<Rfq[]>(
      [],
    );

  const [
    selectedRfqId,
    setSelectedRfqId,
  ] =
    useState("");

  const [
    award,
    setAward,
  ] =
    useState<
      AwardDecision |
      undefined
    >(undefined);

  const [
    expectedDeliveryDate,
    setExpectedDeliveryDate,
  ] =
    useState(
      defaultDeliveryDate(),
    );

  const [
    deliveryAddress,
    setDeliveryAddress,
  ] =
    useState("");

  const [
    buyerNotes,
    setBuyerNotes,
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

    let active = true;

    getRfqs({
      status:
        "AWARDED",
    })
      .then(
        response => {
          if (!active) {
            return;
          }

          setAwardedRfqs(
            response,
          );

          if (
            response.length >
            0
          ) {
            setSelectedRfqId(
              response[0].id,
            );
          }

          setError(
            null,
          );
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
              ? caughtError
                  .message
              : "Unable to load awarded RFQs.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(
              false,
            );
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    allowed,
  ]);

  useEffect(() => {
    if (!selectedRfqId) {
      return;
    }

    let active = true;

    getAwardDecision(
      selectedRfqId,
    )
      .then(
        response => {
          if (active) {
            setAward(
              response,
            );
          }
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
              ? caughtError
                  .message
              : "Unable to load award decision.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, [
    selectedRfqId,
  ]);

  const selectedRfq =
    useMemo(
      () =>
        awardedRfqs.find(
          rfq =>
            rfq.id ===
            selectedRfqId,
        ) ??
        null,
      [
        awardedRfqs,
        selectedRfqId,
      ],
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedRfqId) {
      return;
    }

    try {
      setSaving(
        true,
      );

      setError(
        null,
      );

      const created =
        await createPurchaseOrder({
          rfqId:
            selectedRfqId,

          expectedDeliveryDate,

          deliveryAddress:
            deliveryAddress
              .trim(),

          buyerNotes:
            buyerNotes
              .trim() ||
            undefined,
        });

      router.push(
        `/purchase-orders/${created.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to create purchase order.",
      );
    } finally {
      setSaving(
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
          Your role cannot create
          purchase orders.
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
          "/purchase-orders"
        }
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Purchase orders
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
            Award-to-order
          </span>

          <h1>
            Create purchase order
          </h1>

          <p>
            Convert a completed sourcing
            award into an operational
            supplier commitment.
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
              Awarded sourcing
            </span>

            <h2>
              Source award
            </h2>
          </div>
        </div>

        {loading ? (
          <div
            className={
              "po-empty-state"
            }
          >
            Loading awarded
            sourcing events...
          </div>
        ) : awardedRfqs.length ===
          0 ? (
          <div
            className={
              "po-empty-state"
            }
          >
            <Award
              size={28}
            />

            <strong>
              No awarded RFQs
              available
            </strong>

            <span>
              Complete supplier
              evaluation and award
              before creating a PO.
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
                Awarded RFQ
              </span>

              <select
                value={
                  selectedRfqId
                }
                onChange={
                  event =>
                    setSelectedRfqId(
                      event
                        .target
                        .value,
                    )
                }
              >
                {awardedRfqs.map(
                  rfq => (
                    <option
                      key={
                        rfq.id
                      }
                      value={
                        rfq.id
                      }
                    >
                      {
                        rfq.rfqNumber
                      }
                      {" — "}
                      {
                        rfq.title
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            {selectedRfq ? (
              <div
                className={
                  "po-award-preview"
                }
              >
                <div>
                  <span>
                    RFQ
                  </span>

                  <strong>
                    {
                      selectedRfq
                        .rfqNumber
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Awarded supplier
                  </span>

                  <strong>
                    {
                      award
                        ?.selectedSupplierName ??
                      "Loading..."
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Award value
                  </span>

                  <strong>
                    {
                      award
                        ? new Intl
                            .NumberFormat(
                              "en-US",
                              {
                                style:
                                  "currency",
                                currency:
                                  selectedRfq
                                    .currency,
                              },
                            )
                            .format(
                              award
                                .selectedTotalAmount,
                            )
                        : "—"
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Decision
                  </span>

                  <strong>
                    {
                      award
                        ?.manualOverride
                        ? "Manual override"
                        : "Recommended award"
                    }
                  </strong>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {!loading &&
      awardedRfqs.length > 0 ? (
        <form
          className={
            "panel"
          }
          onSubmit={
            handleSubmit
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
                Order logistics
              </span>

              <h2>
                Delivery instructions
              </h2>
            </div>

            <PackageOpen
              size={19}
            />
          </div>

          <div
            className={
              "po-form-grid"
            }
          >
            <label
              className={
                "request-field"
              }
            >
              <span>
                Expected delivery
              </span>

              <input
                required
                type="date"
                value={
                  expectedDeliveryDate
                }
                onChange={
                  event =>
                    setExpectedDeliveryDate(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field po-form-wide"
              }
            >
              <span>
                Delivery address
              </span>

              <textarea
                required
                rows={4}
                maxLength={1000}
                value={
                  deliveryAddress
                }
                placeholder={
                  "Enter the complete delivery location and receiving instructions."
                }
                onChange={
                  event =>
                    setDeliveryAddress(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field po-form-wide"
              }
            >
              <span>
                Buyer notes
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={
                  buyerNotes
                }
                placeholder={
                  "Optional internal or supplier-facing order notes."
                }
                onChange={
                  event =>
                    setBuyerNotes(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "po-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={
                saving ||
                !selectedRfqId ||
                !deliveryAddress
                  .trim()
              }
            >
              <PackageOpen
                size={16}
              />

              {saving
                ? "Creating..."
                : "Create PO draft"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
