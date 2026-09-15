package com.procureiq.fundingexecution;

import java.math.BigDecimal;

public record FundingMetricResult(
        BigDecimal remainingAuthorizationAmount,
        BigDecimal remainingCommitmentAmount,
        BigDecimal plannedCoveragePct,
        BigDecimal releasePct
) {
}
