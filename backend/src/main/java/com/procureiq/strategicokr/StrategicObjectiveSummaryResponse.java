package com.procureiq.strategicokr;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record StrategicObjectiveSummaryResponse(
        UUID id,
        String objectiveNumber,
        String title,
        String currency,
        StrategicObjectivePeriodType periodType,
        int fiscalYear,
        Integer quarter,
        LocalDate startDate,
        LocalDate endDate,
        StrategicObjectiveStatus status,
        UUID ownerUserId,
        String ownerName,
        int keyResultCount,
        int achievedKeyResultCount,
        BigDecimal weightCoveragePct,
        BigDecimal progressPct,
        StrategicHealth health,
        BigDecimal confidencePct,
        long snapshotCount,
        boolean periodOverdue,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
