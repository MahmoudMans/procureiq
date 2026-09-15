package com.procureiq.capitalrecycling;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalRecyclingSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        int sourceCount,
        int openSourceCount,
        int fullyAllocatedSourceCount,
        BigDecimal totalRecyclableCapitalAmount,
        BigDecimal totalApprovedReinvestmentAmount,
        BigDecimal totalAvailableCapitalAmount,
        BigDecimal averageUtilizationPct,
        String capturedByName,
        Instant capturedAt
) {
}
