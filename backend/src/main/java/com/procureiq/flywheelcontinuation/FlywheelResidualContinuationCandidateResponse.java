package com.procureiq.flywheelcontinuation;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import com.procureiq.flywheelremediationoutcome.FlywheelRemediationResolutionType;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelResidualContinuationCandidateResponse(
        UUID outcomeItemId,
        FlywheelResidualRemediationAction sourceAction,
        FlywheelRemediationResolutionType sourceResolutionType,
        BigDecimal remainingResidualAmount
) {
}
