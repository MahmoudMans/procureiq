package com.procureiq.flywheelremediation;

import java.math.BigDecimal;

public record FlywheelResidualRemediationCurrencyTotal(
        String currency,
        BigDecimal amount
) {
}
