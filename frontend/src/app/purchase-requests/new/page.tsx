"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState, useToast } from "@/components/kit";
import { PurchaseRequestForm } from "@/components/purchase-requests/purchase-request-form";
import { createPurchaseRequest } from "@/lib/api";
import type { PurchaseRequestInput } from "@/types/purchase-request";

const CREATE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER", "REQUESTER"];

/** Built when the page opens, so "14 days from today" is never stale. */
function buildInitialValue(): PurchaseRequestInput {
  const date = new Date();

  date.setDate(date.getDate() + 14);

  return {
    title: "",
    description: "",
    businessJustification: "",
    costCenter: "",
    currency: "EUR",
    desiredDeliveryDate: date.toISOString().slice(0, 10),
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
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [initialValue] = useState(buildInitialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = user !== null && CREATE_ROLES.includes(user.role);

  async function handleSubmit(value: PurchaseRequestInput) {
    setSubmitting(true);
    setError(null);

    try {
      const created = await createPurchaseRequest(value);

      toast.success(
        "Draft created",
        "Review it, then submit it into procurement governance.",
      );

      router.push(`/purchase-requests/${created.id}`);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to create purchase request.";

      setError(message);
      toast.error("Could not create the draft", message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!canCreate) {
    return (
      <div className="page-stack">
        <Link href="/purchase-requests" className="request-back-link">
          <ArrowLeft size={16} />
          Purchase requests
        </Link>

        <section className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="Access restricted"
            description="Your ProcureIQ role cannot create purchase requests."
          />
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link href="/purchase-requests" className="request-back-link">
        <ArrowLeft size={16} />
        Purchase requests
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">New procurement demand</span>

          <h1>Create purchase request</h1>

          <p>
            Build the requirement as a draft. You can review it before submitting it into
            procurement governance.
          </p>
        </div>

        <div className="request-owner-summary">
          <span>REQUESTER</span>

          <strong>{user?.fullName}</strong>

          <small>{user?.departmentName}</small>
        </div>
      </section>

      <PurchaseRequestForm
        initialValue={initialValue}
        submitLabel="Create draft"
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
