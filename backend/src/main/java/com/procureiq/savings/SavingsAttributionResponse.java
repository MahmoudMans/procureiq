package com.procureiq.savings;

import java.math.BigDecimal;

public record SavingsAttributionResponse(
        String label,
        BigDecimal targetSavings,
        BigDecimal realizedSavings,
        long initiativeCount,
        BigDecimal realizationRate
) {
}
