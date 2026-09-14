"use client";

import {
  ArrowLeft,
  Printer,
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
  getGovernanceReview,
} from "@/lib/api";

import type {
  GovernanceReviewDetail,
} from "@/types/governance-review";

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
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export default function GovernanceReviewPrintPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      GovernanceReviewDetail |
      null
    >(null);

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

    getGovernanceReview(
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
                : "Unable to load review pack.",
            );
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    params.id,
  ]);

  if (!detail) {
    return (
      <main className="governance-print-page">
        <div className="governance-print-toolbar">
          <Link
            href={
              `/governance-reviews/${params.id}`
            }
          >
            <ArrowLeft
              size={15}
            />
            Review
          </Link>
        </div>

        <p>
          {error ??
            "Loading review pack..."}
        </p>
      </main>
    );
  }

  const {
    review,
    snapshot,
  } = detail;

  const supplierItems =
    detail.snapshotItems.filter(
      item =>
        item.itemType ===
        "SUPPLIER_RISK",
    );

  const categoryItems =
    detail.snapshotItems.filter(
      item =>
        item.itemType ===
        "CATEGORY_STRATEGY",
    );

  const portfolioItems =
    detail.snapshotItems.filter(
      item =>
        item.itemType ===
        "BENEFIT_PORTFOLIO",
    );

  return (
    <main className="governance-print-page">
      <div className="governance-print-toolbar">
        <Link
          href={
            `/governance-reviews/${review.id}`
          }
        >
          <ArrowLeft
            size={15}
          />
          Review
        </Link>

        <button
          type="button"
          onClick={
            () =>
              window.print()
          }
        >
          <Printer
            size={15}
          />
          Print review pack
        </button>
      </div>

      <header className="governance-print-header">
        <span>
          PROCUREIQ EXECUTIVE PROCUREMENT REVIEW
        </span>

        <h1>
          {review.title}
        </h1>

        <p>
          {review.reviewNumber}
          {" · "}
          {review.periodStart}
          {" → "}
          {review.periodEnd}
          {" · "}
          {review.currency}
        </p>

        <div>
          <span>
            Review chair
          </span>

          <strong>
            {review.chairName}
          </strong>

          <span>
            Review owner
          </span>

          <strong>
            {review.ownerName}
          </strong>
        </div>
      </header>

      <section className="governance-print-section">
        <h2>
          Executive summary
        </h2>

        <p className="governance-print-summary">
          {detail.executiveSummary}
        </p>
      </section>

      {snapshot ? (
        <>
          <section className="governance-print-section">
            <h2>
              Executive scorecard
            </h2>

            <div className="governance-print-scorecard">
              <article>
                <span>
                  Target savings
                </span>

                <strong>
                  {money(
                    snapshot.baselineTargetSavings,
                    review.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Forecast savings
                </span>

                <strong>
                  {money(
                    snapshot.forecastSavings,
                    review.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Validated savings
                </span>

                <strong>
                  {money(
                    snapshot.validatedSavings,
                    review.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Value at risk
                </span>

                <strong>
                  {money(
                    snapshot.atRiskAmount,
                    review.currency,
                  )}
                </strong>
              </article>

              <article>
                <span>
                  Critical suppliers
                </span>

                <strong>
                  {snapshot.criticalRiskSuppliers}
                </strong>
              </article>

              <article>
                <span>
                  Risk alerts
                </span>

                <strong>
                  {snapshot.activeRiskAlerts}
                </strong>
              </article>

              <article>
                <span>
                  Active initiatives
                </span>

                <strong>
                  {snapshot.activeCategoryInitiatives}
                </strong>
              </article>

              <article>
                <span>
                  Overdue initiatives
                </span>

                <strong>
                  {snapshot.overdueCategoryInitiatives}
                </strong>
              </article>

              <article>
                <span>
                  Pending validations
                </span>

                <strong>
                  {snapshot.validationPendingItems}
                </strong>
              </article>

              <article>
                <span>
                  Leakage
                </span>

                <strong>
                  {money(
                    snapshot.activeLeakageAmount,
                    review.currency,
                  )}
                </strong>
              </article>
            </div>

            <p className="governance-print-cutoff">
              Snapshot captured:
              {" "}
              {new Date(
                snapshot.capturedAt,
              )
                .toLocaleString()}
            </p>
          </section>

          <section className="governance-print-section">
            <h2>
              Supplier risk priorities
            </h2>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Supplier</th>
                  <th>Severity</th>
                  <th>Risk score</th>
                  <th>Context</th>
                </tr>
              </thead>

              <tbody>
                {supplierItems.map(
                  item => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        {item.rankPosition}
                      </td>

                      <td>
                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {item.subtitle}
                        </small>
                      </td>

                      <td>
                        {item.severity}
                      </td>

                      <td>
                        {item.metricValue.toFixed(
                          1,
                        )}
                      </td>

                      <td>
                        {item.details}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </section>

          <section className="governance-print-section">
            <h2>
              Category strategy priorities
            </h2>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Target</th>
                  <th>Context</th>
                </tr>
              </thead>

              <tbody>
                {categoryItems.map(
                  item => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        {item.rankPosition}
                      </td>

                      <td>
                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {item.subtitle}
                        </small>
                      </td>

                      <td>
                        {item.severity}
                      </td>

                      <td>
                        {money(
                          item.metricValue,
                          review.currency,
                        )}
                      </td>

                      <td>
                        {item.details}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </section>

          <section className="governance-print-section">
            <h2>
              Benefits portfolios
            </h2>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Portfolio</th>
                  <th>Severity</th>
                  <th>Value at risk</th>
                  <th>Context</th>
                </tr>
              </thead>

              <tbody>
                {portfolioItems.map(
                  item => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        {item.rankPosition}
                      </td>

                      <td>
                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {item.subtitle}
                        </small>
                      </td>

                      <td>
                        {item.severity}
                      </td>

                      <td>
                        {money(
                          item.metricValue,
                          review.currency,
                        )}
                      </td>

                      <td>
                        {item.details}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      <section className="governance-print-section">
        <h2>
          Formal decisions
        </h2>

        <table>
          <thead>
            <tr>
              <th>Decision</th>
              <th>Type</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Decision note</th>
            </tr>
          </thead>

          <tbody>
            {detail.decisions.map(
              decision => (
                <tr
                  key={decision.id}
                >
                  <td>
                    <strong>
                      {decision.title}
                    </strong>

                    <small>
                      {decision.decisionNumber}
                    </small>
                  </td>

                  <td>
                    {readable(
                      decision.decisionType,
                    )}
                  </td>

                  <td>
                    {readable(
                      decision.status,
                    )}
                  </td>

                  <td>
                    {decision.decisionOwnerName}
                  </td>

                  <td>
                    {decision.decisionNote ??
                      decision.description}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <section className="governance-print-section">
        <h2>
          Management actions
        </h2>

        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Owner</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {detail.actions.map(
              action => (
                <tr
                  key={action.id}
                >
                  <td>
                    <strong>
                      {action.title}
                    </strong>

                    <small>
                      {action.actionNumber}
                    </small>
                  </td>

                  <td>
                    {action.ownerName}
                  </td>

                  <td>
                    {action.priority}
                  </td>

                  <td>
                    {action.dueDate}
                  </td>

                  <td>
                    {readable(
                      action.status,
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <footer className="governance-print-footer">
        ProcureIQ · Frozen executive
        governance review pack ·
        Operational source records remain
        authoritative.
      </footer>
    </main>
  );
}
