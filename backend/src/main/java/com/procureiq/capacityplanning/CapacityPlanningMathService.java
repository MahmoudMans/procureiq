package com.procureiq.capacityplanning;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class CapacityPlanningMathService {

    public BigDecimal effectiveCapacity(
            BigDecimal annualCapacityHours,
            BigDecimal reservedOperationalPct
    ) {
        BigDecimal capacity =
                decimal(
                        annualCapacityHours
                );

        BigDecimal reserved =
                decimal(
                        reservedOperationalPct
                )
                        .max(
                                BigDecimal.ZERO
                        )
                        .min(
                                new BigDecimal(
                                        "100.00"
                                )
                        );

        return capacity
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                                .subtract(
                                        reserved
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

    public BigDecimal assignmentHours(
            BigDecimal estimatedEffortHours,
            BigDecimal allocationPct
    ) {
        return decimal(
                estimatedEffortHours
        )
                .multiply(
                        decimal(
                                allocationPct
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

    public BigDecimal utilizationPct(
            BigDecimal assignedHours,
            BigDecimal effectiveCapacity
    ) {
        BigDecimal capacity =
                decimal(
                        effectiveCapacity
                );

        BigDecimal assigned =
                decimal(
                        assignedHours
                );

        if (
                capacity.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return assigned.compareTo(
                    BigDecimal.ZERO
            ) > 0
                    ? new BigDecimal(
                            "999.99"
                    )
                    : BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );
        }

        return assigned
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        capacity,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public CapacityHealth memberHealth(
            BigDecimal utilizationPct
    ) {
        BigDecimal utilization =
                decimal(
                        utilizationPct
                );

        if (
                utilization.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) <= 0
        ) {
            return CapacityHealth.HEALTHY;
        }

        if (
                utilization.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) <= 0
        ) {
            return CapacityHealth.TIGHT;
        }

        if (
                utilization.compareTo(
                        new BigDecimal(
                                "120.00"
                        )
                ) <= 0
        ) {
            return CapacityHealth.OVERLOADED;
        }

        return CapacityHealth.CRITICAL;
    }

    public CapacityWorkStatus workStatus(
            boolean estimated,
            BigDecimal allocationPct
    ) {
        if (!estimated) {
            return CapacityWorkStatus.UNESTIMATED;
        }

        BigDecimal allocation =
                decimal(
                        allocationPct
                );

        if (
                allocation.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return CapacityWorkStatus.UNASSIGNED;
        }

        if (
                allocation.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) < 0
        ) {
            return CapacityWorkStatus.PARTIAL;
        }

        return CapacityWorkStatus.FULL;
    }

    public CapacityScoreResult portfolioScore(
            int sourceCount,
            int estimatedSourceCount,
            BigDecimal estimatedDemandHours,
            BigDecimal assignedDemandHours,
            BigDecimal effectiveCapacityHours,
            int deadlinePressureCount
    ) {
        BigDecimal estimationCoverage =
                percent(
                        BigDecimal.valueOf(
                                estimatedSourceCount
                        ),
                        BigDecimal.valueOf(
                                sourceCount
                        )
                );

        BigDecimal assignmentCoverage =
                percent(
                        assignedDemandHours,
                        estimatedDemandHours
                );

        BigDecimal capacityCoverage;

        if (
                decimal(
                        estimatedDemandHours
                )
                        .compareTo(
                                BigDecimal.ZERO
                        )
                <= 0
        ) {
            capacityCoverage =
                    new BigDecimal(
                            "100.00"
                    );
        } else {
            capacityCoverage =
                    percent(
                            effectiveCapacityHours,
                            estimatedDemandHours
                    );
        }

        BigDecimal deadlineHealth =
                sourceCount <= 0
                        ? new BigDecimal(
                                "100.00"
                        )
                        : new BigDecimal(
                                "100.00"
                        )
                                .subtract(
                                        percent(
                                                BigDecimal.valueOf(
                                                        deadlinePressureCount
                                                ),
                                                BigDecimal.valueOf(
                                                        sourceCount
                                                )
                                        )
                                )
                                .max(
                                        BigDecimal.ZERO
                                );

        BigDecimal score =
                estimationCoverage
                        .multiply(
                                new BigDecimal(
                                        "0.20"
                                )
                        )
                        .add(
                                assignmentCoverage
                                        .multiply(
                                                new BigDecimal(
                                                        "0.30"
                                                )
                                        )
                        )
                        .add(
                                capacityCoverage
                                        .multiply(
                                                new BigDecimal(
                                                        "0.30"
                                                )
                                        )
                        )
                        .add(
                                deadlineHealth
                                        .multiply(
                                                new BigDecimal(
                                                        "0.20"
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
                                new BigDecimal(
                                        "100.00"
                                )
                        );

        CapacityHealth health;

        if (
                score.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            health =
                    CapacityHealth.HEALTHY;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            health =
                    CapacityHealth.TIGHT;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            health =
                    CapacityHealth.OVERLOADED;
        } else {
            health =
                    CapacityHealth.CRITICAL;
        }

        return new CapacityScoreResult(
                estimationCoverage,
                assignmentCoverage,
                capacityCoverage,
                deadlineHealth,
                score,
                health
        );
    }

    private BigDecimal percent(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        BigDecimal denominatorValue =
                decimal(
                        denominator
                );

        if (
                denominatorValue.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return decimal(
                numerator
        )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        denominatorValue,
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
