"use client";

import {
  AlertTriangle,
  Building2,
  CircleAlert,
  Gauge,
  Globe2,
  Network,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getSupplierCountryConcentrations,
  getSupplierResilienceIntelligence,
  getSupplierResilienceSummary,
} from "@/lib/api";

import type {
  SupplierCountryConcentration,
  SupplierResilienceIntelligence,
  SupplierResilienceSummary,
} from "@/types/supplier-resilience";

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

export default function SupplierResiliencePage() {
  const [
    intelligence,
    setIntelligence,
  ] =
    useState<
      SupplierResilienceIntelligence[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      SupplierResilienceSummary |
      null
    >(null);

  const [
    countries,
    setCountries,
  ] =
    useState<
      SupplierCountryConcentration[]
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
    bandFilter,
    setBandFilter,
  ] =
    useState("");

  const [
    criticalityFilter,
    setCriticalityFilter,
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

  useEffect(() => {
    let active = true;

    Promise.all([
      getSupplierResilienceIntelligence(
        currency,
      ),
      getSupplierResilienceSummary(
        currency,
      ),
      getSupplierCountryConcentrations(
        currency,
      ),
    ])
      .then(
        ([
          intelligenceResponse,
          summaryResponse,
          countryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setIntelligence(
            intelligenceResponse,
          );

          setSummary(
            summaryResponse,
          );

          setCountries(
            countryResponse,
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
              : "Unable to load supplier resilience intelligence.",
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

        return intelligence
          .filter(
            supplier =>
              !bandFilter
              ||
              supplier.resilienceBand ===
                bandFilter,
          )
          .filter(
            supplier =>
              !criticalityFilter
              ||
              supplier.criticality ===
                criticalityFilter,
          )
          .filter(
            supplier => {
              if (!normalized) {
                return true;
              }

              return [
                supplier.supplierCode,
                supplier.supplierName,
                supplier.category ??
                  "",
                supplier.country ??
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
        intelligence,
        query,
        bandFilter,
        criticalityFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supply continuity
          </span>

          <h1>
            Supplier resilience
          </h1>

          <p>
            Measure supplier dependency,
            category and geographic
            concentration, alternate
            coverage, capacity risk and
            continuity mitigation.
          </p>
        </div>

        <label className="resilience-currency-control">
          <span>
            Exposure currency
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
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="resilience-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Gauge
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Average resilience
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.averageResilienceScore
              .toFixed(1) ??
              "—"}
          </strong>

          <p>
            Across
            {" "}
            {summary
              ?.suppliersEvaluated ??
              0}
            {" active suppliers"}
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
            Vulnerable / critical
          </span>

          <strong className="kpi-card__value">
            {(summary
              ?.vulnerableSuppliers ??
              0)
              +
              (summary
                ?.criticalResilienceSuppliers ??
                0)}
          </strong>

          <p>
            {summary
              ?.criticalResilienceSuppliers ??
              0}
            {" critical resilience scores"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Network
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Single-source exposure
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.singleSourceSuppliers ??
              0}
          </strong>

          <p>
            {summary
              ?.dependencyBreaches ??
              0}
            {" dependency tolerance breaches"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <ShieldCheck
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Spend at risk
          </span>

          <strong className="kpi-card__value resilience-money-kpi">
            {money(
              summary
                ?.spendAtRisk ??
                0,
              currency,
            )}
          </strong>

          <p>
            {summary
              ?.overdueMitigationActions ??
              0}
            {" overdue mitigation actions"}
          </p>
        </article>
      </section>

      <section className="resilience-secondary-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Geographic exposure
              </span>

              <h2>
                Country concentration
              </h2>
            </div>

            <Globe2
              size={19}
            />
          </div>

          {countries.length ===
          0 ? (
            <div className="resilience-empty">
              No purchase-order spend
              exists in
              {" "}
              {currency}.
            </div>
          ) : (
            <div className="resilience-country-list">
              {countries
                .slice(
                  0,
                  8,
                )
                .map(
                  country => (
                    <article
                      key={country.country}
                    >
                      <div>
                        <strong>
                          {country.country}
                        </strong>

                        <span>
                          {country.supplierCount}
                          {" suppliers"}
                        </span>
                      </div>

                      <div>
                        <strong>
                          {country.spendSharePct.toFixed(1)}
                          %
                        </strong>

                        <span>
                          {money(
                            country.spend,
                            currency,
                          )}
                        </span>
                      </div>
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
                Continuity governance
              </span>

              <h2>
                Portfolio signals
              </h2>
            </div>

            <Building2
              size={19}
            />
          </div>

          <div className="resilience-signal-grid">
            <article>
              <span>
                Strategic / critical
              </span>

              <strong>
                {summary
                  ?.strategicCriticalSuppliers ??
                  0}
              </strong>
            </article>

            <article>
              <span>
                Capacity constrained
              </span>

              <strong>
                {summary
                  ?.constrainedCapacitySuppliers ??
                  0}
              </strong>
            </article>

            <article>
              <span>
                Open mitigation
              </span>

              <strong>
                {summary
                  ?.openMitigationActions ??
                  0}
              </strong>
            </article>

            <article>
              <span>
                Overdue mitigation
              </span>

              <strong>
                {summary
                  ?.overdueMitigationActions ??
                  0}
              </strong>
            </article>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Supplier dependency
            </span>

            <h2>
              Resilience portfolio
            </h2>
          </div>

          <span className="resilience-count">
            {filtered.length}
            {" suppliers"}
          </span>
        </div>

        <div className="resilience-toolbar">
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
            value={bandFilter}
            onChange={
              event =>
                setBandFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All resilience bands
            </option>

            <option value="RESILIENT">
              Resilient
            </option>

            <option value="WATCH">
              Watch
            </option>

            <option value="VULNERABLE">
              Vulnerable
            </option>

            <option value="CRITICAL">
              Critical
            </option>
          </select>

          <select
            value={criticalityFilter}
            onChange={
              event =>
                setCriticalityFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All criticalities
            </option>

            <option value="STANDARD">
              Standard
            </option>

            <option value="CRITICAL">
              Critical
            </option>

            <option value="STRATEGIC">
              Strategic
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
                <th>Category dependency</th>
                <th>Alternates</th>
                <th>Capacity</th>
                <th>Score</th>
                <th>Band</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  supplier => (
                    <tr
                      key={
                        supplier.supplierId
                      }
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {supplier.supplierName}
                          </strong>

                          <span>
                            {supplier.supplierCode}
                            {" · "}
                            {supplier.country ??
                              "Unknown"}
                          </span>
                        </div>
                      </td>

                      <td>
                        {supplier.category ??
                          "—"}
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {money(
                              supplier.supplierSpend,
                              currency,
                            )}
                          </strong>

                          <span>
                            {supplier.spendSharePct.toFixed(1)}
                            %
                            {" portfolio"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            supplier.dependencyToleranceBreached
                              ? "resilience-dependency resilience-dependency--breach"
                              : "resilience-dependency"
                          }
                        >
                          {supplier.categorySharePct.toFixed(1)}
                          %
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            supplier.singleSource
                              ? "resilience-alternate-count resilience-alternate-count--critical"
                              : ""
                          }
                        >
                          {supplier.alternateSupplierCount}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `resilience-capacity resilience-capacity--${supplier.capacityStatus.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            supplier.capacityStatus,
                          )}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {supplier.resilienceScore.toFixed(1)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `resilience-band resilience-band--${supplier.resilienceBand.toLowerCase()}`
                          }
                        >
                          {readable(
                            supplier.resilienceBand,
                          )}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/supplier-resilience/${supplier.supplierId}?currency=${currency}`
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
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No suppliers match the
                    selected resilience
                    filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
