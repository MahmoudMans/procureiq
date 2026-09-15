package com.procureiq.successionplanning;

import java.math.BigDecimal;

public record SuccessionPortfolioScore(
        BigDecimal policyCoveragePct,
        BigDecimal averagePolicyScore,
        BigDecimal successionScore,
        SuccessionHealth health
) {
}
