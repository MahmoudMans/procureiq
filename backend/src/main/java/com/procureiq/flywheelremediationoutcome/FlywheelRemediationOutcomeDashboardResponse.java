package com.procureiq.flywheelremediationoutcome;

import java.util.List;

public record FlywheelRemediationOutcomeDashboardResponse(
        FlywheelRemediationOutcomeSummaryResponse summary,
        List<FlywheelRemediationOutcomeCaseResponse> cases,
        List<FlywheelRemediationOutcomeSourceResponse> eligibleSources
) {
}
