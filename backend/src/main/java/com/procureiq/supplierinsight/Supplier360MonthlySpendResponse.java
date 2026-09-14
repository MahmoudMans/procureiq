package com.procureiq.supplierinsight;

import java.math.BigDecimal;

public record Supplier360MonthlySpendResponse(
        String month,
        BigDecimal amount,
        long orderCount
) {
}
