package com.procureiq.outcomepersistence;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class OutcomePersistenceMathService {

    public PersistenceMetricResult persistence(
            BigDecimal baselineValidatedPoints,
            BigDecimal currentValidatedPoints,
            boolean assessed
    ) {
        if (!assessed) {
            return new PersistenceMetricResult(
                    zero(),
                    zero(),
                    PersistenceHealth.UNASSESSED
            );
        }

        BigDecimal baseline =
                decimal(
                        baselineValidatedPoints
                );

        BigDecimal current =
                decimal(
                        currentValidatedPoints
                );

        if (
                baseline.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return new PersistenceMetricResult(
                    hundred(),
                    zero(),
                    PersistenceHealth.SUSTAINED
            );
        }

        BigDecimal persistencePct =
                current
                        .multiply(
                                hundred()
                        )
                        .divide(
                                baseline,
                                2,
                                RoundingMode.HALF_UP
                        )
                        .max(
                                zero()
                        )
                        .min(
                                hundred()
                        );

        BigDecimal decayPoints =
                baseline
                        .subtract(
                                current
                        )
                        .max(
                                zero()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new PersistenceMetricResult(
                persistencePct,
                decayPoints,
                health(
                        persistencePct
                )
        );
    }

    public PersistenceHealth health(
            BigDecimal persistencePct
    ) {
        BigDecimal pct =
                bounded(
                        persistencePct
                );

        if (
                pct.compareTo(
                        new BigDecimal(
                                "90.00"
                        )
                ) >= 0
        ) {
            return PersistenceHealth.SUSTAINED;
        }

        if (
                pct.compareTo(
                        new BigDecimal(
                                "75.00"
                        )
                ) >= 0
        ) {
            return PersistenceHealth.WATCH;
        }

        if (
                pct.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return PersistenceHealth.DECAYING;
        }

        return PersistenceHealth.REGRESSED;
    }

    public PersistenceHealth portfolioHealth(
            List<PersistenceMetricResult> assessedMetrics
    ) {
        if (assessedMetrics.isEmpty()) {
            return PersistenceHealth.UNASSESSED;
        }

        BigDecimal average =
                average(
                        assessedMetrics.stream()
                                .map(
                                        PersistenceMetricResult::
                                                persistencePct
                                )
                                .toList()
                );

        return health(
                average
        );
    }

    public BigDecimal average(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return zero();
        }

        return values.stream()
                .map(
                        this::decimal
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

    public BigDecimal bounded(
            BigDecimal value
    ) {
        return decimal(
                value
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
