export type SupplierDocumentType =
  | "COMPANY_REGISTRATION"
  | "TAX_CERTIFICATE"
  | "INSURANCE_CERTIFICATE"
  | "BANK_INFORMATION"
  | "CODE_OF_CONDUCT"
  | "ESG_POLICY"
  | "QUALITY_CERTIFICATE"
  | "OTHER";

export type SupplierDocumentVersionStatus =
  | "SUBMITTED"
  | "VALID"
  | "REJECTED";

export type SupplierDocumentEffectiveStatus =
  | "MISSING"
  | "SUBMITTED"
  | "VALID"
  | "RENEWAL_REQUIRED"
  | "EXPIRED"
  | "REJECTED";

export interface SupplierDocumentRequirement {
  id: string;
  requirementCode: string;
  name: string;
  description: string;
  documentType: SupplierDocumentType;
  categoryScope: string | null;
  mandatory: boolean;
  expiryRequired: boolean;
  renewalLeadDays: number;
  onboardingRelevant: boolean;
  sustainabilityRelevant: boolean;
  active: boolean;
}

export interface SupplierDocumentVersion {
  id: string;
  versionNumber: number;
  originalFileName: string;
  contentType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  expiryDate: string | null;
  status: SupplierDocumentVersionStatus;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface SupplierComplianceItem {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory: string | null;

  requirementId: string;
  requirementCode: string;
  requirementName: string;
  documentType: SupplierDocumentType;
  categoryScope: string | null;

  mandatory: boolean;
  expiryRequired: boolean;
  renewalLeadDays: number;
  onboardingRelevant: boolean;
  sustainabilityRelevant: boolean;

  documentId: string | null;

  effectiveStatus: SupplierDocumentEffectiveStatus;

  latestVersionId: string | null;
  latestVersionNumber: number | null;
  latestFileName: string | null;
  latestExpiryDate: string | null;

  versionCount: number;

  versions: SupplierDocumentVersion[];
}

export interface SupplierDocumentVaultSummary {
  activeSuppliers: number;
  requiredDocuments: number;
  currentDocuments: number;
  submittedDocuments: number;
  renewalRequired: number;
  expiredDocuments: number;
  rejectedDocuments: number;
  missingDocuments: number;
  fullyCompliantSuppliers: number;
  onboardingRelevantGaps: number;
  sustainabilityRelevantGaps: number;
}

export interface SupplierDocumentVaultDashboard {
  summary: SupplierDocumentVaultSummary;
  items: SupplierComplianceItem[];
  requirements: SupplierDocumentRequirement[];
}

export interface SupplierPortalDocumentSummary {
  requirements: number;
  currentDocuments: number;
  submittedDocuments: number;
  renewalRequired: number;
  expiredDocuments: number;
  rejectedDocuments: number;
  missingDocuments: number;
  onboardingDocumentReady: boolean;
  sustainabilityDocumentReady: boolean;
}

export interface SupplierPortalDocumentDashboard {
  profile:
    import("@/types/supplier-portal").SupplierPortalProfile;
  summary: SupplierPortalDocumentSummary;
  documents: SupplierComplianceItem[];
}

export interface SupplierDocumentContent {
  fileName: string;
  contentType: string;
  sha256Checksum: string;
  base64Content: string;
}
