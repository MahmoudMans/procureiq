package com.procureiq.portfoliooptimization;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PortfolioScenarioSummaryResponse(
        UUID id,
        String scenarioCode,
        String name,
        String currency,
        PortfolioScenarioStatus status,

        UUID ownerUserId,
        String ownerName,

        BigDecimal budgetLimit,
        int maxInitiatives,
        BigDecimal maxAverageRiskScore,
        BigDecimal minTotalTargetSavings,
        boolean allowCriticalPriority,

        long candidateCount,
        long selectedCount,
        long excludedCount,

        BigDecimal selectedBudget,
        BigDecimal selectedTargetSavings,
        BigDecimal averageSelectedRisk,
        BigDecimal savingsToBudgetPct,

        boolean minimumTargetMet,

        Instant evaluatedAt,
        Instant approvedAt,
        String approvedByName,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
