"use client";

import {
  ArrowRight,
  Banknote,
  Building2,
  CircleAlert,
  CircleCheck,
  Edit3,
  Plus,
  Send,
  Trophy,
  Undo2,
  X,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createQuotation,
  getQuotationComparison,
  getRfqQuotations,
  submitQuotation,
  updateQuotation,
  withdrawQuotation,
} from "@/lib/api";

import type {
  Quotation,
  QuotationCreateInput,
  QuotationUpdateInput,
} from "@/types/quotation";

import type {
  Rfq,
  RfqSupplierInvitation,
} from "@/types/rfq";

interface QuotationWorkspaceProps {
  rfq: Rfq;
}

interface EditorState {
  invitation: RfqSupplierInvitation;
  quotation: Quotation | null;
}

function futureDate(
  days: number,
): string {
  const date =
    new Date();

  date.setDate(
    date.getDate() + days,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export function QuotationWorkspace({
  rfq,
}: QuotationWorkspaceProps) {
  const [
    quotations,
    setQuotations,
  ] =
    useState<Quotation[]>(
      [],
    );

  const [
    submittedCount,
    setSubmittedCount,
  ] =
    useState(0);

  const [
    lowestTotal,
    setLowestTotal,
  ] =
    useState(0);

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

  const [
    editor,
    setEditor,
  ] =
    useState<EditorState | null>(
      null,
    );

  async function reloadQuotations() {
    try {
      const [
        quotationResponse,
        comparisonResponse,
      ] =
        await Promise.all([
          getRfqQuotations(
            rfq.id,
          ),

          getQuotationComparison(
            rfq.id,
          ),
        ]);

      setError(
        null,
      );

      setQuotations(
        quotationResponse,
      );

      setSubmittedCount(
        comparisonResponse
          .submittedQuotationCount,
      );

      setLowestTotal(
        comparisonResponse
          .lowestTotalAmount,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to load supplier quotations.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      getRfqQuotations(
        rfq.id,
      ),

      getQuotationComparison(
        rfq.id,
      ),
    ])
      .then(
        ([
          quotationResponse,
          comparisonResponse,
        ]) => {
          if (!active) {
            return;
          }

          setError(
            null,
          );

          setQuotations(
            quotationResponse,
          );

          setSubmittedCount(
            comparisonResponse
              .submittedQuotationCount,
          );

          setLowestTotal(
            comparisonResponse
              .lowestTotalAmount,
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
              : "Unable to load supplier quotations.",
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
    rfq.id,
  ]);

  const quotationBySupplier =
    useMemo(
      () =>
        new Map(
          quotations.map(
            quotation => [
              quotation
                .supplierId,
              quotation,
            ],
          ),
        ),
      [quotations],
    );

  async function runAction(
    quotation:
      Quotation,
    action:
      "SUBMIT" |
      "WITHDRAW",
  ) {
    try {
      setError(
        null,
      );

      if (
        action ===
          "SUBMIT"
      ) {
        await submitQuotation(
          quotation.id,
        );
      } else {
        await withdrawQuotation(
          quotation.id,
        );
      }

      await reloadQuotations();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to update quotation.",
      );
    }
  }

  return (
    <section
      className={
        "panel quotation-workspace"
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
            Supplier quotations
          </span>

          <h2>
            Commercial responses
          </h2>
        </div>

        {submittedCount >=
        2 ? (
          <Link
            href={
              `/rfqs/${rfq.id}/compare`
            }
            className={
              "button button--secondary"
            }
          >
            <Trophy
              size={16}
            />

            Compare quotations
          </Link>
        ) : null}
      </div>

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

      <div
        className={
          "quotation-metrics"
        }
      >
        <div>
          <span>
            Responses
          </span>

          <strong>
            {
              submittedCount
            }
            {" / "}
            {
              rfq.invitations
                .length
            }
          </strong>
        </div>

        <div>
          <span>
            Lowest submitted total
          </span>

          <strong>
            {
              submittedCount > 0
                ? new Intl
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
                      lowestTotal,
                    )
                : "—"
            }
          </strong>
        </div>

        <div>
          <span>
            RFQ status
          </span>

          <strong>
            {rfq.status}
          </strong>
        </div>
      </div>

      {loading ? (
        <div
          className={
            "quotation-empty"
          }
        >
          Loading quotations...
        </div>
      ) : (
        <div
          className={
            "quotation-supplier-list"
          }
        >
          {rfq.invitations.map(
            invitation => {
              const quotation =
                quotationBySupplier
                  .get(
                    invitation
                      .supplierId,
                  );

              return (
                <article
                  key={
                    invitation
                      .supplierId
                  }
                  className={
                    "quotation-supplier-card"
                  }
                >
                  <div
                    className={
                      "quotation-supplier-card__supplier"
                    }
                  >
                    <div
                      className={
                        "quotation-supplier-card__icon"
                      }
                    >
                      <Building2
                        size={18}
                      />
                    </div>

                    <div>
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
                    </div>
                  </div>

                  {quotation ? (
                    <>
                      <div
                        className={
                          "quotation-supplier-card__commercial"
                        }
                      >
                        <span>
                          Total
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
                                    quotation
                                      .currency,
                                },
                              )
                              .format(
                                quotation
                                  .totalAmount,
                              )
                          }
                        </strong>

                        <small>
                          {
                            quotation
                              .leadTimeDays
                          }
                          {" days"}
                        </small>
                      </div>

                      <span
                        className={
                          `quotation-status quotation-status--${
                            quotation
                              .status
                              .toLowerCase()
                          }`
                        }
                      >
                        {
                          quotation
                            .status
                        }
                      </span>

                      <div
                        className={
                          "quotation-card-actions"
                        }
                      >
                        {quotation.status ===
                          "DRAFT" &&
                        rfq.status ===
                          "PUBLISHED" ? (
                          <>
                            <button
                              type="button"
                              className={
                                "quotation-icon-button"
                              }
                              aria-label={
                                "Edit quotation"
                              }
                              onClick={
                                () =>
                                  setEditor({
                                    invitation,
                                    quotation,
                                  })
                              }
                            >
                              <Edit3
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              className={
                                "quotation-submit-action"
                              }
                              onClick={
                                () =>
                                  void runAction(
                                    quotation,
                                    "SUBMIT",
                                  )
                              }
                            >
                              <Send
                                size={14}
                              />

                              Submit
                            </button>
                          </>
                        ) : null}

                        {quotation.status ===
                          "SUBMITTED" &&
                        rfq.status ===
                          "PUBLISHED" ? (
                          <button
                            type="button"
                            className={
                              "quotation-withdraw-action"
                            }
                            onClick={
                              () =>
                                void runAction(
                                  quotation,
                                  "WITHDRAW",
                                )
                            }
                          >
                            <Undo2
                              size={14}
                            />

                            Withdraw
                          </button>
                        ) : null}

                        {quotation.status ===
                          "SUBMITTED" ? (
                          <CircleCheck
                            size={18}
                            className={
                              "quotation-success-icon"
                            }
                          />
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className={
                          "quotation-supplier-card__commercial"
                        }
                      >
                        <span>
                          Response
                        </span>

                        <strong>
                          Not recorded
                        </strong>

                        <small>
                          Awaiting commercial
                          data
                        </small>
                      </div>

                      {rfq.status ===
                        "PUBLISHED" ? (
                        <button
                          type="button"
                          className={
                            "quotation-record-action"
                          }
                          onClick={
                            () =>
                              setEditor({
                                invitation,
                                quotation:
                                  null,
                              })
                          }
                        >
                          <Plus
                            size={14}
                          />

                          Record quotation
                        </button>
                      ) : null}
                    </>
                  )}
                </article>
              );
            },
          )}
        </div>
      )}

      {submittedCount >=
      2 ? (
        <Link
          href={
            `/rfqs/${rfq.id}/compare`
          }
          className={
            "quotation-comparison-cta"
          }
        >
          <div>
            <Banknote
              size={20}
            />

            <span>
              Comparison ready
            </span>

            <strong>
              Compare submitted
              supplier quotations
            </strong>
          </div>

          <ArrowRight
            size={20}
          />
        </Link>
      ) : null}

      {editor ? (
        <QuotationEditor
          rfq={rfq}
          invitation={
            editor.invitation
          }
          quotation={
            editor.quotation
          }
          onClose={
            () =>
              setEditor(
                null,
              )
          }
          onSaved={
            async () => {
              setEditor(
                null,
              );

              await reloadQuotations();
            }
          }
        />
      ) : null}
    </section>
  );
}

interface QuotationEditorProps {
  rfq: Rfq;
  invitation:
    RfqSupplierInvitation;
  quotation:
    Quotation | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function QuotationEditor({
  rfq,
  invitation,
  quotation,
  onClose,
  onSaved,
}: QuotationEditorProps) {
  const [
    leadTimeDays,
    setLeadTimeDays,
  ] =
    useState(
      quotation
        ?.leadTimeDays ??
        14,
    );

  const [
    paymentTerms,
    setPaymentTerms,
  ] =
    useState(
      quotation
        ?.paymentTerms ??
        "30 days net",
    );

  const [
    validityDate,
    setValidityDate,
  ] =
    useState(
      quotation
        ?.validityDate ??
        futureDate(30),
    );

  const [
    discountAmount,
    setDiscountAmount,
  ] =
    useState(
      quotation
        ?.discountAmount ??
        0,
    );

  const [
    shippingAmount,
    setShippingAmount,
  ] =
    useState(
      quotation
        ?.shippingAmount ??
        0,
    );

  const [
    taxAmount,
    setTaxAmount,
  ] =
    useState(
      quotation
        ?.taxAmount ??
        0,
    );

  const [
    prices,
    setPrices,
  ] =
    useState<
      Record<string, number>
    >(
      Object.fromEntries(
        rfq.lineItems.map(
          line => [
            line.id ??
              String(
                line.lineNumber,
              ),
            quotation
              ?.lines
              .find(
                quotedLine =>
                  quotedLine
                    .rfqLineItemId ===
                  line.id,
              )
              ?.unitPrice ??
              0,
          ],
        ),
      ),
    );

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

  const subtotal =
    rfq.lineItems.reduce(
      (
        total,
        line,
      ) => {
        const key =
          line.id ??
          String(
            line.lineNumber,
          );

        return (
          total +
          line.quantity *
            (
              prices[key] ??
              0
            )
        );
      },
      0,
    );

  const total =
    subtotal -
    Number(
      discountAmount,
    ) +
    Number(
      shippingAmount,
    ) +
    Number(
      taxAmount,
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(
        true,
      );

      setError(
        null,
      );

      const lines =
        rfq.lineItems.map(
          line => {
            if (!line.id) {
              throw new Error(
                "RFQ line identifier is missing.",
              );
            }

            return {
              rfqLineItemId:
                line.id,

              unitPrice:
                Number(
                  prices[
                    line.id
                  ] ?? 0,
                ),
            };
          },
        );

      const common:
        QuotationUpdateInput = {
          leadTimeDays:
            Number(
              leadTimeDays,
            ),

          paymentTerms:
            paymentTerms.trim(),

          validityDate,

          discountAmount:
            Number(
              discountAmount,
            ),

          shippingAmount:
            Number(
              shippingAmount,
            ),

          taxAmount:
            Number(
              taxAmount,
            ),

          lines,
        };

      if (quotation) {
        await updateQuotation(
          quotation.id,
          common,
        );
      } else {
        const createInput:
          QuotationCreateInput = {
            supplierId:
              invitation
                .supplierId,
            ...common,
          };

        await createQuotation(
          rfq.id,
          createInput,
        );
      }

      await onSaved();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to save quotation.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  return (
    <div
      className={
        "dialog-backdrop"
      }
      role="presentation"
      onMouseDown={
        event => {
          if (
            event
              .currentTarget ===
            event.target
          ) {
            onClose();
          }
        }
      }
    >
      <section
        className={
          "dialog quotation-dialog"
        }
        role="dialog"
        aria-modal="true"
      >
        <div
          className={
            "dialog__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Supplier response
            </span>

            <h2>
              {quotation
                ? "Edit quotation"
                : "Record quotation"}
            </h2>

            <p>
              {
                invitation
                  .supplierName
              }
              {" · "}
              {
                rfq.rfqNumber
              }
            </p>
          </div>

          <button
            type="button"
            className={
              "icon-button"
            }
            onClick={
              onClose
            }
            aria-label={
              "Close quotation editor"
            }
          >
            <X size={19} />
          </button>
        </div>

        <form
          className={
            "quotation-editor-form"
          }
          onSubmit={
            handleSubmit
          }
        >
          <div
            className={
              "quotation-editor-grid"
            }
          >
            <label
              className={
                "request-field"
              }
            >
              <span>
                Lead time
                (days)
              </span>

              <input
                required
                type="number"
                min="0"
                value={
                  leadTimeDays
                }
                onChange={
                  event =>
                    setLeadTimeDays(
                      Number(
                        event
                          .target
                          .value,
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
                Validity date
              </span>

              <input
                required
                type="date"
                value={
                  validityDate
                }
                onChange={
                  event =>
                    setValidityDate(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            <label
              className={
                "request-field quotation-editor-wide"
              }
            >
              <span>
                Payment terms
              </span>

              <input
                required
                maxLength={300}
                value={
                  paymentTerms
                }
                onChange={
                  event =>
                    setPaymentTerms(
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
              "quotation-line-editor"
            }
          >
            <div
              className={
                "quotation-line-editor__heading"
              }
            >
              <span>
                RFQ line
              </span>

              <span>
                Qty
              </span>

              <span>
                Unit price
              </span>

              <span>
                Subtotal
              </span>
            </div>

            {rfq.lineItems.map(
              line => {
                const key =
                  line.id ??
                  String(
                    line.lineNumber,
                  );

                const price =
                  prices[key] ??
                  0;

                return (
                  <div
                    key={key}
                    className={
                      "quotation-line-editor__row"
                    }
                  >
                    <div>
                      <strong>
                        {
                          line
                            .itemName
                        }
                      </strong>

                      <span>
                        {
                          line
                            .category
                        }
                      </span>
                    </div>

                    <span>
                      {
                        line.quantity
                      }
                      {" "}
                      {
                        line.unit
                      }
                    </span>

                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        price
                      }
                      onChange={
                        event =>
                          setPrices(
                            current => ({
                              ...current,
                              [key]:
                                Number(
                                  event
                                    .target
                                    .value,
                                ),
                            }),
                          )
                      }
                    />

                    <strong>
                      {
                        new Intl
                          .NumberFormat(
                            "en-US",
                            {
                              style:
                                "currency",
                              currency:
                                rfq
                                  .currency,
                            },
                          )
                          .format(
                            line.quantity *
                              price,
                          )
                      }
                    </strong>
                  </div>
                );
              },
            )}
          </div>

          <div
            className={
              "quotation-commercial-grid"
            }
          >
            <label
              className={
                "request-field"
              }
            >
              <span>
                Discount
              </span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={
                  discountAmount
                }
                onChange={
                  event =>
                    setDiscountAmount(
                      Number(
                        event
                          .target
                          .value,
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
                Shipping
              </span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={
                  shippingAmount
                }
                onChange={
                  event =>
                    setShippingAmount(
                      Number(
                        event
                          .target
                          .value,
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
                Taxes
              </span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={
                  taxAmount
                }
                onChange={
                  event =>
                    setTaxAmount(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                }
              />
            </label>
          </div>

          <div
            className={
              "quotation-total-summary"
            }
          >
            <div>
              <span>
                Subtotal
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
                          rfq
                            .currency,
                      },
                    )
                    .format(
                      subtotal,
                    )
                }
              </strong>
            </div>

            <div>
              <span>
                Estimated final
                quotation
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
                          rfq
                            .currency,
                      },
                    )
                    .format(
                      total,
                    )
                }
              </strong>
            </div>
          </div>

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

          <div
            className={
              "dialog__footer"
            }
          >
            <button
              type="button"
              className={
                "button button--secondary"
              }
              onClick={
                onClose
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : "Save quotation draft"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
