package com.procureiq.sustainability;

import java.math.BigDecimal;

public record SustainabilitySummaryResponse(
        String currency,

        long activeSuppliers,
        long assessedSuppliers,
        BigDecimal assessmentCoveragePct,

        long highRiskSuppliers,
        long responsibleSourcingEligibleSuppliers,

        BigDecimal totalSpend,
        BigDecimal assessedSpend,
        BigDecimal spendAssessmentCoveragePct,
        BigDecimal spendAtEsgRisk,
        BigDecimal unassessedSpend,

        long reassessmentsDueWithin30Days,
        long expiredAssessments,

        long openImprovementActions,
        long overdueImprovementActions
) {
}
