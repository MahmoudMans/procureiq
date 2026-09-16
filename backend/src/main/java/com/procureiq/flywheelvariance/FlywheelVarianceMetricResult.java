package com.procureiq.flywheelvariance;

import java.math.BigDecimal;

public record FlywheelVarianceMetricResult(
        BigDecimal governedAmount,
        BigDecimal recoverAmount,
        BigDecimal writeOffAmount,
        BigDecimal investigationAmount,
        BigDecimal coveragePct
) {
}
