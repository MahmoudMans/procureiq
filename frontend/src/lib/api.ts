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

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
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
      // Keep default message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getSuppliers(
  filters: SupplierFilters = {},
): Promise<Supplier[]> {

  const params =
    new URLSearchParams();

  if (filters.query?.trim()) {
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

  if (filters.riskLevel) {
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

export async function getSupplierSummary():
Promise<SupplierSummary> {

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
      body: JSON.stringify(input),
    },
  );
}
