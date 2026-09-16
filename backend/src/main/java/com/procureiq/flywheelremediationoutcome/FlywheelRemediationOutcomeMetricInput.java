package com.procureiq.flywheelremediationoutcome;

import java.math.BigDecimal;

public record FlywheelRemediationOutcomeMetricInput(
        BigDecimal sourceResidualAmount,
        BigDecimal resolvedAmount
) {
}
