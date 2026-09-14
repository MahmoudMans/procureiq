export type AnomalySignalType =
  | "INVOICE"
  | "SPEND"
  | "COMMERCIAL"
  | "PROCESS";

export type AnomalySeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type AnomalyFindingStatus =
  | "OPEN"
  | "UNDER_INVESTIGATION"
  | "CONFIRMED"
  | "DISMISSED"
  | "RESOLVED";

export type InvestigationStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "CLOSED"
  | "CANCELLED";

export type InvestigationPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type InvestigationDisposition =
  | "CONFIRMED"
  | "DISMISSED"
  | "RESOLVED";

export type InvestigationEvidenceType =
  | "NOTE"
  | "TRANSACTION_REFERENCE"
  | "DOCUMENT_REFERENCE"
  | "CONTROL_TEST";

export interface AnomalyRule {
  id: number;
  ruleCode: string;
  signalType: AnomalySignalType;
  title: string;
  description: string;
  defaultSeverity: AnomalySeverity;
  scoreWeight: number;
  thresholdValue: number;
  lookbackDays: number;
  enabled: boolean;
  activeFindings: number;
}

export interface InvestigationEvidence {
  id: string;
  investigationId: string;
  evidenceType: InvestigationEvidenceType;
  referenceText: string;
  addedByUserId: string;
  addedByName: string;
  createdAt: string;
}

export interface Investigation {
  id: string;
  caseNumber: string;
  findingId: string;
  ownerUserId: string;
  ownerName: string;
  priority: InvestigationPriority;
  status: InvestigationStatus;
  dueDate: string;
  overdue: boolean;
  conclusion: string | null;
  closedAt: string | null;
  evidence: InvestigationEvidence[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface AnomalyFinding {
  id: string;
  findingKey: string;

  ruleId: number;
  ruleCode: string;
  signalType: AnomalySignalType;
  ruleTitle: string;
  severity: AnomalySeverity;

  entityType: string;
  entityId: string;
  relatedEntityId: string | null;
  entityReference: string | null;

  currency: string | null;
  exposureValue: number | null;
  metricValue: number | null;
  anomalyScore: number;

  details: string;

  status: AnomalyFindingStatus;

  activeInvestigations: number;
  overdueInvestigations: number;

  detectedAt: string;
  lastSeenAt: string;

  dispositionNote: string | null;
  disposedAt: string | null;
  disposedByName: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface AnomalyFindingDetail {
  finding: AnomalyFinding;
  investigations: Investigation[];
}

export interface AnomalySignalSummary {
  signalType: AnomalySignalType;
  activeFindings: number;
  criticalFindings: number;
  exposure: number;
}

export interface AnomalyControlSummary {
  currency: string;

  activeFindings: number;
  criticalFindings: number;
  underInvestigation: number;
  confirmedFindings: number;

  activeExposure: number;
  invoiceExposure: number;
  commercialLeakageExposure: number;

  duplicateInvoiceSignals: number;
  repeatedValueSignals: number;
  splitPurchaseSignals: number;
  concentrationSignals: number;
  offContractSignals: number;

  activeInvestigations: number;
  overdueInvestigations: number;

  lastScanAt: string | null;
}

export interface AnomalyScan {
  candidatesDetected: number;
  createdFindings: number;
  refreshedFindings: number;
  autoResolvedFindings: number;
}

export interface AnomalyControlDashboard {
  summary: AnomalyControlSummary;
  signalSummaries: AnomalySignalSummary[];
  findings: AnomalyFinding[];
  rules: AnomalyRule[];
}

export interface AnomalyUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface AnomalyContext {
  users: AnomalyUserOption[];
}
