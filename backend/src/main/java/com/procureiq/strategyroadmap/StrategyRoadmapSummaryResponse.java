package com.procureiq.strategyroadmap;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record StrategyRoadmapSummaryResponse(
        UUID id,
        String roadmapNumber,
        UUID sourceScenarioId,
        String sourceScenarioNumber,
        String sourceScenarioName,
        String currency,
        int fiscalYear,
        String title,
        String objective,
        LocalDate startDate,
        LocalDate targetEndDate,
        StrategyRoadmapStatus status,
        BigDecimal scenarioBaselineScore,
        BigDecimal scenarioSimulatedScore,
        BigDecimal scenarioDelta,
        int initiativeCount,
        int completedInitiativeCount,
        int blockedInitiativeCount,
        int overdueMilestoneCount,
        int rejectedGateCount,
        BigDecimal ownerCoveragePct,
        BigDecimal dependencyHealthPct,
        BigDecimal milestoneHealthPct,
        BigDecimal gateHealthPct,
        BigDecimal readinessScore,
        RoadmapReadinessHealth readinessHealth,
        String createdByName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
