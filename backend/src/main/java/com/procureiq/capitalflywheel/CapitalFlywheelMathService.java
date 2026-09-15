package com.procureiq.capitalflywheel;

import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceHealth;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class CapitalFlywheelMathService {

    public CapitalFlywheelMetricResult metrics(
            BigDecimal originalCapitalAmount,
            List<CapitalFlywheelCycleMetricInput> cycles,
            BigDecimal minimumMarginalValueMultiple,
            BigDecimal minimumCycleEfficiencyRetentionPct,
            BigDecimal diminishingReturnTolerancePct
    ) {
        if (cycles.isEmpty()) {
            return new CapitalFlywheelMetricResult(
                    0,
                    money(
                            BigDecimal.ZERO
                    ),
                    money(
                            BigDecimal.ZERO
                    ),
                    money(
                            BigDecimal.ZERO
                    ),
                    multiple(
                            BigDecimal.ZERO
                    ),
                    multiple(
                            BigDecimal.ZERO
                    ),
                    percent(
                            BigDecimal.ZERO
                    ),
                    percent(
                            BigDecimal.ZERO
                    ),
                    percent(
                            BigDecimal.ZERO
                    ),
                    percent(
                            BigDecimal.ZERO
                    ),
                    false,
                    CapitalFlywheelHealth.EXHAUSTED,
                    CapitalFlywheelRecommendation.STOP
            );
        }

        BigDecimal originalCapital =
                money(
                        originalCapitalAmount
                );

        BigDecimal cumulativeNet =
                cycles.stream()
                        .map(
                                CapitalFlywheelCycleMetricInput::
                                        projectedNetValueAmount
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal cumulativeCompounding =
                cycles.stream()
                        .map(
                                CapitalFlywheelCycleMetricInput::
                                        compoundingValueAmount
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal cumulativeDecay =
                cycles.stream()
                        .map(
                                CapitalFlywheelCycleMetricInput::
                                        decayedValueAmount
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        CapitalFlywheelCycleMetricInput latest =
                cycles.get(
                        cycles.size() - 1
                );

        BigDecimal latestNet =
                money(
                        latest.projectedNetValueAmount()
                );

        BigDecimal cumulativeValueMultiple =
                ratioMultiple(
                        cumulativeNet,
                        originalCapital
                );

        BigDecimal latestMarginalValueMultiple =
                ratioMultiple(
                        latestNet,
                        originalCapital
                );

        BigDecimal marginalRetention =
                cycles.size() == 1
                        ? new BigDecimal(
                                "100.00"
                        )
                        : ratioPercent(
                                latestNet,
                                money(
                                        cycles.get(
                                                cycles.size() - 2
                                        )
                                                .projectedNetValueAmount()
                                )
                        );

        BigDecimal latestEfficiencyRetention =
                percent(
                        latest.efficiencyRetentionPct()
                );

        BigDecimal latestPersistence =
                percent(
                        latest.valuePersistencePct()
                );

        BigDecimal latestRoi =
                decimal(
                        latest.projectedRoiPct()
                );

        boolean diminishing =
                cycles.size() > 1
                        &&
                        (
                                marginalRetention.compareTo(
                                        percent(
                                                diminishingReturnTolerancePct
                                        )
                                ) < 0
                                ||
                                latestEfficiencyRetention.compareTo(
                                        percent(
                                                minimumCycleEfficiencyRetentionPct
                                        )
                                ) < 0
                        );

        CapitalFlywheelHealth health;

        if (
                latestNet.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                ||
                latest.persistenceHealth()
                        == ReinvestmentPersistenceHealth.REGRESSED
                ||
                latest.persistenceHealth()
                        == ReinvestmentPersistenceHealth.DECAYING
        ) {
            health =
                    CapitalFlywheelHealth.EXHAUSTED;
        } else if (
                cycles.size() == 1
        ) {
            health =
                    CapitalFlywheelHealth.SINGLE_CYCLE;
        } else if (
                latest.persistenceHealth()
                        == ReinvestmentPersistenceHealth.COMPOUNDING
                &&
                marginalRetention.compareTo(
                        new BigDecimal(
                                "110.00"
                        )
                ) >= 0
                &&
                latestEfficiencyRetention.compareTo(
                        new BigDecimal(
                                "110.00"
                        )
                ) >= 0
        ) {
            health =
                    CapitalFlywheelHealth.COMPOUNDING;
        } else if (diminishing) {
            health =
                    CapitalFlywheelHealth.DIMINISHING;
        } else {
            health =
                    CapitalFlywheelHealth.HEALTHY;
        }

        CapitalFlywheelRecommendation recommendation;

        if (
                health
                        == CapitalFlywheelHealth.EXHAUSTED
                ||
                cumulativeNet.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            recommendation =
                    CapitalFlywheelRecommendation.STOP;
        } else if (
                health
                        == CapitalFlywheelHealth.DIMINISHING
                ||
                latestMarginalValueMultiple.compareTo(
                        multiple(
                                minimumMarginalValueMultiple
                        )
                ) < 0
        ) {
            recommendation =
                    CapitalFlywheelRecommendation.HOLD;
        } else {
            recommendation =
                    CapitalFlywheelRecommendation.CONTINUE;
        }

        return new CapitalFlywheelMetricResult(
                cycles.size(),

                cumulativeNet,
                cumulativeCompounding,
                cumulativeDecay,

                cumulativeValueMultiple,
                latestMarginalValueMultiple,
                marginalRetention,

                latestEfficiencyRetention,
                latestPersistence,
                latestRoi,

                diminishing,

                health,
                recommendation
        );
    }

    public BigDecimal averageMultiple(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return multiple(
                    BigDecimal.ZERO
            );
        }

        return values.stream()
                .map(
                        this::multiple
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                values.size()
                        ),
                        4,
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
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "999.99"
                        )
                );
    }

    public BigDecimal multiple(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        4,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal ratioMultiple(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        if (
                denominator == null
                ||
                denominator.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return multiple(
                    BigDecimal.ZERO
            );
        }

        return numerator
                .divide(
                        denominator,
                        4,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal ratioPercent(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        if (
                denominator == null
                ||
                denominator.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            if (
                    numerator != null
                    &&
                    numerator.compareTo(
                            BigDecimal.ZERO
                    ) > 0
            ) {
                return new BigDecimal(
                        "999.99"
                );
            }

            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return numerator
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        denominator,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "999.99"
                        )
                );
    }
}
