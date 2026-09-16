package com.procureiq.flywheelcontinuationoutcome;

import java.math.BigDecimal;

public record FlywheelContinuationOutcomeCurrencyTotal(
        String currency,
        BigDecimal amount
) {
}
