import {
  clearAccessToken,
  getAccessToken,
} from "@/lib/auth-storage";

import type {
  ApprovalSummary,
  ApprovalTask,
  ApprovalTaskStatus,
} from "@/types/approval";

import type {
  AuthUser,
  Department,
  LoginResponse,
} from "@/types/auth";

import type {
  PurchaseRequest,
  PurchaseRequestFilters,
  PurchaseRequestInput,
  PurchaseRequestSummary,
} from "@/types/purchase-request";

import type {
  Rfq,
  RfqCreateInput,
  RfqFilters,
  RfqSummary,
  RfqUpdateInput,
} from "@/types/rfq";

import type {
  CreateSupplierInput,
  Supplier,
  SupplierFilters,
  SupplierSummary,
} from "@/types/supplier";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080/api/v1";

interface ProblemResponse {
  title?: string;
  detail?: string;
}

interface RequestOptions extends RequestInit {
  authenticated?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    authenticated = true,
    ...fetchOptions
  } = options;

  const headers =
    new Headers(
      fetchOptions.headers,
    );

  if (
    fetchOptions.body &&
    !headers.has(
      "Content-Type",
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (authenticated) {
    const token =
      getAccessToken();

    if (token) {
      headers.set(
        "Authorization",
        `Bearer ${token}`,
      );
    }
  }

  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...fetchOptions,
        headers,
      },
    );

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}`;

    try {
      const problem =
        (await response.json()) as ProblemResponse;

      message =
        problem.detail ??
        problem.title ??
        message;
    } catch {
      // Keep default HTTP error message.
    }

    if (
      response.status === 401 &&
      authenticated
    ) {
      clearAccessToken();

      if (
        typeof window !==
        "undefined"
      ) {
        window.dispatchEvent(
          new Event(
            "procureiq:unauthorized",
          ),
        );
      }
    }

    throw new Error(
      message,
    );
  }

  if (
    response.status === 204
  ) {
    return undefined as T;
  }

  return (
    await response.json()
  ) as T;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>(
    "/auth/login",
    {
      method: "POST",
      authenticated: false,
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );
}

export async function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>(
    "/auth/me",
  );
}

export async function getUsers(): Promise<AuthUser[]> {
  return request<AuthUser[]>(
    "/users",
  );
}

export async function getDepartments(): Promise<Department[]> {
  return request<Department[]>(
    "/departments",
  );
}

export async function getSuppliers(
  filters: SupplierFilters = {},
): Promise<Supplier[]> {
  const params =
    new URLSearchParams();

  if (
    filters.query?.trim()
  ) {
    params.set(
      "query",
      filters.query.trim(),
    );
  }

  if (filters.status) {
    params.set(
      "status",
      filters.status,
    );
  }

  if (
    filters.riskLevel
  ) {
    params.set(
      "riskLevel",
      filters.riskLevel,
    );
  }

  const queryString =
    params.toString();

  return request<Supplier[]>(
    `/suppliers${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function getSupplierSummary(): Promise<SupplierSummary> {
  return request<SupplierSummary>(
    "/suppliers/summary",
  );
}

export async function createSupplier(
  input: CreateSupplierInput,
): Promise<Supplier> {
  return request<Supplier>(
    "/suppliers",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getPurchaseRequests(
  filters: PurchaseRequestFilters = {},
): Promise<PurchaseRequest[]> {
  const params =
    new URLSearchParams();

  if (
    filters.query?.trim()
  ) {
    params.set(
      "query",
      filters.query.trim(),
    );
  }

  if (filters.status) {
    params.set(
      "status",
      filters.status,
    );
  }

  const queryString =
    params.toString();

  return request<PurchaseRequest[]>(
    `/purchase-requests${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function getPurchaseRequestSummary(): Promise<PurchaseRequestSummary> {
  return request<PurchaseRequestSummary>(
    "/purchase-requests/summary",
  );
}

export async function getPurchaseRequest(
  id: string,
): Promise<PurchaseRequest> {
  return request<PurchaseRequest>(
    `/purchase-requests/${id}`,
  );
}

export async function createPurchaseRequest(
  input: PurchaseRequestInput,
): Promise<PurchaseRequest> {
  return request<PurchaseRequest>(
    "/purchase-requests",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function updatePurchaseRequest(
  id: string,
  input: PurchaseRequestInput,
): Promise<PurchaseRequest> {
  return request<PurchaseRequest>(
    `/purchase-requests/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function submitPurchaseRequest(
  id: string,
): Promise<PurchaseRequest> {
  return request<PurchaseRequest>(
    `/purchase-requests/${id}/submit`,
    {
      method: "POST",
    },
  );
}

export async function cancelPurchaseRequest(
  id: string,
): Promise<PurchaseRequest> {
  return request<PurchaseRequest>(
    `/purchase-requests/${id}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getApprovalQueue(
  status?: ApprovalTaskStatus,
): Promise<ApprovalTask[]> {
  const params =
    new URLSearchParams();

  if (status) {
    params.set(
      "status",
      status,
    );
  }

  const queryString =
    params.toString();

  return request<ApprovalTask[]>(
    `/approvals${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function getApprovalSummary(): Promise<ApprovalSummary> {
  return request<ApprovalSummary>(
    "/approvals/summary",
  );
}

export async function getApprovalHistory(
  purchaseRequestId: string,
): Promise<ApprovalTask[]> {
  return request<ApprovalTask[]>(
    `/approvals/by-request/${purchaseRequestId}`,
  );
}

export async function approveTask(
  taskId: string,
  comment: string,
): Promise<ApprovalTask> {
  return request<ApprovalTask>(
    `/approvals/${taskId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        comment,
      }),
    },
  );
}

export async function rejectTask(
  taskId: string,
  comment: string,
): Promise<ApprovalTask> {
  return request<ApprovalTask>(
    `/approvals/${taskId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        comment,
      }),
    },
  );
}

export async function getRfqs(
  filters: RfqFilters = {},
): Promise<Rfq[]> {
  const params =
    new URLSearchParams();

  if (
    filters.query?.trim()
  ) {
    params.set(
      "query",
      filters.query.trim(),
    );
  }

  if (
    filters.status
  ) {
    params.set(
      "status",
      filters.status,
    );
  }

  const queryString =
    params.toString();

  return request<Rfq[]>(
    `/rfqs${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function getRfqSummary(): Promise<RfqSummary> {
  return request<RfqSummary>(
    "/rfqs/summary",
  );
}

export async function getRfq(
  id: string,
): Promise<Rfq> {
  return request<Rfq>(
    `/rfqs/${id}`,
  );
}

export async function createRfq(
  input: RfqCreateInput,
): Promise<Rfq> {
  return request<Rfq>(
    "/rfqs",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function updateRfq(
  id: string,
  input: RfqUpdateInput,
): Promise<Rfq> {
  return request<Rfq>(
    `/rfqs/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function publishRfq(
  id: string,
): Promise<Rfq> {
  return request<Rfq>(
    `/rfqs/${id}/publish`,
    {
      method: "POST",
    },
  );
}

export async function closeRfq(
  id: string,
): Promise<Rfq> {
  return request<Rfq>(
    `/rfqs/${id}/close`,
    {
      method: "POST",
    },
  );
}

export async function cancelRfq(
  id: string,
): Promise<Rfq> {
  return request<Rfq>(
    `/rfqs/${id}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getRfqQuotations(
  rfqId: string,
): Promise<import("@/types/quotation").Quotation[]> {
  return request<
    import("@/types/quotation").Quotation[]
  >(
    `/rfqs/${rfqId}/quotations`,
  );
}

export async function getQuotationComparison(
  rfqId: string,
): Promise<import("@/types/quotation").QuotationComparison> {
  return request<
    import("@/types/quotation").QuotationComparison
  >(
    `/rfqs/${rfqId}/quotation-comparison`,
  );
}

export async function createQuotation(
  rfqId: string,
  input: import("@/types/quotation").QuotationCreateInput,
): Promise<import("@/types/quotation").Quotation> {
  return request<
    import("@/types/quotation").Quotation
  >(
    `/rfqs/${rfqId}/quotations`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function updateQuotation(
  quotationId: string,
  input: import("@/types/quotation").QuotationUpdateInput,
): Promise<import("@/types/quotation").Quotation> {
  return request<
    import("@/types/quotation").Quotation
  >(
    `/quotations/${quotationId}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function submitQuotation(
  quotationId: string,
): Promise<import("@/types/quotation").Quotation> {
  return request<
    import("@/types/quotation").Quotation
  >(
    `/quotations/${quotationId}/submit`,
    {
      method: "POST",
    },
  );
}

export async function withdrawQuotation(
  quotationId: string,
): Promise<import("@/types/quotation").Quotation> {
  return request<
    import("@/types/quotation").Quotation
  >(
    `/quotations/${quotationId}/withdraw`,
    {
      method: "POST",
    },
  );
}

export async function getRfqEvaluation(
  rfqId: string,
): Promise<import("@/types/evaluation").RfqEvaluation> {
  return request<
    import("@/types/evaluation").RfqEvaluation
  >(
    `/rfqs/${rfqId}/evaluation`,
  );
}

export async function calculateRfqEvaluation(
  rfqId: string,
  input: import("@/types/evaluation").RfqEvaluationInput,
): Promise<import("@/types/evaluation").RfqEvaluation> {
  return request<
    import("@/types/evaluation").RfqEvaluation
  >(
    `/rfqs/${rfqId}/evaluation`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getAwardDecision(
  rfqId: string,
): Promise<
  import("@/types/evaluation").AwardDecision | undefined
> {
  return request<
    import("@/types/evaluation").AwardDecision | undefined
  >(
    `/rfqs/${rfqId}/award`,
  );
}

export async function createAwardDecision(
  rfqId: string,
  selectedQuotationId: string,
  rationale: string,
): Promise<import("@/types/evaluation").AwardDecision> {
  return request<
    import("@/types/evaluation").AwardDecision
  >(
    `/rfqs/${rfqId}/award`,
    {
      method: "POST",
      body: JSON.stringify({
        selectedQuotationId,
        rationale,
      }),
    },
  );
}

export async function getPurchaseOrders(
  query?: string,
  status?: import("@/types/purchase-order").PurchaseOrderStatus,
): Promise<import("@/types/purchase-order").PurchaseOrder[]> {
  const params =
    new URLSearchParams();

  if (query?.trim()) {
    params.set(
      "query",
      query.trim(),
    );
  }

  if (status) {
    params.set(
      "status",
      status,
    );
  }

  const queryString =
    params.toString();

  return request<
    import("@/types/purchase-order").PurchaseOrder[]
  >(
    `/purchase-orders${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function getPurchaseOrderSummary(): Promise<
  import("@/types/purchase-order").PurchaseOrderSummary
> {
  return request<
    import("@/types/purchase-order").PurchaseOrderSummary
  >(
    "/purchase-orders/summary",
  );
}

export async function getPurchaseOrder(
  id: string,
): Promise<import("@/types/purchase-order").PurchaseOrder> {
  return request<
    import("@/types/purchase-order").PurchaseOrder
  >(
    `/purchase-orders/${id}`,
  );
}

export async function createPurchaseOrder(
  input: import("@/types/purchase-order").PurchaseOrderCreateInput,
): Promise<import("@/types/purchase-order").PurchaseOrder> {
  return request<
    import("@/types/purchase-order").PurchaseOrder
  >(
    "/purchase-orders",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function updatePurchaseOrder(
  id: string,
  input: import("@/types/purchase-order").PurchaseOrderUpdateInput,
): Promise<import("@/types/purchase-order").PurchaseOrder> {
  return request<
    import("@/types/purchase-order").PurchaseOrder
  >(
    `/purchase-orders/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function issuePurchaseOrder(
  id: string,
): Promise<import("@/types/purchase-order").PurchaseOrder> {
  return request<
    import("@/types/purchase-order").PurchaseOrder
  >(
    `/purchase-orders/${id}/issue`,
    {
      method: "POST",
    },
  );
}

export async function cancelPurchaseOrder(
  id: string,
): Promise<import("@/types/purchase-order").PurchaseOrder> {
  return request<
    import("@/types/purchase-order").PurchaseOrder
  >(
    `/purchase-orders/${id}/cancel`,
    {
      method: "POST",
    },
  );
}
