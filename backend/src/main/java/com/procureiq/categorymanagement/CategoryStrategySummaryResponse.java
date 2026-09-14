package com.procureiq.categorymanagement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CategoryStrategySummaryResponse(
        UUID id,
        String strategyCode,
        String categoryName,
        String currency,
        int fiscalYear,
        CategoryStrategyStatus status,
        UUID ownerUserId,
        String ownerName,

        BigDecimal spendBaseline,
        BigDecimal currentSpend,
        BigDecimal modeledOpportunityAmount,

        BigDecimal savingsTargetPct,
        BigDecimal savingsTargetAmount,
        BigDecimal initiativeTargetSavings,
        BigDecimal realizedSavings,
        BigDecimal realizationPct,

        BigDecimal strategicValueScore,
        BigDecimal supplyRiskScore,
        CategoryMatrixPosition matrixPosition,

        long activeInitiatives,
        long overdueInitiatives,
        long openMilestones,
        long overdueMilestones,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
