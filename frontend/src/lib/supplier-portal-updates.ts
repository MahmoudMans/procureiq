import { portalRequest } from "@/lib/supplier-portal-rfqs";
import type { PortalRfqUpdate } from "@/types/supplier-portal-update";

export function getSupplierPortalRfqUpdates(token: string): Promise<PortalRfqUpdate[]> {
  return portalRequest<PortalRfqUpdate[]>("/supplier-portal/rfq-updates", token);
}
