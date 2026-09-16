package com.procureiq.flywheelcontinuationoutcome;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelContinuationOutcomeSnapshotItemResponse(
        UUID id,
        UUID snapshotId,
        UUID outcomeItemId,
        UUID sourceContinuationItemId,
        FlywheelResidualContinuationAction sourceContinuationAction,
        BigDecimal sourceResidualAmount,
        FlywheelContinuationOutcomeResolutionType resolutionType,
        BigDecimal observedReductionAmount,
        BigDecimal remainingResidualAmount,
        LocalDate observedOn,
        String evidenceReference,
        String evidenceNote
) {
}
