package com.procureiq.strategyexecution;

import java.math.BigDecimal;

public record ExecutionCommitmentMetric(
        ExecutionCommitmentStatus status,
        ExecutionCommitmentHealth health,
        BigDecimal progressPct,
        BigDecimal plannedContributionPoints,
        BigDecimal validatedContributionPoints
) {
}
