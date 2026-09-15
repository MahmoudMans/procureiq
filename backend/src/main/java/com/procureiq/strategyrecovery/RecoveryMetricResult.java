package com.procureiq.strategyrecovery;

import java.math.BigDecimal;

public record RecoveryMetricResult(
        BigDecimal currentRiskScore,
        BigDecimal recoveryScore,
        BigDecimal effectivenessPct,
        RecoveryHealth recoveryHealth
) {
}
