"use client";

import {
  AlertTriangle,
  CircleAlert,
  Coins,
  Leaf,
  Plus,
  ShieldCheck,
  Sprout,
  Wrench,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getSustainabilityCategories,
  getSustainabilityPortfolio,
  getSustainabilitySummary,
} from "@/lib/api";

import type {
  SustainabilityCategoryExposure,
  SustainabilityPortfolioItem,
  SustainabilitySummary,
} from "@/types/sustainability";

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

export default function SustainabilityPage() {
  const {
    user,
  } = useAuth();

  const [
    portfolio,
    setPortfolio,
  ] =
    useState<
      SustainabilityPortfolioItem[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      SustainabilitySummary |
      null
    >(null);

  const [
    categories,
    setCategories,
  ] =
    useState<
      SustainabilityCategoryExposure[]
    >([]);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    ratingFilter,
    setRatingFilter,
  ] =
    useState("");

  const [
    assessmentFilter,
    setAssessmentFilter,
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

    Promise.all([
      getSustainabilityPortfolio(
        currency,
      ),
      getSustainabilitySummary(
        currency,
      ),
      getSustainabilityCategories(
        currency,
      ),
    ])
      .then(
        ([
          portfolioResponse,
          summaryResponse,
          categoryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setPortfolio(
            portfolioResponse,
          );

          setSummary(
            summaryResponse,
          );

          setCategories(
            categoryResponse,
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
              : "Unable to load sustainability intelligence.",
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
    currency,
  ]);

  const filtered =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return portfolio
          .filter(
            item =>
              !ratingFilter
              ||
              item.rating ===
                ratingFilter,
          )
          .filter(
            item =>
              !assessmentFilter
              ||
              (
                assessmentFilter ===
                  "UNASSESSED"
                &&
                !item.assessmentId
              )
              ||
              item.assessmentStatus ===
                assessmentFilter,
          )
          .filter(
            item => {
              if (!normalized) {
                return true;
              }

              return [
                item.supplierCode,
                item.supplierName,
                item.category ??
                  "",
                item.country ??
                  "",
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
        portfolio,
        query,
        ratingFilter,
        assessmentFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Responsible procurement
          </span>

          <h1>
            Sustainability intelligence
          </h1>

          <p>
            Govern supplier ESG
            performance, responsible-
            sourcing declarations,
            improvement actions,
            reassessment cycles and
            spend-weighted sustainability
            exposure.
          </p>
        </div>

        <div className="sustainability-heading-actions">
          <label className="sustainability-currency-control">
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

          {canManage ? (
            <Link
              href="/sustainability/new"
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New ESG assessment
            </Link>
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

      <section className="sustainability-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Leaf
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Assessment coverage
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.assessmentCoveragePct
              .toFixed(1) ??
              "0.0"}
            %
          </strong>

          <p>
            {summary
              ?.assessedSuppliers ??
              0}
            {" / "}
            {summary
              ?.activeSuppliers ??
              0}
            {" suppliers"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <AlertTriangle
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            ESG risk spend
          </span>

          <strong className="kpi-card__value sustainability-money-kpi">
            {money(
              summary
                ?.spendAtEsgRisk ??
                0,
              currency,
            )}
          </strong>

          <p>
            {summary
              ?.highRiskSuppliers ??
              0}
            {" high-risk suppliers"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Sprout
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Responsible sourcing
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.responsibleSourcingEligibleSuppliers ??
              0}
          </strong>

          <p>
            Suppliers meeting all ESG
            and onboarding gates.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Wrench
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Improvement actions
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.openImprovementActions ??
              0}
          </strong>

          <p>
            {summary
              ?.overdueImprovementActions ??
              0}
            {" overdue"}
          </p>
        </article>
      </section>

      <section className="sustainability-exposure-grid">
        <article>
          <Coins
            size={17}
          />

          <div>
            <span>
              Assessed spend
            </span>

            <strong>
              {summary
                ?.spendAssessmentCoveragePct
                .toFixed(1) ??
                "0.0"}
              %
            </strong>
          </div>
        </article>

        <article>
          <AlertTriangle
            size={17}
          />

          <div>
            <span>
              Unassessed spend
            </span>

            <strong>
              {money(
                summary
                  ?.unassessedSpend ??
                  0,
                currency,
              )}
            </strong>
          </div>
        </article>

        <article>
          <ShieldCheck
            size={17}
          />

          <div>
            <span>
              Reassess in 30 days
            </span>

            <strong>
              {summary
                ?.reassessmentsDueWithin30Days ??
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
              Expired assessments
            </span>

            <strong>
              {summary
                ?.expiredAssessments ??
                0}
            </strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Supplier portfolio
            </span>

            <h2>
              ESG coverage & exposure
            </h2>
          </div>

          <span className="sustainability-count">
            {filtered.length}
            {" suppliers"}
          </span>
        </div>

        <div className="sustainability-toolbar">
          <input
            value={query}
            placeholder={
              "Search supplier, category or country"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={ratingFilter}
            onChange={
              event =>
                setRatingFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All ESG ratings
            </option>

            <option value="LEADING">
              Leading
            </option>

            <option value="GOOD">
              Good
            </option>

            <option value="MODERATE">
              Moderate
            </option>

            <option value="HIGH_RISK">
              High risk
            </option>

            <option value="CRITICAL">
              Critical
            </option>
          </select>

          <select
            value={assessmentFilter}
            onChange={
              event =>
                setAssessmentFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All assessment states
            </option>

            <option value="UNASSESSED">
              Unassessed
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="SUBMITTED">
              Submitted
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="EXPIRED">
              Expired
            </option>

            <option value="REJECTED">
              Rejected
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Category</th>
                <th>Spend</th>
                <th>ESG score</th>
                <th>Rating</th>
                <th>Onboarding</th>
                <th>Responsible sourcing</th>
                <th>Actions</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  item => (
                    <tr
                      key={item.supplierId}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {item.supplierName}
                          </strong>

                          <span>
                            {item.supplierCode}
                            {" · "}
                            {item.country ??
                              "Unknown country"}
                          </span>
                        </div>
                      </td>

                      <td>
                        {item.category ??
                          "Uncategorized"}
                      </td>

                      <td>
                        {money(
                          item.spend,
                          item.currency,
                        )}
                      </td>

                      <td>
                        {item.overallScore !==
                        null
                          ? item.overallScore.toFixed(
                              1,
                            )
                          : "—"}
                      </td>

                      <td>
                        {item.rating ? (
                          <span
                            className={
                              `sustainability-rating sustainability-rating--${item.rating.toLowerCase().replaceAll("_", "-")}`
                            }
                          >
                            {readable(
                              item.rating,
                            )}
                          </span>
                        ) : (
                          "Unassessed"
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            item.onboardingClearance
                              ? "sustainability-gate sustainability-gate--pass"
                              : "sustainability-gate"
                          }
                        >
                          {item.onboardingClearance
                            ? "Cleared"
                            : "Not cleared"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            item.responsibleSourcingEligible
                              ? "sustainability-gate sustainability-gate--pass"
                              : "sustainability-gate"
                          }
                        >
                          {item.responsibleSourcingEligible
                            ? "Eligible"
                            : "Blocked"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            item.overdueActions >
                            0
                              ? "sustainability-overdue"
                              : ""
                          }
                        >
                          {item.openActions}
                          {" open"}
                          {item.overdueActions >
                          0
                            ? ` · ${item.overdueActions} overdue`
                            : ""}
                        </span>
                      </td>

                      <td>
                        {item.assessmentId ? (
                          <Link
                            href={
                              `/sustainability/${item.assessmentId}`
                            }
                            className="table-action"
                          >
                            Open
                          </Link>
                        ) : canManage ? (
                          <Link
                            href="/sustainability/new"
                            className="table-action"
                          >
                            Assess
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              filtered.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No suppliers match
                    the selected ESG
                    filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Category intelligence
            </span>

            <h2>
              Sustainability exposure by category
            </h2>
          </div>

          <Leaf
            size={19}
          />
        </div>

        <div className="sustainability-category-grid">
          {categories.map(
            category => (
              <article
                key={category.category}
              >
                <div className="sustainability-category-heading">
                  <div>
                    <strong>
                      {category.category}
                    </strong>

                    <span>
                      {category.supplierCount}
                      {" suppliers"}
                    </span>
                  </div>

                  <strong>
                    {category.coveragePct.toFixed(
                      1,
                    )}
                    %
                  </strong>
                </div>

                <div className="sustainability-category-bar">
                  <div
                    style={{
                      width:
                        `${Math.min(
                          100,
                          Math.max(
                            0,
                            category.coveragePct,
                          ),
                        )}%`,
                    }}
                  />
                </div>

                <div className="sustainability-category-stats">
                  <span>
                    Assessed:
                    {" "}
                    <strong>
                      {money(
                        category.assessedSpend,
                        currency,
                      )}
                    </strong>
                  </span>

                  <span>
                    ESG risk:
                    {" "}
                    <strong>
                      {money(
                        category.riskSpend,
                        currency,
                      )}
                    </strong>
                  </span>

                  <span>
                    High risk:
                    {" "}
                    <strong>
                      {category.highRiskSuppliers}
                    </strong>
                  </span>
                </div>
              </article>
            ),
          )}

          {!loading &&
          categories.length ===
            0 ? (
            <div className="sustainability-empty">
              No category sustainability
              exposure is available.
            </div>
          ) : null}
        </div>
      </section>

      <section className="sustainability-model-note">
        <ShieldCheck
          size={18}
        />

        <div>
          <strong>
            Explainable ESG methodology
          </strong>

          <p>
            Overall ESG score uses
            Environmental 40%, Social
            35% and Governance 25%.
            Responsible-sourcing
            eligibility additionally
            requires current onboarding
            clearance and verification of
            every mandatory declaration.
            No external paid ESG scoring
            API is used.
          </p>
        </div>
      </section>
    </div>
  );
}
