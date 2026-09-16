package com.procureiq.flywheelallocation;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class FlywheelAllocationMathService {

    public FlywheelAllocationMetricResult calculate(
            BigDecimal strategyPrioritizedCapacityAmount,
            List<BigDecimal> requestedAllocationAmounts
    ) {
        BigDecimal capacity =
                money(
                        strategyPrioritizedCapacityAmount
                );

        BigDecimal requested =
                requestedAllocationAmounts
                        .stream()
                        .map(this::money)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal remaining =
                capacity
                        .subtract(requested)
                        .max(BigDecimal.ZERO)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal utilization =
                capacity.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? percent(
                                BigDecimal.ZERO
                        )
                        : requested
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        capacity,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(
                                        percent(
                                                BigDecimal.ZERO
                                        )
                                )
                                .min(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                );

        return new FlywheelAllocationMetricResult(
                requested,
                remaining,
                utilization
        );
    }

    public BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        ).setScale(
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
        ).setScale(
                2,
                RoundingMode.HALF_UP
        );
    }
}
