package com.procureiq.flywheelvariance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelVarianceSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

        UUID variancePlanId,
        String planNumber,

        UUID settlementCaseId,
        String reconciliationNumber,

        FlywheelVariancePlanStatus planStatus,

        String currency,
        int fiscalYear,

        BigDecimal sourceVarianceAmount,

        BigDecimal governedAmount,
        BigDecimal recoverAmount,
        BigDecimal writeOffAmount,
        BigDecimal investigationAmount,
        BigDecimal coveragePct,

        int itemCount,
        int recoverCount,
        int writeOffCount,
        int investigationCount,

        String capturedByName,
        Instant capturedAt
) {
}
