package com.procureiq.operatingrhythm;

import java.math.BigDecimal;

public record OperatingRhythmDimensionMetric(
        OperatingRhythmDimensionType dimensionType,
        String dimensionKey,
        String dimensionLabel,
        long activeCount,
        long slaOverdueCount,
        long persistentCount,
        long resolvedCount,
        long onTimeResolvedCount,
        BigDecimal slaAttainmentPct,
        BigDecimal avgResolutionHours,
        BigDecimal avgActiveAgeDays,
        BigDecimal activeExposure,
        BigDecimal workloadSharePct
) {
}
