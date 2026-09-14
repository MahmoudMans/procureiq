package com.procureiq.savings;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class SavingsCalculationService {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    public BigDecimal targetSavings(
            BigDecimal baseline,
            BigDecimal negotiated
    ) {
        if (
                baseline == null
                ||
                negotiated == null
        ) {
            throw new IllegalArgumentException(
                    "Baseline and negotiated values are required."
            );
        }

        BigDecimal target =
                baseline.subtract(
                        negotiated
                );

        if (
                target.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            throw new IllegalArgumentException(
                    "Negotiated value cannot exceed the savings baseline."
            );
        }

        return target.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }

    public BigDecimal realizationRate(
            BigDecimal realized,
            BigDecimal target
    ) {
        if (
                target == null
                ||
                target.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        BigDecimal safeRealized =
                realized == null
                        ? BigDecimal.ZERO
                        : realized;

        return safeRealized
                .multiply(HUNDRED)
                .divide(
                        target,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal remaining(
            BigDecimal target,
            BigDecimal realized
    ) {
        BigDecimal safeTarget =
                target == null
                        ? BigDecimal.ZERO
                        : target;

        BigDecimal safeRealized =
                realized == null
                        ? BigDecimal.ZERO
                        : realized;

        return safeTarget
                .subtract(
                        safeRealized
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
