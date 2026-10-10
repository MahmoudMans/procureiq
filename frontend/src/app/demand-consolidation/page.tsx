"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Building2,
  CircleAlert,
  Coins,
  Layers3,
  PackagePlus,
  Plus,
  Target,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getDemandConsolidationBundles,
  getDemandConsolidationCandidates,
  getDemandConsolidationSummary,
} from "@/lib/api";

import type {
  DemandBundle,
  DemandConsolidationCandidate,
  DemandConsolidationSummary,
} from "@/types/demand-consolidation";

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
  currency?: string,
): string {
  if (currency) {
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

export default function DemandConsolidationPage() {
  const {
    user,
  } = useAuth();

  const [
    candidates,
    setCandidates,
  ] =
    useState<
      DemandConsolidationCandidate[]
    >([]);

  const [
    bundles,
    setBundles,
  ] =
    useState<
      DemandBundle[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      DemandConsolidationSummary |
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
      getDemandConsolidationCandidates(),
      getDemandConsolidationBundles(),
      getDemandConsolidationSummary(),
    ])
      .then(
        ([
          candidateResponse,
          bundleResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setCandidates(
            candidateResponse,
          );

          setBundles(
            bundleResponse,
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
              : "Unable to load demand-consolidation intelligence.",
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

  const filteredBundles =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return bundles
          .filter(
            bundle =>
              !statusFilter
              ||
              bundle.status ===
                statusFilter,
          )
          .filter(
            bundle => {
              if (!normalized) {
                return true;
              }

              return [
                bundle.bundleNumber,
                bundle.title,
                bundle.category,
                bundle.ownerName,
                bundle.linkedRfqNumber ??
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
        bundles,
        query,
        statusFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategic sourcing
          </span>

          <h1>
            Demand consolidation
          </h1>

          <p>
            Detect similar demand across
            departments, estimate
            purchasing leverage and turn
            approved demand bundles into
            sourcing opportunities.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/demand-consolidation/new"
            className="button button--primary"
          >
            <Plus
              size={16}
            />
            Build bundle
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

      <section className="demand-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Layers3
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Consolidation candidates
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.candidateGroups ??
              0}
          </strong>

          <p>
            {summary
              ?.candidateIntakes ??
              0}
            {" eligible intakes"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Building2
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Candidate demand
          </span>

          <strong className="kpi-card__value demand-money-kpi">
            {money(
              summary
                ?.candidateValue ??
                0,
            )}
          </strong>

          <p>
            Unbundled cross-department
            pipeline.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <PackagePlus
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Active bundles
          </span>

          <strong className="kpi-card__value">
            {(summary
              ?.openBundles ??
              0)
              +
              (summary
                ?.approvedBundles ??
                0)
              +
              (summary
                ?.sourcingBundles ??
                0)}
          </strong>

          <p>
            {summary
              ?.sourcingBundles ??
              0}
            {" currently sourcing"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Coins
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Expected leverage
          </span>

          <strong className="kpi-card__value demand-money-kpi">
            {money(
              summary
                ?.expectedSavings ??
                0,
            )}
          </strong>

          <p>
            Estimated bundle savings
            opportunity.
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Bundling intelligence
            </span>

            <h2>
              Consolidation opportunities
            </h2>
          </div>

          <Target
            size={19}
          />
        </div>

        {candidates.length ===
        0 ? (
          <div className="demand-empty">
            No cross-department demand
            groups currently meet the
            consolidation threshold.
          </div>
        ) : (
          <div className="demand-candidate-grid">
            {candidates
              .slice(
                0,
                8,
              )
              .map(
                candidate => (
                  <article
                    key={
                      candidate.candidateKey
                    }
                    className="demand-candidate-card"
                  >
                    <div className="demand-candidate-heading">
                      <div>
                        <span>
                          {candidate.currency}
                        </span>

                        <strong>
                          {candidate.category}
                        </strong>
                      </div>

                      <span className="demand-leverage-chip">
                        {candidate.expectedLeveragePct.toFixed(1)}
                        %
                        {" leverage"}
                      </span>
                    </div>

                    <div className="demand-candidate-metrics">
                      <div>
                        <span>
                          Demand
                        </span>

                        <strong>
                          {money(
                            candidate.totalValue,
                            candidate.currency,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Intakes
                        </span>

                        <strong>
                          {candidate.intakeCount}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Departments
                        </span>

                        <strong>
                          {candidate.departmentCount}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Expected savings
                        </span>

                        <strong>
                          {money(
                            candidate.expectedSavings,
                            candidate.currency,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="demand-candidate-departments">
                      {Array.from(
                        new Set(
                          candidate.intakes.map(
                            intake =>
                              intake.departmentName,
                          ),
                        ),
                      )
                        .slice(
                          0,
                          5,
                        )
                        .map(
                          department => (
                            <span
                              key={department}
                            >
                              {department}
                            </span>
                          ),
                        )}
                    </div>

                    {canManage ? (
                      <Link
                        href="/demand-consolidation/new"
                        className="guided-inline-button demand-build-button"
                      >
                        Build bundle
                      </Link>
                    ) : null}
                  </article>
                ),
              )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Consolidation portfolio
            </span>

            <h2>
              Demand bundles
            </h2>
          </div>

          <span className="demand-count">
            {filteredBundles.length}
            {" bundles"}
          </span>
        </div>

        <div className="demand-toolbar">
          <input
            value={query}
            placeholder={
              "Search bundle, category, owner or RFQ"
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

            <option value="UNDER_REVIEW">
              Under review
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="SOURCING">
              Sourcing
            </option>

            <option value="CLOSED">
              Closed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Bundle</th>
                <th>Category</th>
                <th>Demand</th>
                <th>Departments</th>
                <th>Leverage</th>
                <th>Expected savings</th>
                <th>Status</th>
                <th>Target sourcing</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredBundles.map(
                  bundle => (
                    <tr
                      key={bundle.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {bundle.bundleNumber}
                          </strong>

                          <span>
                            {bundle.title}
                          </span>
                        </div>
                      </td>

                      <td>
                        {bundle.category}
                      </td>

                      <td>
                        {money(
                          bundle.consolidatedValue,
                          bundle.currency,
                        )}
                      </td>

                      <td>
                        {bundle.departmentCount}
                      </td>

                      <td>
                        {bundle.expectedLeveragePct.toFixed(1)}
                        %
                      </td>

                      <td>
                        <strong className="demand-savings-value">
                          {money(
                            bundle.expectedSavings,
                            bundle.currency,
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `demand-status demand-status--${bundle.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            bundle.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {new Date(
                          `${bundle.targetSourcingDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </td>

                      <td>
                        <Link
                          href={
                            `/demand-consolidation/${bundle.id}`
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
              filteredBundles.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No demand bundles match
                    the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>
    </div>
  );
}
