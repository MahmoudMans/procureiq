package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVariancePlanStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelVarianceExecutionSourceResponse(
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

        BigDecimal recoverAmount,
        BigDecimal writeOffAmount,
        BigDecimal investigationAmount,

        int itemCount,

        String planOwnerName,
        String resolutionObjective,

        FlywheelVariancePlanStatus status
) {
}
