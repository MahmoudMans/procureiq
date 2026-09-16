package com.procureiq.flywheelvariance;

import com.procureiq.flywheelsettlement.FlywheelSettlementCaseStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelVarianceSourceResponse(
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

        BigDecimal sourceReleasedAmount,
        BigDecimal settledAmount,
        BigDecimal varianceAmount,

        int partialCount,
        int unresolvedCount,

        String reconciliationOwnerName,
        String reconciliationRationale,

        FlywheelSettlementCaseStatus status
) {
}
