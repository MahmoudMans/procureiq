package com.procureiq.benefitgovernance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class BenefitValueMathService {

    public BigDecimal atRiskAmount(
            BigDecimal baselineTarget,
            BigDecimal forecast,
            BigDecimal activeLeakage
    ) {
        BigDecimal target =
                money(
                        baselineTarget
                );

        BigDecimal forecastValue =
                money(
                        forecast
                );

        BigDecimal leakage =
                money(
                        activeLeakage
                );

        BigDecimal forecastGap =
                target
                        .subtract(
                                forecastValue
                        )
                        .max(
                                BigDecimal.ZERO
                        );

        return money(
                forecastGap.add(
                        leakage
                )
        );
    }

    public BigDecimal coveragePct(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        BigDecimal bottom =
                money(
                        denominator
                );

        if (
                bottom.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return money(
                numerator
        )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        bottom,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal gap(
            BigDecimal target,
            BigDecimal current
    ) {
        return money(
                target
        )
                .subtract(
                        money(
                                current
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
