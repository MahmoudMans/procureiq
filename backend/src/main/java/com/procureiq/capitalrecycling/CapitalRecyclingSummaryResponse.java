package com.procureiq.capitalrecycling;

import java.math.BigDecimal;

public record CapitalRecyclingSummaryResponse(
        int candidateCount,
        int sourceCount,
        int openSourceCount,
        int fullyAllocatedSourceCount,
        BigDecimal totalRecyclableCapitalAmount,
        BigDecimal totalApprovedReinvestmentAmount,
        BigDecimal totalAvailableCapitalAmount,
        BigDecimal averageUtilizationPct
) {
}
