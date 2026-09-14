"use client";

import {
  ArrowLeft,
  CircleAlert,
  FileCheck2,
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
  createContract,
  getContractSupplierOptions,
} from "@/lib/api";

import type {
  ContractSupplierOption,
} from "@/types/contract";

function futureDate(
  years: number,
): string {
  const date =
    new Date();

  date.setFullYear(
    date.getFullYear()
      + years,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function NewContractPage() {
  const router =
    useRouter();

  const [
    suppliers,
    setSuppliers,
  ] =
    useState<
      ContractSupplierOption[]
    >([]);

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    contractType,
    setContractType,
  ] =
    useState(
      "Master Service Agreement",
    );

  const [
    startDate,
    setStartDate,
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
    endDate,
    setEndDate,
  ] =
    useState(
      futureDate(1),
    );

  const [
    currency,
    setCurrency,
  ] =
    useState("EUR");

  const [
    contractValue,
    setContractValue,
  ] =
    useState(0);

  const [
    autoRenew,
    setAutoRenew,
  ] =
    useState(false);

  const [
    noticePeriodDays,
    setNoticePeriodDays,
  ] =
    useState(30);

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

    getContractSupplierOptions()
      .then(
        response => {
          if (!active) {
            return;
          }

          setSuppliers(
            response,
          );

          if (
            response.length >
            0
          ) {
            setSupplierId(
              response[0].id,
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
              ? caughtError
                  .message
              : "Unable to load suppliers.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(
              false,
            );
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

      const created =
        await createContract({
          supplierId,
          title:
            title.trim(),
          contractType:
            contractType.trim(),
          startDate,
          endDate,
          currency:
            currency
              .trim()
              .toUpperCase(),
          contractValue,
          autoRenew,
          noticePeriodDays,
          notes:
            notes.trim() ||
            undefined,
        });

      router.push(
        `/contracts/${created.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create contract.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <Link
        href="/contracts"
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Contracts
      </Link>

      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Supplier governance
          </span>

          <h1>
            New supplier contract
          </h1>

          <p>
            Register the commercial
            term, ownership and renewal
            parameters for a supplier
            agreement.
          </p>
        </div>
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <form
        className={
          "panel"
        }
        onSubmit={
          handleSubmit
        }
      >
        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span
              className={
                "eyebrow"
              }
            >
              Contract setup
            </span>

            <h2>
              Agreement details
            </h2>
          </div>

          <FileCheck2
            size={19}
          />
        </div>

        <div
          className={
            "contract-form-grid"
          }
        >
          <label
            className={
              "request-field contract-form-wide"
            }
          >
            <span>Supplier</span>

            <select
              required
              disabled={loading}
              value={supplierId}
              onChange={
                event =>
                  setSupplierId(
                    event.target.value,
                  )
              }
            >
              {suppliers.map(
                supplier => (
                  <option
                    key={
                      supplier.id
                    }
                    value={
                      supplier.id
                    }
                  >
                    {
                      supplier
                        .supplierCode
                    }
                    {" — "}
                    {
                      supplier
                        .legalName
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label
            className={
              "request-field contract-form-wide"
            }
          >
            <span>
              Contract title
            </span>

            <input
              required
              maxLength={200}
              value={title}
              placeholder={
                "Enterprise IT services agreement"
              }
              onChange={
                event =>
                  setTitle(
                    event.target.value,
                  )
              }
            />
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Contract type
            </span>

            <input
              required
              maxLength={100}
              value={
                contractType
              }
              onChange={
                event =>
                  setContractType(
                    event.target.value,
                  )
              }
            />
          </label>

          <label
            className={
              "request-field"
            }
          >
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

          <label
            className={
              "request-field"
            }
          >
            <span>
              Start date
            </span>

            <input
              required
              type="date"
              value={startDate}
              onChange={
                event =>
                  setStartDate(
                    event.target.value,
                  )
              }
            />
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>
              End date
            </span>

            <input
              required
              type="date"
              value={endDate}
              onChange={
                event =>
                  setEndDate(
                    event.target.value,
                  )
              }
            />
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Contract value
            </span>

            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={
                contractValue
              }
              onChange={
                event =>
                  setContractValue(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Notice period
              (days)
            </span>

            <input
              required
              type="number"
              min="0"
              step="1"
              value={
                noticePeriodDays
              }
              onChange={
                event =>
                  setNoticePeriodDays(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label
            className={
              "contract-checkbox"
            }
          >
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={
                event =>
                  setAutoRenew(
                    event.target.checked,
                  )
              }
            />

            <span>
              Auto-renewal enabled
            </span>
          </label>

          <label
            className={
              "request-field contract-form-wide"
            }
          >
            <span>Notes</span>

            <textarea
              rows={5}
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

        <div
          className={
            "contract-form-actions"
          }
        >
          <button
            type="submit"
            className={
              "button button--primary"
            }
            disabled={
              saving ||
              loading ||
              !supplierId
            }
          >
            <FileCheck2
              size={16}
            />

            {saving
              ? "Creating..."
              : "Create contract draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
