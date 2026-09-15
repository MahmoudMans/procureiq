package com.procureiq.strategyroadmap;

import java.util.List;

public record StrategyRoadmapDashboardResponse(
        List<StrategyRoadmapSummaryResponse> roadmaps
) {
}
