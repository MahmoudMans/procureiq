package com.procureiq.flywheelcontinuationoutcome;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelContinuationOutcomeCandidateResponse(
        UUID continuationItemId,
        FlywheelResidualContinuationAction continuationAction,
        BigDecimal sourceResidualAmount
) {
}
