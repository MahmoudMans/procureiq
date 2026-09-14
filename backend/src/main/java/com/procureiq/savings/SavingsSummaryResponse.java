package com.procureiq.savings;

import java.math.BigDecimal;

public record SavingsSummaryResponse(
        int fiscalYear,
        String currency,
        long totalInitiatives,
        long validatedInitiatives,
        long pendingInitiatives,
        long rejectedInitiatives,
        BigDecimal validatedTargetSavings,
        BigDecimal realizedSavings,
        BigDecimal remainingSavings,
        BigDecimal realizationRate,
        BigDecimal hardSavings,
        BigDecimal costAvoidance
) {
}
