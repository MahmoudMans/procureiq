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

export async function getProcessMiningDashboard(): Promise<
  import("@/types/process-mining").ProcessMiningDashboard
> {
  return request<
    import("@/types/process-mining").ProcessMiningDashboard
  >(
    "/process-mining",
  );
}

export async function getProcessStageTargets(): Promise<
  import("@/types/process-mining").ProcessStageTarget[]
> {
  return request<
    import("@/types/process-mining").ProcessStageTarget[]
  >(
    "/process-mining/targets",
  );
}

export async function upsertProcessStageTarget(
  input: {
    entityType:
      import("@/types/process-mining").ProcessEntityType;
    status: string;
    targetHours: number;
  },
): Promise<
  import("@/types/process-mining").ProcessStageTarget
> {
  return request<
    import("@/types/process-mining").ProcessStageTarget
  >(
    "/process-mining/targets",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getExecutiveCockpit(
  currency = "EUR",
): Promise<
  import("@/types/executive-cockpit").ExecutiveCockpit
> {
  return request<
    import("@/types/executive-cockpit").ExecutiveCockpit
  >(
    `/executive-cockpit?currency=${encodeURIComponent(currency)}`,
  );
}

export async function acknowledgeExecutiveWarning(
  warningKey: string,
  currency: string,
  note: string,
): Promise<
  import("@/types/executive-cockpit").ExecutiveWarning
> {
  return request<
    import("@/types/executive-cockpit").ExecutiveWarning
  >(
    `/executive-cockpit/warnings/${encodeURIComponent(warningKey)}/acknowledge?currency=${encodeURIComponent(currency)}`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function unacknowledgeExecutiveWarning(
  warningKey: string,
): Promise<void> {
  return request<void>(
    `/executive-cockpit/warnings/${encodeURIComponent(warningKey)}/acknowledge`,
    {
      method: "DELETE",
    },
  );
}

export async function updateExecutiveWarningRule(
  ruleId: number,
  input: {
    enabled: boolean;
    thresholdValue: number;
    lookaheadDays: number;
    defaultSeverity:
      import("@/types/executive-cockpit").ExecutiveWarningSeverity;
  },
): Promise<
  import("@/types/executive-cockpit").ExecutiveRule
> {
  return request<
    import("@/types/executive-cockpit").ExecutiveRule
  >(
    `/executive-cockpit/rules/${ruleId}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getDataQualityDashboard(): Promise<
  import("@/types/data-quality").DataQualityDashboard
> {
  return request<
    import("@/types/data-quality").DataQualityDashboard
  >(
    "/data-quality",
  );
}

export async function runDataQualityScan(): Promise<
  import("@/types/data-quality").DataQualityScan
> {
  return request<
    import("@/types/data-quality").DataQualityScan
  >(
    "/data-quality/scan",
    {
      method: "POST",
    },
  );
}

export async function getDataQualityFinding(
  findingId: string,
): Promise<
  import("@/types/data-quality").DataQualityFindingDetail
> {
  return request<
    import("@/types/data-quality").DataQualityFindingDetail
  >(
    `/data-quality/findings/${findingId}`,
  );
}

export async function resolveDataQualityFinding(
  findingId: string,
  note: string,
): Promise<
  import("@/types/data-quality").DataQualityFinding
> {
  return request<
    import("@/types/data-quality").DataQualityFinding
  >(
    `/data-quality/findings/${findingId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function dismissDataQualityFinding(
  findingId: string,
  note: string,
): Promise<
  import("@/types/data-quality").DataQualityFinding
> {
  return request<
    import("@/types/data-quality").DataQualityFinding
  >(
    `/data-quality/findings/${findingId}/dismiss`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function createDataQualityRemediation(
  findingId: string,
  input: {
    title: string;
    ownerUserId?: string;
    dueDate: string;
  },
): Promise<
  import("@/types/data-quality").DataQualityRemediation
> {
  return request<
    import("@/types/data-quality").DataQualityRemediation
  >(
    `/data-quality/findings/${findingId}/remediations`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startDataQualityRemediation(
  taskId: string,
): Promise<
  import("@/types/data-quality").DataQualityRemediation
> {
  return request<
    import("@/types/data-quality").DataQualityRemediation
  >(
    `/data-quality/remediations/${taskId}/start`,
    {
      method: "POST",
    },
  );
}

export async function completeDataQualityRemediation(
  taskId: string,
  note: string,
): Promise<
  import("@/types/data-quality").DataQualityRemediation
> {
  return request<
    import("@/types/data-quality").DataQualityRemediation
  >(
    `/data-quality/remediations/${taskId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelDataQualityRemediation(
  taskId: string,
): Promise<
  import("@/types/data-quality").DataQualityRemediation
> {
  return request<
    import("@/types/data-quality").DataQualityRemediation
  >(
    `/data-quality/remediations/${taskId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function updateDataQualityRule(
  ruleId: number,
  input: {
    enabled: boolean;
    severity:
      import("@/types/data-quality").DataQualitySeverity;
    weight: number;
  },
): Promise<
  import("@/types/data-quality").DataQualityRule
> {
  return request<
    import("@/types/data-quality").DataQualityRule
  >(
    `/data-quality/rules/${ruleId}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getDataQualityContext(): Promise<
  import("@/types/data-quality").DataQualityContext
> {
  return request<
    import("@/types/data-quality").DataQualityContext
  >(
    "/data-quality/context-options",
  );
}

export async function getSupplierOnboardingCases(): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase[]
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase[]
  >(
    "/supplier-onboarding",
  );
}

export async function getSupplierOnboardingCase(
  caseId: string,
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    `/supplier-onboarding/cases/${caseId}`,
  );
}

export async function getSupplierOnboardingSummary(): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingSummary
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingSummary
  >(
    "/supplier-onboarding/summary",
  );
}

export async function getSupplierOnboardingContext(): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingContext
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingContext
  >(
    "/supplier-onboarding/context-options",
  );
}

export async function createSupplierOnboardingCase(
  input: {
    supplierId: string;
    caseType:
      import("@/types/supplier-onboarding").SupplierOnboardingCaseType;
    riskTier:
      import("@/types/supplier-onboarding").SupplierOnboardingRiskTier;
    ownerUserId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    "/supplier-onboarding/cases",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function answerSupplierQualificationQuestion(
  caseId: string,
  questionCode: string,
  input: {
    answerValue: string;
    complianceStatus:
      import("@/types/supplier-onboarding").QualificationComplianceStatus;
  },
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    `/supplier-onboarding/cases/${caseId}/questions/${encodeURIComponent(questionCode)}`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function uploadSupplierOnboardingEvidence(
  caseId: string,
  evidenceType:
    import("@/types/supplier-onboarding").OnboardingEvidenceType,
  input: {
    documentReference: string;
    expiryDate?: string;
  },
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    `/supplier-onboarding/cases/${caseId}/evidence/${evidenceType}`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function validateSupplierOnboardingEvidence(
  evidenceId: string,
  note: string,
): Promise<
  import("@/types/supplier-onboarding").OnboardingEvidence
> {
  return request<
    import("@/types/supplier-onboarding").OnboardingEvidence
  >(
    `/supplier-onboarding/evidence/${evidenceId}/validate`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSupplierOnboardingEvidence(
  evidenceId: string,
  note: string,
): Promise<
  import("@/types/supplier-onboarding").OnboardingEvidence
> {
  return request<
    import("@/types/supplier-onboarding").OnboardingEvidence
  >(
    `/supplier-onboarding/evidence/${evidenceId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function submitSupplierOnboardingCase(
  caseId: string,
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    `/supplier-onboarding/cases/${caseId}/submit`,
    {
      method: "POST",
    },
  );
}

export async function approveSupplierOnboarding(
  approvalId: string,
  note: string,
): Promise<
  import("@/types/supplier-onboarding").OnboardingApproval
> {
  return request<
    import("@/types/supplier-onboarding").OnboardingApproval
  >(
    `/supplier-onboarding/approvals/${approvalId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSupplierOnboardingApproval(
  approvalId: string,
  note: string,
): Promise<
  import("@/types/supplier-onboarding").OnboardingApproval
> {
  return request<
    import("@/types/supplier-onboarding").OnboardingApproval
  >(
    `/supplier-onboarding/approvals/${approvalId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function finalizeSupplierOnboardingCase(
  caseId: string,
  note: string,
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    `/supplier-onboarding/cases/${caseId}/finalize`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSupplierOnboardingCase(
  caseId: string,
  note: string,
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    `/supplier-onboarding/cases/${caseId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelSupplierOnboardingCase(
  caseId: string,
  note: string,
): Promise<
  import("@/types/supplier-onboarding").SupplierOnboardingCase
> {
  return request<
    import("@/types/supplier-onboarding").SupplierOnboardingCase
  >(
    `/supplier-onboarding/cases/${caseId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getSustainabilityPortfolio(
  currency = "EUR",
): Promise<
  import("@/types/sustainability").SustainabilityPortfolioItem[]
> {
  return request<
    import("@/types/sustainability").SustainabilityPortfolioItem[]
  >(
    `/sustainability?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getSustainabilitySummary(
  currency = "EUR",
): Promise<
  import("@/types/sustainability").SustainabilitySummary
> {
  return request<
    import("@/types/sustainability").SustainabilitySummary
  >(
    `/sustainability/summary?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getSustainabilityCategories(
  currency = "EUR",
): Promise<
  import("@/types/sustainability").SustainabilityCategoryExposure[]
> {
  return request<
    import("@/types/sustainability").SustainabilityCategoryExposure[]
  >(
    `/sustainability/categories?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getSustainabilityAssessment(
  assessmentId: string,
): Promise<
  import("@/types/sustainability").SustainabilityAssessment
> {
  return request<
    import("@/types/sustainability").SustainabilityAssessment
  >(
    `/sustainability/assessments/${assessmentId}`,
  );
}

export async function getSustainabilityContext(): Promise<
  import("@/types/sustainability").SustainabilityContext
> {
  return request<
    import("@/types/sustainability").SustainabilityContext
  >(
    "/sustainability/context-options",
  );
}

export async function createSustainabilityAssessment(
  input: {
    supplierId: string;
    environmentalScore: number;
    socialScore: number;
    governanceScore: number;
    assessmentDate: string;
    ownerUserId?: string;
    notes?: string;
  },
): Promise<
  import("@/types/sustainability").SustainabilityAssessment
> {
  return request<
    import("@/types/sustainability").SustainabilityAssessment
  >(
    "/sustainability/assessments",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function uploadSustainabilityDeclaration(
  assessmentId: string,
  declarationType:
    import("@/types/sustainability").SustainabilityDeclarationType,
  input: {
    documentReference: string;
    expiryDate?: string;
  },
): Promise<
  import("@/types/sustainability").SustainabilityAssessment
> {
  return request<
    import("@/types/sustainability").SustainabilityAssessment
  >(
    `/sustainability/assessments/${assessmentId}/declarations/${declarationType}`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function verifySustainabilityDeclaration(
  declarationId: string,
  note: string,
): Promise<
  import("@/types/sustainability").SustainabilityDeclaration
> {
  return request<
    import("@/types/sustainability").SustainabilityDeclaration
  >(
    `/sustainability/declarations/${declarationId}/verify`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSustainabilityDeclaration(
  declarationId: string,
  note: string,
): Promise<
  import("@/types/sustainability").SustainabilityDeclaration
> {
  return request<
    import("@/types/sustainability").SustainabilityDeclaration
  >(
    `/sustainability/declarations/${declarationId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function submitSustainabilityAssessment(
  assessmentId: string,
): Promise<
  import("@/types/sustainability").SustainabilityAssessment
> {
  return request<
    import("@/types/sustainability").SustainabilityAssessment
  >(
    `/sustainability/assessments/${assessmentId}/submit`,
    {
      method: "POST",
    },
  );
}

export async function approveSustainabilityAssessment(
  assessmentId: string,
  note: string,
): Promise<
  import("@/types/sustainability").SustainabilityAssessment
> {
  return request<
    import("@/types/sustainability").SustainabilityAssessment
  >(
    `/sustainability/assessments/${assessmentId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSustainabilityAssessment(
  assessmentId: string,
  note: string,
): Promise<
  import("@/types/sustainability").SustainabilityAssessment
> {
  return request<
    import("@/types/sustainability").SustainabilityAssessment
  >(
    `/sustainability/assessments/${assessmentId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function createSustainabilityAction(
  assessmentId: string,
  input: {
    actionType:
      import("@/types/sustainability").SustainabilityActionType;
    title: string;
    description?: string;
    ownerUserId?: string;
    dueDate: string;
  },
): Promise<
  import("@/types/sustainability").SustainabilityAction
> {
  return request<
    import("@/types/sustainability").SustainabilityAction
  >(
    `/sustainability/assessments/${assessmentId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startSustainabilityAction(
  actionId: string,
): Promise<
  import("@/types/sustainability").SustainabilityAction
> {
  return request<
    import("@/types/sustainability").SustainabilityAction
  >(
    `/sustainability/actions/${actionId}/start`,
    {
      method: "POST",
    },
  );
}

export async function completeSustainabilityAction(
  actionId: string,
  note: string,
): Promise<
  import("@/types/sustainability").SustainabilityAction
> {
  return request<
    import("@/types/sustainability").SustainabilityAction
  >(
    `/sustainability/actions/${actionId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelSustainabilityAction(
  actionId: string,
): Promise<
  import("@/types/sustainability").SustainabilityAction
> {
  return request<
    import("@/types/sustainability").SustainabilityAction
  >(
    `/sustainability/actions/${actionId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getAnomalyControlDashboard(
  currency = "EUR",
): Promise<
  import("@/types/anomaly-control").AnomalyControlDashboard
> {
  return request<
    import("@/types/anomaly-control").AnomalyControlDashboard
  >(
    `/anomaly-control?currency=${encodeURIComponent(currency)}`,
  );
}

export async function runAnomalyControlScan(
  currency = "EUR",
): Promise<
  import("@/types/anomaly-control").AnomalyScan
> {
  return request<
    import("@/types/anomaly-control").AnomalyScan
  >(
    `/anomaly-control/scan?currency=${encodeURIComponent(currency)}`,
    {
      method: "POST",
    },
  );
}

export async function getAnomalyControlFinding(
  findingId: string,
): Promise<
  import("@/types/anomaly-control").AnomalyFindingDetail
> {
  return request<
    import("@/types/anomaly-control").AnomalyFindingDetail
  >(
    `/anomaly-control/findings/${findingId}`,
  );
}

export async function getAnomalyControlContext(): Promise<
  import("@/types/anomaly-control").AnomalyContext
> {
  return request<
    import("@/types/anomaly-control").AnomalyContext
  >(
    "/anomaly-control/context-options",
  );
}

export async function createAnomalyInvestigation(
  findingId: string,
  input: {
    ownerUserId?: string;
    priority:
      import("@/types/anomaly-control").InvestigationPriority;
    dueDate: string;
  },
): Promise<
  import("@/types/anomaly-control").Investigation
> {
  return request<
    import("@/types/anomaly-control").Investigation
  >(
    `/anomaly-control/findings/${findingId}/investigations`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startAnomalyInvestigation(
  investigationId: string,
): Promise<
  import("@/types/anomaly-control").Investigation
> {
  return request<
    import("@/types/anomaly-control").Investigation
  >(
    `/anomaly-control/investigations/${investigationId}/start`,
    {
      method: "POST",
    },
  );
}

export async function addAnomalyInvestigationEvidence(
  investigationId: string,
  input: {
    evidenceType:
      import("@/types/anomaly-control").InvestigationEvidenceType;
    referenceText: string;
  },
): Promise<
  import("@/types/anomaly-control").InvestigationEvidence
> {
  return request<
    import("@/types/anomaly-control").InvestigationEvidence
  >(
    `/anomaly-control/investigations/${investigationId}/evidence`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function closeAnomalyInvestigation(
  investigationId: string,
  input: {
    disposition:
      import("@/types/anomaly-control").InvestigationDisposition;
    note: string;
  },
): Promise<
  import("@/types/anomaly-control").Investigation
> {
  return request<
    import("@/types/anomaly-control").Investigation
  >(
    `/anomaly-control/investigations/${investigationId}/close`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function cancelAnomalyInvestigation(
  investigationId: string,
  note: string,
): Promise<
  import("@/types/anomaly-control").Investigation
> {
  return request<
    import("@/types/anomaly-control").Investigation
  >(
    `/anomaly-control/investigations/${investigationId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        disposition: "RESOLVED",
        note,
      }),
    },
  );
}

export async function updateAnomalyRule(
  ruleId: number,
  input: {
    enabled: boolean;
    defaultSeverity:
      import("@/types/anomaly-control").AnomalySeverity;
    scoreWeight: number;
    thresholdValue: number;
    lookbackDays: number;
  },
): Promise<
  import("@/types/anomaly-control").AnomalyRule
> {
  return request<
    import("@/types/anomaly-control").AnomalyRule
  >(
    `/anomaly-control/rules/${ruleId}`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getSupplierCollaborationDashboard(): Promise<
  import("@/types/supplier-collaboration").SupplierCollaborationDashboard
> {
  return request<
    import("@/types/supplier-collaboration").SupplierCollaborationDashboard
  >(
    "/supplier-collaboration",
  );
}

export async function getSupplierCollaborationWorkspace(
  workspaceId: string,
): Promise<
  import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
  >(
    `/supplier-collaboration/workspaces/${workspaceId}`,
  );
}

export async function getSupplierCollaborationContext(): Promise<
  import("@/types/supplier-collaboration").CollaborationContext
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationContext
  >(
    "/supplier-collaboration/context-options",
  );
}

export async function createSupplierCollaborationWorkspace(
  input: {
    supplierId: string;
    workspaceType:
      import("@/types/supplier-collaboration").CollaborationWorkspaceType;
    priority:
      import("@/types/supplier-collaboration").CollaborationPriority;
    title: string;
    purchaseOrderId?: string;
    rfqId?: string;
    externalReference?: string;
    ownerUserId?: string;
    supplierResponseSlaHours?: number;
    notes?: string;
  },
): Promise<
  import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
  >(
    "/supplier-collaboration/workspaces",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function addInternalCollaborationMessage(
  workspaceId: string,
  input: {
    messageType:
      import("@/types/supplier-collaboration").CollaborationMessageType;
    body: string;
    referenceText?: string;
  },
): Promise<
  import("@/types/supplier-collaboration").CollaborationMessage
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationMessage
  >(
    `/supplier-collaboration/workspaces/${workspaceId}/messages/internal`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function sendSupplierCollaborationMessage(
  workspaceId: string,
  input: {
    messageType:
      import("@/types/supplier-collaboration").CollaborationMessageType;
    body: string;
    referenceText?: string;
  },
): Promise<
  import("@/types/supplier-collaboration").CollaborationMessage
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationMessage
  >(
    `/supplier-collaboration/workspaces/${workspaceId}/messages/to-supplier`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function recordSupplierCollaborationResponse(
  workspaceId: string,
  input: {
    messageType:
      import("@/types/supplier-collaboration").CollaborationMessageType;
    supplierContactName: string;
    body: string;
    referenceText?: string;
  },
): Promise<
  import("@/types/supplier-collaboration").CollaborationMessage
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationMessage
  >(
    `/supplier-collaboration/workspaces/${workspaceId}/messages/from-supplier`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function createSupplierCollaborationAction(
  workspaceId: string,
  input: {
    actionType:
      import("@/types/supplier-collaboration").CollaborationActionType;
    audience:
      import("@/types/supplier-collaboration").CollaborationActionAudience;
    title: string;
    description?: string;
    assigneeUserId?: string;
    externalAssigneeLabel?: string;
    dueAt: string;
  },
): Promise<
  import("@/types/supplier-collaboration").CollaborationAction
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationAction
  >(
    `/supplier-collaboration/workspaces/${workspaceId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startSupplierCollaborationAction(
  actionId: string,
): Promise<
  import("@/types/supplier-collaboration").CollaborationAction
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationAction
  >(
    `/supplier-collaboration/actions/${actionId}/start`,
    {
      method: "POST",
    },
  );
}

export async function completeSupplierCollaborationAction(
  actionId: string,
  note: string,
): Promise<
  import("@/types/supplier-collaboration").CollaborationAction
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationAction
  >(
    `/supplier-collaboration/actions/${actionId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelSupplierCollaborationAction(
  actionId: string,
): Promise<
  import("@/types/supplier-collaboration").CollaborationAction
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationAction
  >(
    `/supplier-collaboration/actions/${actionId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function resolveSupplierCollaborationWorkspace(
  workspaceId: string,
  note: string,
): Promise<
  import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
  >(
    `/supplier-collaboration/workspaces/${workspaceId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function closeSupplierCollaborationWorkspace(
  workspaceId: string,
  note: string,
): Promise<
  import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
> {
  return request<
    import("@/types/supplier-collaboration").CollaborationWorkspaceDetail
  >(
    `/supplier-collaboration/workspaces/${workspaceId}/close`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

const supplierPortalApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL
  ??
  process.env.NEXT_PUBLIC_API_URL
  ??
  "http://localhost:8080/api/v1";

async function supplierPortalRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers =
    new Headers(
      init.headers,
    );

  if (
    !headers.has(
      "Content-Type",
    )
    &&
    init.body
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  const response =
    await fetch(
      `${supplierPortalApiBaseUrl}${path}`,
      {
        ...init,
        headers,
      },
    );

  if (!response.ok) {
    const contentType =
      response.headers.get(
        "content-type",
      )
      ??
      "";

    let message =
      `Supplier portal request failed (${response.status}).`;

    if (
      contentType.includes(
        "application/json",
      )
    ) {
      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        payload
        &&
        typeof payload ===
          "object"
      ) {
        const candidate =
          (
            payload as
              Record<
                string,
                unknown
              >
          ).message
          ??
          (
            payload as
              Record<
                string,
                unknown
              >
          ).error;

        if (
          typeof candidate ===
          "string"
          &&
          candidate.trim()
        ) {
          message =
            candidate;
        }
      }
    } else {
      const text =
        await response
          .text()
          .catch(
            () => "",
          );

      if (text.trim()) {
        message =
          text.trim();
      }
    }

    throw new Error(
      message,
    );
  }

  if (
    response.status ===
    204
  ) {
    return undefined as T;
  }

  return response.json() as
    Promise<T>;
}

export async function getSupplierPortalAccounts(): Promise<
  import("@/types/supplier-portal").SupplierPortalAccount[]
> {
  return request<
    import("@/types/supplier-portal").SupplierPortalAccount[]
  >(
    "/supplier-portal-admin/accounts",
  );
}

export async function inviteSupplierPortalAccount(
  input: {
    supplierId: string;
    email: string;
    displayName: string;
  },
): Promise<
  import("@/types/supplier-portal").SupplierPortalInvitation
> {
  return request<
    import("@/types/supplier-portal").SupplierPortalInvitation
  >(
    "/supplier-portal-admin/invitations",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function suspendSupplierPortalAccount(
  accountId: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalAccount
> {
  return request<
    import("@/types/supplier-portal").SupplierPortalAccount
  >(
    `/supplier-portal-admin/accounts/${accountId}/suspend`,
    {
      method: "POST",
    },
  );
}

export async function reinstateSupplierPortalAccount(
  accountId: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalAccount
> {
  return request<
    import("@/types/supplier-portal").SupplierPortalAccount
  >(
    `/supplier-portal-admin/accounts/${accountId}/reinstate`,
    {
      method: "POST",
    },
  );
}

export async function revokeSupplierPortalAccount(
  accountId: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalAccount
> {
  return request<
    import("@/types/supplier-portal").SupplierPortalAccount
  >(
    `/supplier-portal-admin/accounts/${accountId}/revoke`,
    {
      method: "POST",
    },
  );
}

export async function activateSupplierPortalAccount(
  invitationToken: string,
  password: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalProfile
> {
  return supplierPortalRequest<
    import("@/types/supplier-portal").SupplierPortalProfile
  >(
    "/supplier-portal/activate",
    {
      method: "POST",
      body: JSON.stringify({
        invitationToken,
        password,
      }),
    },
  );
}

export async function supplierPortalLogin(
  email: string,
  password: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalAuth
> {
  return supplierPortalRequest<
    import("@/types/supplier-portal").SupplierPortalAuth
  >(
    "/supplier-portal/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );
}

export async function supplierPortalLogout(
  token: string,
): Promise<void> {
  return supplierPortalRequest<void>(
    "/supplier-portal/logout",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );
}

export async function getSupplierPortalProfile(
  token: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalProfile
> {
  return supplierPortalRequest<
    import("@/types/supplier-portal").SupplierPortalProfile
  >(
    "/supplier-portal/me",
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );
}

export async function getSupplierPortalDashboard(
  token: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalDashboard
> {
  return supplierPortalRequest<
    import("@/types/supplier-portal").SupplierPortalDashboard
  >(
    "/supplier-portal/dashboard",
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );
}

export async function getSupplierPortalWorkspace(
  token: string,
  workspaceId: string,
): Promise<
  import("@/types/supplier-portal").SupplierPortalWorkspaceDetail
> {
  return supplierPortalRequest<
    import("@/types/supplier-portal").SupplierPortalWorkspaceDetail
  >(
    `/supplier-portal/workspaces/${workspaceId}`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );
}

export async function sendSupplierPortalResponse(
  token: string,
  workspaceId: string,
  input: {
    messageType:
      import("@/types/supplier-collaboration").CollaborationMessageType;
    body: string;
    referenceText?: string;
  },
): Promise<
  import("@/types/supplier-portal").SupplierPortalWorkspaceDetail
> {
  return supplierPortalRequest<
    import("@/types/supplier-portal").SupplierPortalWorkspaceDetail
  >(
    `/supplier-portal/workspaces/${workspaceId}/responses`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function completeSupplierPortalAction(
  token: string,
  actionId: string,
  input: {
    note: string;
    referenceText?: string;
  },
): Promise<
  import("@/types/supplier-portal").SupplierPortalWorkspaceDetail
> {
  return supplierPortalRequest<
    import("@/types/supplier-portal").SupplierPortalWorkspaceDetail
  >(
    `/supplier-portal/actions/${actionId}/complete`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getSupplierDocumentVaultDashboard(): Promise<
  import("@/types/supplier-document-vault").SupplierDocumentVaultDashboard
> {
  return request<
    import("@/types/supplier-document-vault").SupplierDocumentVaultDashboard
  >(
    "/supplier-document-vault",
  );
}

export async function createSupplierDocumentRequirement(
  input: {
    requirementCode: string;
    name: string;
    description: string;
    documentType:
      import("@/types/supplier-document-vault").SupplierDocumentType;
    categoryScope?: string;
    mandatory: boolean;
    expiryRequired: boolean;
    renewalLeadDays: number;
    onboardingRelevant: boolean;
    sustainabilityRelevant: boolean;
  },
): Promise<
  import("@/types/supplier-document-vault").SupplierDocumentRequirement
> {
  return request<
    import("@/types/supplier-document-vault").SupplierDocumentRequirement
  >(
    "/supplier-document-vault/requirements",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function approveSupplierDocumentVersion(
  versionId: string,
  note: string,
): Promise<
  import("@/types/supplier-document-vault").SupplierDocumentVersion
> {
  return request<
    import("@/types/supplier-document-vault").SupplierDocumentVersion
  >(
    `/supplier-document-vault/versions/${versionId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function rejectSupplierDocumentVersion(
  versionId: string,
  note: string,
): Promise<
  import("@/types/supplier-document-vault").SupplierDocumentVersion
> {
  return request<
    import("@/types/supplier-document-vault").SupplierDocumentVersion
  >(
    `/supplier-document-vault/versions/${versionId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getSupplierDocumentContent(
  versionId: string,
): Promise<
  import("@/types/supplier-document-vault").SupplierDocumentContent
> {
  return request<
    import("@/types/supplier-document-vault").SupplierDocumentContent
  >(
    `/supplier-document-vault/versions/${versionId}/content`,
  );
}

async function supplierPortalFormRequest<T>(
  path: string,
  token: string,
  formData: FormData,
): Promise<T> {
  const response =
    await fetch(
      `${supplierPortalApiBaseUrl}${path}`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        body: formData,
      },
    );

  if (!response.ok) {
    const contentType =
      response.headers.get(
        "content-type",
      )
      ??
      "";

    let message =
      `Supplier portal upload failed (${response.status}).`;

    if (
      contentType.includes(
        "application/json",
      )
    ) {
      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        payload
        &&
        typeof payload ===
          "object"
      ) {
        const candidate =
          (
            payload as
              Record<
                string,
                unknown
              >
          ).message
          ??
          (
            payload as
              Record<
                string,
                unknown
              >
          ).error;

        if (
          typeof candidate ===
          "string"
          &&
          candidate.trim()
        ) {
          message =
            candidate;
        }
      }
    }

    throw new Error(
      message,
    );
  }

  return response.json() as
    Promise<T>;
}

export async function getSupplierPortalDocumentDashboard(
  token: string,
): Promise<
  import("@/types/supplier-document-vault").SupplierPortalDocumentDashboard
> {
  return supplierPortalRequest<
    import("@/types/supplier-document-vault").SupplierPortalDocumentDashboard
  >(
    "/supplier-portal/documents",
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );
}

export async function uploadSupplierPortalDocument(
  token: string,
  requirementId: string,
  file: File,
  expiryDate?: string,
): Promise<
  import("@/types/supplier-document-vault").SupplierPortalDocumentDashboard
> {
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
  );

  const query =
    expiryDate
      ? `?expiryDate=${encodeURIComponent(expiryDate)}`
      : "";

  return supplierPortalFormRequest<
    import("@/types/supplier-document-vault").SupplierPortalDocumentDashboard
  >(
    `/supplier-portal/documents/requirements/${requirementId}/upload${query}`,
    token,
    formData,
  );
}

export async function getSupplierPortalDocumentContent(
  token: string,
  versionId: string,
): Promise<
  import("@/types/supplier-document-vault").SupplierDocumentContent
> {
  return supplierPortalRequest<
    import("@/types/supplier-document-vault").SupplierDocumentContent
  >(
    `/supplier-portal/documents/versions/${versionId}/content`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );
}

export async function getSupplierRiskMonitoringDashboard(
  currency = "EUR",
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskDashboard
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskDashboard
  >(
    `/supplier-risk-monitoring?currency=${encodeURIComponent(currency)}`,
  );
}

export async function runSupplierRiskEvaluation(
  currency = "EUR",
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskEvaluationRun
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskEvaluationRun
  >(
    `/supplier-risk-monitoring/evaluate?currency=${encodeURIComponent(currency)}`,
    {
      method: "POST",
    },
  );
}

export async function getSupplierRiskDetail(
  supplierId: string,
  currency = "EUR",
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskDetail
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskDetail
  >(
    `/supplier-risk-monitoring/suppliers/${supplierId}?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getSupplierRiskContext(): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskContext
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskContext
  >(
    "/supplier-risk-monitoring/context-options",
  );
}

export async function addSupplierToRiskWatchlist(
  supplierId: string,
  reason: string,
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskWatchlist
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskWatchlist
  >(
    `/supplier-risk-monitoring/suppliers/${supplierId}/watchlist`,
    {
      method: "POST",
      body: JSON.stringify({
        reason,
      }),
    },
  );
}

export async function releaseSupplierFromRiskWatchlist(
  supplierId: string,
  reason: string,
): Promise<void> {
  return request<void>(
    `/supplier-risk-monitoring/suppliers/${supplierId}/watchlist/release`,
    {
      method: "POST",
      body: JSON.stringify({
        reason,
      }),
    },
  );
}

export async function acknowledgeSupplierRiskAlert(
  alertId: string,
  note: string,
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskAlert
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskAlert
  >(
    `/supplier-risk-monitoring/alerts/${alertId}/acknowledge`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function createSupplierRiskEscalation(
  supplierId: string,
  input: {
    alertId?: string;
    ownerUserId?: string;
    priority:
      import("@/types/supplier-risk-monitoring").SupplierRiskEscalationPriority;
    dueDate: string;
    rationale: string;
  },
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
  >(
    `/supplier-risk-monitoring/suppliers/${supplierId}/escalations`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startSupplierRiskEscalation(
  caseId: string,
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
  >(
    `/supplier-risk-monitoring/escalations/${caseId}/start`,
    {
      method: "POST",
    },
  );
}

export async function closeSupplierRiskEscalation(
  caseId: string,
  note: string,
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
  >(
    `/supplier-risk-monitoring/escalations/${caseId}/close`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelSupplierRiskEscalation(
  caseId: string,
  note: string,
): Promise<
  import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
> {
  return request<
    import("@/types/supplier-risk-monitoring").SupplierRiskEscalation
  >(
    `/supplier-risk-monitoring/escalations/${caseId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getCategoryManagementDashboard(
  currency = "EUR",
): Promise<
  import("@/types/category-management").CategoryManagementDashboard
> {
  return request<
    import("@/types/category-management").CategoryManagementDashboard
  >(
    `/category-management?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getCategoryManagementContext(
  currency = "EUR",
): Promise<
  import("@/types/category-management").CategoryContext
> {
  return request<
    import("@/types/category-management").CategoryContext
  >(
    `/category-management/context-options?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getCategoryStrategy(
  strategyId: string,
): Promise<
  import("@/types/category-management").CategoryStrategyDetail
> {
  return request<
    import("@/types/category-management").CategoryStrategyDetail
  >(
    `/category-management/strategies/${strategyId}`,
  );
}

export async function createCategoryStrategy(
  input: {
    categoryName: string;
    currency: string;
    fiscalYear: number;
    ownerUserId?: string;
    savingsTargetPct: number;
    objectives: string;
  },
): Promise<
  import("@/types/category-management").CategoryStrategyDetail
> {
  return request<
    import("@/types/category-management").CategoryStrategyDetail
  >(
    "/category-management/strategies",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function updateCategoryStrategyStatus(
  strategyId: string,
  status:
    import("@/types/category-management").CategoryStrategyStatus,
): Promise<
  import("@/types/category-management").CategoryStrategySummary
> {
  return request<
    import("@/types/category-management").CategoryStrategySummary
  >(
    `/category-management/strategies/${strategyId}/status`,
    {
      method: "PUT",
      body: JSON.stringify({
        status,
      }),
    },
  );
}

export async function createCategoryInitiative(
  strategyId: string,
  input: {
    initiativeType:
      import("@/types/category-management").CategoryInitiativeType;
    title: string;
    description?: string;
    priority:
      import("@/types/category-management").CategoryInitiativePriority;
    ownerUserId?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    estimatedValue: number;
    targetSavings: number;
  },
): Promise<
  import("@/types/category-management").CategoryInitiative
> {
  return request<
    import("@/types/category-management").CategoryInitiative
  >(
    `/category-management/strategies/${strategyId}/initiatives`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function readyCategoryInitiative(
  initiativeId: string,
): Promise<
  import("@/types/category-management").CategoryInitiative
> {
  return request<
    import("@/types/category-management").CategoryInitiative
  >(
    `/category-management/initiatives/${initiativeId}/ready`,
    {
      method: "POST",
    },
  );
}

export async function startCategoryInitiative(
  initiativeId: string,
): Promise<
  import("@/types/category-management").CategoryInitiative
> {
  return request<
    import("@/types/category-management").CategoryInitiative
  >(
    `/category-management/initiatives/${initiativeId}/start`,
    {
      method: "POST",
    },
  );
}

export async function completeCategoryInitiative(
  initiativeId: string,
  realizedSavings: number,
): Promise<
  import("@/types/category-management").CategoryInitiative
> {
  return request<
    import("@/types/category-management").CategoryInitiative
  >(
    `/category-management/initiatives/${initiativeId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        realizedSavings,
      }),
    },
  );
}

export async function cancelCategoryInitiative(
  initiativeId: string,
): Promise<
  import("@/types/category-management").CategoryInitiative
> {
  return request<
    import("@/types/category-management").CategoryInitiative
  >(
    `/category-management/initiatives/${initiativeId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function createCategoryMilestone(
  initiativeId: string,
  input: {
    title: string;
    dueDate: string;
  },
): Promise<
  import("@/types/category-management").CategoryMilestone
> {
  return request<
    import("@/types/category-management").CategoryMilestone
  >(
    `/category-management/initiatives/${initiativeId}/milestones`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function completeCategoryMilestone(
  milestoneId: string,
  note: string,
): Promise<
  import("@/types/category-management").CategoryMilestone
> {
  return request<
    import("@/types/category-management").CategoryMilestone
  >(
    `/category-management/milestones/${milestoneId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelCategoryMilestone(
  milestoneId: string,
): Promise<
  import("@/types/category-management").CategoryMilestone
> {
  return request<
    import("@/types/category-management").CategoryMilestone
  >(
    `/category-management/milestones/${milestoneId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function getPortfolioOptimizationDashboard(
  currency = "EUR",
): Promise<
  import("@/types/portfolio-optimization").PortfolioOptimizationDashboard
> {
  return request<
    import("@/types/portfolio-optimization").PortfolioOptimizationDashboard
  >(
    `/portfolio-optimization?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getPortfolioOptimizationContext(): Promise<
  import("@/types/portfolio-optimization").PortfolioOptimizationContext
> {
  return request<
    import("@/types/portfolio-optimization").PortfolioOptimizationContext
  >(
    "/portfolio-optimization/context-options",
  );
}

export async function getPortfolioOptimizationScenario(
  scenarioId: string,
): Promise<
  import("@/types/portfolio-optimization").PortfolioScenarioDetail
> {
  return request<
    import("@/types/portfolio-optimization").PortfolioScenarioDetail
  >(
    `/portfolio-optimization/scenarios/${scenarioId}`,
  );
}

export async function createPortfolioOptimizationScenario(
  input: {
    name: string;
    currency: string;
    ownerUserId?: string;
    budgetLimit: number;
    maxInitiatives: number;
    maxAverageRiskScore: number;
    minTotalTargetSavings: number;
    allowCriticalPriority: boolean;
    notes?: string;
  },
): Promise<
  import("@/types/portfolio-optimization").PortfolioScenarioDetail
> {
  return request<
    import("@/types/portfolio-optimization").PortfolioScenarioDetail
  >(
    "/portfolio-optimization/scenarios",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function evaluatePortfolioOptimizationScenario(
  scenarioId: string,
): Promise<
  import("@/types/portfolio-optimization").PortfolioOptimizationRun
> {
  return request<
    import("@/types/portfolio-optimization").PortfolioOptimizationRun
  >(
    `/portfolio-optimization/scenarios/${scenarioId}/evaluate`,
    {
      method: "POST",
    },
  );
}

export async function approvePortfolioOptimizationScenario(
  scenarioId: string,
): Promise<
  import("@/types/portfolio-optimization").PortfolioScenarioSummary
> {
  return request<
    import("@/types/portfolio-optimization").PortfolioScenarioSummary
  >(
    `/portfolio-optimization/scenarios/${scenarioId}/approve`,
    {
      method: "POST",
    },
  );
}

export async function archivePortfolioOptimizationScenario(
  scenarioId: string,
): Promise<
  import("@/types/portfolio-optimization").PortfolioScenarioSummary
> {
  return request<
    import("@/types/portfolio-optimization").PortfolioScenarioSummary
  >(
    `/portfolio-optimization/scenarios/${scenarioId}/archive`,
    {
      method: "POST",
    },
  );
}

export async function getBenefitsGovernanceDashboard(
  currency = "EUR",
): Promise<
  import("@/types/benefits-governance").BenefitsGovernanceDashboard
> {
  return request<
    import("@/types/benefits-governance").BenefitsGovernanceDashboard
  >(
    `/benefits-governance?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getBenefitsGovernanceContext(): Promise<
  import("@/types/benefits-governance").BenefitsGovernanceContext
> {
  return request<
    import("@/types/benefits-governance").BenefitsGovernanceContext
  >(
    "/benefits-governance/context-options",
  );
}

export async function getExecutionPortfolio(
  portfolioId: string,
): Promise<
  import("@/types/benefits-governance").ExecutionPortfolioDetail
> {
  return request<
    import("@/types/benefits-governance").ExecutionPortfolioDetail
  >(
    `/benefits-governance/portfolios/${portfolioId}`,
  );
}

export async function authorizeExecutionPortfolio(
  scenarioId: string,
  input: {
    ownerUserId?: string;
    notes?: string;
  } = {},
): Promise<
  import("@/types/benefits-governance").ExecutionPortfolioDetail
> {
  return request<
    import("@/types/benefits-governance").ExecutionPortfolioDetail
  >(
    `/benefits-governance/scenarios/${scenarioId}/authorize`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startExecutionPortfolio(
  portfolioId: string,
): Promise<
  import("@/types/benefits-governance").ExecutionPortfolioSummary
> {
  return request<
    import("@/types/benefits-governance").ExecutionPortfolioSummary
  >(
    `/benefits-governance/portfolios/${portfolioId}/start`,
    {
      method: "POST",
    },
  );
}

export async function closeExecutionPortfolio(
  portfolioId: string,
): Promise<
  import("@/types/benefits-governance").ExecutionPortfolioSummary
> {
  return request<
    import("@/types/benefits-governance").ExecutionPortfolioSummary
  >(
    `/benefits-governance/portfolios/${portfolioId}/close`,
    {
      method: "POST",
    },
  );
}

export async function archiveExecutionPortfolio(
  portfolioId: string,
): Promise<
  import("@/types/benefits-governance").ExecutionPortfolioSummary
> {
  return request<
    import("@/types/benefits-governance").ExecutionPortfolioSummary
  >(
    `/benefits-governance/portfolios/${portfolioId}/archive`,
    {
      method: "POST",
    },
  );
}

export async function updateBenefitOwner(
  itemId: string,
  ownerUserId: string,
): Promise<
  import("@/types/benefits-governance").BenefitItem
> {
  return request<
    import("@/types/benefits-governance").BenefitItem
  >(
    `/benefits-governance/items/${itemId}/owner`,
    {
      method: "PUT",
      body: JSON.stringify({
        ownerUserId,
      }),
    },
  );
}

export async function startBenefitItem(
  itemId: string,
): Promise<
  import("@/types/benefits-governance").BenefitItem
> {
  return request<
    import("@/types/benefits-governance").BenefitItem
  >(
    `/benefits-governance/items/${itemId}/start`,
    {
      method: "POST",
    },
  );
}

export async function updateBenefitForecast(
  itemId: string,
  input: {
    forecastSavings: number;
    expectedRealizationDate?: string;
  },
): Promise<
  import("@/types/benefits-governance").BenefitItem
> {
  return request<
    import("@/types/benefits-governance").BenefitItem
  >(
    `/benefits-governance/items/${itemId}/forecast`,
    {
      method: "PUT",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function requestBenefitValidation(
  itemId: string,
  input: {
    proposedValidatedSavings: number;
    note: string;
  },
): Promise<
  import("@/types/benefits-governance").BenefitItem
> {
  return request<
    import("@/types/benefits-governance").BenefitItem
  >(
    `/benefits-governance/items/${itemId}/validation-request`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function validateBenefitItem(
  itemId: string,
  input: {
    validatedSavings: number;
    note: string;
  },
): Promise<
  import("@/types/benefits-governance").BenefitItem
> {
  return request<
    import("@/types/benefits-governance").BenefitItem
  >(
    `/benefits-governance/items/${itemId}/validate`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function cancelBenefitItem(
  itemId: string,
): Promise<
  import("@/types/benefits-governance").BenefitItem
> {
  return request<
    import("@/types/benefits-governance").BenefitItem
  >(
    `/benefits-governance/items/${itemId}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function createBenefitAssumption(
  portfolioId: string,
  input: {
    assumptionType:
      import("@/types/benefits-governance").BenefitAssumptionType;
    description: string;
    financialImpact: number;
    ownerUserId?: string;
    reviewDate?: string;
  },
): Promise<
  import("@/types/benefits-governance").BenefitAssumption
> {
  return request<
    import("@/types/benefits-governance").BenefitAssumption
  >(
    `/benefits-governance/portfolios/${portfolioId}/assumptions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function confirmBenefitAssumption(
  assumptionId: string,
  note: string,
): Promise<
  import("@/types/benefits-governance").BenefitAssumption
> {
  return request<
    import("@/types/benefits-governance").BenefitAssumption
  >(
    `/benefits-governance/assumptions/${assumptionId}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function invalidateBenefitAssumption(
  assumptionId: string,
  note: string,
): Promise<
  import("@/types/benefits-governance").BenefitAssumption
> {
  return request<
    import("@/types/benefits-governance").BenefitAssumption
  >(
    `/benefits-governance/assumptions/${assumptionId}/invalidate`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function createBenefitLeakage(
  itemId: string,
  input: {
    leakageType:
      import("@/types/benefits-governance").BenefitLeakageType;
    amount: number;
    description: string;
    ownerUserId?: string;
    dueDate?: string;
  },
): Promise<
  import("@/types/benefits-governance").BenefitLeakage
> {
  return request<
    import("@/types/benefits-governance").BenefitLeakage
  >(
    `/benefits-governance/items/${itemId}/leakage`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function resolveBenefitLeakage(
  leakageId: string,
  status:
    import("@/types/benefits-governance").BenefitLeakageStatus,
  note: string,
): Promise<
  import("@/types/benefits-governance").BenefitLeakage
> {
  return request<
    import("@/types/benefits-governance").BenefitLeakage
  >(
    `/benefits-governance/leakage/${leakageId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        status,
        note,
      }),
    },
  );
}

export async function getGovernanceReviewDashboard(
  currency = "EUR",
): Promise<
  import("@/types/governance-review").GovernanceReviewDashboard
> {
  return request<
    import("@/types/governance-review").GovernanceReviewDashboard
  >(
    `/governance-reviews?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getGovernanceReviewContext(): Promise<
  import("@/types/governance-review").GovernanceReviewContext
> {
  return request<
    import("@/types/governance-review").GovernanceReviewContext
  >(
    "/governance-reviews/context-options",
  );
}

export async function getGovernanceReview(
  reviewId: string,
): Promise<
  import("@/types/governance-review").GovernanceReviewDetail
> {
  return request<
    import("@/types/governance-review").GovernanceReviewDetail
  >(
    `/governance-reviews/${reviewId}`,
  );
}

export async function createGovernanceReview(
  input: {
    title: string;
    periodStart: string;
    periodEnd: string;
    currency: string;
    ownerUserId?: string;
    chairUserId?: string;
    executiveSummary: string;
  },
): Promise<
  import("@/types/governance-review").GovernanceReviewDetail
> {
  return request<
    import("@/types/governance-review").GovernanceReviewDetail
  >(
    "/governance-reviews",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function freezeGovernanceReview(
  reviewId: string,
): Promise<
  import("@/types/governance-review").GovernanceReviewDetail
> {
  return request<
    import("@/types/governance-review").GovernanceReviewDetail
  >(
    `/governance-reviews/${reviewId}/freeze`,
    {
      method: "POST",
    },
  );
}

export async function openGovernanceReview(
  reviewId: string,
): Promise<
  import("@/types/governance-review").GovernanceReviewSummary
> {
  return request<
    import("@/types/governance-review").GovernanceReviewSummary
  >(
    `/governance-reviews/${reviewId}/open`,
    {
      method: "POST",
    },
  );
}

export async function closeGovernanceReview(
  reviewId: string,
): Promise<
  import("@/types/governance-review").GovernanceReviewSummary
> {
  return request<
    import("@/types/governance-review").GovernanceReviewSummary
  >(
    `/governance-reviews/${reviewId}/close`,
    {
      method: "POST",
    },
  );
}

export async function archiveGovernanceReview(
  reviewId: string,
): Promise<
  import("@/types/governance-review").GovernanceReviewSummary
> {
  return request<
    import("@/types/governance-review").GovernanceReviewSummary
  >(
    `/governance-reviews/${reviewId}/archive`,
    {
      method: "POST",
    },
  );
}

export async function createGovernanceDecision(
  reviewId: string,
  input: {
    decisionType:
      import("@/types/governance-review").GovernanceDecisionType;
    title: string;
    description: string;
    decisionOwnerUserId?: string;
    dueDate?: string;
  },
): Promise<
  import("@/types/governance-review").GovernanceDecision
> {
  return request<
    import("@/types/governance-review").GovernanceDecision
  >(
    `/governance-reviews/${reviewId}/decisions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function resolveGovernanceDecision(
  decisionId: string,
  status:
    import("@/types/governance-review").GovernanceDecisionStatus,
  note: string,
): Promise<
  import("@/types/governance-review").GovernanceDecision
> {
  return request<
    import("@/types/governance-review").GovernanceDecision
  >(
    `/governance-reviews/decisions/${decisionId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        status,
        note,
      }),
    },
  );
}

export async function createGovernanceAction(
  reviewId: string,
  input: {
    decisionId?: string;
    title: string;
    description?: string;
    ownerUserId?: string;
    priority:
      import("@/types/governance-review").GovernanceActionPriority;
    dueDate: string;
  },
): Promise<
  import("@/types/governance-review").GovernanceAction
> {
  return request<
    import("@/types/governance-review").GovernanceAction
  >(
    `/governance-reviews/${reviewId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function startGovernanceAction(
  actionId: string,
): Promise<
  import("@/types/governance-review").GovernanceAction
> {
  return request<
    import("@/types/governance-review").GovernanceAction
  >(
    `/governance-reviews/actions/${actionId}/start`,
    {
      method: "POST",
    },
  );
}

export async function completeGovernanceAction(
  actionId: string,
  note: string,
): Promise<
  import("@/types/governance-review").GovernanceAction
> {
  return request<
    import("@/types/governance-review").GovernanceAction
  >(
    `/governance-reviews/actions/${actionId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function cancelGovernanceAction(
  actionId: string,
  note: string,
): Promise<
  import("@/types/governance-review").GovernanceAction
> {
  return request<
    import("@/types/governance-review").GovernanceAction
  >(
    `/governance-reviews/actions/${actionId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getControlTowerDashboard(
  currency = "EUR",
): Promise<
  import("@/types/control-tower").ControlTowerDashboard
> {
  return request<
    import("@/types/control-tower").ControlTowerDashboard
  >(
    `/control-tower?currency=${encodeURIComponent(currency)}`,
  );
}

export async function scanControlTower(
  currency = "EUR",
): Promise<
  import("@/types/control-tower").ControlTowerScan
> {
  return request<
    import("@/types/control-tower").ControlTowerScan
  >(
    `/control-tower/scan?currency=${encodeURIComponent(currency)}`,
    {
      method: "POST",
    },
  );
}

export async function getControlTowerContext(): Promise<
  import("@/types/control-tower").ControlTowerContext
> {
  return request<
    import("@/types/control-tower").ControlTowerContext
  >(
    "/control-tower/context-options",
  );
}

export async function getControlTowerItem(
  itemId: string,
): Promise<
  import("@/types/control-tower").ControlTowerItem
> {
  return request<
    import("@/types/control-tower").ControlTowerItem
  >(
    `/control-tower/items/${itemId}`,
  );
}

export async function assignControlTowerOwner(
  itemId: string,
  ownerUserId: string,
): Promise<
  import("@/types/control-tower").ControlTowerItem
> {
  return request<
    import("@/types/control-tower").ControlTowerItem
  >(
    `/control-tower/items/${itemId}/owner`,
    {
      method: "PUT",
      body: JSON.stringify({
        ownerUserId,
      }),
    },
  );
}

export async function acknowledgeControlTowerItem(
  itemId: string,
  note: string,
): Promise<
  import("@/types/control-tower").ControlTowerItem
> {
  return request<
    import("@/types/control-tower").ControlTowerItem
  >(
    `/control-tower/items/${itemId}/acknowledge`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function startControlTowerItem(
  itemId: string,
): Promise<
  import("@/types/control-tower").ControlTowerItem
> {
  return request<
    import("@/types/control-tower").ControlTowerItem
  >(
    `/control-tower/items/${itemId}/start`,
    {
      method: "POST",
    },
  );
}

export async function resolveControlTowerItem(
  itemId: string,
  note: string,
): Promise<
  import("@/types/control-tower").ControlTowerItem
> {
  return request<
    import("@/types/control-tower").ControlTowerItem
  >(
    `/control-tower/items/${itemId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function dismissControlTowerItem(
  itemId: string,
  note: string,
): Promise<
  import("@/types/control-tower").ControlTowerItem
> {
  return request<
    import("@/types/control-tower").ControlTowerItem
  >(
    `/control-tower/items/${itemId}/dismiss`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    },
  );
}

export async function getOperatingRhythmDashboard(
  currency = "EUR",
): Promise<
  import("@/types/operating-rhythm").OperatingRhythmDashboard
> {
  return request<
    import("@/types/operating-rhythm").OperatingRhythmDashboard
  >(
    `/operating-rhythm?currency=${encodeURIComponent(currency)}`,
  );
}

export async function captureOperatingRhythmSnapshot(
  input: {
    currency: string;
    periodStart: string;
    periodEnd: string;
  },
): Promise<
  import("@/types/operating-rhythm").OperatingRhythmSnapshotDetail
> {
  return request<
    import("@/types/operating-rhythm").OperatingRhythmSnapshotDetail
  >(
    "/operating-rhythm/snapshots",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getOperatingRhythmSnapshot(
  snapshotId: string,
): Promise<
  import("@/types/operating-rhythm").OperatingRhythmSnapshotDetail
> {
  return request<
    import("@/types/operating-rhythm").OperatingRhythmSnapshotDetail
  >(
    `/operating-rhythm/snapshots/${snapshotId}`,
  );
}
