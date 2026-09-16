package com.procureiq.flywheelsettlement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelSettlementCaseResponse(
        UUID id,
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

        BigDecimal sourceReleasedAmount,
        BigDecimal settledAmount,
        BigDecimal varianceAmount,
        BigDecimal settlementPct,

        int itemCount,
        int settledCount,
        int partialCount,
        int unresolvedCount,

        UUID reconciliationOwnerUserId,
        String reconciliationOwnerName,

        String reconciliationRationale,

        FlywheelSettlementCaseStatus status,

        String submittedByName,
        Instant submittedAt,

        String reconciliationNote,
        String reconciledByName,
        Instant reconciledAt,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,

        long version
) {
}
