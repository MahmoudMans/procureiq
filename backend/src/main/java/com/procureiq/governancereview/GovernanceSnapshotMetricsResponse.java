package com.procureiq.governancereview;

import java.math.BigDecimal;
import java.time.Instant;

public record GovernanceSnapshotMetricsResponse(
        long evaluatedSuppliers,
        long highRiskSuppliers,
        long criticalRiskSuppliers,
        BigDecimal spendAtHighRisk,

        long activeRiskAlerts,
        long openRiskEscalations,

        long activeCategoryStrategies,
        long activeCategoryInitiatives,
        long overdueCategoryInitiatives,

        long approvedScenarios,

        long activeExecutionPortfolios,
        BigDecimal baselineTargetSavings,
        BigDecimal forecastSavings,
        BigDecimal operationalReportedSavings,
        BigDecimal validatedSavings,
        long validationPendingItems,

        long activeLeakageCases,
        BigDecimal activeLeakageAmount,
        BigDecimal atRiskAmount,

        long activeAssumptions,
        long invalidatedAssumptions,

        Instant capturedAt
) {
}
