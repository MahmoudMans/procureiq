"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  Clock3,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getSupplierOnboardingCases,
  getSupplierOnboardingSummary,
} from "@/lib/api";

import type {
  SupplierOnboardingCase,
  SupplierOnboardingSummary,
} from "@/types/supplier-onboarding";

import {
  useEffect,
  useMemo,
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

export default function SupplierOnboardingPage() {
  const {
    user,
  } = useAuth();

  const [
    cases,
    setCases,
  ] =
    useState<
      SupplierOnboardingCase[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      SupplierOnboardingSummary |
      null
    >(null);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("");

  const [
    riskFilter,
    setRiskFilter,
  ] =
    useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState("");

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

  const canCreate =
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

    Promise.all([
      getSupplierOnboardingCases(),
      getSupplierOnboardingSummary(),
    ])
      .then(
        ([
          casesResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setCases(
            casesResponse,
          );

          setSummary(
            summaryResponse,
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
              : "Unable to load supplier onboarding.",
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
  }, []);

  const filtered =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return cases
          .filter(
            item =>
              !statusFilter
              ||
              item.status ===
                statusFilter,
          )
          .filter(
            item =>
              !riskFilter
              ||
              item.riskTier ===
                riskFilter,
          )
          .filter(
            item =>
              !typeFilter
              ||
              item.caseType ===
                typeFilter,
          )
          .filter(
            item => {
              if (!normalized) {
                return true;
              }

              return [
                item.caseNumber,
                item.supplierCode,
                item.supplierName,
                item.supplierCategory ??
                  "",
                item.supplierCountry ??
                  "",
                item.ownerName,
              ]
                .join(
                  " ",
                )
                .toLowerCase()
                .includes(
                  normalized,
                );
            },
          );
      },
      [
        cases,
        query,
        statusFilter,
        riskFilter,
        typeFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supplier governance
          </span>

          <h1>
            Supplier onboarding
          </h1>

          <p>
            Qualify suppliers through
            mandatory questionnaires,
            evidence validation,
            risk-based approvals,
            activation gates and
            recurring requalification.
          </p>
        </div>

        {canCreate ? (
          <Link
            href="/supplier-onboarding/new"
            className="button button--primary"
          >
            <Plus
              size={16}
            />
            New onboarding case
          </Link>
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

      <section className="onboarding-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <UserCheck
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            In review
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.inReviewCases ??
              0}
          </strong>

          <p>
            {summary
              ?.draftCases ??
              0}
            {" draft"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <BadgeCheck
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Activation ready
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.activationReadyCases ??
              0}
          </strong>

          <p>
            All mandatory gates passed.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Clock3
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            SLA overdue
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.overdueCases ??
              0}
          </strong>

          <p>
            Open qualification cases
            beyond target.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <RefreshCw
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Requalification
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.requalificationDueWithin30Days ??
              0}
          </strong>

          <p>
            {summary
              ?.requalificationExpired ??
              0}
            {" expired"}
          </p>
        </article>
      </section>

      <section className="onboarding-signal-grid">
        <article>
          <ShieldCheck
            size={17}
          />

          <div>
            <span>
              Approved cases
            </span>

            <strong>
              {summary
                ?.approvedCases ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <AlertTriangle
            size={17}
          />

          <div>
            <span>
              High / critical active
            </span>

            <strong>
              {summary
                ?.highCriticalRiskCases ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <CircleAlert
            size={17}
          />

          <div>
            <span>
              Rejected
            </span>

            <strong>
              {summary
                ?.rejectedCases ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <UserCheck
            size={17}
          />

          <div>
            <span>
              Total cases
            </span>

            <strong>
              {summary
                ?.totalCases ??
                0}
            </strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Qualification portfolio
            </span>

            <h2>
              Onboarding cases
            </h2>
          </div>

          <span className="onboarding-count">
            {filtered.length}
            {" cases"}
          </span>
        </div>

        <div className="onboarding-toolbar">
          <input
            value={query}
            placeholder={
              "Search supplier, case, category or owner"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="IN_REVIEW">
              In review
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="REJECTED">
              Rejected
            </option>

            <option value="EXPIRED">
              Expired
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>

          <select
            value={riskFilter}
            onChange={
              event =>
                setRiskFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All risk tiers
            </option>

            <option value="LOW">
              Low
            </option>

            <option value="MEDIUM">
              Medium
            </option>

            <option value="HIGH">
              High
            </option>

            <option value="CRITICAL">
              Critical
            </option>
          </select>

          <select
            value={typeFilter}
            onChange={
              event =>
                setTypeFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All case types
            </option>

            <option value="INITIAL">
              Initial
            </option>

            <option value="REQUALIFICATION">
              Requalification
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Supplier</th>
                <th>Type</th>
                <th>Risk</th>
                <th>Qualification</th>
                <th>Evidence</th>
                <th>Approvals</th>
                <th>Gate</th>
                <th>SLA</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  item => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {item.caseNumber}
                          </strong>

                          <span>
                            {readable(
                              item.status,
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {item.supplierName}
                          </strong>

                          <span>
                            {item.supplierCode}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          item.caseType,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `onboarding-risk onboarding-risk--${item.riskTier.toLowerCase()}`
                          }
                        >
                          {item.riskTier}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            item.nonCompliantMandatoryQuestions >
                            0
                              ? "onboarding-blocked"
                              : ""
                          }
                        >
                          {item.answeredMandatoryQuestions}
                          {" / "}
                          {item.mandatoryQuestions}
                        </span>
                      </td>

                      <td>
                        {item.validMandatoryEvidence}
                        {" / "}
                        {item.mandatoryEvidence}
                      </td>

                      <td>
                        {item.approvedRequiredApprovals}
                        {" / "}
                        {item.requiredApprovals}
                      </td>

                      <td>
                        <span
                          className={
                            item.activationClearance
                              ? "onboarding-gate onboarding-gate--cleared"
                              : item.activationEligible
                                ? "onboarding-gate onboarding-gate--ready"
                                : "onboarding-gate"
                          }
                        >
                          {item.activationClearance
                            ? "Cleared"
                            : item.activationEligible
                              ? "Ready"
                              : "Blocked"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            item.slaOverdue
                              ? "onboarding-sla onboarding-sla--overdue"
                              : "onboarding-sla"
                          }
                        >
                          {item.slaOverdue
                            ? "Overdue"
                            : `${item.daysOpen}d open`}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/supplier-onboarding/${item.id}`
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
              filtered.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="table-empty-state"
                  >
                    No onboarding cases
                    match the selected
                    filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="onboarding-integrity-note">
        <ShieldCheck
          size={18}
        />

        <div>
          <strong>
            Activation clearance is governed, not automatic
          </strong>

          <p>
            ProcureIQ calculates whether
            the supplier has passed every
            qualification gate and records
            activation clearance, but it
            does not silently rewrite the
            supplier master-data status.
          </p>
        </div>
      </section>
    </div>
  );
}
