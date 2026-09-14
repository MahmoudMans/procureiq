"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CircleAlert,
  Gauge,
  Medal,
  Save,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  calculateRfqEvaluation,
  createAwardDecision,
  getAwardDecision,
  getRfq,
  getRfqEvaluation,
  getRfqQuotations,
} from "@/lib/api";

import type {
  AwardDecision,
  RfqEvaluation,
  RfqEvaluationInput,
} from "@/types/evaluation";

import type {
  Quotation,
} from "@/types/quotation";

import type {
  Rfq,
} from "@/types/rfq";

interface WeightState {
  priceWeight: number;
  deliveryWeight: number;
  supplierRatingWeight: number;
  riskWeight: number;
  qualityWeight: number;
}

const DEFAULT_WEIGHTS:
WeightState = {
  priceWeight: 40,
  deliveryWeight: 20,
  supplierRatingWeight: 15,
  riskWeight: 10,
  qualityWeight: 15,
};

export default function EvaluationPage() {
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
    quotations,
    setQuotations,
  ] =
    useState<Quotation[]>(
      [],
    );

  const [
    evaluation,
    setEvaluation,
  ] =
    useState<
      RfqEvaluation |
      null
    >(null);

  const [
    award,
    setAward,
  ] =
    useState<
      AwardDecision |
      undefined
    >(undefined);

  const [
    weights,
    setWeights,
  ] =
    useState<WeightState>(
      DEFAULT_WEIGHTS,
    );

  const [
    qualityScores,
    setQualityScores,
  ] =
    useState<
      Record<
        string,
        number
      >
    >({});

  const [
    selectedQuotationId,
    setSelectedQuotationId,
  ] =
    useState("");

  const [
    rationale,
    setRationale,
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
    awarding,
    setAwarding,
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

  const canAward =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    Promise.all([
      getRfq(
        params.id,
      ),
      getRfqQuotations(
        params.id,
      ),
      getRfqEvaluation(
        params.id,
      ),
      getAwardDecision(
        params.id,
      ),
    ])
      .then(
        ([
          rfqResponse,
          quotationResponse,
          evaluationResponse,
          awardResponse,
        ]) => {
          if (!active) {
            return;
          }

          const submitted =
            quotationResponse.filter(
              quotation =>
                quotation.status ===
                "SUBMITTED",
            );

          setRfq(
            rfqResponse,
          );

          setQuotations(
            submitted,
          );

          setEvaluation(
            evaluationResponse,
          );

          setAward(
            awardResponse,
          );

          setWeights({
            priceWeight:
              evaluationResponse
                .priceWeight,

            deliveryWeight:
              evaluationResponse
                .deliveryWeight,

            supplierRatingWeight:
              evaluationResponse
                .supplierRatingWeight,

            riskWeight:
              evaluationResponse
                .riskWeight,

            qualityWeight:
              evaluationResponse
                .qualityWeight,
          });

          const existingScores =
            Object.fromEntries(
              submitted.map(
                quotation => {
                  const score =
                    evaluationResponse
                      .scorecards
                      .find(
                        item =>
                          item.quotationId ===
                          quotation.id,
                      )
                      ?.qualityScore ??
                    80;

                  return [
                    quotation.id,
                    score,
                  ];
                },
              ),
            );

          setQualityScores(
            existingScores,
          );

          if (
            evaluationResponse
              .recommendedQuotationId
          ) {
            setSelectedQuotationId(
              evaluationResponse
                .recommendedQuotationId,
            );
          } else if (
            submitted.length > 0
          ) {
            setSelectedQuotationId(
              submitted[0].id,
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
              : "Unable to load supplier evaluation.",
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
    params.id,
  ]);

  const weightTotal =
    useMemo(
      () =>
        weights.priceWeight +
        weights.deliveryWeight +
        weights.supplierRatingWeight +
        weights.riskWeight +
        weights.qualityWeight,
      [weights],
    );

  async function handleCalculate(
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

      const input:
        RfqEvaluationInput = {
          ...weights,

          qualityScores:
            quotations.map(
              quotation => ({
                quotationId:
                  quotation.id,

                qualityScore:
                  Number(
                    qualityScores[
                      quotation.id
                    ] ??
                    80,
                  ),
              }),
            ),
        };

      const response =
        await calculateRfqEvaluation(
          params.id,
          input,
        );

      setEvaluation(
        response,
      );

      if (
        response
          .recommendedQuotationId
      ) {
        setSelectedQuotationId(
          response
            .recommendedQuotationId,
        );
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to calculate supplier evaluation.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function handleAward(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setAwarding(
        true,
      );

      setError(
        null,
      );

      const response =
        await createAwardDecision(
          params.id,
          selectedQuotationId,
          rationale,
        );

      setAward(
        response,
      );

      if (rfq) {
        setRfq({
          ...rfq,
          status:
            "AWARDED",
        });
      }
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to record award decision.",
      );
    } finally {
      setAwarding(
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

          Your role cannot access
          supplier evaluation.
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
        Loading supplier
        evaluation...
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
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Supplier selection
          </span>

          <h1>
            Evaluation & award
          </h1>

          <p>
            Score submitted suppliers
            using commercial, delivery,
            performance, risk and
            quality criteria.
          </p>
        </div>

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
          "evaluation-summary-grid"
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
              <Gauge
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Suppliers evaluated
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              evaluation
                ?.evaluatedSupplierCount ??
              0
            }
          </strong>

          <p>
            Submitted quotations
            included in scoring.
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
            Recommended supplier
          </span>

          <strong
            className={
              "evaluation-kpi-name"
            }
          >
            {
              evaluation
                ?.recommendedSupplierName ??
              "Not calculated"
            }
          </strong>

          <p>
            Highest weighted
            evaluation result.
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
              <Star
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Top score
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              evaluation
                ?.scorecards[0]
                ?.weightedTotalScore
                ?.toFixed(1) ??
              "—"
            }
          </strong>

          <p>
            Weighted score out
            of 100.
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
              <Award
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Award status
          </span>

          <strong
            className={
              "evaluation-kpi-name"
            }
          >
            {award
              ? "Decision recorded"
              : "Pending"}
          </strong>

          <p>
            Final sourcing
            decision status.
          </p>
        </article>
      </section>

      {!award &&
      rfq.status !==
        "AWARDED" ? (
        <form
          className={
            "page-stack"
          }
          onSubmit={
            handleCalculate
          }
        >
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
                  Evaluation model
                </span>

                <h2>
                  Criteria weights
                </h2>
              </div>

              <span
                className={
                  `evaluation-weight-total ${
                    weightTotal ===
                    100
                      ? "evaluation-weight-total--valid"
                      : "evaluation-weight-total--invalid"
                  }`
                }
              >
                Total:
                {" "}
                {weightTotal}%
              </span>
            </div>

            <div
              className={
                "evaluation-weight-grid"
              }
            >
              {[
                [
                  "priceWeight",
                  "Commercial price",
                ],
                [
                  "deliveryWeight",
                  "Delivery",
                ],
                [
                  "supplierRatingWeight",
                  "Supplier rating",
                ],
                [
                  "riskWeight",
                  "Supplier risk",
                ],
                [
                  "qualityWeight",
                  "Quality / technical",
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <label
                    key={key}
                    className={
                      "request-field"
                    }
                  >
                    <span>
                      {label}
                    </span>

                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={
                        weights[
                          key as keyof WeightState
                        ]
                      }
                      onChange={
                        event =>
                          setWeights(
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
                  </label>
                ),
              )}
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
                  Technical assessment
                </span>

                <h2>
                  Quality scores
                </h2>
              </div>
            </div>

            <div
              className={
                "evaluation-quality-grid"
              }
            >
              {quotations.map(
                quotation => (
                  <article
                    key={
                      quotation.id
                    }
                    className={
                      "evaluation-quality-card"
                    }
                  >
                    <div>
                      <strong>
                        {
                          quotation
                            .supplierName
                        }
                      </strong>

                      <span>
                        {
                          quotation
                            .quotationNumber
                        }
                      </span>
                    </div>

                    <label>
                      <span>
                        Quality
                        score / 100
                      </span>

                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={
                          qualityScores[
                            quotation.id
                          ] ??
                          80
                        }
                        onChange={
                          event =>
                            setQualityScores(
                              current => ({
                                ...current,
                                [quotation.id]:
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                              }),
                            )
                        }
                      />
                    </label>
                  </article>
                ),
              )}
            </div>

            <div
              className={
                "evaluation-form-actions"
              }
            >
              <button
                type="submit"
                className={
                  "button button--primary"
                }
                disabled={
                  saving ||
                  quotations.length <
                    2 ||
                  weightTotal !==
                    100
                }
              >
                <Save
                  size={16}
                />

                {saving
                  ? "Calculating..."
                  : "Calculate evaluation"}
              </button>
            </div>
          </section>
        </form>
      ) : null}

      {evaluation &&
      evaluation.scorecards.length >
        0 ? (
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
                Supplier scorecards
              </span>

              <h2>
                Weighted ranking
              </h2>
            </div>
          </div>

          <div
            className={
              "evaluation-ranking-list"
            }
          >
            {evaluation
              .scorecards
              .map(
                score => (
                  <article
                    key={
                      score
                        .quotationId
                    }
                    className={
                      `evaluation-ranking-card ${
                        score.recommended
                          ? "evaluation-ranking-card--recommended"
                          : ""
                      }`
                    }
                  >
                    <div
                      className={
                        "evaluation-rank"
                      }
                    >
                      {score.recommended ? (
                        <Trophy
                          size={18}
                        />
                      ) : (
                        `#${score.rankPosition}`
                      )}
                    </div>

                    <div
                      className={
                        "evaluation-supplier"
                      }
                    >
                      <strong>
                        {
                          score
                            .supplierName
                        }
                      </strong>

                      <span>
                        {
                          score
                            .quotationNumber
                        }
                      </span>

                      {score.recommended ? (
                        <small>
                          Recommended
                          supplier
                        </small>
                      ) : null}
                    </div>

                    <div
                      className={
                        "evaluation-component"
                      }
                    >
                      <span>
                        Price
                      </span>
                      <strong>
                        {
                          score
                            .priceScore
                            .toFixed(1)
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        "evaluation-component"
                      }
                    >
                      <span>
                        Delivery
                      </span>
                      <strong>
                        {
                          score
                            .deliveryScore
                            .toFixed(1)
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        "evaluation-component"
                      }
                    >
                      <span>
                        Rating
                      </span>
                      <strong>
                        {
                          score
                            .supplierRatingScore
                            .toFixed(1)
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        "evaluation-component"
                      }
                    >
                      <span>
                        Risk
                      </span>
                      <strong>
                        {
                          score
                            .riskScore
                            .toFixed(1)
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        "evaluation-component"
                      }
                    >
                      <span>
                        Quality
                      </span>
                      <strong>
                        {
                          score
                            .qualityScore
                            .toFixed(1)
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        "evaluation-total-score"
                      }
                    >
                      <span>
                        Weighted
                        score
                      </span>

                      <strong>
                        {
                          score
                            .weightedTotalScore
                            .toFixed(2)
                        }
                      </strong>
                    </div>
                  </article>
                ),
              )}
          </div>
        </section>
      ) : null}

      {award ? (
        <section
          className={
            "panel award-result"
          }
        >
          <div
            className={
              "award-result__icon"
            }
          >
            <Medal
              size={26}
            />
          </div>

          <div
            className={
              "award-result__content"
            }
          >
            <span
              className={
                "eyebrow"
              }
            >
              Award decision
            </span>

            <h2>
              {
                award
                  .selectedSupplierName
              }
            </h2>

            <p>
              {
                award.rationale
              }
            </p>

            <div
              className={
                "award-result__meta"
              }
            >
              <span>
                {
                  award
                    .selectedQuotationNumber
                }
              </span>

              <span>
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
                      award
                        .selectedTotalAmount,
                    )
                }
              </span>

              <span>
                Decided by
                {" "}
                {
                  award
                    .decidedByName
                }
              </span>

              {award.manualOverride ? (
                <span
                  className={
                    "award-override-badge"
                  }
                >
                  <AlertTriangle
                    size={13}
                  />
                  Manual override
                </span>
              ) : (
                <span
                  className={
                    "award-recommended-badge"
                  }
                >
                  <ShieldCheck
                    size={13}
                  />
                  Recommended
                  supplier selected
                </span>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {!award &&
      rfq.status ===
        "CLOSED" &&
      evaluation &&
      evaluation.scorecards.length >
        0 &&
      canAward ? (
        <form
          className={
            "panel award-form"
          }
          onSubmit={
            handleAward
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
                Sourcing decision
              </span>

              <h2>
                Award supplier
              </h2>
            </div>
          </div>

          <div
            className={
              "award-form-grid"
            }
          >
            <label
              className={
                "request-field"
              }
            >
              <span>
                Selected quotation
              </span>

              <select
                required
                value={
                  selectedQuotationId
                }
                onChange={
                  event =>
                    setSelectedQuotationId(
                      event
                        .target
                        .value,
                    )
                }
              >
                {evaluation
                  .scorecards
                  .map(
                    score => (
                      <option
                        key={
                          score
                            .quotationId
                        }
                        value={
                          score
                            .quotationId
                        }
                      >
                        {
                          score
                            .supplierName
                        }
                        {" — "}
                        {
                          score
                            .weightedTotalScore
                            .toFixed(2)
                        }
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label
              className={
                "request-field award-rationale"
              }
            >
              <span>
                Award rationale
              </span>

              <textarea
                required
                rows={5}
                maxLength={3000}
                value={
                  rationale
                }
                placeholder={
                  selectedQuotationId ===
                  evaluation
                    .recommendedQuotationId
                    ? "Explain the sourcing decision and why the recommended supplier is being awarded."
                    : "A different supplier is selected. Explain the business justification for overriding the recommendation."
                }
                onChange={
                  event =>
                    setRationale(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>
          </div>

          {selectedQuotationId &&
          selectedQuotationId !==
            evaluation
              .recommendedQuotationId ? (
            <div
              className={
                "award-override-warning"
              }
            >
              <AlertTriangle
                size={18}
              />

              You are selecting a
              supplier other than the
              system recommendation.
              This will be recorded
              as a manual override.
            </div>
          ) : null}

          <div
            className={
              "evaluation-form-actions"
            }
          >
            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={
                awarding ||
                !selectedQuotationId ||
                !rationale.trim()
              }
            >
              <Award
                size={16}
              />

              {awarding
                ? "Recording award..."
                : "Record award decision"}
            </button>
          </div>
        </form>
      ) : null}

      {!award &&
      rfq.status ===
        "PUBLISHED" ? (
        <div
          className={
            "evaluation-info-banner"
          }
        >
          <CircleAlert
            size={18}
          />

          Evaluation can be calculated
          while sourcing is open, but
          the RFQ must be closed before
          a final award can be recorded.
        </div>
      ) : null}
    </div>
  );
}
