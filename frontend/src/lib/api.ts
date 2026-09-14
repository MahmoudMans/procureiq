import {
  clearAccessToken,
  getAccessToken,
} from "@/lib/auth-storage";

import type {
  AuthUser,
  Department,
  LoginResponse,
} from "@/types/auth";

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

  const headers = new Headers(
    fetchOptions.headers,
  );

  if (
    fetchOptions.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (authenticated) {
    const token = getAccessToken();

    if (token) {
      headers.set(
        "Authorization",
        `Bearer ${token}`,
      );
    }
  }

  const response = await fetch(
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
      // Preserve the default HTTP status message.
    }

    if (
      response.status === 401 &&
      authenticated
    ) {
      clearAccessToken();

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new Event(
            "procureiq:unauthorized",
          ),
        );
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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
      body: JSON.stringify(input),
    },
  );
}
