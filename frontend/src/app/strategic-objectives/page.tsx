"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  CircleAlert,
  Goal,
  Plus,
  ShieldCheck,
  Target,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getStrategicOkrDashboard,
} from "@/lib/api";

import type {
  StrategicObjectiveStatus,
  StrategicOkrDashboard,
} from "@/types/strategic-okr";

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

export default function StrategicObjectivesPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      StrategicOkrDashboard |
      null
    >(null);

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      new Date()
        .getUTCFullYear(),
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      StrategicObjectiveStatus |
      ""
    >("");

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

    getStrategicOkrDashboard(
      currency,
      fiscalYear,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDashboard(
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
              : "Unable to load strategic procurement objectives.",
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
    fiscalYear,
  ]);

  const objectives =
    useMemo(
      () =>
        dashboard
          ?.objectives
          .filter(
            objective =>
              !statusFilter
              ||
              objective.status ===
                statusFilter,
          )
        ??
        [],
      [
        dashboard,
        statusFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement strategy execution
          </span>

          <h1>
            Strategic objectives
          </h1>

          <p>
            Translate procurement
            strategy into measurable
            annual and quarterly
            objectives backed by live
            ProcureIQ authorities and
            immutable executive progress
            snapshots.
          </p>
        </div>

        <div className="okr-heading-actions">
          <label className="okr-filter">
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
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="TND">TND</option>
            </select>
          </label>

          <label className="okr-filter">
            <span>
              Fiscal year
            </span>

            <input
              type="number"
              min="2000"
              max="2200"
              value={fiscalYear}
              onChange={
                event => {
                  setLoading(true);

                  setFiscalYear(
                    Number(
                      event.target.value,
                    ),
                  );
                }
              }
            />
          </label>

          {canManage ? (
            <Link
              href={
                `/strategic-objectives/new?currency=${currency}&fiscalYear=${fiscalYear}`
              }
              className="button button--primary"
            >
              <Plus
                size={16}
              />
              New objective
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

      <section className="okr-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-card__label">
            Objectives
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.objectiveCount ??
              0}
          </strong>

          <p>
            FY {fiscalYear}
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Active
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.activeObjectiveCount ??
              0}
          </strong>

          <p>
            Active or on hold.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            Average progress
          </span>

          <strong className="kpi-card__value">
            {(
              dashboard
                ?.averageProgressPct ??
                0
            ).toFixed(1)}
            %
          </strong>

          <p>
            Weighted KR execution.
          </p>
        </article>

        <article className="kpi-card">
          <span className="kpi-card__label">
            At risk
          </span>

          <strong className="kpi-card__value okr-risk-text">
            {dashboard
              ?.atRiskObjectiveCount ??
              0}
          </strong>

          <p>
            At-risk or off-track health.
          </p>
        </article>
      </section>

      <section className="okr-strategy-signals">
        <article>
          <Target
            size={17}
          />

          <div>
            <span>
              Achieved objectives
            </span>

            <strong>
              {dashboard
                ?.achievedObjectiveCount ??
                0}
            </strong>
          </div>
        </article>

        <article>
          <ShieldCheck
            size={17}
          />

          <div>
            <span>
              Average confidence
            </span>

            <strong>
              {(
                dashboard
                  ?.averageConfidencePct ??
                  0
              ).toFixed(1)}
              %
            </strong>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Strategy portfolio
            </span>

            <h2>
              Procurement OKRs
            </h2>
          </div>

          <select
            className="okr-status-filter"
            value={statusFilter}
            onChange={
              event =>
                setStatusFilter(
                  event.target.value as
                    StrategicObjectiveStatus |
                    "",
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="ON_HOLD">
              On hold
            </option>

            <option value="ACHIEVED">
              Achieved
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
                <th>Objective</th>
                <th>Period</th>
                <th>Status</th>
                <th>KR coverage</th>
                <th>Progress</th>
                <th>Health</th>
                <th>Confidence</th>
                <th>Snapshots</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                objectives.map(
                  objective => (
                    <tr
                      key={objective.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {objective.title}
                          </strong>

                          <span>
                            {objective.objectiveNumber}
                            {" · "}
                            {objective.ownerName}
                          </span>
                        </div>
                      </td>

                      <td>
                        {objective.periodType ===
                          "QUARTERLY"
                          ? `Q${objective.quarter} ${objective.fiscalYear}`
                          : `FY ${objective.fiscalYear}`}
                      </td>

                      <td>
                        <span
                          className={
                            `okr-status okr-status--${objective.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            objective.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {objective.weightCoveragePct.toFixed(
                          0,
                        )}
                        %
                        {" · "}
                        {objective.achievedKeyResultCount}
                        /
                        {objective.keyResultCount}
                      </td>

                      <td>
                        <strong>
                          {objective.progressPct.toFixed(
                            1,
                          )}
                          %
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `okr-health okr-health--${objective.health.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            objective.health,
                          )}
                        </span>
                      </td>

                      <td>
                        {objective.confidencePct.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {objective.snapshotCount}
                      </td>

                      <td>
                        <Link
                          href={
                            `/strategic-objectives/${objective.id}`
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
              objectives.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="table-empty-state"
                  >
                    No procurement
                    objectives match this
                    period and status.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="okr-method-note">
        <Goal
          size={18}
        />

        <div>
          <strong>
            Strategy backed by operational authority
          </strong>

          <p>
            Key-result actuals can be
            sourced directly from
            immutable operating-rhythm
            evidence, live continuous-
            improvement governance, or
            controlled manual reporting.
            Progress and health remain
            deterministic and explainable.
          </p>
        </div>
      </section>
    </div>
  );
}
