package com.procureiq.flywheelvariance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelVarianceSnapshotItemResponse(
        UUID settlementItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceVarianceAmount,

        FlywheelVarianceDecision decision,

        String decisionRationale,

        LocalDate targetDate
) {
}
