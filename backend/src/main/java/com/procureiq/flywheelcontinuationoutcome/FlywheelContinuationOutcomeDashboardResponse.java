package com.procureiq.flywheelcontinuationoutcome;

import java.util.List;

public record FlywheelContinuationOutcomeDashboardResponse(
        FlywheelContinuationOutcomeSummaryResponse summary,
        List<FlywheelContinuationOutcomeCaseResponse> cases,
        List<FlywheelContinuationOutcomeSourceResponse> eligibleSources
) {
}
