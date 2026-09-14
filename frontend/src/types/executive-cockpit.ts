export type ExecutiveSignalType =
  | "PROCESS"
  | "INVOICE"
  | "CONTRACT"
  | "SUPPLIER"
  | "NEGOTIATION"
  | "DEMAND";

export type ExecutiveSignalNature =
  | "RISK"
  | "OPPORTUNITY";

export type ExecutiveWarningSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface ExecutiveRule {
  id: number;
  ruleCode: string;
  signalType: ExecutiveSignalType;
  nature: ExecutiveSignalNature;
  title: string;
  description: string;
  recommendation: string;
  defaultSeverity: ExecutiveWarningSeverity;
  thresholdValue: number;
  lookaheadDays: number;
  enabled: boolean;
  priority: number;
}

export interface ExecutiveWarning {
  warningKey: string;
  ruleId: number;
  ruleCode: string;

  signalType: ExecutiveSignalType;
  nature: ExecutiveSignalNature;
  severity: ExecutiveWarningSeverity;

  title: string;
  details: string;
  recommendation: string;

  referenceType: string;
  referenceId: string;
  referenceLabel: string | null;

  currency: string | null;
  exposureValue: number | null;
  metricValue: number | null;

  dueAt: string | null;

  priorityScore: number;

  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  acknowledgementNote: string | null;
}

export interface ExecutivePortfolioSignal {
  signalType: ExecutiveSignalType;
  warningCount: number;
  criticalCount: number;
  riskExposure: number;
  opportunityValue: number;
}

export interface ExecutiveManagementAction {
  priority: ExecutiveWarningSeverity;
  title: string;
  details: string;
  warningCount: number;
}

export interface ExecutiveCockpitSummary {
  currency: string;

  generatedWarnings: number;
  unacknowledgedWarnings: number;
  criticalWarnings: number;
  highWarnings: number;

  riskExposure: number;
  opportunityValue: number;

  overdueInvoiceExposure: number;
  paymentHoldExposure: number;
  commercialLeakageExposure: number;
  demandSavingsOpportunity: number;

  criticalSupplierSignals: number;
  processBottlenecks: number;
}

export interface ExecutiveCockpit {
  summary: ExecutiveCockpitSummary;
  portfolioSignals: ExecutivePortfolioSignal[];
  warnings: ExecutiveWarning[];
  managementActions: ExecutiveManagementAction[];
  rules: ExecutiveRule[];
  generatedAt: string;
}
