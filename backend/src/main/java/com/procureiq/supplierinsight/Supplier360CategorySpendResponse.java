package com.procureiq.supplierinsight;

import java.math.BigDecimal;

public record Supplier360CategorySpendResponse(
        String category,
        BigDecimal amount,
        long lineCount,
        BigDecimal sharePercent
) {
}
