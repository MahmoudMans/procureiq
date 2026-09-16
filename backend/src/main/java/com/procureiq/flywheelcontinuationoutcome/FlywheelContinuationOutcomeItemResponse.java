package com.procureiq.flywheelcontinuationoutcome;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelContinuationOutcomeItemResponse(
        UUID id,
        UUID outcomeCaseId,
        UUID sourceContinuationItemId,
        FlywheelResidualContinuationAction sourceContinuationAction,
        BigDecimal sourceResidualAmount,
        FlywheelContinuationOutcomeResolutionType resolutionType,
        BigDecimal observedReductionAmount,
        BigDecimal remainingResidualAmount,
        LocalDate observedOn,
        String evidenceReference,
        String evidenceNote,
        UUID createdByUserId,
        Instant createdAt
) {
}
