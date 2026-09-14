package com.procureiq.suppliermonitoring;

import java.math.BigDecimal;
import java.time.Instant;

public record SupplierRiskSummaryResponse(
        String currency,
        long evaluatedSuppliers,
        long highRiskSuppliers,
        long criticalRiskSuppliers,
        long deterioratingSuppliers,
        long requalificationRecommended,
        long watchlistedSuppliers,
        long activeAlerts,
        long openEscalationCases,
        BigDecimal spendAtHighRisk,
        Instant latestEvaluationAt
) {
}
