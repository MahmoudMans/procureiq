package com.procureiq.strategycockpit;

import java.math.BigDecimal;

public record BoardExceptionResponse(
        String stableKey,
        BoardExceptionType type,
        BoardExceptionSeverity severity,
        String title,
        String detail,
        int occurrenceCount,
        BigDecimal metricValue,
        String sourceRoute
) {
}
