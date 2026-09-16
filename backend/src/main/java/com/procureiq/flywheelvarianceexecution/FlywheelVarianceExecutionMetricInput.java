package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;

import java.math.BigDecimal;

public record FlywheelVarianceExecutionMetricInput(
        FlywheelVarianceDecision decision,
        BigDecimal sourceVarianceAmount,
        BigDecimal executedAmount,
        FlywheelVarianceExecutionOutcome outcome
) {
}
