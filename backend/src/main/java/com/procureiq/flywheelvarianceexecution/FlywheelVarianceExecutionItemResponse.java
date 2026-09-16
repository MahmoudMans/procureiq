package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelVarianceExecutionItemResponse(
        UUID id,
        UUID executionCaseId,

        UUID varianceItemId,

        UUID settlementItemId,

        UUID releaseItemId,
        UUID allocationItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceVarianceAmount,

        FlywheelVarianceDecision sourceDecision,

        BigDecimal executedAmount,
        BigDecimal openExposureAmount,

        FlywheelVarianceExecutionOutcome outcome,

        String evidenceReference,
        LocalDate evidenceDate,
        String evidenceNote,

        String addedByName,
        Instant addedAt
) {

    @com.fasterxml.jackson.annotation.JsonProperty("financialResidualAmount")
    public BigDecimal financialResidualAmount() {
        return FlywheelVarianceExecutionExposureMetrics.calculate(
                sourceVarianceAmount, sourceVarianceAmount, executedAmount
        ).financialResidualAmount();
    }
}
