"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getStrategicValueReview,
} from "@/lib/api";

import type {
  StrategicValueReviewDetail,
} from "@/types/strategic-value";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

function readable(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase(),
    );
}

function money(
  value: number,
): string {
  return value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
}

export default function StrategicValueReviewPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      StrategicValueReviewDetail |
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
    useState<
      string |
      null
    >(null);

  useEffect(() => {
    let active = true;

    getStrategicValueReview(
      params.id,
    )
      .then(
        response => {
          if (active) {
            setDetail(
              response,
            );
          }
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load strategic value review.",
            );
          }
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

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading strategic value review...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategic-value"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategic value
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Strategic value review not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategic-value"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategic value
      </Link>

      <section className="value-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable executive value review
          </span>

          <h1>
            {detail.review.reviewNumber}
          </h1>

          <p>
            Captured by
            {" "}
            {detail.review.capturedByName}
            {" · "}
            {new Date(
              detail.review.capturedAt,
            )
              .toLocaleString()}
          </p>
        </div>

        <Camera
          size={24}
        />
      </section>

      <section className="value-score-grid">
        <article className="value-score-card">
          <span>
            Portfolio ROI
          </span>

          <strong>
            {detail.review.portfolioRoiPct.toFixed(
              1,
            )}
            %
          </strong>

          <small>
            {readable(
              detail.review.portfolioHealth,
            )}
          </small>
        </article>

        <article>
          <span>
            Investment
          </span>

          <strong>
            {money(
              detail.review.totalInvestmentAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Durable value
          </span>

          <strong>
            {money(
              detail.review.totalDurableHorizonValueAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Decayed value
          </span>

          <strong>
            {money(
              detail.review.totalDecayedValueAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Net value
          </span>

          <strong>
            {money(
              detail.review.totalNetValueAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Payback
          </span>

          <strong>
            {detail.review.portfolioPaybackMonths ===
            null
              ? "N/A"
              : `${detail.review.portfolioPaybackMonths.toFixed(1)} mo`}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen value portfolio
            </span>

            <h2>
              Long-term ROI state at review time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Persistence</th>
                <th>Investment</th>
                <th>Baseline value</th>
                <th>Durable value</th>
                <th>Decay</th>
                <th>Net value</th>
                <th>ROI</th>
                <th>Payback</th>
                <th>Health</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.valueCaseId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.caseNumber}
                          {" · "}
                          {item.persistencePlanNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {item.valueOwnerName}
                    </td>

                    <td>
                      {readable(
                        item.caseStatus,
                      )}
                    </td>

                    <td>
                      {item.persistencePct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        item.investmentCostAmount,
                      )}
                    </td>

                    <td>
                      {money(
                        item.baselineHorizonValueAmount,
                      )}
                    </td>

                    <td>
                      {money(
                        item.durableHorizonValueAmount,
                      )}
                    </td>

                    <td>
                      {money(
                        item.decayedValueAmount,
                      )}
                    </td>

                    <td>
                      {money(
                        item.netValueAmount,
                      )}
                    </td>

                    <td>
                      {item.roiPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.paybackMonths ===
                      null
                        ? "N/A"
                        : `${item.paybackMonths.toFixed(1)} mo`}
                    </td>

                    <td>
                      {readable(
                        item.valueHealth,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="value-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable executive value evidence
          </strong>

          <p>
            This review freezes governed
            investment assumptions,
            persistence-adjusted durable
            value, decay, ROI, payback and
            case health at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
