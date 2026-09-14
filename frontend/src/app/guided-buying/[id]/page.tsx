"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Link2,
  RefreshCw,
  Route,
  ShieldAlert,
  Star,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  cancelGuidedBuyingIntake,
  getGuidedBuyingContext,
  getGuidedBuyingIntake,
  linkGuidedBuyingRequest,
  markGuidedBuyingReady,
  refreshGuidedBuyingRecommendation,
} from "@/lib/api";

import type {
  GuidedBuyingContext,
  GuidedBuyingIntake,
} from "@/types/guided-buying";

import {
  useEffect,
  useMemo,
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
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export default function GuidedBuyingDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  useAuth();

  const [
    intake,
    setIntake,
  ] =
    useState<
      GuidedBuyingIntake |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      GuidedBuyingContext |
      null
    >(null);

  const [
    requestId,
    setRequestId,
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

  useEffect(() => {
    let active = true;

    Promise.all([
      getGuidedBuyingIntake(
        params.id,
      ),
      getGuidedBuyingContext(),
    ])
      .then(
        ([
          intakeResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setIntake(
            intakeResponse,
          );

          setContext(
            contextResponse,
          );

          setError(null);
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
              ? caughtError.message
              : "Unable to load guided-buying intake.",
          );
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

  const preferredSuppliers =
    useMemo(
      () => {
        if (
          !intake
          ||
          !context
        ) {
          return [];
        }

        return context
          .preferredSuppliers
          .filter(
            preferred =>
              preferred.active
              &&
              preferred.category.toLowerCase() ===
                intake.category.toLowerCase(),
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.preferenceRank -
              right.preferenceRank,
          );
      },
      [
        intake,
        context,
      ],
    );

  const availableRequests =
    useMemo(
      () => {
        if (
          !intake
          ||
          !context
        ) {
          return [];
        }

        return context.purchaseRequests
          .filter(
            request =>
              request.departmentId ===
                intake.departmentId
              &&
              request.currency ===
                intake.currency,
          );
      },
      [
        intake,
        context,
      ],
    );

  async function reload() {
    setIntake(
      await getGuidedBuyingIntake(
        params.id,
      ),
    );
  }

  async function runAction(
    action:
      | "REFRESH"
      | "READY"
      | "CANCEL",
  ) {
    if (!intake) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "REFRESH"
      ) {
        await refreshGuidedBuyingRecommendation(
          intake.id,
        );
      } else if (
        action ===
        "READY"
      ) {
        await markGuidedBuyingReady(
          intake.id,
        );
      } else {
        await cancelGuidedBuyingIntake(
          intake.id,
        );
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update guided-buying intake.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function linkRequest() {
    if (
      !intake
      ||
      !requestId
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await linkGuidedBuyingRequest(
        intake.id,
        requestId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to link purchase request.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading guided-buying
        intake...
      </div>
    );
  }

  if (!intake) {
    return (
      <div className="page-stack">
        <Link
          href="/guided-buying"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Guided buying
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Guided-buying intake not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/guided-buying"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Guided buying
      </Link>

      <section className="guided-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {intake.intakeNumber}
            </span>

            <span
              className={
                `guided-status guided-status--${intake.status.toLowerCase()}`
              }
            >
              {readable(
                intake.status,
              )}
            </span>

            <span
              className={
                `guided-route guided-route--${intake.guidanceRoute.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                intake.guidanceRoute,
              )}
            </span>
          </div>

          <h1>
            {intake.title}
          </h1>

          <p>
            {intake.departmentName}
            {" · "}
            {intake.category}
            {" · "}
            {money(
              intake.estimatedAmount,
              intake.currency,
            )}
            {" · Requester: "}
            {intake.requesterName}
          </p>
        </div>

        <div className="guided-detail-actions">
          {intake.status !==
          "CANCELLED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void runAction(
                    "REFRESH",
                  )
              }
            >
              <RefreshCw
                size={16}
              />
              Refresh guidance
            </button>
          ) : null}

          {intake.status ===
          "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void runAction(
                    "READY",
                  )
              }
            >
              <BadgeCheck
                size={16}
              />
              Mark ready
            </button>
          ) : null}

          {(
            intake.status ===
              "DRAFT"
            ||
            intake.status ===
              "READY"
          ) ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void runAction(
                    "CANCEL",
                  )
              }
            >
              <XCircle
                size={16}
              />
              Cancel
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

      <section className="guided-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Buying guidance
              </span>

              <h2>
                Recommended route
              </h2>
            </div>

            <Route
              size={19}
            />
          </div>

          <div className="guided-detail-recommendation">
            <span
              className={
                `guided-route guided-route--${intake.guidanceRoute.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                intake.guidanceRoute,
              )}
            </span>

            <p>
              {intake.guidanceSummary}
            </p>

            {intake.supplierRiskLevel ? (
              <div className="guided-risk-context">
                <ShieldAlert
                  size={16}
                />

                <span>
                  Selected supplier risk:
                  {" "}
                  <strong>
                    {intake.supplierRiskLevel}
                  </strong>
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Preferred supply
              </span>

              <h2>
                Recommended suppliers
              </h2>
            </div>

            <Star
              size={19}
            />
          </div>

          {preferredSuppliers.length ===
          0 ? (
            <div className="guided-empty">
              No preferred suppliers
              configured for
              {" "}
              {intake.category}.
            </div>
          ) : (
            <div className="guided-recommend-suppliers">
              {preferredSuppliers
                .slice(
                  0,
                  6,
                )
                .map(
                  preferred => (
                    <article
                      key={preferred.id}
                    >
                      <span>
                        #{preferred.preferenceRank}
                      </span>

                      <div>
                        <strong>
                          {preferred.supplierName}
                        </strong>

                        <small>
                          {preferred.supplierCode}
                          {" · Rating "}
                          {preferred.supplierRating.toFixed(1)}
                          {" · Risk "}
                          {preferred.supplierRiskLevel ??
                            "—"}
                        </small>
                      </div>
                    </article>
                  ),
                )}
            </div>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Intake context
            </span>

            <h2>
              Business request
            </h2>
          </div>

          <FileCheck2
            size={19}
          />
        </div>

        <div className="guided-context-grid">
          <div>
            <span>
              Department
            </span>

            <strong>
              {intake.departmentName}
            </strong>
          </div>

          <div>
            <span>
              Category
            </span>

            <strong>
              {intake.category}
            </strong>
          </div>

          <div>
            <span>
              Estimated amount
            </span>

            <strong>
              {money(
                intake.estimatedAmount,
                intake.currency,
              )}
            </strong>
          </div>

          <div>
            <span>
              Selected supplier
            </span>

            <strong>
              {intake.supplierName ??
                "Not selected"}
            </strong>
          </div>

          <div>
            <span>
              Template
            </span>

            <strong>
              {intake.templateCode
                ? `${intake.templateCode} — ${intake.templateName}`
                : "No template"}
            </strong>
          </div>

          <div>
            <span>
              Requester
            </span>

            <strong>
              {intake.requesterName}
            </strong>
          </div>
        </div>

        {intake.description ? (
          <div className="guided-description">
            {intake.description}
          </div>
        ) : null}
      </section>

      {intake.status ===
      "CONVERTED" ? (
        <section className="guided-converted-card">
          <BadgeCheck
            size={19}
          />

          <div>
            <span>
              Converted to purchase request
            </span>

            <strong>
              {intake.linkedRequestNumber}
            </strong>

            <small>
              {intake.linkedRequestStatus}
              {intake.convertedAt
                ? ` · ${new Date(
                    intake.convertedAt,
                  ).toLocaleString()}`
                : ""}
            </small>
          </div>

          {intake.linkedPurchaseRequestId ? (
            <Link
              href={
                `/requests/${intake.linkedPurchaseRequestId}`
              }
              className="button button--secondary"
            >
              <ExternalLink
                size={16}
              />
              Open request
            </Link>
          ) : null}
        </section>
      ) : null}

      {(
        intake.status ===
          "DRAFT"
        ||
        intake.status ===
          "READY"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Purchase-request handoff
              </span>

              <h2>
                Link created request
              </h2>
            </div>

            <Link2
              size={19}
            />
          </div>

          <p className="guided-link-help">
            Create the formal purchase
            request using the existing
            request workflow, then link
            it here to complete the
            guided-buying conversion.
          </p>

          <div className="guided-link-controls">
            <Link
              href="/requests/new"
              className="button button--secondary"
            >
              <ExternalLink
                size={16}
              />
              Open request form
            </Link>

            <select
              value={requestId}
              onChange={
                event =>
                  setRequestId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                Select matching purchase request
              </option>

              {availableRequests.map(
                request => (
                  <option
                    key={request.id}
                    value={request.id}
                  >
                    {request.requestNumber}
                    {" — "}
                    {request.title}
                    {" — "}
                    {request.currency}
                    {" "}
                    {request.estimatedTotal}
                  </option>
                ),
              )}
            </select>

            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !requestId
              }
              onClick={
                () =>
                  void linkRequest()
              }
            >
              <Link2
                size={16}
              />
              Link request
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
