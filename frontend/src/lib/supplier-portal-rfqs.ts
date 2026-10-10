import type {
  PortalQuotationInput,
  PortalRfqDetail,
  PortalRfqSummary,
} from "@/types/supplier-portal-rfq";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

interface ProblemResponse {
  title?: string;
  detail?: string;
}

async function portalRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const problem = (await response.json()) as ProblemResponse;

      message = problem.detail ?? problem.title ?? message;
    } catch {
      // Keep the default HTTP error message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function getSupplierPortalRfqs(token: string): Promise<PortalRfqSummary[]> {
  return portalRequest<PortalRfqSummary[]>("/supplier-portal/rfqs", token);
}

export function getSupplierPortalRfq(token: string, rfqId: string): Promise<PortalRfqDetail> {
  return portalRequest<PortalRfqDetail>(`/supplier-portal/rfqs/${rfqId}`, token);
}

export function saveSupplierPortalQuotation(
  token: string,
  rfqId: string,
  input: PortalQuotationInput,
): Promise<PortalRfqDetail> {
  return portalRequest<PortalRfqDetail>(`/supplier-portal/rfqs/${rfqId}/quotation`, token, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function submitSupplierPortalQuotation(
  token: string,
  rfqId: string,
): Promise<PortalRfqDetail> {
  return portalRequest<PortalRfqDetail>(
    `/supplier-portal/rfqs/${rfqId}/quotation/submit`,
    token,
    { method: "POST" },
  );
}

export function withdrawSupplierPortalQuotation(
  token: string,
  rfqId: string,
): Promise<PortalRfqDetail> {
  return portalRequest<PortalRfqDetail>(
    `/supplier-portal/rfqs/${rfqId}/quotation/withdraw`,
    token,
    { method: "POST" },
  );
}

export function declineSupplierPortalInvitation(
  token: string,
  rfqId: string,
): Promise<PortalRfqDetail> {
  return portalRequest<PortalRfqDetail>(`/supplier-portal/rfqs/${rfqId}/decline`, token, {
    method: "POST",
  });
}

export function reconsiderSupplierPortalInvitation(
  token: string,
  rfqId: string,
): Promise<PortalRfqDetail> {
  return portalRequest<PortalRfqDetail>(`/supplier-portal/rfqs/${rfqId}/reconsider`, token, {
    method: "POST",
  });
}
