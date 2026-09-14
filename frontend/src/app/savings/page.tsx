"use client";

import {
  BadgeDollarSign,
  Banknote,
  CircleAlert,
  Gauge,
  Plus,
  RefreshCw,
  Target,
  TrendingDown,
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
  discoverSavingsOpportunities,
  getSavingsCategoryAttribution,
  getSavingsInitiatives,
  getSavingsMonthly,
  getSavingsSummary,
  getSavingsSupplierAttribution,
} from "@/lib/api";

import type {
  SavingsAttribution,
  SavingsInitiative,
  SavingsMonthly,
  SavingsSummary,
} from "@/types/savings";

const CURRENT_YEAR =
  new Date()
    .getUTCFullYear();

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

export default function SavingsPage() {
  const {
    user,
  } = useAuth();

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      CURRENT_YEAR,
    );

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    summary,
    setSummary,
  ] =
    useState<
      SavingsSummary |
      null
    >(null);

  const [
    initiatives,
    setInitiatives,
  ] =
    useState<
      SavingsInitiative[]
    >([]);

  const [
    monthly,
    setMonthly,
  ] =
    useState<
      SavingsMonthly[]
    >([]);

  const [
    suppliers,
    setSuppliers,
  ] =
    useState<
      SavingsAttribution[]
    >([]);

  const [
    categories,
    setCategories,
  ] =
    useState<
      SavingsAttribution[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    discovering,
    setDiscovering,
  ] =
    useState(false);

  const [
    discoveryMessage,
    setDiscoveryMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const canManage =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getSavingsSummary(
        fiscalYear,
        currency,
      ),
      getSavingsInitiatives(
        fiscalYear,
        currency,
      ),
      getSavingsMonthly(
        fiscalYear,
        currency,
      ),
      getSavingsSupplierAttribution(
        fiscalYear,
        currency,
      ),
      getSavingsCategoryAttribution(
        fiscalYear,
        currency,
      ),
    ])
      .then(
        ([
          summaryResponse,
          initiativesResponse,
          monthlyResponse,
          supplierResponse,
          categoryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setSummary(
            summaryResponse,
          );

          setInitiatives(
            initiativesResponse,
          );

          setMonthly(
            monthlyResponse,
          );

          setSuppliers(
            supplierResponse,
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
              : "Unable to load savings intelligence.",
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
    fiscalYear,
    currency,
  ]);

  const maxMonthly =
    useMemo(
      () =>
        Math.max(
          1,
          ...monthly.map(
            item =>
              item.realizedSavings,
          ),
        ),
      [monthly],
    );

  async function discover() {
    try {
      setDiscovering(true);
      setError(null);
      setDiscoveryMessage(null);

      const result =
        await discoverSavingsOpportunities();

      const [
        summaryResponse,
        initiativesResponse,
        monthlyResponse,
        supplierResponse,
        categoryResponse,
      ] =
        await Promise.all([
          getSavingsSummary(
            fiscalYear,
            currency,
          ),
          getSavingsInitiatives(
            fiscalYear,
            currency,
          ),
          getSavingsMonthly(
            fiscalYear,
            currency,
          ),
          getSavingsSupplierAttribution(
            fiscalYear,
            currency,
          ),
          getSavingsCategoryAttribution(
            fiscalYear,
            currency,
          ),
        ]);

      setSummary(
        summaryResponse,
      );

      setInitiatives(
        initiativesResponse,
      );

      setMonthly(
        monthlyResponse,
      );

      setSuppliers(
        supplierResponse,
      );

      setCategories(
        categoryResponse,
      );

      setDiscoveryMessage(
        `${result.discoveredOpportunities} opportunities · ${result.createdInitiatives} created · ${result.updatedInitiatives} updated · ${result.createdRealizations} PO realizations created`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to discover sourcing savings.",
      );
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Value realization
          </span>

          <h1>
            Savings & value
          </h1>

          <p>
            Discover sourcing savings,
            validate procurement value,
            track PO realization and
            attribute value to suppliers
            and spend categories.
          </p>
        </div>

        {canManage ? (
          <div className="savings-heading-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={discovering}
              onClick={
                () =>
                  void discover()
              }
            >
              <RefreshCw size={16} />

              {discovering
                ? "Discovering..."
                : "Discover awards"}
            </button>

            <Link
              href="/savings/new"
              className="button button--primary"
            >
              <Plus size={16} />
              New initiative
            </Link>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      {discoveryMessage ? (
        <div className="savings-discovery-banner">
          <RefreshCw size={16} />
          {discoveryMessage}
        </div>
      ) : null}

      <section className="savings-period-control">
        <label>
          <span>
            Fiscal year
          </span>

          <select
            value={fiscalYear}
            onChange={
              event =>
                setFiscalYear(
                  Number(
                    event.target.value,
                  ),
                )
            }
          >
            {[
              CURRENT_YEAR - 1,
              CURRENT_YEAR,
              CURRENT_YEAR + 1,
            ].map(
              year => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>Currency</span>

          <select
            value={currency}
            onChange={
              event =>
                setCurrency(
                  event.target.value,
                )
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

      <section className="savings-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Target size={20} />
            </div>
          </div>

          <span className="kpi-card__label">
            Validated target
          </span>

          <strong className="kpi-card__value savings-money-kpi">
            {summary
              ? money(
                  summary.validatedTargetSavings,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            {summary?.validatedInitiatives ?? 0}
            {" validated initiatives"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Banknote size={20} />
            </div>
          </div>

          <span className="kpi-card__label">
            Realized savings
          </span>

          <strong className="kpi-card__value savings-money-kpi">
            {summary
              ? money(
                  summary.realizedSavings,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            Value recorded against
            validated initiatives.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Gauge size={20} />
            </div>
          </div>

          <span className="kpi-card__label">
            Realization rate
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.realizationRate
              .toFixed(1) ??
              "—"}
            %
          </strong>

          <p>
            {summary?.pendingInitiatives ?? 0}
            {" pending validation"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <TrendingDown size={20} />
            </div>
          </div>

          <span className="kpi-card__label">
            Remaining opportunity
          </span>

          <strong className="kpi-card__value savings-money-kpi">
            {summary
              ? money(
                  summary.remainingSavings,
                  currency,
                )
              : "—"}
          </strong>

          <p>
            Validated target not yet
            realized.
          </p>
        </article>
      </section>

      <section className="savings-main-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Realization trend
              </span>

              <h2>
                Monthly realized savings
              </h2>
            </div>

            <BadgeDollarSign size={19} />
          </div>

          {monthly.length === 0 ? (
            <div className="savings-empty">
              No realized savings have
              been recorded for this
              period.
            </div>
          ) : (
            <div className="savings-month-list">
              {monthly.map(
                item => (
                  <article
                    key={item.month}
                    className="savings-month-row"
                  >
                    <div>
                      <strong>
                        {item.month}
                      </strong>

                      <span>
                        {item.realizationCount}
                        {" entries"}
                      </span>
                    </div>

                    <div className="savings-bar-track">
                      <div
                        style={{
                          width:
                            `${Math.max(
                              3,
                              (
                                item.realizedSavings /
                                maxMonthly
                              ) *
                                100,
                            )}%`,
                        }}
                      />
                    </div>

                    <strong>
                      {money(
                        item.realizedSavings,
                        currency,
                      )}
                    </strong>
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
                Value classification
              </span>

              <h2>
                Savings mix
              </h2>
            </div>
          </div>

          <div className="savings-mix-grid">
            <article>
              <span>
                Hard savings
              </span>

              <strong>
                {summary
                  ? money(
                      summary.hardSavings,
                      currency,
                    )
                  : "—"}
              </strong>

              <p>
                Realized commercial
                reductions backed by
                validated procurement
                initiatives.
              </p>
            </article>

            <article>
              <span>
                Cost avoidance
              </span>

              <strong>
                {summary
                  ? money(
                      summary.costAvoidance,
                      currency,
                    )
                  : "—"}
              </strong>

              <p>
                Validated avoided future
                expenditure.
              </p>
            </article>
          </div>
        </section>
      </section>

      <section className="savings-attribution-grid">
        <AttributionPanel
          eyebrow="Supplier value"
          title="Supplier attribution"
          rows={suppliers}
          currency={currency}
        />

        <AttributionPanel
          eyebrow="Category value"
          title="Category attribution"
          rows={categories}
          currency={currency}
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Savings portfolio
            </span>

            <h2>
              Value initiatives
            </h2>
          </div>

          <BadgeDollarSign size={19} />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Supplier</th>
                <th>Type</th>
                <th>Target</th>
                <th>Realized</th>
                <th>Rate</th>
                <th>Status</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                initiatives.map(
                  initiative => (
                    <tr
                      key={initiative.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {initiative.savingsNumber}
                          </strong>

                          <span>
                            {initiative.title}
                          </span>
                        </div>
                      </td>

                      <td>
                        {initiative.supplierName ??
                          "—"}
                      </td>

                      <td>
                        {readable(
                          initiative.savingsType,
                        )}
                      </td>

                      <td>
                        {money(
                          initiative.targetSavings,
                          initiative.currency,
                        )}
                      </td>

                      <td>
                        <strong className="savings-realized-value">
                          {money(
                            initiative.realizedSavings,
                            initiative.currency,
                          )}
                        </strong>
                      </td>

                      <td>
                        {initiative.realizationRate.toFixed(1)}
                        %
                      </td>

                      <td>
                        <span
                          className={
                            `savings-status savings-status--${initiative.status.toLowerCase()}`
                          }
                        >
                          {readable(
                            initiative.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {initiative.ownerName}
                      </td>

                      <td>
                        <Link
                          href={
                            `/savings/${initiative.id}`
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
              initiatives.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No savings initiatives
                    exist for this period.
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

interface AttributionPanelProps {
  eyebrow: string;
  title: string;
  rows: SavingsAttribution[];
  currency: string;
}

function AttributionPanel({
  eyebrow,
  title,
  rows,
  currency,
}: AttributionPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">
            {eyebrow}
          </span>

          <h2>{title}</h2>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="savings-empty">
          No validated attribution is
          available yet.
        </div>
      ) : (
        <div className="savings-attribution-list">
          {rows
            .slice(
              0,
              8,
            )
            .map(
              row => (
                <article
                  key={row.label}
                  className="savings-attribution-row"
                >
                  <div>
                    <strong>
                      {row.label}
                    </strong>

                    <span>
                      {row.initiativeCount}
                      {" initiatives"}
                    </span>
                  </div>

                  <div>
                    <span>Target</span>

                    <strong>
                      {money(
                        row.targetSavings,
                        currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Realized
                    </span>

                    <strong>
                      {money(
                        row.realizedSavings,
                        currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Rate</span>

                    <strong>
                      {row.realizationRate.toFixed(1)}
                      %
                    </strong>
                  </div>
                </article>
              ),
            )}
        </div>
      )}
    </section>
  );
}
