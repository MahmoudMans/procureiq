package com.procureiq.common.money;

import java.math.BigDecimal;

public record CurrencyTotal(
        String currency,
        BigDecimal amount
) {
}
