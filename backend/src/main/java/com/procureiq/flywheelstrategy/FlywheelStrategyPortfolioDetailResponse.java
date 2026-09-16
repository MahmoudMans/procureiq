package com.procureiq.flywheelstrategy;

import java.util.List;

public record FlywheelStrategyPortfolioDetailResponse(
        FlywheelStrategyPortfolioResponse portfolio,
        List<FlywheelStrategyUserOptionResponse> users,
        List<FlywheelStrategyCandidateResponse> candidates,
        List<FlywheelStrategyItemResponse> items,
        List<FlywheelStrategySnapshotSummaryResponse> snapshots
) {
}
