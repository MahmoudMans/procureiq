package com.procureiq.analytics;

import java.math.BigDecimal;

public record MonthlySpendResponse(
        String month,
        BigDecimal amount,
        long orderCount
) {
}
