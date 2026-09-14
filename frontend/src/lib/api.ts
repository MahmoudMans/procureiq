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

export async function getDeliverySummary(): Promise<
  import("@/types/delivery").DeliverySummary
> {
  return request<
    import("@/types/delivery").DeliverySummary
  >(
    "/deliveries/summary",
  );
}

export async function getPurchaseOrderReceiving(
  purchaseOrderId: string,
): Promise<import("@/types/delivery").PurchaseOrderReceiving> {
  return request<
    import("@/types/delivery").PurchaseOrderReceiving
  >(
    `/purchase-orders/${purchaseOrderId}/receiving`,
  );
}

export async function getGoodsReceipts(
  purchaseOrderId: string,
): Promise<import("@/types/delivery").GoodsReceipt[]> {
  return request<
    import("@/types/delivery").GoodsReceipt[]
  >(
    `/purchase-orders/${purchaseOrderId}/receipts`,
  );
}

export async function createGoodsReceipt(
  purchaseOrderId: string,
  input: import("@/types/delivery").GoodsReceiptInput,
): Promise<import("@/types/delivery").GoodsReceipt> {
  return request<
    import("@/types/delivery").GoodsReceipt
  >(
    `/purchase-orders/${purchaseOrderId}/receipts`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getSupplierDeliveryPerformance(
  supplierId: string,
): Promise<
  import("@/types/delivery").SupplierDeliveryPerformance
> {
  return request<
    import("@/types/delivery").SupplierDeliveryPerformance
  >(
    `/suppliers/${supplierId}/delivery-performance`,
  );
}

export async function getProcurementAnalytics(): Promise<
  import("@/types/analytics").ProcurementAnalytics
> {
  return request<
    import("@/types/analytics").ProcurementAnalytics
  >(
    "/analytics/procurement",
  );
}

export async function getActivity(
  limit = 100,
): Promise<import("@/types/activity").ActivityEvent[]> {
  return request<
    import("@/types/activity").ActivityEvent[]
  >(
    `/activity?limit=${limit}`,
  );
}

export async function getNotifications(
  unreadOnly = false,
): Promise<import("@/types/activity").ProcurementNotification[]> {
  return request<
    import("@/types/activity").ProcurementNotification[]
  >(
    `/notifications?unreadOnly=${unreadOnly}`,
  );
}

export async function getUnreadNotificationCount(): Promise<
  import("@/types/activity").UnreadNotificationCount
> {
  return request<
    import("@/types/activity").UnreadNotificationCount
  >(
    "/notifications/unread-count",
  );
}

export async function markNotificationRead(
  notificationId: number,
): Promise<void> {
  return request<void>(
    `/notifications/${notificationId}/read`,
    {
      method: "POST",
    },
  );
}

export async function markAllNotificationsRead(): Promise<void> {
  return request<void>(
    "/notifications/read-all",
    {
      method: "POST",
    },
  );
}

export async function getExecutiveReport(
  from?: string,
  to?: string,
): Promise<import("@/types/reporting").ExecutiveReport> {
  const params =
    new URLSearchParams();

  if (from) {
    params.set(
      "from",
      from,
    );
  }

  if (to) {
    params.set(
      "to",
      to,
    );
  }

  const query =
    params.toString();

  return request<
    import("@/types/reporting").ExecutiveReport
  >(
    `/reports/executive${
      query
        ? `?${query}`
        : ""
    }`,
  );
}

export async function getReportSnapshots(): Promise<
  import("@/types/reporting").ReportSnapshot[]
> {
  return request<
    import("@/types/reporting").ReportSnapshot[]
  >(
    "/reports/snapshots",
  );
}

export async function createReportSnapshot(
  input: {
    reportType:
      import("@/types/reporting").ReportType;
    periodStart?: string;
    periodEnd?: string;
    label: string;
  },
): Promise<import("@/types/reporting").ReportSnapshot> {
  return request<
    import("@/types/reporting").ReportSnapshot
  >(
    "/reports/snapshots",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function downloadReportCsv(
  type:
    import("@/types/reporting").ReportType,
  from?: string,
  to?: string,
): Promise<Blob> {
  const params =
    new URLSearchParams();

  params.set(
    "type",
    type,
  );

  if (from) {
    params.set(
      "from",
      from,
    );
  }

  if (to) {
    params.set(
      "to",
      to,
    );
  }

  const headers =
    new Headers();

  const token =
    getAccessToken();

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/reports/export?${params.toString()}`,
      {
        headers,
      },
    );

  if (!response.ok) {
    let message =
      `Report export failed with status ${response.status}`;

    try {
      const problem =
        (await response.json()) as {
          detail?: string;
          title?: string;
        };

      message =
        problem.detail ??
        problem.title ??
        message;
    } catch {
      // Preserve default message.
    }

    throw new Error(
      message,
    );
  }

  return response.blob();
}

export async function getSupplier360(
  supplierId: string,
): Promise<import("@/types/supplier-360").Supplier360> {
  return request<
    import("@/types/supplier-360").Supplier360
  >(
    `/suppliers/${supplierId}/360`,
  );
}

export async function getContracts(
  query?: string,
  status?: import("@/types/contract").ContractStatus,
  supplierId?: string,
): Promise<import("@/types/contract").SupplierContract[]> {
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

  if (supplierId) {
    params.set(
      "supplierId",
      supplierId,
    );
  }

  const queryString =
    params.toString();

  return request<
    import("@/types/contract").SupplierContract[]
  >(
    `/contracts${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function getContractSummary(): Promise<
  import("@/types/contract").ContractSummary
> {
  return request<
    import("@/types/contract").ContractSummary
  >(
    "/contracts/summary",
  );
}

export async function getContractAlerts(): Promise<
  import("@/types/contract").ContractAlert[]
> {
  return request<
    import("@/types/contract").ContractAlert[]
  >(
    "/contracts/alerts",
  );
}

export async function getContractSupplierOptions(): Promise<
  import("@/types/contract").ContractSupplierOption[]
> {
  return request<
    import("@/types/contract").ContractSupplierOption[]
  >(
    "/contracts/suppliers",
  );
}

export async function getContract(
  contractId: string,
): Promise<import("@/types/contract").SupplierContract> {
  return request<
    import("@/types/contract").SupplierContract
  >(
    `/contracts/${contractId}`,
  );
}

export async function createContract(
  input: import("@/types/contract").ContractCreateInput,
): Promise<import("@/types/contract").SupplierContract> {
  return request<
    import("@/types/contract").SupplierContract
  >(
    "/contracts",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function updateContract(
  contractId: string,
  input: import("@/types/contract").ContractUpdateInput,
): Promise<import("@/types/contract").SupplierContract> {
  return request<
    import("@/types/contract").SupplierContract
  >(
    `/contracts/${contractId}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function activateContract(
  contractId: string,
): Promise<import("@/types/contract").SupplierContract> {
  return request<
    import("@/types/contract").SupplierContract
  >(
    `/contracts/${contractId}/activate`,
    {
      method: "POST",
    },
  );
}

export async function terminateContract(
  contractId: string,
): Promise<import("@/types/contract").SupplierContract> {
  return request<
    import("@/types/contract").SupplierContract
  >(
    `/contracts/${contractId}/terminate`,
    {
      method: "POST",
    },
  );
}

export async function getSupplierCompliance(
  supplierId: string,
): Promise<import("@/types/contract").SupplierCompliance> {
  return request<
    import("@/types/contract").SupplierCompliance
  >(
    `/suppliers/${supplierId}/compliance`,
  );
}

export async function createComplianceDocument(
  supplierId: string,
  input: import("@/types/contract").ComplianceDocumentInput,
): Promise<import("@/types/contract").ComplianceDocument> {
  return request<
    import("@/types/contract").ComplianceDocument
  >(
    `/suppliers/${supplierId}/compliance-documents`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}
