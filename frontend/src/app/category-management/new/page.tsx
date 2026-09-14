"use client";

import {
  ArrowLeft,
  CircleAlert,
  Layers3,
  Target,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  createCategoryStrategy,
  getCategoryManagementContext,
} from "@/lib/api";

import type {
  CategoryContext,
} from "@/types/category-management";

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

export default function NewCategoryStrategyPage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const currency =
    (
      searchParams.get(
        "currency",
      )
      ??
      "EUR"
    )
      .toUpperCase();

  const [
    context,
    setContext,
  ] =
    useState<
      CategoryContext |
      null
    >(null);

  const [
    categoryName,
    setCategoryName,
  ] =
    useState("");

  const [
    fiscalYear,
    setFiscalYear,
  ] =
    useState(
      new Date()
        .getFullYear(),
    );

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    savingsTargetPct,
    setSavingsTargetPct,
  ] =
    useState(3);

  const [
    objectives,
    setObjectives,
  ] =
    useState("");

  const [
    saving,
    setSaving,
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

  useEffect(() => {
    let active = true;

    getCategoryManagementContext(
      currency,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          if (
            response.categories[0]
          ) {
            setCategoryName(
              response.categories[0].categoryName,
            );
          }

          const owner =
            response.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (owner) {
            setOwnerUserId(
              owner.id,
            );
          }

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
              : "Unable to load category-management context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, [
    currency,
  ]);

  const category =
    useMemo(
      () =>
        context
          ?.categories
          .find(
            candidate =>
              candidate.categoryName ===
                categoryName,
          )
        ??
        null,
      [
        context,
        categoryName,
      ],
    );

  const targetAmount =
    (
      category?.totalSpend ??
      0
    )
    *
    savingsTargetPct
    /
    100;

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const result =
        await createCategoryStrategy({
          categoryName,
          currency,
          fiscalYear,
          ownerUserId:
            ownerUserId
            ||
            undefined,
          savingsTargetPct,
          objectives:
            objectives.trim(),
        });

      router.push(
        `/category-management/${result.strategy.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create category strategy.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/category-management"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Category management
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategic procurement
          </span>

          <h1>
            New category strategy
          </h1>

          <p>
            Snapshot the category
            baseline, define savings
            ambition and create a governed
            strategy for sourcing and
            supplier-market actions.
          </p>
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

      {!context ||
      context.categories.length ===
        0 ? (
        <section className="panel">
          <div className="category-empty">
            No active supplier categories
            are available in
            {" "}
            {currency}.
          </div>
        </section>
      ) : (
        <form
          className="category-create-layout"
          onSubmit={submit}
        >
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Strategy definition
                </span>

                <h2>
                  Planning scope
                </h2>
              </div>

              <Layers3
                size={19}
              />
            </div>

            <div className="category-form-grid">
              <label className="request-field category-form-wide">
                <span>
                  Category
                </span>

                <select
                  required
                  value={categoryName}
                  onChange={
                    event =>
                      setCategoryName(
                        event.target.value,
                      )
                  }
                >
                  {context.categories.map(
                    candidate => (
                      <option
                        key={candidate.categoryName}
                        value={candidate.categoryName}
                      >
                        {candidate.categoryName}
                        {" — "}
                        {money(
                          candidate.totalSpend,
                          candidate.currency,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Fiscal year
                </span>

                <input
                  required
                  type="number"
                  min="2020"
                  max="2100"
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
                <span>
                  Strategy owner
                </span>

                <select
                  value={ownerUserId}
                  onChange={
                    event =>
                      setOwnerUserId(
                        event.target.value,
                      )
                  }
                >
                  {context.users
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

              <label className="request-field">
                <span>
                  Savings target %
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={savingsTargetPct}
                  onChange={
                    event =>
                      setSavingsTargetPct(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                />
              </label>

              <label className="request-field">
                <span>
                  Currency
                </span>

                <input
                  value={currency}
                  disabled
                />
              </label>

              <label className="request-field category-form-wide">
                <span>
                  Strategy objectives
                </span>

                <textarea
                  required
                  rows={7}
                  maxLength={4000}
                  value={objectives}
                  placeholder={
                    "Describe sourcing priorities, supplier-market goals, demand levers, risk actions and expected outcomes."
                  }
                  onChange={
                    event =>
                      setObjectives(
                        event.target.value,
                      )
                  }
                />
              </label>
            </div>

            <div className="category-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  saving
                  ||
                  !categoryName
                  ||
                  !objectives.trim()
                }
              >
                <Target
                  size={16}
                />

                {saving
                  ? "Creating..."
                  : "Create category strategy"}
              </button>
            </div>
          </section>

          <aside className="category-create-side">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Live category
                  </span>

                  <h2>
                    Baseline preview
                  </h2>
                </div>
              </div>

              {!category ? (
                <div className="category-empty">
                  Select a category.
                </div>
              ) : (
                <div className="category-preview-grid">
                  <div>
                    <span>
                      Spend
                    </span>

                    <strong>
                      {money(
                        category.totalSpend,
                        category.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Suppliers
                    </span>

                    <strong>
                      {category.supplierCount}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Supplier risk
                    </span>

                    <strong>
                      {category.weightedSupplierRiskScore.toFixed(
                        1,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Top supplier share
                    </span>

                    <strong>
                      {category.topSupplierSpendShare.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </div>

                  <div>
                    <span>
                      Modeled opportunity
                    </span>

                    <strong>
                      {money(
                        category.modeledOpportunityAmount,
                        category.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Strategy target
                    </span>

                    <strong>
                      {money(
                        targetAmount,
                        category.currency,
                      )}
                    </strong>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}
