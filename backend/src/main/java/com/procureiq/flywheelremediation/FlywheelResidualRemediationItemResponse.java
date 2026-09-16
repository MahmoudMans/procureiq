package com.procureiq.flywheelremediation;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelResidualRemediationItemResponse(
        UUID id,
        UUID remediationPlanId,
        UUID sourceExecutionItemId,
        FlywheelVarianceDecision sourceDecision,
        BigDecimal sourceVarianceAmount,
        BigDecimal sourceExecutedAmount,
        BigDecimal residualAmount,
        FlywheelResidualRemediationAction action,
        LocalDate targetDate,
        String rationale,
        UUID createdByUserId,
        Instant createdAt
) {
}
