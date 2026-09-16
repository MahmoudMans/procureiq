package com.procureiq.flywheelvarianceexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelVarianceExecutionCaseResponse(
        UUID id,
        String executionNumber,

        UUID variancePlanId,
        String variancePlanNumber,

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

        BigDecimal sourceRecoverAmount,
        BigDecimal sourceWriteOffAmount,
        BigDecimal sourceInvestigationAmount,

        BigDecimal capturedVarianceAmount,
        BigDecimal executedFinancialAmount,

        BigDecimal recoveredAmount,
        BigDecimal writtenOffAmount,
        BigDecimal completedInvestigationAmount,

        BigDecimal openExposureAmount,
        BigDecimal completionPct,

        int itemCount,
        int completedCount,
        int partialCount,
        int unresolvedCount,

        UUID executionOwnerUserId,
        String executionOwnerName,

        String executionObjective,

        FlywheelVarianceExecutionCaseStatus status,

        String submittedByName,
        Instant submittedAt,

        String verificationNote,
        String verifiedByName,
        Instant verifiedAt,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,

        long version
) {
}
