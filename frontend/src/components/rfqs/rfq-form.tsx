"use client";

import {
  Building2,
  CircleCheck,
} from "lucide-react";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";

import type {
  RfqUpdateInput,
} from "@/types/rfq";

import type {
  Supplier,
} from "@/types/supplier";

interface RfqFormProps {
  suppliers: Supplier[];
  initialValue: RfqUpdateInput;
  submitting: boolean;
  submitLabel: string;
  error?: string | null;
  onSubmit: (
    value: RfqUpdateInput,
  ) => Promise<void>;
}

export function RfqForm({
  suppliers,
  initialValue,
  submitting,
  submitLabel,
  error,
  onSubmit,
}: RfqFormProps) {
  const [
    value,
    setValue,
  ] =
    useState<RfqUpdateInput>(
      initialValue,
    );

  const selectedSuppliers =
    useMemo(
      () =>
        new Set(
          value.supplierIds,
        ),
      [value.supplierIds],
    );

  function toggleSupplier(
    supplierId: string,
  ) {
    setValue(
      current => {
        const selected =
          new Set(
            current.supplierIds,
          );

        if (
          selected.has(
            supplierId,
          )
        ) {
          selected.delete(
            supplierId,
          );
        } else {
          selected.add(
            supplierId,
          );
        }

        return {
          ...current,
          supplierIds:
            Array.from(
              selected,
            ),
        };
      },
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await onSubmit({
      ...value,
      title:
        value.title.trim(),
      description:
        value.description
          ?.trim() ||
        undefined,
    });
  }

  return (
    <form
      className={
        "rfq-form"
      }
      onSubmit={
        handleSubmit
      }
    >
      <section
        className={
          "panel rfq-form-section"
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
              Sourcing event
            </span>

            <h2>
              RFQ configuration
            </h2>
          </div>
        </div>

        <div
          className={
            "rfq-form-grid"
          }
        >
          <label
            className={
              "request-field rfq-field-wide"
            }
          >
            <span>
              RFQ title
            </span>

            <input
              required
              maxLength={200}
              value={
                value.title
              }
              placeholder={
                "Example: Q4 laptop sourcing event"
              }
              onChange={
                event =>
                  setValue(
                    current => ({
                      ...current,
                      title:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            />
          </label>

          <label
            className={
              "request-field rfq-field-wide"
            }
          >
            <span>
              Sourcing instructions
            </span>

            <textarea
              rows={5}
              maxLength={3000}
              value={
                value.description ??
                ""
              }
              placeholder={
                "Describe commercial requirements, delivery expectations and relevant sourcing information."
              }
              onChange={
                event =>
                  setValue(
                    current => ({
                      ...current,
                      description:
                        event
                          .target
                          .value,
                    }),
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
              Supplier response deadline
            </span>

            <input
              required
              type="datetime-local"
              value={
                value.responseDeadline
              }
              onChange={
                event =>
                  setValue(
                    current => ({
                      ...current,
                      responseDeadline:
                        event
                          .target
                          .value,
                    }),
                  )
              }
            />
          </label>
        </div>
      </section>

      <section
        className={
          "panel rfq-form-section"
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
              Supplier competition
            </span>

            <h2>
              Invite suppliers
            </h2>
          </div>

          <span
            className={
              "rfq-selected-count"
            }
          >
            {
              value
                .supplierIds
                .length
            }
            {" selected"}
          </span>
        </div>

        <div
          className={
            "rfq-supplier-grid"
          }
        >
          {suppliers.map(
            supplier => {
              const selected =
                selectedSuppliers
                  .has(
                    supplier.id,
                  );

              return (
                <button
                  key={
                    supplier.id
                  }
                  type="button"
                  className={
                    `rfq-supplier-option ${
                      selected
                        ? "rfq-supplier-option--selected"
                        : ""
                    }`
                  }
                  onClick={
                    () =>
                      toggleSupplier(
                        supplier.id,
                      )
                  }
                >
                  <div
                    className={
                      "rfq-supplier-option__icon"
                    }
                  >
                    <Building2
                      size={18}
                    />
                  </div>

                  <div
                    className={
                      "rfq-supplier-option__content"
                    }
                  >
                    <strong>
                      {
                        supplier
                          .legalName
                      }
                    </strong>

                    <span>
                      {
                        supplier
                          .supplierCode
                      }
                      {" · "}
                      {
                        supplier
                          .country
                      }
                    </span>

                    <small>
                      {
                        supplier
                          .category
                      }
                    </small>
                  </div>

                  {selected ? (
                    <CircleCheck
                      size={18}
                    />
                  ) : null}
                </button>
              );
            },
          )}
        </div>
      </section>

      <section
        className={
          "rfq-form-footer"
        }
      >
        <div>
          {error ? (
            <div
              className={
                "error-banner"
              }
            >
              {error}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          className={
            "button button--primary"
          }
          disabled={
            submitting ||
            value
              .supplierIds
              .length === 0
          }
        >
          {submitting
            ? "Saving..."
            : submitLabel}
        </button>
      </section>
    </form>
  );
}
