package com.procureiq.flywheelcontinuationrollover;

import java.math.BigDecimal;

public record FlywheelContinuationRolloverCurrencyTotal(
        String currency,
        BigDecimal amount
) {
}
