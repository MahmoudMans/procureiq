"use client";

import {
  ArrowLeft,
  CircleAlert,
  Compass,
  Route,
  Sparkles,
  Star,
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
} from "next/navigation";

import {
  createGuidedBuyingIntake,
  getGuidedBuyingContext,
  recommendGuidedBuying,
} from "@/lib/api";

import type {
  GuidedBuyingContext,
  GuidedBuyingRecommendation,
} from "@/types/guided-buying";

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

export default function NewGuidedBuyingIntakePage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      GuidedBuyingContext |
      null
    >(null);

  const [
    templateId,
    setTemplateId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

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
    estimatedAmount,
    setEstimatedAmount,
  ] =
    useState(1000);

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    recommendation,
    setRecommendation,
  ] =
    useState<
      GuidedBuyingRecommendation |
      null
    >(null);

  const [
    recommending,
    setRecommending,
  ] =
    useState(false);

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

    getGuidedBuyingContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
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
              : "Unable to load guided-buying context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const preferredForCategory =
    useMemo(
      () =>
        context
          ?.preferredSuppliers
          .filter(
            preferred =>
              preferred.active
              &&
              preferred.category.toLowerCase() ===
                category.toLowerCase(),
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.preferenceRank -
              right.preferenceRank,
          )
          ??
        [],
      [
        context,
        category,
      ],
    );

  function applyTemplate(
    selectedTemplateId:
      string,
  ) {
    setTemplateId(
      selectedTemplateId,
    );

    if (
      !selectedTemplateId
      ||
      !context
    ) {
      return;
    }

    const template =
      context.templates.find(
        item =>
          item.id ===
          selectedTemplateId,
      );

    if (!template) {
      return;
    }

    setCategory(
      template.category,
    );

    setCurrency(
      template.defaultCurrency,
    );

    if (
      template.defaultTitle
    ) {
      setTitle(
        template.defaultTitle,
      );
    }

    if (
      template.defaultEstimatedAmount !==
      null
    ) {
      setEstimatedAmount(
        template.defaultEstimatedAmount,
      );
    }

    if (
      template.defaultDepartmentId
    ) {
      setDepartmentId(
        template.defaultDepartmentId,
      );
    }

    setRecommendation(
      null,
    );
  }

  function inputPayload() {
    return {
      title:
        title.trim(),
      description:
        description.trim()
        ||
        undefined,
      departmentId,
      category:
        category.trim(),
      currency:
        currency
          .trim()
          .toUpperCase(),
      estimatedAmount,
      supplierId:
        supplierId
        ||
        undefined,
      templateId:
        templateId
        ||
        undefined,
      notes:
        notes.trim()
        ||
        undefined,
    };
  }

  async function previewRecommendation() {
    try {
      setRecommending(true);
      setError(null);

      setRecommendation(
        await recommendGuidedBuying(
          inputPayload(),
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to calculate guided-buying recommendation.",
      );
    } finally {
      setRecommending(false);
    }
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const intake =
        await createGuidedBuyingIntake(
          inputPayload(),
        );

      router.push(
        `/guided-buying/${intake.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create guided-buying intake.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/guided-buying"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Guided buying
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Procurement intake
          </span>

          <h1>
            New guided-buying intake
          </h1>

          <p>
            Describe the business need,
            select an optional template
            or supplier, and let
            ProcureIQ determine the
            policy-aware buying route.
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

      <form
        className="guided-intake-layout"
        onSubmit={handleSubmit}
      >
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Business need
              </span>

              <h2>
                Intake details
              </h2>
            </div>

            <Compass
              size={19}
            />
          </div>

          <div className="guided-form-grid">
            <label className="request-field guided-form-wide">
              <span>
                Reusable template
              </span>

              <select
                value={templateId}
                onChange={
                  event =>
                    applyTemplate(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Start without template
                </option>

                {context
                  ?.templates
                  .filter(
                    template =>
                      template.active,
                  )
                  .map(
                    template => (
                      <option
                        key={template.id}
                        value={template.id}
                      >
                        {template.templateCode}
                        {" — "}
                        {template.name}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field guided-form-wide">
              <span>
                Request title
              </span>

              <input
                required
                maxLength={220}
                value={title}
                onChange={
                  event => {
                    setTitle(
                      event.target.value,
                    );

                    setRecommendation(
                      null,
                    );
                  }
                }
              />
            </label>

            <label className="request-field guided-form-wide">
              <span>
                Description
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={description}
                onChange={
                  event =>
                    setDescription(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Department
              </span>

              <select
                required
                value={departmentId}
                onChange={
                  event => {
                    setDepartmentId(
                      event.target.value,
                    );

                    setRecommendation(
                      null,
                    );
                  }
                }
              >
                {context
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

            <label className="request-field">
              <span>
                Category
              </span>

              <input
                required
                list="guided-category-options"
                maxLength={120}
                value={category}
                onChange={
                  event => {
                    setCategory(
                      event.target.value,
                    );

                    setSupplierId("");
                    setRecommendation(
                      null,
                    );
                  }
                }
              />

              <datalist id="guided-category-options">
                {context
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

            <label className="request-field">
              <span>
                Currency
              </span>

              <input
                required
                minLength={3}
                maxLength={3}
                value={currency}
                onChange={
                  event => {
                    setCurrency(
                      event.target.value,
                    );

                    setRecommendation(
                      null,
                    );
                  }
                }
              />
            </label>

            <label className="request-field">
              <span>
                Estimated amount
              </span>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={estimatedAmount}
                onChange={
                  event => {
                    setEstimatedAmount(
                      Number(
                        event.target.value,
                      ),
                    );

                    setRecommendation(
                      null,
                    );
                  }
                }
              />
            </label>

            <label className="request-field guided-form-wide">
              <span>
                Preferred / proposed supplier
              </span>

              <select
                value={supplierId}
                onChange={
                  event => {
                    setSupplierId(
                      event.target.value,
                    );

                    setRecommendation(
                      null,
                    );
                  }
                }
              >
                <option value="">
                  No supplier selected
                </option>

                {preferredForCategory.map(
                  preferred => (
                    <option
                      key={
                        preferred.id
                      }
                      value={
                        preferred.supplierId
                      }
                    >
                      #{preferred.preferenceRank}
                      {" · "}
                      {preferred.supplierName}
                      {" · Risk "}
                      {preferred.supplierRiskLevel ??
                        "—"}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field guided-form-wide">
              <span>
                Notes
              </span>

              <textarea
                rows={3}
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

          <div className="guided-form-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={
                recommending
                ||
                !title.trim()
                ||
                !departmentId
                ||
                !category.trim()
              }
              onClick={
                () =>
                  void previewRecommendation()
              }
            >
              <Sparkles
                size={16}
              />

              {recommending
                ? "Calculating..."
                : "Preview route"}
            </button>

            <button
              type="submit"
              className="button button--primary"
              disabled={
                saving
                ||
                !title.trim()
                ||
                !departmentId
                ||
                !category.trim()
              }
            >
              <Compass
                size={16}
              />

              {saving
                ? "Creating..."
                : "Create intake"}
            </button>
          </div>
        </section>

        <aside className="guided-intake-side">
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Preferred supply
                </span>

                <h2>
                  Suggested suppliers
                </h2>
              </div>

              <Star
                size={19}
              />
            </div>

            {preferredForCategory.length ===
            0 ? (
              <div className="guided-empty">
                No active preferred
                supplier is mapped to
                this category.
              </div>
            ) : (
              <div className="guided-recommend-suppliers">
                {preferredForCategory
                  .slice(
                    0,
                    5,
                  )
                  .map(
                    preferred => (
                      <article
                        key={preferred.id}
                      >
                        <span>
                          #{preferred.preferenceRank}
                        </span>

                        <div>
                          <strong>
                            {preferred.supplierName}
                          </strong>

                          <small>
                            Rating
                            {" "}
                            {preferred.supplierRating.toFixed(1)}
                            {" · Risk "}
                            {preferred.supplierRiskLevel ??
                              "—"}
                          </small>
                        </div>
                      </article>
                    ),
                  )}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Policy guidance
                </span>

                <h2>
                  Recommended route
                </h2>
              </div>

              <Route
                size={19}
              />
            </div>

            {!recommendation ? (
              <div className="guided-empty">
                Preview the buying route
                to evaluate active policy
                controls before creating
                the intake.
              </div>
            ) : (
              <div className="guided-recommendation">
                <span
                  className={
                    `guided-route guided-route--${recommendation.route.toLowerCase().replaceAll("_", "-")}`
                  }
                >
                  {readable(
                    recommendation.route,
                  )}
                </span>

                <p>
                  {recommendation.summary}
                </p>

                <ul>
                  {recommendation.signals.map(
                    signal => (
                      <li
                        key={signal}
                      >
                        {signal}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </form>
    </div>
  );
}
