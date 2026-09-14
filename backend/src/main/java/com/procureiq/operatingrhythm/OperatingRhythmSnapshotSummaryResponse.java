package com.procureiq.operatingrhythm;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record OperatingRhythmSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        String currency,
        LocalDate periodStart,
        LocalDate periodEnd,
        String capturedByName,
        long activeBacklogCount,
        long slaOverdueCount,
        long persistentExceptionCount,
        long resolvedCount,
        BigDecimal slaAttainmentPct,
        BigDecimal avgResolutionHours,
        BigDecimal avgActiveAgeDays,
        BigDecimal activeMonetaryExposure,
        Instant capturedAt
) {
}
