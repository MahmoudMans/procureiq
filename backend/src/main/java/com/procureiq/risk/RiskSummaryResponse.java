package com.procureiq.risk;

import java.math.BigDecimal;

public record RiskSummaryResponse(
        long totalCases,
        long openCases,
        long criticalCases,
        long highCases,
        long overdueCases,
        long escalatedCases,
        long resolvedCases,
        BigDecimal averageOpenRiskScore
) {
}
