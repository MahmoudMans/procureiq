export type ContractStatus =
  | "DRAFT"
  | "ACTIVE"
  | "EXPIRED"
  | "TERMINATED";

export type ComplianceDocumentStatus =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "NO_EXPIRY";

export interface ContractSupplierOption {
  id: string;
  supplierCode: string;
  legalName: string;
}

export interface SupplierContract {
  id: string;
  contractNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  title: string;
  contractType: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  currency: string;
  contractValue: number;
  autoRenew: boolean;
  noticePeriodDays: number;
  ownerUserId: string;
  ownerName: string;
  notes: string | null;
  daysUntilExpiry: number;
  expiringSoon: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ContractCreateInput {
  supplierId: string;
  title: string;
  contractType: string;
  startDate: string;
  endDate: string;
  currency: string;
  contractValue: number;
  autoRenew: boolean;
  noticePeriodDays: number;
  notes?: string;
}

export interface ContractUpdateInput {
  title: string;
  contractType: string;
  startDate: string;
  endDate: string;
  currency: string;
  contractValue: number;
  autoRenew: boolean;
  noticePeriodDays: number;
  notes?: string;
}

export interface ComplianceDocumentInput {
  contractId?: string;
  documentType: string;
  documentName: string;
  documentReference?: string;
  required: boolean;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface ComplianceDocument {
  id: string;
  supplierId: string;
  contractId: string | null;
  contractNumber: string | null;
  documentType: string;
  documentName: string;
  documentReference: string | null;
  required: boolean;
  issueDate: string | null;
  expiryDate: string | null;
  status: ComplianceDocumentStatus;
  daysUntilExpiry: number;
  notes: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierCompliance {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  trackedDocuments: number;
  requiredDocuments: number;
  validRequiredDocuments: number;
  expiringSoonDocuments: number;
  expiredDocuments: number;
  complianceScore: number;
  documents: ComplianceDocument[];
}

export interface ContractSummary {
  totalContracts: number;
  activeContracts: number;
  expiringSoonContracts: number;
  expiredContracts: number;
  activeContractValue: number;
  expiringComplianceDocuments: number;
  expiredComplianceDocuments: number;
  suppliersWithComplianceIssues: number;
}

export interface ContractAlert {
  alertType: string;
  severity: "WARNING" | "HIGH";
  supplierId: string;
  supplierName: string;
  contractId: string | null;
  contractNumber: string | null;
  title: string;
  dueDate: string | null;
  daysRemaining: number;
  href: string;
}
