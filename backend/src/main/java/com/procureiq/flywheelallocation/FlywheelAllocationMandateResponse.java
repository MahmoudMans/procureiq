package com.procureiq.flywheelallocation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelAllocationMandateResponse(
        UUID id,
        String mandateNumber,

        UUID strategyPortfolioId,
        String strategyPortfolioNumber,

        String title,

        String currency,
        int fiscalYear,

        BigDecimal strategyCapitalCapacityAmount,
        BigDecimal strategyPrioritizedCapacityAmount,

        BigDecimal requestedAllocationAmount,
        BigDecimal remainingStrategyCapacityAmount,
        BigDecimal allocationUtilizationPct,

        int itemCount,

        UUID mandateOwnerUserId,
        String mandateOwnerName,

        String mandateRationale,

        FlywheelAllocationMandateStatus status,

        String submittedByName,
        Instant submittedAt,

        String authorizationNote,
        String authorizedByName,
        Instant authorizedAt,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,

        long version
) {
}
