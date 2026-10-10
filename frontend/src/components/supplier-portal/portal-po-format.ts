import type {
  PortalPurchaseOrderResponse,
  PortalPurchaseOrderStatus,
} from "@/types/supplier-portal-purchase-order";

export type PurchaseOrderTone = "success" | "info" | "warning" | "danger" | "neutral";

interface OrderState {
  status: PortalPurchaseOrderStatus;
  supplierResponse: PortalPurchaseOrderResponse;
}

/** True while the order is issued and the supplier has not answered yet. */
export function awaitingResponse(order: OrderState): boolean {
  return order.status === "ISSUED" && order.supplierResponse === "PENDING";
}

export function orderStateLabel(order: OrderState): string {
  if (order.status === "CANCELLED") return "Cancelled";
  if (order.status === "RECEIVED") return "Received";
  if (order.status === "PARTIALLY_RECEIVED") return "Partly received";
  if (order.supplierResponse === "REJECTED") return "Rejected by you";
  if (order.supplierResponse === "ACKNOWLEDGED") return "Acknowledged";

  return "Awaiting your response";
}

export function orderStateTone(order: OrderState): PurchaseOrderTone {
  if (order.status === "CANCELLED") return "neutral";
  if (order.status === "RECEIVED") return "success";
  if (order.status === "PARTIALLY_RECEIVED") return "info";
  if (order.supplierResponse === "REJECTED") return "warning";
  if (order.supplierResponse === "ACKNOWLEDGED") return "success";

  return "info";
}

export function formatPoDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const time = Date.parse(value.length === 10 ? `${value}T00:00:00` : value);

  if (Number.isNaN(time)) {
    return value;
  }

  return new Date(time).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatPoDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return value;
  }

  return new Date(time).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
