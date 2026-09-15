package com.procureiq.reinvestmentpersistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ReinvestmentPersistenceSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

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
        BigDecimal totalDecayedValueAmount,

        String capturedByName,
        Instant capturedAt
) {
}
