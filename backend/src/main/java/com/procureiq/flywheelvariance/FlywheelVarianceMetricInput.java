package com.procureiq.flywheelvariance;

import java.math.BigDecimal;

public record FlywheelVarianceMetricInput(
        FlywheelVarianceDecision decision,
        BigDecimal amount
) {
}
