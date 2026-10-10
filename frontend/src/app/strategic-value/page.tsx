"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Camera,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  captureStrategicValueReview,
  createStrategicValueCase,
  getStrategicValueDashboard,
} from "@/lib/api";

import type {
  StrategicValueDashboard,
} from "@/types/strategic-value";

import {
  type FormEvent,
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
  currency = "",
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}${currency ? ` ${currency}` : ""}`;
}

export default function StrategicValuePage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategicValueDashboard |
      null
    >(null);

  const [
    persistencePlanId,
    setPersistencePlanId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    investment,
    setInvestment,
  ] =
    useState(10000);

  const [
    annualOperatingCost,
    setAnnualOperatingCost,
  ] =
    useState(1000);

  const [
    annualizedValue,
    setAnnualizedValue,
  ] =
    useState(15000);

  const [
    horizonMonths,
    setHorizonMonths,
  ] =
    useState(36);

  const [
    targetRoi,
    setTargetRoi,
  ] =
    useState(20);

  const [
    targetPayback,
    setTargetPayback,
  ] =
    useState(24);

  const [
    valuationNote,
    setValuationNote,
  ] =
    useState("");

  const [
    running,
    setRunning,
  ] =
    useState(false);

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

    getStrategicValueDashboard()
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
            response,
          );

          if (
            response.candidates[0]
          ) {
            setPersistencePlanId(
              response.candidates[0].persistencePlanId,
            );
          }

          if (
            response.users[0]
          ) {
            setOwnerUserId(
              response.users[0].id,
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
                : "Unable to load strategic value governance.",
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
  }, []);

  async function reload() {
    setDashboard(
      await getStrategicValueDashboard(),
    );
  }

  async function createCase(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !persistencePlanId
      ||
      !ownerUserId
      ||
      !valuationNote.trim()
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createStrategicValueCase(
        persistencePlanId,
        {
          valueOwnerUserId:
            ownerUserId,
          investmentCostAmount:
            investment,
          annualOperatingCostAmount:
            annualOperatingCost,
          annualizedValueAmount:
            annualizedValue,
          valueHorizonMonths:
            horizonMonths,
          targetRoiPct:
            targetRoi,
          targetPaybackMonths:
            targetPayback,
          valuationNote:
            valuationNote.trim(),
        },
      );

      setValuationNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create strategic value case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function captureReview() {
    try {
      setRunning(true);
      setError(null);

      await captureStrategicValueReview();

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture strategic value review.",
      );
    } finally {
      setRunning(false);
    }
  }

  const summary =
    dashboard?.summary;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Durable value economics
          </span>

          <h1>
            Strategic value portfolio
          </h1>

          <p>
            Govern financial investment
            assumptions separately from
            Step 53 contribution points,
            apply Step 55 persistence to
            durable value, and measure
            long-term ROI, payback and
            value at risk.
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            className="button button--primary"
            disabled={running}
            onClick={
              () =>
                void captureReview()
            }
          >
            <Camera
              size={15}
            />
            Capture review
          </button>
        ) : null}
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="value-score-grid">
        <article className="value-score-card">
          <span>
            Portfolio ROI
          </span>

          <strong>
            {(
              summary
                ?.portfolioRoiPct ??
                0
            ).toFixed(1)}
            %
          </strong>

          <small>
            {summary
              ? readable(
                  summary.portfolioHealth,
                )
              : "—"}
          </small>
        </article>

        <article>
          <span>
            Net horizon value
          </span>

          <strong>
            {money(
              summary
                ?.totalNetValueAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Durable horizon value
          </span>

          <strong>
            {money(
              summary
                ?.totalDurableHorizonValueAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Value at risk
          </span>

          <strong className="value-risk-text">
            {money(
              summary
                ?.totalValueAtRiskAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Investment
          </span>

          <strong>
            {money(
              summary
                ?.totalInvestmentAmount ??
                0,
            )}
          </strong>
        </article>

        <article>
          <span>
            Portfolio payback
          </span>

          <strong>
            {summary
              ?.portfolioPaybackMonths ===
                null
              ||
              summary
                ?.portfolioPaybackMonths ===
                undefined
                ? "N/A"
                : `${summary.portfolioPaybackMonths.toFixed(1)} mo`}
          </strong>
        </article>
      </section>

      <section className="value-signal-grid">
        <article>
          <span>
            Eligible candidates
          </span>

          <strong>
            {summary
              ?.candidateCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Active cases
          </span>

          <strong>
            {summary
              ?.caseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Verified
          </span>

          <strong>
            {summary
              ?.verifiedCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Strong
          </span>

          <strong>
            {summary
              ?.strongCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Watch
          </span>

          <strong>
            {summary
              ?.watchCaseCount ??
              0}
          </strong>
        </article>

        <article>
          <span>
            At risk
          </span>

          <strong className="value-risk-text">
            {summary
              ?.atRiskCaseCount ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Persistence-verified sources
            </span>

            <h2>
              Eligible durable-value candidates
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Outcome</th>
                <th>Persistence</th>
                <th>Health</th>
                <th>Step 53 validated</th>
                <th>Current persistent</th>
                <th>Decay</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <tr
                        key={candidate.persistencePlanId}
                      >
                        <td>
                          <div className="request-primary-cell">
                            <strong>
                              {candidate.initiativeTitle}
                            </strong>

                            <span>
                              {candidate.persistencePlanNumber}
                              {" · "}
                              {candidate.commitmentNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          {candidate.persistencePct.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {readable(
                            candidate.persistenceHealth,
                          )}
                        </td>

                        <td>
                          {candidate.step53ValidatedContributionPoints.toFixed(
                            1,
                          )}
                          {" pts"}
                        </td>

                        <td>
                          {candidate.currentPersistenceValidatedPoints.toFixed(
                            1,
                          )}
                          {" pts"}
                        </td>

                        <td>
                          {candidate.decayPoints.toFixed(
                            1,
                          )}
                          {" pts"}
                        </td>

                        <td>
                          <Link
                            href={
                              `/outcome-persistence/${candidate.persistencePlanId}`
                            }
                            className="table-action"
                          >
                            Persistence evidence
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

              {!loading &&
              (
                dashboard
                  ?.candidates
                  .length ??
                0
              ) ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No sustained Step 55
                    outcome is currently
                    awaiting strategic
                    value governance.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      {canManage &&
      (
        dashboard
          ?.candidates
          .length ??
        0
      ) >
        0 ? (
        <form
          className="panel"
          onSubmit={createCase}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governed monetization
              </span>

              <h2>
                Create strategic value case
              </h2>
            </div>

            <Goal
              size={19}
            />
          </div>

          <div className="value-case-form">
            <label className="request-field value-form-wide">
              <span>
                Sustained outcome
              </span>

              <select
                value={persistencePlanId}
                onChange={
                  event =>
                    setPersistencePlanId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.candidates
                  .map(
                    candidate => (
                      <option
                        key={candidate.persistencePlanId}
                        value={candidate.persistencePlanId}
                      >
                        {candidate.persistencePlanNumber}
                        {" — "}
                        {candidate.initiativeTitle}
                        {" · "}
                        {candidate.persistencePct.toFixed(
                          1,
                        )}
                        {"% persistent"}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Value owner
              </span>

              <select
                value={ownerUserId}
                onChange={
                  event =>
                    setOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {dashboard
                  ?.users
                  .map(
                    candidate => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Investment cost
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={investment}
                onChange={
                  event =>
                    setInvestment(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Annual operating cost
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={annualOperatingCost}
                onChange={
                  event =>
                    setAnnualOperatingCost(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Annualized financial value
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={annualizedValue}
                onChange={
                  event =>
                    setAnnualizedValue(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Value horizon months
              </span>

              <input
                type="number"
                min="1"
                max="600"
                value={horizonMonths}
                onChange={
                  event =>
                    setHorizonMonths(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Target ROI %
              </span>

              <input
                type="number"
                min="-100"
                max="10000"
                step="0.1"
                value={targetRoi}
                onChange={
                  event =>
                    setTargetRoi(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Target payback months
              </span>

              <input
                type="number"
                min="1"
                max="600"
                step="0.1"
                value={targetPayback}
                onChange={
                  event =>
                    setTargetPayback(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field value-form-wide">
              <span>
                Valuation evidence / assumption note
              </span>

              <textarea
                required
                rows={6}
                value={valuationNote}
                onChange={
                  event =>
                    setValuationNote(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="value-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !persistencePlanId
                ||
                !ownerUserId
                ||
                !valuationNote.trim()
              }
            >
              Create value case
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Long-term value cases
            </span>

            <h2>
              Strategic ROI portfolio
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Health</th>
                <th>Persistence</th>
                <th>Investment</th>
                <th>Durable value</th>
                <th>Decay / VAR</th>
                <th>Net value</th>
                <th>ROI</th>
                <th>Payback</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
                ?.cases
                .map(
                  valueCase => (
                    <tr
                      key={valueCase.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {valueCase.initiativeTitle}
                          </strong>

                          <span>
                            {valueCase.caseNumber}
                            {" · "}
                            {valueCase.persistencePlanNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          valueCase.status,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `value-health value-health--${valueCase.valueHealth.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            valueCase.valueHealth,
                          )}
                        </span>
                      </td>

                      <td>
                        {valueCase.persistencePct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {money(
                          valueCase.investmentCostAmount,
                          valueCase.currency,
                        )}
                      </td>

                      <td>
                        {money(
                          valueCase.durableHorizonValueAmount,
                          valueCase.currency,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            valueCase.valueAtRiskAmount >
                            0
                              ? "value-risk-text"
                              : ""
                          }
                        >
                          {money(
                            valueCase.valueAtRiskAmount,
                            valueCase.currency,
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          valueCase.netValueAmount,
                          valueCase.currency,
                        )}
                      </td>

                      <td>
                        {valueCase.roiPct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {valueCase.paybackMonths ===
                        null
                          ? "N/A"
                          : `${valueCase.paybackMonths.toFixed(1)} mo`}
                      </td>

                      <td>
                        <Link
                          href={
                            `/strategic-value/${valueCase.id}`
                          }
                          className="table-action"
                        >
                          Open
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
              Immutable executive evidence
            </span>

            <h2>
              Value portfolio reviews
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
                <th>Health</th>
                <th>Cases</th>
                <th>Verified</th>
                <th>Investment</th>
                <th>Durable value</th>
                <th>Decay</th>
                <th>Net value</th>
                <th>ROI</th>
                <th>Captured</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {dashboard
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
                        {readable(
                          review.portfolioHealth,
                        )}
                      </td>

                      <td>
                        {review.caseCount}
                      </td>

                      <td>
                        {review.verifiedCaseCount}
                      </td>

                      <td>
                        {money(
                          review.totalInvestmentAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          review.totalDurableHorizonValueAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          review.totalDecayedValueAmount,
                        )}
                      </td>

                      <td>
                        {money(
                          review.totalNetValueAmount,
                        )}
                      </td>

                      <td>
                        {review.portfolioRoiPct.toFixed(
                          1,
                        )}
                        %
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
                            `/strategic-value/reviews/${review.id}`
                          }
                          className="table-action"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="value-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Contribution points are not currency
          </strong>

          <p>
            Step 53 and Step 55 points
            remain evidence of strategic
            contribution and persistence.
            Financial value, investment
            and operating cost are
            separately governed Step 56
            assumptions. ProcureIQ never
            silently converts contribution
            points into money.
          </p>
        </div>
      </section>
    </div>
  );
}
