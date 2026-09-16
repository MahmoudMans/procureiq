package com.procureiq.flywheelcontinuation;

import java.util.List;

public record FlywheelResidualContinuationDashboardResponse(
        FlywheelResidualContinuationSummaryResponse summary,
        List<FlywheelResidualContinuationCaseResponse> cases,
        List<FlywheelResidualContinuationSourceResponse> eligibleSources
) {
}
