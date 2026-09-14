"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CircleAlert,
  FileCheck2,
  Gauge,
  Network,
  Play,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Star,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useSearchParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  cancelSupplierResilienceAction,
  completeSupplierResilienceAction,
  createSupplierResilienceAction,
  deactivateSupplierResilienceProfile,
  getSupplierResilienceContext,
  getSupplierResilienceDetail,
  startSupplierResilienceAction,
  upsertSupplierResilienceProfile,
} from "@/lib/api";

import type {
  ResilienceAction,
  ResilienceActionType,
  SupplierCapacityStatus,
  SupplierCriticality,
  SupplierResilienceContext,
  SupplierResilienceDetail,
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
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function defaultDueDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 30,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function SupplierResilienceDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const searchParams =
    useSearchParams();

  const currency =
    searchParams.get(
      "currency",
    )
    ??
    "EUR";

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      SupplierResilienceDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      SupplierResilienceContext |
      null
    >(null);

  const [
    criticality,
    setCriticality,
  ] =
    useState<SupplierCriticality>(
      "STANDARD",
    );

  const [
    capacityStatus,
    setCapacityStatus,
  ] =
    useState<SupplierCapacityStatus>(
      "UNKNOWN",
    );

  const [
    dependencyTolerancePct,
    setDependencyTolerancePct,
  ] =
    useState(40);

  const [
    minimumAlternates,
    setMinimumAlternates,
  ] =
    useState(2);

  const [
    profileOwnerUserId,
    setProfileOwnerUserId,
  ] =
    useState("");

  const [
    businessImpact,
    setBusinessImpact,
  ] =
    useState("");

  const [
    capacityNotes,
    setCapacityNotes,
  ] =
    useState("");

  const [
    profileNotes,
    setProfileNotes,
  ] =
    useState("");

  const [
    actionType,
    setActionType,
  ] =
    useState<ResilienceActionType>(
      "QUALIFY_ALTERNATE",
    );

  const [
    actionTitle,
    setActionTitle,
  ] =
    useState("");

  const [
    actionDescription,
    setActionDescription,
  ] =
    useState("");

  const [
    actionOwnerUserId,
    setActionOwnerUserId,
  ] =
    useState("");

  const [
    actionDueDate,
    setActionDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    completionNotes,
    setCompletionNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    savingProfile,
    setSavingProfile,
  ] =
    useState(false);

  const [
    savingAction,
    setSavingAction,
  ] =
    useState(false);

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

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getSupplierResilienceDetail(
        params.id,
        currency,
      ),
      getSupplierResilienceContext(),
    ])
      .then(
        ([
          detailResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            detailResponse,
          );

          setContext(
            contextResponse,
          );

          const intelligence =
            detailResponse.intelligence;

          setCriticality(
            intelligence.criticality,
          );

          setCapacityStatus(
            intelligence.capacityStatus,
          );

          setDependencyTolerancePct(
            intelligence.dependencyTolerancePct,
          );

          setMinimumAlternates(
            intelligence.minimumAlternates,
          );

          setBusinessImpact(
            intelligence.businessImpact ??
              "",
          );

          setCapacityNotes(
            intelligence.capacityNotes ??
              "",
          );

          setProfileNotes(
            intelligence.profileNotes ??
              "",
          );

          const defaultOwner =
            intelligence.profileOwnerUserId
            ??
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            )
              ?.id
            ??
            "";

          setProfileOwnerUserId(
            defaultOwner,
          );

          setActionOwnerUserId(
            defaultOwner,
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
              : "Unable to load supplier resilience detail.",
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
    params.id,
    currency,
  ]);

  async function reload() {
    setDetail(
      await getSupplierResilienceDetail(
        params.id,
        currency,
      ),
    );
  }

  async function saveProfile(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSavingProfile(true);
      setError(null);

      const response =
        await upsertSupplierResilienceProfile(
          params.id,
          currency,
          {
            criticality,
            capacityStatus,
            dependencyTolerancePct,
            minimumAlternates,
            ownerUserId:
              profileOwnerUserId
              ||
              undefined,
            businessImpact:
              businessImpact.trim()
              ||
              undefined,
            capacityNotes:
              capacityNotes.trim()
              ||
              undefined,
            notes:
              profileNotes.trim()
              ||
              undefined,
          },
        );

      setDetail(
        response,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save supplier resilience profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function deactivateProfile() {
    try {
      setError(null);

      setDetail(
        await deactivateSupplierResilienceProfile(
          params.id,
          currency,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to deactivate supplier resilience profile.",
      );
    }
  }

  async function createAction(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSavingAction(true);
      setError(null);

      await createSupplierResilienceAction(
        params.id,
        {
          actionType,
          title:
            actionTitle.trim(),
          description:
            actionDescription.trim()
            ||
            undefined,
          ownerUserId:
            actionOwnerUserId
            ||
            undefined,
          dueDate:
            actionDueDate,
        },
      );

      setActionTitle("");
      setActionDescription("");
      setActionDueDate(
        defaultDueDate(),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create resilience mitigation action.",
      );
    } finally {
      setSavingAction(false);
    }
  }

  async function startAction(
    action:
      ResilienceAction,
  ) {
    try {
      setError(null);

      await startSupplierResilienceAction(
        action.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start resilience action.",
      );
    }
  }

  async function completeAction(
    action:
      ResilienceAction,
  ) {
    const note =
      completionNotes[
        action.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "A completion note is required.",
      );

      return;
    }

    try {
      setError(null);

      await completeSupplierResilienceAction(
        action.id,
        note,
      );

      setCompletionNotes(
        current => ({
          ...current,
          [action.id]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to complete resilience action.",
      );
    }
  }

  async function cancelAction(
    action:
      ResilienceAction,
  ) {
    try {
      setError(null);

      await cancelSupplierResilienceAction(
        action.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel resilience action.",
      );
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading supplier resilience...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/supplier-resilience"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Supplier resilience
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Supplier resilience detail not found."}
        </div>
      </div>
    );
  }

  const {
    intelligence,
    alternatives,
    mitigationActions,
  } = detail;

  return (
    <div className="page-stack">
      <Link
        href="/supplier-resilience"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier resilience
      </Link>

      <section className="resilience-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {intelligence.supplierCode}
            </span>

            <span
              className={
                `resilience-band resilience-band--${intelligence.resilienceBand.toLowerCase()}`
              }
            >
              {readable(
                intelligence.resilienceBand,
              )}
            </span>

            <span
              className={
                `resilience-criticality resilience-criticality--${intelligence.criticality.toLowerCase()}`
              }
            >
              {readable(
                intelligence.criticality,
              )}
            </span>
          </div>

          <h1>
            {intelligence.supplierName}
          </h1>

          <p>
            {intelligence.category ??
              "Uncategorized"}
            {" · "}
            {intelligence.country ??
              "Unknown country"}
            {" · "}
            {currency}
            {" exposure view"}
          </p>
        </div>

        <Link
          href={
            `/suppliers/${intelligence.supplierId}`
          }
          className="button button--secondary"
        >
          Supplier 360
        </Link>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="resilience-detail-kpis">
        <article className="request-detail-summary-card">
          <Gauge
            size={18}
          />

          <div>
            <span>
              Resilience score
            </span>

            <strong>
              {intelligence.resilienceScore.toFixed(1)}
            </strong>

            <small>
              {readable(
                intelligence.resilienceBand,
              )}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Network
            size={18}
          />

          <div>
            <span>
              Category dependency
            </span>

            <strong>
              {intelligence.categorySharePct.toFixed(1)}
              %
            </strong>

            <small>
              Tolerance
              {" "}
              {intelligence.dependencyTolerancePct.toFixed(1)}
              %
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Building2
            size={18}
          />

          <div>
            <span>
              Alternate suppliers
            </span>

            <strong>
              {intelligence.alternateSupplierCount}
            </strong>

            <small>
              {intelligence.alternateGap}
              {" below configured target"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <ShieldCheck
            size={18}
          />

          <div>
            <span>
              Mitigation actions
            </span>

            <strong>
              {intelligence.openMitigationActions}
            </strong>

            <small>
              {intelligence.overdueMitigationActions}
              {" overdue"}
            </small>
          </div>
        </article>
      </section>

      {intelligence.singleSource
      ||
      intelligence.dependencyToleranceBreached
      ||
      intelligence.capacityStatus ===
        "AT_RISK" ? (
        <section className="resilience-alert-banner">
          <AlertTriangle
            size={18}
          />

          <div>
            <strong>
              Supply continuity exposure detected
            </strong>

            <span>
              {intelligence.singleSource
                ? "No active same-category alternate supplier is currently available. "
                : ""}
              {intelligence.dependencyToleranceBreached
                ? "Category dependency exceeds the configured tolerance. "
                : ""}
              {intelligence.capacityStatus ===
              "AT_RISK"
                ? "Supplier capacity is marked at risk."
                : ""}
            </span>
          </div>
        </section>
      ) : null}

      <section className="resilience-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Dependency intelligence
              </span>

              <h2>
                Concentration exposure
              </h2>
            </div>

            <Network
              size={19}
            />
          </div>

          <div className="resilience-exposure-grid">
            <div>
              <span>
                Supplier spend
              </span>

              <strong>
                {money(
                  intelligence.supplierSpend,
                  currency,
                )}
              </strong>

              <small>
                {intelligence.spendSharePct.toFixed(1)}
                %
                {" portfolio"}
              </small>
            </div>

            <div>
              <span>
                Category spend
              </span>

              <strong>
                {money(
                  intelligence.categorySpend,
                  currency,
                )}
              </strong>

              <small>
                Supplier represents
                {" "}
                {intelligence.categorySharePct.toFixed(1)}
                %
              </small>
            </div>

            <div>
              <span>
                Country spend
              </span>

              <strong>
                {money(
                  intelligence.countrySpend,
                  currency,
                )}
              </strong>

              <small>
                {intelligence.countrySpendSharePct.toFixed(1)}
                %
                {" portfolio exposure"}
              </small>
            </div>

            <div>
              <span>
                Contract coverage
              </span>

              <strong>
                {intelligence.activeContractCoverage
                  ? "Active"
                  : "Missing"}
              </strong>

              <small>
                Current supplier contract
              </small>
            </div>

            <div>
              <span>
                Latest performance
              </span>

              <strong>
                {intelligence.latestPerformanceScore !==
                null
                  ? intelligence.latestPerformanceScore.toFixed(1)
                  : "—"}
              </strong>

              <small>
                Approved supplier review
              </small>
            </div>

            <div>
              <span>
                Open CAPA
              </span>

              <strong>
                {intelligence.openCorrectiveActions}
              </strong>

              <small>
                Supplier improvement actions
              </small>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Alternative supply
              </span>

              <h2>
                Same-category coverage
              </h2>
            </div>

            <Star
              size={19}
            />
          </div>

          {alternatives.length ===
          0 ? (
            <div className="resilience-empty">
              This is currently a
              single-source category
              within the active supplier
              portfolio.
            </div>
          ) : (
            <div className="resilience-alternative-list">
              {alternatives
                .slice(
                  0,
                  8,
                )
                .map(
                  alternative => (
                    <article
                      key={
                        alternative.supplierId
                      }
                    >
                      <div>
                        <strong>
                          {alternative.supplierName}
                        </strong>

                        <span>
                          {alternative.supplierCode}
                          {" · "}
                          {alternative.country ??
                            "Unknown"}
                        </span>
                      </div>

                      <div>
                        <span>
                          Risk
                        </span>

                        <strong>
                          {alternative.riskLevel ??
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Rating
                        </span>

                        <strong>
                          {alternative.rating?.toFixed(1) ??
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Performance
                        </span>

                        <strong>
                          {alternative.latestPerformanceScore?.toFixed(1) ??
                            "—"}
                        </strong>
                      </div>

                      <Link
                        href={
                          `/suppliers/${alternative.supplierId}`
                        }
                        className="table-action"
                      >
                        Open
                      </Link>
                    </article>
                  ),
                )}
            </div>
          )}
        </section>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={saveProfile}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Resilience governance
              </span>

              <h2>
                Supplier continuity profile
              </h2>
            </div>

            <ShieldCheck
              size={19}
            />
          </div>

          <div className="resilience-form-grid">
            <label className="request-field">
              <span>
                Criticality
              </span>

              <select
                value={criticality}
                onChange={
                  event =>
                    setCriticality(
                      event.target.value as
                        SupplierCriticality,
                    )
                }
              >
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
            </label>

            <label className="request-field">
              <span>
                Capacity status
              </span>

              <select
                value={capacityStatus}
                onChange={
                  event =>
                    setCapacityStatus(
                      event.target.value as
                        SupplierCapacityStatus,
                    )
                }
              >
                <option value="UNKNOWN">
                  Unknown
                </option>

                <option value="ADEQUATE">
                  Adequate
                </option>

                <option value="CONSTRAINED">
                  Constrained
                </option>

                <option value="AT_RISK">
                  At risk
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Dependency tolerance %
              </span>

              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={
                  dependencyTolerancePct
                }
                onChange={
                  event =>
                    setDependencyTolerancePct(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Minimum alternates
              </span>

              <input
                required
                type="number"
                min="0"
                max="20"
                value={
                  minimumAlternates
                }
                onChange={
                  event =>
                    setMinimumAlternates(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field resilience-form-wide">
              <span>
                Profile owner
              </span>

              <select
                value={
                  profileOwnerUserId
                }
                onChange={
                  event =>
                    setProfileOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.users
                  .filter(
                    candidate =>
                      candidate.role !==
                      "REQUESTER",
                  )
                  .map(
                    candidate => (
                      <option
                        key={
                          candidate.id
                        }
                        value={
                          candidate.id
                        }
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field resilience-form-wide">
              <span>
                Business impact
              </span>

              <textarea
                rows={3}
                maxLength={2000}
                value={businessImpact}
                onChange={
                  event =>
                    setBusinessImpact(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field resilience-form-wide">
              <span>
                Capacity assessment
              </span>

              <textarea
                rows={3}
                maxLength={2000}
                value={capacityNotes}
                onChange={
                  event =>
                    setCapacityNotes(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field resilience-form-wide">
              <span>
                Governance notes
              </span>

              <textarea
                rows={3}
                maxLength={3000}
                value={profileNotes}
                onChange={
                  event =>
                    setProfileNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="resilience-form-actions">
            {canApprove &&
            intelligence.profileId &&
            intelligence.profileStatus ===
              "ACTIVE" ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={
                  () =>
                    void deactivateProfile()
                }
              >
                <XCircle
                  size={16}
                />
                Deactivate profile
              </button>
            ) : null}

            <button
              type="submit"
              className="button button--primary"
              disabled={savingProfile}
            >
              <ShieldCheck
                size={16}
              />

              {savingProfile
                ? "Saving..."
                : intelligence.profileId
                  ? "Update profile"
                  : "Create profile"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Continuity execution
            </span>

            <h2>
              Mitigation plan
            </h2>
          </div>

          <FileCheck2
            size={19}
          />
        </div>

        {mitigationActions.length ===
        0 ? (
          <div className="resilience-empty">
            No supplier resilience
            mitigation actions are
            currently recorded.
          </div>
        ) : (
          <div className="resilience-action-list">
            {mitigationActions.map(
              action => (
                <article
                  key={action.id}
                  className={
                    action.overdue
                      ? "resilience-action-card resilience-action-card--overdue"
                      : "resilience-action-card"
                  }
                >
                  <div className="resilience-action-heading">
                    <div>
                      <span
                        className={
                          `resilience-action-status resilience-action-status--${action.status.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          action.status,
                        )}
                      </span>

                      <strong>
                        {action.title}
                      </strong>

                      <small>
                        {readable(
                          action.actionType,
                        )}
                      </small>
                    </div>

                    <div>
                      <span>
                        Due
                      </span>

                      <strong
                        className={
                          action.overdue
                            ? "resilience-overdue"
                            : ""
                        }
                      >
                        {new Date(
                          `${action.dueDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {action.description ? (
                    <p>
                      {action.description}
                    </p>
                  ) : null}

                  <div className="resilience-action-meta">
                    <span>
                      Owner:
                      {" "}
                      {action.ownerName}
                    </span>
                  </div>

                  {action.completionNote ? (
                    <div className="resilience-completion-note">
                      {action.completionNote}
                    </div>
                  ) : null}

                  {canManage &&
                  (
                    action.status ===
                      "OPEN"
                    ||
                    action.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="resilience-action-controls">
                      {action.status ===
                      "OPEN" ? (
                        <button
                          type="button"
                          className="resilience-inline-button"
                          onClick={
                            () =>
                              void startAction(
                                action,
                              )
                          }
                        >
                          <Play
                            size={14}
                          />
                          Start
                        </button>
                      ) : null}

                      <input
                        value={
                          completionNotes[
                            action.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Completion evidence / result"
                        }
                        onChange={
                          event =>
                            setCompletionNotes(
                              current => ({
                                ...current,
                                [action.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <button
                        type="button"
                        className="resilience-inline-button"
                        disabled={
                          !(
                            completionNotes[
                              action.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void completeAction(
                              action,
                            )
                        }
                      >
                        <BadgeCheck
                          size={14}
                        />
                        Complete
                      </button>

                      {canApprove ? (
                        <button
                          type="button"
                          className="resilience-inline-button resilience-inline-button--danger"
                          onClick={
                            () =>
                              void cancelAction(
                                action,
                              )
                          }
                        >
                          <XCircle
                            size={14}
                          />
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      intelligence.profileId &&
      intelligence.profileStatus ===
        "ACTIVE" ? (
        <form
          className="panel"
          onSubmit={createAction}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Continuity mitigation
              </span>

              <h2>
                Add resilience action
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="resilience-form-grid">
            <label className="request-field">
              <span>
                Action type
              </span>

              <select
                value={actionType}
                onChange={
                  event =>
                    setActionType(
                      event.target.value as
                        ResilienceActionType,
                    )
                }
              >
                <option value="QUALIFY_ALTERNATE">
                  Qualify alternate
                </option>

                <option value="REDUCE_DEPENDENCY">
                  Reduce dependency
                </option>

                <option value="CONTRACT_COVERAGE">
                  Contract coverage
                </option>

                <option value="CAPACITY_REVIEW">
                  Capacity review
                </option>

                <option value="GEOGRAPHIC_DIVERSIFICATION">
                  Geographic diversification
                </option>

                <option value="PERFORMANCE_IMPROVEMENT">
                  Performance improvement
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Due date
              </span>

              <input
                required
                type="date"
                value={actionDueDate}
                onChange={
                  event =>
                    setActionDueDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field resilience-form-wide">
              <span>
                Action title
              </span>

              <input
                required
                maxLength={220}
                value={actionTitle}
                onChange={
                  event =>
                    setActionTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field resilience-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={actionDescription}
                onChange={
                  event =>
                    setActionDescription(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field resilience-form-wide">
              <span>
                Owner
              </span>

              <select
                value={actionOwnerUserId}
                onChange={
                  event =>
                    setActionOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.users
                  .filter(
                    candidate =>
                      candidate.role !==
                      "REQUESTER",
                  )
                  .map(
                    candidate => (
                      <option
                        key={
                          candidate.id
                        }
                        value={
                          candidate.id
                        }
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>
          </div>

          <div className="resilience-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                savingAction
                ||
                !actionTitle.trim()
              }
            >
              <Plus
                size={16}
              />

              {savingAction
                ? "Adding..."
                : "Add mitigation action"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
