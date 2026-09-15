package com.procureiq.strategyroadmap;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class StrategyRoadmapMathService {

    public RoadmapReadinessResult readiness(
            int initiativeCount,
            int ownedInitiativeCount,
            int dependencyCount,
            int satisfiedDependencyCount,
            int milestoneCount,
            int healthyMilestoneCount,
            int gateCount,
            int healthyGateCount,
            int rejectedGateCount
    ) {
        if (initiativeCount <= 0) {
            return new RoadmapReadinessResult(
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    RoadmapReadinessHealth.UNDEFINED
            );
        }

        BigDecimal ownerCoverage =
                percent(
                        ownedInitiativeCount,
                        initiativeCount
                );

        BigDecimal dependencyHealth =
                dependencyCount <= 0
                        ? hundred()
                        : percent(
                                satisfiedDependencyCount,
                                dependencyCount
                        );

        BigDecimal milestoneHealth =
                milestoneCount <= 0
                        ? hundred()
                        : percent(
                                healthyMilestoneCount,
                                milestoneCount
                        );

        BigDecimal gateHealth =
                gateCount <= 0
                        ? hundred()
                        : percent(
                                healthyGateCount,
                                gateCount
                        );

        BigDecimal score =
                ownerCoverage
                        .multiply(
                                new BigDecimal(
                                        "0.20"
                                )
                        )
                        .add(
                                dependencyHealth
                                        .multiply(
                                                new BigDecimal(
                                                        "0.30"
                                                )
                                        )
                        )
                        .add(
                                milestoneHealth
                                        .multiply(
                                                new BigDecimal(
                                                        "0.25"
                                                )
                                        )
                        )
                        .add(
                                gateHealth
                                        .multiply(
                                                new BigDecimal(
                                                        "0.25"
                                                )
                                        )
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .min(
                                hundred()
                        );

        RoadmapReadinessHealth health;

        if (rejectedGateCount > 0) {
            health =
                    RoadmapReadinessHealth.BLOCKED;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            health =
                    RoadmapReadinessHealth.READY;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            health =
                    RoadmapReadinessHealth.WATCH;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            health =
                    RoadmapReadinessHealth.AT_RISK;
        } else {
            health =
                    RoadmapReadinessHealth.BLOCKED;
        }

        return new RoadmapReadinessResult(
                ownerCoverage,
                dependencyHealth,
                milestoneHealth,
                gateHealth,
                score,
                health
        );
    }

    private BigDecimal percent(
            int numerator,
            int denominator
    ) {
        if (denominator <= 0) {
            return zero();
        }

        return BigDecimal
                .valueOf(
                        numerator
                )
                .multiply(
                        hundred()
                )
                .divide(
                        BigDecimal.valueOf(
                                denominator
                        ),
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        BigDecimal.ZERO
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
