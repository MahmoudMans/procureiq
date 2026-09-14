"use client";

import {
  ArrowLeft,
  Banknote,
  CircleAlert,
  Clock3,
  Medal,
  TrendingDown,
  Trophy,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  getQuotationComparison,
  getRfq,
  getRfqQuotations,
} from "@/lib/api";

import type {
  Quotation,
  QuotationComparison,
} from "@/types/quotation";

import type {
  Rfq,
} from "@/types/rfq";

export default function QuotationComparisonPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    rfq,
    setRfq,
  ] =
    useState<Rfq | null>(
      null,
    );

  const [
    quotations,
    setQuotations,
  ] =
    useState<Quotation[]>(
      [],
    );

  const [
    comparison,
    setComparison,
  ] =
    useState<
      QuotationComparison |
      null
    >(null);

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

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [
          rfqResponse,
          quotationResponse,
          comparisonResponse,
        ] =
          await Promise.all([
            getRfq(
              params.id,
            ),

            getRfqQuotations(
              params.id,
            ),

            getQuotationComparison(
              params.id,
            ),
          ]);

        if (!mounted) {
          return;
        }

        setRfq(
          rfqResponse,
        );

        setQuotations(
          quotationResponse.filter(
            quotation =>
              quotation.status ===
              "SUBMITTED",
          ),
        );

        setComparison(
          comparisonResponse,
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
              : "Unable to build quotation comparison.",
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

  const sortedQuotations =
    useMemo(
      () =>
        [...quotations]
          .sort(
            (
              first,
              second,
            ) =>
              first.totalAmount -
              second.totalAmount,
          ),
      [quotations],
    );

  if (loading) {
    return (
      <div
        className={
          "request-detail-loading"
        }
      >
        Building commercial
        comparison...
      </div>
    );
  }

  if (
    error ||
    !rfq ||
    !comparison
  ) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href={
            `/rfqs/${params.id}`
          }
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />
          RFQ
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
            "Quotation comparison is unavailable."}
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
          `/rfqs/${rfq.id}`
        }
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        {rfq.rfqNumber}
      </Link>

      <section
        className={
          "page-heading quotation-comparison-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Commercial intelligence
          </span>

          <h1>
            Quotation comparison
          </h1>

          <p>
            Compare submitted supplier
            pricing, delivery terms and
            commercial exposure for
            {` ${rfq.title}.`}
          </p>
        </div>
      </section>

      <section
        className={
          "quotation-comparison-kpis"
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
              <Trophy
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Lowest quotation
          </span>

          <strong
            className={
              "kpi-card__value quotation-comparison-value"
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
                      comparison
                        .currency,
                    maximumFractionDigits:
                      0,
                  },
                )
                .format(
                  comparison
                    .lowestTotalAmount,
                )
            }
          </strong>

          <p>
            Lowest submitted
            commercial offer.
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
              <TrendingDown
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Potential savings
          </span>

          <strong
            className={
              "kpi-card__value quotation-comparison-value"
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
                      comparison
                        .currency,
                    maximumFractionDigits:
                      0,
                  },
                )
                .format(
                  comparison
                    .potentialSavings,
                )
            }
          </strong>

          <p>
            Difference between
            highest and lowest offers.
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
            Highest quotation
          </span>

          <strong
            className={
              "kpi-card__value quotation-comparison-value"
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
                      comparison
                        .currency,
                    maximumFractionDigits:
                      0,
                  },
                )
                .format(
                  comparison
                    .highestTotalAmount,
                )
            }
          </strong>

          <p>
            Highest submitted
            commercial exposure.
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
              <Medal
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Responses compared
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              comparison
                .submittedQuotationCount
            }
          </strong>

          <p>
            Complete supplier
            responses included.
          </p>
        </article>
      </section>

      <section
        className={
          "quotation-ranking-grid"
        }
      >
        {comparison
          .quotations
          .map(
            item => (
              <article
                key={
                  item.quotationId
                }
                className={
                  `quotation-ranking-card ${
                    item.lowestCost
                      ? "quotation-ranking-card--winner"
                      : ""
                  }`
                }
              >
                <div
                  className={
                    "quotation-ranking-card__rank"
                  }
                >
                  {item.lowestCost ? (
                    <Trophy
                      size={18}
                    />
                  ) : (
                    <span>
                      #{item.rank}
                    </span>
                  )}
                </div>

                <div
                  className={
                    "quotation-ranking-card__supplier"
                  }
                >
                  <span>
                    Supplier
                  </span>

                  <strong>
                    {
                      item
                        .supplierName
                    }
                  </strong>

                  <small>
                    {
                      item
                        .quotationNumber
                    }
                  </small>
                </div>

                <div
                  className={
                    "quotation-ranking-card__price"
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
                              comparison
                                .currency,
                          },
                        )
                        .format(
                          item
                            .totalAmount,
                        )
                    }
                  </strong>

                  {!item.lowestCost ? (
                    <small>
                      +
                      {
                        new Intl
                          .NumberFormat(
                            "en-US",
                            {
                              style:
                                "currency",
                              currency:
                                comparison
                                  .currency,
                            },
                          )
                          .format(
                            item
                              .varianceFromLowest,
                          )
                      }
                      {" vs lowest"}
                    </small>
                  ) : (
                    <small>
                      Lowest cost
                    </small>
                  )}
                </div>

                <div
                  className={
                    "quotation-ranking-card__term"
                  }
                >
                  <Clock3
                    size={15}
                  />

                  <span>
                    {
                      item
                        .leadTimeDays
                    }
                    {" days"}
                  </span>
                </div>
              </article>
            ),
          )}
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
              Line-level analysis
            </span>

            <h2>
              Unit-price comparison
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
              "data-table quotation-matrix"
            }
          >
            <thead>
              <tr>
                <th>
                  RFQ line
                </th>

                <th>
                  Quantity
                </th>

                {sortedQuotations.map(
                  quotation => (
                    <th
                      key={
                        quotation.id
                      }
                    >
                      {
                        quotation
                          .supplierName
                      }
                    </th>
                  ),
                )}
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
                              .category
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      {
                        line.quantity
                      }
                      {" "}
                      {
                        line.unit
                      }
                    </td>

                    {sortedQuotations.map(
                      quotation => {
                        const quoteLine =
                          quotation
                            .lines
                            .find(
                              quotedLine =>
                                quotedLine
                                  .rfqLineItemId ===
                                line.id,
                            );

                        return (
                          <td
                            key={
                              quotation.id
                            }
                          >
                            <strong>
                              {
                                quoteLine
                                  ? new Intl
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
                                        quoteLine
                                          .unitPrice,
                                      )
                                  : "—"
                              }
                            </strong>

                            {quoteLine ? (
                              <span
                                className={
                                  "quotation-matrix-subtotal"
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
                                          quotation
                                            .currency,
                                      },
                                    )
                                    .format(
                                      quoteLine
                                        .lineSubtotal,
                                    )
                                }
                                {" total"}
                              </span>
                            ) : null}
                          </td>
                        );
                      },
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
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
              Commercial terms
            </span>

            <h2>
              Supplier conditions
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
              "data-table"
            }
          >
            <thead>
              <tr>
                <th>
                  Supplier
                </th>

                <th>
                  Subtotal
                </th>

                <th>
                  Discount
                </th>

                <th>
                  Shipping
                </th>

                <th>
                  Tax
                </th>

                <th>
                  Final total
                </th>

                <th>
                  Lead time
                </th>

                <th>
                  Payment terms
                </th>

                <th>
                  Valid until
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedQuotations.map(
                quotation => (
                  <tr
                    key={
                      quotation.id
                    }
                  >
                    <td>
                      <strong>
                        {
                          quotation
                            .supplierName
                        }
                      </strong>
                    </td>

                    <td>
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
                              .subtotal,
                          )
                      }
                    </td>

                    <td>
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
                              .discountAmount,
                          )
                      }
                    </td>

                    <td>
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
                              .shippingAmount,
                          )
                      }
                    </td>

                    <td>
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
                              .taxAmount,
                          )
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
                    </td>

                    <td>
                      {
                        quotation
                          .leadTimeDays
                      }
                      {" days"}
                    </td>

                    <td>
                      {
                        quotation
                          .paymentTerms
                      }
                    </td>

                    <td>
                      {
                        new Date(
                          `${quotation.validityDate}T00:00:00`,
                        )
                          .toLocaleDateString()
                      }
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
