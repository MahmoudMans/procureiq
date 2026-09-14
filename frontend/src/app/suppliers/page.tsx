"use client";

import Link from "next/link";

import {
  Building2,
  CircleAlert,
  Filter,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createSupplier,
  getSuppliers,
} from "@/lib/api";

import type {
  CreateSupplierInput,
  Supplier,
  SupplierRiskLevel,
  SupplierStatus,
} from "@/types/supplier";

const currencyFormatter =
  new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  );

const initialForm:
CreateSupplierInput = {
  supplierCode: "",
  legalName: "",
  tradingName: "",
  contactEmail: "",
  phone: "",
  website: "",
  country: "",
  city: "",
  category: "",
  status: "ACTIVE",
  riskLevel: "LOW",
};

export default function SuppliersPage() {

  const {
    user,
  } = useAuth();

  const canManageSuppliers =
    user !== null &&
    [
      "ADMIN",
      "PROCUREMENT_MANAGER",
      "BUYER",
    ].includes(user.role);

  const [
    suppliers,
    setSuppliers,
  ] =
    useState<Supplier[]>([]);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    status,
    setStatus,
  ] =
    useState("");

  const [
    riskLevel,
    setRiskLevel,
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
    useState<string | null>(
      null,
    );

  const [
    dialogOpen,
    setDialogOpen,
  ] =
    useState(false);

  const [
    refreshKey,
    setRefreshKey,
  ] =
    useState(0);

  useEffect(() => {

    let mounted = true;

    const timeout =
      window.setTimeout(
        async () => {

          try {

            setLoading(true);
            setError(null);

            const response =
              await getSuppliers({
                query:
                  query ||
                  undefined,

                status:
                  (
                    status as
                      SupplierStatus
                  ) ||
                  undefined,

                riskLevel:
                  (
                    riskLevel as
                      SupplierRiskLevel
                  ) ||
                  undefined,
              });

            if (mounted) {
              setSuppliers(
                response,
              );
            }

          } catch (caughtError) {

            if (mounted) {
              setError(
                caughtError instanceof
                Error
                  ? caughtError.message
                  : "Unable to load suppliers.",
              );
            }

          } finally {

            if (mounted) {
              setLoading(false);
            }
          }

        },
        220,
      );

    return () => {
      mounted = false;
      window.clearTimeout(
        timeout,
      );
    };

  }, [
    query,
    status,
    riskLevel,
    refreshKey,
  ]);

  return (
    <div className="page-stack">

      <section className="page-heading">

        <div>
          <span className="eyebrow">
            Supplier intelligence
          </span>

          <h1>
            Supplier portfolio
          </h1>

          <p>
            Centralize supplier records,
            qualification, risk and
            operational performance.
          </p>
        </div>

        {canManageSuppliers ? (
          <button
            className={
              "button button--primary"
            }
            onClick={
              () =>
                setDialogOpen(true)
            }
          >
            <Plus size={17} />
            Add supplier
          </button>
        ) : null}

      </section>

      <section className="supplier-toolbar">

        <div
          className={
            "supplier-toolbar__search"
          }
        >
          <Search size={18} />

          <input
            value={query}
            onChange={
              (event) =>
                setQuery(
                  event.target.value,
                )
            }
            placeholder={
              "Search supplier, code, category or country"
            }
          />

        </div>

        <div className="select-wrapper">

          <Filter size={16} />

          <select
            value={status}
            onChange={
              (event) =>
                setStatus(
                  event.target.value,
                )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="ONBOARDING">
              Onboarding
            </option>

            <option value="SUSPENDED">
              Suspended
            </option>
          </select>

        </div>

        <div className="select-wrapper">

          <select
            value={riskLevel}
            onChange={
              (event) =>
                setRiskLevel(
                  event.target.value,
                )
            }
          >
            <option value="">
              All risk levels
            </option>

            <option value="LOW">
              Low risk
            </option>

            <option value="MEDIUM">
              Medium risk
            </option>

            <option value="HIGH">
              High risk
            </option>

            <option value="CRITICAL">
              Critical risk
            </option>
          </select>

        </div>

      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />
          {error}
        </div>
      ) : null}

      <section
        className={
          "panel supplier-panel"
        }
      >

        <div
          className={
            "supplier-panel__summary"
          }
        >

          <div>
            <Building2 size={18} />

            <span>
              {loading
                ? "Loading supplier portfolio..."
                : `${
                    suppliers.length
                  } suppliers found`}
            </span>
          </div>

          <span>
            Supplier master data · ProcureIQ
          </span>

        </div>

        <div className="table-scroll">

          <table
            className={
              "data-table suppliers-table"
            }
          >

            <thead>
              <tr>
                <th>Supplier</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Rating</th>
                <th>Delivery</th>
                <th>Spend</th>
              </tr>
            </thead>

            <tbody>

              {!loading &&
                suppliers.map(
                  (supplier) => (
                    <tr
                      key={supplier.id}
                    >

                      <td>

                        <div
                          className={
                            "supplier-cell"
                          }
                        >

                          <div
                            className={
                              "company-avatar"
                            }
                          >
                            {
                              supplier.legalName
                                .split(" ")
                                .slice(0, 2)
                                .map(
                                  (word) =>
                                    word[0],
                                )
                                .join("")
                            }
                          </div>

                          <div>

                            <strong>
                              <Link
                            href={
                              `/suppliers/${supplier.id}`
                            }
                            className={
                              "supplier-360-link"
                            }
                          >
                            {
                              supplier
                                .legalName
                            }
                          </Link>
                            </strong>

                            <span>
                              {
                                supplier
                                  .supplierCode
                              }
                            </span>

                          </div>

                        </div>

                      </td>

                      <td>
                        {
                          supplier.category
                        }
                      </td>

                      <td>

                        <div
                          className={
                            "stacked-cell"
                          }
                        >

                          <strong>
                            {
                              supplier.country
                            }
                          </strong>

                          <span>
                            {
                              supplier.city ??
                              "—"
                            }
                          </span>

                        </div>

                      </td>

                      <td>

                        <span
                          className={
                            `badge badge--status-${
                              supplier.status
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            supplier.status
                              .replaceAll(
                                "_",
                                " ",
                              )
                          }
                        </span>

                      </td>

                      <td>

                        <span
                          className={
                            `badge badge--${
                              supplier.riskLevel
                                .toLowerCase()
                            }`
                          }
                        >
                          {
                            supplier
                              .riskLevel
                          }
                        </span>

                      </td>

                      <td>

                        <div
                          className={
                            "rating-cell"
                          }
                        >

                          <Star
                            size={15}
                            fill={
                              "currentColor"
                            }
                          />

                          {
                            supplier.rating
                              ?.toFixed(2) ??
                            "—"
                          }

                        </div>

                      </td>

                      <td>
                        {
                          supplier
                            .onTimeDeliveryRate
                            ? `${
                                supplier
                                  .onTimeDeliveryRate
                                  .toFixed(1)
                              }%`
                            : "—"
                        }
                      </td>

                      <td>
                        {
                          currencyFormatter
                            .format(
                              supplier.totalSpend,
                            )
                        }
                      </td>

                    </tr>
                  ),
                )}

              {!loading &&
              suppliers.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={8}
                      className={
                        "table-empty-state"
                      }
                    >
                      No suppliers match
                      the current filters.
                    </td>
                  </tr>
                )
                : null}

            </tbody>

          </table>

        </div>

      </section>

      {dialogOpen ? (
        <CreateSupplierDialog
          onClose={
            () =>
              setDialogOpen(false)
          }
          onCreated={
            () => {
              setDialogOpen(false);

              setRefreshKey(
                (value) =>
                  value + 1,
              );
            }
          }
        />
      ) : null}

    </div>
  );
}

interface CreateSupplierDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateSupplierDialog({
  onClose,
  onCreated,
}: CreateSupplierDialogProps) {

  const [
    form,
    setForm,
  ] =
    useState<CreateSupplierInput>(
      initialForm,
    );

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

  function updateField<
    K extends keyof CreateSupplierInput
  >(
    key: K,
    value: CreateSupplierInput[K],
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {

    event.preventDefault();

    try {

      setSaving(true);
      setError(null);

      await createSupplier({
        ...form,

        supplierCode:
          form.supplierCode.trim(),

        legalName:
          form.legalName.trim(),

        country:
          form.country.trim(),

        category:
          form.category.trim(),

        tradingName:
          form.tradingName
            ?.trim() ||
          undefined,

        contactEmail:
          form.contactEmail
            ?.trim() ||
          undefined,

        phone:
          form.phone
            ?.trim() ||
          undefined,

        website:
          form.website
            ?.trim() ||
          undefined,

        city:
          form.city
            ?.trim() ||
          undefined,
      });

      onCreated();

    } catch (caughtError) {

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create supplier.",
      );

    } finally {

      setSaving(false);
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={
        (event) => {
          if (
            event.currentTarget ===
            event.target
          ) {
            onClose();
          }
        }
      }
    >

      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          "create-supplier-title"
        }
      >

        <div className="dialog__header">

          <div>

            <span className="eyebrow">
              Supplier master data
            </span>

            <h2 id="create-supplier-title">
              Add supplier
            </h2>

            <p>
              Create a new supplier
              record for ProcureIQ.
            </p>

          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>

        </div>

        <form
          className="supplier-form"
          onSubmit={handleSubmit}
        >

          <div className="form-grid">

            <label>
              <span>
                Supplier code
              </span>

              <input
                required
                maxLength={20}
                placeholder="SUP-0013"
                value={
                  form.supplierCode
                }
                onChange={
                  (event) =>
                    updateField(
                      "supplierCode",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Legal name
              </span>

              <input
                required
                maxLength={160}
                placeholder={
                  "Company legal name"
                }
                value={
                  form.legalName
                }
                onChange={
                  (event) =>
                    updateField(
                      "legalName",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Trading name
              </span>

              <input
                maxLength={160}
                placeholder="Optional"
                value={
                  form.tradingName
                }
                onChange={
                  (event) =>
                    updateField(
                      "tradingName",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Category
              </span>

              <input
                required
                maxLength={120}
                placeholder={
                  "IT & Technology"
                }
                value={
                  form.category
                }
                onChange={
                  (event) =>
                    updateField(
                      "category",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Country
              </span>

              <input
                required
                maxLength={100}
                placeholder="France"
                value={
                  form.country
                }
                onChange={
                  (event) =>
                    updateField(
                      "country",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                City
              </span>

              <input
                maxLength={100}
                placeholder="Paris"
                value={
                  form.city
                }
                onChange={
                  (event) =>
                    updateField(
                      "city",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Contact email
              </span>

              <input
                type="email"
                maxLength={200}
                placeholder={
                  "procurement@company.com"
                }
                value={
                  form.contactEmail
                }
                onChange={
                  (event) =>
                    updateField(
                      "contactEmail",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Phone
              </span>

              <input
                maxLength={50}
                placeholder="+33..."
                value={
                  form.phone
                }
                onChange={
                  (event) =>
                    updateField(
                      "phone",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Website
              </span>

              <input
                maxLength={300}
                placeholder="https://..."
                value={
                  form.website
                }
                onChange={
                  (event) =>
                    updateField(
                      "website",
                      event.target.value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Initial risk
              </span>

              <select
                value={
                  form.riskLevel
                }
                onChange={
                  (event) =>
                    updateField(
                      "riskLevel",
                      event.target
                        .value as SupplierRiskLevel,
                    )
                }
              >
                <option value="LOW">
                  Low
                </option>

                <option value="MEDIUM">
                  Medium
                </option>

                <option value="HIGH">
                  High
                </option>

                <option value="CRITICAL">
                  Critical
                </option>
              </select>

            </label>

          </div>

          {error ? (
            <div className="error-banner">
              <CircleAlert size={18} />
              {error}
            </div>
          ) : null}

          <div className="dialog__footer">

            <button
              type="button"
              className={
                "button button--secondary"
              }
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={
                "button button--primary"
              }
              disabled={saving}
            >
              {saving
                ? "Creating supplier..."
                : "Create supplier"}
            </button>

          </div>

        </form>

      </section>

    </div>
  );
}
