package com.procureiq.interventionexecution;

import java.math.BigDecimal;

public record InterventionExecutionMetricResult(
        BigDecimal approvedAffectedCapitalAmount,
        BigDecimal implementedCapitalAmount,
        BigDecimal remainingImplementationAmount,
        BigDecimal implementationPct,
        BigDecimal implementationVarianceAmount,
        InterventionExecutionHealth health
) {
}
