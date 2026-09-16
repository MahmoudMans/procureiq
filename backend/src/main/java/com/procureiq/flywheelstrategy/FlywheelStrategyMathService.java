package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelHealth;
import com.procureiq.capitalflywheel.CapitalFlywheelRecommendation;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class FlywheelStrategyMathService {

    public FlywheelStrategyPriorityResult priority(
            FlywheelStrategyPriorityInput input
    ) {
        BigDecimal marginalScore =
                clampScore(
                        decimal(
                                input.latestMarginalValueMultiple()
                        ).multiply(
                                new BigDecimal("100.00")
                        )
                );

        BigDecimal cumulativeScore =
                clampScore(
                        decimal(
                                input.cumulativeValueMultiple()
                        ).multiply(
                                new BigDecimal("50.00")
                        )
                );

        BigDecimal retentionScore =
                clampScore(
                        input.latestMarginalNetValueRetentionPct()
                );

        BigDecimal healthScore =
                healthScore(
                        input.flywheelHealth()
                );

        BigDecimal recommendationScore =
                recommendationScore(
                        input.step66Recommendation()
                );

        BigDecimal score =
                marginalScore
                        .multiply(
                                new BigDecimal("0.35")
                        )
                        .add(
                                cumulativeScore.multiply(
                                        new BigDecimal("0.25")
                                )
                        )
                        .add(
                                retentionScore.multiply(
                                        new BigDecimal("0.20")
                                )
                        )
                        .add(
                                healthScore.multiply(
                                        new BigDecimal("0.10")
                                )
                        )
                        .add(
                                recommendationScore.multiply(
                                        new BigDecimal("0.10")
                                )
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        FlywheelStrategyAdvisory advisory;

        if (
                input.step66Recommendation()
                        == CapitalFlywheelRecommendation.STOP
                ||
                input.flywheelHealth()
                        == CapitalFlywheelHealth.EXHAUSTED
        ) {
            advisory =
                    FlywheelStrategyAdvisory.EXIT;
        } else if (
                input.diminishingReturns()
                ||
                input.step66Recommendation()
                        == CapitalFlywheelRecommendation.HOLD
        ) {
            advisory =
                    FlywheelStrategyAdvisory.HOLD;
        } else if (
                score.compareTo(
                        new BigDecimal("70.00")
                ) >= 0
        ) {
            advisory =
                    FlywheelStrategyAdvisory.PRIORITIZE;
        } else if (
                score.compareTo(
                        new BigDecimal("45.00")
                ) >= 0
        ) {
            advisory =
                    FlywheelStrategyAdvisory.HOLD;
        } else {
            advisory =
                    FlywheelStrategyAdvisory.EXIT;
        }

        return new FlywheelStrategyPriorityResult(
                score,
                advisory
        );
    }

    public FlywheelStrategyPortfolioMetricResult portfolio(
            BigDecimal capitalCapacityAmount,
            List<BigDecimal> prioritizedCapacityAmounts,
            List<BigDecimal> priorityScores
    ) {
        BigDecimal capacity =
                money(
                        capitalCapacityAmount
                );

        BigDecimal prioritized =
                prioritizedCapacityAmounts.stream()
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
                        .subtract(prioritized)
                        .max(BigDecimal.ZERO)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal utilization =
                capacity.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : prioritized
                                .multiply(hundred())
                                .divide(
                                        capacity,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(zero())
                                .min(hundred());

        BigDecimal averageScore =
                priorityScores.isEmpty()
                        ? zero()
                        : priorityScores.stream()
                                .map(this::clampScore)
                                .reduce(
                                        BigDecimal.ZERO,
                                        BigDecimal::add
                                )
                                .divide(
                                        BigDecimal.valueOf(
                                                priorityScores.size()
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new FlywheelStrategyPortfolioMetricResult(
                prioritized,
                remaining,
                utilization,
                averageScore
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

    public BigDecimal decimal(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        ).setScale(
                4,
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

    private BigDecimal healthScore(
            CapitalFlywheelHealth health
    ) {
        return switch (health) {
            case COMPOUNDING ->
                    new BigDecimal("100.00");

            case HEALTHY ->
                    new BigDecimal("85.00");

            case SINGLE_CYCLE ->
                    new BigDecimal("65.00");

            case DIMINISHING ->
                    new BigDecimal("35.00");

            case EXHAUSTED ->
                    zero();
        };
    }

    private BigDecimal recommendationScore(
            CapitalFlywheelRecommendation recommendation
    ) {
        return switch (recommendation) {
            case CONTINUE ->
                    new BigDecimal("100.00");

            case HOLD ->
                    new BigDecimal("45.00");

            case STOP ->
                    zero();
        };
    }

    private BigDecimal clampScore(
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
                .max(zero())
                .min(hundred());
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }

    private BigDecimal hundred() {
        return new BigDecimal("100.00");
    }
}
