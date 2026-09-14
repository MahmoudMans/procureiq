"use client";

import Link from "next/link";

import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CircleAlert,
  CircleCheckBig,
  Euro,
  ShieldAlert,
  Truck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getSuppliers,
  getSupplierSummary,
} from "@/lib/api";

import type {
  Supplier,
  SupplierSummary,
} from "@/types/supplier";

const currencyFormatter =
  new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    },
  );

const fullCurrencyFormatter =
  new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  );

export default function DashboardPage() {

  const [
    summary,
    setSummary,
  ] =
    useState<SupplierSummary | null>(
      null,
    );

  const [
    suppliers,
    setSuppliers,
  ] =
    useState<Supplier[]>([]);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {

    let mounted = true;

    async function loadDashboard() {

      try {

        const [
          summaryResponse,
          supplierResponse,
        ] =
          await Promise.all([
            getSupplierSummary(),
            getSuppliers(),
          ]);

        if (!mounted) {
          return;
        }

        setSummary(summaryResponse);
        setSuppliers(supplierResponse);

      } catch (caughtError) {

        if (!mounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the dashboard.",
        );
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };

  }, []);

  const categorySpend =
    useMemo(() => {

      const totals =
        suppliers.reduce<
          Record<string, number>
        >(
          (
            accumulator,
            supplier,
          ) => {

            accumulator[
              supplier.category
            ] =
              (
                accumulator[
                  supplier.category
                ] ?? 0
              ) +
              supplier.totalSpend;

            return accumulator;
          },
          {},
        );

      return Object.entries(
        totals,
      )
        .map(
          ([
            category,
            spend,
          ]) => ({
            category,
            spend,
          }),
        )
        .sort(
          (a, b) =>
            b.spend - a.spend,
        )
        .slice(0, 5);

    }, [suppliers]);

  const maximumCategorySpend =
    categorySpend[0]?.spend ?? 1;

  const riskSuppliers =
    suppliers
      .filter(
        (supplier) =>
          supplier.riskLevel ===
            "HIGH" ||
          supplier.riskLevel ===
            "CRITICAL",
      )
      .sort(
        (a, b) => {

          const priority = {
            CRITICAL: 2,
            HIGH: 1,
            MEDIUM: 0,
            LOW: 0,
          };

          return (
            priority[b.riskLevel] -
            priority[a.riskLevel]
          );
        },
      )
      .slice(0, 4);

  return (
    <div className="page-stack">

      <section
        className={
          "page-heading page-heading--dashboard"
        }
      >

        <div>

          <span className="eyebrow">
            Procurement command center
          </span>

          <h1>
            Procurement intelligence
          </h1>

          <p>
            Track supplier health,
            spend exposure and sourcing
            performance from one workspace.
          </p>

        </div>

        <div className="page-heading__actions">

          <button
            className={
              "button button--secondary"
            }
          >
            Export overview
          </button>

          <button
            className={
              "button button--primary"
            }
          >
            New purchase request
          </button>

        </div>

      </section>

      {error ? (
        <div className="error-banner">

          <CircleAlert size={18} />

          <span>
            {error}
            {" "}
            Make sure the backend and
            PostgreSQL are running.
          </span>

        </div>
      ) : null}

      <section className="kpi-grid">

        <article className="kpi-card">

          <div className="kpi-card__topline">

            <div className="kpi-card__icon">
              <Euro size={20} />
            </div>

            <span
              className={
                "trend trend--positive"
              }
            >
              <ArrowUpRight size={14} />
              Portfolio
            </span>

          </div>

          <span className="kpi-card__label">
            Managed supplier spend
          </span>

          <strong className="kpi-card__value">
            {summary
              ? currencyFormatter.format(
                  summary.totalSpend,
                )
              : "—"}
          </strong>

          <p>
            Across the current supplier
            portfolio.
          </p>

        </article>

        <article className="kpi-card">

          <div className="kpi-card__topline">

            <div className="kpi-card__icon">
              <Building2 size={20} />
            </div>

            <span
              className={
                "trend trend--positive"
              }
            >
              <ArrowUpRight size={14} />
              Healthy
            </span>

          </div>

          <span className="kpi-card__label">
            Active suppliers
          </span>

          <strong className="kpi-card__value">
            {summary?.activeSuppliers ?? "—"}
          </strong>

          <p>
            {summary?.onboardingSuppliers ?? "—"}
            {" "}
            suppliers currently onboarding.
          </p>

        </article>

        <article className="kpi-card">

          <div className="kpi-card__topline">

            <div
              className={
                "kpi-card__icon kpi-card__icon--warning"
              }
            >
              <ShieldAlert size={20} />
            </div>

            <span
              className={
                "trend trend--negative"
              }
            >
              <ArrowDownRight size={14} />
              Attention
            </span>

          </div>

          <span className="kpi-card__label">
            High-risk suppliers
          </span>

          <strong className="kpi-card__value">
            {summary?.highRiskSuppliers ?? "—"}
          </strong>

          <p>
            Suppliers requiring
            procurement review.
          </p>

        </article>

        <article className="kpi-card">

          <div className="kpi-card__topline">

            <div className="kpi-card__icon">
              <Truck size={20} />
            </div>

            <span
              className={
                "trend trend--positive"
              }
            >
              <CircleCheckBig size={14} />
              Delivery
            </span>

          </div>

          <span className="kpi-card__label">
            Avg. on-time delivery
          </span>

          <strong className="kpi-card__value">
            {summary
              ? `${
                  summary
                    .averageOnTimeDeliveryRate
                    .toFixed(1)
                }%`
              : "—"}
          </strong>

          <p>
            Average tracked supplier
            performance.
          </p>

        </article>

      </section>

      <section className="dashboard-grid">

        <article
          className={
            "panel panel--wide"
          }
        >

          <div className="panel__header">

            <div>
              <span className="eyebrow">
                Spend intelligence
              </span>

              <h2>
                Spend by category
              </h2>
            </div>

            <button className="text-button">
              View analytics
            </button>

          </div>

          <div className="category-chart">

            {categorySpend.length === 0
              ? (
                <div className="empty-state">
                  Supplier spend will appear
                  here.
                </div>
              )
              : categorySpend.map(
                  (entry) => (
                    <div
                      className={
                        "category-chart__row"
                      }
                      key={entry.category}
                    >

                      <div
                        className={
                          "category-chart__label"
                        }
                      >

                        <span>
                          {entry.category}
                        </span>

                        <strong>
                          {
                            fullCurrencyFormatter
                              .format(
                                entry.spend,
                              )
                          }
                        </strong>

                      </div>

                      <div
                        className={
                          "category-chart__track"
                        }
                      >
                        <div
                          className={
                            "category-chart__bar"
                          }
                          style={{
                            width:
                              `${
                                (
                                  entry.spend /
                                  maximumCategorySpend
                                ) *
                                100
                              }%`,
                          }}
                        />
                      </div>

                    </div>
                  ),
                )}

          </div>

        </article>

        <article className="panel">

          <div className="panel__header">

            <div>
              <span className="eyebrow">
                Risk intelligence
              </span>

              <h2>
                Supplier watchlist
              </h2>
            </div>

          </div>

          <div className="watchlist">

            {riskSuppliers.map(
              (supplier) => (
                <div
                  className="watchlist__item"
                  key={supplier.id}
                >

                  <div className="company-avatar">
                    {
                      supplier.legalName
                        .split(" ")
                        .slice(0, 2)
                        .map(
                          (word) =>
                            word[0],
                        )
                        .join("")
                    }
                  </div>

                  <div
                    className={
                      "watchlist__content"
                    }
                  >
                    <strong>
                      {supplier.legalName}
                    </strong>

                    <span>
                      {supplier.category}
                    </span>
                  </div>

                  <span
                    className={
                      `badge badge--${
                        supplier.riskLevel
                          .toLowerCase()
                      }`
                    }
                  >
                    {supplier.riskLevel}
                  </span>

                </div>
              ),
            )}

          </div>

        </article>

      </section>

      <section className="panel">

        <div className="panel__header">

          <div>
            <span className="eyebrow">
              Supplier performance
            </span>

            <h2>
              Strategic supplier snapshot
            </h2>
          </div>

          <Link
            className="text-button"
            href="/suppliers"
          >
            Open supplier portfolio
          </Link>

        </div>

        <div className="table-scroll">

          <table className="data-table">

            <thead>
              <tr>
                <th>Supplier</th>
                <th>Category</th>
                <th>Risk</th>
                <th>Rating</th>
                <th>Delivery</th>
                <th>Spend</th>
              </tr>
            </thead>

            <tbody>

              {suppliers
                .slice(0, 6)
                .map(
                  (supplier) => (
                    <tr key={supplier.id}>

                      <td>
                        <div
                          className={
                            "supplier-cell"
                          }
                        >

                          <div
                            className={
                              "company-avatar"
                            }
                          >
                            {
                              supplier.legalName
                                .split(" ")
                                .slice(0, 2)
                                .map(
                                  (word) =>
                                    word[0],
                                )
                                .join("")
                            }
                          </div>

                          <div>
                            <strong>
                              {
                                supplier
                                  .legalName
                              }
                            </strong>

                            <span>
                              {
                                supplier
                                  .supplierCode
                              }
                            </span>
                          </div>

                        </div>
                      </td>

                      <td>
                        {supplier.category}
                      </td>

                      <td>
                        <span
                          className={
                            `badge badge--${
                              supplier
                                .riskLevel
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            supplier
                              .riskLevel
                          }
                        </span>
                      </td>

                      <td>
                        {
                          supplier.rating
                            ?.toFixed(2) ??
                          "—"
                        }
                      </td>

                      <td>
                        {
                          supplier
                            .onTimeDeliveryRate
                            ? `${
                                supplier
                                  .onTimeDeliveryRate
                                  .toFixed(1)
                              }%`
                            : "—"
                        }
                      </td>

                      <td>
                        {
                          fullCurrencyFormatter
                            .format(
                              supplier.totalSpend,
                            )
                        }
                      </td>

                    </tr>
                  ),
                )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}
