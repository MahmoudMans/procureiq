package com.procureiq.flywheelvarianceexecution;

import java.math.BigDecimal;

public record FlywheelVarianceExecutionMetricResult(
        BigDecimal capturedVarianceAmount,
        BigDecimal executedFinancialAmount,
        BigDecimal recoveredAmount,
        BigDecimal writtenOffAmount,
        BigDecimal completedInvestigationAmount,
        BigDecimal openExposureAmount,
        BigDecimal completionPct
) {
}
