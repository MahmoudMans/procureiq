"use client";

import {
  CircleAlert,
  Coins,
  Handshake,
  Plus,
  Target,
  TrendingDown,
  Users,
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
  getNegotiationSummary,
  getNegotiationWorkspaces,
} from "@/lib/api";

import type {
  NegotiationSummary,
  NegotiationWorkspace,
} from "@/types/negotiation";

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

export default function NegotiationsPage() {
  const {
    user,
  } = useAuth();

  const [
    workspaces,
    setWorkspaces,
  ] =
    useState<
      NegotiationWorkspace[]
    >([]);

  const [
    summary,
    setSummary,
  ] =
    useState<
      NegotiationSummary |
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
      getNegotiationWorkspaces(),
      getNegotiationSummary(),
    ])
      .then(
        ([
          workspaceResponse,
          summaryResponse,
        ]) => {
          if (!active) {
            return;
          }

          setWorkspaces(
            workspaceResponse,
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
              : "Unable to load negotiation intelligence.",
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

        return workspaces
          .filter(
            workspace =>
              !statusFilter
              ||
              workspace.status ===
                statusFilter,
          )
          .filter(
            workspace => {
              if (!normalized) {
                return true;
              }

              return [
                workspace.negotiationNumber,
                workspace.rfqNumber,
                workspace.rfqTitle,
                workspace.supplierName,
                workspace.ownerName,
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
        workspaces,
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
            Negotiations
          </h1>

          <p>
            Model commercial targets,
            define walk-away positions,
            compare supplier scenarios
            and capture negotiation
            rounds before final award.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/negotiations/new"
            className="button button--primary"
          >
            <Plus
              size={16}
            />
            New negotiation
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

      <section className="negotiation-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Handshake
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Active negotiations
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.activeWorkspaces ??
              0}
          </strong>

          <p>
            {summary
              ?.draftWorkspaces ??
              0}
            {" draft · "}
            {summary
              ?.agreedWorkspaces ??
              0}
            {" agreed"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Users
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Suppliers engaged
          </span>

          <strong className="kpi-card__value">
            {summary
              ?.suppliersInNegotiation ??
              0}
          </strong>

          <p>
            Active supplier negotiation
            coverage.
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <Target
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Target opportunity
          </span>

          <strong className="kpi-card__value negotiation-money-kpi">
            {money(
              summary
                ?.targetSavingsOpportunity ??
                0,
            )}
          </strong>

          <p>
            Negotiation target savings
            across workspaces.
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
            Agreed savings
          </span>

          <strong className="kpi-card__value negotiation-money-kpi">
            {money(
              summary
                ?.agreedSavings ??
                0,
            )}
          </strong>

          <p>
            {summary
              ?.averageAgreedSavingsPct
              .toFixed(1) ??
              "0.0"}
            %
            {" average negotiated reduction"}
          </p>
        </article>
      </section>

      <section className="negotiation-pipeline-banner">
        <div>
          <TrendingDown
            size={18}
          />

          <div>
            <span>
              Negotiable baseline pipeline
            </span>

            <strong>
              {money(
                summary
                  ?.baselinePipelineValue ??
                  0,
              )}
            </strong>
          </div>
        </div>

        <p>
          Submitted quotation value
          currently in draft or active
          negotiation workspaces.
        </p>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Negotiation portfolio
            </span>

            <h2>
              Supplier workspaces
            </h2>
          </div>

          <span className="negotiation-count">
            {filtered.length}
            {" workspaces"}
          </span>
        </div>

        <div className="negotiation-toolbar">
          <input
            value={query}
            placeholder={
              "Search negotiation, RFQ, supplier or owner"
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

            <option value="ACTIVE">
              Active
            </option>

            <option value="AGREED">
              Agreed
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Negotiation</th>
                <th>RFQ</th>
                <th>Supplier</th>
                <th>Baseline</th>
                <th>Target</th>
                <th>Agreed</th>
                <th>Savings</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filtered.map(
                  workspace => (
                    <tr
                      key={workspace.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {workspace.negotiationNumber}
                          </strong>

                          <span>
                            Owner:
                            {" "}
                            {workspace.ownerName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {workspace.rfqNumber}
                          </strong>

                          <span>
                            {workspace.rfqTitle}
                          </span>
                        </div>
                      </td>

                      <td>
                        {workspace.supplierName}
                      </td>

                      <td>
                        {money(
                          workspace.baselineValue,
                          workspace.currency,
                        )}
                      </td>

                      <td>
                        {workspace.targetValue !==
                        null
                          ? money(
                              workspace.targetValue,
                              workspace.currency,
                            )
                          : "—"}
                      </td>

                      <td>
                        {workspace.agreedValue !==
                        null
                          ? money(
                              workspace.agreedValue,
                              workspace.currency,
                            )
                          : "—"}
                      </td>

                      <td>
                        <strong className="negotiation-savings">
                          {money(
                            workspace.agreedSavings,
                            workspace.currency,
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            `negotiation-status negotiation-status--${workspace.status.toLowerCase()}`
                          }
                        >
                          {readable(
                            workspace.status,
                          )}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/negotiations/${workspace.id}`
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
                    No negotiation
                    workspaces match the
                    selected filters.
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
