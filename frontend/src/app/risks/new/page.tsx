"use client";

import {
  ArrowLeft,
  CircleAlert,
  ShieldAlert,
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
  createRiskCase,
  getRiskContextOptions,
} from "@/lib/api";

import type {
  RiskCategory,
  RiskContextOptions,
} from "@/types/risk";

function defaultDueDate():
string {
  const date =
    new Date();

  date.setDate(
    date.getDate() + 30,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function NewRiskPage() {
  const router =
    useRouter();

  const [
    options,
    setOptions,
  ] =
    useState<
      RiskContextOptions |
      null
    >(null);

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
    category,
    setCategory,
  ] =
    useState<RiskCategory>(
      "SUPPLIER",
    );

  const [
    likelihood,
    setLikelihood,
  ] =
    useState(3);

  const [
    impact,
    setImpact,
  ] =
    useState(3);

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    contractId,
    setContractId,
  ] =
    useState("");

  const [
    purchaseOrderId,
    setPurchaseOrderId,
  ] =
    useState("");

  const [
    rfqId,
    setRfqId,
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

    getRiskContextOptions()
      .then(
        response => {
          if (!active) {
            return;
          }

          setOptions(
            response,
          );

          if (
            response.users.length >
            0
          ) {
            setOwnerUserId(
              response.users[0].id,
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
              : "Unable to load risk context.",
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

  const score =
    likelihood *
    impact;

  const severity =
    score <= 4
      ? "LOW"
      : score <= 9
        ? "MEDIUM"
        : score <= 15
          ? "HIGH"
          : "CRITICAL";

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const created =
        await createRiskCase({
          title:
            title.trim(),
          description:
            description.trim(),
          category,
          likelihood,
          impact,
          dueDate:
            dueDate ||
            undefined,
          ownerUserId:
            ownerUserId ||
            undefined,
          supplierId:
            supplierId ||
            undefined,
          contractId:
            contractId ||
            undefined,
          purchaseOrderId:
            purchaseOrderId ||
            undefined,
          rfqId:
            rfqId ||
            undefined,
        });

      router.push(
        `/risks/${created.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create risk case.",
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
        href="/risks"
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />

        Risk register
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
            Exception management
          </span>

          <h1>
            New procurement risk
          </h1>

          <p>
            Register an exposure,
            quantify likelihood and
            impact, assign ownership
            and link the risk to its
            operational context.
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

      <section
        className={
          "risk-score-preview"
        }
      >
        <div>
          <ShieldAlert
            size={20}
          />

          <span>
            Calculated risk
          </span>
        </div>

        <strong>
          {score}/25
        </strong>

        <span
          className={
            `risk-severity risk-severity--${severity.toLowerCase()}`
          }
        >
          {severity}
        </span>
      </section>

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
              Risk definition
            </span>

            <h2>
              Exposure details
            </h2>
          </div>
        </div>

        <div
          className={
            "risk-form-grid"
          }
        >
          <label
            className={
              "request-field risk-form-wide"
            }
          >
            <span>Title</span>

            <input
              required
              maxLength={220}
              value={title}
              placeholder={
                "Critical supplier insurance certificate expired"
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
              "request-field risk-form-wide"
            }
          >
            <span>
              Description
            </span>

            <textarea
              required
              rows={5}
              maxLength={3000}
              value={
                description
              }
              onChange={
                event =>
                  setDescription(
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
            <span>Category</span>

            <select
              value={category}
              onChange={
                event =>
                  setCategory(
                    event.target
                      .value as
                      RiskCategory,
                  )
              }
            >
              <option value="SUPPLIER">
                Supplier
              </option>

              <option value="CONTRACT">
                Contract
              </option>

              <option value="PURCHASE_ORDER">
                Purchase order
              </option>

              <option value="DELIVERY">
                Delivery
              </option>

              <option value="SOURCING">
                Sourcing
              </option>

              <option value="COMPLIANCE">
                Compliance
              </option>

              <option value="OTHER">
                Other
              </option>
            </select>
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>Owner</span>

            <select
              disabled={
                loading
              }
              value={
                ownerUserId
              }
              onChange={
                event =>
                  setOwnerUserId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                Current user
              </option>

              {options
                ?.users
                .map(
                  user => (
                    <option
                      key={
                        user.id
                      }
                      value={
                        user.id
                      }
                    >
                      {
                        user.fullName
                      }
                      {" — "}
                      {
                        user.role
                      }
                    </option>
                  ),
                )}
            </select>
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Likelihood (1–5)
            </span>

            <input
              required
              type="number"
              min="1"
              max="5"
              value={
                likelihood
              }
              onChange={
                event =>
                  setLikelihood(
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
              Impact (1–5)
            </span>

            <input
              required
              type="number"
              min="1"
              max="5"
              value={
                impact
              }
              onChange={
                event =>
                  setImpact(
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
            <span>Due date</span>

            <input
              type="date"
              value={dueDate}
              onChange={
                event =>
                  setDueDate(
                    event.target.value,
                  )
              }
            />
          </label>

          <div />

          <label
            className={
              "request-field"
            }
          >
            <span>Supplier</span>

            <select
              value={supplierId}
              onChange={
                event =>
                  setSupplierId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                No supplier
              </option>

              {options
                ?.suppliers
                .map(
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
              "request-field"
            }
          >
            <span>Contract</span>

            <select
              value={contractId}
              onChange={
                event =>
                  setContractId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                No contract
              </option>

              {options
                ?.contracts
                .filter(
                  contract =>
                    !supplierId ||
                    contract.supplierId ===
                      supplierId,
                )
                .map(
                  contract => (
                    <option
                      key={
                        contract.id
                      }
                      value={
                        contract.id
                      }
                    >
                      {
                        contract
                          .contractNumber
                      }
                      {" — "}
                      {
                        contract.title
                      }
                    </option>
                  ),
                )}
            </select>
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>
              Purchase order
            </span>

            <select
              value={
                purchaseOrderId
              }
              onChange={
                event =>
                  setPurchaseOrderId(
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
                    !supplierId ||
                    order.supplierId ===
                      supplierId,
                )
                .map(
                  order => (
                    <option
                      key={
                        order.id
                      }
                      value={
                        order.id
                      }
                    >
                      {
                        order
                          .purchaseOrderNumber
                      }
                      {" — "}
                      {
                        order.supplierName
                      }
                    </option>
                  ),
                )}
            </select>
          </label>

          <label
            className={
              "request-field"
            }
          >
            <span>RFQ</span>

            <select
              value={rfqId}
              onChange={
                event =>
                  setRfqId(
                    event.target.value,
                  )
              }
            >
              <option value="">
                No RFQ
              </option>

              {options
                ?.rfqs
                .map(
                  rfq => (
                    <option
                      key={
                        rfq.id
                      }
                      value={
                        rfq.id
                      }
                    >
                      {
                        rfq.rfqNumber
                      }
                      {" — "}
                      {
                        rfq.title
                      }
                    </option>
                  ),
                )}
            </select>
          </label>
        </div>

        <div
          className={
            "risk-form-actions"
          }
        >
          <button
            type="submit"
            className={
              "button button--primary"
            }
            disabled={
              saving
            }
          >
            <ShieldAlert
              size={16}
            />

            {saving
              ? "Creating..."
              : "Create risk case"}
          </button>
        </div>
      </form>
    </div>
  );
}
