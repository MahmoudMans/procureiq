package com.procureiq.continuousimprovement;

import java.math.BigDecimal;

public record ImprovementDimensionOptionResponse(
        ImprovementScopeType scopeType,
        String scopeKey,
        String scopeLabel,
        long activeCount,
        long slaOverdueCount,
        long persistentCount,
        long resolvedCount,
        BigDecimal slaAttainmentPct,
        BigDecimal avgResolutionHours,
        BigDecimal avgActiveAgeDays,
        BigDecimal activeExposure,
        BigDecimal workloadSharePct
) {
}
