package com.procureiq.executive;

import java.math.BigDecimal;

public record ExecutivePortfolioSignalResponse(
        ExecutiveSignalType signalType,
        long warningCount,
        long criticalCount,
        BigDecimal riskExposure,
        BigDecimal opportunityValue
) {
}
