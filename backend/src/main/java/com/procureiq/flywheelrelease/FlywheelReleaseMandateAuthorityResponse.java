package com.procureiq.flywheelrelease;

import com.procureiq.flywheelallocation.FlywheelAllocationMandateStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelReleaseMandateAuthorityResponse(
        UUID allocationMandateId,
        String allocationMandateNumber,

        UUID strategyPortfolioId,
        String strategyPortfolioNumber,

        String title,

        String currency,
        int fiscalYear,

        BigDecimal authorizedAllocationAmount,
        BigDecimal cumulativeReleasedAmount,
        BigDecimal remainingReleaseAuthorityAmount,

        int authorizedItemCount,

        String mandateOwnerName,
        String mandateRationale,

        FlywheelAllocationMandateStatus status
) {
}
