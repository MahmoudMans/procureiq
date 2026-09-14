package com.procureiq.anomaly;

import java.util.List;

public record AnomalyControlDashboardResponse(
        AnomalyControlSummaryResponse summary,
        List<AnomalySignalSummaryResponse> signalSummaries,
        List<AnomalyFindingResponse> findings,
        List<AnomalyRuleResponse> rules
) {
}
