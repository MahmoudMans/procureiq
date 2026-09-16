package com.procureiq.flywheelstrategy;

import java.util.List;

public record FlywheelStrategyDashboardResponse(
        FlywheelStrategySummaryResponse summary,
        List<FlywheelStrategyUserOptionResponse> users,
        List<FlywheelStrategyCandidateResponse> candidates,
        List<FlywheelStrategyPortfolioResponse> portfolios,
        List<FlywheelStrategySnapshotSummaryResponse> snapshots
) {
}
