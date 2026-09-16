package com.procureiq.flywheelrelease;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class FlywheelReleaseMathService {

    public FlywheelReleaseMetricResult calculate(
            BigDecimal mandateAuthorizedAmount,
            List<BigDecimal> activePlannedAmounts,
            List<BigDecimal> batchReleasedAmounts,
            BigDecimal cumulativeMandateReleasedAmount
    ) {
        BigDecimal authorized =
                money(
                        mandateAuthorizedAmount
                );

        BigDecimal planned =
                activePlannedAmounts
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

        BigDecimal batchReleased =
                batchReleasedAmounts
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

        BigDecimal cumulativeReleased =
                money(
                        cumulativeMandateReleasedAmount
                );

        BigDecimal remaining =
                authorized
                        .subtract(
                                cumulativeReleased
                        )

                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal utilization =
                authorized.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? percent(
                                BigDecimal.ZERO
                        )
                        : cumulativeReleased
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        authorized,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                ;

        return new FlywheelReleaseMetricResult(
                planned,
                batchReleased,
                cumulativeReleased,
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
