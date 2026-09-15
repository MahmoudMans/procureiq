package com.procureiq.capitalrecycling;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class CapitalRecyclingMathService {

    public CapitalRecyclingMetricResult metrics(
            BigDecimal recyclableCapitalAmount,
            BigDecimal approvedReinvestmentAmount,
            BigDecimal pendingReinvestmentAmount
    ) {
        BigDecimal recyclable =
                money(
                        recyclableCapitalAmount
                );

        BigDecimal approved =
                money(
                        approvedReinvestmentAmount
                );

        BigDecimal pending =
                money(
                        pendingReinvestmentAmount
                );

        BigDecimal available =
                recyclable
                        .subtract(
                                approved
                        )
                        .subtract(
                                pending
                        )
                        .max(
                                zero()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal utilization =
                recyclable.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : approved
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        recyclable,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(
                                        zero()
                                )
                                .min(
                                        hundred()
                                );

        return new CapitalRecyclingMetricResult(
                recyclable,
                approved,
                pending,
                available,
                utilization
        );
    }

    public BigDecimal recyclableCapital(
            BigDecimal verifiedImplementedCapitalAmount,
            BigDecimal currentFundingRemainingAmount
    ) {
        return money(
                verifiedImplementedCapitalAmount
        )
                .min(
                        money(
                                currentFundingRemainingAmount
                        )
                )
                .max(
                        zero()
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal averageUtilization(
            java.util.List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return zero();
        }

        return values.stream()
                .map(
                        this::percent
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                values.size()
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal money(
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

    public BigDecimal percent(
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
                )
                .max(
                        zero()
                )
                .min(
                        hundred()
                );
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal hundred() {
        return new BigDecimal(
                "100.00"
        );
    }
}
