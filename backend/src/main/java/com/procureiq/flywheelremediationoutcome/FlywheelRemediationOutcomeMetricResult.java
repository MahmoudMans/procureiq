package com.procureiq.flywheelremediationoutcome;

import java.math.BigDecimal;

public record FlywheelRemediationOutcomeMetricResult(
        BigDecimal sourceResidualAmount,
        BigDecimal resolvedAmount,
        BigDecimal remainingResidualAmount,
        int itemCount,
        int unresolvedItemCount
) {
}
