export type DataQualityDomain =
  | "SUPPLIER"
  | "TRANSACTION"
  | "PROCESS";

export type DataQualitySeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type DataQualityFindingStatus =
  | "OPEN"
  | "REMEDIATION_IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED";

export type DataQualityRemediationStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface DataQualityRule {
  id: number;
  ruleCode: string;
  domain: DataQualityDomain;
  title: string;
  description: string;
  severity: DataQualitySeverity;
  weight: number;
  enabled: boolean;
  activeFindings: number;
}

export interface DataQualityFinding {
  id: string;
  findingKey: string;

  ruleId: number;
  ruleCode: string;
  domain: DataQualityDomain;
  ruleTitle: string;
  severity: DataQualitySeverity;

  entityType: string;
  entityId: string;
  relatedEntityId: string | null;
  entityReference: string | null;

  details: string;

  status: DataQualityFindingStatus;

  openRemediationTasks: number;
  overdueRemediationTasks: number;

  detectedAt: string;
  lastSeenAt: string;

  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DataQualityRemediation {
  id: string;
  findingId: string;
  title: string;
  ownerUserId: string;
  ownerName: string;
  dueDate: string;
  status: DataQualityRemediationStatus;
  overdue: boolean;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DataQualityFindingDetail {
  finding: DataQualityFinding;
  remediationTasks: DataQualityRemediation[];
}

export interface DataQualityDomainScore {
  domain: DataQualityDomain;
  enabledRules: number;
  affectedRules: number;
  openFindings: number;
  score: number;
}

export interface DataQualitySummary {
  overallScore: number;
  openFindings: number;
  criticalFindings: number;
  duplicateCandidates: number;
  remediationInProgress: number;
  activeRemediationTasks: number;
  overdueRemediationTasks: number;
  lastScanAt: string | null;
}

export interface DataQualityScan {
  candidatesDetected: number;
  createdFindings: number;
  refreshedFindings: number;
  autoResolvedFindings: number;
}

export interface DataQualityDashboard {
  summary: DataQualitySummary;
  domainScores: DataQualityDomainScore[];
  findings: DataQualityFinding[];
  rules: DataQualityRule[];
}

export interface DataQualityUserOption {
  id: string;
  fullName: string;
  role: string;
}

export interface DataQualityContext {
  users: DataQualityUserOption[];
}
