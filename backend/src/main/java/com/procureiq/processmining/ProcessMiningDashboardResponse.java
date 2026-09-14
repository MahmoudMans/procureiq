package com.procureiq.processmining;

import java.util.List;

public record ProcessMiningDashboardResponse(
        ProcessMiningSummaryResponse summary,
        List<ProcessStageMetricResponse> stageMetrics,
        List<ProcessBottleneckResponse> bottlenecks,
        List<ProcessDimensionMetricResponse> departmentMetrics,
        List<ProcessDimensionMetricResponse> categoryMetrics,
        List<ProcessDeviationResponse> deviations,
        List<ProcessRecommendationResponse> recommendations,
        List<ProcessStageTargetResponse> targets,
        List<ProcessEventResponse> recentEvents
) {
}
