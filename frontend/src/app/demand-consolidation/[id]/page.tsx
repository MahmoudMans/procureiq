"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CircleAlert,
  Coins,
  ExternalLink,
  Layers3,
  Link2,
  Send,
  Target,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  approveDemandConsolidationBundle,
  cancelDemandConsolidationBundle,
  closeDemandConsolidationBundle,
  getDemandConsolidationBundle,
  getDemandConsolidationContext,
  linkDemandConsolidationRfq,
  submitDemandConsolidationBundle,
} from "@/lib/api";

import type {
  DemandBundle,
  DemandConsolidationContext,
} from "@/types/demand-consolidation";

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
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export default function DemandBundleDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    bundle,
    setBundle,
  ] =
    useState<
      DemandBundle |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      DemandConsolidationContext |
      null
    >(null);

  const [
    decisionNote,
    setDecisionNote,
  ] =
    useState("");

  const [
    rfqId,
    setRfqId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
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

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getDemandConsolidationBundle(
        params.id,
      ),
      getDemandConsolidationContext(),
    ])
      .then(
        ([
          bundleResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setBundle(
            bundleResponse,
          );

          setContext(
            contextResponse,
          );

          const firstRfq =
            contextResponse.rfqs.find(
              rfq =>
                rfq.currency ===
                  bundleResponse.currency,
            );

          if (firstRfq) {
            setRfqId(
              firstRfq.id,
            );
          }

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
              : "Unable to load demand bundle.",
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

  async function reload() {
    setBundle(
      await getDemandConsolidationBundle(
        params.id,
      ),
    );
  }

  async function submitBundle() {
    if (!bundle) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await submitDemandConsolidationBundle(
        bundle.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to submit demand bundle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function approveBundle() {
    if (!bundle) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await approveDemandConsolidationBundle(
        bundle.id,
        decisionNote,
      );

      setDecisionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to approve demand bundle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelBundle() {
    if (!bundle) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await cancelDemandConsolidationBundle(
        bundle.id,
        decisionNote,
      );

      setDecisionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel demand bundle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function linkRfq() {
    if (
      !bundle
      ||
      !rfqId
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await linkDemandConsolidationRfq(
        bundle.id,
        rfqId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to link RFQ to demand bundle.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeBundle() {
    if (!bundle) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await closeDemandConsolidationBundle(
        bundle.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close demand bundle.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading demand bundle...
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="page-stack">
        <Link
          href="/demand-consolidation"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Demand consolidation
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Demand bundle not found."}
        </div>
      </div>
    );
  }

  const compatibleRfqs =
    context
      ?.rfqs
      .filter(
        rfq =>
          rfq.currency ===
          bundle.currency,
      )
      ??
    [];

  return (
    <div className="page-stack">
      <Link
        href="/demand-consolidation"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Demand consolidation
      </Link>

      <section className="demand-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {bundle.bundleNumber}
            </span>

            <span
              className={
                `demand-status demand-status--${bundle.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                bundle.status,
              )}
            </span>
          </div>

          <h1>
            {bundle.title}
          </h1>

          <p>
            {bundle.category}
            {" · "}
            {bundle.departmentCount}
            {" departments · "}
            {bundle.intakeCount}
            {" intakes · Owner: "}
            {bundle.ownerName}
          </p>
        </div>

        <div className="demand-detail-actions">
          {canManage &&
          bundle.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void submitBundle()
              }
            >
              <Send
                size={16}
              />
              Submit for review
            </button>
          ) : null}

          {canManage &&
          bundle.status ===
            "SOURCING" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void closeBundle()
              }
            >
              <BadgeCheck
                size={16}
              />
              Close bundle
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

      <section className="demand-detail-kpis">
        <article className="request-detail-summary-card">
          <Layers3
            size={18}
          />

          <div>
            <span>
              Consolidated demand
            </span>

            <strong>
              {money(
                bundle.consolidatedValue,
                bundle.currency,
              )}
            </strong>

            <small>
              {bundle.intakeCount}
              {" combined intakes"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Building2
            size={18}
          />

          <div>
            <span>
              Departments
            </span>

            <strong>
              {bundle.departmentCount}
            </strong>

            <small>
              Participating business units
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Target
            size={18}
          />

          <div>
            <span>
              Expected leverage
            </span>

            <strong>
              {bundle.expectedLeveragePct.toFixed(1)}
              %
            </strong>

            <small>
              Consolidation leverage model
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Coins
            size={18}
          />

          <div>
            <span>
              Expected savings
            </span>

            <strong>
              {money(
                bundle.expectedSavings,
                bundle.currency,
              )}
            </strong>

            <small>
              Estimated sourcing opportunity
            </small>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Consolidated demand
            </span>

            <h2>
              Bundle composition
            </h2>
          </div>

          <Layers3
            size={19}
          />
        </div>

        <div className="demand-bundle-items">
          {bundle.items.map(
            item => (
              <article
                key={item.id}
              >
                <div>
                  <strong>
                    {item.intakeNumber}
                    {" · "}
                    {item.title}
                  </strong>

                  <span>
                    {item.departmentName}
                    {" · "}
                    {readable(
                      item.guidanceRoute,
                    )}
                    {" · "}
                    {readable(
                      item.intakeStatus,
                    )}
                  </span>
                </div>

                <strong>
                  {money(
                    item.estimatedAmount,
                    bundle.currency,
                  )}
                </strong>

                <Link
                  href={
                    `/guided-buying/${item.intakeId}`
                  }
                  className="table-action"
                >
                  Open
                </Link>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="demand-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Sourcing timeline
              </span>

              <h2>
                Governance context
              </h2>
            </div>
          </div>

          <div className="demand-context-grid">
            <div>
              <span>
                Target sourcing date
              </span>

              <strong>
                {new Date(
                  `${bundle.targetSourcingDate}T00:00:00`,
                )
                  .toLocaleDateString()}
              </strong>
            </div>

            <div>
              <span>
                Currency
              </span>

              <strong>
                {bundle.currency}
              </strong>
            </div>

            <div>
              <span>
                Owner
              </span>

              <strong>
                {bundle.ownerName}
              </strong>
            </div>

            <div>
              <span>
                Linked RFQ
              </span>

              <strong>
                {bundle.linkedRfqNumber ??
                  "Not linked"}
              </strong>
            </div>
          </div>

          {bundle.rationale ? (
            <div className="demand-rationale">
              {bundle.rationale}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Sourcing handoff
              </span>

              <h2>
                RFQ opportunity
              </h2>
            </div>

            <Link2
              size={19}
            />
          </div>

          {bundle.status ===
          "APPROVED" ? (
            <>
              <p className="demand-sourcing-help">
                Create the consolidated
                RFQ through the existing
                sourcing workflow, then
                link it here to move the
                bundle into sourcing.
              </p>

              <div className="demand-rfq-controls">
                <Link
                  href="/rfqs/new"
                  className="button button--secondary"
                >
                  <ExternalLink
                    size={16}
                  />
                  Open RFQ form
                </Link>

                <select
                  value={rfqId}
                  onChange={
                    event =>
                      setRfqId(
                        event.target.value,
                      )
                  }
                >
                  <option value="">
                    Select matching RFQ
                  </option>

                  {compatibleRfqs.map(
                    rfq => (
                      <option
                        key={rfq.id}
                        value={rfq.id}
                      >
                        {rfq.rfqNumber}
                        {" — "}
                        {rfq.title}
                        {" — "}
                        {rfq.status}
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
                    !rfqId
                  }
                  onClick={
                    () =>
                      void linkRfq()
                  }
                >
                  <Link2
                    size={16}
                  />
                  Link RFQ
                </button>
              </div>
            </>
          ) : bundle.linkedRfqId ? (
            <div className="demand-linked-rfq">
              <BadgeCheck
                size={18}
              />

              <div>
                <span>
                  Sourcing opportunity
                </span>

                <strong>
                  {bundle.linkedRfqNumber}
                  {" · "}
                  {bundle.linkedRfqTitle}
                </strong>

                <small>
                  {bundle.linkedRfqStatus}
                  {bundle.sourcingStartedAt
                    ? ` · linked ${new Date(
                        bundle.sourcingStartedAt,
                      ).toLocaleString()}`
                    : ""}
                </small>
              </div>

              <Link
                href={
                  `/rfqs/${bundle.linkedRfqId}`
                }
                className="table-action"
              >
                Open RFQ
              </Link>
            </div>
          ) : (
            <div className="demand-empty">
              RFQ linkage becomes
              available after bundle
              approval.
            </div>
          )}
        </section>
      </section>

      {canApprove &&
      bundle.status ===
        "UNDER_REVIEW" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Consolidation governance
              </span>

              <h2>
                Bundle decision
              </h2>
            </div>

            <BadgeCheck
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Decision rationale
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="demand-decision-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void cancelBundle()
              }
            >
              <XCircle
                size={16}
              />
              Reject bundle
            </button>

            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void approveBundle()
              }
            >
              <BadgeCheck
                size={16}
              />
              Approve bundle
            </button>
          </div>
        </section>
      ) : null}

      {canApprove &&
      (
        bundle.status ===
          "DRAFT"
        ||
        bundle.status ===
          "APPROVED"
      ) ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Bundle controls
              </span>

              <h2>
                Cancel consolidation
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Cancellation rationale
            </span>

            <textarea
              rows={4}
              maxLength={2000}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="demand-decision-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running
                ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void cancelBundle()
              }
            >
              <XCircle
                size={16}
              />
              Cancel bundle
            </button>
          </div>
        </section>
      ) : null}

      {bundle.decisionNote ? (
        <section className="demand-decision-card">
          <BadgeCheck
            size={19}
          />

          <div>
            <span>
              Governance decision
            </span>

            <strong>
              {bundle.decisionNote}
            </strong>

            <small>
              {bundle.decidedByName ??
                "Procurement management"}
              {bundle.decidedAt
                ? ` · ${new Date(
                    bundle.decidedAt,
                  ).toLocaleString()}`
                : ""}
            </small>
          </div>
        </section>
      ) : null}
    </div>
  );
}
