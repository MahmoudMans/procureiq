package com.procureiq.commercialgovernance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class CommercialLeakageCalculationService {

    private static final BigDecimal HUNDRED =
            new BigDecimal(
                    "100.00"
            );

    public BigDecimal allowedValue(
            BigDecimal baseline,
            BigDecimal allowedIncreasePct
    ) {
        validateNonNegative(
                baseline,
                "Baseline"
        );

        validatePercentage(
                allowedIncreasePct
        );

        return baseline
                .multiply(
                        BigDecimal.ONE.add(
                                allowedIncreasePct.divide(
                                        HUNDRED,
                                        8,
                                        RoundingMode.HALF_UP
                                )
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal leakage(
            BigDecimal expected,
            BigDecimal actual
    ) {
        validateNonNegative(
                expected,
                "Expected"
        );

        validateNonNegative(
                actual,
                "Actual"
        );

        return actual
                .subtract(
                        expected
                )
                .max(
                        BigDecimal.ZERO
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public CommercialLeakageSeverity severity(
            BigDecimal expected,
            BigDecimal actual
    ) {
        BigDecimal leakage =
                leakage(
                        expected,
                        actual
                );

        if (
                leakage.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return CommercialLeakageSeverity.LOW;
        }

        if (
                expected.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return CommercialLeakageSeverity.CRITICAL;
        }

        BigDecimal pct =
                leakage
                        .multiply(
                                HUNDRED
                        )
                        .divide(
                                expected,
                                2,
                                RoundingMode.HALF_UP
                        );

        if (
                pct.compareTo(
                        new BigDecimal(
                                "20.00"
                        )
                ) >= 0
        ) {
            return CommercialLeakageSeverity.CRITICAL;
        }

        if (
                pct.compareTo(
                        new BigDecimal(
                                "10.00"
                        )
                ) >= 0
        ) {
            return CommercialLeakageSeverity.HIGH;
        }

        if (
                pct.compareTo(
                        new BigDecimal(
                                "5.00"
                        )
                ) >= 0
        ) {
            return CommercialLeakageSeverity.MEDIUM;
        }

        return CommercialLeakageSeverity.LOW;
    }

    private void validateNonNegative(
            BigDecimal value,
            String label
    ) {
        if (
                value == null
                ||
                value.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " value must be zero or greater."
            );
        }
    }

    private void validatePercentage(
            BigDecimal value
    ) {
        if (
                value == null
                ||
                value.compareTo(
                        BigDecimal.ZERO
                ) < 0
                ||
                value.compareTo(
                        HUNDRED
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Percentage must be between 0 and 100."
            );
        }
    }
}
