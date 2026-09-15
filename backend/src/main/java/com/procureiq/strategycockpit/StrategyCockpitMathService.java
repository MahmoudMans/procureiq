package com.procureiq.strategycockpit;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class StrategyCockpitMathService {

    public BigDecimal weightedScore(
            List<WeightedBoardDimension> dimensions
    ) {
        if (dimensions.isEmpty()) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        BigDecimal totalWeight =
                dimensions.stream()
                        .map(
                                WeightedBoardDimension::
                                        weightPct
                        )
                        .map(
                                this::decimal
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
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        BigDecimal weighted =
                dimensions.stream()
                        .map(
                                dimension ->
                                        boundedScore(
                                                dimension.score()
                                        )
                                                .multiply(
                                                        decimal(
                                                                dimension.weightPct()
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
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    public BigDecimal contribution(
            BigDecimal score,
            BigDecimal weightPct
    ) {
        return boundedScore(
                score
        )
                .multiply(
                        decimal(
                                weightPct
                        )
                )
                .divide(
                        new BigDecimal(
                                "100.00"
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BoardHealth health(
            BigDecimal score
    ) {
        BigDecimal normalized =
                boundedScore(
                        score
                );

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            return BoardHealth.EXCELLENT;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return BoardHealth.STRONG;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return BoardHealth.WATCH;
        }

        return BoardHealth.CRITICAL;
    }

    public BoardMovement movement(
            BigDecimal current,
            BigDecimal previous
    ) {
        if (previous == null) {
            return BoardMovement.BASELINE;
        }

        BigDecimal delta =
                boundedScore(
                        current
                )
                        .subtract(
                                boundedScore(
                                        previous
                                )
                        );

        if (
                delta.compareTo(
                        new BigDecimal(
                                "2.00"
                        )
                ) >= 0
        ) {
            return BoardMovement.IMPROVING;
        }

        if (
                delta.compareTo(
                        new BigDecimal(
                                "-2.00"
                        )
                ) <= 0
        ) {
            return BoardMovement.DETERIORATING;
        }

        return BoardMovement.STABLE;
    }

    public BigDecimal delta(
            BigDecimal current,
            BigDecimal previous
    ) {
        if (previous == null) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return boundedScore(
                current
        )
                .subtract(
                        boundedScore(
                                previous
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal average(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return values.stream()
                .map(
                        this::boundedScore
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

    public BigDecimal boundedScore(
            BigDecimal value
    ) {
        return decimal(
                value
        )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
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
}
