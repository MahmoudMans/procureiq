export type OperatingRhythmDimensionType =
  | "DOMAIN"
  | "OWNER"
  | "SEVERITY"
  | "EXCEPTION_TYPE";

export interface OperatingRhythmMetrics {
  activeBacklogCount: number;
  criticalBacklogCount: number;
  highBacklogCount: number;
  slaOverdueCount: number;
  unassignedCount: number;
  persistentExceptionCount: number;
  resolvedCount: number;
  onTimeResolvedCount: number;
  lateResolvedCount: number;
  slaAttainmentPct: number;
  avgResolutionHours: number;
  avgActiveAgeDays: number;
  activeMonetaryExposure: number;
}

export interface OperatingRhythmDimension {
  id: string | null;
  dimensionType: OperatingRhythmDimensionType;
  dimensionKey: string;
  dimensionLabel: string;
  activeCount: number;
  slaOverdueCount: number;
  persistentCount: number;
  resolvedCount: number;
  onTimeResolvedCount: number;
  slaAttainmentPct: number;
  avgResolutionHours: number;
  avgActiveAgeDays: number;
  activeExposure: number;
  workloadSharePct: number;
}

export interface OperatingRhythmSnapshotSummary {
  id: string;
  snapshotNumber: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  capturedByName: string;
  activeBacklogCount: number;
  slaOverdueCount: number;
  persistentExceptionCount: number;
  resolvedCount: number;
  slaAttainmentPct: number;
  avgResolutionHours: number;
  avgActiveAgeDays: number;
  activeMonetaryExposure: number;
  capturedAt: string;
}

export interface OperatingRhythmSnapshotDetail {
  snapshot: OperatingRhythmSnapshotSummary;
  metrics: OperatingRhythmMetrics;
  periodStart: string;
  periodEnd: string;
  domains: OperatingRhythmDimension[];
  owners: OperatingRhythmDimension[];
  severities: OperatingRhythmDimension[];
  exceptionTypes: OperatingRhythmDimension[];
}

export interface OperatingRhythmDashboard {
  currency: string;
  livePeriodStart: string;
  livePeriodEnd: string;
  liveMetrics: OperatingRhythmMetrics;
  liveDomains: OperatingRhythmDimension[];
  liveOwners: OperatingRhythmDimension[];
  liveExceptionTypes: OperatingRhythmDimension[];
  snapshots: OperatingRhythmSnapshotSummary[];
}
