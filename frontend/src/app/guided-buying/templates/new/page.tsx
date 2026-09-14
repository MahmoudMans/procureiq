"use client";

import {
  ArrowLeft,
  CircleAlert,
  FileStack,
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
  createGuidedBuyingTemplate,
  getGuidedBuyingContext,
} from "@/lib/api";

import type {
  GuidedBuyingContext,
} from "@/types/guided-buying";

export default function NewGuidedBuyingTemplatePage() {
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
    name,
    setName,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState("");

  const [
    defaultTitle,
    setDefaultTitle,
  ] =
    useState("");

  const [
    defaultCurrency,
    setDefaultCurrency,
  ] =
    useState("EUR");

  const [
    defaultEstimatedAmount,
    setDefaultEstimatedAmount,
  ] =
    useState(1000);

  const [
    defaultDepartmentId,
    setDefaultDepartmentId,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
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
            response.categories.length >
            0
          ) {
            setCategory(
              response.categories[0],
            );
          }

          if (
            response.departments.length >
            0
          ) {
            setDefaultDepartmentId(
              response.departments[0].id,
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
              : "Unable to load guided-buying configuration.",
          );
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

      await createGuidedBuyingTemplate({
        name:
          name.trim(),
        description:
          description.trim()
          ||
          undefined,
        category:
          category.trim(),
        defaultTitle:
          defaultTitle.trim()
          ||
          undefined,
        defaultCurrency:
          defaultCurrency
            .trim()
            .toUpperCase(),
        defaultEstimatedAmount,
        defaultDepartmentId:
          defaultDepartmentId
          ||
          undefined,
        ownerUserId:
          ownerUserId
          ||
          undefined,
      });

      router.push(
        "/guided-buying",
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create guided-buying template.",
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
            Reusable intake
          </span>

          <h1>
            New buying template
          </h1>

          <p>
            Create a reusable intake
            starting point for recurring
            procurement categories and
            business needs.
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
        className="panel"
        onSubmit={handleSubmit}
      >
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Template configuration
            </span>

            <h2>
              Default buying context
            </h2>
          </div>

          <FileStack
            size={19}
          />
        </div>

        <div className="guided-form-grid">
          <label className="request-field guided-form-wide">
            <span>
              Template name
            </span>

            <input
              required
              maxLength={220}
              value={name}
              onChange={
                event =>
                  setName(
                    event.target.value,
                  )
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
              Category
            </span>

            <input
              required
              list="template-category-options"
              maxLength={120}
              value={category}
              onChange={
                event =>
                  setCategory(
                    event.target.value,
                  )
              }
            />

            <datalist id="template-category-options">
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
              Default currency
            </span>

            <input
              required
              minLength={3}
              maxLength={3}
              value={defaultCurrency}
              onChange={
                event =>
                  setDefaultCurrency(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field guided-form-wide">
            <span>
              Default request title
            </span>

            <input
              maxLength={220}
              value={defaultTitle}
              onChange={
                event =>
                  setDefaultTitle(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Default estimate
            </span>

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                defaultEstimatedAmount
              }
              onChange={
                event =>
                  setDefaultEstimatedAmount(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Default department
            </span>

            <select
              value={
                defaultDepartmentId
              }
              onChange={
                event =>
                  setDefaultDepartmentId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                No default department
              </option>

              {context
                ?.departments
                .map(
                  department => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {department.name}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="request-field guided-form-wide">
            <span>
              Template owner
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
              {context
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
        </div>

        <div className="guided-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !name.trim()
              ||
              !category.trim()
            }
          >
            <FileStack
              size={16}
            />

            {saving
              ? "Creating..."
              : "Create template"}
          </button>
        </div>
      </form>
    </div>
  );
}
