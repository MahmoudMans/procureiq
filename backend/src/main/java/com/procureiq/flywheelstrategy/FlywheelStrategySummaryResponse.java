package com.procureiq.flywheelstrategy;

public record FlywheelStrategySummaryResponse(
        int candidateCount,
        int portfolioCount,
        int draftPortfolioCount,
        int reviewPortfolioCount,
        int approvedPortfolioCount,
        int closedPortfolioCount,
        int prioritizedLineageCount,
        int holdLineageCount,
        int exitLineageCount
) {
}
