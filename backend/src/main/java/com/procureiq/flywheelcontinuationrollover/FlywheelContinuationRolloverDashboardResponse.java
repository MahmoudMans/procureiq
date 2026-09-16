package com.procureiq.flywheelcontinuationrollover;

import java.util.List;

public record FlywheelContinuationRolloverDashboardResponse(
        FlywheelContinuationRolloverSummaryResponse summary,
        List<FlywheelContinuationRolloverCaseResponse> cases,
        List<FlywheelContinuationRolloverSourceResponse> eligibleSources
) {
}
