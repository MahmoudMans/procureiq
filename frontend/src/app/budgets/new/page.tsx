"use client";

import {
  ArrowLeft,
  CircleAlert,
  WalletCards,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createBudgetAllocation,
  getBudgetContextOptions,
} from "@/lib/api";

import type {
  BudgetContextOptions,
  BudgetScopeType,
} from "@/types/budget";

const CURRENT_YEAR =
  new Date()
    .getUTCFullYear();

export default function NewBudgetPage() {
  const router =
    useRouter();

  const [
    options,
    setOptions,
  ] =
    useState<
      BudgetContextOptions |
      null
    >(null);

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      CURRENT_YEAR,
    );

  const [
    scopeType,
    setScopeType,
  ] =
    useState<BudgetScopeType>(
      "DEPARTMENT",
    );

  const [
    departmentId,
    setDepartmentId,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState("");

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    budgetAmount,
    setBudgetAmount,
  ] =
    useState(100000);

  const [
    warningThreshold,
    setWarningThreshold,
  ] =
    useState(80);

  const [
    hardLimit,
    setHardLimit,
  ] =
    useState(false);

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    getBudgetContextOptions()
      .then(
        response => {
          if (!active) {
            return;
          }

          setOptions(
            response,
          );

          if (
            response.departments.length >
            0
          ) {
            setDepartmentId(
              response.departments[0].id,
            );
          }

          if (
            response.categories.length >
            0
          ) {
            setCategory(
              response.categories[0],
            );
          }

          const owner =
            response.users.find(
              user =>
                user.role !==
                "REQUESTER",
            );

          if (owner) {
            setOwnerUserId(
              owner.id,
            );
          }
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
              : "Unable to load budget context.",
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

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      await createBudgetAllocation({
        fiscalYear,
        scopeType,
        departmentId:
          scopeType ===
          "DEPARTMENT"
            ? departmentId
            : undefined,
        category:
          scopeType ===
          "CATEGORY"
            ? category.trim()
            : undefined,
        currency:
          currency
            .trim()
            .toUpperCase(),
        budgetAmount,
        warningThresholdPercent:
          warningThreshold,
        hardLimit,
        ownerUserId:
          ownerUserId ||
          undefined,
        notes:
          notes.trim() ||
          undefined,
      });

      router.push(
        "/budgets",
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create budget allocation.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/budgets"
        className="request-back-link"
      >
        <ArrowLeft size={16} />
        Budget control
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement planning
          </span>

          <h1>
            New budget allocation
          </h1>

          <p>
            Allocate annual procurement
            capacity to a department or
            spend category and configure
            warning and hard-limit
            controls.
          </p>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      <form
        className="panel"
        onSubmit={handleSubmit}
      >
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Allocation setup
            </span>

            <h2>
              Budget authority
            </h2>
          </div>

          <WalletCards size={19} />
        </div>

        <div className="budget-form-grid">
          <label className="request-field">
            <span>
              Fiscal year
            </span>

            <input
              required
              type="number"
              min="2000"
              max="2200"
              value={fiscalYear}
              onChange={
                event =>
                  setFiscalYear(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>Scope</span>

            <select
              value={scopeType}
              onChange={
                event =>
                  setScopeType(
                    event.target.value as
                      BudgetScopeType,
                  )
              }
            >
              <option value="DEPARTMENT">
                Department
              </option>

              <option value="CATEGORY">
                Category
              </option>
            </select>
          </label>

          {scopeType ===
          "DEPARTMENT" ? (
            <label className="request-field budget-form-wide">
              <span>
                Department
              </span>

              <select
                required
                disabled={loading}
                value={departmentId}
                onChange={
                  event =>
                    setDepartmentId(
                      event.target.value,
                    )
                }
              >
                {options
                  ?.departments
                  .map(
                    department => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </option>
                    ),
                  )}
              </select>
            </label>
          ) : (
            <label className="request-field budget-form-wide">
              <span>Category</span>

              <input
                required
                list="budget-category-options"
                maxLength={120}
                value={category}
                onChange={
                  event =>
                    setCategory(
                      event.target.value,
                    )
                }
              />

              <datalist id="budget-category-options">
                {options
                  ?.categories
                  .map(
                    option => (
                      <option
                        key={option}
                        value={option}
                      />
                    ),
                  )}
              </datalist>
            </label>
          )}

          <label className="request-field">
            <span>Currency</span>

            <input
              required
              minLength={3}
              maxLength={3}
              value={currency}
              onChange={
                event =>
                  setCurrency(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Budget amount
            </span>

            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={budgetAmount}
              onChange={
                event =>
                  setBudgetAmount(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Warning threshold %
            </span>

            <input
              required
              type="number"
              min="1"
              max="100"
              step="0.01"
              value={warningThreshold}
              onChange={
                event =>
                  setWarningThreshold(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>Owner</span>

            <select
              disabled={loading}
              value={ownerUserId}
              onChange={
                event =>
                  setOwnerUserId(
                    event.target.value,
                  )
              }
            >
              {options
                ?.users
                .filter(
                  user =>
                    user.role !==
                    "REQUESTER",
                )
                .map(
                  user => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.fullName}
                      {" — "}
                      {user.role}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="budget-hard-limit">
            <input
              type="checkbox"
              checked={hardLimit}
              onChange={
                event =>
                  setHardLimit(
                    event.target.checked,
                  )
              }
            />

            <div>
              <strong>
                Hard budget limit
              </strong>

              <span>
                Mark purchase requests
                as blocked when their
                projected forecast
                exceeds this allocation.
              </span>
            </div>
          </label>

          <label className="request-field budget-form-wide">
            <span>Notes</span>

            <textarea
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={
                event =>
                  setNotes(
                    event.target.value,
                  )
              }
            />
          </label>
        </div>

        <div className="budget-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving ||
              loading
            }
          >
            <WalletCards size={16} />

            {saving
              ? "Creating..."
              : "Create allocation"}
          </button>
        </div>
      </form>
    </div>
  );
}
