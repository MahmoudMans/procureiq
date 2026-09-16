package com.procureiq.flywheelsettlement;

import java.math.BigDecimal;

public record FlywheelSettlementClassificationResult(
        BigDecimal sourceReleasedAmount,
        BigDecimal settledAmount,
        BigDecimal varianceAmount,
        FlywheelSettlementItemStatus status
) {
}
