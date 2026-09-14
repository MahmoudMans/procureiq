"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Plus,
  ShieldAlert,
  TicketCheck,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addPolicyEvidence,
  approvePolicyWaiver,
  getPolicyViolation,
  rejectPolicyWaiver,
  requestPolicyWaiver,
  resolvePolicyViolation,
} from "@/lib/api";

import type {
  PolicyEvidenceType,
  PolicyViolationDetail,
} from "@/types/policy-compliance";

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

export default function PolicyViolationDetailPage() {
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
      PolicyViolationDetail |
      null
    >(null);

  const [
    waiverRationale,
    setWaiverRationale,
  ] =
    useState("");

  const [
    waiverDecisionNote,
    setWaiverDecisionNote,
  ] =
    useState("");

  const [
    evidenceType,
    setEvidenceType,
  ] =
    useState<PolicyEvidenceType>(
      "NOTE",
    );

  const [
    evidenceContent,
    setEvidenceContent,
  ] =
    useState("");

  const [
    resolutionNote,
    setResolutionNote,
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

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    getPolicyViolation(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDetail(
            response,
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
              : "Unable to load policy violation.",
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
    setDetail(
      await getPolicyViolation(
        params.id,
      ),
    );
  }

  async function submitWaiver(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await requestPolicyWaiver(
        detail.violation.id,
        waiverRationale,
      );

      setWaiverRationale("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to request policy waiver.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideWaiver(
    waiverId: string,
    decision:
      "APPROVE"
      |
      "REJECT",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        decision ===
        "APPROVE"
      ) {
        await approvePolicyWaiver(
          waiverId,
          waiverDecisionNote,
        );
      } else {
        await rejectPolicyWaiver(
          waiverId,
          waiverDecisionNote,
        );
      }

      setWaiverDecisionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to decide policy waiver.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitEvidence(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await addPolicyEvidence(
        detail.violation.id,
        {
          evidenceType,
          content:
            evidenceContent,
        },
      );

      setEvidenceContent("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add compliance evidence.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function resolveViolation() {
    if (!detail) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      await resolvePolicyViolation(
        detail.violation.id,
        resolutionNote,
      );

      setResolutionNote("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to resolve policy violation.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading policy violation...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/compliance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Policy & compliance
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Policy violation not found."}
        </div>
      </div>
    );
  }

  const {
    violation,
    waivers,
    evidence,
  } = detail;

  const pendingWaiver =
    waivers.find(
      waiver =>
        waiver.status ===
        "SUBMITTED",
    );

  return (
    <div className="page-stack">
      <Link
        href="/compliance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Policy & compliance
      </Link>

      <section className="compliance-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {violation.policyCode}
            </span>

            <span
              className={
                `compliance-severity compliance-severity--${violation.severity.toLowerCase()}`
              }
            >
              {violation.severity}
            </span>

            <span
              className={
                `compliance-violation-status compliance-violation-status--${violation.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                violation.status,
              )}
            </span>
          </div>

          <h1>
            {violation.policyName}
          </h1>

          <p>
            {violation.details}
          </p>
        </div>

        <Link
          href={
            violation.sourceHref
          }
          className="button button--secondary"
        >
          <ExternalLink
            size={16}
          />
          Open source record
        </Link>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="compliance-detail-kpis">
        <article className="request-detail-summary-card">
          <ShieldAlert
            size={18}
          />

          <div>
            <span>
              Violation status
            </span>

            <strong>
              {readable(
                violation.status,
              )}
            </strong>

            <small>
              {violation.severity}
              {" severity"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <FileCheck2
            size={18}
          />

          <div>
            <span>
              Source record
            </span>

            <strong>
              {violation.sourceReference ??
                "—"}
            </strong>

            <small>
              {readable(
                violation.sourceType,
              )}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <TicketCheck
            size={18}
          />

          <div>
            <span>
              Waivers
            </span>

            <strong>
              {waivers.length}
            </strong>

            <small>
              {pendingWaiver
                ? "Decision pending"
                : "No pending waiver"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <BadgeCheck
            size={18}
          />

          <div>
            <span>
              Evidence
            </span>

            <strong>
              {evidence.length}
            </strong>

            <small>
              Compliance evidence items
            </small>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Violation context
            </span>

            <h2>
              Policy & transaction
            </h2>
          </div>
        </div>

        <div className="compliance-detail-context">
          <div>
            <span>
              Policy type
            </span>

            <strong>
              {readable(
                violation.policyType,
              )}
            </strong>
          </div>

          <div>
            <span>
              Policy owner
            </span>

            <strong>
              {violation.policyOwnerName}
            </strong>
          </div>

          <div>
            <span>
              Source amount
            </span>

            <strong>
              {violation.sourceAmount !==
              null
                ? (
                    violation.currency
                      ? money(
                          violation.sourceAmount,
                          violation.currency,
                        )
                      : violation.sourceAmount
                  )
                : "—"}
            </strong>
          </div>

          <div>
            <span>
              Detected
            </span>

            <strong>
              {new Date(
                violation.detectedAt,
              )
                .toLocaleString()}
            </strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Exception governance
            </span>

            <h2>
              Waiver history
            </h2>
          </div>

          <TicketCheck
            size={19}
          />
        </div>

        {waivers.length ===
        0 ? (
          <div className="compliance-empty">
            No waiver has been requested.
          </div>
        ) : (
          <div className="compliance-waiver-list">
            {waivers.map(
              waiver => (
                <article
                  key={waiver.id}
                  className={
                    `compliance-waiver-card compliance-waiver-card--${waiver.status.toLowerCase()}`
                  }
                >
                  <div className="compliance-waiver-heading">
                    <div>
                      <strong>
                        {waiver.waiverNumber}
                      </strong>

                      <span>
                        Requested by
                        {" "}
                        {waiver.requestedByName}
                        {" · "}
                        {new Date(
                          waiver.requestedAt,
                        )
                          .toLocaleString()}
                      </span>
                    </div>

                    <span
                      className={
                        `compliance-waiver-status compliance-waiver-status--${waiver.status.toLowerCase()}`
                      }
                    >
                      {waiver.status}
                    </span>
                  </div>

                  <p>
                    {waiver.rationale}
                  </p>

                  {waiver.decisionNote ? (
                    <div className="compliance-waiver-decision">
                      <strong>
                        Decision:
                      </strong>
                      {" "}
                      {waiver.decisionNote}
                      {waiver.decidedByName
                        ? ` — ${waiver.decidedByName}`
                        : ""}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}

        {canApprove &&
        pendingWaiver ? (
          <div className="compliance-waiver-decision-form">
            <label className="request-field">
              <span>
                Waiver decision rationale
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={waiverDecisionNote}
                onChange={
                  event =>
                    setWaiverDecisionNote(
                      event.target.value,
                    )
                }
              />
            </label>

            <div>
              <button
                type="button"
                className="button button--secondary"
                disabled={
                  running
                  ||
                  !waiverDecisionNote.trim()
                }
                onClick={
                  () =>
                    void decideWaiver(
                      pendingWaiver.id,
                      "REJECT",
                    )
                }
              >
                <XCircle
                  size={16}
                />
                Reject waiver
              </button>

              <button
                type="button"
                className="button button--primary"
                disabled={
                  running
                  ||
                  !waiverDecisionNote.trim()
                }
                onClick={
                  () =>
                    void decideWaiver(
                      pendingWaiver.id,
                      "APPROVE",
                    )
                }
              >
                <BadgeCheck
                  size={16}
                />
                Approve waiver
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {canManage &&
      violation.status ===
        "OPEN" ? (
        <form
          className="panel"
          onSubmit={submitWaiver}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Exception request
              </span>

              <h2>
                Request policy waiver
              </h2>
            </div>

            <TicketCheck
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Business rationale
            </span>

            <textarea
              required
              rows={5}
              maxLength={3000}
              value={waiverRationale}
              onChange={
                event =>
                  setWaiverRationale(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="compliance-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !waiverRationale.trim()
              }
            >
              <TicketCheck
                size={16}
              />
              Submit waiver request
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Audit evidence
            </span>

            <h2>
              Compliance evidence
            </h2>
          </div>

          <FileCheck2
            size={19}
          />
        </div>

        {evidence.length ===
        0 ? (
          <div className="compliance-empty">
            No evidence has been added.
          </div>
        ) : (
          <div className="compliance-evidence-list">
            {evidence.map(
              item => (
                <article
                  key={item.id}
                >
                  <div>
                    <span>
                      {item.evidenceType}
                    </span>

                    <strong>
                      {item.addedByName}
                    </strong>
                  </div>

                  <p>
                    {item.content}
                  </p>

                  <small>
                    {new Date(
                      item.createdAt,
                    )
                      .toLocaleString()}
                  </small>
                </article>
              ),
            )}
          </div>
        )}

        {canManage ? (
          <form
            className="compliance-evidence-form"
            onSubmit={submitEvidence}
          >
            <select
              value={evidenceType}
              onChange={
                event =>
                  setEvidenceType(
                    event.target.value as
                      PolicyEvidenceType,
                  )
              }
            >
              <option value="NOTE">
                Note
              </option>

              <option value="REFERENCE">
                Reference
              </option>
            </select>

            <input
              required
              maxLength={3000}
              value={evidenceContent}
              placeholder={
                "Add remediation evidence or reference"
              }
              onChange={
                event =>
                  setEvidenceContent(
                    event.target.value,
                  )
              }
            />

            <button
              type="submit"
              className="compliance-inline-button"
              disabled={
                running
                ||
                !evidenceContent.trim()
              }
            >
              <Plus
                size={14}
              />
              Add evidence
            </button>
          </form>
        ) : null}
      </section>

      {canManage &&
      violation.status ===
        "OPEN" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Remediation
              </span>

              <h2>
                Resolve violation
              </h2>
            </div>

            <BadgeCheck
              size={19}
            />
          </div>

          <label className="request-field">
            <span>
              Resolution evidence
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              value={resolutionNote}
              onChange={
                event =>
                  setResolutionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="compliance-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !resolutionNote.trim()
              }
              onClick={
                () =>
                  void resolveViolation()
              }
            >
              <BadgeCheck
                size={16}
              />
              Mark resolved
            </button>
          </div>
        </section>
      ) : null}

      {violation.resolutionNote ? (
        <section className="compliance-resolution-card">
          <BadgeCheck
            size={19}
          />

          <div>
            <span>
              Resolution
            </span>

            <strong>
              {violation.resolutionNote}
            </strong>

            <small>
              {violation.resolvedByName ??
                "Procurement"}
              {violation.resolvedAt
                ? ` · ${new Date(
                    violation.resolvedAt,
                  ).toLocaleString()}`
                : ""}
            </small>
          </div>
        </section>
      ) : null}
    </div>
  );
}
