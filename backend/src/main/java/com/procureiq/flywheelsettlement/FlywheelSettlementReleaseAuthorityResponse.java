package com.procureiq.flywheelsettlement;

import com.procureiq.flywheelrelease.FlywheelReleaseBatchStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelSettlementReleaseAuthorityResponse(
        UUID releaseBatchId,
        String releaseNumber,

        UUID allocationMandateId,
        String allocationMandateNumber,

        UUID strategyPortfolioId,
        String strategyPortfolioNumber,

        String title,

        String currency,
        int fiscalYear,

        BigDecimal releasedAmount,
        int releasedItemCount,

        String releaseOwnerName,
        String releaseRationale,

        FlywheelReleaseBatchStatus status
) {
}
