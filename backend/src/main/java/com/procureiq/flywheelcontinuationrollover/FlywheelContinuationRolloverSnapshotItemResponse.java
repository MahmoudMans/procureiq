package com.procureiq.flywheelcontinuationrollover;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import com.procureiq.flywheelcontinuationoutcome.FlywheelContinuationOutcomeResolutionType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelContinuationRolloverSnapshotItemResponse(
        UUID id,
        UUID snapshotId,
        UUID rolloverItemId,
        UUID sourceContinuationOutcomeItemId,
        UUID sourceContinuationItemId,
        FlywheelResidualContinuationAction sourceContinuationAction,
        FlywheelContinuationOutcomeResolutionType sourceResolutionType,
        BigDecimal sourceRemainingResidualAmount,
        FlywheelResidualContinuationAction continuationAction,
        LocalDate targetDate,
        String rationale
) {
}
