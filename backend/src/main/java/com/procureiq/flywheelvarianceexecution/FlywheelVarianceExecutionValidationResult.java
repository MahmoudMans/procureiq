package com.procureiq.flywheelvarianceexecution;

import java.math.BigDecimal;

public record FlywheelVarianceExecutionValidationResult(
        BigDecimal sourceVarianceAmount,
        BigDecimal executedAmount,
        BigDecimal openExposureAmount,
        FlywheelVarianceExecutionOutcome outcome
) {
}
