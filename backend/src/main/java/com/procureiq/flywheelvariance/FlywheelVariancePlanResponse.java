package com.procureiq.flywheelvariance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelVariancePlanResponse(
        UUID id,
        String planNumber,

        UUID settlementCaseId,
        String reconciliationNumber,

        UUID releaseBatchId,
        String releaseNumber,

        UUID allocationMandateId,
        String allocationMandateNumber,

        UUID strategyPortfolioId,
        String strategyPortfolioNumber,

        String title,

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

        UUID planOwnerUserId,
        String planOwnerName,

        String resolutionObjective,

        FlywheelVariancePlanStatus status,

        String submittedByName,
        Instant submittedAt,

        String approvalNote,
        String approvedByName,
        Instant approvedAt,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,

        long version
) {
}
