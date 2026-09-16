package com.procureiq.flywheelcontinuation;

import java.math.BigDecimal;

public record FlywheelResidualContinuationCurrencyTotal(
        String currency,
        BigDecimal amount
) {
}
