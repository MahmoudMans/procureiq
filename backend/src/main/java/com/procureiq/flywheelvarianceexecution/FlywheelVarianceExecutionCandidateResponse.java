package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelVarianceExecutionCandidateResponse(
        UUID varianceItemId,

        UUID settlementItemId,

        UUID releaseItemId,
        UUID allocationItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceVarianceAmount,

        FlywheelVarianceDecision sourceDecision,

        String decisionRationale,

        LocalDate targetDate
) {
}
