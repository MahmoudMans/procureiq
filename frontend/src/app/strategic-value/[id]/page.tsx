"use client";

import {
  ArrowLeft,
  CircleAlert,
  Goal,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  closeStrategicValueCase,
  getStrategicValueCase,
  submitStrategicValueForReview,
  verifyStrategicValueCase,
} from "@/lib/api";

import type {
  StrategicValueCaseDetail,
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
  currency: string,
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${currency}`;
}

export default function StrategicValueCasePage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      StrategicValueCaseDetail |
      null
    >(null);

  const [
    governanceNote,
    setGovernanceNote,
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

  const canFinalize =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getStrategicValueCase(
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
                : "Unable to load strategic value case.",
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

  async function submitForReview() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await submitStrategicValueForReview(
          params.id,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to submit strategic value case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function verifyCase() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await verifyStrategicValueCase(
          params.id,
          governanceNote,
        ),
      );

      setGovernanceNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to verify strategic value case.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeCase() {
    if (!governanceNote.trim()) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeStrategicValueCase(
          params.id,
          governanceNote,
        ),
      );

      setGovernanceNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close strategic value case.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading strategic value case...
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
            "Strategic value case not found."}
        </div>
      </div>
    );
  }

  const valueCase =
    detail.valueCase;

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
            Long-term ROI governance
          </span>

          <h1>
            {valueCase.initiativeTitle}
          </h1>

          <p>
            {valueCase.caseNumber}
            {" · "}
            {valueCase.persistencePlanNumber}
            {" · "}
            {valueCase.commitmentNumber}
          </p>
        </div>

        <span
          className={
            `value-health value-health--${valueCase.valueHealth.toLowerCase().replaceAll("_", "-")}`
          }
        >
          {readable(
            valueCase.valueHealth,
          )}
        </span>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="value-detail-grid">
        <article className="value-score-card">
          <span>
            ROI
          </span>

          <strong>
            {valueCase.roiPct.toFixed(
              1,
            )}
            %
          </strong>

          <small>
            Target
            {" "}
            {valueCase.targetRoiPct.toFixed(
              1,
            )}
            %
          </small>
        </article>

        <article>
          <span>
            Investment
          </span>

          <strong>
            {money(
              valueCase.investmentCostAmount,
              valueCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Durable value
          </span>

          <strong>
            {money(
              valueCase.durableHorizonValueAmount,
              valueCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Net value
          </span>

          <strong>
            {money(
              valueCase.netValueAmount,
              valueCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Value at risk
          </span>

          <strong className="value-risk-text">
            {money(
              valueCase.valueAtRiskAmount,
              valueCase.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Payback
          </span>

          <strong>
            {valueCase.paybackMonths ===
            null
              ? "N/A"
              : `${valueCase.paybackMonths.toFixed(1)} mo`}
          </strong>

          <small>
            Target
            {" "}
            {valueCase.targetPaybackMonths.toFixed(
              1,
            )}
            {" mo"}
          </small>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Durable-value bridge
            </span>

            <h2>
              Persistence-adjusted economics
            </h2>
          </div>

          <Goal
            size={19}
          />
        </div>

        <div className="value-bridge-grid">
          <div>
            <span>
              Step 53 validated contribution
            </span>

            <strong>
              {valueCase.step53ValidatedContributionPoints.toFixed(
                1,
              )}
              {" pts"}
            </strong>
          </div>

          <div>
            <span>
              Step 55 persistence
            </span>

            <strong>
              {valueCase.persistencePct.toFixed(
                1,
              )}
              %
            </strong>
          </div>

          <div>
            <span>
              Annualized baseline value
            </span>

            <strong>
              {money(
                valueCase.annualizedValueAmount,
                valueCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Durable annual value
            </span>

            <strong>
              {money(
                valueCase.durableAnnualValueAmount,
                valueCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Baseline horizon value
            </span>

            <strong>
              {money(
                valueCase.baselineHorizonValueAmount,
                valueCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Decayed value
            </span>

            <strong className="value-risk-text">
              {money(
                valueCase.decayedValueAmount,
                valueCase.currency,
              )}
            </strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Financial authority
            </span>

            <h2>
              Governed valuation baseline
            </h2>
          </div>
        </div>

        <div className="value-financial-grid">
          <div>
            <span>Value owner</span>
            <strong>
              {valueCase.valueOwnerName}
            </strong>
          </div>

          <div>
            <span>Currency</span>
            <strong>
              {valueCase.currency}
            </strong>
          </div>

          <div>
            <span>Horizon</span>
            <strong>
              {valueCase.valueHorizonMonths}
              {" months"}
            </strong>
          </div>

          <div>
            <span>Annual operating cost</span>
            <strong>
              {money(
                valueCase.annualOperatingCostAmount,
                valueCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>Total cost</span>
            <strong>
              {money(
                valueCase.totalCostAmount,
                valueCase.currency,
              )}
            </strong>
          </div>

          <div>
            <span>Status</span>
            <strong>
              {readable(
                valueCase.status,
              )}
            </strong>
          </div>
        </div>

        <div className="value-valuation-note">
          <strong>
            Valuation evidence
          </strong>

          <p>
            {valueCase.valuationNote}
          </p>
        </div>
      </section>

      <div className="value-source-links">
        <Link
          href={
            `/outcome-persistence/${valueCase.persistencePlanId}`
          }
          className="table-action"
        >
          Step 55 persistence evidence
        </Link>

        <Link
          href={
            `/strategy-execution/${valueCase.commitmentId}`
          }
          className="table-action"
        >
          Step 53 execution evidence
        </Link>
      </div>

      {canManage &&
      valueCase.status ===
        "ACTIVE" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent review gate
              </span>

              <h2>
                Submit value case
              </h2>
            </div>
          </div>

          <p className="value-governance-copy">
            Submission freezes the
            governed financial assumptions
            for independent management
            verification. Upstream Step 53
            and Step 55 evidence remains
            read-only.
          </p>

          <div className="value-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitForReview()
              }
            >
              Submit for review
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      valueCase.status ===
        "READY_FOR_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Independent financial governance
              </span>

              <h2>
                Verify value case
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Verification note
            </span>

            <textarea
              rows={6}
              value={governanceNote}
              onChange={
                event =>
                  setGovernanceNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="value-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !governanceNote.trim()
              }
              onClick={
                () =>
                  void verifyCase()
              }
            >
              Verify value case
            </button>
          </div>
        </section>
      ) : null}

      {canFinalize &&
      valueCase.status ===
        "VERIFIED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance closure
              </span>

              <h2>
                Close value case
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Closure note
            </span>

            <textarea
              rows={6}
              value={governanceNote}
              onChange={
                event =>
                  setGovernanceNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="value-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !governanceNote.trim()
              }
              onClick={
                () =>
                  void closeCase()
              }
            >
              Close value case
            </button>
          </div>
        </section>
      ) : null}

      {valueCase.verificationNote ? (
        <section className="value-verification-note">
          <strong>
            Independent verification
          </strong>

          <p>
            {valueCase.verificationNote}
          </p>

          <small>
            {valueCase.verifiedByName}
            {" · "}
            {valueCase.verifiedAt
              ? new Date(
                  valueCase.verifiedAt,
                )
                  .toLocaleString()
              : ""}
          </small>
        </section>
      ) : null}

      <section className="value-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            ROI uses only governed monetary assumptions
          </strong>

          <p>
            Persistence percentage adjusts
            the separately entered
            financial value baseline.
            Contribution points remain
            non-monetary evidence and are
            displayed only for
            traceability.
          </p>
        </div>
      </section>
    </div>
  );
}
