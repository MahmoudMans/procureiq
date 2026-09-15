package com.procureiq.capabilityplanning;

import java.math.BigDecimal;

public record CapabilityPortfolioScore(
        BigDecimal requirementCoveragePct,
        BigDecimal averageAssignedFitPct,
        BigDecimal averageBenchFitPct,
        BigDecimal capabilityScore,
        CapabilityReadiness health
) {
}
