package com.procureiq.strategicokr;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
public class StrategicOkrMathService {

    public BigDecimal progress(
            KeyResultDirection direction,
            BigDecimal baseline,
            BigDecimal target,
            BigDecimal actual
    ) {
        BigDecimal base =
                decimal(
                        baseline
                );

        BigDecimal targetValue =
                decimal(
                        target
                );

        BigDecimal actualValue =
                decimal(
                        actual
                );

        BigDecimal denominator;

        BigDecimal numerator;

        if (
                direction
                        == KeyResultDirection.INCREASE
        ) {
            denominator =
                    targetValue
                            .subtract(
                                    base
                            );

            numerator =
                    actualValue
                            .subtract(
                                    base
                            );
        } else {
            denominator =
                    base
                            .subtract(
                                    targetValue
                            );

            numerator =
                    base
                            .subtract(
                                    actualValue
                            );
        }

        if (
                denominator.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            boolean reached =
                    direction
                                    == KeyResultDirection.INCREASE
                            ? actualValue.compareTo(
                                    targetValue
                            ) >= 0
                            : actualValue.compareTo(
                                    targetValue
                            ) <= 0;

            return reached
                    ? hundred()
                    : zero();
        }

        return numerator
                .multiply(
                        hundred()
                )
                .divide(
                        denominator,
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

    public StrategicHealth health(
            BigDecimal progress
    ) {
        BigDecimal normalized =
                decimal(
                        progress
                );

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) >= 0
        ) {
            return StrategicHealth.ACHIEVED;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "80.00"
                        )
                ) >= 0
        ) {
            return StrategicHealth.ON_TRACK;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "60.00"
                        )
                ) >= 0
        ) {
            return StrategicHealth.AT_RISK;
        }

        return StrategicHealth.OFF_TRACK;
    }

    public BigDecimal confidence(
            KeyResultSourceType sourceType,
            Instant sourceObservedAt,
            Instant now
    ) {
        if (
                sourceType
                        == KeyResultSourceType.MANUAL
        ) {
            return new BigDecimal(
                    "70.00"
            );
        }

        if (
                sourceType.name()
                        .startsWith(
                                "CONTINUOUS_IMPROVEMENT_"
                        )
        ) {
            return new BigDecimal(
                    "90.00"
            );
        }

        if (sourceObservedAt == null) {
            return new BigDecimal(
                    "50.00"
            );
        }

        long ageDays =
                Math.max(
                        0,
                        Duration.between(
                                sourceObservedAt,
                                now
                        )
                                .toDays()
                );

        if (ageDays <= 14) {
            return hundred();
        }

        if (ageDays <= 30) {
            return new BigDecimal(
                    "85.00"
            );
        }

        if (ageDays <= 60) {
            return new BigDecimal(
                    "70.00"
            );
        }

        return new BigDecimal(
                "50.00"
        );
    }

    public BigDecimal weightedScore(
            List<WeightedValue> values
    ) {
        BigDecimal totalWeight =
                values.stream()
                        .map(
                                WeightedValue::weight
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                totalWeight.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return zero();
        }

        BigDecimal weighted =
                values.stream()
                        .map(
                                value ->
                                        decimal(
                                                value.value()
                                        )
                                                .multiply(
                                                        decimal(
                                                                value.weight()
                                                        )
                                                )
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return weighted
                .divide(
                        totalWeight,
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

    public BigDecimal decimal(
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

    public record WeightedValue(
            BigDecimal value,
            BigDecimal weight
    ) {
    }
}
