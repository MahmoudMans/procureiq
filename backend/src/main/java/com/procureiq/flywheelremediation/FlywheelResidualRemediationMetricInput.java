package com.procureiq.flywheelremediation;

import java.math.BigDecimal;

public record FlywheelResidualRemediationMetricInput(
        BigDecimal residualAmount,
        FlywheelResidualRemediationAction action
) {
}
