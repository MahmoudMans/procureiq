"use client";

import {
  BadgeCheck,
  CircleAlert,
  Compass,
  FileStack,
  Plus,
  Route,
  ShieldAlert,
  Star,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  activateGuidedBuyingTemplate,
  deactivateGuidedBuyingTemplate,
  deactivatePreferredSupplier,
  getGuidedBuyingIntakes,
  getGuidedBuyingSummary,
  getGuidedBuyingTemplates,
  getPreferredSuppliers,
} from "@/lib/api";

import type {
  GuidedBuyingIntake,
  GuidedBuyingSummary,
  GuidedBuyingTemplate,
  PreferredSupplier,
} from "@/types/guided-buying";

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
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      notation:
        Math.abs(value) >=
        100000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

export default function GuidedBuyingPage() {
  const {
    user,
  } = useAuth();

  const [
    intakes,
    setIntakes,
  ] =
    useState<
      GuidedBuyingIntake[]
    >([]);

  const [
    templates,
    setTemplates,
  ] =
    useState<
      GuidedBuyingTemplate[]
    >([]);

  const [
    preferredSuppliers,
    setPreferredSuppliers,
  ] =
    useState<
      PreferredSupplier[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      GuidedBuyingSummary |
      null
    >(null);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    routeFilter,
    setRouteFilter,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
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

  const canConfigure =
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
      getGuidedBuyingIntakes(),
      getGuidedBuyingTemplates(),
      getPreferredSuppliers(),
      getGuidedBuyingSummary(),
    ])
      .then(
        ([
          intakeResponse,
          templateResponse,
          preferredResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setIntakes(
            intakeResponse,
          );

          setTemplates(
            templateResponse,
          );

          setPreferredSuppliers(
            preferredResponse,
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
              : "Unable to load guided buying.",
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

  async function reloadConfiguration() {
    const [
      templateResponse,
      preferredResponse,
      summaryResponse,
    ] =
      await Promise.all([
        getGuidedBuyingTemplates(),
        getPreferredSuppliers(),
        getGuidedBuyingSummary(),
      ]);

    setTemplates(
      templateResponse,
    );

    setPreferredSuppliers(
      preferredResponse,
    );

    setSummary(
      summaryResponse,
    );
  }

  async function toggleTemplate(
    template:
      GuidedBuyingTemplate,
  ) {
    try {
      setError(null);

      if (
        template.active
      ) {
        await deactivateGuidedBuyingTemplate(
          template.id,
        );
      } else {
        await activateGuidedBuyingTemplate(
          template.id,
        );
      }

      await reloadConfiguration();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update guided-buying template.",
      );
    }
  }

  async function deactivatePreferred(
    preferred:
      PreferredSupplier,
  ) {
    try {
      setError(null);

      await deactivatePreferredSupplier(
        preferred.id,
      );

      await reloadConfiguration();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to deactivate preferred supplier.",
      );
    }
  }

  const filteredIntakes =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return intakes
          .filter(
            intake =>
              !routeFilter
              ||
              intake.guidanceRoute ===
                routeFilter,
          )
          .filter(
            intake =>
              !statusFilter
              ||
              intake.status ===
                statusFilter,
          )
          .filter(
            intake => {
              if (!normalized) {
                return true;
              }

              return [
                intake.intakeNumber,
                intake.title,
                intake.category,
                intake.departmentName,
                intake.requesterName,
                intake.supplierName ??
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
        intakes,
        query,
        routeFilter,
        statusFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement intake
          </span>

          <h1>
            Guided buying
          </h1>

          <p>
            Guide business users toward
            compliant buying routes,
            reusable request templates
            and preferred suppliers
            before procurement work
            begins.
          </p>
        </div>

        <div className="guided-heading-actions">
          {canConfigure ? (
            <>
              <Link
                href="/guided-buying/preferred/new"
                className="button button--secondary"
              >
                <Star
                  size={16}
                />
                Preferred supplier
              </Link>

              <Link
                href="/guided-buying/templates/new"
                className="button button--secondary"
              >
                <FileStack
                  size={16}
                />
                New template
              </Link>
            </>
          ) : null}

          <Link
            href="/guided-buying/new"
            className="button button--primary"
          >
            <Plus
              size={16}
            />
            New intake
          </Link>
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

      <section className="guided-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Compass
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Open intake
          </span>

          <strong className="kpi-card__value">
            {(summary
              ?.draftIntakes ??
              0)
              +
              (summary
                ?.readyIntakes ??
                0)}
          </strong>

          <p>
            {summary
              ?.convertedIntakes ??
              0}
            {" converted to requests"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Route
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Sourcing routes
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.competitiveSourcingRoutes ??
              0}
          </strong>

          <p>
            {summary
              ?.multiControlRoutes ??
              0}
            {" multi-control intakes"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ShieldAlert
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Risk review
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.riskReviewRoutes ??
              0}
          </strong>

          <p>
            Supplier-risk escalations.
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
            Guided configuration
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.activeTemplates ??
              0}
          </strong>

          <p>
            {summary
              ?.activePreferredSuppliers ??
              0}
            {" preferred supplier mappings"}
          </p>
        </article>
      </section>

      <section className="guided-pipeline-banner">
        <div>
          <span>
            Open intake pipeline
          </span>

          <strong>
            {money(
              summary
                ?.openPipelineValue ??
                0,
            )}
          </strong>
        </div>

        <p>
          Estimated value currently in
          draft or ready guided-buying
          intake.
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Intake portfolio
            </span>

            <h2>
              Buying requests
            </h2>
          </div>

          <span className="guided-count">
            {filteredIntakes.length}
            {" intakes"}
          </span>
        </div>

        <div className="guided-toolbar">
          <input
            value={query}
            placeholder={
              "Search intake, category or requester"
            }
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
          />

          <select
            value={routeFilter}
            onChange={
              event =>
                setRouteFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All routes
            </option>

            <option value="DIRECT_BUY">
              Direct buy
            </option>

            <option value="COMPETITIVE_SOURCING">
              Competitive sourcing
            </option>

            <option value="PURCHASE_ORDER_CONTROL">
              PO control
            </option>

            <option value="CONTRACT_CONTROL">
              Contract control
            </option>

            <option value="RISK_REVIEW">
              Risk review
            </option>

            <option value="MULTI_CONTROL">
              Multi control
            </option>
          </select>

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

            <option value="READY">
              Ready
            </option>

            <option value="CONVERTED">
              Converted
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Intake</th>
                <th>Department</th>
                <th>Category</th>
                <th>Estimate</th>
                <th>Guided route</th>
                <th>Status</th>
                <th>Requester</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredIntakes.map(
                  intake => (
                    <tr
                      key={intake.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {intake.intakeNumber}
                          </strong>

                          <span>
                            {intake.title}
                          </span>
                        </div>
                      </td>

                      <td>
                        {intake.departmentName}
                      </td>

                      <td>
                        {intake.category}
                      </td>

                      <td>
                        {intake.currency}
                        {" "}
                        {money(
                          intake.estimatedAmount,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `guided-route guided-route--${intake.guidanceRoute.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            intake.guidanceRoute,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `guided-status guided-status--${intake.status.toLowerCase()}`
                          }
                        >
                          {readable(
                            intake.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {intake.requesterName}
                      </td>

                      <td>
                        <Link
                          href={
                            `/guided-buying/${intake.id}`
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
              filteredIntakes.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="table-empty-state"
                  >
                    No guided-buying
                    intakes match the
                    selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="guided-config-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Reusable intake
              </span>

              <h2>
                Buying templates
              </h2>
            </div>

            <FileStack
              size={19}
            />
          </div>

          <div className="guided-template-list">
            {templates
              .slice(
                0,
                10,
              )
              .map(
                template => (
                  <article
                    key={template.id}
                    className={
                      `guided-template-card ${
                        !template.active
                          ? "guided-template-card--inactive"
                          : ""
                      }`
                    }
                  >
                    <div>
                      <span>
                        {template.templateCode}
                      </span>

                      <strong>
                        {template.name}
                      </strong>

                      <small>
                        {template.category}
                        {" · "}
                        {template.defaultCurrency}
                      </small>
                    </div>

                    {canConfigure ? (
                      <button
                        type="button"
                        className="guided-inline-button"
                        onClick={
                          () =>
                            void toggleTemplate(
                              template,
                            )
                        }
                      >
                        {template.active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    ) : (
                      <span>
                        {template.active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    )}
                  </article>
                ),
              )}

            {templates.length ===
            0 ? (
              <div className="guided-empty">
                No guided-buying
                templates configured.
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
                Preferred suppliers
              </h2>
            </div>

            <Star
              size={19}
            />
          </div>

          <div className="guided-preferred-list">
            {preferredSuppliers
              .slice(
                0,
                10,
              )
              .map(
                preferred => (
                  <article
                    key={preferred.id}
                    className={
                      !preferred.active
                        ? "guided-preferred-card guided-preferred-card--inactive"
                        : "guided-preferred-card"
                    }
                  >
                    <div className="guided-preferred-rank">
                      {preferred.preferenceRank}
                    </div>

                    <div>
                      <strong>
                        {preferred.supplierName}
                      </strong>

                      <span>
                        {preferred.category}
                        {" · Risk "}
                        {preferred.supplierRiskLevel ??
                          "—"}
                        {" · Rating "}
                        {preferred.supplierRating.toFixed(1)}
                      </span>
                    </div>

                    {canConfigure &&
                    preferred.active ? (
                      <button
                        type="button"
                        className="guided-inline-button"
                        onClick={
                          () =>
                            void deactivatePreferred(
                              preferred,
                            )
                        }
                      >
                        Deactivate
                      </button>
                    ) : null}
                  </article>
                ),
              )}

            {preferredSuppliers.length ===
            0 ? (
              <div className="guided-empty">
                No preferred supplier
                mappings configured.
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
