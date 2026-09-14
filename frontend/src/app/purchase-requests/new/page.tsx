"use client";

import {
  ArrowLeft,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  PurchaseRequestForm,
} from "@/components/purchase-requests/purchase-request-form";

import {
  createPurchaseRequest,
} from "@/lib/api";

import type {
  PurchaseRequestInput,
} from "@/types/purchase-request";

function defaultDeliveryDate():
string {
  const date =
    new Date();

  date.setDate(
    date.getDate() + 14,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

const initialValue:
PurchaseRequestInput = {
  title: "",
  description: "",
  businessJustification: "",
  costCenter: "",
  currency: "EUR",
  desiredDeliveryDate:
    defaultDeliveryDate(),
  items: [
    {
      itemName: "",
      description: "",
      category: "",
      quantity: 1,
      unit: "EA",
      estimatedUnitPrice: 0,
    },
  ],
};

export default function NewPurchaseRequestPage() {
  const router =
    useRouter();

  const {
    user,
  } = useAuth();

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const canCreate =
    user !== null &&
    [
      "ADMIN",
      "PROCUREMENT_MANAGER",
      "BUYER",
      "REQUESTER",
    ].includes(
      user.role,
    );

  async function handleSubmit(
    value:
      PurchaseRequestInput,
  ) {
    try {
      setSubmitting(
        true,
      );

      setError(
        null,
      );

      const created =
        await createPurchaseRequest(
          value,
        );

      router.push(
        `/purchase-requests/${created.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create purchase request.",
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  if (!canCreate) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <Link
          href={
            "/purchase-requests"
          }
          className={
            "request-back-link"
          }
        >
          <ArrowLeft
            size={16}
          />
          Purchase requests
        </Link>

        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />

          Your ProcureIQ role
          cannot create purchase
          requests.
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <Link
        href={
          "/purchase-requests"
        }
        className={
          "request-back-link"
        }
      >
        <ArrowLeft
          size={16}
        />
        Purchase requests
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
            New procurement demand
          </span>

          <h1>
            Create purchase request
          </h1>

          <p>
            Build the requirement as a
            draft. You can review it
            before submitting it into
            procurement governance.
          </p>
        </div>

        <div
          className={
            "request-owner-summary"
          }
        >
          <span>
            REQUESTER
          </span>

          <strong>
            {user?.fullName}
          </strong>

          <small>
            {
              user
                ?.departmentName
            }
          </small>
        </div>
      </section>

      <PurchaseRequestForm
        initialValue={
          initialValue
        }
        submitLabel={
          "Create draft"
        }
        submitting={
          submitting
        }
        error={error}
        onSubmit={
          handleSubmit
        }
      />
    </div>
  );
}
