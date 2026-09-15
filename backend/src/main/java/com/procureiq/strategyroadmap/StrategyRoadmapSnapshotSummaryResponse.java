package com.procureiq.strategyroadmap;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StrategyRoadmapSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID roadmapId,
        String roadmapNumber,
        String roadmapTitle,
        StrategyRoadmapStatus roadmapStatus,
        BigDecimal readinessScore,
        RoadmapReadinessHealth readinessHealth,
        int initiativeCount,
        int blockedInitiativeCount,
        int overdueMilestoneCount,
        int rejectedGateCount,
        String capturedByName,
        Instant capturedAt
) {
}
