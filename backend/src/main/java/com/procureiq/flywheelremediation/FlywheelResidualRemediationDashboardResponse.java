package com.procureiq.flywheelremediation;

import java.util.List;

public record FlywheelResidualRemediationDashboardResponse(
        FlywheelResidualRemediationSummaryResponse summary,
        List<FlywheelResidualRemediationPlanResponse> plans,
        List<FlywheelResidualRemediationSourceResponse> eligibleSources
) {
}
