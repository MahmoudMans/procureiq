package com.procureiq.operatingrhythm;

import java.math.BigDecimal;

public record OperatingRhythmMetricsResponse(
        long activeBacklogCount,
        long criticalBacklogCount,
        long highBacklogCount,
        long slaOverdueCount,
        long unassignedCount,
        long persistentExceptionCount,
        long resolvedCount,
        long onTimeResolvedCount,
        long lateResolvedCount,
        BigDecimal slaAttainmentPct,
        BigDecimal avgResolutionHours,
        BigDecimal avgActiveAgeDays,
        BigDecimal activeMonetaryExposure
) {
}
