"use client";

import {
  ArrowLeft,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Plus,
  Send,
  Target,
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
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addSavingsRealization,
  closeSavingsInitiative,
  getSavingsContextOptions,
  getSavingsInitiative,
  rejectSavingsInitiative,
  submitSavingsInitiative,
  validateSavingsInitiative,
} from "@/lib/api";

import type {
  SavingsContextOptions,
  SavingsInitiative,
} from "@/types/savings";

function money(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
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

export default function SavingsDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    initiative,
    setInitiative,
  ] =
    useState<
      SavingsInitiative |
      null
    >(null);

  const [
    options,
    setOptions,
  ] =
    useState<
      SavingsContextOptions |
      null
    >(null);

  const [
    decisionNote,
    setDecisionNote,
  ] =
    useState("");

  const [
    realizationAmount,
    setRealizationAmount,
  ] =
    useState(0);

  const [
    realizationDate,
    setRealizationDate,
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
    realizationPoId,
    setRealizationPoId,
  ] =
    useState("");

  const [
    realizationNotes,
    setRealizationNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    realizationSaving,
    setRealizationSaving,
  ] =
    useState(false);

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

  const canValidate =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  async function reload() {
    const response =
      await getSavingsInitiative(
        params.id,
      );

    setInitiative(
      response,
    );

    setRealizationAmount(
      Math.max(
        0,
        response.remainingSavings,
      ),
    );
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      getSavingsInitiative(
        params.id,
      ),
      getSavingsContextOptions(),
    ])
      .then(
        ([
          initiativeResponse,
          optionsResponse,
        ]) => {
          if (!active) {
            return;
          }

          setInitiative(
            initiativeResponse,
          );

          setOptions(
            optionsResponse,
          );

          setRealizationAmount(
            Math.max(
              0,
              initiativeResponse
                .remainingSavings,
            ),
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
              : "Unable to load savings initiative.",
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
  ]);

  async function runLifecycle(
    action:
      | "SUBMIT"
      | "VALIDATE"
      | "REJECT"
      | "CLOSE",
  ) {
    if (!initiative) {
      return;
    }

    try {
      setRunning(true);
      setError(null);

      let updated:
        SavingsInitiative;

      if (
        action === "SUBMIT"
      ) {
        updated =
          await submitSavingsInitiative(
            initiative.id,
          );
      } else if (
        action === "VALIDATE"
      ) {
        updated =
          await validateSavingsInitiative(
            initiative.id,
            decisionNote,
          );
      } else if (
        action === "REJECT"
      ) {
        updated =
          await rejectSavingsInitiative(
            initiative.id,
            decisionNote,
          );
      } else {
        updated =
          await closeSavingsInitiative(
            initiative.id,
          );
      }

      setInitiative(
        updated,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update savings workflow.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addRealization(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!initiative) {
      return;
    }

    try {
      setRealizationSaving(
        true,
      );

      setError(null);

      await addSavingsRealization(
        initiative.id,
        {
          amount:
            realizationAmount,
          realizationDate,
          purchaseOrderId:
            realizationPoId ||
            undefined,
          notes:
            realizationNotes
              .trim() ||
            undefined,
        },
      );

      setRealizationNotes("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to record savings realization.",
      );
    } finally {
      setRealizationSaving(
        false,
      );
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading savings initiative...
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="page-stack">
        <Link
          href="/savings"
          className="request-back-link"
        >
          <ArrowLeft size={16} />
          Savings & value
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />
          {error ??
            "Savings initiative not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/savings"
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Savings & value
      </Link>

      <section className="savings-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {initiative.savingsNumber}
            </span>

            <span
              className={
                `savings-status savings-status--${initiative.status.toLowerCase()}`
              }
            >
              {readable(
                initiative.status,
              )}
            </span>

            <span>
              {readable(
                initiative.origin,
              )}
            </span>
          </div>

          <h1>
            {initiative.title}
          </h1>

          <p>
            {readable(
              initiative.savingsType,
            )}
            {" · "}
            {initiative.category ??
              "Uncategorized"}
            {" · Owner: "}
            {initiative.ownerName}
          </p>
        </div>

        <div className="savings-detail-actions">
          {canManage &&
          initiative.status ===
            "DRAFT" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={running}
              onClick={
                () =>
                  void runLifecycle(
                    "SUBMIT",
                  )
              }
            >
              <Send size={16} />
              Submit
            </button>
          ) : null}

          {canValidate &&
          initiative.status ===
            "VALIDATED" ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={running}
              onClick={
                () =>
                  void runLifecycle(
                    "CLOSE",
                  )
              }
            >
              <CheckCircle2 size={16} />
              Close initiative
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      <section className="savings-detail-kpis">
        <article className="request-detail-summary-card">
          <Target size={18} />

          <div>
            <span>
              Target savings
            </span>

            <strong>
              {money(
                initiative.targetSavings,
                initiative.currency,
              )}
            </strong>

            <small>
              Baseline{" "}
              {money(
                initiative.baselineValue,
                initiative.currency,
              )}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <Banknote size={18} />

          <div>
            <span>
              Realized
            </span>

            <strong>
              {money(
                initiative.realizedSavings,
                initiative.currency,
              )}
            </strong>

            <small>
              {initiative.realizationRate.toFixed(1)}
              %
              {" realization"}
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <BadgeDollarSign size={18} />

          <div>
            <span>
              Remaining
            </span>

            <strong>
              {money(
                initiative.remainingSavings,
                initiative.currency,
              )}
            </strong>

            <small>
              Target less realized
            </small>
          </div>
        </article>

        <article className="request-detail-summary-card">
          <FileCheck2 size={18} />

          <div>
            <span>
              Negotiated
            </span>

            <strong>
              {money(
                initiative.negotiatedValue,
                initiative.currency,
              )}
            </strong>

            <small>
              Commercial value
            </small>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Procurement context
            </span>

            <h2>
              Value attribution
            </h2>
          </div>
        </div>

        <div className="savings-context-grid">
          <div>
            <span>Supplier</span>

            {initiative.supplierId ? (
              <Link
                href={
                  `/suppliers/${initiative.supplierId}`
                }
              >
                {initiative.supplierName}
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>RFQ</span>

            {initiative.rfqId ? (
              <Link
                href={
                  `/rfqs/${initiative.rfqId}`
                }
              >
                {initiative.rfqNumber}
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>
              Purchase order
            </span>

            {initiative.purchaseOrderId ? (
              <Link
                href={
                  `/purchase-orders/${initiative.purchaseOrderId}`
                }
              >
                {initiative.purchaseOrderNumber}
              </Link>
            ) : (
              <strong>—</strong>
            )}
          </div>

          <div>
            <span>
              Fiscal year
            </span>

            <strong>
              {initiative.fiscalYear}
              {" · "}
              {initiative.currency}
            </strong>
          </div>
        </div>
      </section>

      {canValidate &&
      initiative.status ===
        "SUBMITTED" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Value assurance
              </span>

              <h2>
                Validation decision
              </h2>
            </div>
          </div>

          <label className="request-field">
            <span>
              Validation rationale
            </span>

            <textarea
              rows={5}
              maxLength={2000}
              value={decisionNote}
              onChange={
                event =>
                  setDecisionNote(
                    event.target.value,
                  )
              }
            />
          </label>

          <div className="savings-decision-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                running ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void runLifecycle(
                    "REJECT",
                  )
              }
            >
              <XCircle size={16} />
              Reject
            </button>

            <button
              type="button"
              className="button button--primary"
              disabled={
                running ||
                !decisionNote.trim()
              }
              onClick={
                () =>
                  void runLifecycle(
                    "VALIDATE",
                  )
              }
            >
              <CheckCircle2 size={16} />
              Validate savings
            </button>
          </div>
        </section>
      ) : null}

      {initiative.decisionNote ? (
        <section className="savings-decision-card">
          <FileCheck2 size={19} />

          <div>
            <span>
              Value assurance decision
            </span>

            <strong>
              {initiative.decisionNote}
            </strong>

            <small>
              {initiative.decidedByName ??
                "Management"}
              {initiative.decisionAt
                ? ` · ${new Date(
                    initiative.decisionAt,
                  ).toLocaleString()}`
                : ""}
            </small>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Value realization
            </span>

            <h2>
              Realization history
            </h2>
          </div>

          <Banknote size={19} />
        </div>

        {initiative.realizations.length ===
        0 ? (
          <div className="savings-empty">
            No savings realization has
            been recorded.
          </div>
        ) : (
          <div className="savings-realization-list">
            {initiative.realizations.map(
              realization => (
                <article
                  key={realization.id}
                  className="savings-realization-row"
                >
                  <div>
                    <strong>
                      {money(
                        realization.amount,
                        initiative.currency,
                      )}
                    </strong>

                    <span>
                      {readable(
                        realization.sourceType,
                      )}
                    </span>
                  </div>

                  <div>
                    <span>Date</span>

                    <strong>
                      {new Date(
                        `${realization.realizationDate}T00:00:00`,
                      )
                        .toLocaleDateString()}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Purchase order
                    </span>

                    <strong>
                      {realization.purchaseOrderNumber ??
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Recorded by
                    </span>

                    <strong>
                      {realization.createdByName}
                    </strong>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {canManage &&
      initiative.status ===
        "VALIDATED" ? (
        <form
          className="panel"
          onSubmit={addRealization}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Realization entry
              </span>

              <h2>
                Record realized value
              </h2>
            </div>

            <Plus size={19} />
          </div>

          <div className="savings-form-grid">
            <label className="request-field">
              <span>Amount</span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={realizationAmount}
                onChange={
                  event =>
                    setRealizationAmount(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Realization date
              </span>

              <input
                required
                type="date"
                value={realizationDate}
                onChange={
                  event =>
                    setRealizationDate(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field savings-form-wide">
              <span>
                Purchase order
              </span>

              <select
                value={realizationPoId}
                onChange={
                  event =>
                    setRealizationPoId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  No purchase order
                </option>

                {options
                  ?.purchaseOrders
                  .filter(
                    order =>
                      (
                        !initiative.supplierId ||
                        order.supplierId ===
                          initiative.supplierId
                      )
                      &&
                      order.currency ===
                        initiative.currency,
                  )
                  .map(
                    order => (
                      <option
                        key={order.id}
                        value={order.id}
                      >
                        {order.purchaseOrderNumber}
                        {" — "}
                        {money(
                          order.totalAmount,
                          order.currency,
                        )}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field savings-form-wide">
              <span>Notes</span>

              <textarea
                rows={4}
                maxLength={2000}
                value={realizationNotes}
                onChange={
                  event =>
                    setRealizationNotes(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="savings-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={realizationSaving}
            >
              <Plus size={16} />

              {realizationSaving
                ? "Recording..."
                : "Record realization"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
