"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Camera,
  CircleAlert,
  Goal,
  Link2,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureStrategicAlignmentReview,
  getStrategicAlignmentDashboard,
} from "@/lib/api";

import type {
  StrategicAlignmentDashboard,
} from "@/types/strategic-alignment";

import {
  useEffect,
  useState,
} from "react";

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
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function StrategicAlignmentPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategicAlignmentDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      new Date()
        .getUTCFullYear(),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    capturing,
    setCapturing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    getStrategicAlignmentDashboard(
      currency,
      fiscalYear,
    )
      .then(
        response => {
          if (active) {
            setDashboard(
              response,
            );

            setError(null);
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
                : "Unable to load strategic alignment.",
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
    currency,
    fiscalYear,
  ]);

  async function reload() {
    setDashboard(
      await getStrategicAlignmentDashboard(
        currency,
        fiscalYear,
      ),
    );
  }

  async function captureReview() {
    try {
      setCapturing(true);
      setError(null);

      await captureStrategicAlignmentReview(
        currency,
        fiscalYear,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture strategic alignment review.",
      );
    } finally {
      setCapturing(false);
    }
  }

  const summary =
    dashboard?.summary;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategy-to-execution
          </span>

          <h1>
            Strategic alignment
          </h1>

          <p>
            Connect procurement OKRs to
            category work, improvement
            initiatives, value-delivery
            portfolios and supplier-risk
            mitigation while exposing
            strategic gaps and conflicting
            commitments.
          </p>
        </div>

        <div className="alignment-heading-actions">
          <label className="alignment-filter">
            <span>
              Currency
            </span>

            <select
              value={currency}
              onChange={
                event => {
                  setLoading(true);
                  setCurrency(
                    event.target.value,
                  );
                }
              }
            >
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          <label className="alignment-filter">
            <span>
              Fiscal year
            </span>

            <input
              type="number"
              min="2000"
              max="2200"
              value={fiscalYear}
              onChange={
                event => {
                  setLoading(true);

                  setFiscalYear(
                    Number(
                      event.target.value,
                    ),
                  );
                }
              }
            />
          </label>

          {canManage ? (
            <button
              type="button"
              className="button button--primary"
              disabled={capturing}
              onClick={
                () =>
                  void captureReview()
              }
            >
              <Camera
                size={15}
              />
              {capturing
                ? "Capturing..."
                : "Capture review"}
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="alignment-score-grid">
        <article className="alignment-score-card">
          <span>
            Alignment score
          </span>

          <strong>
            {(
              summary
                ?.alignmentScore ??
                0
            ).toFixed(1)}
          </strong>

          <small>
            {summary
              ? readable(
                  summary.alignmentHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Source coverage
          </span>

          <strong>
            {(
              summary
                ?.sourceCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Objective coverage
          </span>

          <strong>
            {(
              summary
                ?.objectiveCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Value coverage
          </span>

          <strong>
            {(
              summary
                ?.valueCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Risk coverage
          </span>

          <strong>
            {(
              summary
                ?.riskCoveragePct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>

        <article>
          <span>
            Schedule alignment
          </span>

          <strong>
            {(
              summary
                ?.scheduleAlignmentPct ??
                0
            ).toFixed(1)}
            %
          </strong>
        </article>
      </section>

      <section className="alignment-signal-grid">
        <article>
          <span>
            Unaligned work
          </span>

          <strong className="alignment-risk-text">
            {summary
              ?.unalignedSourceCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Split commitments
          </span>

          <strong>
            {summary
              ?.splitCommitmentCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Deadline conflicts
          </span>

          <strong className="alignment-risk-text">
            {summary
              ?.deadlineConflictCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Strategic value aligned
          </span>

          <strong>
            {money(
              summary
                ?.strategicValueAligned ??
                0,
              currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Risk exposure covered
          </span>

          <strong>
            {money(
              summary
                ?.riskExposureAligned ??
                0,
              currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Objective alignment
            </span>

            <h2>
              Strategy-to-work mapping
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Objective</th>
                <th>OKR progress</th>
                <th>Health</th>
                <th>Linked work</th>
                <th>Value aligned</th>
                <th>Risk covered</th>
                <th>Schedule conflicts</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.objectives
                  .map(
                    objective => (
                      <tr
                        key={objective.id}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {objective.title}
                            </strong>

                            <span>
                              {objective.objectiveNumber}
                              {" · "}
                              {objective.ownerName}
                            </span>
                          </div>
                        </td>

                        <td>
                          {objective.okrProgressPct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {readable(
                            objective.okrHealth,
                          )}
                        </td>

                        <td>
                          {objective.linkedSourceCount}
                        </td>

                        <td>
                          {money(
                            objective.allocatedStrategicValue,
                            currency,
                          )}
                        </td>

                        <td>
                          {money(
                            objective.coveredRiskExposure,
                            currency,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              objective.deadlineConflictCount >
                              0
                                ? "alignment-risk-text"
                                : ""
                            }
                          >
                            {objective.deadlineConflictCount}
                          </span>
                        </td>

                        <td>
                          <Link
                            href={
                              `/strategic-alignment/objectives/${objective.id}`
                            }
                            className="table-action"
                          >
                            Align
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Strategic gaps
            </span>

            <h2>
              Execution portfolio
            </h2>
          </div>

          <Link2
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Work item</th>
                <th>Type</th>
                <th>Status</th>
                <th>Allocation</th>
                <th>Objectives</th>
                <th>Value</th>
                <th>Risk exposure</th>
                <th>Deadline conflicts</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.sources
                  .map(
                    source => (
                      <tr
                        key={
                          `${source.sourceType}:${source.sourceEntityId}`
                        }
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {source.sourceTitle}
                            </strong>

                            <span>
                              {source.sourceReference}
                            </span>
                          </div>
                        </td>

                        <td>
                          {readable(
                            source.sourceType,
                          )}
                        </td>

                        <td>
                          {readable(
                            source.sourceStatus,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              `alignment-status alignment-status--${source.alignmentStatus.toLowerCase()}`
                            }
                          >
                            {source.directAllocationPct.toFixed(
                              0,
                            )}
                            %
                            {" · "}
                            {readable(
                              source.alignmentStatus,
                            )}
                          </span>
                        </td>

                        <td>
                          {source.linkedObjectiveCount}
                          {source.okrContributionCount >
                          0
                            ? ` · ${source.okrContributionCount} KR contribution(s)`
                            : ""}
                        </td>

                        <td>
                          {money(
                            source.strategicValue,
                            currency,
                          )}
                        </td>

                        <td>
                          {money(
                            source.riskExposure,
                            currency,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              source.deadlineConflictCount >
                              0
                                ? "alignment-risk-text"
                                : ""
                            }
                          >
                            {source.deadlineConflictCount}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Executive record
            </span>

            <h2>
              Immutable alignment reviews
            </h2>
          </div>

          <Camera
            size={19}
          />
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Review</th>
                <th>Score</th>
                <th>Health</th>
                <th>Aligned</th>
                <th>Unaligned</th>
                <th>Conflicts</th>
                <th>Captured</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.reviews
                  .map(
                    review => (
                      <tr
                        key={review.id}
                      >
                        <td>
                          <strong>
                            {review.reviewNumber}
                          </strong>
                        </td>

                        <td>
                          {review.alignmentScore.toFixed(
                            1,
                          )}
                        </td>

                        <td>
                          {readable(
                            review.alignmentHealth,
                          )}
                        </td>

                        <td>
                          {review.alignedSourceCount}
                        </td>

                        <td>
                          {review.unalignedSourceCount}
                        </td>

                        <td>
                          {review.deadlineConflictCount}
                        </td>

                        <td>
                          {new Date(
                            review.capturedAt,
                          )
                            .toLocaleString()}
                        </td>

                        <td>
                          <Link
                            href={
                              `/strategic-alignment/reviews/${review.id}`
                            }
                            className="table-action"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.reviews
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No strategic alignment
                    reviews captured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="alignment-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Explainable portfolio alignment
          </strong>

          <p>
            The alignment score combines
            source coverage, objective
            coverage, strategic-value
            coverage, risk-exposure
            coverage and schedule
            alignment. Source operational
            records are never rewritten.
          </p>
        </div>
      </section>
    </div>
  );
}
