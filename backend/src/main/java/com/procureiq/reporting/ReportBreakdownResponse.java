package com.procureiq.reporting;

import java.math.BigDecimal;

public record ReportBreakdownResponse(
        String label,
        BigDecimal amount,
        long count,
        BigDecimal sharePercent
) {
}
