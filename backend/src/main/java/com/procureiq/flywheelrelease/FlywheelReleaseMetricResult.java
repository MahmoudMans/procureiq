package com.procureiq.flywheelrelease;

import java.math.BigDecimal;

public record FlywheelReleaseMetricResult(
        BigDecimal batchPlannedReleaseAmount,
        BigDecimal batchReleasedAmount,
        BigDecimal cumulativeMandateReleasedAmount,
        BigDecimal remainingMandateAmount,
        BigDecimal cumulativeReleaseUtilizationPct
) {
}
