"use client";

import {
  CircleAlert,
  Plus,
  Trash2,
} from "lucide-react";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";

import type {
  PurchaseRequestInput,
  PurchaseRequestItemInput,
} from "@/types/purchase-request";

interface PurchaseRequestFormProps {
  initialValue: PurchaseRequestInput;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (
    value: PurchaseRequestInput,
  ) => Promise<void>;
}

const currencyFormatter =
  new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    },
  );

function emptyLine():
PurchaseRequestItemInput {
  return {
    itemName: "",
    description: "",
    category: "",
    quantity: 1,
    unit: "EA",
    estimatedUnitPrice: 0,
  };
}

export function PurchaseRequestForm({
  initialValue,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: PurchaseRequestFormProps) {
  const [
    form,
    setForm,
  ] =
    useState<PurchaseRequestInput>(
      initialValue,
    );

  const estimatedTotal =
    useMemo(
      () =>
        form.items.reduce(
          (
            total,
            item,
          ) =>
            total +
            (
              Number(
                item.quantity,
              ) || 0
            ) *
            (
              Number(
                item.estimatedUnitPrice,
              ) || 0
            ),
          0,
        ),
      [form.items],
    );

  function updateRoot<
    K extends keyof PurchaseRequestInput
  >(
    key: K,
    value: PurchaseRequestInput[K],
  ) {
    setForm(
      current => ({
        ...current,
        [key]: value,
      }),
    );
  }

  function updateItem<
    K extends keyof PurchaseRequestItemInput
  >(
    index: number,
    key: K,
    value:
      PurchaseRequestItemInput[K],
  ) {
    setForm(
      current => ({
        ...current,
        items:
          current.items.map(
            (
              item,
              itemIndex,
            ) =>
              itemIndex ===
              index
                ? {
                    ...item,
                    [key]:
                      value,
                  }
                : item,
          ),
      }),
    );
  }

  function addItem() {
    setForm(
      current => ({
        ...current,
        items: [
          ...current.items,
          emptyLine(),
        ],
      }),
    );
  }

  function removeItem(
    index: number,
  ) {
    setForm(
      current => ({
        ...current,
        items:
          current.items.length <= 1
            ? current.items
            : current.items.filter(
                (
                  _item,
                  itemIndex,
                ) =>
                  itemIndex !==
                  index,
              ),
      }),
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await onSubmit({
      ...form,
      title:
        form.title.trim(),
      description:
        form.description
          ?.trim() ||
        undefined,
      businessJustification:
        form.businessJustification
          .trim(),
      costCenter:
        form.costCenter
          .trim(),
      currency:
        form.currency
          .trim()
          .toUpperCase(),
      items:
        form.items.map(
          item => ({
            ...item,
            itemName:
              item.itemName
                .trim(),
            description:
              item.description
                ?.trim() ||
              undefined,
            category:
              item.category
                .trim(),
            unit:
              item.unit
                .trim()
                .toUpperCase(),
            quantity:
              Number(
                item.quantity,
              ),
            estimatedUnitPrice:
              Number(
                item.estimatedUnitPrice,
              ),
          }),
        ),
    });
  }

  return (
    <form
      className={
        "purchase-request-form"
      }
      onSubmit={
        handleSubmit
      }
    >
      <section
        className={
          "panel request-form-section"
        }
      >
        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span className="eyebrow">
              Request context
            </span>

            <h2>
              Business requirement
            </h2>
          </div>
        </div>

        <div
          className={
            "request-form-grid"
          }
        >
          <label
            className={
              "request-field request-field--wide"
            }
          >
            <span>
              Request title
            </span>

            <input
              required
              maxLength={200}
              placeholder={
                "Example: Replace operations laptops"
              }
              value={
                form.title
              }
              onChange={
                event =>
                  updateRoot(
                    "title",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          <label
            className={
              "request-field request-field--wide"
            }
          >
            <span>
              Description
            </span>

            <textarea
              maxLength={2000}
              rows={3}
              placeholder={
                "Describe what is being purchased."
              }
              value={
                form.description ??
                ""
              }
              onChange={
                event =>
                  updateRoot(
                    "description",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          <label
            className={
              "request-field request-field--wide"
            }
          >
            <span>
              Business justification
            </span>

            <textarea
              required
              maxLength={3000}
              rows={4}
              placeholder={
                "Explain why the purchase is required and the business impact."
              }
              value={
                form
                  .businessJustification
              }
              onChange={
                event =>
                  updateRoot(
                    "businessJustification",
                    event
                      .target
                      .value,
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
              Cost center
            </span>

            <input
              required
              maxLength={80}
              placeholder="OPS-240"
              value={
                form.costCenter
              }
              onChange={
                event =>
                  updateRoot(
                    "costCenter",
                    event
                      .target
                      .value,
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
              Currency
            </span>

            <select
              required
              value={
                form.currency
              }
              onChange={
                event =>
                  updateRoot(
                    "currency",
                    event
                      .target
                      .value,
                  )
              }
            >
              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>

              <option value="TND">
                TND
              </option>
            </select>
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Desired delivery date
            </span>

            <input
              required
              type="date"
              value={
                form
                  .desiredDeliveryDate
              }
              onChange={
                event =>
                  updateRoot(
                    "desiredDeliveryDate",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>
        </div>
      </section>

      <section
        className={
          "panel request-form-section"
        }
      >
        <div
          className={
            "panel__header request-lines-header"
          }
        >
          <div>
            <span className="eyebrow">
              Requested goods & services
            </span>

            <h2>
              Line items
            </h2>
          </div>

          <button
            type="button"
            className={
              "button button--secondary"
            }
            onClick={addItem}
          >
            <Plus size={16} />
            Add line
          </button>
        </div>

        <div
          className={
            "request-lines"
          }
        >
          {form.items.map(
            (
              item,
              index,
            ) => {
              const lineTotal =
                (
                  Number(
                    item.quantity,
                  ) || 0
                ) *
                (
                  Number(
                    item
                      .estimatedUnitPrice,
                  ) || 0
                );

              return (
                <article
                  className={
                    "request-line-card"
                  }
                  key={
                    `request-line-${index}`
                  }
                >
                  <div
                    className={
                      "request-line-card__top"
                    }
                  >
                    <div>
                      <span>
                        LINE
                        {" "}
                        {
                          String(
                            index + 1,
                          )
                            .padStart(
                              2,
                              "0",
                            )
                        }
                      </span>

                      <strong>
                        {
                          item.itemName ||
                          "New line item"
                        }
                      </strong>
                    </div>

                    <button
                      type="button"
                      className={
                        "request-line-remove"
                      }
                      disabled={
                        form.items
                          .length <= 1
                      }
                      onClick={
                        () =>
                          removeItem(
                            index,
                          )
                      }
                      aria-label={
                        `Remove line ${
                          index + 1
                        }`
                      }
                    >
                      <Trash2
                        size={16}
                      />
                    </button>
                  </div>

                  <div
                    className={
                      "request-line-grid"
                    }
                  >
                    <label
                      className={
                        "request-field request-field--wide"
                      }
                    >
                      <span>
                        Item or service
                      </span>

                      <input
                        required
                        maxLength={180}
                        value={
                          item.itemName
                        }
                        placeholder={
                          "Laptop computer"
                        }
                        onChange={
                          event =>
                            updateItem(
                              index,
                              "itemName",
                              event
                                .target
                                .value,
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
                        Category
                      </span>

                      <input
                        required
                        maxLength={120}
                        value={
                          item.category
                        }
                        placeholder={
                          "IT & Technology"
                        }
                        onChange={
                          event =>
                            updateItem(
                              index,
                              "category",
                              event
                                .target
                                .value,
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
                        Quantity
                      </span>

                      <input
                        required
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={
                          item.quantity
                        }
                        onChange={
                          event =>
                            updateItem(
                              index,
                              "quantity",
                              Number(
                                event
                                  .target
                                  .value,
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
                        Unit
                      </span>

                      <select
                        required
                        value={
                          item.unit
                        }
                        onChange={
                          event =>
                            updateItem(
                              index,
                              "unit",
                              event
                                .target
                                .value,
                            )
                        }
                      >
                        <option value="EA">
                          Each
                        </option>

                        <option value="BOX">
                          Box
                        </option>

                        <option value="PACK">
                          Pack
                        </option>

                        <option value="KG">
                          Kilogram
                        </option>

                        <option value="HOUR">
                          Hour
                        </option>

                        <option value="DAY">
                          Day
                        </option>

                        <option value="MONTH">
                          Month
                        </option>

                        <option value="SERVICE">
                          Service
                        </option>
                      </select>
                    </label>

                    <label
                      className={
                        "request-field"
                      }
                    >
                      <span>
                        Estimated unit price
                      </span>

                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item
                            .estimatedUnitPrice
                        }
                        onChange={
                          event =>
                            updateItem(
                              index,
                              "estimatedUnitPrice",
                              Number(
                                event
                                  .target
                                  .value,
                              ),
                            )
                        }
                      />
                    </label>

                    <label
                      className={
                        "request-field request-field--wide"
                      }
                    >
                      <span>
                        Line description
                      </span>

                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={
                          item.description ??
                          ""
                        }
                        placeholder={
                          "Optional specifications or requirements."
                        }
                        onChange={
                          event =>
                            updateItem(
                              index,
                              "description",
                              event
                                .target
                                .value,
                            )
                        }
                      />
                    </label>

                    <div
                      className={
                        "request-line-total"
                      }
                    >
                      <span>
                        Estimated line total
                      </span>

                      <strong>
                        {
                          currencyFormatter
                            .format(
                              lineTotal,
                            )
                        }
                      </strong>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      </section>

      <section
        className={
          "request-form-footer"
        }
      >
        <div
          className={
            "request-total-card"
          }
        >
          <span>
            Estimated request total
          </span>

          <strong>
            {
              new Intl.NumberFormat(
                "en-US",
                {
                  style:
                    "currency",
                  currency:
                    form.currency ||
                    "EUR",
                  maximumFractionDigits:
                    2,
                },
              ).format(
                estimatedTotal,
              )
            }
          </strong>

          <small>
            Final totals are recalculated
            by the server.
          </small>
        </div>

        <div
          className={
            "request-form-actions"
          }
        >
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

          <button
            type="submit"
            className={
              "button button--primary request-save-button"
            }
            disabled={
              submitting
            }
          >
            {submitting
              ? "Saving..."
              : submitLabel}
          </button>
        </div>
      </section>
    </form>
  );
}
