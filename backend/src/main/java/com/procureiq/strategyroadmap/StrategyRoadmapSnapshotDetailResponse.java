package com.procureiq.strategyroadmap;

import java.util.List;

public record StrategyRoadmapSnapshotDetailResponse(
        StrategyRoadmapSnapshotSummaryResponse snapshot,
        StrategyRoadmapSummaryResponse roadmap,
        List<RoadmapInitiativeResponse> initiatives
) {
}
