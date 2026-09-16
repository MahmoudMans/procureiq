package com.procureiq.flywheelcontinuationrollover;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import com.procureiq.flywheelcontinuationoutcome.FlywheelContinuationOutcomeResolutionType;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelContinuationRolloverCandidateResponse(
        UUID continuationOutcomeItemId,
        UUID sourceContinuationItemId,
        FlywheelResidualContinuationAction sourceContinuationAction,
        FlywheelContinuationOutcomeResolutionType sourceResolutionType,
        BigDecimal remainingResidualAmount
) {
}
