package com.procureiq.flywheelcontinuation;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import com.procureiq.flywheelremediationoutcome.FlywheelRemediationResolutionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelResidualContinuationItemResponse(
        UUID id,
        UUID continuationCaseId,
        UUID sourceOutcomeItemId,
        FlywheelResidualRemediationAction sourceAction,
        FlywheelRemediationResolutionType sourceResolutionType,
        BigDecimal sourceRemainingResidualAmount,
        FlywheelResidualContinuationAction continuationAction,
        LocalDate targetDate,
        String rationale,
        UUID createdByUserId,
        Instant createdAt
) {
}
