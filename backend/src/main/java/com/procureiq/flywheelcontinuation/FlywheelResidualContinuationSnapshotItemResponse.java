package com.procureiq.flywheelcontinuation;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import com.procureiq.flywheelremediationoutcome.FlywheelRemediationResolutionType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelResidualContinuationSnapshotItemResponse(
        UUID id,
        UUID snapshotId,
        UUID continuationItemId,
        UUID sourceOutcomeItemId,
        FlywheelResidualRemediationAction sourceAction,
        FlywheelRemediationResolutionType sourceResolutionType,
        BigDecimal sourceRemainingResidualAmount,
        FlywheelResidualContinuationAction continuationAction,
        LocalDate targetDate,
        String rationale
) {
}
