package com.procureiq.reinvestmentpersistence;

import java.math.BigDecimal;

public record ReinvestmentPersistenceSummaryResponse(
        int candidateCount,
        int caseCount,
        int assessedCaseCount,

        int compoundingCaseCount,
        int sustainedCaseCount,
        int watchCaseCount,
        int decayingCaseCount,
        int regressedCaseCount,
        int remediationCaseCount,

        BigDecimal averageValuePersistencePct,
        BigDecimal averageEfficiencyRetentionPct,
        BigDecimal averageProjectedRoiPct,

        BigDecimal totalBaselineRealizedNetValueAmount,
        BigDecimal totalCurrentProjectedNetValueAmount,
        BigDecimal totalCompoundingValueAmount,
        BigDecimal totalDecayedValueAmount
) {
}
