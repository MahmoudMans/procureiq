"use client";

import {
  Building2,
  CircleAlert,
  Download,
  Plus,
  RefreshCw,
  SearchX,
  Star,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  Field,
  type FilterChip,
  FilterChips,
  Modal,
  SearchField,
  SelectField,
  type SelectOption,
  type StatItem,
  StatStrip,
  StatusBadge,
  downloadCsv,
  formatMoney,
  initialsOf,
  readable,
  useConfirm,
  useToast,
} from "@/components/kit";
import { createSupplier, getSuppliers } from "@/lib/api";
import type {
  CreateSupplierInput,
  Supplier,
  SupplierRiskLevel,
  SupplierStatus,
} from "@/types/supplier";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const MANAGER_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "SUSPENDED", label: "Suspended" },
];

const RISK_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const RISK_RANK: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const INITIAL_FORM: CreateSupplierInput = {
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

const EMPTY_SUPPLIERS: Supplier[] = [];
const integer = new Intl.NumberFormat("en-US");

/* ------------------------------------------------------------------ */
/* Table columns                                                       */
/* ------------------------------------------------------------------ */

const COLUMNS: Column<Supplier>[] = [
  {
    id: "supplier",
    header: "Supplier",
    sortValue: (supplier) => supplier.legalName.toLowerCase(),
    cell: (supplier) => (
      <div className="supplier-cell">
        <div className="company-avatar">{initialsOf(supplier.legalName)}</div>

        <div>
          <strong>
            <Link
              href={`/suppliers/${supplier.id}`}
              className="supplier-360-link"
            >
              {supplier.legalName}
            </Link>
          </strong>

          <span>{supplier.supplierCode}</span>
        </div>
      </div>
    ),
  },
  {
    id: "category",
    header: "Category",
    sortValue: (supplier) => supplier.category.toLowerCase(),
    cell: (supplier) => supplier.category,
  },
  {
    id: "location",
    header: "Location",
    sortValue: (supplier) => supplier.country.toLowerCase(),
    cell: (supplier) => (
      <div className="stacked-cell">
        <strong>{supplier.country}</strong>
        <span>{supplier.city ?? "—"}</span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (supplier) => supplier.status,
    cell: (supplier) => <StatusBadge value={supplier.status} />,
  },
  {
    id: "risk",
    header: "Risk",
    sortValue: (supplier) => RISK_RANK[supplier.riskLevel] ?? -1,
    firstSort: "desc",
    cell: (supplier) => <StatusBadge value={supplier.riskLevel} />,
  },
  {
    id: "rating",
    header: "Rating",
    sortValue: (supplier) => supplier.rating,
    firstSort: "desc",
    cell: (supplier) =>
      supplier.rating == null ? (
        "—"
      ) : (
        <div className="rating-cell">
          <Star size={14} fill="currentColor" aria-hidden="true" />
          {supplier.rating.toFixed(2)}
        </div>
      ),
  },
  {
    id: "delivery",
    header: "Delivery",
    align: "right",
    sortValue: (supplier) => supplier.onTimeDeliveryRate,
    firstSort: "desc",
    cell: (supplier) => (
      <span className="kit-num">
        {supplier.onTimeDeliveryRate
          ? `${supplier.onTimeDeliveryRate.toFixed(1)}%`
          : "—"}
      </span>
    ),
  },
  {
    id: "spend",
    header: "Spend",
    align: "right",
    sortValue: (supplier) => supplier.totalSpend,
    firstSort: "desc",
    cell: (supplier) => (
      <strong className="kit-num">{formatMoney(supplier.totalSpend)}</strong>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SuppliersPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGER_ROLES.includes(user.role);

  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getSuppliers({
          query: query.trim() || undefined,
          status: (status as SupplierStatus) || undefined,
          riskLevel: (riskLevel as SupplierRiskLevel) || undefined,
        });

        if (active) {
          setSuppliers(response);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load suppliers.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, status, riskLevel, reloadKey]);

  const items = suppliers ?? EMPTY_SUPPLIERS;
  const initialLoad = suppliers === null && error === null;

  const activeCount = items.filter((supplier) => supplier.status === "ACTIVE").length;
  const onboardingCount = items.filter(
    (supplier) => supplier.status === "ONBOARDING",
  ).length;
  const highRiskCount = items.filter(
    (supplier) => supplier.riskLevel === "HIGH" || supplier.riskLevel === "CRITICAL",
  ).length;
  const totalSpend = items.reduce((sum, supplier) => sum + supplier.totalSpend, 0);

  const stats: StatItem[] = [
    { label: "Suppliers", value: integer.format(items.length) },
    { label: "Active", value: integer.format(activeCount) },
    { label: "Onboarding", value: integer.format(onboardingCount) },
    {
      label: "High / critical risk",
      value: integer.format(highRiskCount),
      tone: highRiskCount > 0 ? "danger" : "default",
      hint: highRiskCount > 0 ? "Review recommended" : undefined,
    },
    { label: "Total spend", value: formatMoney(totalSpend, "EUR", true) },
  ];

  const chips: FilterChip[] = [];

  if (query.trim()) {
    chips.push({
      key: "query",
      label: `Search: “${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  if (status) {
    chips.push({
      key: "status",
      label: `Status: ${readable(status)}`,
      onRemove: () => setStatus(""),
    });
  }

  if (riskLevel) {
    chips.push({
      key: "risk",
      label: `Risk: ${readable(riskLevel)}`,
      onRemove: () => setRiskLevel(""),
    });
  }

  function clearFilters() {
    setQuery("");
    setStatus("");
    setRiskLevel("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-suppliers-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Supplier code",
        "Legal name",
        "Category",
        "Country",
        "City",
        "Status",
        "Risk level",
        "Rating",
        "On-time delivery %",
        "Total spend (EUR)",
      ],
      items.map((supplier) => [
        supplier.supplierCode,
        supplier.legalName,
        supplier.category,
        supplier.country,
        supplier.city,
        supplier.status,
        supplier.riskLevel,
        supplier.rating,
        supplier.onTimeDeliveryRate,
        supplier.totalSpend,
      ]),
    );

    toast.success(
      "Suppliers exported",
      `${items.length} ${items.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const emptyNode =
    chips.length > 0 ? (
      <EmptyState
        icon={SearchX}
        title="No suppliers match these filters"
        description="Try a different search term, or clear the filters to see the whole portfolio."
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        }
      />
    ) : (
      <EmptyState
        icon={Building2}
        title="No suppliers yet"
        description="Add your first supplier to start tracking spend, risk and delivery performance."
        action={
          canManage ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => setDialogOpen(true)}
            >
              <Plus size={16} />
              Add supplier
            </button>
          ) : undefined
        }
      />
    );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Supplier intelligence</span>

          <h1>Supplier portfolio</h1>

          <p>
            Centralize supplier records, qualification, risk and operational
            performance.
          </p>
        </div>

        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={items.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>

          {canManage ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => setDialogOpen(true)}
            >
              <Plus size={17} />
              Add supplier
            </button>
          ) : null}
        </div>
      </section>

      <StatStrip items={stats} loading={initialLoad} />

      <div className="kit-filters">
        <div className="kit-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search supplier, code, category or country"
            ariaLabel="Search suppliers"
            shortcut
          />

          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />

          <SelectField
            label="Risk"
            value={riskLevel}
            onChange={setRiskLevel}
            options={RISK_OPTIONS}
          />
        </div>

        <FilterChips chips={chips} onClearAll={clearFilters} />
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      <DataTable
        columns={COLUMNS}
        rows={items}
        getRowId={(supplier) => supplier.id}
        ariaLabel="Suppliers"
        loading={initialLoad}
        busy={fetching}
        empty={emptyNode}
        defaultSort={{ id: "spend", dir: "desc" }}
        persistKey="suppliers"
        resetKey={`${query}|${status}|${riskLevel}`}
      />

      {dialogOpen ? (
        <CreateSupplierModal
          onClose={() => setDialogOpen(false)}
          onCreated={(name) => {
            setDialogOpen(false);
            setReloadKey((key) => key + 1);
            toast.success("Supplier created", `${name} was added to the portfolio.`);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create supplier dialog                                              */
/* ------------------------------------------------------------------ */

type TextKey =
  | "supplierCode"
  | "legalName"
  | "tradingName"
  | "category"
  | "country"
  | "city"
  | "contactEmail"
  | "phone"
  | "website";

type FormErrors = Partial<Record<keyof CreateSupplierInput, string>>;

function validate(form: CreateSupplierInput): FormErrors {
  const errors: FormErrors = {};

  if (!form.supplierCode.trim()) {
    errors.supplierCode = "Supplier code is required.";
  }

  if (!form.legalName.trim()) {
    errors.legalName = "Legal name is required.";
  }

  if (!form.category.trim()) {
    errors.category = "Category is required.";
  }

  if (!form.country.trim()) {
    errors.country = "Country is required.";
  }

  const email = (form.contactEmail ?? "").trim();

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = "Enter a valid email address.";
  }

  const website = (form.website ?? "").trim();

  if (website) {
    try {
      const url = new URL(website);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("protocol");
      }
    } catch {
      errors.website = "Enter a full URL, for example https://example.com.";
    }
  }

  return errors;
}

interface CreateSupplierModalProps {
  onClose: () => void;
  onCreated: (name: string) => void;
}

function CreateSupplierModal({ onClose, onCreated }: CreateSupplierModalProps) {
  const confirm = useConfirm();

  const [form, setForm] = useState<CreateSupplierInput>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(INITIAL_FORM);

  function updateField<K extends keyof CreateSupplierInput>(
    key: K,
    value: CreateSupplierInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }

  async function requestClose() {
    if (saving) {
      return;
    }

    if (dirty) {
      const discard = await confirm({
        title: "Discard this supplier?",
        description: "The details you entered haven't been saved yet.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "danger",
      });

      if (!discard) {
        return;
      }
    }

    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const found = validate(form);

    setErrors(found);

    const firstInvalid = Object.keys(found)[0];

    if (firstInvalid) {
      document.getElementById(`supplier-${firstInvalid}`)?.focus();
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      await createSupplier({
        ...form,
        supplierCode: form.supplierCode.trim(),
        legalName: form.legalName.trim(),
        country: form.country.trim(),
        category: form.category.trim(),
        tradingName: form.tradingName?.trim() || undefined,
        contactEmail: form.contactEmail?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        website: form.website?.trim() || undefined,
        city: form.city?.trim() || undefined,
      });

      onCreated(form.legalName.trim());
    } catch (caught) {
      setSubmitError(
        caught instanceof Error ? caught.message : "Unable to create the supplier.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderText(
    key: TextKey,
    label: string,
    extra: {
      placeholder?: string;
      required?: boolean;
      maxLength?: number;
      type?: "text" | "email" | "url" | "tel";
      wide?: boolean;
    } = {},
  ) {
    const id = `supplier-${key}`;
    const error = errors[key];

    return (
      <Field
        label={label}
        htmlFor={id}
        required={extra.required}
        error={error}
        wide={extra.wide}
      >
        <input
          id={id}
          className="kit-input"
          type={extra.type ?? "text"}
          maxLength={extra.maxLength}
          placeholder={extra.placeholder}
          autoComplete="off"
          value={form[key] ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => updateField(key, event.target.value)}
        />
      </Field>
    );
  }

  return (
    <Modal
      eyebrow="Supplier master data"
      title="Add supplier"
      description="Create a new supplier record for ProcureIQ."
      size="md"
      dismissible={!saving}
      onClose={() => void requestClose()}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void requestClose()}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="create-supplier-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Creating supplier…" : "Create supplier"}
          </button>
        </>
      }
    >
      <form id="create-supplier-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-form-grid">
          {renderText("supplierCode", "Supplier code", {
            placeholder: "SUP-0013",
            required: true,
            maxLength: 20,
          })}

          {renderText("legalName", "Legal name", {
            placeholder: "Company legal name",
            required: true,
            maxLength: 160,
          })}

          {renderText("tradingName", "Trading name", {
            placeholder: "Optional",
            maxLength: 160,
          })}

          {renderText("category", "Category", {
            placeholder: "IT & Technology",
            required: true,
            maxLength: 120,
          })}

          {renderText("country", "Country", {
            placeholder: "France",
            required: true,
            maxLength: 100,
          })}

          {renderText("city", "City", { placeholder: "Paris", maxLength: 100 })}

          {renderText("contactEmail", "Contact email", {
            placeholder: "procurement@company.com",
            type: "email",
            maxLength: 200,
          })}

          {renderText("phone", "Phone", {
            placeholder: "+33…",
            type: "tel",
            maxLength: 50,
          })}

          {renderText("website", "Website", {
            placeholder: "https://…",
            type: "url",
            maxLength: 300,
            wide: true,
          })}

          <Field label="Status" htmlFor="supplier-status">
            <select
              id="supplier-status"
              className="kit-input"
              value={form.status}
              onChange={(event) =>
                updateField("status", event.target.value as SupplierStatus)
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="ONBOARDING">Onboarding</option>
            </select>
          </Field>

          <Field label="Initial risk" htmlFor="supplier-riskLevel">
            <select
              id="supplier-riskLevel"
              className="kit-input"
              value={form.riskLevel}
              onChange={(event) =>
                updateField("riskLevel", event.target.value as SupplierRiskLevel)
              }
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </Field>
        </div>

        {submitError ? (
          <div className="error-banner" style={{ marginTop: 16 }}>
            <CircleAlert size={18} />
            <span>{submitError}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
