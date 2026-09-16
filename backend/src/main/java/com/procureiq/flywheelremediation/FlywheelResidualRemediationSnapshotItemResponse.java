package com.procureiq.flywheelremediation;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelResidualRemediationSnapshotItemResponse(
        UUID id,
        UUID snapshotId,
        UUID remediationItemId,
        UUID sourceExecutionItemId,
        FlywheelVarianceDecision sourceDecision,
        BigDecimal sourceVarianceAmount,
        BigDecimal sourceExecutedAmount,
        BigDecimal residualAmount,
        FlywheelResidualRemediationAction action,
        LocalDate targetDate,
        String rationale
) {
}
