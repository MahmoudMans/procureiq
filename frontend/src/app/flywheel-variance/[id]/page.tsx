"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Scale,
} from "lucide-react";

import Link from "next/link";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addFlywheelVarianceItem,
  approveFlywheelVariancePlan,
  captureFlywheelVarianceSnapshot,
  closeFlywheelVariancePlan,
  getFlywheelVariancePlan,
  submitFlywheelVarianceForReview,
} from "@/lib/api";

import type {
  FlywheelVarianceDecision,
  FlywheelVariancePlanDetail,
} from "@/types/flywheel-variance";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

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
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${currency}`;
}

export default function FlywheelVariancePlanPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FlywheelVariancePlanDetail |
      null
    >(null);

  const [
    settlementItemId,
    setSettlementItemId,
  ] =
    useState("");

  const [
    decision,
    setDecision,
  ] =
    useState<FlywheelVarianceDecision>(
      "INVESTIGATE",
    );

  const [
    rationale,
    setRationale,
  ] =
    useState("");

  const [
    targetDate,
    setTargetDate,
  ] =
    useState(
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),
    );

  const [
    approvalNote,
    setApprovalNote,
  ] =
    useState("");

  const [
    closeNote,
    setCloseNote,
  ] =
    useState("");

  const [
    running,
    setRunning,
  ] =
    useState(false);

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

  const canApprove =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  function syncCandidate(
    response:
      FlywheelVariancePlanDetail,
  ) {
    setSettlementItemId(
      response.candidates[0]
        ?.settlementItemId
      ??
      "",
    );
  }

  async function reload() {
    const response =
      await getFlywheelVariancePlan(
        params.id,
      );

    setDetail(
      response,
    );

    syncCandidate(
      response,
    );
  }

  useEffect(() => {
    let active = true;

    getFlywheelVariancePlan(
      params.id,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setDetail(
            response,
          );

          setSettlementItemId(
            response.candidates[0]
              ?.settlementItemId
            ??
            "",
          );
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load variance-resolution plan.",
            );
          }
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
  ]);

  async function addDecision(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const response =
        await addFlywheelVarianceItem(
          params.id,
          {
            settlementItemId,
            decision,
            decisionRationale:
              rationale.trim(),
            targetDate,
          },
        );

      setDetail(
        response,
      );

      setRationale("");

      syncCandidate(
        response,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add variance decision.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function submitReview() {
    try {
      setRunning(true);
      setError(null);

      setDetail(
        await submitFlywheelVarianceForReview(
          params.id,
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to submit variance plan for review.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function approve() {
    if (
      !approvalNote.trim()
    ) {
      setError(
        "Approval note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await approveFlywheelVariancePlan(
          params.id,
          approvalNote.trim(),
        ),
      );

      setApprovalNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to approve variance plan.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closePlan() {
    if (
      !closeNote.trim()
    ) {
      setError(
        "Closure note is required.",
      );
      return;
    }

    try {
      setRunning(true);
      setError(null);

      setDetail(
        await closeFlywheelVariancePlan(
          params.id,
          closeNote.trim(),
        ),
      );

      setCloseNote("");
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close variance plan.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function snapshot() {
    try {
      setRunning(true);
      setError(null);

      await captureFlywheelVarianceSnapshot(
        params.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to capture variance snapshot.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading variance plan...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/flywheel-variance"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Variance resolution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />

          {error ??
            "Variance plan not found."}
        </div>
      </div>
    );
  }

  const plan =
    detail.plan;

  const source =
    detail.sourceAuthority;

  const complete =
    plan.coveragePct ===
      100
    &&
    detail.candidates.length ===
      0
    &&
    plan.itemCount > 0;

  return (
    <div className="page-stack">
      <Link
        href="/flywheel-variance"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Variance resolution
      </Link>

      <section className="fwstrategy-detail-heading">
        <div>
          <span className="eyebrow">
            Settlement variance governance
          </span>

          <h1>
            {plan.title}
          </h1>

          <p>
            {plan.planNumber}
            {" · "}
            {plan.currency}
            {" · "}
            {
              source
                .reconciliationNumber
            }
          </p>
        </div>

        <div className="fwstrategy-heading-actions">
          {canManage ? (
            <button
              type="button"
              className="button"
              disabled={running}
              onClick={
                () =>
                  void snapshot()
              }
            >
              <Camera
                size={14}
              />
              Snapshot
            </button>
          ) : null}

          <span className="fwstrategy-status-chip">
            {readable(
              plan.status,
            )}
          </span>
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

      <section className="fwstrategy-detail-grid">
        <article>
          <span>
            Source variance
          </span>

          <strong>
            {money(
              plan
                .sourceVarianceAmount,
              plan.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Recovery
          </span>

          <strong>
            {money(
              plan
                .recoverAmount,
              plan.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Write-off
          </span>

          <strong>
            {money(
              plan
                .writeOffAmount,
              plan.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Investigation
          </span>

          <strong>
            {money(
              plan
                .investigationAmount,
              plan.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Governed
          </span>

          <strong>
            {money(
              plan
                .governedAmount,
              plan.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Coverage
          </span>

          <strong>
            {
              plan
                .coveragePct
                .toFixed(1)
            }
            %
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Step 71/72 authority
            </span>

            <h2>
              Reconciled settlement
            </h2>
          </div>

          <Scale
            size={19}
          />
        </div>

        <div className="fwstrategy-context-grid">
          <div>
            <span>
              Reconciliation
            </span>

            <strong>
              {
                source
                  .reconciliationNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Release
            </span>

            <strong>
              {
                source
                  .releaseNumber
              }
            </strong>
          </div>

          <div>
            <span>
              Settlement owner
            </span>

            <strong>
              {
                source
                  .reconciliationOwnerName
              }
            </strong>
          </div>

          <div>
            <span>
              Variance-plan owner
            </span>

            <strong>
              {
                plan
                  .planOwnerName
              }
            </strong>
          </div>

          <div className="fwstrategy-context-wide">
            <span>
              Resolution objective
            </span>

            <p>
              {
                plan
                  .resolutionObjective
              }
            </p>
          </div>
        </div>
      </section>

      {plan.status ===
        "DRAFT"
      &&
      canManage ? (
        <form
          className="panel"
          onSubmit={addDecision}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Human treatment decision
              </span>

              <h2>
                Govern settlement variance
              </h2>
            </div>
          </div>

          {detail.candidates.length >
          0 ? (
            <>
              <div className="fwstrategy-form-grid">
                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Variance item
                  </span>

                  <select
                    required
                    value={
                      settlementItemId
                    }
                    onChange={
                      event =>
                        setSettlementItemId(
                          event.target.value,
                        )
                    }
                  >
                    {detail
                      .candidates
                      .map(
                        candidate => (
                          <option
                            key={
                              candidate
                                .settlementItemId
                            }
                            value={
                              candidate
                                .settlementItemId
                            }
                          >
                            {
                              candidate
                                .rootTargetInitiativeTitle
                            }
                            {" — "}
                            {
                              candidate
                                .lineageNumber
                            }
                            {" — variance "}
                            {money(
                              candidate
                                .sourceVarianceAmount,
                              plan.currency,
                            )}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Treatment
                  </span>

                  <select
                    value={decision}
                    onChange={
                      event =>
                        setDecision(
                          event.target
                            .value as
                            FlywheelVarianceDecision,
                        )
                    }
                  >
                    <option value="RECOVER">
                      Recover
                    </option>

                    <option value="WRITE_OFF">
                      Write off
                    </option>

                    <option value="INVESTIGATE">
                      Investigate
                    </option>
                  </select>
                </label>

                <label className="request-field">
                  <span>
                    Target date
                  </span>

                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={
                      event =>
                        setTargetDate(
                          event.target.value,
                        )
                    }
                  />
                </label>

                <label className="request-field fwstrategy-form-wide">
                  <span>
                    Decision rationale
                  </span>

                  <textarea
                    required
                    rows={4}
                    maxLength={5000}
                    value={rationale}
                    onChange={
                      event =>
                        setRationale(
                          event.target.value,
                        )
                    }
                  />
                </label>
              </div>

              <div className="fwstrategy-form-actions">
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={
                    running
                    ||
                    !settlementItemId
                    ||
                    !targetDate
                    ||
                    !rationale.trim()
                  }
                >
                  Record treatment decision
                </button>
              </div>
            </>
          ) : (
            <p>
              Every positive variance
              item has a treatment
              decision.
            </p>
          )}
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Resolution decisions
            </span>

            <h2>
              Governed variance
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lineage</th>
                <th>Source status</th>
                <th>Variance</th>
                <th>Decision</th>
                <th>Target</th>
                <th>Rationale</th>
                <th>Added by</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.id}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {
                            item
                              .rootTargetInitiativeTitle
                          }
                        </strong>

                        <span>
                          {
                            item
                              .lineageNumber
                          }
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item
                          .sourceReconciliationStatus,
                      )}
                    </td>

                    <td>
                      {money(
                        item
                          .sourceVarianceAmount,
                        plan.currency,
                      )}
                    </td>

                    <td>
                      <strong>
                        {readable(
                          item.decision,
                        )}
                      </strong>
                    </td>

                    <td>
                      {
                        item
                          .targetDate
                      }
                    </td>

                    <td>
                      {
                        item
                          .decisionRationale
                      }
                    </td>

                    <td>
                      {
                        item
                          .addedByName
                      }
                    </td>
                  </tr>
                ),
              )}

              {detail.items.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No variance treatment
                    decision has been
                    recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {plan.status ===
        "DRAFT"
      &&
      canManage ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                100% coverage gate
              </span>

              <h2>
                Submit for approval review
              </h2>
            </div>
          </div>

          <p>
            Every positive settlement
            variance must have exactly
            one governed treatment
            before review.
          </p>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !complete
              }
              onClick={
                () =>
                  void submitReview()
              }
            >
              Submit for review
            </button>
          </div>
        </section>
      ) : null}

      {plan.status ===
        "IN_REVIEW"
      &&
      canApprove ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Manager treatment authority
              </span>

              <h2>
                Approve variance plan
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Approval rationale
            </span>

            <textarea
              rows={5}
              maxLength={5000}
              value={approvalNote}
              onChange={
                event =>
                  setApprovalNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={
                running
                ||
                !approvalNote.trim()
              }
              onClick={
                () =>
                  void approve()
              }
            >
              Approve plan
            </button>
          </div>
        </section>
      ) : null}

      {plan.status ===
        "APPROVED"
      &&
      canApprove ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Governance lifecycle
              </span>

              <h2>
                Close variance plan
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Closure rationale
            </span>

            <textarea
              rows={4}
              maxLength={5000}
              value={closeNote}
              onChange={
                event =>
                  setCloseNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="fwstrategy-form-actions">
            <button
              type="button"
              className="button"
              disabled={
                running
                ||
                !closeNote.trim()
              }
              onClick={
                () =>
                  void closePlan()
              }
            >
              Close plan
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Immutable variance evidence
            </span>

            <h2>
              Snapshots
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Status</th>
                <th>Recovery</th>
                <th>Write-off</th>
                <th>Investigation</th>
                <th>Coverage</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {detail.snapshots.map(
                snapshotItem => (
                  <tr
                    key={
                      snapshotItem.id
                    }
                  >
                    <td>
                      {
                        snapshotItem
                          .snapshotNumber
                      }
                    </td>

                    <td>
                      {readable(
                        snapshotItem
                          .planStatus,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .recoverAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .writeOffAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {money(
                        snapshotItem
                          .investigationAmount,
                        snapshotItem
                          .currency,
                      )}
                    </td>

                    <td>
                      {
                        snapshotItem
                          .coveragePct
                          .toFixed(1)
                      }
                      %
                    </td>

                    <td>
                      <Link
                        href={
                          `/flywheel-variance/snapshots/${snapshotItem.id}`
                        }
                        className="table-action"
                      >
                        Evidence
                      </Link>
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
