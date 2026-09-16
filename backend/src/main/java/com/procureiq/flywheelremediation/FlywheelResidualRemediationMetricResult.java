package com.procureiq.flywheelremediation;

import java.math.BigDecimal;

public record FlywheelResidualRemediationMetricResult(
        BigDecimal coveredResidualAmount,
        BigDecimal recoveryFollowUpAmount,
        BigDecimal writeOffReviewAmount,
        BigDecimal investigationEscalationAmount,
        BigDecimal residualAcceptanceReviewAmount,
        int itemCount
) {
}
