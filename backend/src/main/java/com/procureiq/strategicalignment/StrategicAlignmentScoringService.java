package com.procureiq.strategicalignment;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class StrategicAlignmentScoringService {

    public AlignmentStatus status(
            BigDecimal allocationPct
    ) {
        BigDecimal allocation =
                decimal(
                        allocationPct
                );

        if (
                allocation.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return AlignmentStatus.UNALIGNED;
        }

        if (
                allocation.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) > 0
        ) {
            return AlignmentStatus.CONFLICT;
        }

        if (
                allocation.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) == 0
        ) {
            return AlignmentStatus.FULL;
        }

        return AlignmentStatus.PARTIAL;
    }

    public AlignmentScoreResult score(
            List<AlignmentItemMetric> items,
            int objectiveCount,
            int objectivesWithAlignment
    ) {
        int sourceCount =
                items.size();

        long alignedCount =
                items.stream()
                        .filter(
                                item ->
                                        decimal(
                                                item.allocationPct()
                                        )
                                                .compareTo(
                                                        BigDecimal.ZERO
                                                )
                                        > 0
                        )
                        .count();

        BigDecimal totalValue =
                items.stream()
                        .map(
                                AlignmentItemMetric::
                                        strategicValue
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal alignedValue =
                items.stream()
                        .filter(
                                item ->
                                        decimal(
                                                item.allocationPct()
                                        )
                                                .compareTo(
                                                        BigDecimal.ZERO
                                                )
                                        > 0
                        )
                        .map(
                                AlignmentItemMetric::
                                        strategicValue
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal totalRisk =
                items.stream()
                        .map(
                                AlignmentItemMetric::
                                        riskExposure
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal alignedRisk =
                items.stream()
                        .filter(
                                item ->
                                        decimal(
                                                item.allocationPct()
                                        )
                                                .compareTo(
                                                        BigDecimal.ZERO
                                                )
                                        > 0
                        )
                        .map(
                                AlignmentItemMetric::
                                        riskExposure
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        long deadlineConflicts =
                items.stream()
                        .mapToLong(
                                AlignmentItemMetric::
                                        deadlineConflictCount
                        )
                        .sum();

        BigDecimal sourceCoverage =
                percent(
                        BigDecimal.valueOf(
                                alignedCount
                        ),
                        BigDecimal.valueOf(
                                sourceCount
                        )
                );

        BigDecimal objectiveCoverage =
                percent(
                        BigDecimal.valueOf(
                                objectivesWithAlignment
                        ),
                        BigDecimal.valueOf(
                                objectiveCount
                        )
                );

        BigDecimal valueCoverage =
                totalValue.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? sourceCoverage
                        : percent(
                                alignedValue,
                                totalValue
                        );

        BigDecimal riskCoverage =
                totalRisk.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? sourceCoverage
                        : percent(
                                alignedRisk,
                                totalRisk
                        );

        BigDecimal scheduleAlignment =
                alignedCount == 0
                        ? BigDecimal.ZERO
                        : new BigDecimal(
                                "100.00"
                        )
                                .subtract(
                                        percent(
                                                BigDecimal.valueOf(
                                                        deadlineConflicts
                                                ),
                                                BigDecimal.valueOf(
                                                        alignedCount
                                                )
                                        )
                                )
                                .max(
                                        BigDecimal.ZERO
                                );

        BigDecimal score =
                sourceCoverage
                        .multiply(
                                new BigDecimal(
                                        "0.35"
                                )
                        )
                        .add(
                                objectiveCoverage
                                        .multiply(
                                                new BigDecimal(
                                                        "0.15"
                                                )
                                        )
                        )
                        .add(
                                valueCoverage
                                        .multiply(
                                                new BigDecimal(
                                                        "0.25"
                                                )
                                        )
                        )
                        .add(
                                riskCoverage
                                        .multiply(
                                                new BigDecimal(
                                                        "0.20"
                                                )
                                        )
                        )
                        .add(
                                scheduleAlignment
                                        .multiply(
                                                new BigDecimal(
                                                        "0.05"
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

        AlignmentHealth health;

        if (
                score.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            health =
                    AlignmentHealth.EXCELLENT;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            health =
                    AlignmentHealth.STRONG;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            health =
                    AlignmentHealth.WATCH;
        } else {
            health =
                    AlignmentHealth.CRITICAL;
        }

        return new AlignmentScoreResult(
                sourceCoverage,
                objectiveCoverage,
                valueCoverage,
                riskCoverage,
                scheduleAlignment,
                score,
                health
        );
    }

    private BigDecimal percent(
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
                        decimal(
                                denominator
                        ),
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

    private BigDecimal money(
            BigDecimal value
    ) {
        return decimal(
                value
        );
    }

    private BigDecimal decimal(
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
