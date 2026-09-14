export type ProcurementRole =
  | "ADMIN"
  | "PROCUREMENT_MANAGER"
  | "BUYER"
  | "REQUESTER"
  | "APPROVER";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: ProcurementRole;
  jobTitle: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  active: boolean;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: AuthUser;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
}
