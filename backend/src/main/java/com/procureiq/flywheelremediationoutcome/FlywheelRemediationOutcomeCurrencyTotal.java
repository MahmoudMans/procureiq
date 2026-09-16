package com.procureiq.flywheelremediationoutcome;

import java.math.BigDecimal;

public record FlywheelRemediationOutcomeCurrencyTotal(
        String currency,
        BigDecimal amount
) {
}
