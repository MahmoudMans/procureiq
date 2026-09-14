package com.procureiq.savings;

import java.math.BigDecimal;

public record SavingsMonthlyResponse(
        String month,
        BigDecimal realizedSavings,
        long realizationCount
) {
}
