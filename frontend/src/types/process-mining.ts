export type ProcessEntityType =
  | "PURCHASE_REQUEST"
  | "APPROVAL"
  | "RFQ"
  | "AWARD"
  | "PURCHASE_ORDER"
  | "GOODS_RECEIPT"
  | "INVOICE";

export type ProcessBottleneckSeverity =
  | "WARNING"
  | "CRITICAL";

export type ProcessDeviationType =
  | "SLA_BREACH"
  | "REPEATED_STAGE"
  | "CANCELLED_FLOW";

export interface ProcessStageTarget {
  id: number;
  entityType: ProcessEntityType;
  status: string;
  targetHours: number;
}

export interface ProcessStageMetric {
  entityType: ProcessEntityType;
  status: string;
  completedTransitions: number;
  averageHours: number;
  p95Hours: number;
}

export interface ProcessBottleneck {
  entityType: ProcessEntityType;
  entityId: string;
  entityReference: string | null;
  status: string;
  departmentId: string | null;
  departmentName: string | null;
  category: string | null;
  ageHours: number;
  targetHours: number;
  targetRatio: number;
  severity: ProcessBottleneckSeverity;
  enteredStageAt: string;
}

export interface ProcessDimensionMetric {
  dimensionType: string;
  dimensionValue: string;
  activeItems: number;
  bottlenecks: number;
  averageAgeHours: number;
}

export interface ProcessDeviation {
  deviationType: ProcessDeviationType;
  entityType: ProcessEntityType;
  entityId: string;
  entityReference: string | null;
  status: string;
  details: string;
  detectedAt: string;
}

export interface ProcessEvent {
  id: number;
  entityType: ProcessEntityType;
  entityId: string;
  entityReference: string | null;
  status: string;
  previousStatus: string | null;
  eventType: string;
  eventSource: string;
  sourceTable: string;
  departmentId: string | null;
  category: string | null;
  eventAt: string;
}

export interface ProcessRecommendation {
  priority: string;
  title: string;
  details: string;
}

export interface ProcessMiningSummary {
  trackedEntities: number;
  liveTransitions: number;
  activeEntities: number;
  bottlenecks: number;
  criticalBottlenecks: number;
  cancelledFlows: number;
  repeatedStages: number;
  averageObservedCycleHours: number;
}

export interface ProcessMiningDashboard {
  summary: ProcessMiningSummary;
  stageMetrics: ProcessStageMetric[];
  bottlenecks: ProcessBottleneck[];
  departmentMetrics: ProcessDimensionMetric[];
  categoryMetrics: ProcessDimensionMetric[];
  deviations: ProcessDeviation[];
  recommendations: ProcessRecommendation[];
  targets: ProcessStageTarget[];
  recentEvents: ProcessEvent[];
}
