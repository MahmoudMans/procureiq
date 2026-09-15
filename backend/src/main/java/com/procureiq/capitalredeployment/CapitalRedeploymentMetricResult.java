package com.procureiq.capitalredeployment;

import java.math.BigDecimal;

public record CapitalRedeploymentMetricResult(
        BigDecimal approvedRedeploymentAmount,
        BigDecimal releasedRedeploymentAmount,
        BigDecimal remainingRedeploymentAmount,
        BigDecimal redeploymentPct,
        BigDecimal redeploymentVarianceAmount,
        CapitalRedeploymentHealth health
) {
}
