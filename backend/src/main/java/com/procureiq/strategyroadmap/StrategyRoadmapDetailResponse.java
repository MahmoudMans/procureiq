package com.procureiq.strategyroadmap;

import com.procureiq.capacityplanning.CapacityUserOptionResponse;

import java.util.List;

public record StrategyRoadmapDetailResponse(
        StrategyRoadmapSummaryResponse roadmap,
        List<CapacityUserOptionResponse> users,
        List<RoadmapInitiativeResponse> initiatives,
        List<RoadmapDependencyResponse> dependencies,
        List<RoadmapMilestoneResponse> milestones,
        List<RoadmapGateResponse> gates,
        List<StrategyRoadmapSnapshotSummaryResponse> snapshots
) {
}
