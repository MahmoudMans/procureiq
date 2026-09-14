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

export async function getRiskCases(
  query?: string,
  status?: import("@/types/risk").RiskCaseStatus,
  severity?: import("@/types/risk").RiskSeverity,
  category?: import("@/types/risk").RiskCategory,
): Promise<import("@/types/risk").RiskCase[]> {
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

  if (severity) {
    params.set(
      "severity",
      severity,
    );
  }

  if (category) {
    params.set(
      "category",
      category,
    );
  }

  const queryString =
    params.toString();

  return request<
    import("@/types/risk").RiskCase[]
  >(
    `/risks${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function getRiskSummary(): Promise<
  import("@/types/risk").RiskSummary
> {
  return request<
    import("@/types/risk").RiskSummary
  >(
    "/risks/summary",
  );
}

export async function getRiskContextOptions(): Promise<
  import("@/types/risk").RiskContextOptions
> {
  return request<
    import("@/types/risk").RiskContextOptions
  >(
    "/risks/context-options",
  );
}

export async function getRiskCase(
  riskId: string,
): Promise<import("@/types/risk").RiskCase> {
  return request<
    import("@/types/risk").RiskCase
  >(
    `/risks/${riskId}`,
  );
}

export async function createRiskCase(
  input: import("@/types/risk").RiskCaseCreateInput,
): Promise<import("@/types/risk").RiskCase> {
  return request<
    import("@/types/risk").RiskCase
  >(
    "/risks",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function updateRiskCase(
  riskId: string,
  input: import("@/types/risk").RiskCaseUpdateInput,
): Promise<import("@/types/risk").RiskCase> {
  return request<
    import("@/types/risk").RiskCase
  >(
    `/risks/${riskId}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startRiskMitigation(
  riskId: string,
): Promise<import("@/types/risk").RiskCase> {
  return request<
    import("@/types/risk").RiskCase
  >(
    `/risks/${riskId}/start-mitigation`,
    {
      method: "POST",
    },
  );
}

export async function escalateRiskCase(
  riskId: string,
): Promise<import("@/types/risk").RiskCase> {
  return request<
    import("@/types/risk").RiskCase
  >(
    `/risks/${riskId}/escalate`,
    {
      method: "POST",
    },
  );
}

export async function resolveRiskCase(
  riskId: string,
  note: string,
): Promise<import("@/types/risk").RiskCase> {
  return request<
    import("@/types/risk").RiskCase
  >(
    `/risks/${riskId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function acceptRiskCase(
  riskId: string,
  note: string,
): Promise<import("@/types/risk").RiskCase> {
  return request<
    import("@/types/risk").RiskCase
  >(
    `/risks/${riskId}/accept`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function addRiskMitigationAction(
  riskId: string,
  input: import("@/types/risk").RiskMitigationActionInput,
): Promise<import("@/types/risk").RiskMitigationAction> {
  return request<
    import("@/types/risk").RiskMitigationAction
  >(
    `/risks/${riskId}/mitigation-actions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function completeRiskMitigationAction(
  actionId: string,
): Promise<import("@/types/risk").RiskMitigationAction> {
  return request<
    import("@/types/risk").RiskMitigationAction
  >(
    `/risks/mitigation-actions/${actionId}/complete`,
    {
      method: "POST",
    },
  );
}

export async function refreshSystemRiskExceptions(): Promise<
  import("@/types/risk").SystemRiskRefreshResult
> {
  return request<
    import("@/types/risk").SystemRiskRefreshResult
  >(
    "/risks/refresh-system-exceptions",
    {
      method: "POST",
    },
  );
}

export async function getBudgetAllocations(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/budget").BudgetAllocation[]> {
  const params =
    new URLSearchParams();

  if (fiscalYear) {
    params.set(
      "fiscalYear",
      String(
        fiscalYear,
      ),
    );
  }

  if (currency) {
    params.set(
      "currency",
      currency,
    );
  }

  const query =
    params.toString();

  return request<
    import("@/types/budget").BudgetAllocation[]
  >(
    `/budgets${
      query
        ? `?${query}`
        : ""
    }`,
  );
}

export async function getBudgetUsage(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/budget").BudgetUsage[]> {
  const params =
    new URLSearchParams();

  if (fiscalYear) {
    params.set(
      "fiscalYear",
      String(
        fiscalYear,
      ),
    );
  }

  if (currency) {
    params.set(
      "currency",
      currency,
    );
  }

  const query =
    params.toString();

  return request<
    import("@/types/budget").BudgetUsage[]
  >(
    `/budgets/usage${
      query
        ? `?${query}`
        : ""
    }`,
  );
}

export async function getBudgetSummary(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/budget").BudgetSummary> {
  const params =
    new URLSearchParams();

  if (fiscalYear) {
    params.set(
      "fiscalYear",
      String(
        fiscalYear,
      ),
    );
  }

  if (currency) {
    params.set(
      "currency",
      currency,
    );
  }

  const query =
    params.toString();

  return request<
    import("@/types/budget").BudgetSummary
  >(
    `/budgets/summary${
      query
        ? `?${query}`
        : ""
    }`,
  );
}

export async function getBudgetAlerts(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/budget").BudgetAlert[]> {
  const params =
    new URLSearchParams();

  if (fiscalYear) {
    params.set(
      "fiscalYear",
      String(
        fiscalYear,
      ),
    );
  }

  if (currency) {
    params.set(
      "currency",
      currency,
    );
  }

  const query =
    params.toString();

  return request<
    import("@/types/budget").BudgetAlert[]
  >(
    `/budgets/alerts${
      query
        ? `?${query}`
        : ""
    }`,
  );
}

export async function getBudgetContextOptions(): Promise<
  import("@/types/budget").BudgetContextOptions
> {
  return request<
    import("@/types/budget").BudgetContextOptions
  >(
    "/budgets/context-options",
  );
}

export async function checkPurchaseRequestBudget(
  purchaseRequestId: string,
): Promise<import("@/types/budget").PurchaseRequestBudgetCheck> {
  return request<
    import("@/types/budget").PurchaseRequestBudgetCheck
  >(
    `/budgets/check/purchase-requests/${purchaseRequestId}`,
  );
}

export async function createBudgetAllocation(
  input: import("@/types/budget").BudgetAllocationInput,
): Promise<import("@/types/budget").BudgetAllocation> {
  return request<
    import("@/types/budget").BudgetAllocation
  >(
    "/budgets",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function archiveBudgetAllocation(
  allocationId: string,
): Promise<void> {
  return request<void>(
    `/budgets/${allocationId}/archive`,
    {
      method: "POST",
    },
  );
}

function planningQuery(
  fiscalYear?: number,
  currency?: string,
): string {
  const params =
    new URLSearchParams();

  if (fiscalYear) {
    params.set(
      "fiscalYear",
      String(
        fiscalYear,
      ),
    );
  }

  if (currency) {
    params.set(
      "currency",
      currency,
    );
  }

  const query =
    params.toString();

  return query
    ? `?${query}`
    : "";
}

export async function getProcurementPlans(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/planning").ProcurementPlan[]> {
  return request<
    import("@/types/planning").ProcurementPlan[]
  >(
    `/planning/plans${planningQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getProcurementPlan(
  planId: string,
): Promise<import("@/types/planning").ProcurementPlanDetail> {
  return request<
    import("@/types/planning").ProcurementPlanDetail
  >(
    `/planning/plans/${planId}`,
  );
}

export async function createProcurementPlan(
  input: {
    name: string;
    fiscalYear: number;
    currency: string;
    ownerUserId?: string;
    notes?: string;
  },
): Promise<import("@/types/planning").ProcurementPlan> {
  return request<
    import("@/types/planning").ProcurementPlan
  >(
    "/planning/plans",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function activateProcurementPlan(
  planId: string,
): Promise<import("@/types/planning").ProcurementPlan> {
  return request<
    import("@/types/planning").ProcurementPlan
  >(
    `/planning/plans/${planId}/activate`,
    {
      method: "POST",
    },
  );
}

export async function closeProcurementPlan(
  planId: string,
): Promise<import("@/types/planning").ProcurementPlan> {
  return request<
    import("@/types/planning").ProcurementPlan
  >(
    `/planning/plans/${planId}/close`,
    {
      method: "POST",
    },
  );
}

export async function addProcurementPlanItem(
  planId: string,
  input: {
    title: string;
    description?: string;
    departmentId: string;
    category: string;
    plannedValue: number;
    targetSourcingDate: string;
    priority:
      import("@/types/planning").ProcurementPlanPriority;
    notes?: string;
  },
): Promise<import("@/types/planning").ProcurementPlanItem> {
  return request<
    import("@/types/planning").ProcurementPlanItem
  >(
    `/planning/plans/${planId}/items`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function markPlanningItemReady(
  itemId: string,
): Promise<import("@/types/planning").ProcurementPlanItem> {
  return request<
    import("@/types/planning").ProcurementPlanItem
  >(
    `/planning/items/${itemId}/ready`,
    {
      method: "POST",
    },
  );
}

export async function linkPlanningItemRequest(
  itemId: string,
  purchaseRequestId: string,
): Promise<import("@/types/planning").ProcurementPlanItem> {
  return request<
    import("@/types/planning").ProcurementPlanItem
  >(
    `/planning/items/${itemId}/link-request`,
    {
      method: "POST",
      body: JSON.stringify({
        purchaseRequestId,
      }),
    },
  );
}

export async function completePlanningItem(
  itemId: string,
): Promise<import("@/types/planning").ProcurementPlanItem> {
  return request<
    import("@/types/planning").ProcurementPlanItem
  >(
    `/planning/items/${itemId}/complete`,
    {
      method: "POST",
    },
  );
}

export async function cancelPlanningItem(
  itemId: string,
): Promise<import("@/types/planning").ProcurementPlanItem> {
  return request<
    import("@/types/planning").ProcurementPlanItem
  >(
    `/planning/items/${itemId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getPlanningSummary(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/planning").PlanningSummary> {
  return request<
    import("@/types/planning").PlanningSummary
  >(
    `/planning/summary${planningQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getPlanningMonthlyForecast(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/planning").PlanningMonthlyForecast[]> {
  return request<
    import("@/types/planning").PlanningMonthlyForecast[]
  >(
    `/planning/monthly-forecast${planningQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getPlanningCategoryVariance(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/planning").PlanningCategoryVariance[]> {
  return request<
    import("@/types/planning").PlanningCategoryVariance[]
  >(
    `/planning/category-variance${planningQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getPlanningUpcomingDemand(
  fiscalYear?: number,
  currency?: string,
): Promise<import("@/types/planning").PlanningUpcomingDemand[]> {
  return request<
    import("@/types/planning").PlanningUpcomingDemand[]
  >(
    `/planning/upcoming-demand${planningQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getPlanningContextOptions(): Promise<
  import("@/types/planning").PlanningContextOptions
> {
  return request<
    import("@/types/planning").PlanningContextOptions
  >(
    "/planning/context-options",
  );
}

function savingsQuery(
  fiscalYear?: number,
  currency?: string,
): string {
  const params =
    new URLSearchParams();

  if (fiscalYear) {
    params.set(
      "fiscalYear",
      String(
        fiscalYear,
      ),
    );
  }

  if (currency) {
    params.set(
      "currency",
      currency,
    );
  }

  const query =
    params.toString();

  return query
    ? `?${query}`
    : "";
}

export async function getSavingsInitiatives(
  fiscalYear?: number,
  currency?: string,
): Promise<
  import("@/types/savings").SavingsInitiative[]
> {
  return request<
    import("@/types/savings").SavingsInitiative[]
  >(
    `/savings${savingsQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getSavingsInitiative(
  initiativeId: string,
): Promise<
  import("@/types/savings").SavingsInitiative
> {
  return request<
    import("@/types/savings").SavingsInitiative
  >(
    `/savings/${initiativeId}`,
  );
}

export async function getSavingsSummary(
  fiscalYear?: number,
  currency?: string,
): Promise<
  import("@/types/savings").SavingsSummary
> {
  return request<
    import("@/types/savings").SavingsSummary
  >(
    `/savings/summary${savingsQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getSavingsMonthly(
  fiscalYear?: number,
  currency?: string,
): Promise<
  import("@/types/savings").SavingsMonthly[]
> {
  return request<
    import("@/types/savings").SavingsMonthly[]
  >(
    `/savings/monthly${savingsQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getSavingsSupplierAttribution(
  fiscalYear?: number,
  currency?: string,
): Promise<
  import("@/types/savings").SavingsAttribution[]
> {
  return request<
    import("@/types/savings").SavingsAttribution[]
  >(
    `/savings/supplier-attribution${savingsQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getSavingsCategoryAttribution(
  fiscalYear?: number,
  currency?: string,
): Promise<
  import("@/types/savings").SavingsAttribution[]
> {
  return request<
    import("@/types/savings").SavingsAttribution[]
  >(
    `/savings/category-attribution${savingsQuery(
      fiscalYear,
      currency,
    )}`,
  );
}

export async function getSavingsContextOptions(): Promise<
  import("@/types/savings").SavingsContextOptions
> {
  return request<
    import("@/types/savings").SavingsContextOptions
  >(
    "/savings/context-options",
  );
}

export async function createSavingsInitiative(
  input: {
    title: string;
    savingsType:
      import("@/types/savings").SavingsType;
    fiscalYear: number;
    currency: string;
    category?: string;
    baselineValue: number;
    negotiatedValue: number;
    ownerUserId?: string;
    rfqId?: string;
    supplierId?: string;
    purchaseOrderId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/savings").SavingsInitiative
> {
  return request<
    import("@/types/savings").SavingsInitiative
  >(
    "/savings",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function submitSavingsInitiative(
  initiativeId: string,
): Promise<
  import("@/types/savings").SavingsInitiative
> {
  return request<
    import("@/types/savings").SavingsInitiative
  >(
    `/savings/${initiativeId}/submit`,
    {
      method: "POST",
    },
  );
}

export async function validateSavingsInitiative(
  initiativeId: string,
  note: string,
): Promise<
  import("@/types/savings").SavingsInitiative
> {
  return request<
    import("@/types/savings").SavingsInitiative
  >(
    `/savings/${initiativeId}/validate`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSavingsInitiative(
  initiativeId: string,
  note: string,
): Promise<
  import("@/types/savings").SavingsInitiative
> {
  return request<
    import("@/types/savings").SavingsInitiative
  >(
    `/savings/${initiativeId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function closeSavingsInitiative(
  initiativeId: string,
): Promise<
  import("@/types/savings").SavingsInitiative
> {
  return request<
    import("@/types/savings").SavingsInitiative
  >(
    `/savings/${initiativeId}/close`,
    {
      method: "POST",
    },
  );
}

export async function addSavingsRealization(
  initiativeId: string,
  input: {
    amount: number;
    realizationDate: string;
    purchaseOrderId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/savings").SavingsRealization
> {
  return request<
    import("@/types/savings").SavingsRealization
  >(
    `/savings/${initiativeId}/realizations`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function discoverSavingsOpportunities(): Promise<
  import("@/types/savings").SavingsDiscoveryResult
> {
  return request<
    import("@/types/savings").SavingsDiscoveryResult
  >(
    "/savings/discover",
    {
      method: "POST",
    },
  );
}

export async function getProcurementCommandCenter(
  daysAhead = 60,
  currency = "EUR",
): Promise<
  import("@/types/command-center").CommandCenter
> {
  const params =
    new URLSearchParams({
      daysAhead:
        String(
          daysAhead,
        ),
      currency,
    });

  return request<
    import("@/types/command-center").CommandCenter
  >(
    `/command-center?${params.toString()}`,
  );
}

export async function getSupplierPerformanceReviews(): Promise<
  import("@/types/supplier-performance").SupplierPerformanceReview[]
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceReview[]
  >(
    "/supplier-performance/reviews",
  );
}

export async function getSupplierPerformanceReview(
  reviewId: string,
): Promise<
  import("@/types/supplier-performance").SupplierPerformanceReviewDetail
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceReviewDetail
  >(
    `/supplier-performance/reviews/${reviewId}`,
  );
}

export async function getSupplierPerformanceSummary(): Promise<
  import("@/types/supplier-performance").SupplierPerformanceSummary
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceSummary
  >(
    "/supplier-performance/summary",
  );
}

export async function getSupplierPerformanceContext(): Promise<
  import("@/types/supplier-performance").SupplierPerformanceContext
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceContext
  >(
    "/supplier-performance/context-options",
  );
}

export async function getSupplierPerformanceHistory(
  supplierId: string,
): Promise<
  import("@/types/supplier-performance").SupplierPerformanceTrend[]
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceTrend[]
  >(
    `/supplier-performance/suppliers/${supplierId}/history`,
  );
}

export async function createSupplierPerformanceReview(
  input: {
    supplierId: string;
    periodStart: string;
    periodEnd: string;
    qualityScore: number;
    deliveryScore: number;
    commercialScore: number;
    serviceScore: number;
    complianceScore: number;
    ownerUserId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/supplier-performance").SupplierPerformanceReview
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceReview
  >(
    "/supplier-performance/reviews",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function submitSupplierPerformanceReview(
  reviewId: string,
): Promise<
  import("@/types/supplier-performance").SupplierPerformanceReview
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceReview
  >(
    `/supplier-performance/reviews/${reviewId}/submit`,
    {
      method: "POST",
    },
  );
}

export async function approveSupplierPerformanceReview(
  reviewId: string,
  note: string,
): Promise<
  import("@/types/supplier-performance").SupplierPerformanceReview
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceReview
  >(
    `/supplier-performance/reviews/${reviewId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSupplierPerformanceReview(
  reviewId: string,
  note: string,
): Promise<
  import("@/types/supplier-performance").SupplierPerformanceReview
> {
  return request<
    import("@/types/supplier-performance").SupplierPerformanceReview
  >(
    `/supplier-performance/reviews/${reviewId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function createSupplierCorrectiveAction(
  reviewId: string,
  input: {
    title: string;
    description?: string;
    ownerUserId?: string;
    dueDate: string;
  },
): Promise<
  import("@/types/supplier-performance").CorrectiveAction
> {
  return request<
    import("@/types/supplier-performance").CorrectiveAction
  >(
    `/supplier-performance/reviews/${reviewId}/corrective-actions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startSupplierCorrectiveAction(
  actionId: string,
): Promise<
  import("@/types/supplier-performance").CorrectiveAction
> {
  return request<
    import("@/types/supplier-performance").CorrectiveAction
  >(
    `/supplier-performance/corrective-actions/${actionId}/start`,
    {
      method: "POST",
    },
  );
}

export async function completeSupplierCorrectiveAction(
  actionId: string,
  note: string,
): Promise<
  import("@/types/supplier-performance").CorrectiveAction
> {
  return request<
    import("@/types/supplier-performance").CorrectiveAction
  >(
    `/supplier-performance/corrective-actions/${actionId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelSupplierCorrectiveAction(
  actionId: string,
): Promise<
  import("@/types/supplier-performance").CorrectiveAction
> {
  return request<
    import("@/types/supplier-performance").CorrectiveAction
  >(
    `/supplier-performance/corrective-actions/${actionId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getCompliancePolicies(): Promise<
  import("@/types/policy-compliance").ProcurementPolicy[]
> {
  return request<
    import("@/types/policy-compliance").ProcurementPolicy[]
  >(
    "/compliance/policies",
  );
}

export async function createCompliancePolicy(
  input: {
    policyCode: string;
    name: string;
    description?: string;
    policyType:
      import("@/types/policy-compliance").ProcurementPolicyType;
    severity:
      import("@/types/policy-compliance").ProcurementPolicySeverity;
    thresholdAmount?: number;
    currency?: string;
    requiresWaiver: boolean;
    ownerUserId?: string;
  },
): Promise<
  import("@/types/policy-compliance").ProcurementPolicy
> {
  return request<
    import("@/types/policy-compliance").ProcurementPolicy
  >(
    "/compliance/policies",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function activateCompliancePolicy(
  policyId: string,
): Promise<
  import("@/types/policy-compliance").ProcurementPolicy
> {
  return request<
    import("@/types/policy-compliance").ProcurementPolicy
  >(
    `/compliance/policies/${policyId}/activate`,
    {
      method: "POST",
    },
  );
}

export async function deactivateCompliancePolicy(
  policyId: string,
): Promise<
  import("@/types/policy-compliance").ProcurementPolicy
> {
  return request<
    import("@/types/policy-compliance").ProcurementPolicy
  >(
    `/compliance/policies/${policyId}/deactivate`,
    {
      method: "POST",
    },
  );
}

export async function evaluateCompliancePolicies(): Promise<
  import("@/types/policy-compliance").PolicyEvaluation
> {
  return request<
    import("@/types/policy-compliance").PolicyEvaluation
  >(
    "/compliance/evaluate",
    {
      method: "POST",
    },
  );
}

export async function getPolicyViolations(): Promise<
  import("@/types/policy-compliance").PolicyViolation[]
> {
  return request<
    import("@/types/policy-compliance").PolicyViolation[]
  >(
    "/compliance/violations",
  );
}

export async function getPolicyViolation(
  violationId: string,
): Promise<
  import("@/types/policy-compliance").PolicyViolationDetail
> {
  return request<
    import("@/types/policy-compliance").PolicyViolationDetail
  >(
    `/compliance/violations/${violationId}`,
  );
}

export async function requestPolicyWaiver(
  violationId: string,
  rationale: string,
): Promise<
  import("@/types/policy-compliance").PolicyWaiver
> {
  return request<
    import("@/types/policy-compliance").PolicyWaiver
  >(
    `/compliance/violations/${violationId}/waivers`,
    {
      method: "POST",
      body: JSON.stringify({
        rationale,
      }),
    },
  );
}

export async function approvePolicyWaiver(
  waiverId: string,
  note: string,
): Promise<
  import("@/types/policy-compliance").PolicyWaiver
> {
  return request<
    import("@/types/policy-compliance").PolicyWaiver
  >(
    `/compliance/waivers/${waiverId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectPolicyWaiver(
  waiverId: string,
  note: string,
): Promise<
  import("@/types/policy-compliance").PolicyWaiver
> {
  return request<
    import("@/types/policy-compliance").PolicyWaiver
  >(
    `/compliance/waivers/${waiverId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function addPolicyEvidence(
  violationId: string,
  input: {
    evidenceType:
      import("@/types/policy-compliance").PolicyEvidenceType;
    content: string;
  },
): Promise<
  import("@/types/policy-compliance").PolicyEvidence
> {
  return request<
    import("@/types/policy-compliance").PolicyEvidence
  >(
    `/compliance/violations/${violationId}/evidence`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function resolvePolicyViolation(
  violationId: string,
  note: string,
): Promise<
  import("@/types/policy-compliance").PolicyViolation
> {
  return request<
    import("@/types/policy-compliance").PolicyViolation
  >(
    `/compliance/violations/${violationId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getPolicyComplianceSummary(): Promise<
  import("@/types/policy-compliance").PolicyComplianceSummary
> {
  return request<
    import("@/types/policy-compliance").PolicyComplianceSummary
  >(
    "/compliance/summary",
  );
}

export async function getPolicyComplianceContext(): Promise<
  import("@/types/policy-compliance").PolicyComplianceContext
> {
  return request<
    import("@/types/policy-compliance").PolicyComplianceContext
  >(
    "/compliance/context-options",
  );
}

export async function getGuidedBuyingIntakes(): Promise<
  import("@/types/guided-buying").GuidedBuyingIntake[]
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingIntake[]
  >(
    "/guided-buying/intakes",
  );
}

export async function getGuidedBuyingIntake(
  intakeId: string,
): Promise<
  import("@/types/guided-buying").GuidedBuyingIntake
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingIntake
  >(
    `/guided-buying/intakes/${intakeId}`,
  );
}

export async function createGuidedBuyingIntake(
  input: {
    title: string;
    description?: string;
    departmentId: string;
    category: string;
    currency: string;
    estimatedAmount: number;
    supplierId?: string;
    templateId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/guided-buying").GuidedBuyingIntake
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingIntake
  >(
    "/guided-buying/intakes",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function recommendGuidedBuying(
  input: {
    title: string;
    description?: string;
    departmentId: string;
    category: string;
    currency: string;
    estimatedAmount: number;
    supplierId?: string;
    templateId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/guided-buying").GuidedBuyingRecommendation
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingRecommendation
  >(
    "/guided-buying/recommend",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function refreshGuidedBuyingRecommendation(
  intakeId: string,
): Promise<
  import("@/types/guided-buying").GuidedBuyingIntake
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingIntake
  >(
    `/guided-buying/intakes/${intakeId}/refresh-guidance`,
    {
      method: "POST",
    },
  );
}

export async function markGuidedBuyingReady(
  intakeId: string,
): Promise<
  import("@/types/guided-buying").GuidedBuyingIntake
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingIntake
  >(
    `/guided-buying/intakes/${intakeId}/ready`,
    {
      method: "POST",
    },
  );
}

export async function linkGuidedBuyingRequest(
  intakeId: string,
  purchaseRequestId: string,
): Promise<
  import("@/types/guided-buying").GuidedBuyingIntake
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingIntake
  >(
    `/guided-buying/intakes/${intakeId}/link-request`,
    {
      method: "POST",
      body: JSON.stringify({
        purchaseRequestId,
      }),
    },
  );
}

export async function cancelGuidedBuyingIntake(
  intakeId: string,
): Promise<
  import("@/types/guided-buying").GuidedBuyingIntake
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingIntake
  >(
    `/guided-buying/intakes/${intakeId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getGuidedBuyingTemplates(): Promise<
  import("@/types/guided-buying").GuidedBuyingTemplate[]
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingTemplate[]
  >(
    "/guided-buying/templates",
  );
}

export async function createGuidedBuyingTemplate(
  input: {
    name: string;
    description?: string;
    category: string;
    defaultTitle?: string;
    defaultCurrency: string;
    defaultEstimatedAmount?: number;
    defaultDepartmentId?: string;
    ownerUserId?: string;
  },
): Promise<
  import("@/types/guided-buying").GuidedBuyingTemplate
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingTemplate
  >(
    "/guided-buying/templates",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function activateGuidedBuyingTemplate(
  templateId: string,
): Promise<
  import("@/types/guided-buying").GuidedBuyingTemplate
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingTemplate
  >(
    `/guided-buying/templates/${templateId}/activate`,
    {
      method: "POST",
    },
  );
}

export async function deactivateGuidedBuyingTemplate(
  templateId: string,
): Promise<
  import("@/types/guided-buying").GuidedBuyingTemplate
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingTemplate
  >(
    `/guided-buying/templates/${templateId}/deactivate`,
    {
      method: "POST",
    },
  );
}

export async function getPreferredSuppliers(): Promise<
  import("@/types/guided-buying").PreferredSupplier[]
> {
  return request<
    import("@/types/guided-buying").PreferredSupplier[]
  >(
    "/guided-buying/preferred-suppliers",
  );
}

export async function createPreferredSupplier(
  input: {
    category: string;
    supplierId: string;
    preferenceRank: number;
    notes?: string;
  },
): Promise<
  import("@/types/guided-buying").PreferredSupplier
> {
  return request<
    import("@/types/guided-buying").PreferredSupplier
  >(
    "/guided-buying/preferred-suppliers",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function deactivatePreferredSupplier(
  preferredSupplierId: string,
): Promise<
  import("@/types/guided-buying").PreferredSupplier
> {
  return request<
    import("@/types/guided-buying").PreferredSupplier
  >(
    `/guided-buying/preferred-suppliers/${preferredSupplierId}/deactivate`,
    {
      method: "POST",
    },
  );
}

export async function getGuidedBuyingSummary(): Promise<
  import("@/types/guided-buying").GuidedBuyingSummary
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingSummary
  >(
    "/guided-buying/summary",
  );
}

export async function getGuidedBuyingContext(): Promise<
  import("@/types/guided-buying").GuidedBuyingContext
> {
  return request<
    import("@/types/guided-buying").GuidedBuyingContext
  >(
    "/guided-buying/context-options",
  );
}

export async function getDemandConsolidationCandidates(): Promise<
  import("@/types/demand-consolidation").DemandConsolidationCandidate[]
> {
  return request<
    import("@/types/demand-consolidation").DemandConsolidationCandidate[]
  >(
    "/demand-consolidation/candidates",
  );
}

export async function getDemandConsolidationBundles(): Promise<
  import("@/types/demand-consolidation").DemandBundle[]
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle[]
  >(
    "/demand-consolidation/bundles",
  );
}

export async function getDemandConsolidationBundle(
  bundleId: string,
): Promise<
  import("@/types/demand-consolidation").DemandBundle
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle
  >(
    `/demand-consolidation/bundles/${bundleId}`,
  );
}

export async function createDemandConsolidationBundle(
  input: {
    title: string;
    category: string;
    currency: string;
    intakeIds: string[];
    ownerUserId?: string;
    targetSourcingDate: string;
    rationale?: string;
  },
): Promise<
  import("@/types/demand-consolidation").DemandBundle
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle
  >(
    "/demand-consolidation/bundles",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function submitDemandConsolidationBundle(
  bundleId: string,
): Promise<
  import("@/types/demand-consolidation").DemandBundle
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle
  >(
    `/demand-consolidation/bundles/${bundleId}/submit`,
    {
      method: "POST",
    },
  );
}

export async function approveDemandConsolidationBundle(
  bundleId: string,
  note: string,
): Promise<
  import("@/types/demand-consolidation").DemandBundle
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle
  >(
    `/demand-consolidation/bundles/${bundleId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelDemandConsolidationBundle(
  bundleId: string,
  note: string,
): Promise<
  import("@/types/demand-consolidation").DemandBundle
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle
  >(
    `/demand-consolidation/bundles/${bundleId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function linkDemandConsolidationRfq(
  bundleId: string,
  rfqId: string,
): Promise<
  import("@/types/demand-consolidation").DemandBundle
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle
  >(
    `/demand-consolidation/bundles/${bundleId}/link-rfq`,
    {
      method: "POST",
      body: JSON.stringify({
        rfqId,
      }),
    },
  );
}

export async function closeDemandConsolidationBundle(
  bundleId: string,
): Promise<
  import("@/types/demand-consolidation").DemandBundle
> {
  return request<
    import("@/types/demand-consolidation").DemandBundle
  >(
    `/demand-consolidation/bundles/${bundleId}/close`,
    {
      method: "POST",
    },
  );
}

export async function getDemandConsolidationSummary(): Promise<
  import("@/types/demand-consolidation").DemandConsolidationSummary
> {
  return request<
    import("@/types/demand-consolidation").DemandConsolidationSummary
  >(
    "/demand-consolidation/summary",
  );
}

export async function getDemandConsolidationContext(): Promise<
  import("@/types/demand-consolidation").DemandConsolidationContext
> {
  return request<
    import("@/types/demand-consolidation").DemandConsolidationContext
  >(
    "/demand-consolidation/context-options",
  );
}

export async function getNegotiationWorkspaces(): Promise<
  import("@/types/negotiation").NegotiationWorkspace[]
> {
  return request<
    import("@/types/negotiation").NegotiationWorkspace[]
  >(
    "/negotiations",
  );
}

export async function getNegotiationWorkspace(
  workspaceId: string,
): Promise<
  import("@/types/negotiation").NegotiationWorkspace
> {
  return request<
    import("@/types/negotiation").NegotiationWorkspace
  >(
    `/negotiations/${workspaceId}`,
  );
}

export async function createNegotiationWorkspace(
  input: {
    baselineQuotationId: string;
    ownerUserId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/negotiation").NegotiationWorkspace
> {
  return request<
    import("@/types/negotiation").NegotiationWorkspace
  >(
    "/negotiations",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function activateNegotiationWorkspace(
  workspaceId: string,
): Promise<
  import("@/types/negotiation").NegotiationWorkspace
> {
  return request<
    import("@/types/negotiation").NegotiationWorkspace
  >(
    `/negotiations/${workspaceId}/activate`,
    {
      method: "POST",
    },
  );
}

export async function addNegotiationScenario(
  workspaceId: string,
  input: {
    name: string;
    scenarioType:
      import("@/types/negotiation").NegotiationScenarioType;
    totalValue: number;
    paymentTermsDays: number;
    leadTimeDays: number;
    warrantyMonths: number;
    volumeCommitment?: number;
    preferred: boolean;
    notes?: string;
  },
): Promise<
  import("@/types/negotiation").NegotiationScenario
> {
  return request<
    import("@/types/negotiation").NegotiationScenario
  >(
    `/negotiations/${workspaceId}/scenarios`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function addNegotiationRound(
  workspaceId: string,
  input: {
    actorSide:
      import("@/types/negotiation").NegotiationRoundSide;
    offerValue: number;
    paymentTermsDays: number;
    leadTimeDays: number;
    warrantyMonths: number;
    volumeCommitment?: number;
    notes?: string;
  },
): Promise<
  import("@/types/negotiation").NegotiationRound
> {
  return request<
    import("@/types/negotiation").NegotiationRound
  >(
    `/negotiations/${workspaceId}/rounds`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function agreeNegotiationScenario(
  workspaceId: string,
  scenarioId: string,
): Promise<
  import("@/types/negotiation").NegotiationWorkspace
> {
  return request<
    import("@/types/negotiation").NegotiationWorkspace
  >(
    `/negotiations/${workspaceId}/agree/${scenarioId}`,
    {
      method: "POST",
    },
  );
}

export async function closeNegotiationWorkspace(
  workspaceId: string,
): Promise<
  import("@/types/negotiation").NegotiationWorkspace
> {
  return request<
    import("@/types/negotiation").NegotiationWorkspace
  >(
    `/negotiations/${workspaceId}/close`,
    {
      method: "POST",
    },
  );
}

export async function cancelNegotiationWorkspace(
  workspaceId: string,
): Promise<
  import("@/types/negotiation").NegotiationWorkspace
> {
  return request<
    import("@/types/negotiation").NegotiationWorkspace
  >(
    `/negotiations/${workspaceId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getNegotiationSummary(): Promise<
  import("@/types/negotiation").NegotiationSummary
> {
  return request<
    import("@/types/negotiation").NegotiationSummary
  >(
    "/negotiations/summary",
  );
}

export async function getNegotiationContext(): Promise<
  import("@/types/negotiation").NegotiationContext
> {
  return request<
    import("@/types/negotiation").NegotiationContext
  >(
    "/negotiations/context-options",
  );
}

export async function getSupplierResilienceIntelligence(
  currency = "EUR",
): Promise<
  import("@/types/supplier-resilience").SupplierResilienceIntelligence[]
> {
  return request<
    import("@/types/supplier-resilience").SupplierResilienceIntelligence[]
  >(
    `/supplier-resilience?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getSupplierResilienceSummary(
  currency = "EUR",
): Promise<
  import("@/types/supplier-resilience").SupplierResilienceSummary
> {
  return request<
    import("@/types/supplier-resilience").SupplierResilienceSummary
  >(
    `/supplier-resilience/summary?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getSupplierCountryConcentrations(
  currency = "EUR",
): Promise<
  import("@/types/supplier-resilience").SupplierCountryConcentration[]
> {
  return request<
    import("@/types/supplier-resilience").SupplierCountryConcentration[]
  >(
    `/supplier-resilience/countries?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getSupplierResilienceDetail(
  supplierId: string,
  currency = "EUR",
): Promise<
  import("@/types/supplier-resilience").SupplierResilienceDetail
> {
  return request<
    import("@/types/supplier-resilience").SupplierResilienceDetail
  >(
    `/supplier-resilience/suppliers/${supplierId}?currency=${encodeURIComponent(currency)}`,
  );
}

export async function upsertSupplierResilienceProfile(
  supplierId: string,
  currency: string,
  input: {
    criticality:
      import("@/types/supplier-resilience").SupplierCriticality;
    capacityStatus:
      import("@/types/supplier-resilience").SupplierCapacityStatus;
    dependencyTolerancePct: number;
    minimumAlternates: number;
    ownerUserId?: string;
    businessImpact?: string;
    capacityNotes?: string;
    notes?: string;
  },
): Promise<
  import("@/types/supplier-resilience").SupplierResilienceDetail
> {
  return request<
    import("@/types/supplier-resilience").SupplierResilienceDetail
  >(
    `/supplier-resilience/suppliers/${supplierId}/profile?currency=${encodeURIComponent(currency)}`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function deactivateSupplierResilienceProfile(
  supplierId: string,
  currency: string,
): Promise<
  import("@/types/supplier-resilience").SupplierResilienceDetail
> {
  return request<
    import("@/types/supplier-resilience").SupplierResilienceDetail
  >(
    `/supplier-resilience/suppliers/${supplierId}/profile/deactivate?currency=${encodeURIComponent(currency)}`,
    {
      method: "POST",
    },
  );
}

export async function createSupplierResilienceAction(
  supplierId: string,
  input: {
    actionType:
      import("@/types/supplier-resilience").ResilienceActionType;
    title: string;
    description?: string;
    ownerUserId?: string;
    dueDate: string;
  },
): Promise<
  import("@/types/supplier-resilience").ResilienceAction
> {
  return request<
    import("@/types/supplier-resilience").ResilienceAction
  >(
    `/supplier-resilience/suppliers/${supplierId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startSupplierResilienceAction(
  actionId: string,
): Promise<
  import("@/types/supplier-resilience").ResilienceAction
> {
  return request<
    import("@/types/supplier-resilience").ResilienceAction
  >(
    `/supplier-resilience/actions/${actionId}/start`,
    {
      method: "POST",
    },
  );
}

export async function completeSupplierResilienceAction(
  actionId: string,
  note: string,
): Promise<
  import("@/types/supplier-resilience").ResilienceAction
> {
  return request<
    import("@/types/supplier-resilience").ResilienceAction
  >(
    `/supplier-resilience/actions/${actionId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelSupplierResilienceAction(
  actionId: string,
): Promise<
  import("@/types/supplier-resilience").ResilienceAction
> {
  return request<
    import("@/types/supplier-resilience").ResilienceAction
  >(
    `/supplier-resilience/actions/${actionId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getSupplierResilienceContext(): Promise<
  import("@/types/supplier-resilience").SupplierResilienceContext
> {
  return request<
    import("@/types/supplier-resilience").SupplierResilienceContext
  >(
    "/supplier-resilience/context-options",
  );
}

export async function getCommercialGovernanceRecords(
  currency = "EUR",
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceRecord[]
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceRecord[]
  >(
    `/commercial-governance?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getCommercialGovernanceDetail(
  governanceId: string,
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceDetail
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceDetail
  >(
    `/commercial-governance/${governanceId}`,
  );
}

export async function createCommercialGovernance(
  input: {
    contractId: string;
    noticePeriodDays: number;
    baselineContractValue: number;
    currency: string;
    priceEscalationPct: number;
    maxPoVariancePct: number;
    autoRenewal: boolean;
    ownerUserId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceDetail
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceDetail
  >(
    "/commercial-governance",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startContractRenewalReview(
  governanceId: string,
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceRecord
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceRecord
  >(
    `/commercial-governance/${governanceId}/renewal/start`,
    {
      method: "POST",
    },
  );
}

export async function decideContractRenewal(
  governanceId: string,
  decision:
    import("@/types/commercial-governance").ContractRenewalDecision,
  note: string,
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceRecord
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceRecord
  >(
    `/commercial-governance/${governanceId}/renewal/decision`,
    {
      method: "POST",
      body: JSON.stringify({
        decision,
        note,
      }),
    },
  );
}

export async function completeContractRenewal(
  governanceId: string,
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceRecord
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceRecord
  >(
    `/commercial-governance/${governanceId}/renewal/complete`,
    {
      method: "POST",
    },
  );
}

export async function deactivateCommercialGovernance(
  governanceId: string,
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceRecord
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceRecord
  >(
    `/commercial-governance/${governanceId}/deactivate`,
    {
      method: "POST",
    },
  );
}

export async function createContractObligation(
  governanceId: string,
  input: {
    obligationType:
      import("@/types/commercial-governance").ContractObligationType;
    title: string;
    description?: string;
    dueDate: string;
    critical: boolean;
    ownerUserId?: string;
  },
): Promise<
  import("@/types/commercial-governance").ContractObligation
> {
  return request<
    import("@/types/commercial-governance").ContractObligation
  >(
    `/commercial-governance/${governanceId}/obligations`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function completeContractObligation(
  obligationId: string,
  note: string,
): Promise<
  import("@/types/commercial-governance").ContractObligation
> {
  return request<
    import("@/types/commercial-governance").ContractObligation
  >(
    `/commercial-governance/obligations/${obligationId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function waiveContractObligation(
  obligationId: string,
  note: string,
): Promise<
  import("@/types/commercial-governance").ContractObligation
> {
  return request<
    import("@/types/commercial-governance").ContractObligation
  >(
    `/commercial-governance/obligations/${obligationId}/waive`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function discoverCommercialLeakage(
  currency = "EUR",
): Promise<
  import("@/types/commercial-governance").CommercialLeakageDiscovery
> {
  return request<
    import("@/types/commercial-governance").CommercialLeakageDiscovery
  >(
    `/commercial-governance/leakage/discover?currency=${encodeURIComponent(currency)}`,
    {
      method: "POST",
    },
  );
}

export async function getCommercialLeakageFindings(
  currency = "EUR",
): Promise<
  import("@/types/commercial-governance").CommercialLeakageFinding[]
> {
  return request<
    import("@/types/commercial-governance").CommercialLeakageFinding[]
  >(
    `/commercial-governance/leakage/findings?currency=${encodeURIComponent(currency)}`,
  );
}

export async function resolveCommercialLeakage(
  findingId: string,
  note: string,
): Promise<
  import("@/types/commercial-governance").CommercialLeakageFinding
> {
  return request<
    import("@/types/commercial-governance").CommercialLeakageFinding
  >(
    `/commercial-governance/leakage/${findingId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function dismissCommercialLeakage(
  findingId: string,
  note: string,
): Promise<
  import("@/types/commercial-governance").CommercialLeakageFinding
> {
  return request<
    import("@/types/commercial-governance").CommercialLeakageFinding
  >(
    `/commercial-governance/leakage/${findingId}/dismiss`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getCommercialGovernanceSummary(
  currency = "EUR",
): Promise<
  import("@/types/commercial-governance").CommercialGovernanceSummary
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceSummary
  >(
    `/commercial-governance/summary?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getCommercialGovernanceContext(): Promise<
  import("@/types/commercial-governance").CommercialGovernanceContext
> {
  return request<
    import("@/types/commercial-governance").CommercialGovernanceContext
  >(
    "/commercial-governance/context-options",
  );
}

export async function getProcurementInvoices(
  currency = "EUR",
): Promise<
  import("@/types/invoice-control").ProcurementInvoice[]
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice[]
  >(
    `/invoices?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getProcurementInvoice(
  invoiceId: string,
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    `/invoices/${invoiceId}`,
  );
}

export async function createProcurementInvoice(
  input: {
    purchaseOrderId: string;
    supplierInvoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    taxAmount: number;
    poVarianceTolerancePct: number;
    notes?: string;
    lines: Array<{
      lineNumber: number;
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  },
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    "/invoices",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function runInvoiceMatch(
  invoiceId: string,
): Promise<
  import("@/types/invoice-control").InvoiceMatchResult
> {
  return request<
    import("@/types/invoice-control").InvoiceMatchResult
  >(
    `/invoices/${invoiceId}/match`,
    {
      method: "POST",
    },
  );
}

export async function resolveInvoiceException(
  exceptionId: string,
  note: string,
): Promise<
  import("@/types/invoice-control").InvoiceMatchException
> {
  return request<
    import("@/types/invoice-control").InvoiceMatchException
  >(
    `/invoices/exceptions/${exceptionId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function dismissInvoiceException(
  exceptionId: string,
  note: string,
): Promise<
  import("@/types/invoice-control").InvoiceMatchException
> {
  return request<
    import("@/types/invoice-control").InvoiceMatchException
  >(
    `/invoices/exceptions/${exceptionId}/dismiss`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function approveProcurementInvoice(
  invoiceId: string,
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    `/invoices/${invoiceId}/approve`,
    {
      method: "POST",
    },
  );
}

export async function holdProcurementInvoice(
  invoiceId: string,
  note: string,
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    `/invoices/${invoiceId}/hold`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function releaseProcurementInvoiceHold(
  invoiceId: string,
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    `/invoices/${invoiceId}/release-hold`,
    {
      method: "POST",
    },
  );
}

export async function markProcurementInvoiceReady(
  invoiceId: string,
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    `/invoices/${invoiceId}/ready-for-payment`,
    {
      method: "POST",
    },
  );
}

export async function markProcurementInvoicePaid(
  invoiceId: string,
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    `/invoices/${invoiceId}/paid`,
    {
      method: "POST",
    },
  );
}

export async function cancelProcurementInvoice(
  invoiceId: string,
  note: string,
): Promise<
  import("@/types/invoice-control").ProcurementInvoice
> {
  return request<
    import("@/types/invoice-control").ProcurementInvoice
  >(
    `/invoices/${invoiceId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getInvoiceSummary(
  currency = "EUR",
): Promise<
  import("@/types/invoice-control").InvoiceSummary
> {
  return request<
    import("@/types/invoice-control").InvoiceSummary
  >(
    `/invoices/summary?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getInvoiceContext(): Promise<
  import("@/types/invoice-control").InvoiceContext
> {
  return request<
    import("@/types/invoice-control").InvoiceContext
  >(
    "/invoices/context-options",
  );
}
