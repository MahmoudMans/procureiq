package com.procureiq.strategicokr;

import java.math.BigDecimal;
import java.util.List;

public record StrategicOkrDashboardResponse(
        String currency,
        int fiscalYear,
        long objectiveCount,
        long activeObjectiveCount,
        long achievedObjectiveCount,
        long atRiskObjectiveCount,
        BigDecimal averageProgressPct,
        BigDecimal averageConfidencePct,
        List<StrategicObjectiveSummaryResponse> objectives
) {
}
