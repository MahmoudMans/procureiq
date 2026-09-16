package com.procureiq.common.money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Function;

public final class CurrencyTotals {

    private CurrencyTotals() {
    }

    public static <T> List<CurrencyTotal> sum(
            List<T> rows,
            Function<T, String> currency,
            Function<T, BigDecimal> amount
    ) {
        Map<String, BigDecimal> totals = new TreeMap<>();

        for (T row : rows) {
            String code = Objects.requireNonNull(
                    currency.apply(row),
                    "currency"
            ).trim().toUpperCase(Locale.ROOT);

            if (!code.matches("[A-Z]{3}")) {
                throw new IllegalArgumentException(
                        "Invalid reporting currency: " + code
                );
            }

            BigDecimal value = Objects.requireNonNull(
                    amount.apply(row),
                    "amount"
            ).setScale(2, RoundingMode.UNNECESSARY);

            totals.merge(code, value, BigDecimal::add);
        }

        return totals.entrySet().stream()
                .map(entry -> new CurrencyTotal(
                        entry.getKey(),
                        entry.getValue()
                ))
                .toList();
    }
}
