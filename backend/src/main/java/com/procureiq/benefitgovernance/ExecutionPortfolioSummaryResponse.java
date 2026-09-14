package com.procureiq.benefitgovernance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExecutionPortfolioSummaryResponse(
        UUID id,
        String portfolioNumber,

        UUID sourceScenarioId,
        String sourceScenarioCode,
        String sourceScenarioName,

        String currency,
        ExecutionPortfolioStatus status,

        UUID ownerUserId,
        String ownerName,

        String authorizedByName,
        Instant authorizedAt,

        BigDecimal baselineSelectedBudget,
        BigDecimal baselineTargetSavings,
        BigDecimal baselineAverageRisk,
        long selectedInitiativeCount,

        BigDecimal currentForecastSavings,
        BigDecimal operationalReportedSavings,
        BigDecimal validatedSavings,
        BigDecimal activeLeakageAmount,
        BigDecimal atRiskAmount,

        BigDecimal forecastCoveragePct,
        BigDecimal validationCoveragePct,

        long activeBenefitItems,
        long validationPendingItems,
        long validatedItems,

        long activeAssumptions,
        long invalidatedAssumptions,

        long activeLeakageCases,
        long overdueLeakageCases,

        Instant closedAt,
        Instant archivedAt,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
