"use client";

import {
  ArrowLeft,
  CircleAlert,
  MessageSquareText,
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
  createSupplierCollaborationWorkspace,
  getSupplierCollaborationContext,
} from "@/lib/api";

import type {
  CollaborationContext,
  CollaborationPriority,
  CollaborationWorkspaceType,
} from "@/types/supplier-collaboration";

export default function NewSupplierCollaborationPage() {
  const router =
    useRouter();

  const [
    context,
    setContext,
  ] =
    useState<
      CollaborationContext |
      null
    >(null);

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    workspaceType,
    setWorkspaceType,
  ] =
    useState<CollaborationWorkspaceType>(
      "GENERAL",
    );

  const [
    priority,
    setPriority,
  ] =
    useState<CollaborationPriority>(
      "MEDIUM",
    );

  const [
    title,
    setTitle,
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
    externalReference,
    setExternalReference,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    supplierResponseSlaHours,
    setSupplierResponseSlaHours,
  ] =
    useState("");

  const [
    notes,
    setNotes,
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

    getSupplierCollaborationContext()
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          if (
            response.suppliers[0]
          ) {
            setSupplierId(
              response.suppliers[0].id,
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
              : "Unable to load collaboration context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const supplierPurchaseOrders =
    useMemo(
      () =>
        context
          ?.purchaseOrders
          .filter(
            purchaseOrder =>
              purchaseOrder.supplierId ===
                supplierId,
          )
        ??
        [],
      [
        context,
        supplierId,
      ],
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const result =
        await createSupplierCollaborationWorkspace({
          supplierId,
          workspaceType,
          priority,
          title:
            title.trim(),
          purchaseOrderId:
            purchaseOrderId
            ||
            undefined,
          rfqId:
            rfqId
            ||
            undefined,
          externalReference:
            externalReference.trim()
            ||
            undefined,
          ownerUserId:
            ownerUserId
            ||
            undefined,
          supplierResponseSlaHours:
            supplierResponseSlaHours
              ? Number(
                  supplierResponseSlaHours,
                )
              : undefined,
          notes:
            notes.trim()
            ||
            undefined,
        });

      router.push(
        `/supplier-collaboration/${result.workspace.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create supplier collaboration workspace.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/supplier-collaboration"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Supplier collaboration
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Supplier engagement
          </span>

          <h1>
            New collaboration workspace
          </h1>

          <p>
            Open a governed topic for
            sourcing clarification,
            purchase-order
            acknowledgement, delivery,
            documents or supplier issue
            resolution.
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

      {!context ||
      context.suppliers.length ===
        0 ? (
        <section className="panel">
          <div className="collaboration-empty">
            No supplier records are
            available.
          </div>
        </section>
      ) : (
        <form
          className="panel"
          onSubmit={handleSubmit}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Workspace context
              </span>

              <h2>
                Collaboration setup
              </h2>
            </div>

            <MessageSquareText
              size={19}
            />
          </div>

          <div className="collaboration-form-grid">
            <label className="request-field collaboration-form-wide">
              <span>
                Supplier
              </span>

              <select
                required
                value={supplierId}
                onChange={
                  event => {
                    setSupplierId(
                      event.target.value,
                    );

                    setPurchaseOrderId("");
                  }
                }
              >
                {context.suppliers.map(
                  supplier => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.supplierCode}
                      {" — "}
                      {supplier.supplierName}
                      {" — "}
                      {supplier.status ??
                        "Unknown"}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Workspace type
              </span>

              <select
                value={workspaceType}
                onChange={
                  event =>
                    setWorkspaceType(
                      event.target.value as
                        CollaborationWorkspaceType,
                    )
                }
              >
                <option value="SOURCING_CLARIFICATION">
                  Sourcing clarification
                </option>

                <option value="PURCHASE_ORDER">
                  Purchase order
                </option>

                <option value="DELIVERY">
                  Delivery
                </option>

                <option value="DOCUMENT_REQUEST">
                  Document request
                </option>

                <option value="QUALITY_ISSUE">
                  Quality issue
                </option>

                <option value="GENERAL">
                  General
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Priority
              </span>

              <select
                value={priority}
                onChange={
                  event =>
                    setPriority(
                      event.target.value as
                        CollaborationPriority,
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

            <label className="request-field collaboration-form-wide">
              <span>
                Topic / title
              </span>

              <input
                required
                maxLength={240}
                value={title}
                onChange={
                  event =>
                    setTitle(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Purchase order
              </span>

              <select
                value={purchaseOrderId}
                onChange={
                  event =>
                    setPurchaseOrderId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  No PO context
                </option>

                {supplierPurchaseOrders.map(
                  purchaseOrder => (
                    <option
                      key={purchaseOrder.id}
                      value={purchaseOrder.id}
                    >
                      {purchaseOrder.purchaseOrderNumber}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                RFQ
              </span>

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
                  No RFQ context
                </option>

                {context.rfqs.map(
                  rfq => (
                    <option
                      key={rfq.id}
                      value={rfq.id}
                    >
                      {rfq.rfqNumber}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                External reference
              </span>

              <input
                maxLength={300}
                value={externalReference}
                onChange={
                  event =>
                    setExternalReference(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Owner
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
                {context.users
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

            <label className="request-field">
              <span>
                Supplier response SLA hours
              </span>

              <input
                type="number"
                min="1"
                max="720"
                value={
                  supplierResponseSlaHours
                }
                placeholder={
                  "Use policy default"
                }
                onChange={
                  event =>
                    setSupplierResponseSlaHours(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field collaboration-form-wide">
              <span>
                Internal workspace notes
              </span>

              <textarea
                rows={5}
                maxLength={3000}
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

          <div className="collaboration-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                saving
                ||
                !supplierId
                ||
                !title.trim()
              }
            >
              <MessageSquareText
                size={16}
              />

              {saving
                ? "Creating..."
                : "Create workspace"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
