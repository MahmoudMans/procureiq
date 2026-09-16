package com.procureiq.flywheelremediation;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelResidualRemediationCandidateResponse(
        UUID executionItemId,
        FlywheelVarianceDecision sourceDecision,
        BigDecimal sourceVarianceAmount,
        BigDecimal sourceExecutedAmount,
        BigDecimal residualAmount
) {
}
