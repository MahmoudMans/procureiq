import { portalRequest } from "@/lib/supplier-portal-rfqs";
import type {
  PortalPurchaseOrderDetail,
  PortalPurchaseOrderSummary,
} from "@/types/supplier-portal-purchase-order";

export function getSupplierPortalPurchaseOrders(
  token: string,
): Promise<PortalPurchaseOrderSummary[]> {
  return portalRequest<PortalPurchaseOrderSummary[]>("/supplier-portal/purchase-orders", token);
}

export function getSupplierPortalPurchaseOrder(
  token: string,
  purchaseOrderId: string,
): Promise<PortalPurchaseOrderDetail> {
  return portalRequest<PortalPurchaseOrderDetail>(
    `/supplier-portal/purchase-orders/${purchaseOrderId}`,
    token,
  );
}

/** The note is optional; an empty note is sent as null. */
export function acknowledgeSupplierPortalPurchaseOrder(
  token: string,
  purchaseOrderId: string,
  note: string,
): Promise<PortalPurchaseOrderDetail> {
  return portalRequest<PortalPurchaseOrderDetail>(
    `/supplier-portal/purchase-orders/${purchaseOrderId}/acknowledge`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ note: note.trim() || null }),
    },
  );
}

/** A reason is required; the server refuses a rejection without one. */
export function rejectSupplierPortalPurchaseOrder(
  token: string,
  purchaseOrderId: string,
  reason: string,
): Promise<PortalPurchaseOrderDetail> {
  return portalRequest<PortalPurchaseOrderDetail>(
    `/supplier-portal/purchase-orders/${purchaseOrderId}/reject`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ note: reason.trim() }),
    },
  );
}
