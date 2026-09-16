package com.procureiq.flywheelvariance;

import java.util.List;

public record FlywheelVarianceDashboardResponse(
        FlywheelVarianceSummaryResponse summary,

        List<FlywheelVarianceUserOptionResponse> users,

        List<FlywheelVarianceSourceResponse> settlements,

        List<FlywheelVariancePlanResponse> plans,

        List<FlywheelVarianceSnapshotSummaryResponse> snapshots
) {
}
