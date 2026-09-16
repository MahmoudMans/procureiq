package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelVarianceExecutionSnapshotItemResponse(
        UUID varianceItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceVarianceAmount,

        FlywheelVarianceDecision sourceDecision,

        BigDecimal executedAmount,

        FlywheelVarianceExecutionOutcome outcome,

        String evidenceReference,
        LocalDate evidenceDate,
        String evidenceNote
) {

    @com.fasterxml.jackson.annotation.JsonProperty("financialResidualAmount")
    public BigDecimal financialResidualAmount() {
        return FlywheelVarianceExecutionExposureMetrics.calculate(
                sourceVarianceAmount, sourceVarianceAmount, executedAmount
        ).financialResidualAmount();
    }
}
