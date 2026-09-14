package com.procureiq.demandconsolidation;

import java.math.BigDecimal;

public record DemandConsolidationSummaryResponse(
        long candidateGroups,
        long candidateIntakes,
        BigDecimal candidateValue,
        long openBundles,
        long approvedBundles,
        long sourcingBundles,
        long closedBundles,
        BigDecimal bundledValue,
        BigDecimal expectedSavings
) {
}
