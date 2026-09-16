package com.procureiq.flywheelvarianceexecution;

import java.util.List;

public record FlywheelVarianceExecutionDashboardResponse(
        FlywheelVarianceExecutionSummaryResponse summary,

        List<FlywheelVarianceExecutionUserOptionResponse> users,

        List<FlywheelVarianceExecutionSourceResponse> plans,

        List<FlywheelVarianceExecutionCaseResponse> cases,

        List<FlywheelVarianceExecutionSnapshotSummaryResponse> snapshots
) {
}
