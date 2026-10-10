"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MessageSquareText,
  Plus,
  UsersRound,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getSupplierCollaborationDashboard,
} from "@/lib/api";

import type {
  SupplierCollaborationDashboard,
} from "@/types/supplier-collaboration";

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

function responseHours(
  value: number,
): string {
  if (value >= 48) {
    return `${(value / 24).toFixed(1)}d`;
  }

  return `${value.toFixed(1)}h`;
}

export default function SupplierCollaborationPage() {
  const {
    user,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      SupplierCollaborationDashboard |
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
    typeFilter,
    setTypeFilter,
  ] =
    useState("");

  const [
    priorityFilter,
    setPriorityFilter,
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

    getSupplierCollaborationDashboard()
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
              : "Unable to load supplier collaboration.",
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

        return (
          dashboard
            ?.workspaces
            .filter(
              workspace =>
                !statusFilter
                ||
                workspace.status ===
                  statusFilter,
            )
            .filter(
              workspace =>
                !typeFilter
                ||
                workspace.workspaceType ===
                  typeFilter,
            )
            .filter(
              workspace =>
                !priorityFilter
                ||
                workspace.priority ===
                  priorityFilter,
            )
            .filter(
              workspace => {
                if (!normalized) {
                  return true;
                }

                return [
                  workspace.workspaceNumber,
                  workspace.supplierCode,
                  workspace.supplierName,
                  workspace.title,
                  workspace.purchaseOrderNumber ??
                    "",
                  workspace.rfqNumber ??
                    "",
                  workspace.externalReference ??
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
            )
          ??
          []
        );
      },
      [
        dashboard,
        query,
        statusFilter,
        typeFilter,
        priorityFilter,
      ],
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supplier engagement
          </span>

          <h1>
            Supplier collaboration
          </h1>

          <p>
            Coordinate supplier
            clarifications, purchase
            orders, deliveries,
            documents, issues and
            response SLAs while keeping
            internal notes separated from
            supplier-shared
            communication.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/supplier-collaboration/new"
            className="button button--primary"
          >
            <Plus
              size={16}
            />
            New workspace
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

      <section className="collaboration-kpi-grid">
        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <MessageSquareText
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Active workspaces
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .activeWorkspaces ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .waitingInternal ??
              0}
            {" waiting internally"}
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
            Waiting supplier
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .waitingSupplier ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .responseSlaBreaches ??
              0}
            {" SLA breaches"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <CheckCircle2
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Action requests
          </span>

          <strong className="kpi-card__value">
            {dashboard
              ?.summary
              .openActions ??
              0}
          </strong>

          <p>
            {dashboard
              ?.summary
              .overdueActions ??
              0}
            {" overdue"}
          </p>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__topline">
            <div className="kpi-card__icon">
              <UsersRound
                size={20}
              />
            </div>
          </div>

          <span className="kpi-card__label">
            Supplier response
          </span>

          <strong className="kpi-card__value collaboration-response-kpi">
            {responseHours(
              dashboard
                ?.summary
                .averageSupplierResponseHours ??
                0,
            )}
          </strong>

          <p>
            {dashboard
              ?.summary
              .recordedSupplierResponses ??
              0}
            {" measured responses"}
          </p>
        </article>
      </section>

      <section className="collaboration-signal-grid">
        <article>
          <span>
            Supplier-shared messages
          </span>

          <strong>
            {dashboard
              ?.summary
              .supplierSharedMessages ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Response SLA breaches
          </span>

          <strong>
            {dashboard
              ?.summary
              .responseSlaBreaches ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Overdue actions
          </span>

          <strong>
            {dashboard
              ?.summary
              .overdueActions ??
              0}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Collaboration portfolio
            </span>

            <h2>
              Supplier workspaces
            </h2>
          </div>

          <span className="collaboration-count">
            {filtered.length}
            {" workspaces"}
          </span>
        </div>

        <div className="collaboration-toolbar">
          <input
            value={query}
            placeholder={
              "Search supplier, PO, RFQ, reference or topic"
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

            <option value="OPEN">
              Open
            </option>

            <option value="WAITING_SUPPLIER">
              Waiting supplier
            </option>

            <option value="WAITING_INTERNAL">
              Waiting internal
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="CLOSED">
              Closed
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
              All workspace types
            </option>

            <option value="SOURCING_CLARIFICATION">
              Sourcing clarification
            </option>

            <option value="PURCHASE_ORDER">
              Purchase order
            </option>

            <option value="DELIVERY">
              Delivery
            </option>

            <option value="DOCUMENT_REQUEST">
              Document request
            </option>

            <option value="QUALITY_ISSUE">
              Quality issue
            </option>

            <option value="GENERAL">
              General
            </option>
          </select>

          <select
            value={priorityFilter}
            onChange={
              event =>
                setPriorityFilter(
                  event.target.value,
                )
            }
          >
            <option value="">
              All priorities
            </option>

            <option value="CRITICAL">
              Critical
            </option>

            <option value="HIGH">
              High
            </option>

            <option value="MEDIUM">
              Medium
            </option>

            <option value="LOW">
              Low
            </option>
          </select>
        </div>

        <div className="table-scroll">
          <SmartTable className="data-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Supplier</th>
                <th>Type</th>
                <th>Context</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Response SLA</th>
                <th>Actions</th>
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
                            {workspace.title}
                          </strong>

                          <span>
                            {workspace.workspaceNumber}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {workspace.supplierName}
                          </strong>

                          <span>
                            {workspace.supplierCode}
                          </span>
                        </div>
                      </td>

                      <td>
                        {readable(
                          workspace.workspaceType,
                        )}
                      </td>

                      <td>
                        {workspace.purchaseOrderNumber
                          ? `PO ${workspace.purchaseOrderNumber}`
                          : workspace.rfqNumber
                            ? `RFQ ${workspace.rfqNumber}`
                            : workspace.externalReference ??
                              "—"}
                      </td>

                      <td>
                        <span
                          className={
                            `collaboration-status collaboration-status--${workspace.status.toLowerCase().replaceAll("_", "-")}`
                          }
                        >
                          {readable(
                            workspace.status,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            `collaboration-priority collaboration-priority--${workspace.priority.toLowerCase()}`
                          }
                        >
                          {workspace.priority}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            workspace.responseSlaBreached
                              ? "collaboration-overdue"
                              : ""
                          }
                        >
                          {workspace.responseSlaBreached
                            ? "Breached"
                            : workspace.status ===
                                "WAITING_SUPPLIER"
                              ? `${workspace.supplierResponseSlaHours}h target`
                              : workspace.averageSupplierResponseHours !==
                                  null
                                ? responseHours(
                                    workspace.averageSupplierResponseHours,
                                  )
                                : "—"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            workspace.overdueActions >
                            0
                              ? "collaboration-overdue"
                              : ""
                          }
                        >
                          {workspace.openActions}
                          {" open"}
                          {workspace.overdueActions >
                          0
                            ? ` · ${workspace.overdueActions} overdue`
                            : ""}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            `/supplier-collaboration/${workspace.id}`
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
                    No collaboration
                    workspaces match the
                    selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </SmartTable>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Supplier responsiveness
            </span>

            <h2>
              Collaboration performance
            </h2>
          </div>
        </div>

        <div className="collaboration-supplier-grid">
          {dashboard
            ?.supplierMetrics
            .slice(
              0,
              16,
            )
            .map(
              metric => (
                <article
                  key={metric.supplierId}
                >
                  <div>
                    <strong>
                      {metric.supplierName}
                    </strong>

                    <span>
                      {metric.supplierCode}
                    </span>
                  </div>

                  <div>
                    <span>
                      Active
                    </span>

                    <strong>
                      {metric.activeWorkspaces}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Waiting
                    </span>

                    <strong>
                      {metric.waitingSupplier}
                    </strong>
                  </div>

                  <div>
                    <span>
                      SLA breaches
                    </span>

                    <strong
                      className={
                        metric.responseSlaBreaches >
                        0
                          ? "collaboration-overdue"
                          : ""
                      }
                    >
                      {metric.responseSlaBreaches}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Avg response
                    </span>

                    <strong>
                      {responseHours(
                        metric.averageSupplierResponseHours,
                      )}
                    </strong>
                  </div>
                </article>
              ),
            )}
        </div>
      </section>

      <section className="collaboration-integrity-note">
        <AlertTriangle
          size={18}
        />

        <div>
          <strong>
            Supplier-shared does not imply an external portal
          </strong>

          <p>
            This step establishes the
            governed communication ledger,
            shared-message boundary,
            response SLA and supplier
            response recording needed for
            collaboration. External
            supplier authentication can be
            added later without mixing
            internal-only notes into
            supplier-visible history.
          </p>
        </div>
      </section>
    </div>
  );
}
