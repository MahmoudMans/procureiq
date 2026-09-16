package com.procureiq.flywheelsettlement;

import java.math.BigDecimal;

public record FlywheelSettlementMetricResult(
        BigDecimal settledAmount,
        BigDecimal varianceAmount,
        BigDecimal settlementPct
) {
}
