"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LogOut,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getSupplierPortalDashboard,
  supplierPortalLogout,
} from "@/lib/api";

import {
  clearSupplierPortalToken,
  getSupplierPortalToken,
} from "@/lib/supplier-portal-session";

import type {
  SupplierPortalDashboard,
} from "@/types/supplier-portal";

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

export default function SupplierPortalHomePage() {
  const router =
    useRouter();

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      SupplierPortalDashboard |
      null
    >(null);

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

    const token =
      getSupplierPortalToken();

    if (!token) {
      router.replace(
        "/supplier-portal/login",
      );

      return;
    }

    getSupplierPortalDashboard(
      token,
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

          clearSupplierPortalToken();

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Supplier portal session is unavailable.",
          );

          router.replace(
            "/supplier-portal/login",
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
    router,
  ]);

  async function logout() {
    const token =
      getSupplierPortalToken();

    clearSupplierPortalToken();

    if (token) {
      await supplierPortalLogout(
        token,
      )
        .catch(
          () => undefined,
        );
    }

    router.replace(
      "/supplier-portal/login",
    );
  }

  if (
    loading
    &&
    !dashboard
  ) {
    return (
      <main className="supplier-portal-shell">
        <div className="supplier-portal-loading">
          Loading supplier portal...
        </div>
      </main>
    );
  }

  return (
    <main className="supplier-portal-shell">
      <header className="supplier-portal-header">
        <div className="supplier-portal-brand">
          <ShieldCheck
            size={25}
          />

          <div>
            <span>
              ProcureIQ
            </span>

            <strong>
              Supplier Portal
            </strong>
          </div>
        </div>

        <div className="supplier-portal-header-actions">
          <Link
            href="/supplier-portal/rfqs"
          >
            RFQs and quotations
          </Link>

          <Link
            href="/supplier-portal/documents"
          >
            Compliance documents
          </Link>

          <button
            type="button"
            onClick={
              () =>
                void logout()
            }
          >
            <LogOut
              size={15}
            />
            Sign out
          </button>
        </div>
      </header>

      <div className="supplier-portal-content">
        {error ? (
          <div className="portal-auth-error">
            <CircleAlert
              size={17}
            />
            {error}
          </div>
        ) : null}

        <section className="supplier-portal-welcome">
          <div>
            <span>
              Supplier workspace
            </span>

            <h1>
              {dashboard
                ?.profile
                .supplierName ??
                "Supplier"}
            </h1>

            <p>
              Welcome
              {" "}
              {dashboard
                ?.profile
                .displayName ??
                ""}
              . This portal shows only
              supplier-shared ProcureIQ
              collaboration.
            </p>
          </div>

          <div>
            <strong>
              {dashboard
                ?.profile
                .supplierCode ??
                ""}
            </strong>

            <span>
              {dashboard
                ?.profile
                .email ??
                ""}
            </span>
          </div>
        </section>

        <section className="supplier-portal-kpis">
          <article>
            <MessageSquareText
              size={19}
            />

            <div>
              <span>
                Active workspaces
              </span>

              <strong>
                {dashboard
                  ?.summary
                  .activeWorkspaces ??
                  0}
              </strong>
            </div>
          </article>

          <article>
            <Clock3
              size={19}
            />

            <div>
              <span>
                Awaiting response
              </span>

              <strong>
                {dashboard
                  ?.summary
                  .waitingSupplier ??
                  0}
              </strong>
            </div>
          </article>

          <article>
            <CheckCircle2
              size={19}
            />

            <div>
              <span>
                Open actions
              </span>

              <strong>
                {dashboard
                  ?.summary
                  .openActions ??
                  0}
              </strong>
            </div>
          </article>

          <article>
            <AlertTriangle
              size={19}
            />

            <div>
              <span>
                Overdue
              </span>

              <strong>
                {(
                  dashboard
                    ?.summary
                    .overdueResponses ??
                    0
                )
                +
                (
                  dashboard
                    ?.summary
                    .overdueActions ??
                    0
                )}
              </strong>
            </div>
          </article>
        </section>

        <section className="supplier-portal-panel">
          <div className="supplier-portal-panel-heading">
            <div>
              <span>
                Collaboration
              </span>

              <h2>
                Your workspaces
              </h2>
            </div>
          </div>

          <div className="supplier-portal-workspace-list">
            {dashboard
              ?.workspaces
              .map(
                workspace => (
                  <Link
                    key={workspace.id}
                    href={
                      `/supplier-portal/workspaces/${workspace.id}`
                    }
                    className="supplier-portal-workspace-card"
                  >
                    <div className="supplier-portal-workspace-card-heading">
                      <div>
                        <span
                          className={
                            `supplier-portal-priority supplier-portal-priority--${workspace.priority.toLowerCase()}`
                          }
                        >
                          {workspace.priority}
                        </span>

                        <strong>
                          {workspace.title}
                        </strong>

                        <small>
                          {workspace.workspaceNumber}
                          {" · "}
                          {readable(
                            workspace.workspaceType,
                          )}
                        </small>
                      </div>

                      <span
                        className={
                          `supplier-portal-workspace-status supplier-portal-workspace-status--${workspace.status.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          workspace.status,
                        )}
                      </span>
                    </div>

                    <div className="supplier-portal-workspace-context">
                      <span>
                        {workspace.purchaseOrderNumber
                          ? `PO ${workspace.purchaseOrderNumber}`
                          : workspace.rfqNumber
                            ? `RFQ ${workspace.rfqNumber}`
                            : workspace.externalReference ??
                              "General collaboration"}
                      </span>

                      <span
                        className={
                          workspace.responseSlaBreached
                            ? "supplier-portal-overdue"
                            : ""
                        }
                      >
                        {workspace.responseSlaBreached
                          ? "Response SLA breached"
                          : workspace.openSupplierActions >
                              0
                            ? `${workspace.openSupplierActions} open actions`
                            : "No open actions"}
                      </span>
                    </div>
                  </Link>
                ),
              )}

            {dashboard
              &&
            dashboard.workspaces.length ===
              0 ? (
              <div className="supplier-portal-empty">
                No supplier-shared
                collaboration workspaces
                are currently available.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
